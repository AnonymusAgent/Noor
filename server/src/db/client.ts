import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema/index.ts';

/**
 * Postgres access for the sync API.
 *
 * This module runs **only on the server**. It must never be imported from
 * `app/`, `components/`, `contexts/`, `hooks/` or `services/` — shipping a
 * database connection string inside the mobile binary would hand every user
 * full access to every account.
 *
 * `db` is exposed through a proxy so tests can swap in an isolated database
 * (PGlite) without patching module exports, while every consumer keeps writing
 * plain `import { db } from './client.ts'`.
 */

/**
 * Both drivers expose the same Drizzle query builder; only their internal
 * result HKT differs, which is not something this codebase touches. So the
 * Neon type is the public face and the PGlite instance is cast to it.
 */
export type Database = ReturnType<typeof createNeonDatabase>;

/**
 * Dev-only in-process database: PGlite (Postgres compiled to WASM) on disk.
 *
 * It exists so `pnpm server:dev` works with nothing installed — no server to
 * provision, no connection string to obtain. It is **not** for production:
 * a single process, no replication, no backups. Set `DATABASE_URL` for real
 * deployments and this is never used.
 */
async function createPgliteDatabase() {
  const [{ PGlite }, pglite] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
  ]);

  const here = dirname(fileURLToPath(import.meta.url));
  const dataDir = process.env.PGLITE_DATA_DIR || join(here, '..', '..', '.pglite');
  const pg = await new PGlite(dataDir);

  // Apply pending migrations, same files `drizzle-kit migrate` would run.
  const migrationsDir = join(here, '..', '..', 'drizzle');
  const files = readdirSync(migrationsDir).filter(file => file.endsWith('.sql')).sort();

  await pg.exec(
    'create table if not exists __applied_migrations (name text primary key)',
  );
  for (const file of files) {
    const [already] = await pg.query<{ name: string }>(
      'select name from __applied_migrations where name = $1',
      [file],
    ).then(result => result.rows);
    if (already) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await pg.exec(trimmed);
    }
    await pg.query('insert into __applied_migrations (name) values ($1)', [file]);
  }

  console.log(`[db] using in-process PGlite database at ${dataDir} (development only)`);
  return pglite.drizzle({ client: pg, schema }) as unknown as Database;
}

function createNeonDatabase() {
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL or NEON_DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });
  return drizzle({ client: pool, schema });
}

let instance: Database | null = null;
let pending: Promise<Database> | null = null;

function connectionString(): string | undefined {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
}

/**
 * Resolves the active database once. The PGlite path is async (it has to open
 * the data directory and apply migrations), so `ready()` is awaited by the
 * routes; with a real connection string everything is synchronous.
 */
async function resolve(): Promise<Database> {
  if (instance) return instance;
  if (!pending) {
    pending = (async () => {
      if (connectionString()) return createNeonDatabase();
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'DATABASE_URL is not set. Refusing to fall back to the in-process '
          + 'development database in production.',
        );
      }
      return createPgliteDatabase();
    })().then(database => {
      instance = database;
      return database;
    });
  }
  return pending;
}

/** Awaited by the app at boot so the first request never races the pool. */
export async function ready(): Promise<void> {
  await resolve();
}

function current(): Database {
  const database = instance;
  if (!database) {
    // Synchronous access before `ready()` finished means a query ran too early;
    // resolve() is started here so the next access succeeds.
    void resolve();
    throw new Error('Database is still initialising');
  }
  return database;
}

/** Test seam: replaces the active database. Never called from production code. */
export function setDatabase(replacement: Database): void {
  instance = replacement;
}

export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    return Reflect.get(current() as object, property, receiver);
  },
  has(_target, property) {
    return Reflect.has(current() as object, property);
  },
});

export * from './schema/index.ts';
