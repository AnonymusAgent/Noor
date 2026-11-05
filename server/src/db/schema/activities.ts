import { pgTable, text, integer, timestamp, uuid, boolean, date, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

export const salahRecords = pgTable('salah_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  fajr: boolean('fajr').notNull().default(false),
  dhuhr: boolean('dhuhr').notNull().default(false),
  asr: boolean('asr').notNull().default(false),
  maghrib: boolean('maghrib').notNull().default(false),
  isha: boolean('isha').notNull().default(false),
  journal: text('journal'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userDateUnique: uniqueIndex('salah_records_user_date_unique').on(table.userId, table.date),
}));
export const fastingDays = pgTable('fasting_days', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  fasted: boolean('fasted').notNull().default(true),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userDateUnique: uniqueIndex('fasting_days_user_date_unique').on(table.userId, table.date),
}));

export const tasbeehHistory = pgTable('tasbeeh_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  count: integer('count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userDateIndex: index('tasbeeh_history_user_date_idx').on(table.userId, table.date),
}));
