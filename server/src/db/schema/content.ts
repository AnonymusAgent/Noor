import { pgTable, text, integer, timestamp, uuid, boolean, jsonb, primaryKey, index } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

export const favoriteDuas = pgTable('favorite_duas', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  duaId: text('dua_id').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.duaId] }),
}));
export const asmaFavorites = pgTable('asma_favorites', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  number: integer('number').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.number] }),
}));

export const nameFavorites = pgTable('name_favorites', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  nameId: text('name_id').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.nameId] }),
}));

export const aiConversations = pgTable('ai_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  messages: jsonb('messages').$type<unknown[]>().notNull().default([]),
  pinned: boolean('pinned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userUpdatedAtIndex: index('ai_conversations_user_updated_at_idx').on(table.userId, table.updatedAt),
}));
