import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, Pressable,
  ActivityIndicator, ScrollView, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AyahMatch {
  numberInSurah: number;
  text: string;
  surahNumber: number;
  surahName: string;
  surahEnglishName: string;
  revelationType: string;
}

interface SurahGroup {
  surahNumber: number;
  surahName: string;
  surahEnglishName: string;
  revelationType: string;
  ayahs: AyahMatch[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ARABIC_SUGGESTIONS = [
  { label: 'رَحْمَة', query: 'mercy', en: 'Mercy' },
  { label: 'صَبْر', query: 'patience', en: 'Patience' },
  { label: 'صَلَاة', query: 'prayer', en: 'Prayer' },
  { label: 'جَنَّة', query: 'paradise', en: 'Paradise' },
  { label: 'هُدى', query: 'guidance', en: 'Guidance' },
  { label: 'نُور', query: 'light', en: 'Light' },
  { label: 'إِيمَان', query: 'faith', en: 'Faith' },
  { label: 'تَوبَة', query: 'repentance', en: 'Repentance' },
  { label: 'عَدل', query: 'justice', en: 'Justice' },
  { label: 'شُكر', query: 'gratitude', en: 'Gratitude' },
];

const POPULAR_SEARCHES = [
  'mercy', 'paradise', 'prayer', 'guidance', 'faith', 'light',
  'patience', 'forgiveness', 'justice', 'knowledge', 'charity', 'love',
  'repentance', 'piety', 'peace', 'heaven',
];

const SEARCH_CACHE_KEY = 'quran_search_cache_v2';
const HISTORY_KEY = 'quran_search_history_v2';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupBySurah(matches: any[]): SurahGroup[] {
  const map = new Map<number, SurahGroup>();
  for (const m of matches) {
    const num = m.surah?.number || 0;
    if (!num) continue;
    if (!map.has(num)) {
      map.set(num, {
        surahNumber: num,
        surahName: m.surah.name || '',
        surahEnglishName: m.surah.englishName || '',
        revelationType: m.surah.revelationType || 'Unknown',
        ayahs: [],
      });
    }
    // Deduplicate same ayah
    const group = map.get(num)!;
    if (!group.ayahs.find(a => a.numberInSurah === m.numberInSurah)) {
      group.ayahs.push({
        numberInSurah: m.numberInSurah,
        text: m.text,
        surahNumber: num,
        surahName: m.surah.name,
        surahEnglishName: m.surah.englishName,
        revelationType: m.surah.revelationType,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.surahNumber - b.surahNumber);
}

function isArabicText(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QuranSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C } = useApp();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SurahGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'Meccan' | 'Medinan'>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(data => {
      if (data) setRecentSearches(JSON.parse(data));
    });
  }, []);

  const saveToHistory = useCallback(async (q: string) => {
    const next = (current: string[]) => {
      const updated = [q, ...current.filter(s => s !== q)].slice(0, 10);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    };
    setRecentSearches(next);
  }, []);

  const clearHistory = async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  };

  const performSearch = useCallback(async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setError(null);
    setHasSearched(true);

    // Check cache
    try {
      const raw = await AsyncStorage.getItem(SEARCH_CACHE_KEY);
      const cache: Record<string, { data: SurahGroup[]; ts: number }> = raw ? JSON.parse(raw) : {};
      const key = q.toLowerCase();
      if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) {
        setResults(cache[key].data);
        setLoading(false);
        saveToHistory(q);
        return;
      }
    } catch {}

    try {
      const arabic = isArabicText(q);
      const [enRes, arRes] = await Promise.allSettled([
        fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(q)}/all/en.sahih`),
        arabic
          ? fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(q)}/all/quran-uthmani`)
          : Promise.reject('skip'),
      ]);

      const allMatches: any[] = [];
      if (enRes.status === 'fulfilled') {
        const d = await enRes.value.json();
        if (d.code === 200 && d.data?.matches) allMatches.push(...d.data.matches);
      }
      if (arRes.status === 'fulfilled') {
        const d = await arRes.value.json();
        if (d.code === 200 && d.data?.matches) {
          for (const m of d.data.matches) {
            const dup = allMatches.find(e => e.surah?.number === m.surah?.number && e.numberInSurah === m.numberInSurah);
            if (!dup) allMatches.push(m);
          }
        }
      }

