import 'dotenv/config';
import type { Config } from 'drizzle-kit';

/**
 * Drizzle Kit config for the server workspace.
 * Run from `server/`: `pnpm db:generate && pnpm db:migrate`.
 */
export default {
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '',
  },
} satisfies Config;
