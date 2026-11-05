import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Test harness: runs the real SQL migration against PGlite (Postgres compiled to
 * WASM) and exposes a query function with the same shape Drizzle's neon-http
 * driver expects, so the actual route handlers can be exercised unmodified.
 */

const here = dirname(fileURLToPath(import.meta.url));

export async function createTestDatabase() {
  const pg = new PGlite();

  const migrationsDir = join(here, '..', 'drizzle');
  const files = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    // drizzle-kit emits `--> statement-breakpoint` separators.
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await pg.exec(trimmed);
    }
  }

  return pg;
}

export async function closeTestDatabase(pg: PGlite): Promise<void> {
  await pg.close();
}
