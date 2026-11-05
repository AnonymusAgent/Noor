import type { FastifyInstance } from 'fastify';
import { authenticate, requestLoginCode, revokeSession, verifyLoginCode } from './auth/index.ts';
import { pullAll, pushEntities } from './sync/engine.ts';
import { pushSchema } from './sync/types.ts';

/**
 * HTTP surface.
 *
 * All sync routes are scoped to the authenticated user — a user id is never
 * read from the request body, so one account cannot address another's data.
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    ok: true,
    time: new Date().toISOString(),
  }));

  // ── Auth ───────────────────────────────────────────────────────────────────

  app.post<{ Body: { email?: string } }>('/auth/request-code', async (request, reply) => {
    const email = request.body?.email;
    if (typeof email !== 'string') {
      return reply.code(400).send({ error: 'An email address is required.' });
    }
    try {
      const result = await requestLoginCode(email);
      // `devCode` is only present when email delivery is not configured.
      return reply.send(result);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode ?? 500;
      return reply.code(status).send({ error: (error as Error).message });
    }
  });

  app.post<{ Body: { email?: string; code?: string } }>('/auth/verify', async (request, reply) => {
    const { email, code } = request.body ?? {};
    if (typeof email !== 'string' || typeof code !== 'string') {
      return reply.code(400).send({ error: 'Email and code are required.' });
    }
    try {
      return reply.send(await verifyLoginCode(email, code));
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode ?? 500;
      return reply.code(status).send({ error: (error as Error).message });
    }
  });

  app.post('/auth/logout', async (request, reply) => {
    await revokeSession(request);
    return reply.send({ ok: true });
  });

  app.get('/auth/me', { preHandler: authenticate }, async (request) => ({
    user: request.user,
  }));

  // ── Sync ───────────────────────────────────────────────────────────────────

  app.get('/sync', { preHandler: authenticate }, async (request) => {
    return pullAll(request.user!.id);
  });

  app.post('/sync', { preHandler: authenticate }, async (request, reply) => {
    const parsed = pushSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid sync payload.',
        details: parsed.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return pushEntities(request.user!.id, parsed.data);
  });

  // ── Account ────────────────────────────────────────────────────────────────

  app.delete('/account', { preHandler: authenticate }, async (request, reply) => {
    // Deleting the user cascades to every table that references it.
    const { db } = await import('./db/client.ts');
    const { users } = await import('./db/schema/index.ts');
    const { eq } = await import('drizzle-orm');
    await db.delete(users).where(eq(users.id, request.user!.id));
    return reply.send({ ok: true });
  });
}