      const grouped = groupBySurah(allMatches);
      setResults(grouped);

      // Cache
      try {
        const raw = await AsyncStorage.getItem(SEARCH_CACHE_KEY);
        const cache: Record<string, any> = raw ? JSON.parse(raw) : {};
        cache[q.toLowerCase()] = { data: grouped, ts: Date.now() };
        const keys = Object.keys(cache);
        if (keys.length > 25) delete cache[keys[0]];
        await AsyncStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cache));
      } catch {}

      await saveToHistory(q);
    } catch {
      setError('Search failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [saveToHistory]);

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length >= 2) {
      debounceRef.current = setTimeout(() => performSearch(text), 600);
    } else {
      setResults([]);
      setHasSearched(false);
    }
  };

  const handleQuickSearch = (q: string) => {
    setQuery(q);
    performSearch(q);
  };

  const filteredResults = filter === 'all'
    ? results
    : results.filter(r => r.revelationType === filter);

  const totalMatches = filteredResults.reduce((s, r) => s + r.ayahs.length, 0);

  const meccanCount = results.filter(r => r.revelationType === 'Meccan').reduce((s, r) => s + r.ayahs.length, 0);
  const medinanCount = results.filter(r => r.revelationType === 'Medinan').reduce((s, r) => s + r.ayahs.length, 0);

  const shareVerse = (g: SurahGroup, a: AyahMatch) => {
    Share.share({ message: `"${a.text}"\n\n— Quran ${g.surahNumber}:${a.numberInSurah} (${g.surahEnglishName})` });
  };

  // ─── Render surah group ─────────────────────────────────────────────────────

  const renderGroup = ({ item: group }: { item: SurahGroup }) => (
    <View style={[styles.groupCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
      {/* Surah Header */}
      <Pressable
        style={[styles.groupHeader, { backgroundColor: `${C.primary}12`, borderBottomColor: C.cardBorder }]}
        onPress={() => router.push(`/quran/${group.surahNumber}` as any)}
      >
        <View style={[styles.surahNum, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}>
          <Text style={[styles.surahNumText, { color: C.gold }]}>{group.surahNumber}</Text>
        </View>
        <View style={styles.surahInfo}>
          <Text style={[styles.surahEn, { color: C.textPrimary }]}>{group.surahEnglishName}</Text>
          <Text style={[styles.surahAr, { color: C.textArabic }]}>{group.surahName}</Text>
        </View>
        <View style={styles.surahRight}>
          <View style={[
            styles.revTypeBadge,
            { backgroundColor: group.revelationType === 'Meccan' ? `${C.gold}15` : `${C.info}15` },
          ]}>
            <Text style={[
              styles.revTypeText,
              { color: group.revelationType === 'Meccan' ? C.gold : C.info },
            ]}>
              {group.revelationType}
            </Text>
          </View>
          <Text style={[styles.matchCount, { color: C.textMuted }]}>
            {group.ayahs.length} match{group.ayahs.length !== 1 ? 'es' : ''}
          </Text>
        </View>
      </Pressable>

      {/* Ayahs */}
      {group.ayahs.map((ayah, idx) => (
        <Pressable
          key={`${ayah.numberInSurah}-${idx}`}
          style={({ pressed }) => [
            styles.ayahRow,
            idx < group.ayahs.length - 1 && { borderBottomColor: C.cardBorder, borderBottomWidth: 1 },
            pressed && { backgroundColor: `${C.gold}08` },
          ]}
          onPress={() => router.push(`/quran/${group.surahNumber}` as any)}
        >
          <View style={[styles.verseNumBadge, { backgroundColor: `${C.primary}15` }]}>
            <Text style={[styles.verseNumText, { color: C.textSecondary }]}>{ayah.numberInSurah}</Text>
          </View>
          <Text style={[styles.ayahText, { color: C.textPrimary }]} numberOfLines={4}>
            {ayah.text}
          </Text>
          <View style={styles.ayahActions}>
            <Pressable
              style={[styles.iconBtn, { backgroundColor: `${C.gold}10` }]}
              onPress={() => shareVerse(group, ayah)}
              hitSlop={8}
            >
              <MaterialIcons name="share" size={14} color={C.gold} />
            </Pressable>
            <MaterialIcons name="chevron-right" size={18} color={C.textMuted} />
          </View>
        </Pressable>
      ))}
    </View>
  );

  // ─── Empty / Default screen ─────────────────────────────────────────────────

  const renderDefault = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
      {recentSearches.length > 0 && (
        <View style={styles.defaultSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: C.textMuted }]}>RECENT SEARCHES</Text>
            <Pressable onPress={clearHistory}>
              <Text style={[styles.clearText, { color: C.error }]}>Clear All</Text>
            </Pressable>
          </View>
          <View style={[styles.sectionBox, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            {recentSearches.map((s, i) => (
              <React.Fragment key={s}>
                <Pressable
                  style={({ pressed }) => [styles.historyRow, pressed && { backgroundColor: C.surfaceElevated }]}
                  onPress={() => handleQuickSearch(s)}
                >
                  <MaterialIcons name="history" size={16} color={C.textMuted} />
                  <Text style={[styles.historyText, { color: C.textPrimary }]}>{s}</Text>
                  <MaterialIcons name="north-west" size={13} color={C.textMuted} />
                </Pressable>
                {i < recentSearches.length - 1 && <View style={[styles.divider, { backgroundColor: C.cardBorder }]} />}
              </React.Fragment>
            ))}
          </View>
        </View>
      )}

      <View style={styles.defaultSection}>
        <Text style={[styles.sectionLabel, { color: C.textMuted }]}>POPULAR SEARCHES</Text>
        <View style={styles.popularGrid}>
          {POPULAR_SEARCHES.map(s => (
            <Pressable
              key={s}
              style={[styles.popularChip, { backgroundColor: C.card, borderColor: C.cardBorder }]}
              onPress={() => handleQuickSearch(s)}
            >
              <MaterialIcons name="search" size={12} color={C.textMuted} />
              <Text style={[styles.popularText, { color: C.textSecondary }]}>{s}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.tipsCard, { backgroundColor: `${C.primary}12`, borderColor: `${C.primary}20`, marginHorizontal: Spacing.md }]}>
        <MaterialIcons name="tips-and-updates" size={18} color={C.gold} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.tipsTitle, { color: C.gold }]}>Search Tips</Text>
          <Text style={[styles.tipsBody, { color: C.textSecondary }]}>
            {'• Search English or Arabic words\n• Use single keywords for best results\n• Filter by Meccan or Medinan surahs\n• Tap any result to open in Quran reader'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  // ─── No results ─────────────────────────────────────────────────────────────

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="manage-search" size={52} color={C.textMuted} />
      <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>No results for "{query}"</Text>
      <Text style={[styles.emptyDesc, { color: C.textMuted }]}>Try different keywords or browse popular searches</Text>
      <View style={styles.popularGrid}>
        {POPULAR_SEARCHES.slice(0, 8).map(s => (
          <Pressable
            key={s}
            style={[styles.popularChip, { backgroundColor: C.card, borderColor: C.cardBorder }]}
            onPress={() => handleQuickSearch(s)}
          >
            <Text style={[styles.popularText, { color: C.textSecondary }]}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Search Quran</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Box */}
        <View style={[styles.searchBox, { backgroundColor: C.surface, borderColor: `${C.gold}30` }]}>
          <MaterialIcons name="search" size={20} color={C.textMuted} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: C.textPrimary }]}
            placeholder="Search in English or Arabic..."
            placeholderTextColor={C.textMuted}
            value={query}
            onChangeText={handleChange}
            onSubmitEditing={() => performSearch(query)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setResults([]); setHasSearched(false); }}>
              <MaterialIcons name="close" size={18} color={C.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Arabic Suggestion Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}
        >
          {ARABIC_SUGGESTIONS.map(s => (
            <Pressable
              key={s.query}
              style={[styles.arabicChip, { backgroundColor: `${C.gold}12`, borderColor: `${C.gold}25` }]}
              onPress={() => handleQuickSearch(s.query)}
            >
              <Text style={[styles.arabicChipAr, { color: C.textArabic }]}>{s.label}</Text>
              <Text style={[styles.arabicChipEn, { color: C.textMuted }]}>{s.en}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      {hasSearched && results.length > 0 && (
        <View style={[styles.filterBar, { backgroundColor: C.surface, borderBottomColor: C.cardBorder }]}>
          {([
            { key: 'all', label: `All (${totalMatches})` },
            { key: 'Meccan', label: `Meccan (${meccanCount})` },
            { key: 'Medinan', label: `Medinan (${medinanCount})` },
          ] as const).map(f => (
            <Pressable
              key={f.key}
              style={[
                styles.filterBtn,
                { borderColor: C.cardBorder },
                filter === f.key && [styles.filterBtnActive, { backgroundColor: `${C.gold}15`, borderColor: C.gold }],
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, { color: filter === f.key ? C.gold : C.textMuted }]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={[styles.loadingText, { color: C.textMuted }]}>Searching the Holy Quran...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialIcons name="wifi-off" size={52} color={C.error} />
          <Text style={[styles.errorText, { color: C.error }]}>{error}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: C.gold }]} onPress={() => performSearch(query)}>
            <Text style={[styles.retryText, { color: C.primaryDark }]}>Try Again</Text>
          </Pressable>
        </View>
      ) : hasSearched && filteredResults.length === 0 ? (
        renderEmpty()
      ) : !hasSearched ? (
        renderDefault()
      ) : (
        <FlatList
          data={filteredResults}
          renderItem={renderGroup}
          keyExtractor={item => String(item.surahNumber)}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={
            <View style={[styles.resultsHeader, { backgroundColor: C.surfaceElevated, borderColor: C.cardBorder }]}>
              <MaterialIcons name="auto-awesome" size={13} color={C.gold} />
              <Text style={[styles.resultsHeaderText, { color: C.textSecondary }]}>
                {totalMatches} verse{totalMatches !== 1 ? 's' : ''} in {filteredResults.length} surah{filteredResults.length !== 1 ? 's' : ''} for "{query}"
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingBottom: Spacing.sm },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
    marginBottom: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16, padding: 0 },
  chipsScroll: { marginTop: Spacing.sm },
  chipsContent: { paddingHorizontal: Spacing.md, gap: 8, paddingBottom: Spacing.sm },
  arabicChip: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 64,
  },
  arabicChipAr: { fontSize: 16, fontWeight: '400' },
  arabicChipEn: { fontSize: 9, marginTop: 1 },

  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterBtnActive: {},
  filterText: { fontSize: 12, fontWeight: '600' },

  resultsList: { padding: Spacing.md, paddingBottom: 100 },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  resultsHeaderText: { fontSize: 13 },

  groupCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: 12,
    borderBottomWidth: 1,
  },
  surahNum: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  surahNumText: { fontSize: 12, fontWeight: '700' },
  surahInfo: { flex: 1 },
  surahEn: { fontSize: 15, fontWeight: '700' },
  surahAr: { fontSize: 14, marginTop: 1 },
  surahRight: { alignItems: 'flex-end', gap: 3 },
  revTypeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  revTypeText: { fontSize: 10, fontWeight: '700' },
  matchCount: { fontSize: 11 },

  ayahRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  verseNumBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  verseNumText: { fontSize: 11, fontWeight: '700' },
  ayahText: { flex: 1, fontSize: 14, lineHeight: 22 },
  ayahActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  defaultSection: { padding: Spacing.md, paddingBottom: 0 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  clearText: { fontSize: 12, fontWeight: '600' },
  sectionBox: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
  },
  historyText: { flex: 1, fontSize: 15 },
  divider: { height: 1, marginHorizontal: Spacing.md },
  popularGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8, paddingHorizontal: Spacing.md },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  popularText: { fontSize: 13 },
  tipsCard: {
    flexDirection: 'row',
    gap: 10,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  tipsTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  tipsBody: { fontSize: 12, lineHeight: 20 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: Spacing.xl },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 14, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: Radius.md },
  retryText: { fontSize: 15, fontWeight: '700' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
});
