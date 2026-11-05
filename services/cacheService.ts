/**
 * Cache maintenance.
 *
 * The app keeps several independent offline stores (Quran pages, Hadith pages,
 * Tafsir) plus the group of AsyncStorage keys owned directly by screens. The
 * Settings screen used to *pretend* to clear them with an Alert; this is the
 * real thing, and it reports how much it freed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearQuranCache } from './quranService';
import { clearHadithCache } from './hadithService';
import { clearTafsirCache } from './tafsirCacheService';

const GPS_PRAYER_CACHE_KEY = 'prayer_gps_last_update';
const MOSQUE_CACHE_KEY = 'mosque_finder_cache';
const HADITH_SEARCH_HISTORY_KEY = 'hadith_search_history';
const QURAN_SEARCH_HISTORY_KEY = 'quran_search_history_v2';

/** Keys that are user data (never cleared) — everything else is cache. */
const PRESERVED_KEYS = new Set([
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
]);

export interface CacheClearResult {
  removedKeys: number;
  freedBytes: number;
}

/**
 * Removes every cached API response without touching the user's own data
 * (bookmarks, notes, progress, streaks, favourites…).
 */
export async function clearAllCaches(): Promise<CacheClearResult> {
  const result: CacheClearResult = { removedKeys: 0, freedBytes: 0 };

  // 1. Service-owned caches (also clear their in-memory mirrors).
  await Promise.all([clearQuranCache(), clearHadithCache(), clearTafsirCache()]);

  // 2. Screen-owned caches. Reading the values first gives an accurate size,
  //    which is what makes the Settings feedback meaningful.
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => {
      if (PRESERVED_KEYS.has(key)) return false;
      return (
        key === GPS_PRAYER_CACHE_KEY ||
        key === MOSQUE_CACHE_KEY ||
        key === HADITH_SEARCH_HISTORY_KEY ||
        key === QURAN_SEARCH_HISTORY_KEY ||
        // quranService page cache (e.g. quran_qv4_1_en.sahih)
        key.startsWith('quran_qv')
      );
    });

    if (cacheKeys.length > 0) {
      const entries = await AsyncStorage.multiGet(cacheKeys);
      result.freedBytes = entries.reduce((total, [, value]) => total + (value?.length ?? 0), 0);
      await AsyncStorage.multiRemove(cacheKeys);
      result.removedKeys = cacheKeys.length;
    }
  } catch { /* cache clearing is best-effort */ }

  return result;
}

/** Human-friendly size for the "freed N MB" confirmation. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
