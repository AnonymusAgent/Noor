/**
 * Hadith Search Screen — Full-text search across offline + cached online hadiths.
 * Supports keyword, narrator, grade, and reference filters.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  Share, ActivityIndicator, ScrollView, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getAllOfflineHadiths, OfflineHadith } from '../../constants/offlineHadithDb';
import { HADITH_COLLECTIONS } from '../../constants/hadithData';
import { HadithAPIItem, COLLECTION_API_MAP } from '../../services/hadithService';

// ─── Unified search result type ───────────────────────────────────────────────

interface SearchResult {
  id: string;
  number: number;
  english: string;
  arabic: string;
  narrator: string;
  grade: string;
  reference: string;
  collection: string;
  bookName: string;
  chapterName: string;
  source: 'offline' | 'cached';
  matchedField: 'text' | 'narrator' | 'grade' | 'reference';
}

// ─── Filters ──────────────────────────────────────────────────────────────────

const GRADES = ['All', 'Sahih', 'Hasan', 'Da\'if', 'Mawdu\'', 'Hasan Sahih'];

const QUICK_SEARCHES = [
  { label: 'Patience', query: 'patience' },
  { label: 'Prayer', query: 'prayer salah' },
  { label: 'Fasting', query: 'fasting Ramadan' },
  { label: 'Charity', query: 'sadaqah charity' },
  { label: 'Paradise', query: 'paradise jannah' },
  { label: 'Knowledge', query: 'knowledge seeking' },
  { label: 'Anger', query: 'anger' },
  { label: 'Honesty', query: 'truthful honest' },
  { label: 'Forgiveness', query: 'forgiveness repentance' },
  { label: 'Family', query: 'family parents' },
];

// ─── Load all cached online hadiths ──────────────────────────────────────────

async function loadCachedOnlineHadiths(): Promise<SearchResult[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const hadithKeys = keys.filter(k => k.startsWith('hadith_v2_'));
    if (!hadithKeys.length) return [];

    const pairs = await AsyncStorage.multiGet(hadithKeys);
    const results: SearchResult[] = [];

    for (const [key, raw] of pairs) {
      if (!raw) continue;
      try {
        const items: HadithAPIItem[] = JSON.parse(raw);
        // Extract collection from key: hadith_v2_{collection}_p{page}
        const parts = key.split('_');
        const collection = parts[2] || 'unknown';
        for (const h of items) {
          if (!h.id) continue; // no translation text
          results.push({
            id: `cached_${collection}_${h.number}`,
            number: h.number,
            english: h.id,
            arabic: h.arab || '',
            narrator: h.narrator || '—',
            grade: h.grade || 'Refer to source',
            reference: h.reference || `${collection} #${h.number}`,
            collection,
            bookName: h.bookName || COLLECTION_API_MAP[collection] || collection,
            chapterName: h.chapterName || '',
            source: 'cached',
            matchedField: 'text',
          });
        }
      } catch { /* skip corrupted entry */ }
    }
    return results;
  } catch {
    return [];
  }
}

// ─── Search logic ─────────────────────────────────────────────────────────────

function scoreMatch(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const words = q.split(/\s+/);
  let score = 0;
  for (const word of words) {
    if (t.includes(word)) score += word.length;
  }
  return score;
}

