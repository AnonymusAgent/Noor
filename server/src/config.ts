/**
 * Runtime configuration.
 *
 * Everything here is read once at boot and validated, so a misconfigured
 * deployment fails loudly at start-up instead of silently accepting weak
 * tokens or mailing login codes to nowhere.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProduction = NODE_ENV === 'production';

export const config = {
  nodeEnv: NODE_ENV,
  isProduction,
  port: optionalInt('PORT', 4000),
  host: process.env.HOST ?? '0.0.0.0',

  /** Public origin the mobile app talks to, used for CORS in web builds. */
  publicOrigin: process.env.PUBLIC_ORIGIN ?? '*',

  sessionTtlDays: optionalInt('SESSION_TTL_DAYS', 90),
  loginCodeTtlMinutes: optionalInt('LOGIN_CODE_TTL_MINUTES', 10),
  /** Wrong guesses allowed per issued code before it is burnt. */
  loginCodeMaxAttempts: optionalInt('LOGIN_CODE_MAX_ATTEMPTS', 5),

  /**
   * When SMTP/email is not configured, the API can return the sign-in code in
   * the response. That is only acceptable in development — in production it
   * would let anyone take over any account by typing an email address.
   */
  allowDevLoginCode: !isProduction && process.env.RETURN_LOGIN_CODE_IN_RESPONSE !== 'false',

  get databaseUrl(): string {
    return required('DATABASE_URL');
  },
} as const;

/** Fails fast on boot rather than on the first request. */
export function assertConfig(): void {
  // A missing DATABASE_URL is fatal only in production; in development the API
  // falls back to an in-process PGlite database so the app can be tried without
  // provisioning anything (see `db/client.ts`).
  if (config.isProduction) {
    required('DATABASE_URL');
  }
  if (config.isProduction && config.publicOrigin === '*') {
    // Not fatal (the API is token-authenticated, not cookie-authenticated),
    // but worth flagging: cookies would otherwise be exposed cross-origin.
    console.warn('[config] PUBLIC_ORIGIN is "*" in production');
  }
}
