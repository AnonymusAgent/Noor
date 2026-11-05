import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchSurahWithTranslation, SurahWithTranslation, searchQuran, isSurahCached,
} from '../services/quranService';

export function useSurahList() {
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  return { loading, error };
}

export function useSurah(surahNumber: number, translationEdition: string = 'en.sahih') {
  const [data, setData] = useState<SurahWithTranslation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const reloadTokenRef = useRef(-1);

  const load = useCallback(async () => {
    if (!surahNumber || surahNumber < 1 || surahNumber > 114) return;
    setLoading(true);
    setError(null);

    // Check if already cached for UI indicator
    // The cache probe is only a UI hint; a failure here must not block loading.
    isSurahCached(surahNumber, translationEdition)
      .then(setIsOfflineCached)
      .catch(() => {});

    const MAX_ATTEMPTS = 3;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await fetchSurahWithTranslation(surahNumber, translationEdition);
        if (!result?.arabic?.ayahs?.length) {
          throw new Error('Empty surah data received');
        }
        setData(result);
        setError(null);
        setIsOfflineCached(true);
        setLoading(false);
        return;
      } catch {
        lastError = attempt < MAX_ATTEMPTS
          ? `Loading… (attempt ${attempt}/${MAX_ATTEMPTS})`
          : 'Could not load Surah. Tap retry or check your connection.';

        if (attempt < MAX_ATTEMPTS) {
          // Wait before retry: 1s, 2s
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    setError(lastError);
    setLoading(false);
  }, [surahNumber, translationEdition]);

  useEffect(() => {
    load();
  }, [load]);

  // Manual retry: re-run the loader without depending on a counter that the
  // loader itself does not read (which made reload() a no-op).
  useEffect(() => {
    if (reloadToken === reloadTokenRef.current) return;
    reloadTokenRef.current = reloadToken;
    load();
  }, [reloadToken, load]);

  const reload = useCallback(() => {
    setReloadToken(token => token + 1);
  }, []);

  return { data, loading, error, reload, isOfflineCached };
}

export function useQuranSearch() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setQuery(q);
    setLoading(true);
    try {
      const found = await searchQuran(q);
      setResults(found);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, query, search };
}
