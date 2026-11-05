/**
 * Tafsir Screen — Per-verse Tafsir Ibn Kathir with expand/collapse, offline cache,
 * copy, share, bookmark, and font size controls.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Share, Alert, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { SURAH_LIST } from '../../constants/quranData';
import { fetchSurah } from '../../services/quranService';
import { getTafsirFromCache, saveTafsirToCache } from '../../services/tafsirCacheService';

const TAFSIR_EDITIONS = [
  { id: 'en.ibn-katheer', name: 'Ibn Kathir (English)', lang: 'English', scholar: 'Ibn Kathir' },
  { id: 'en.maarifulquran', name: "Maariful Quran", lang: 'English', scholar: 'Mufti Shafi Usmani' },
  { id: 'ur.maududi', name: 'Tafhim ul Quran', lang: 'Urdu', scholar: 'Maududi' },
];

interface TafsirAyah {
  numberInSurah: number;
  arabicText: string;
  tafsirText: string;
}

interface LoadState {
  loading: boolean;
  error: string | null;
  data: TafsirAyah[];
}

export default function TafsirScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, addBookmark, isBookmarked, removeBookmark } = useApp();

  const surahNum = parseInt(id || '1', 10);
  const surahMeta = SURAH_LIST[surahNum - 1];

  const [state, setState] = useState<LoadState>({ loading: true, error: null, data: [] });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedEdition, setSelectedEdition] = useState(TAFSIR_EDITIONS[0].id);
  const [tafsirFontSize, setTafsirFontSize] = useState(14);
  const [showEditionPicker, setShowEditionPicker] = useState(false);
  const [offlineBadge, setOfflineBadge] = useState(false);

  const loadTafsir = useCallback(async () => {
    setState({ loading: true, error: null, data: [] });

    // 1. Try tafsirCacheService (pre-cached top surahs)
    const serviceCache = await getTafsirFromCache(surahNum, selectedEdition);
    if (serviceCache && serviceCache.length > 0) {
      setState({ loading: false, error: null, data: serviceCache });
      setOfflineBadge(true);
      return;
    }

    try {
      const [arabicData, tafsirData] = await Promise.all([
        fetchSurah(surahNum, 'quran-uthmani'),
        fetchSurah(surahNum, selectedEdition),
      ]);

      const merged: TafsirAyah[] = arabicData.ayahs.map((ayah, i) => ({
        numberInSurah: ayah.numberInSurah,
        arabicText: ayah.text,
        tafsirText: tafsirData.ayahs[i]?.text || '',
      }));

      // Cache so the surah opens offline next time.
      await saveTafsirToCache(surahNum, selectedEdition, merged);
      setState({ loading: false, error: null, data: merged });
      setOfflineBadge(false);
    } catch {
      setState({ loading: false, error: 'Failed to load Tafsir. Check your connection and try again.', data: [] });
    }
  }, [surahNum, selectedEdition]);

  useEffect(() => {
    loadTafsir();
  }, [loadTafsir]);

  const toggleExpand = useCallback((num: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }, []);

  const shareAyah = useCallback(async (ayah: TafsirAyah) => {
    const editionName = TAFSIR_EDITIONS.find(e => e.id === selectedEdition)?.name || 'Tafsir';
    const text = `${ayah.arabicText}\n\nTafsir (${editionName}):\n${ayah.tafsirText.slice(0, 600)}${ayah.tafsirText.length > 600 ? '...' : ''}\n\n— Quran ${surahNum}:${ayah.numberInSurah}`;
    await Share.share({ message: text });
  }, [selectedEdition, surahNum]);

  const copyAyah = useCallback(async (ayah: TafsirAyah) => {
    const text = `${ayah.arabicText}\n\n${ayah.tafsirText}`;
    try {
      // `Clipboard` was removed from react-native core; Share is the portable
      // way to hand the text to the OS clipboard/notes without a new dependency.
      await Share.share({ message: text });
    } catch {
      Alert.alert('Unable to copy', 'Please try again.');
    }
  }, []);

  const bookmarkAyah = useCallback((ayah: TafsirAyah) => {
    const ref = `tafsir_${surahNum}_${ayah.numberInSurah}`;
    if (isBookmarked(ref)) {
      removeBookmark(ref);
    } else {
      addBookmark({
        type: 'quran',
        reference: ref,
        title: `Tafsir ${surahMeta?.transliteration} ${surahNum}:${ayah.numberInSurah}`,
        subtitle: ayah.tafsirText.slice(0, 80) + '...',
        arabic: ayah.arabicText,
      });
    }
  }, [addBookmark, isBookmarked, removeBookmark, surahMeta?.transliteration, surahNum]);

  const expandAll = () => {
    setExpanded(new Set(state.data.map(a => a.numberInSurah)));
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  const renderAyah = useCallback(({ item }: { item: TafsirAyah }) => {
    const isExpanded = expanded.has(item.numberInSurah);
    const ref = `tafsir_${surahNum}_${item.numberInSurah}`;
    const bookmarked = isBookmarked(ref);
    const editionInfo = TAFSIR_EDITIONS.find(e => e.id === selectedEdition);

    return (
      <View style={[styles.ayahCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        {/* Verse number + Arabic */}
        <Pressable
          style={styles.ayahHeader}
          onPress={() => toggleExpand(item.numberInSurah)}
        >
          <View style={[styles.verseNum, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}>
            <Text style={[styles.verseNumText, { color: C.gold }]}>{item.numberInSurah}</Text>
          </View>
          <Text style={[styles.arabicText, { color: C.textArabic, flex: 1 }]}>
            {item.arabicText}
          </Text>
          <MaterialIcons
            name={isExpanded ? 'expand-less' : 'expand-more'}
            size={22}
            color={C.textMuted}
          />
        </Pressable>

        {/* Tafsir Content */}
        {isExpanded && (
          <View style={[styles.tafsirBody, { borderTopColor: C.cardBorder }]}>
            <View style={[styles.tafsirBadge, { backgroundColor: `${C.primary}20` }]}>
              <MaterialIcons name="menu-book" size={12} color={C.gold} />
              <Text style={[styles.tafsirBadgeText, { color: C.gold }]}>
                {editionInfo?.scholar} — {editionInfo?.lang}
              </Text>
            </View>

            <Text
              style={[styles.tafsirText, { color: C.textSecondary, fontSize: tafsirFontSize, lineHeight: tafsirFontSize * 1.7 }]}
              selectable
            >
              {item.tafsirText || 'Tafsir not available for this verse in the selected edition.'}
            </Text>

            {/* Action Row */}
            <View style={[styles.actionRow, { borderTopColor: C.divider }]}>
              <Pressable style={styles.actionBtn} onPress={() => bookmarkAyah(item)}>
                <MaterialIcons
                  name={bookmarked ? 'bookmark' : 'bookmark-border'}
                  size={18}
                  color={bookmarked ? C.gold : C.textMuted}
                />
                <Text style={[styles.actionText, { color: C.textMuted }]}>
                  {bookmarked ? 'Saved' : 'Bookmark'}
                </Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => copyAyah(item)}>
                <MaterialIcons name="content-copy" size={18} color={C.textMuted} />
                <Text style={[styles.actionText, { color: C.textMuted }]}>Copy</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => shareAyah(item)}>
                <MaterialIcons name="share" size={18} color={C.textMuted} />
                <Text style={[styles.actionText, { color: C.textMuted }]}>Share</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  }, [
    C,
    bookmarkAyah,
    copyAyah,
    expanded,
    isBookmarked,
    selectedEdition,
    shareAyah,
    surahNum,
    tafsirFontSize,
    toggleExpand,
  ]);

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>
              Tafsir — {surahMeta?.transliteration}
            </Text>
            <Text style={[styles.headerSub, { color: C.gold }]}>{surahMeta?.arabicName}</Text>
          </View>
          {offlineBadge && (
            <View style={[styles.offlineBadge, { backgroundColor: `${C.success}25` }]}>
              <MaterialIcons name="offline-bolt" size={12} color={C.success} />
              <Text style={[styles.offlineBadgeText, { color: C.success }]}>Cached</Text>
            </View>
          )}
        </View>

        {/* Controls Row */}
        <View style={styles.controlsRow}>
          {/* Edition Picker */}
          <Pressable
            style={[styles.editionBtn, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}
            onPress={() => setShowEditionPicker(true)}
          >
            <MaterialIcons name="menu-book" size={14} color={C.gold} />
            <Text style={[styles.editionBtnText, { color: C.gold }]} numberOfLines={1}>
              {TAFSIR_EDITIONS.find(e => e.id === selectedEdition)?.scholar}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={16} color={C.gold} />
          </Pressable>

          {/* Font Controls */}
          <View style={styles.fontControls}>
            <Pressable
              style={[styles.fontBtn, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}25` }]}
              onPress={() => setTafsirFontSize(f => Math.max(11, f - 1))}
            >
              <Text style={[styles.fontBtnText, { color: C.gold }]}>A-</Text>
            </Pressable>
            <Text style={[styles.fontSizeLabel, { color: C.textMuted }]}>{tafsirFontSize}</Text>
            <Pressable
              style={[styles.fontBtn, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}25` }]}
              onPress={() => setTafsirFontSize(f => Math.min(22, f + 1))}
            >
              <Text style={[styles.fontBtnText, { color: C.gold }]}>A+</Text>
            </Pressable>
          </View>

          {/* Expand/Collapse All */}
          <Pressable
            style={[styles.expandBtn, { backgroundColor: `${C.info}15`, borderColor: `${C.info}25` }]}
            onPress={expanded.size > 0 ? collapseAll : expandAll}
          >
            <MaterialIcons
              name={expanded.size > 0 ? 'unfold-less' : 'unfold-more'}
              size={16}
              color={C.info}
            />
            <Text style={[styles.expandBtnText, { color: C.info }]}>
              {expanded.size > 0 ? 'Collapse' : 'Expand All'}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Content */}
      {state.loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={[styles.loadText, { color: C.textSecondary }]}>
            Loading Tafsir {surahMeta?.transliteration}...
          </Text>
        </View>
      ) : state.error ? (
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={48} color={C.error} />
          <Text style={[styles.errorText, { color: C.error }]}>{state.error}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: C.primary }]} onPress={loadTafsir}>
            <Text style={[styles.retryText, { color: C.gold }]}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={state.data}
          keyExtractor={item => String(item.numberInSurah)}
          renderItem={renderAyah}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListHeaderComponent={
            <View style={[styles.surahInfo, { backgroundColor: `${C.primary}20`, borderColor: `${C.gold}20` }]}>
              <Text style={[styles.surahInfoTitle, { color: C.textPrimary }]}>
                {surahMeta?.englishName} · {surahMeta?.versesCount} Verses · {surahMeta?.revelationType}
              </Text>
              <Text style={[styles.surahInfoDesc, { color: C.textMuted }]}>
                Tap any verse to read its Tafsir. Long-press to bookmark.
              </Text>
            </View>
          }
        />
      )}

      {/* Edition Picker Modal */}
      <Modal visible={showEditionPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: C.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: C.textPrimary }]}>Choose Tafsir Source</Text>
              <Pressable onPress={() => setShowEditionPicker(false)}>
                <MaterialIcons name="close" size={24} color={C.textPrimary} />
              </Pressable>
            </View>
            {TAFSIR_EDITIONS.map((edition, i) => (
              <Pressable
                key={edition.id}
                style={[
                  styles.editionOption,
                  { borderBottomColor: C.divider },
                  selectedEdition === edition.id && { backgroundColor: `${C.gold}10` },
                ]}
                onPress={() => {
                  setSelectedEdition(edition.id);
                  setShowEditionPicker(false);
                  setExpanded(new Set());
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editionName, { color: C.textPrimary }]}>{edition.name}</Text>
                  <Text style={[styles.editionScholar, { color: C.textMuted }]}>
                    {edition.scholar} · {edition.lang}
                  </Text>
                </View>
                {selectedEdition === edition.id && (
                  <MaterialIcons name="check-circle" size={22} color={C.gold} />
                )}
              </Pressable>
            ))}
            <View style={[styles.cacheNote, { backgroundColor: `${C.info}10`, borderColor: `${C.info}20` }]}>
              <MaterialIcons name="info-outline" size={14} color={C.info} />
              <Text style={[styles.cacheNoteText, { color: C.textMuted }]}>
                Tafsir data is cached offline after first load.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadText: { fontSize: 15 },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: Radius.md, marginTop: 4 },
  retryText: { fontWeight: '600' },

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
  headerSub: { fontSize: 14, marginTop: 1 },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.round,
  },
  offlineBadgeText: { fontSize: 11, fontWeight: '600' },

  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.round,
    borderWidth: 1,
  },
  editionBtnText: { fontSize: 12, fontWeight: '600', flex: 1 },
  fontControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fontBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  fontBtnText: { fontSize: 12, fontWeight: '700' },
  fontSizeLabel: { fontSize: 11, minWidth: 20, textAlign: 'center' },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.round,
    borderWidth: 1,
  },
  expandBtnText: { fontSize: 12, fontWeight: '600' },

  list: { padding: Spacing.md, paddingBottom: 100 },
  surahInfo: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  surahInfoTitle: { fontSize: 14, fontWeight: '600' },
  surahInfoDesc: { fontSize: 12, marginTop: 4 },

  ayahCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ayahHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  verseNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
    marginTop: 4,
  },
  verseNumText: { fontSize: 12, fontWeight: '700' },
  arabicText: { fontSize: 20, textAlign: 'right', lineHeight: 36, writingDirection: 'rtl' },

  tafsirBody: { borderTopWidth: 1, padding: 12 },
  tafsirBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.round,
    marginBottom: Spacing.sm,
  },
  tafsirBadgeText: { fontSize: 11, fontWeight: '600' },
  tafsirText: { lineHeight: 26 },

  actionRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.md },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  editionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  editionName: { fontSize: 15, fontWeight: '600' },
  editionScholar: { fontSize: 12, marginTop: 2 },
  cacheNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cacheNoteText: { flex: 1, fontSize: 12 },
});
