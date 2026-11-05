/**
 * Local data backup & restore.
 *
 * Everything the app stores lives in AsyncStorage on the device, and the
 * Profile screen openly said "Cloud backup is not configured" — so a phone
 * change or a reinstall silently destroyed years of bookmarks, notes and
 * streaks. This module serialises the user's data to a portable JSON document
 * (shareable via the OS sheet) and can restore it back.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

/** Keys that belong to the user and therefore belong in a backup. */
export const USER_DATA_KEYS = [
  'app_settings_v2',
  'bookmarks',
  'notes',
  'last_read',
  'tasbeeh_history',
  'favorite_duas',
  'ai_messages',
  'ai_conversations',
  'fasting_days',
  'asma_favorites',
  'name_favorites',
  'highlights',
  'salah_records',
] as const;

export const BACKUP_FORMAT = 'islamicguide-backup';
export const BACKUP_VERSION = 1;

export interface BackupDocument {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  appVersion: string;
  /** AsyncStorage key -> raw JSON string value. */
  data: Record<string, string>;
}

export interface BackupSummary {
  keyCount: number;
  bytes: number;
  createdAt: string;
}

export async function createBackup(appVersion: string): Promise<{ doc: BackupDocument; summary: BackupSummary }> {
  const pairs = await AsyncStorage.multiGet([...USER_DATA_KEYS]);
  const data: Record<string, string> = {};
  let bytes = 0;

  for (const [key, value] of pairs) {
    if (value == null) continue;
    data[key] = value;
    bytes += value.length;
  }

  const doc: BackupDocument = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appVersion,
    data,
  };

  return {
    doc,
    summary: { keyCount: Object.keys(data).length, bytes, createdAt: doc.createdAt },
  };
}

/** Validates an imported document before anything is written. */
export function parseBackup(raw: string): BackupDocument {
  const parsed = JSON.parse(raw) as Partial<BackupDocument>;
  if (!parsed || parsed.format !== BACKUP_FORMAT) {
    throw new Error('This file is not an IslamicGuide backup.');
  }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app.');
  }
  if (!parsed.data || typeof parsed.data !== 'object') {
    throw new Error('The backup file is missing its data.');
  }
  return parsed as BackupDocument;
}

/** Returns the number of keys restored. */
export async function restoreBackup(doc: BackupDocument): Promise<number> {
  const entries = Object.entries(doc.data).filter(
    ([key]) => (USER_DATA_KEYS as readonly string[]).includes(key),
  );
  if (entries.length === 0) return 0;
  await AsyncStorage.multiSet(entries);
  return entries.length;
}

/**
 * Writes the backup next to the app's documents and opens the share sheet so
 * the user can move it somewhere durable (Files, Drive, email…).
 * Returns `false` when sharing is unavailable on the platform.
 */
export async function writeBackupFile(doc: BackupDocument): Promise<string> {
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error('Storage is not available on this platform.');
  const uri = `${dir}islamicguide-backup-${doc.createdAt.slice(0, 10)}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(doc, null, 2));
  return uri;
}
