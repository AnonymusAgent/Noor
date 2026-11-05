import {
  pgTable, text, integer, timestamp, uuid, jsonb, bigint,
  primaryKey, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.ts';

/**
 * Per-user app settings.
 *
 * Stored as JSON rather than a column per setting: the client's `AppSettings`
 * shape evolves often, and a mismatch must never fail a sync. The server treats
 * it as an opaque, versioned document.
 */
export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  updatedAtIndex: index('user_settings_updated_at_idx').on(table.updatedAt),
}));

/**
 * Last-read position, kept separate from `reading_progress` because it is a
 * single pointer rather than a per-surah map.
 */
export const lastRead = pgTable('last_read', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  surahNumber: integer('surah_number').notNull(),
  ayahNumber: integer('ayah_number').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * A CRDT-ish envelope for collections that are small, mostly append-only, and
 * whose individual rows are not worth modelling server-side (AI chat history,
 * tasbeeh log, etc.).
 *
 * `items` is the whole collection; `revision` is a client clock used to resolve
 * concurrent writes with last-writer-wins. This deliberately trades storage
 * efficiency for a sync protocol that is trivial to reason about.
 */
export const collections = pgTable('collections', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  key: text('key').notNull(),
  // Client clock (Date.now()), so 64-bit: a 32-bit integer overflows in 1970+days.
  revision: bigint('revision', { mode: 'number' }).notNull().default(0),
  items: jsonb('items').$type<unknown[]>().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.key] }),
  userIndex: index('collections_user_idx').on(table.userId),
}));

/** Passwordless sign-in codes: hashed, single-use, short-lived. */
export const loginCodes = pgTable('login_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIndex: index('login_codes_email_idx').on(table.email),
}));

/** Opaque bearer tokens. The raw token is never stored, only its SHA-256. */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => ({
  tokenUnique: uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
  userIndex: index('sessions_user_idx').on(table.userId),
}));

/**
 * Records which client clock produced the stored state, so merges are
 * deterministic even when two devices write in the same second.
 * One row per user per entity.
 */
export const syncState = pgTable('sync_state', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  entity: text('entity').notNull(),
  // Client clock (Date.now()), so 64-bit: a 32-bit integer overflows in 1970+days.
  revision: bigint('revision', { mode: 'number' }).notNull().default(0),
  deviceId: text('device_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.entity] }),
}));
