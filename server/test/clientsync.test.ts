/**
 * Integration test for the *client* half of sync (`services/syncEngine.ts`).
 *
 * The engine normally talks to `fetch` and AsyncStorage. Here both are replaced
 * with small in-memory fakes — AsyncStorage through a proxy placed first on the
 * module resolution path, `fetch` through a real Fastify instance injected
 * in-process — so the actual production code runs unmodified against the actual
 * production server code.
 *
 * What this proves, that unit tests of either side alone cannot:
 *  - signing in on a device that already holds data merges instead of wiping;
 *  - a second device receives the first device's data;
 *  - a stale push cannot overwrite newer state;
 *  - offline failures leave local data untouched.
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createTestDatabase, closeTestDatabase } from './pglite-harness.ts';

/* ── AsyncStorage fake, installed before the client modules are imported ── */

const STORAGE = new Map<string, string>();

function installAsyncStorageFake() {
  const source = `
    const store = globalThis.__TEST_STORAGE__;
    export default {
      async getItem(key) { return store.has(key) ? store.get(key) : null; },
      async setItem(key, value) { store.set(key, String(value)); },
      async removeItem(key) { store.delete(key); },
      async multiGet(keys) { return keys.map(k => [k, store.has(k) ? store.get(k) : null]); },
      async multiSet(pairs) { for (const [k, v] of pairs) store.set(k, String(v)); },
      async multiRemove(keys) { for (const k of keys) store.delete(k); },
      async getAllKeys() { return [...store.keys()]; },
      async clear() { store.clear(); },
    };
  `;
  // `react-native` and `expo-secure-store` are native modules: react-native is
  // Flow-typed (Node cannot parse it) and neither exists outside a device. Both
  // are stubbed; `Platform.OS = 'web'` makes the secure store fall back to the
  // AsyncStorage fake below, which is exactly what the web build does.
  const reactNativeSource = `
    export const Platform = { OS: 'web', select: (o) => o.web ?? o.default };
    export const AppState = { addEventListener: () => ({ remove() {} }) };
    export default { Platform, AppState };
  `;
  const secureStoreSource = `
    export async function getItemAsync() { return null; }
    export async function setItemAsync() {}
    export async function deleteItemAsync() {}
  `;

  const fakes: Record<string, string> = {
    '@react-native-async-storage/async-storage': source,
    'react-native': reactNativeSource,
    'expo-secure-store': secureStoreSource,
  };

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (fakes[specifier]) {
        return { url: `test:${specifier}`, shortCircuit: true };
      }
      // The app is bundled by Metro, which resolves extensionless relative
      // imports; Node ESM does not. Retry with `.ts` so the *production* source
      // can stay idiomatic instead of carrying test-only file extensions.
      try {
        return nextResolve(specifier, context);
      } catch (error) {
        if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
          return nextResolve(`${specifier}.ts`, context);
        }
        throw error;
      }
    },
    load(url, context, nextLoad) {
      for (const [specifier, moduleSource] of Object.entries(fakes)) {
        if (url === `test:${specifier}`) {
          return { format: 'module', source: moduleSource, shortCircuit: true };
        }
      }
      return nextLoad(url, context);
    },
  });
}

(globalThis as unknown as { __TEST_STORAGE__: Map<string, string> }).__TEST_STORAGE__ = STORAGE;
(globalThis as unknown as { __TEST_ENV__?: boolean }).__TEST_ENV__ = true;
installAsyncStorageFake();

/* ── environment the client reads at import time ── */

process.env.EXPO_PUBLIC_API_URL = 'http://sync.test';
process.env.RETURN_LOGIN_CODE_IN_RESPONSE = 'true';
process.env.LOG_LEVEL = 'silent';

