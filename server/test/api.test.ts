/**
 * End-to-end API tests.
 *
 * These run the real route handlers, the real SQL schema and the real sync
 * merge logic against PGlite (Postgres in WASM). The only thing stubbed is the
 * Drizzle driver's query function.
 *
 * Run with: pnpm --filter @islamicguide/server test
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase, closeTestDatabase } from './pglite-harness.ts';

type Pglite = Awaited<ReturnType<typeof createTestDatabase>>;
type App = { inject: (opts: unknown) => Promise<{ statusCode: number; body: string; json: () => any }>; close: () => Promise<void> };

let pg: Pglite;
let app: App;
let token = '';
let secondToken = '';

const email = 'tester@example.com';

function auth(t: string) {
  return { authorization: `Bearer ${t}` };
}

before(async () => {
  pg = await createTestDatabase();

  // The API is configured entirely from the environment; PGlite is swapped in
  // by replacing DATABASE_URL with a sentinel the mocked driver recognises.
  process.env.DATABASE_URL = 'pglite://local';
  process.env.NODE_ENV = 'test';
  process.env.RETURN_LOGIN_CODE_IN_RESPONSE = 'true';

  const { drizzle } = await import('drizzle-orm/neon-serverless');
  const schema = await import('../src/db/schema/index.ts');

  // Route every parameterised query through PGlite. drizzle's neon-serverless
  // session calls `client.query(text, params)` (two arguments).
  // PGlite only accepts primitives: the real driver serialises Dates and
  // objects for us, so do the same here.
  const encode = (value: unknown) => {
    if (value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (value !== null && typeof value === 'object') return JSON.stringify(value);
    return value as string | number | boolean | null;
  };

  const run = async (text: string, params: unknown[] = []) => {
    // Drizzle maps result columns positionally, so rows must be arrays.
    const result = await pg.query(text, params.map(encode), { rowMode: 'array' });
    return { rows: result.rows as unknown[], rowMode: 'array' as const, fields: [] };
  };

  // drizzle calls either `query(text, params)` or `query({ text, values })`.
  const queryMock = async (first: unknown, second?: unknown[]) => {
    if (typeof first === 'string') return run(first, second);
    const config = first as { text?: string; values?: unknown[] };
    return run(config.text ?? '', config.values ?? second ?? []);
  };

  const pool = {
    query: queryMock,
    connect: async () => ({ query: queryMock, release: () => {} }),
    end: async () => {},
    on() { return pool; },
  };

  const { setDatabase } = await import('../src/db/client.ts');
  setDatabase(drizzle({ client: pool as never, schema }) as never);

  const { buildApp } = await import('../src/index.ts');
  app = buildApp() as unknown as App;
});

after(async () => {
  await app?.close();
  await closeTestDatabase(pg);
});

describe('health and auth', () => {
  test('health responds', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
  });

  test('rejects an invalid email', async () => {
    const res = await app.inject({
      method: 'POST', url: '/auth/request-code', payload: { email: 'not-an-email' },
    });
    assert.equal(res.statusCode, 400);
  });

  test('requests a login code, then signs in with it', async () => {
    const req = await app.inject({
      method: 'POST', url: '/auth/request-code', payload: { email },
    });
    assert.equal(req.statusCode, 200);
    const code = req.json().devCode as string;
    assert.match(code, /^\d{6}$/);

    const verified = await app.inject({
      method: 'POST', url: '/auth/verify', payload: { email, code },
    });
    assert.equal(verified.statusCode, 200);
    token = verified.json().token;
    assert.ok(token.length > 30);
  });

  test('a login code cannot be reused', async () => {
    const req = await app.inject({
      method: 'POST', url: '/auth/request-code', payload: { email },
    });
    const code = req.json().devCode;

    const first = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email, code } });
    assert.equal(first.statusCode, 200);
    secondToken = first.json().token;

    const second = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email, code } });
    assert.equal(second.statusCode, 401);
  });

  test('a second session for the same account works too', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me', headers: auth(secondToken) });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().user.email, email);
  });

  test('sync requires a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/sync' });
    assert.equal(res.statusCode, 401);
  });

  test('a forged token is rejected', async () => {
    const res = await app.inject({ method: 'GET', url: '/sync', headers: auth('cheat'.repeat(10)) });
    assert.equal(res.statusCode, 401);
  });

  test('me returns the signed-in user', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me', headers: auth(token) });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().user.email, email);
  });
});

describe('sync', () => {
  test('push then pull round-trips data', async () => {
    const push = await app.inject({
      method: 'POST',
      url: '/sync',
      headers: auth(token),
      payload: {
        entities: {
          bookmarks: {
            revision: 100,
            deviceId: 'device-a',
            data: [{ id: 'bm_1', reference: 'quran_1_1', title: 'Al-Fatihah 1:1' }],
          },
        },
      },
    });
    assert.equal(push.statusCode, 200);
    assert.deepEqual(push.json().applied, ['bookmarks']);

    const pull = await app.inject({ method: 'GET', url: '/sync', headers: auth(token) });
    assert.equal(pull.statusCode, 200);
    const stored = pull.json().entities.bookmarks;
    assert.equal(stored.revision, 100);
    assert.equal(stored.data.length, 1);
    assert.equal(stored.data[0].title, 'Al-Fatihah 1:1');
  });

  test('a stale write cannot overwrite a newer one', async () => {
    const stale = await app.inject({
      method: 'POST',
      url: '/sync',
      headers: auth(token),
      payload: {
        entities: {
          bookmarks: { revision: 99, deviceId: 'device-old', data: [{ id: 'stale' }] },
        },
      },
    });
    assert.equal(stale.statusCode, 200);
    assert.deepEqual(stale.json().rejected, ['bookmarks']);
    // The response already carries the authoritative value…
    assert.equal(stale.json().entities.bookmarks.data[0].id, 'bm_1');

    // …and the database is untouched.
    const pull = await app.inject({ method: 'GET', url: '/sync', headers: auth(token) });
    assert.equal(pull.json().entities.bookmarks.data[0].id, 'bm_1');
  });

  test('a newer write is accepted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sync',
      headers: auth(token),
      payload: {
        entities: {
          bookmarks: { revision: 101, deviceId: 'device-b', data: [{ id: 'bm_2' }] },
        },
      },
    });
    assert.deepEqual(res.json().applied, ['bookmarks']);
  });

  test('equal revisions resolve identically regardless of arrival order', async () => {
    const payload = (deviceId: string, id: string) => ({
      entities: {
        notes: { revision: 500, deviceId, data: [{ id }] },
      },
    });

    // device-b > device-a lexicographically, so device-b must win either way.
    await app.inject({ method: 'POST', url: '/sync', headers: auth(token), payload: payload('device-b', 'from-b') });
    await app.inject({ method: 'POST', url: '/sync', headers: auth(token), payload: payload('device-a', 'from-a') });

    const pull = await app.inject({ method: 'GET', url: '/sync', headers: auth(token) });
    assert.equal(pull.json().entities.notes.data[0].id, 'from-b');
  });

  test('settings and lastRead are stored as single documents', async () => {
    await app.inject({
      method: 'POST', url: '/sync', headers: auth(token),
      payload: {
        entities: {
          settings: { revision: 200, deviceId: 'd', data: { theme: 'light', arabicFontSize: 30 } },
          lastRead: { revision: 201, deviceId: 'd', data: { surahNumber: 2, ayahNumber: 255 } },
        },
      },
    });

    const pull = await app.inject({ method: 'GET', url: '/sync', headers: auth(token) });
    const body = pull.json();
    assert.equal(body.entities.settings.data.theme, 'light');
    assert.equal(body.entities.settings.data.arabicFontSize, 30);
    assert.equal(body.entities.lastRead.data.ayahNumber, 255);
  });

  test('rejects a malformed envelope', async () => {
    const res = await app.inject({
      method: 'POST', url: '/sync', headers: auth(token),
      payload: { entities: { bookmarks: { revision: -5, deviceId: '', data: [] } } },
    });
    assert.equal(res.statusCode, 400);
  });

  test('rejects an unknown entity name', async () => {
    const res = await app.inject({
      method: 'POST', url: '/sync', headers: auth(token),
      payload: { entities: { notAThing: { revision: 1, deviceId: 'd', data: [] } } },
    });
    // Unknown keys are stripped by the schema, so this is a no-op rather than
    // a 500 — assert it does not blow up.
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().applied, []);
  });

  test("one user cannot read another's data", async () => {
    const other = await app.inject({
      method: 'POST', url: '/auth/request-code', payload: { email: 'other@example.com' },
    });
    const code = other.json().devCode;
    const login = await app.inject({
      method: 'POST', url: '/auth/verify', payload: { email: 'other@example.com', code },
    });
    const otherToken = login.json().token;

    const pull = await app.inject({ method: 'GET', url: '/sync', headers: auth(otherToken) });
    assert.equal(pull.statusCode, 200);
    assert.deepEqual(pull.json().entities, {});
  });
});
