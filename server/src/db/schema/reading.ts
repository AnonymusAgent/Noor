import { pgTable, text, integer, timestamp, uuid, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

export const readingProgress = pgTable('reading_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  surahNumber: integer('surah_number').notNull(),
  ayahNumber: integer('ayah_number').notNull(),
  totalAyahs: integer('total_ayahs'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userUnique: uniqueIndex('reading_progress_user_id_unique').on(table.userId),
}));
export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type', { enum: ['quran', 'hadith', 'dua'] }).notNull(),
  reference: text('reference').notNull(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  arabic: text('arabic'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userReferenceUnique: uniqueIndex('bookmarks_user_type_reference_unique').on(table.userId, table.type, table.reference),
}));

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type', { enum: ['quran', 'hadith', 'dua'] }).notNull(),
  reference: text('reference').notNull(),
  content: text('content').notNull(),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  surahNumber: integer('surah_number'),
  ayahNumber: integer('ayah_number'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userCreatedAtIndex: index('notes_user_created_at_idx').on(table.userId, table.createdAt),
}));

export const highlights = pgTable('highlights', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  surahNumber: integer('surah_number').notNull(),
  ayahNumber: integer('ayah_number').notNull(),
  color: text('color', { enum: ['yellow', 'green', 'blue', 'red'] }).notNull(),
  verseText: text('verse_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userVerseUnique: uniqueIndex('highlights_user_verse_unique').on(table.userId, table.surahNumber, table.ayahNumber),
}));
