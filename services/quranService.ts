/**
 * Quran Service — Offline-first with AsyncStorage persistent cache,
 * timeout protection, exponential-backoff retry, and pre-caching support.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SURAH_LIST } from '../constants/quranData';

const ALQURAN_BASE = 'https://api.alquran.cloud/v1';
const CACHE_VER = 'qv4';
const CACHE_PREFIX = `quran_${CACHE_VER}_`;
const REQUEST_TIMEOUT = 14000; // 14 seconds
const MAX_RETRIES = 3;

// Session-level memory cache (cleared on app restart, supplements AsyncStorage)
const memCache: Record<string, any> = {};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
  translation?: string;
  transliteration?: string;
  juz: number;
  page: number;
  sajda: boolean;
  hizbQuarter: number;
  ruku?: number;
}

export interface SurahData {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
  ayahs: Ayah[];
}

export interface SurahWithTranslation {
  arabic: SurahData;
  translation: SurahData;
}

// ── Timeout / Fetch helpers ───────────────────────────────────────────────────

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/**
 * Priority: memory → AsyncStorage → network (with retry + backoff)
 * Never expires for Quran data (it never changes).
 */
async function fetchWithCache(url: string, cacheKey: string): Promise<any> {
  // 1 — Memory cache
  if (memCache[cacheKey]) return memCache[cacheKey];

  // 2 — Persistent AsyncStorage cache
  try {
    const stored = await AsyncStorage.getItem(CACHE_PREFIX + cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      memCache[cacheKey] = parsed;
      return parsed;
    }
  } catch { /* ignore */ }

  // 3 — Network with retry
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (!data || (data.code !== undefined && data.code !== 200)) {
        throw new Error(`API error: ${data?.status || 'bad response'}`);
      }

      // Store in both caches
      memCache[cacheKey] = data;
      AsyncStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(data)).catch(() => {});
      return data;
    } catch (e) {
      lastError = e as Error;
      if (attempt < MAX_RETRIES) {
        // Backoff: 1.5s, 3s
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }
  }

  throw lastError ?? new Error('Network unavailable');
}

// ── Cache utilities ───────────────────────────────────────────────────────────

export async function isSurahCached(
  surahNumber: number,
  edition: string = 'quran-uthmani'
): Promise<boolean> {
  const key = `surah_${surahNumber}_${edition}`;
  if (memCache[key]) return true;
  try {
    const v = await AsyncStorage.getItem(CACHE_PREFIX + key);
    return v !== null;
  } catch {
    return false;
  }
}

/**
 * Pre-cache a surah in the background. Resolves immediately if already cached.
 */
export async function preCacheSurah(
  surahNumber: number,
  editions: string[] = ['quran-uthmani', 'en.sahih']
): Promise<void> {
  for (const edition of editions) {
    try {
      await fetchSurah(surahNumber, edition);
    } catch { /* silent — best effort */ }
  }
}

/**
 * Pre-cache top N surahs in the background (non-blocking).
 */
export function initQuranOfflineCache(
  topSurahs: number[] = [1, 2, 3, 18, 36, 55, 56, 67, 112, 113, 114],
  translations: string[] = ['en.sahih']
): void {
  const editions = ['quran-uthmani', ...translations];
  (async () => {
    for (const surah of topSurahs) {
      for (const edition of editions) {
        if (!(await isSurahCached(surah, edition))) {
          try {
            await fetchSurah(surah, edition);
            // Small delay to avoid hammering the API
            await new Promise(r => setTimeout(r, 300));
          } catch { /* silent */ }
        }
      }
    }
  })();
}

