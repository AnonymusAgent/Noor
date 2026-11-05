/**
 * Quran Comparison Mode — View 2-3 translations side-by-side with
 * synchronized parallel scrolling and verse highlighting.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  ScrollView, Modal, FlatList, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { SURAH_LIST, TRANSLATIONS } from '../constants/quranData';
import { fetchSurah } from '../services/quranService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TranslationData {
  id: string;
  name: string;
  flag: string;
  ayahs: { numberInSurah: number; text: string }[];
}

const SUPPORTED_TRANSLATIONS = TRANSLATIONS.filter(t =>
  ['en.sahih', 'en.pickthall', 'en.yusufali', 'ur.jalandhry', 'ur.ahmedali'].includes(t.id)
);

export default function QuranComparisonScreen() {
  const { surah: surahParam } = useLocalSearchParams<{ surah?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C } = useApp();

  const [surahNum, setSurahNum] = useState(parseInt(surahParam || '1', 10));
  const [activeTranslations, setActiveTranslations] = useState<string[]>([
    'en.sahih', 'en.pickthall',
  ]);
  const [arabicData, setArabicData] = useState<{ numberInSurah: number; text: string }[]>([]);
  const [translationData, setTranslationData] = useState<TranslationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [showSurahPicker, setShowSurahPicker] = useState(false);
  const [showTransPicker, setShowTransPicker] = useState(false);
  const syncedScrollY = useRef(0);

  const scrollRefs = useRef<(ScrollView | null)[]>([]);
  const isScrolling = useRef<boolean[]>([false, false, false]);

  const surahMeta = SURAH_LIST[surahNum - 1];

  useEffect(() => {
    loadData();
    // `loadData` is recreated each render by design (it closes over the current
    // selection); keying the effect on its inputs is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahNum, activeTranslations]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [arabic, ...translations] = await Promise.all([
        fetchSurah(surahNum, 'quran-uthmani'),
        ...activeTranslations.map(t => fetchSurah(surahNum, t)),
      ]);

      setArabicData(arabic.ayahs.map(a => ({ numberInSurah: a.numberInSurah, text: a.text })));

      const transData: TranslationData[] = activeTranslations.map((id, i) => {
        const meta = SUPPORTED_TRANSLATIONS.find(t => t.id === id) || SUPPORTED_TRANSLATIONS[0];
        return {
          id,
          name: meta.name,
          flag: meta.flag,
          ayahs: translations[i].ayahs.map(a => ({ numberInSurah: a.numberInSurah, text: a.text })),
        };
      });

      setTranslationData(transData);
    } catch {
      setError('Failed to load translations. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = useCallback((sourceIndex: number, y: number) => {
    syncedScrollY.current = y;
    scrollRefs.current.forEach((ref, i) => {
      if (i !== sourceIndex && ref && !isScrolling.current[i]) {
        isScrolling.current[i] = true;
        ref.scrollTo({ y, animated: false });
        setTimeout(() => { isScrolling.current[i] = false; }, 50);
      }
    });
  }, []);

  const toggleTranslation = (id: string) => {
    if (activeTranslations.includes(id)) {
      if (activeTranslations.length <= 2) return; // Minimum 2
      setActiveTranslations(activeTranslations.filter(t => t !== id));
    } else {
      if (activeTranslations.length >= 3) return; // Maximum 3
      setActiveTranslations([...activeTranslations, id]);
    }
  };

  const colWidth = (SCREEN_WIDTH - Spacing.md * 2) / (activeTranslations.length + 1);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: C.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={[styles.loadText, { color: C.textSecondary }]}>
          Loading {surahMeta?.transliteration} with {activeTranslations.length} translations...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: C.background, paddingTop: insets.top }]}>
        <MaterialIcons name="error-outline" size={48} color={C.error} />
        <Text style={[styles.errorText, { color: C.error }]}>{error}</Text>
        <Pressable style={[styles.retryBtn, { backgroundColor: C.primary }]} onPress={loadData}>
          <Text style={[styles.retryText, { color: C.gold }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

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
          <Pressable
            style={[styles.surahSelector, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}
            onPress={() => setShowSurahPicker(true)}
          >
            <Text style={[styles.surahSelectorText, { color: C.gold }]}>{surahMeta?.transliteration}</Text>
            <MaterialIcons name="arrow-drop-down" size={18} color={C.gold} />
          </Pressable>
          <Pressable
            style={[styles.transBtn, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}
            onPress={() => setShowTransPicker(true)}
          >
            <MaterialIcons name="compare-arrows" size={16} color={C.gold} />
            <Text style={[styles.transBtnText, { color: C.gold }]}>{activeTranslations.length} Trans</Text>
          </Pressable>
        </View>

        {/* Column Headers */}
        <View style={styles.columnHeaders}>
          {/* Arabic header */}
          <View style={[styles.colHeader, { width: colWidth, backgroundColor: `${C.gold}15` }]}>
            <Text style={[styles.colHeaderText, { color: C.gold }]}>العربية</Text>
            <Text style={[styles.colHeaderSub, { color: C.textMuted }]}>Arabic</Text>
          </View>

          {/* Translation headers */}
          {translationData.map(t => (
            <View
              key={t.id}
              style={[styles.colHeader, { width: colWidth, backgroundColor: `${C.primary}30` }]}
            >
              <Text style={styles.colHeaderFlag}>{t.flag}</Text>
              <Text style={[styles.colHeaderText, { color: C.textPrimary }]} numberOfLines={1}>
                {t.name.split(' ').slice(0, 2).join(' ')}
              </Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Comparison Grid */}
      <View style={styles.grid}>
        {/* Arabic Column */}
        <View style={{ width: colWidth }}>
          <ScrollView
            ref={r => { scrollRefs.current[0] = r; }}
            showsVerticalScrollIndicator={false}
            onScroll={e => handleScroll(0, e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
          >
            {arabicData.map((ayah, i) => (
              <Pressable
                key={ayah.numberInSurah}
                style={[
                  styles.cell,
                  styles.arabicCell,
                  { borderBottomColor: C.cardBorder, borderRightColor: `${C.gold}20` },
                  selectedVerse === ayah.numberInSurah && [
                    styles.selectedCell,
                    { backgroundColor: `${C.gold}10` },
                  ],
                  i === 0 && surahNum !== 9 && styles.firstCellBismillah,
                ]}
                onPress={() => setSelectedVerse(
                  selectedVerse === ayah.numberInSurah ? null : ayah.numberInSurah
                )}
              >
                <View style={[styles.verseNumBadge, { backgroundColor: `${C.gold}20` }]}>
                  <Text style={[styles.verseNumText, { color: C.gold }]}>{ayah.numberInSurah}</Text>
                </View>
                <Text style={[styles.arabicText, { color: C.textArabic }]}>{ayah.text}</Text>
              </Pressable>
            ))}
            <View style={{ height: 100 }} />
          </ScrollView>
        </View>

        {/* Translation Columns */}
        {translationData.map((trans, ti) => (
          <View key={trans.id} style={{ width: colWidth }}>
            <ScrollView
              ref={r => { scrollRefs.current[ti + 1] = r; }}
              showsVerticalScrollIndicator={false}
              onScroll={e => handleScroll(ti + 1, e.nativeEvent.contentOffset.y)}
              scrollEventThrottle={16}
            >
              {trans.ayahs.map((ayah, i) => (
                <Pressable
                  key={ayah.numberInSurah}
                  style={[
                    styles.cell,
                    styles.translationCell,
                    { borderBottomColor: C.cardBorder, borderRightColor: C.divider },
                    selectedVerse === ayah.numberInSurah && [
                      styles.selectedCell,
                      { backgroundColor: `${C.gold}10` },
                    ],
                  ]}
                  onPress={() => setSelectedVerse(
                    selectedVerse === ayah.numberInSurah ? null : ayah.numberInSurah
                  )}
                >
                  <Text style={[styles.translationText, { color: C.textSecondary }]}>
                    {ayah.text}
                  </Text>
                </Pressable>
              ))}
              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        ))}
      </View>

      {/* Highlighted Verse Reference */}
      {selectedVerse !== null && (
        <View style={[styles.verseRef, { backgroundColor: C.card, borderTopColor: C.cardBorder }]}>
          <MaterialIcons name="info-outline" size={14} color={C.gold} />
          <Text style={[styles.verseRefText, { color: C.textMuted }]}>
            {surahMeta?.transliteration} {surahNum}:{selectedVerse} — {surahMeta?.englishName}
          </Text>
          <Pressable onPress={() => setSelectedVerse(null)}>
            <MaterialIcons name="close" size={16} color={C.textMuted} />
          </Pressable>
        </View>
      )}

      {/* Surah Picker Modal */}
      <Modal visible={showSurahPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: C.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: C.textPrimary }]}>Select Surah</Text>
              <Pressable onPress={() => setShowSurahPicker(false)}>
                <MaterialIcons name="close" size={24} color={C.textPrimary} />
              </Pressable>
            </View>
            <FlatList
              data={SURAH_LIST}
              keyExtractor={item => String(item.number)}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.surahPickerItem,
                    { borderBottomColor: C.divider },
                    surahNum === item.number && { backgroundColor: `${C.gold}10` },
                  ]}
                  onPress={() => {
                    setSurahNum(item.number);
                    setShowSurahPicker(false);
                  }}
                >
                  <View style={[styles.surahPickerNum, { backgroundColor: `${C.gold}15` }]}>
                    <Text style={[styles.surahPickerNumText, { color: C.gold }]}>{item.number}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.surahPickerName, { color: C.textPrimary }]}>{item.transliteration}</Text>
                    <Text style={[styles.surahPickerMeta, { color: C.textMuted }]}>
                      {item.versesCount} verses · {item.revelationType}
                    </Text>
                  </View>
                  <Text style={[styles.surahPickerArabic, { color: C.textArabic }]}>{item.arabicName}</Text>
                  {surahNum === item.number && <MaterialIcons name="check" size={18} color={C.gold} />}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Translation Picker Modal */}
      <Modal visible={showTransPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: C.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: C.textPrimary }]}>
                Compare Translations (2–3)
              </Text>
              <Pressable onPress={() => setShowTransPicker(false)}>
                <MaterialIcons name="close" size={24} color={C.textPrimary} />
              </Pressable>
            </View>
            <Text style={[styles.transPickerNote, { color: C.textMuted }]}>
              Select 2 or 3 translations to compare side-by-side.
            </Text>
            {SUPPORTED_TRANSLATIONS.map(t => {
              const isActive = activeTranslations.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  style={[
                    styles.transPickerItem,
                    { borderBottomColor: C.divider },
                    isActive && { backgroundColor: `${C.gold}10` },
                  ]}
                  onPress={() => toggleTranslation(t.id)}
                >
                  <Text style={styles.transPickerFlag}>{t.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.transPickerName, { color: C.textPrimary }]}>{t.name}</Text>
                    <Text style={[styles.transPickerLang, { color: C.textMuted }]}>{t.language}</Text>
                  </View>
                  <View style={[
                    styles.checkbox,
                    { borderColor: isActive ? C.gold : C.textMuted },
                    isActive && { backgroundColor: C.gold },
                  ]}>
                    {isActive && <MaterialIcons name="check" size={14} color={C.primaryDark} />}
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.applyBtn, { backgroundColor: C.gold }]}
              onPress={() => setShowTransPicker(false)}
            >
              <Text style={[styles.applyBtnText, { color: C.primaryDark }]}>
                Apply ({activeTranslations.length} selected)
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: Radius.md },
  retryText: { fontWeight: '600' },

  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: 4,
    marginBottom: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  surahSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.round,
    borderWidth: 1,
  },
  surahSelectorText: { fontSize: 14, fontWeight: '700' },
  transBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.round,
    borderWidth: 1,
  },
  transBtnText: { fontSize: 12, fontWeight: '600' },

  columnHeaders: { flexDirection: 'row', gap: 4 },
  colHeader: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: Radius.sm,
    gap: 2,
  },
  colHeaderFlag: { fontSize: 16 },
  colHeaderText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  colHeaderSub: { fontSize: 9, textAlign: 'center' },

  grid: { flex: 1, flexDirection: 'row' },
  cell: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    padding: 10,
    minHeight: 80,
  },
  arabicCell: { alignItems: 'flex-end' },
  translationCell: {},
  selectedCell: {},
  firstCellBismillah: { paddingTop: 12 },
  verseNumBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  verseNumText: { fontSize: 11, fontWeight: '700' },
  arabicText: {
    fontSize: 18,
    lineHeight: 32,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontWeight: '400',
  },
  translationText: { fontSize: 12, lineHeight: 20 },

  verseRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  verseRefText: { flex: 1, fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.md },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },

  surahPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  surahPickerNum: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  surahPickerNumText: { fontSize: 12, fontWeight: '700' },
  surahPickerName: { fontSize: 14, fontWeight: '600' },
  surahPickerMeta: { fontSize: 11, marginTop: 1 },
  surahPickerArabic: { fontSize: 16 },

  transPickerNote: { fontSize: 13, marginBottom: Spacing.sm, paddingHorizontal: 4 },
  transPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  transPickerFlag: { fontSize: 20, width: 28 },
  transPickerName: { fontSize: 14, fontWeight: '600' },
  transPickerLang: { fontSize: 12, marginTop: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtn: {
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  applyBtnText: { fontSize: 16, fontWeight: '700' },
});