function searchHadiths(
  offline: OfflineHadith[],
  cached: SearchResult[],
  query: string,
  narratorFilter: string,
  gradeFilter: string,
  collectionFilter: string,
): SearchResult[] {
  const q = query.trim().toLowerCase();
  const hasQuery = q.length > 0;
  const hasFilters = (narratorFilter || gradeFilter !== 'All' || collectionFilter !== 'All');

  if (!hasQuery && !hasFilters) return [];

  const offlineResults: SearchResult[] = offline
    .filter(h => {
      if (collectionFilter !== 'All' && h.collection !== collectionFilter) return false;
      if (gradeFilter !== 'All' && !h.grade.includes(gradeFilter)) return false;
      if (narratorFilter && !h.narrator.toLowerCase().includes(narratorFilter.toLowerCase())) return false;
      if (!hasQuery) return true;

      return (
        h.english.toLowerCase().includes(q) ||
        h.arabic.includes(q) ||
        h.narrator.toLowerCase().includes(q) ||
        h.reference.toLowerCase().includes(q) ||
        h.bookName.toLowerCase().includes(q) ||
        h.chapterName.toLowerCase().includes(q) ||
        String(h.number) === q
      );
    })
    .map(h => ({
      id: h.id,
      number: h.number,
      english: h.english,
      arabic: h.arabic,
      narrator: h.narrator,
      grade: h.grade,
      reference: h.reference,
      collection: h.collection,
      bookName: h.bookName,
      chapterName: h.chapterName,
      source: 'offline' as const,
      matchedField: 'text' as const,
      _score: scoreMatch(h.english, q) + scoreMatch(h.chapterName, q) * 0.5,
    }))
    .sort((a, b) => (b as any)._score - (a as any)._score);

  const cachedResults: SearchResult[] = hasQuery
    ? cached.filter(h => {
        if (collectionFilter !== 'All' && h.collection !== collectionFilter) return false;
        if (!hasQuery) return false;
        return h.english.toLowerCase().includes(q) || h.arabic.includes(q);
      })
    : [];

  // Deduplicate: prefer offline version
  const seenRefs = new Set(offlineResults.map(h => `${h.collection}_${h.number}`));
  const uniqueCached = cachedResults.filter(h => !seenRefs.has(`${h.collection}_${h.number}`));

  return [...offlineResults, ...uniqueCached].slice(0, 100);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HadithSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, addBookmark, removeBookmark, isBookmarked } = useApp();

  const [query, setQuery] = useState('');
  const [narratorFilter, setNarratorFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('All');
  const [collectionFilter, setCollectionFilter] = useState('All');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [offlineDb, setOfflineDb] = useState<OfflineHadith[]>([]);
  const [cachedOnline, setCachedOnline] = useState<SearchResult[]>([]);
  const [loadingCache, setLoadingCache] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load databases on mount
  useEffect(() => {
    const offline = getAllOfflineHadiths();
    setOfflineDb(offline);
    loadCachedOnlineHadiths().then(cached => {
      setCachedOnline(cached);
      setLoadingCache(false);
    });
    AsyncStorage.getItem('hadith_search_history').then(raw => {
      if (raw) setSearchHistory(JSON.parse(raw));
    });
  }, []);

  const saveHistory = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) return;
    const updated = [trimmed, ...searchHistory.filter(h => h !== trimmed)].slice(0, 10);
    setSearchHistory(updated);
    await AsyncStorage.setItem('hadith_search_history', JSON.stringify(updated));
  }, [searchHistory]);

  const clearHistory = useCallback(async () => {
    setSearchHistory([]);
    await AsyncStorage.removeItem('hadith_search_history');
  }, []);

  const performSearch = useCallback((q: string, nf = narratorFilter, gf = gradeFilter, cf = collectionFilter) => {
    const found = searchHadiths(offlineDb, cachedOnline, q, nf, gf, cf);
    setResults(found);
    if (q.trim().length >= 2) saveHistory(q.trim());
  }, [offlineDb, cachedOnline, narratorFilter, gradeFilter, collectionFilter, saveHistory]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(text);
    }, 350);
  }, [performSearch]);

  const handleFilterChange = useCallback((nf: string, gf: string, cf: string) => {
    setNarratorFilter(nf);
    setGradeFilter(gf);
    setCollectionFilter(cf);
    performSearch(query, nf, gf, cf);
  }, [query, performSearch]);

  const shareHadith = useCallback(async (item: SearchResult) => {
    const text = item.arabic
      ? `${item.arabic}\n\n"${item.english}"\n\n— ${item.narrator}\n${item.reference}`
      : `"${item.english}"\n\n— ${item.reference}`;
    await Share.share({ message: text });
  }, []);

  // ── Render card ─────────────────────────────────────────────────────────────
  const renderResult = useCallback(({ item, index }: { item: SearchResult; index: number }) => {
    const ref = `hadith_${item.collection}_${item.number}`;
    const bookmarked = isBookmarked(ref);
    const isExpanded = expandedId === item.id;

    const gradeColor =
      item.grade === 'Sahih' ? C.success
      : item.grade.startsWith('Hasan') ? C.gold
      : C.textMuted;

    // Highlight matched keywords in english text
    const preview = item.english.length > 180 && !isExpanded
      ? item.english.slice(0, 180) + '…'
      : item.english;

    return (
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        <Pressable style={styles.cardTop} onPress={() => setExpandedId(isExpanded ? null : item.id)}>
          {/* Number + Collection badge */}
          <View style={[styles.numBox, { backgroundColor: `${C.gold}12`, borderColor: `${C.gold}25` }]}>
            <Text style={[styles.numText, { color: C.gold }]}>{item.number}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={[styles.bookName, { color: C.textPrimary }]} numberOfLines={1}>
              {item.chapterName || item.bookName || item.reference}
            </Text>
            <Text style={[styles.collectionName, { color: C.textMuted }]}>{item.reference}</Text>
          </View>
          <View style={styles.cardRight}>
            {item.grade !== 'Refer to source' && (
              <View style={[styles.gradeBadge, { backgroundColor: `${gradeColor}12` }]}>
                <Text style={[styles.gradeText, { color: gradeColor }]}>{item.grade}</Text>
              </View>
            )}
            {item.source === 'offline' ? (
              <MaterialIcons name="offline-bolt" size={13} color={C.success} />
            ) : (
              <MaterialIcons name="wifi" size={13} color={C.info} />
            )}
          </View>
        </Pressable>

        {/* Arabic */}
        {item.arabic ? (
          <Text style={[styles.arabicText, { color: C.textArabic }]}>{item.arabic}</Text>
        ) : null}

        {/* English */}
        <Text style={[styles.englishText, { color: C.textSecondary }]}>{preview}</Text>

        {/* Expanded Details */}
        {isExpanded && item.narrator !== '—' && (
          <View style={[styles.expandedRow, { borderTopColor: C.divider }]}>
            <MaterialIcons name="person" size={13} color={C.textMuted} />
            <Text style={[styles.narratorText, { color: C.textMuted }]}>Narrator: {item.narrator}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={[styles.actionRow, { borderTopColor: C.divider }]}>
          <Pressable
            style={styles.actionBtn}
            onPress={() =>
              bookmarked
                ? removeBookmark(ref)
                : addBookmark({
                    type: 'hadith',
                    reference: ref,
                    title: `${item.collection} #${item.number}`,
                    subtitle: item.english.slice(0, 80) + '...',
                    arabic: item.arabic,
                  })
            }
          >
            <MaterialIcons
              name={bookmarked ? 'bookmark' : 'bookmark-border'}
              size={17}
              color={bookmarked ? C.gold : C.textMuted}
            />
            <Text style={[styles.actionText, { color: C.textMuted }]}>{bookmarked ? 'Saved' : 'Save'}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => shareHadith(item)}>
            <MaterialIcons name="share" size={17} color={C.textMuted} />
            <Text style={[styles.actionText, { color: C.textMuted }]}>Share</Text>
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              const collectionMeta = HADITH_COLLECTIONS.find(c => c.id === item.collection);
              if (collectionMeta) router.push(`/hadith/${item.collection}` as any);
            }}
          >
            <MaterialIcons name="open-in-new" size={17} color={C.textMuted} />
            <Text style={[styles.actionText, { color: C.textMuted }]}>Open</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => setExpandedId(isExpanded ? null : item.id)}>
            <MaterialIcons name={isExpanded ? 'unfold-less' : 'unfold-more'} size={17} color={C.textMuted} />
            <Text style={[styles.actionText, { color: C.textMuted }]}>{isExpanded ? 'Less' : 'More'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }, [
    C, expandedId, isBookmarked, addBookmark, removeBookmark, router, shareHadith,
  ]);

  const hasActiveFilters = gradeFilter !== 'All' || collectionFilter !== 'All' || narratorFilter.trim().length > 0;
  const showEmpty = query.trim().length === 0 && !hasActiveFilters;

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: C.textPrimary, backgroundColor: `${C.textPrimary}12` }]}
            placeholder="Search hadiths..."
            placeholderTextColor={`${C.textPrimary}55`}
            value={query}
            onChangeText={handleQueryChange}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          <Pressable
            style={[styles.filterBtn, { backgroundColor: `${C.gold}${hasActiveFilters ? '30' : '12'}`, borderColor: `${C.gold}30` }]}
            onPress={() => setShowFilters(true)}
          >
            <MaterialIcons name="tune" size={20} color={C.gold} />
            {hasActiveFilters && <View style={[styles.filterDot, { backgroundColor: C.gold }]} />}
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: `${C.success}15` }]}>
            <MaterialIcons name="offline-bolt" size={11} color={C.success} />
            <Text style={[styles.statChipText, { color: C.success }]}>
              {offlineDb.length} offline
            </Text>
          </View>
          {cachedOnline.length > 0 && (
            <View style={[styles.statChip, { backgroundColor: `${C.info}15` }]}>
              <MaterialIcons name="wifi" size={11} color={C.info} />
              <Text style={[styles.statChipText, { color: C.info }]}>
                {cachedOnline.length.toLocaleString()} cached
              </Text>
            </View>
          )}
          {loadingCache && (
            <View style={[styles.statChip, { backgroundColor: `${C.textMuted}10` }]}>
              <ActivityIndicator size={10} color={C.textMuted} />
              <Text style={[styles.statChipText, { color: C.textMuted }]}>Loading cache...</Text>
            </View>
          )}
          {results.length > 0 && (
            <View style={[styles.statChip, { backgroundColor: `${C.gold}15` }]}>
              <Text style={[styles.statChipText, { color: C.gold }]}>{results.length} results</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Content */}
      {showEmpty ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.emptyScroll}>
          {/* Quick searches */}
          <Text style={[styles.sectionLabel, { color: C.textMuted }]}>QUICK SEARCHES</Text>
          <View style={styles.quickGrid}>
            {QUICK_SEARCHES.map(qs => (
              <Pressable
                key={qs.label}
                style={[styles.quickChip, { backgroundColor: C.card, borderColor: C.cardBorder }]}
                onPress={() => { setQuery(qs.query); handleQueryChange(qs.query); }}
              >
                <MaterialIcons name="search" size={13} color={C.gold} />
                <Text style={[styles.quickChipText, { color: C.textSecondary }]}>{qs.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Recent history */}
          {searchHistory.length > 0 && (
            <>
              <View style={styles.historyHeader}>
                <Text style={[styles.sectionLabel, { color: C.textMuted }]}>RECENT SEARCHES</Text>
                <Pressable onPress={clearHistory}>
                  <Text style={[styles.clearText, { color: C.error }]}>Clear</Text>
                </Pressable>
              </View>
              {searchHistory.map(h => (
                <Pressable
                  key={h}
                  style={[styles.historyItem, { borderBottomColor: C.cardBorder }]}
                  onPress={() => { setQuery(h); handleQueryChange(h); }}
                >
                  <MaterialIcons name="history" size={16} color={C.textMuted} />
                  <Text style={[styles.historyText, { color: C.textSecondary }]}>{h}</Text>
                  <Pressable onPress={() => {
                    const updated = searchHistory.filter(x => x !== h);
                    setSearchHistory(updated);
                    AsyncStorage.setItem('hadith_search_history', JSON.stringify(updated));
                  }}>
                    <MaterialIcons name="close" size={14} color={C.textMuted} />
                  </Pressable>
                </Pressable>
              ))}
            </>
          )}

          {/* Tip */}
          <View style={[styles.tipCard, { backgroundColor: `${C.info}10`, borderColor: `${C.info}20` }]}>
            <MaterialIcons name="lightbulb" size={16} color={C.info} />
            <Text style={[styles.tipText, { color: C.textSecondary }]}>
              Search by keyword, narrator name, or reference number (e.g., "Bukhari 13"). Use filters to narrow by grade or collection.
            </Text>
          </View>
        </ScrollView>
      ) : results.length === 0 ? (
        <View style={styles.noResults}>
          <MaterialIcons name="search-off" size={56} color={C.textMuted} />
          <Text style={[styles.noResultsTitle, { color: C.textPrimary }]}>No Results Found</Text>
          <Text style={[styles.noResultsDesc, { color: C.textMuted }]}>
            Try different keywords, or load more hadiths online from the Hadith Collections screen.
          </Text>
          {hasActiveFilters && (
            <Pressable
              style={[styles.clearFilterBtn, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}
              onPress={() => handleFilterChange('', 'All', 'All')}
            >
              <MaterialIcons name="filter-list-off" size={16} color={C.gold} />
              <Text style={[styles.clearFilterText, { color: C.gold }]}>Clear Filters</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          removeClippedSubviews
          ListHeaderComponent={
            hasActiveFilters ? (
              <View style={[styles.activeFiltersRow, { backgroundColor: `${C.gold}10`, borderColor: `${C.gold}20` }]}>
                <MaterialIcons name="filter-list" size={14} color={C.gold} />
                <Text style={[styles.activeFiltersText, { color: C.gold }]}>
                  Filtered by: {[
                    gradeFilter !== 'All' ? gradeFilter : null,
                    collectionFilter !== 'All' ? collectionFilter : null,
                    narratorFilter ? `Narrator: ${narratorFilter}` : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
                <Pressable onPress={() => handleFilterChange('', 'All', 'All')}>
                  <MaterialIcons name="close" size={14} color={C.gold} />
                </Pressable>
              </View>
            ) : null
          }
        />
      )}

      {/* Filter Modal */}
      <Modal visible={showFilters} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: C.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: C.textPrimary }]}>Filter Hadiths</Text>
              <Pressable onPress={() => setShowFilters(false)}>
                <MaterialIcons name="close" size={24} color={C.textPrimary} />
              </Pressable>
            </View>

            {/* Grade filter */}
            <Text style={[styles.filterLabel, { color: C.textMuted }]}>GRADE / AUTHENTICITY</Text>
            <View style={styles.chipRow}>
              {GRADES.map(g => (
                <Pressable
                  key={g}
                  style={[
                    styles.filterChip,
                    { backgroundColor: C.card, borderColor: C.cardBorder },
                    gradeFilter === g && { backgroundColor: `${C.gold}20`, borderColor: C.gold },
                  ]}
                  onPress={() => setGradeFilter(g)}
                >
                  <Text style={[styles.filterChipText, { color: gradeFilter === g ? C.gold : C.textSecondary }]}>{g}</Text>
                </Pressable>
              ))}
            </View>

            {/* Collection filter */}
            <Text style={[styles.filterLabel, { color: C.textMuted }]}>COLLECTION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.collectionScroll}>
              {['All', ...HADITH_COLLECTIONS.map(c => c.id)].map(cid => {
                const meta = HADITH_COLLECTIONS.find(c => c.id === cid);
                return (
                  <Pressable
                    key={cid}
                    style={[
                      styles.filterChip,
                      { backgroundColor: C.card, borderColor: C.cardBorder, marginRight: 8 },
                      collectionFilter === cid && { backgroundColor: `${C.gold}20`, borderColor: C.gold },
                    ]}
                    onPress={() => setCollectionFilter(cid)}
                  >
                    <Text style={[styles.filterChipText, { color: collectionFilter === cid ? C.gold : C.textSecondary }]}>
                      {cid === 'All' ? 'All' : (meta?.name || cid)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Narrator filter */}
            <Text style={[styles.filterLabel, { color: C.textMuted }]}>NARRATOR (search by name)</Text>
            <TextInput
              style={[styles.narratorInput, { color: C.textPrimary, backgroundColor: C.card, borderColor: C.cardBorder }]}
              placeholder="e.g. Abu Hurayrah, Aisha, Anas..."
              placeholderTextColor={C.textMuted}
              value={narratorFilter}
              onChangeText={setNarratorFilter}
            />

            {/* Apply */}
            <Pressable
              style={[styles.applyBtn, { backgroundColor: C.gold }]}
              onPress={() => {
                handleFilterChange(narratorFilter, gradeFilter, collectionFilter);
                setShowFilters(false);
              }}
            >
              <MaterialIcons name="search" size={18} color={C.primaryDark} />
              <Text style={[styles.applyBtnText, { color: C.primaryDark }]}>Apply Filters</Text>
            </Pressable>

            {hasActiveFilters && (
              <Pressable
                style={[styles.resetBtn, { borderColor: C.error }]}
                onPress={() => {
                  setGradeFilter('All');
                  setCollectionFilter('All');
                  setNarratorFilter('');
                  handleFilterChange('', 'All', 'All');
                  setShowFilters(false);
                }}
              >
                <Text style={[styles.resetBtnText, { color: C.error }]}>Reset All Filters</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
    marginBottom: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  filterBtn: {
    width: 44, height: 44, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute', top: 8, right: 8,
    width: 7, height: 7, borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    paddingBottom: 4,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statChipText: { fontSize: 11, fontWeight: '600' },

  list: { padding: Spacing.md, paddingBottom: 100 },
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: 10,
  },
  activeFiltersText: { flex: 1, fontSize: 12, fontWeight: '600' },

  // Result card
  card: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  numBox: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, flexShrink: 0,
  },
  numText: { fontSize: 12, fontWeight: '700' },
  cardMeta: { flex: 1 },
  bookName: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  collectionName: { fontSize: 11, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  gradeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  gradeText: { fontSize: 10, fontWeight: '700' },
  arabicText: {
    fontSize: 19, textAlign: 'right', lineHeight: 38,
    paddingHorizontal: 12, paddingBottom: 6, writingDirection: 'rtl',
  },
  englishText: {
    fontSize: 14, lineHeight: 24, paddingHorizontal: 12,
    paddingBottom: 10, fontStyle: 'italic',
  },
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  narratorText: { fontSize: 12 },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    padding: 8,
    gap: 2,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4, paddingVertical: 5,
  },
  actionText: { fontSize: 11 },

  // Empty / quick search
  emptyScroll: { padding: Spacing.md, paddingBottom: 100 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1,
    marginBottom: Spacing.sm, marginTop: Spacing.md,
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.round, borderWidth: 1,
  },
  quickChipText: { fontSize: 13, fontWeight: '500' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearText: { fontSize: 12, fontWeight: '600' },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1,
  },
  historyText: { flex: 1, fontSize: 14 },
  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.lg,
  },
  tipText: { flex: 1, fontSize: 13, lineHeight: 20 },

  // No results
  noResults: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: 10 },
  noResultsTitle: { fontSize: 18, fontWeight: '700' },
  noResultsDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  clearFilterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: Radius.md, borderWidth: 1, marginTop: 4,
  },
  clearFilterText: { fontSize: 13, fontWeight: '600' },

  // Filter modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.md },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: Spacing.md, borderBottomWidth: 1, marginBottom: Spacing.md,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  filterLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.9,
    marginBottom: 8, marginTop: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  collectionScroll: { marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.round, borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  narratorInput: {
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, marginBottom: 4,
  },
  applyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: Radius.md, marginTop: 16,
  },
  applyBtnText: { fontSize: 15, fontWeight: '700' },
  resetBtn: {
    alignItems: 'center', paddingVertical: 12,
    borderRadius: Radius.md, borderWidth: 1, marginTop: 8, marginBottom: 8,
  },
  resetBtnText: { fontSize: 14, fontWeight: '600' },
});
