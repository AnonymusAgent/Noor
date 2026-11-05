/**
 * Hadith service with a paginated primary API, a cached full-edition fallback,
 * and the app's curated offline corpus as the final fallback.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const HADITH_API = 'https://api.hadith.gading.dev';
const FALLBACK_APIS = [
  'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@df57907be35291c91ad6a6691180e22ca9920784/editions',
  'https://raw.githubusercontent.com/fawazahmed0/hadith-api/df57907be35291c91ad6a6691180e22ca9920784/editions',
];
const CACHE_PREFIX = 'hadith_v2_';
const CACHE_TIME_PREFIX = 'hadith_cache_time_';
const CACHE_TOTAL_PREFIX = 'hadith_total_';
const FALLBACK_CACHE_DIR = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}hadith-editions-v1/`
  : null;
const PAGE_SIZE = 30;
const API_TIMEOUT = 12000;
const FALLBACK_TIMEOUT = 45000;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

export const COLLECTION_API_MAP: Record<string, string> = {
  bukhari: 'bukhari',
  muslim: 'muslim',
  abudawood: 'abu-dawud',
  tirmidhi: 'tirmidzi',
  nasai: 'nasai',
  ibnmajah: 'ibnu-majah',
  malik: 'malik',
  ahmad: 'ahmad',
  nawawi40: '',
  riyadussaliheen: '',
  bulugh: '',
};

const FALLBACK_BOOK_MAP: Record<string, string> = {
  bukhari: 'bukhari',
  muslim: 'muslim',
  abudawood: 'abudawud',
  tirmidhi: 'tirmidhi',
  nasai: 'nasai',
  ibnmajah: 'ibnmajah',
  malik: 'malik',
  nawawi40: 'nawawi',
};

export const COLLECTION_TOTAL: Record<string, number> = {
  bukhari: 7563,
  muslim: 7470,
  abudawood: 5274,
  tirmidhi: 3956,
  nasai: 5758,
  ibnmajah: 4341,
  malik: 1832,
  ahmad: 4305,
  nawawi40: 42,
  riyadussaliheen: 1896,
  bulugh: 1358,
};

const remoteTotals: Record<string, number> = {};

export interface HadithAPIItem {
  number: number;
  arab: string;
  id: string;
  collection?: string;
  bookName?: string;
  chapterName?: string;
  narrator?: string;
  grade?: string;
  reference?: string;
  language?: string;
}

interface CachedPage {
  items: HadithAPIItem[];
  fetchedAt: number;
  total: number;
}

interface FallbackHadith {
  hadithnumber?: number;
  arabicnumber?: number;
  text?: string;
  grades?: { grade?: string; name?: string }[];
  reference?: { book?: number | string; hadith?: number | string };
}

interface FallbackEdition {
  metadata?: {
    name?: string;
    sections?: Record<string, string>;
  };
  hadiths?: FallbackHadith[];
}

interface FallbackCollection {
  bookId: string;
  english: FallbackEdition;
  arabic: FallbackEdition | null;
}

let activeFallback: FallbackCollection | null = null;
const fallbackLoads = new Map<string, Promise<FallbackCollection | null>>();

export function isOnlineCollection(collectionId: string): boolean {
  return Boolean(COLLECTION_API_MAP[collectionId] || FALLBACK_BOOK_MAP[collectionId]);
}

export function getCollectionTotal(collectionId: string): number {
  return remoteTotals[collectionId] || COLLECTION_TOTAL[collectionId] || 0;
}

function cacheKey(collection: string, page: number): string {
  return `${CACHE_PREFIX}${collection}_p${page}`;
}

function cacheTimeKey(collection: string, page: number): string {
  return `${CACHE_TIME_PREFIX}${collection}_p${page}`;
}

function cacheTotalKey(collection: string): string {
  return `${CACHE_TOTAL_PREFIX}${collection}`;
}

async function readCache(collection: string, page: number): Promise<CachedPage | null> {
  try {
    const [raw, cachedAt, cachedTotal] = await Promise.all([
      AsyncStorage.getItem(cacheKey(collection, page)),
      AsyncStorage.getItem(cacheTimeKey(collection, page)),
      AsyncStorage.getItem(cacheTotalKey(collection)),
    ]);
    if (!raw) return null;

    const items: unknown = JSON.parse(raw);
    if (!Array.isArray(items)) return null;

    return {
      items: items.filter((item): item is HadithAPIItem =>
        item !== null && typeof item === 'object' && Number.isFinite(Number(item.number))
      ),
      fetchedAt: Number(cachedAt) || 0,
      total: Number(cachedTotal) || 0,
    };
  } catch {
    return null;
  }
}

async function writeCache(collection: string, page: number, items: HadithAPIItem[]): Promise<void> {
  if (!items.length) return;
  try {
    const total = remoteTotals[collection] || 0;
    const values: [string, string][] = [
      [cacheKey(collection, page), JSON.stringify(items)],
      [cacheTimeKey(collection, page), String(Date.now())],
    ];
    if (total > 0) values.push([cacheTotalKey(collection), String(total)]);
    await AsyncStorage.multiSet(values);
  } catch {
    // Network results are still usable when local storage is full or unavailable.
  }
}

function isFresh(cache: CachedPage | null): boolean {
  return Boolean(cache && cache.fetchedAt > 0 && Date.now() - cache.fetchedAt < CACHE_TTL);
}

async function fetchText(url: string, timeout: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string, timeout: number): Promise<unknown> {
  return JSON.parse(await fetchText(url, timeout));
}

function pageStart(page: number): number {
  return (page - 1) * PAGE_SIZE + 1;
}

function expectedPageLength(page: number, total: number): number {
  return Math.max(0, Math.min(PAGE_SIZE, total - pageStart(page) + 1));
}

function isCompletePage(items: HadithAPIItem[], page: number, total: number): boolean {
  const expected = expectedPageLength(page, total);
  if (items.length !== expected) return false;

  const numbers = new Set(items.map(item => item.number));
  if (numbers.size !== items.length) return false;

  const start = pageStart(page);
  return Array.from({ length: expected }, (_, index) => start + index)
    .every(number => numbers.has(number));
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePrimaryResponse(json: unknown, collectionId: string): {
  items: HadithAPIItem[];
  total: number;
} | null {
  if (!json || typeof json !== 'object') return null;
  const data = (json as { data?: Record<string, unknown> }).data;
  if (!data || !Array.isArray(data.hadiths)) return null;

  const available = Number(data.available);
  const total = Number.isFinite(available) && available > 0
    ? available
    : COLLECTION_TOTAL[collectionId] || 0;
  if (total) remoteTotals[collectionId] = total;

  const collectionName = stringValue(data.name) || collectionId;
  const items = data.hadiths.flatMap((value): HadithAPIItem[] => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    const number = Number(item.number);
    const arab = stringValue(item.arab);
    const translation = stringValue(item.id) || stringValue(item.en);
    if (!Number.isSafeInteger(number) || (!arab && !translation)) return [];

    const chapter = item.chapter;
    const chapterName = typeof chapter === 'string'
      ? chapter
      : chapter && typeof chapter === 'object'
        ? stringValue((chapter as Record<string, unknown>).english)
          || stringValue((chapter as Record<string, unknown>).id)
          || stringValue((chapter as Record<string, unknown>).name)
        : stringValue(item.chapterName);

    return [{
      number,
      arab,
      id: translation,
      collection: collectionId,
      bookName: stringValue(item.bookName) || collectionName,
      chapterName,
      narrator: stringValue(item.narrator) || '—',
      grade: stringValue(item.grade) || 'Refer to source',
      reference: stringValue(item.reference) || `${collectionName} #${number}`,
      language: stringValue(item.en) ? 'en' : 'id',
    }];
  });

  return { items, total };
}

function isFallbackEdition(value: unknown): value is FallbackEdition {
  if (!value || typeof value !== 'object') return false;
  const edition = value as FallbackEdition;
  return Boolean(
    edition.metadata &&
    Array.isArray(edition.hadiths) &&
    edition.hadiths.length > 0
  );
}

function editionCacheUri(bookId: string, language: string): string | null {
  return FALLBACK_CACHE_DIR ? `${FALLBACK_CACHE_DIR}${language}-${bookId}.json` : null;
}

async function readFallbackCache(bookId: string, language: string): Promise<FallbackEdition | null> {
  const uri = editionCacheUri(bookId, language);
  if (!uri) return null;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const parsed: unknown = JSON.parse(await FileSystem.readAsStringAsync(uri));
    return isFallbackEdition(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeFallbackCache(bookId: string, language: string, text: string): Promise<void> {
  const uri = editionCacheUri(bookId, language);
  if (!uri || !FALLBACK_CACHE_DIR) return;

  try {
    await FileSystem.makeDirectoryAsync(FALLBACK_CACHE_DIR, { intermediates: true });
    await FileSystem.writeAsStringAsync(uri, text);
  } catch {
    // Keep the current page usable even if the device cannot persist the edition.
  }
}

async function loadFallbackEdition(bookId: string, language: string): Promise<FallbackEdition> {
  const cached = await readFallbackCache(bookId, language);
  if (cached) return cached;

  let lastError: unknown;
  for (const api of FALLBACK_APIS) {
    for (const format of ['min.json', 'json']) {
      try {
        const text = await fetchText(`${api}/${language}-${bookId}.${format}`, FALLBACK_TIMEOUT);
        const parsed: unknown = JSON.parse(text);
        if (!isFallbackEdition(parsed)) throw new Error('Malformed Hadith edition');
        await writeFallbackCache(bookId, language, text);
        return parsed;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Hadith fallback unavailable');
}

async function loadFallbackCollection(collectionId: string): Promise<FallbackCollection | null> {
  const bookId = FALLBACK_BOOK_MAP[collectionId];
  if (!bookId) return null;
  if (activeFallback?.bookId === bookId) return activeFallback;

  const activeLoad = fallbackLoads.get(bookId);
  if (activeLoad) return activeLoad;

  const load = (async (): Promise<FallbackCollection | null> => {
    let english: FallbackEdition;
    try {
      english = await loadFallbackEdition(bookId, 'eng');
    } catch {
      return null;
    }

    let arabic: FallbackEdition | null = null;
    try {
      arabic = await loadFallbackEdition(bookId, 'ara');
    } catch {
      // The English edition remains usable if its Arabic edition is unavailable.
    }

    const result = { bookId, english, arabic };
    activeFallback = result;
    // Only trust the local length when it is at least as complete as the known
    // total; a partial download must not silently shrink the collection.
    const localTotal = english.hadiths?.length || 0;
    const knownTotal = getCollectionTotal(collectionId);
    if (localTotal && (!knownTotal || localTotal >= knownTotal)) {
      remoteTotals[collectionId] = localTotal;
    }
    return result;
  })();

  fallbackLoads.set(bookId, load);
  try {
    return await load;
  } finally {
    fallbackLoads.delete(bookId);
  }
}

function gradeText(grades: FallbackHadith['grades']): string {
  if (!Array.isArray(grades)) return 'Refer to source';
  const values = grades
    .map(grade => stringValue(grade?.grade) || stringValue(grade?.name))
    .filter(Boolean);
  return values.length ? [...new Set(values)].join(', ') : 'Refer to source';
}

function narratorFromText(text: string): string {
  const match = text.match(/^Narrated(?: by)?\s+([^:]{1,100}):/i);
  return match?.[1]?.trim() || '—';
}

function fallbackPage(
  dataset: FallbackCollection,
  collectionId: string,
  page: number,
): HadithAPIItem[] {
  const englishHadiths = dataset.english.hadiths || [];
  const arabicByNumber = new Map<number, FallbackHadith>();
  for (const item of dataset.arabic?.hadiths || []) {
    const number = Number(item.hadithnumber);
    if (Number.isSafeInteger(number) && !arabicByNumber.has(number)) arabicByNumber.set(number, item);
  }

  const start = pageStart(page);
  const end = start + PAGE_SIZE - 1;
  const seen = new Set<number>();

  return englishHadiths.flatMap((item): HadithAPIItem[] => {
    const number = Number(item.hadithnumber);
    const english = stringValue(item.text);
    if (!Number.isSafeInteger(number) || number < start || number > end || !english || seen.has(number)) {
      return [];
    }
    seen.add(number);

    const sectionId = item.reference?.book === undefined ? '' : String(item.reference.book);
    const bookName = stringValue(dataset.english.metadata?.name) || collectionId;
    const chapterName = stringValue(dataset.english.metadata?.sections?.[sectionId]);
    const referenceNumber = item.reference?.hadith ?? number;

    return [{
      number,
      arab: stringValue(arabicByNumber.get(number)?.text),
      id: english,
      collection: collectionId,
      bookName,
      chapterName,
      narrator: narratorFromText(english),
      grade: gradeText(item.grades),
      reference: `${bookName} ${sectionId ? `${sectionId}:` : ''}${referenceNumber}`,
      language: 'en',
    }];
  });
}

async function fetchPrimaryPage(collectionId: string, page: number): Promise<{
  items: HadithAPIItem[];
  total: number;
} | null> {
  const apiBook = COLLECTION_API_MAP[collectionId];
  if (!apiBook) return null;

  const start = pageStart(page);
  const end = start + PAGE_SIZE - 1;
  try {
    const json = await fetchJson(`${HADITH_API}/books/${apiBook}?range=${start}-${end}`, API_TIMEOUT);
    return normalizePrimaryResponse(json, collectionId);
  } catch {
    return null;
  }
}

export async function fetchHadithPage(
  collectionId: string,
  page: number,
  options: { allowFallback?: boolean } = {},
): Promise<HadithAPIItem[] | null> {
  if (!Number.isSafeInteger(page) || page < 1 || !isOnlineCollection(collectionId)) return null;

  const cached = await readCache(collectionId, page);
  if (cached?.total) remoteTotals[collectionId] = cached.total;
  if (cached?.items.length && isFresh(cached)) return cached.items;

  const primary = await fetchPrimaryPage(collectionId, page);
  const primaryTotal = primary?.total || getCollectionTotal(collectionId);
  if (primary && isCompletePage(primary.items, page, primaryTotal)) {
    await writeCache(collectionId, page, primary.items);
    return primary.items;
  }

  if (options.allowFallback !== false) {
    try {
      const dataset = await loadFallbackCollection(collectionId);
      if (dataset) {
        const fallback = fallbackPage(dataset, collectionId, page);
        const total = remoteTotals[collectionId] || getCollectionTotal(collectionId);
        if (isCompletePage(fallback, page, total)) {
          await writeCache(collectionId, page, fallback);
          return fallback;
        }

        const combined = new Map<number, HadithAPIItem>();
        for (const item of primary?.items || []) combined.set(item.number, item);
        for (const item of fallback) combined.set(item.number, item);
        const merged = [...combined.values()].sort((left, right) => left.number - right.number);
        if (isCompletePage(merged, page, total)) {
          await writeCache(collectionId, page, merged);
          return merged;
        }
      }
    } catch {
      // Use partial primary data or the last cached page below.
    }
  }

  return cached?.items.length ? cached.items : null;
}

export function totalPages(collectionId: string): number {
  return Math.ceil(getCollectionTotal(collectionId) / PAGE_SIZE);
}

export async function clearHadithCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const hadithKeys = keys.filter(key =>
      key.startsWith(CACHE_PREFIX) ||
      key.startsWith(CACHE_TIME_PREFIX) ||
      key.startsWith(CACHE_TOTAL_PREFIX)
    );
    await AsyncStorage.multiRemove(hadithKeys);
  } catch {
    // Cache clearing should not interrupt app use.
  }

  if (FALLBACK_CACHE_DIR) {
    try {
      await FileSystem.deleteAsync(FALLBACK_CACHE_DIR, { idempotent: true });
    } catch {
      // The operating system may already have evicted the cache directory.
    }
  }
  activeFallback = null;
  Object.keys(remoteTotals).forEach(key => delete remoteTotals[key]);
}

/** Pre-cache a few primary-source pages only; full-edition fallbacks load on demand. */
export async function preCacheAllCollections(): Promise<void> {
  const collections = Object.keys(COLLECTION_API_MAP).filter(key => COLLECTION_API_MAP[key]);
  try {
    await fetchJson(`${HADITH_API}/books`, 5000);
  } catch {
    return;
  }

  for (const collection of collections) {
    for (let page = 1; page <= 3; page++) {
      const existing = await readCache(collection, page);
      if (existing?.items.length) continue;
      await fetchHadithPage(collection, page, { allowFallback: false });
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
}
