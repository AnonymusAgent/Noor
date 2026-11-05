import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  Share, TextInput, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../../constants/theme';
import { HADITH_COLLECTIONS } from '../../constants/hadithData';
import { getOfflineHadiths, OfflineHadith } from '../../constants/offlineHadithDb';
import { useApp } from '../../contexts/AppContext';
import {
  fetchHadithPage, totalPages, getCollectionTotal, isOnlineCollection, COLLECTION_API_MAP,
  HadithAPIItem,
} from '../../services/hadithService';

// ─── Unified hadith shape ─────────────────────────────────────────────────────

interface UnifiedHadith {
  id: string;
  number: number;
  arabic: string;
  english: string;
  narrator: string;
  grade: string;
  reference: string;
  bookName: string;
  chapterName: string;
  source: 'offline' | 'online';
}

function fromOffline(h: OfflineHadith): UnifiedHadith {
  return {
    id: h.id, number: h.number, arabic: h.arabic, english: h.english,
    narrator: h.narrator, grade: h.grade, reference: h.reference,
    bookName: h.bookName, chapterName: h.chapterName, source: 'offline',
  };
}

function fromOnline(h: HadithAPIItem, collection: string): UnifiedHadith {
  return {
    id: `online_${collection}_${h.number}`,
    number: h.number,
    arabic: h.arab || '',
    english: h.id || 'Translation not available in English for this hadith.',
    narrator: h.narrator || '—',
    grade: h.grade || 'Refer to source',
    reference: h.reference || `${collection} #${h.number}`,
    bookName: h.bookName || COLLECTION_API_MAP[collection] || collection,
    chapterName: h.chapterName || '',
    source: 'online',
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HadithCollectionScreen() {
  const { collection } = useLocalSearchParams<{ collection: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addBookmark, removeBookmark, isBookmarked, colors: C } = useApp();

  const collectionId = collection || 'nawawi40';
  const meta = HADITH_COLLECTIONS.find(c => c.id === collectionId);
  const hasOnlineSource = isOnlineCollection(collectionId);
  const knownTotal = getCollectionTotal(collectionId);

  // ── State ──────────────────────────────────────────────────────────────────
  const [hadiths, setHadiths] = useState<UnifiedHadith[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loadingOnline, setLoadingOnline] = useState(false);
  // Guards against a double fetch while a page request is in flight (React
  // state updates are async, so `loadingOnline` alone is not reliable inside an
  // effect that can fire twice).
  const loadingRef = useRef(false);
  const [onlineError, setOnlineError] = useState(false);
  const [allPagesLoaded, setAllPagesLoaded] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<TextInput>(null);

  // ── Load offline hadiths immediately ──────────────────────────────────────
  useEffect(() => {
    const offline = getOfflineHadiths(collectionId).map(fromOffline);
    setHadiths(offline);
    setCurrentPage(0);
    setAllPagesLoaded(false);
    setOnlineError(false);
    // If this collection has online source, start loading page 1
    if (isOnlineCollection(collectionId)) {
      loadNextPage(1, offline);
    } else {
      setAllPagesLoaded(true);
    }
    // Only the collection identity should restart the load; `loadNextPage` is
    // intentionally read through a ref to avoid re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]);

  // ── Load a page from API ───────────────────────────────────────────────────
  const loadNextPage = useCallback(async (page: number, base?: UnifiedHadith[]) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingOnline(true);
    setOnlineError(false);

    // A page can legitimately come back empty when the remote dataset has holes
    // in its numbering. Walk forward a few pages so paging never dead-ends on a
    // gap, and only give up once we're past the end of the collection.
    const lastPage = Math.max(1, totalPages(collectionId));
    const maxAttempts = 3;
    let targetPage = page;

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (targetPage > lastPage) break;

        const items = await fetchHadithPage(collectionId, targetPage);
        if (items && items.length > 0) {
          const newOnes = items.map(h => fromOnline(h, collectionId));
          setHadiths(prev => {
            const source = attempt === 0 && base ? base : prev;
            // Avoid duplicates by number
            const existingNums = new Set(source.map(h => h.number));
            const unique = newOnes.filter(h => !existingNums.has(h.number));
            return unique.length ? [...source, ...unique] : source;
          });
          setCurrentPage(targetPage);
          if (targetPage >= lastPage) setAllPagesLoaded(true);
          return;
        }

        targetPage += 1;
      }

      // Nothing found from here on: mark the collection exhausted so the UI
      // stops offering "Load More".
      if (targetPage > lastPage) {
        setAllPagesLoaded(true);
      } else {
        setOnlineError(true);
      }
    } catch {
      setOnlineError(true);
    } finally {
      loadingRef.current = false;
      setLoadingOnline(false);
    }
  }, [collectionId]);

  // ── Search filter ─────────────────────────────────────────────────────────
  const displayHadiths = searchQuery.trim()
    ? hadiths.filter(h => {
        const q = searchQuery.toLowerCase();
        return (
          h.english.toLowerCase().includes(q) ||
          h.arabic.includes(q) ||
          h.narrator.toLowerCase().includes(q) ||
          h.bookName.toLowerCase().includes(q) ||
          h.reference.toLowerCase().includes(q) ||
          String(h.number).includes(q)
        );
      })
    : hadiths;

  // ── Actions ───────────────────────────────────────────────────────────────
  const shareHadith = useCallback(async (item: UnifiedHadith) => {
    const text = item.arabic
      ? `${item.arabic}\n\n"${item.english}"\n\n— ${item.narrator}\n${item.reference}`
      : `"${item.english}"\n\n— ${item.reference}`;
    await Share.share({ message: text });
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  // ── Render hadith card ─────────────────────────────────────────────────────
  const renderHadith = useCallback(({ item }: { item: UnifiedHadith }) => {
    const ref = `hadith_${collectionId}_${item.number}`;
    const bookmarked = isBookmarked(ref);
    const isExpanded = expandedId === item.id;

    const gradeColor =
      item.grade === 'Sahih' ? C.success
      : item.grade.startsWith('Hasan') ? C.gold
      : C.textMuted;

    return (
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        {/* Header */}
        <Pressable style={styles.cardHeader} onPress={() => toggleExpand(item.id)}>
          <View style={[styles.numBox, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}>
            <Text style={[styles.numText, { color: C.gold }]}>{item.number}</Text>
          </View>
          <View style={styles.cardMeta}>
            {item.chapterName ? (
              <Text style={[styles.chapterName, { color: C.textPrimary }]} numberOfLines={isExpanded ? undefined : 1}>
                {item.chapterName}
              </Text>
            ) : null}
            <Text style={[styles.bookName, { color: C.textMuted }]}>{item.bookName || item.reference}</Text>
          </View>
          <View style={styles.cardHeaderRight}>
            {item.grade !== 'Refer to source' ? (
              <View style={[styles.gradeBadge, { backgroundColor: `${gradeColor}15` }]}>
                <Text style={[styles.gradeText, { color: gradeColor }]}>{item.grade}</Text>
              </View>
            ) : null}
            <MaterialIcons
              name={isExpanded ? 'expand-less' : 'expand-more'}
              size={20}
              color={C.textMuted}
            />
          </View>
        </Pressable>

        {/* Arabic Text */}
        {item.arabic ? (
          <Text style={[styles.arabicText, { color: C.textArabic }]}>
            {item.arabic}
          </Text>
        ) : null}

        {/* English Translation */}
        <Text style={[styles.englishText, { color: C.textPrimary }]}>
          {item.english}
        </Text>

        {/* Expanded Details */}
        {isExpanded && (
          <View style={[styles.expandedDetails, { borderTopColor: C.divider }]}>
            {item.narrator && item.narrator !== '—' ? (
              <View style={styles.detailRow}>
                <MaterialIcons name="person" size={14} color={C.textMuted} />
                <Text style={[styles.detailText, { color: C.textMuted }]}>
                  Narrator: {item.narrator}
                </Text>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <MaterialIcons name="info-outline" size={14} color={C.textMuted} />
              <Text style={[styles.detailText, { color: C.textMuted }]}>
                {item.reference}
              </Text>
            </View>
            {item.source === 'online' ? (
              <View style={[styles.onlineBadge, { backgroundColor: `${C.info}10` }]}>
                <MaterialIcons name="wifi" size={11} color={C.info} />
                <Text style={[styles.onlineBadgeText, { color: C.info }]}>Loaded online</Text>
              </View>
            ) : (
              <View style={[styles.onlineBadge, { backgroundColor: `${C.success}10` }]}>
                <MaterialIcons name="offline-bolt" size={11} color={C.success} />
                <Text style={[styles.onlineBadgeText, { color: C.success }]}>Available offline</Text>
              </View>
            )}
          </View>
        )}

        {/* Action Row */}
        <View style={[styles.actionRow, { borderTopColor: C.divider }]}>
          <Pressable
            style={styles.actionBtn}
            onPress={() =>
              bookmarked
                ? removeBookmark(ref)
                : addBookmark({
                    type: 'hadith',
                    reference: ref,
                    title: `${meta?.name || collectionId} #${item.number}`,
                    subtitle: item.english.substring(0, 80) + '...',
                    arabic: item.arabic,
                  })
            }
          >
            <MaterialIcons
              name={bookmarked ? 'bookmark' : 'bookmark-border'}
              size={18}
              color={bookmarked ? C.gold : C.textMuted}
            />
            <Text style={[styles.actionText, { color: C.textMuted }]}>
              {bookmarked ? 'Saved' : 'Bookmark'}
            </Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => shareHadith(item)}>
            <MaterialIcons name="share" size={18} color={C.textMuted} />
            <Text style={[styles.actionText, { color: C.textMuted }]}>Share</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => toggleExpand(item.id)}>
            <MaterialIcons name="info" size={18} color={C.textMuted} />
            <Text style={[styles.actionText, { color: C.textMuted }]}>
              {isExpanded ? 'Less' : 'Details'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }, [
    C, expandedId, collectionId, isBookmarked, addBookmark, removeBookmark,
    meta?.name, shareHadith, toggleExpand,
  ]);

  // ── Footer ─────────────────────────────────────────────────────────────────
  const renderFooter = () => {
    if (searchQuery.trim()) return null;

    if (loadingOnline) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={C.gold} />
          <Text style={[styles.footerText, { color: C.textMuted }]}>
            Loading from internet... ({hadiths.length.toLocaleString()} loaded)
          </Text>
        </View>
      );
    }
    if (onlineError && !allPagesLoaded) {
      return (
        <Pressable
          style={[styles.retryBtn, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}
          onPress={() => loadNextPage(currentPage + 1, hadiths)}
        >
          <MaterialIcons name="refresh" size={16} color={C.gold} />
          <Text style={[styles.retryText, { color: C.gold }]}>Retry online load</Text>
        </Pressable>
      );
    }
    if (!allPagesLoaded && hasOnlineSource) {
      return (
        <Pressable
          style={[styles.loadMoreBtn, { backgroundColor: `${C.primary}15`, borderColor: `${C.primary}30` }]}
          onPress={() => loadNextPage(currentPage + 1)}
        >
          <MaterialIcons name="download" size={16} color={C.gold} />
          <Text style={[styles.loadMoreText, { color: C.gold }]}>
            Load More ({hadiths.length.toLocaleString()} / {knownTotal.toLocaleString()})
          </Text>
        </Pressable>
      );
    }
    if (allPagesLoaded) {
      return (
        <View style={[styles.allLoadedBanner, { backgroundColor: `${C.success}10`, borderColor: `${C.success}20` }]}>
          <MaterialIcons name="check-circle" size={16} color={C.success} />
          <Text style={[styles.allLoadedText, { color: C.success }]}>
            All {hadiths.length.toLocaleString()} hadiths loaded
          </Text>
        </View>
      );
    }
    return null;
  };

  // ── Header ─────────────────────────────────────────────────────────────────
  const renderListHeader = () => (
    <>
      <View style={[styles.offlineBanner, { backgroundColor: `${C.success}10`, borderColor: `${C.success}20` }]}>
        <MaterialIcons name="offline-bolt" size={14} color={C.success} />
        <Text style={[styles.offlineBannerText, { color: C.success }]}>
          {hadiths.filter(h => h.source === 'offline').length} verified hadiths available offline
          {hasOnlineSource ? ` · up to ${knownTotal.toLocaleString()} available online` : ''}
        </Text>
      </View>
      {searchQuery.trim() ? (
        <View style={[styles.searchResult, { backgroundColor: `${C.info}10` }]}>
          <MaterialIcons name="search" size={14} color={C.info} />
          <Text style={[styles.searchResultText, { color: C.info }]}>
            {displayHadiths.length} result{displayHadiths.length !== 1 ? 's' : ''} for "{searchQuery}"
          </Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          {showSearch ? (
            <TextInput
              ref={searchRef}
              style={[styles.searchInput, { color: C.textPrimary, backgroundColor: `${C.textPrimary}15` }]}
              placeholder="Search hadiths..."
              placeholderTextColor={`${C.textPrimary}60`}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: C.textPrimary }]}>
                {meta?.name || collectionId}
              </Text>
              <Text style={[styles.headerArabic, { color: C.gold }]}>{meta?.arabicName}</Text>
            </View>
          )}
          <View style={styles.headerActions}>
            <Pressable
              style={styles.iconBtn}
              onPress={() => {
                setShowSearch(s => !s);
                if (showSearch) setSearchQuery('');
              }}
            >
              <MaterialIcons
                name={showSearch ? 'close' : 'search'}
                size={22}
                color={C.textPrimary}
              />
            </Pressable>
            {!showSearch && (
              <View style={[styles.countBadge, { backgroundColor: `${C.gold}20` }]}>
                <Text style={[styles.countText, { color: C.gold }]}>
                  {hadiths.length.toLocaleString()}
                </Text>
                <Text style={[styles.countLabel, { color: C.textMuted }]}>loaded</Text>
              </View>
            )}
          </View>
        </View>

        {/* Scholar Info */}
        {meta && !showSearch && (
          <View style={[styles.scholarCard, { backgroundColor: `${C.gold}10`, borderColor: `${C.gold}20` }]}>
            <MaterialIcons name="person" size={14} color={C.gold} />
            <Text style={[styles.scholarText, { color: C.textSecondary }]} numberOfLines={2}>
              {meta.scholar}
            </Text>
            {hasOnlineSource && (
              <View style={[styles.onlineTag, { backgroundColor: `${C.info}20` }]}>
                <MaterialIcons name="cloud-download" size={11} color={C.info} />
                <Text style={[styles.onlineTagText, { color: C.info }]}>
                  {knownTotal.toLocaleString()} total
                </Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>

      {/* List */}
      {displayHadiths.length === 0 && !loadingOnline ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons
            name={searchQuery.trim() ? 'search-off' : 'library-books'}
            size={56}
            color={C.textMuted}
          />
          <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>
            {searchQuery.trim() ? 'No Results Found' : onlineError ? 'Unable to Load Collection' : 'Loading Collection...'}
          </Text>
          <Text style={[styles.emptyDesc, { color: C.textMuted }]}>
            {searchQuery.trim()
              ? 'Try different keywords or load more hadiths first.'
              : onlineError
                ? 'The online sources are unavailable. Please check your connection and retry.'
                : 'Fetching from the online database. Please wait.'}
          </Text>
          {onlineError && hasOnlineSource ? (
            <Pressable
              style={[styles.retryBtn, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}
              onPress={() => loadNextPage(currentPage + 1)}
            >
              <MaterialIcons name="refresh" size={16} color={C.gold} />
              <Text style={[styles.retryText, { color: C.gold }]}>Retry online load</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={displayHadiths}
          renderItem={renderHadith}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={renderFooter}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: 4,
    marginBottom: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerArabic: { fontSize: 16, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchInput: {
    flex: 1, height: 40, borderRadius: 12, paddingHorizontal: 12,
    fontSize: 15, marginRight: 4,
  },
  countBadge: { alignItems: 'center', padding: 8, borderRadius: Radius.md, minWidth: 56 },
  countText: { fontSize: 16, fontWeight: '800' },
  countLabel: { fontSize: 10, marginTop: 1 },
  scholarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  scholarText: { flex: 1, fontSize: 12, lineHeight: 18 },
  onlineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  onlineTagText: { fontSize: 10, fontWeight: '600' },

  list: { padding: Spacing.md },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  offlineBannerText: { fontSize: 12, fontWeight: '600', flex: 1 },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  searchResultText: { fontSize: 12, fontWeight: '600' },

  card: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  numBox: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, flexShrink: 0,
  },
  numText: { fontSize: 12, fontWeight: '700' },
  cardMeta: { flex: 1 },
  chapterName: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  bookName: { fontSize: 11, marginTop: 2 },
  cardHeaderRight: { alignItems: 'flex-end', gap: 4 },
  gradeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  gradeText: { fontSize: 10, fontWeight: '700' },

  arabicText: {
    fontSize: 20, textAlign: 'right', lineHeight: 40,
    paddingHorizontal: 12, paddingBottom: 8, writingDirection: 'rtl',
  },
  englishText: {
    fontSize: 15, lineHeight: 26, paddingHorizontal: 12, paddingBottom: 12, fontStyle: 'italic',
  },

  expandedDetails: { borderTopWidth: 1, padding: 12, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  detailText: { fontSize: 12, lineHeight: 18, flex: 1 },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  onlineBadgeText: { fontSize: 10, fontWeight: '600' },

  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    padding: 8,
    gap: 4,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4, paddingVertical: 6,
  },
  actionText: { fontSize: 12 },

  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  footerText: { fontSize: 12 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    margin: 16,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  retryText: { fontSize: 13, fontWeight: '600' },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    margin: 16,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  loadMoreText: { fontSize: 13, fontWeight: '600' },
  allLoadedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    margin: 16,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  allLoadedText: { fontSize: 13, fontWeight: '600' },

  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl, gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