describe('client sync engine', () => {
  let app: { inject: Function; close: Function };
  let pg: Awaited<ReturnType<typeof createTestDatabase>>;
  let engine: typeof import('../../services/syncEngine.ts');
  let client: typeof import('../../services/syncService.ts');
  const EMAIL = 'sync-test@example.com';

  /** Runs the real passwordless flow through the real client code. */
  async function signIn() {
    const requested = await client.requestLoginCode(EMAIL);
    assert.equal(requested.ok, true, 'request-code failed');
    if (!requested.ok) return;
    assert.ok(requested.value.devCode, 'development server should echo the code');

    const verified = await client.verifyLoginCode(EMAIL, requested.value.devCode as string);
    assert.equal(verified.ok, true, 'verify failed');
  }

  before(async () => {
    pg = await createTestDatabase();

    const { drizzle } = await import('drizzle-orm/neon-serverless');
    const schema = await import('../src/db/schema/index.ts');

    const encode = (value: unknown) => {
      if (value === undefined) return null;
      if (value instanceof Date) return value.toISOString();
      if (value !== null && typeof value === 'object') return JSON.stringify(value);
      return value as string | number | boolean;
    };
    const run = async (text: string, params: unknown[] = []) => {
      const result = await pg.query(text, params.map(encode), { rowMode: 'array' });
      return { rows: result.rows as unknown[], rowMode: 'array' as const, fields: [] };
    };
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
    app = buildApp() as never;

    // Point the client's `fetch` at the in-process Fastify instance.
    (globalThis as unknown as { fetch: unknown }).fetch = async (
      url: string,
      init: { method?: string; headers?: Record<string, string>; body?: string } = {},
    ) => {
      const path = url.replace('http://sync.test', '');
      const response = await app.inject({
        method: (init.method ?? 'GET') as never,
        url: path,
        headers: init.headers,
        payload: init.body,
      });
      return {
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode,
        text: async () => response.body,
      };
    };

    client = await import('../../services/syncService.ts');
    engine = await import('../../services/syncEngine.ts');
  });

  after(async () => {
    await (app as { close: () => Promise<void> }).close();
    await closeTestDatabase(pg);
  });

  test('first link merges local collections with the cloud instead of wiping them', async () => {
    STORAGE.clear();
    await signIn();

    // Device A already has two bookmarks and a note before signing in.
    STORAGE.set('bookmarks', JSON.stringify([
      { id: 'a1', reference: '2:255', surahName: 'Al-Baqarah', ayahNumber: 255, timestamp: '2026-01-01T00:00:00Z' },
      { id: 'a2', reference: '1:1', surahName: 'Al-Fatihah', ayahNumber: 1, timestamp: '2026-01-02T00:00:00Z' },
    ]));
    STORAGE.set('notes', JSON.stringify([
      { id: 'n1', reference: '2:255', text: 'Ayat al-Kursi', timestamp: '2026-01-01T00:00:00Z' },
    ]));
    STORAGE.set('last_read', JSON.stringify({ surahNumber: 2, ayahNumber: 255 }));

    const status = await engine.syncNow({ mode: 'merge' });
    assert.equal(status.phase, 'synced', status.message ?? '');

    // Local data survived the first sync.
    const bookmarks = JSON.parse(STORAGE.get('bookmarks') ?? '[]');
    assert.equal(bookmarks.length, 2);

    // And a second device that signs in to the same account receives it.
    STORAGE.clear();
    await signIn();
    const pulled = await engine.syncNow({ mode: 'merge' });
    assert.equal(pulled.phase, 'synced');

    const onDeviceB = JSON.parse(STORAGE.get('bookmarks') ?? '[]');
    assert.equal(onDeviceB.length, 2);
    assert.deepEqual(onDeviceB.map((b: { id: string }) => b.id).sort(), ['a1', 'a2']);
    assert.equal(JSON.parse(STORAGE.get('notes') ?? '[]').length, 1);
    assert.deepEqual(JSON.parse(STORAGE.get('last_read') ?? '{}'), { surahNumber: 2, ayahNumber: 255 });
  });

  test('a device with no local edits cannot overwrite a newer edit elsewhere', async () => {
    // Device A signs in, syncs, then we snapshot its whole world.
    STORAGE.clear();
    await signIn();
    STORAGE.set('bookmarks', JSON.stringify([
      { id: 'b1', reference: '2:255', surahName: 'Al-Baqarah', ayahNumber: 255 },
      { id: 'b2', reference: '1:1', surahName: 'Al-Fatihah', ayahNumber: 1 },
    ]));
    assert.equal((await engine.syncNow({ mode: 'merge' })).phase, 'synced');
    const deviceA = new Map(STORAGE);

    // Device B is a brand new install that signs in and receives both.
    STORAGE.clear();
    await signIn();
    assert.equal((await engine.syncNow({ mode: 'merge' })).phase, 'synced');
    assert.equal(JSON.parse(STORAGE.get('bookmarks') ?? '[]').length, 2);

    // Back on device A: the user adds a bookmark "later" (higher clock).
    STORAGE.clear();
    for (const [k, v] of deviceA) STORAGE.set(k, v);
    STORAGE.set('bookmarks', JSON.stringify([
      { id: 'b1', reference: '2:255', surahName: 'Al-Baqarah', ayahNumber: 255 },
      { id: 'b2', reference: '1:1', surahName: 'Al-Fatihah', ayahNumber: 1 },
      { id: 'b3', reference: '112:1', surahName: 'Al-Ikhlas', ayahNumber: 1 },
    ]));
    assert.equal((await engine.syncNow({ mode: 'replace' })).phase, 'synced');

    // Device B has edited nothing but syncs later. It must adopt A's three
    // bookmarks rather than pushing its own stale two back over them.
    STORAGE.clear();
    STORAGE.set('bookmarks', JSON.stringify([
      { id: 'b1', reference: '2:255', surahName: 'Al-Baqarah', ayahNumber: 255 },
      { id: 'b2', reference: '1:1', surahName: 'Al-Fatihah', ayahNumber: 1 },
    ]));
    await signIn();
    const pullOnly = await engine.syncNow({ mode: 'replace' });
    assert.equal(pullOnly.phase, 'synced');
    assert.deepEqual(
      JSON.parse(STORAGE.get('bookmarks') ?? '[]').map((b: { id: string }) => b.id).sort(),
      ['b1', 'b2', 'b3'],
    );
  });

  test('a real local edit still wins, including deletions', async () => {
    STORAGE.clear();
    await signIn();
    STORAGE.set('bookmarks', JSON.stringify([
      { id: 'b1', reference: '2:255', surahName: 'Al-Baqarah', ayahNumber: 255 },
      { id: 'b2', reference: '1:1', surahName: 'Al-Fatihah', ayahNumber: 1 },
      { id: 'b3', reference: '112:1', surahName: 'Al-Ikhlas', ayahNumber: 1 },
    ]));
    assert.equal((await engine.syncNow({ mode: 'merge' })).phase, 'synced');

    // Same device, now with a genuine edit: remove one bookmark and sync.
    STORAGE.set('bookmarks', JSON.stringify([
      { id: 'b1', reference: '2:255', surahName: 'Al-Baqarah', ayahNumber: 255 },
      { id: 'b3', reference: '112:1', surahName: 'Al-Ikhlas', ayahNumber: 1 },
    ]));
    const status = await engine.syncNow({ mode: 'replace' });
    assert.equal(status.phase, 'synced');
    assert.ok(status.lastApplied.includes('bookmarks'), 'a real edit should be pushed');

    // A fresh install sees the deletion: two bookmarks, not three.
    STORAGE.clear();
    await signIn();
    await engine.syncNow({ mode: 'merge' });
    assert.deepEqual(
      JSON.parse(STORAGE.get('bookmarks') ?? '[]').map((b: { id: string }) => b.id).sort(),
      ['b1', 'b3'],
    );
  });

  test('offline leaves local data untouched and reports a retryable state', async () => {
    STORAGE.clear();
    await signIn();
    STORAGE.set('bookmarks', JSON.stringify([{ id: 'offline-1', reference: '36:1', surahName: 'Ya-Sin', ayahNumber: 1 }]));

    const realFetch = (globalThis as unknown as { fetch: unknown }).fetch;
    (globalThis as unknown as { fetch: unknown }).fetch = async () => {
      throw new Error('network down');
    };

    try {
      const status = await engine.syncNow({ mode: 'replace' });
      assert.equal(status.phase, 'offline');
      assert.ok(status.message && /saved on this device/i.test(status.message));
      // The local list is exactly what it was.
      assert.equal(JSON.parse(STORAGE.get('bookmarks') ?? '[]')[0].id, 'offline-1');
    } finally {
      (globalThis as unknown as { fetch: unknown }).fetch = realFetch;
    }
  });
});
