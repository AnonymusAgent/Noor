import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing is intentionally absent: the API is passwordless (emailed
 * one-time codes), which removes the single most common credential-leak vector
 * for a small app. If passwords are ever added, use argon2id — not this file.
 */

/** Opaque session token handed to the client. 256 bits of entropy. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Tokens are stored hashed so a database dump cannot be replayed as live
 * sessions. SHA-256 is sufficient here (unlike for passwords) because the token
 * is high-entropy and never chosen by a human.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 6-digit sign-in code, uniformly distributed. */
export function generateLoginCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Codes are short-lived secrets: hash them the same way as tokens. */
export function hashLoginCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** Constant-time comparison — never `===` on a secret. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}
