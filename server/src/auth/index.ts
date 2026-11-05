import type { FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { loginCodes, sessions, users } from '../db/schema/index.ts';
import { config } from '../config.ts';
import {
  generateLoginCode, generateToken, hashLoginCode, hashToken,
  isValidEmail, normalizeEmail, safeEqual,
} from '../security.ts';

export interface AuthedUser {
  id: string;
  email: string;
  name: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthedUser;
  }
}

const SESSION_TTL_MS = config.sessionTtlDays * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = config.loginCodeTtlMinutes * 60 * 1000;

/**
 * Issues a sign-in code for an email address.
 *
 * Returns the code only when `config.allowDevLoginCode` is on (development and
 * tests). In production this must be wired to a mail provider and the code must
 * never travel back in the HTTP response.
 */
export async function requestLoginCode(
  rawEmail: string,
): Promise<{ email: string; devCode?: string; expiresInMinutes: number }> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    throw Object.assign(new Error('That email address is not valid.'), { statusCode: 400 });
  }

  const code = generateLoginCode();

  // Invalidate any outstanding codes for this address so only the newest works.
  await db
    .update(loginCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(loginCodes.email, email), isNull(loginCodes.consumedAt)));

  await db.insert(loginCodes).values({
    email,
    codeHash: hashLoginCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  return {
    email,
    devCode: config.allowDevLoginCode ? code : undefined,
    expiresInMinutes: config.loginCodeTtlMinutes,
  };
}

/**
 * Exchanges a code for a session token.
 *
 * Every failure mode returns the same message so the endpoint cannot be used to
 * discover whether an email is registered.
 */
export async function verifyLoginCode(rawEmail: string, code: string): Promise<{
  token: string;
  user: AuthedUser;
  expiresAt: string;
}> {
  const email = normalizeEmail(rawEmail);
  const invalid = () =>
    Object.assign(new Error('That code is invalid or has expired.'), { statusCode: 401 });

  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) throw invalid();

  const [record] = await db
    .select()
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.email, email),
        isNull(loginCodes.consumedAt),
        gt(loginCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(sql`${loginCodes.createdAt} desc`)
    .limit(1);

  if (!record) throw invalid();

  if (record.attempts >= config.loginCodeMaxAttempts) {
    await db.update(loginCodes).set({ consumedAt: new Date() }).where(eq(loginCodes.id, record.id));
    throw invalid();
  }

  if (!safeEqual(record.codeHash, hashLoginCode(code))) {
    // Count the miss; too many and the code is burnt above.
    await db
      .update(loginCodes)
      .set({ attempts: record.attempts + 1 })
      .where(eq(loginCodes.id, record.id));
    throw invalid();
  }

  // Single use.
  await db.update(loginCodes).set({ consumedAt: new Date() }).where(eq(loginCodes.id, record.id));

  const [user] = await db
    .insert(users)
    .values({ email, isOnboarded: true })
    .onConflictDoUpdate({
      target: users.email,
      set: { updatedAt: new Date() },
    })
    .returning();

  if (!user) throw invalid();

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
  });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
    expiresAt: expiresAt.toISOString(),
  };
}

/** Resolves a bearer token to a user, or throws a 401. */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Authentication required.' });
  }

  const token = header.slice('Bearer '.length).trim();
  if (token.length < 20) {
    return reply.code(401).send({ error: 'Authentication required.' });
  }

  const tokenHash = hashToken(token);
  const [row] = await db
    .select({
      userId: sessions.userId,
      sessionId: sessions.id,
      email: users.email,
      name: users.name,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) {
    return reply.code(401).send({ error: 'Your session has expired. Please sign in again.' });
  }

  request.user = { id: row.userId, email: row.email, name: row.name };

  // Cheap liveness marker, best-effort — never fail a request over it.
  db.update(sessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(sessions.id, row.sessionId))
    .catch(() => {});
}

export async function revokeSession(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return;
  const tokenHash = hashToken(header.slice('Bearer '.length).trim());
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, tokenHash));
}