export async function clearQuranCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const quranKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(quranKeys);
    Object.keys(memCache).forEach(k => delete memCache[k]);
  } catch { /* silent */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchSurah(
  surahNumber: number,
  edition: string = 'quran-uthmani'
): Promise<SurahData> {
  const key = `surah_${surahNumber}_${edition}`;
  const data = await fetchWithCache(`${ALQURAN_BASE}/surah/${surahNumber}/${edition}`, key);
  return data.data;
}

export async function fetchSurahWithTranslation(
  surahNumber: number,
  translationEdition: string = 'en.sahih'
): Promise<SurahWithTranslation> {
  const [arabic, translation] = await Promise.all([
    fetchSurah(surahNumber, 'quran-uthmani'),
    fetchSurah(surahNumber, translationEdition),
  ]);
  return { arabic, translation };
}

export async function fetchAyah(
  surahNumber: number,
  ayahNumber: number,
  edition: string = 'quran-uthmani'
): Promise<Ayah> {
  const key = `ayah_${surahNumber}_${ayahNumber}_${edition}`;
  const data = await fetchWithCache(
    `${ALQURAN_BASE}/ayah/${surahNumber}:${ayahNumber}/${edition}`,
    key
  );
  return data.data;
}

export async function searchQuran(query: string, language: string = 'en'): Promise<any[]> {
  try {
    const response = await fetchWithTimeout(
      `${ALQURAN_BASE}/search/${encodeURIComponent(query)}/all/${language}`
    );
    const data = await response.json();
    return data.data?.matches || [];
  } catch {
    return [];
  }
}

export async function fetchJuz(
  juzNumber: number,
  edition: string = 'quran-uthmani'
): Promise<Ayah[]> {
  const key = `juz_${juzNumber}_${edition}`;
  const data = await fetchWithCache(`${ALQURAN_BASE}/juz/${juzNumber}/${edition}`, key);
  return data.data?.ayahs || [];
}

export async function fetchPage(
  pageNumber: number,
  edition: string = 'quran-uthmani'
): Promise<Ayah[]> {
  const key = `page_${pageNumber}_${edition}`;
  const data = await fetchWithCache(`${ALQURAN_BASE}/page/${pageNumber}/${edition}`, key);
  return data.data?.ayahs || [];
}

export function getAudioUrl(
  surahNumber: number,
  reciterIdentifier: string = 'Alafasy_128kbps'
): string {
  const surahStr = String(surahNumber).padStart(3, '0');
  return `https://download.quranicaudio.com/quran/${reciterIdentifier}/${surahStr}.mp3`;
}

/**
 * The AlQuran Cloud CDN names ayah recitations by their verse index in the
 * whole mushaf (1…6236), not by `S:S`, so the position has to be derived from
 * the surah verse counts.
 */
export function getGlobalAyahNumber(surahNumber: number, ayahNumber: number): number {
  let preceding = 0;
  for (let i = 0; i < surahNumber - 1 && i < SURAH_LIST.length; i++) {
    preceding += SURAH_LIST[i].versesCount;
  }
  return preceding + ayahNumber;
}

export function getAyahAudioUrl(
  surahNumber: number,
  ayahNumber: number,
  reciterId: string = 'ar.alafasy'
): string {
  const verseNumber = getGlobalAyahNumber(surahNumber, ayahNumber);
  return `https://cdn.islamic.network/quran/audio/128/${reciterId}/${verseNumber}.mp3`;
}

/** A single word of an ayah, normalised for rendering. */
export interface WordByWordEntry {
  /** Position of the word within the ayah (1-based). */
  position: number;
  /** Arabic text (Uthmani script when available). */
  arabic: string;
  /** Latin transliteration, empty when the API has none for this word. */
  transliteration: string;
  /** English gloss of the word, empty when unavailable. */
  translation: string;
  /** True for pause/end-of-ayah markers, which are not real words. */
  isAyahMarker: boolean;
}

/**
 * Quran.com (QDC) returns `translation` and `transliteration` as *objects*
 * (`{ text, language_name }`), not strings. Rendering that object directly
 * throws "Objects are not valid as a React child" and takes the whole reader
 * down — which is exactly what happened when word-by-word was enabled.
 *
 * This normaliser is deliberately tolerant: it accepts a plain string, the
 * `{ text }` wrapper, or a missing value, so a future API change degrades to a
 * blank gloss instead of a crash.
 */
function readLocalisedText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const text = (value as { text?: unknown }).text;
    if (typeof text === 'string') return text;
  }
  return '';
}

function normalizeWord(raw: unknown, index: number): WordByWordEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const word = raw as Record<string, unknown>;

  const arabic =
    (typeof word.text_uthmani === 'string' && word.text_uthmani) ||
    (typeof word.text === 'string' && word.text) ||
    readLocalisedText(word.text_arab);
  if (!arabic) return null;

  const isAyahMarker =
    word.char_type_name === 'end' ||
    word.charTypeId === 4 ||
    word.char_type_name === 'pause';

  return {
    position: typeof word.position === 'number' ? word.position : index + 1,
    arabic,
    transliteration: readLocalisedText(word.transliteration) || readLocalisedText(word.text_transliteration),
    translation: readLocalisedText(word.translation) || readLocalisedText(word.text_translation),
    isAyahMarker,
  };
}

/**
 * Fetches the word-by-word breakdown of one ayah.
 *
 * Returns an empty array when the API is unreachable or the response is
 * malformed; it never throws, so callers can treat `[]` as "unavailable".
 */
export async function fetchWordByWord(
  surahNumber: number,
  ayahNumber: number
): Promise<WordByWordEntry[]> {
  const url =
    `https://api.qurancdn.com/api/qdc/verses/by_key/${surahNumber}:${ayahNumber}` +
    '?words=true&word_fields=text_uthmani,text_transliteration,translation&translation_fields=text';

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return [];
    const data = await response.json();
    const words = data?.verse?.words;
    if (!Array.isArray(words)) return [];

    return words
      .map((word: unknown, index: number) => normalizeWord(word, index))
      .filter((word: WordByWordEntry | null): word is WordByWordEntry => word !== null);
  } catch {
    return [];
  }
}
