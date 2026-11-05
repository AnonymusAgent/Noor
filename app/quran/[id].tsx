import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Share, Modal, ScrollView, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radius } from '../../constants/theme';
import { useSurah } from '../../hooks/useQuran';
import { useApp } from '../../contexts/AppContext';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { SURAH_LIST, RECITERS, TRANSLATIONS } from '../../constants/quranData';
import { fetchWordByWord, WordByWordEntry } from '../../services/quranService';

const TOGGLE_OPTIONS: { key: 'showTranslation' | 'showTransliteration' | 'showWordByWord'; label: string }[] = [
  { key: 'showTranslation', label: 'Show Translation' },
  { key: 'showTransliteration', label: 'Show Transliteration' },
  { key: 'showWordByWord', label: 'Word-by-Word Mode' },
];

const HIGHLIGHT_BG: Record<string, string> = {
  yellow: 'rgba(255,215,0,0.15)',
  green: 'rgba(76,175,80,0.15)',
  blue: 'rgba(33,150,243,0.15)',
  red: 'rgba(244,67,54,0.15)',
};
const HIGHLIGHT_BORDER: Record<string, string> = {
  yellow: 'rgba(255,215,0,0.5)',
  green: 'rgba(76,175,80,0.5)',
  blue: 'rgba(33,150,243,0.5)',
  red: 'rgba(244,67,54,0.5)',
};
const HIGHLIGHT_SOLID: Record<string, string> = {
  yellow: '#FFD700', green: '#4CAF50', blue: '#2196F3', red: '#F44336',
};

// A pragmatic subset of the Tajweed rules that matter most for recitation:
// ghunna (نّ/مّ), qalqalah letters and madd elongation. Colouring these spans is
// enough to guide the eye without shipping a full tajweed text corpus.
const TAJWEED_RULES: { name: string; colorKey: 'tajweedGhunna' | 'tajweedMadd' | 'tajweedQalqalah'; pattern: RegExp }[] = [
  { name: 'ghunna', colorKey: 'tajweedGhunna', pattern: /[نم]ّ/g },
  // Madd: the elongation letters carrying hamza/maddah, plus a standing fatha.
  { name: 'madd', colorKey: 'tajweedMadd', pattern: /[آإأؤئٰ]|\u0653/g },
  { name: 'qalqalah', colorKey: 'tajweedQalqalah', pattern: /[قطبجد]/g },
];

interface TajweedSegment { text: string; colorKey?: string }

function segmentTajweed(text: string): TajweedSegment[] {
  const marks = new Array<{ start: number; end: number; colorKey: string }>();

  for (const rule of TAJWEED_RULES) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(text)) !== null) {
      if (match[0].length === 0) { rule.pattern.lastIndex += 1; continue; }
      const start = match.index;
      const end = start + match[0].length;
      // First matching rule wins, so ranges never overlap.
      if (marks.some(m => start < m.end && end > m.start)) continue;
      marks.push({ start, end, colorKey: rule.colorKey });
    }
  }

  if (marks.length === 0) return [{ text }];

  marks.sort((a, b) => a.start - b.start);
  const segments: TajweedSegment[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start > cursor) segments.push({ text: text.slice(cursor, mark.start) });
    segments.push({ text: text.slice(mark.start, mark.end), colorKey: mark.colorKey });
    cursor = mark.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

export default function SurahScreen() {
  // `ayah` is set when arriving from a bookmark, so the reader can jump
  // straight to the saved verse instead of opening at verse 1.
  const { id, ayah: ayahParam } = useLocalSearchParams<{ id: string; ayah?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const surahNum = parseInt(id || '1', 10);
  const surahMeta = SURAH_LIST[surahNum - 1];

  const { settings, updateSettings, addBookmark, removeBookmark, isBookmarked, setLastRead, updateReadingProgress, colors: C, addHighlight, removeHighlight, getHighlight, addNote } = useApp();
  const { playSurah, isPlaying: globalIsPlaying, nowPlaying, togglePlayPause } = useAudioPlayer();
  const { data, loading, error, reload } = useSurah(surahNum, settings.selectedTranslation);

  const [highlightPickerAyah, setHighlightPickerAyah] = useState<number | null>(null);
  const [noteInputAyah, setNoteInputAyah] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const [currentAyah, setCurrentAyah] = useState<number | null>(null);
  const flatListRef = useRef<FlatList<any>>(null);

  // Keep the highlight on the ayah the reader last interacted with, and restore
  // the saved position when the surah opens.
  useEffect(() => {
    const lastAyah = settings.readingProgress?.[surahNum];
    setCurrentAyah(lastAyah && lastAyah > 0 ? lastAyah : null);
  }, [surahNum, settings.readingProgress]);

  const scrollToAyah = useCallback((ayahNumber: number) => {
    if (!data?.arabic?.ayahs?.length) return;
    const index = data.arabic.ayahs.findIndex(a => a.numberInSurah === ayahNumber);
    if (index < 0) return;
    // A FlatList cannot scroll before its first layout pass.
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
    });
  }, [data]);

  // Jump to the ayah requested by a deep link / bookmark once the verses exist.
  useEffect(() => {
    const target = pendingAyah.current;
    if (!target || !data?.arabic?.ayahs?.length) return;
    pendingAyah.current = null;
    setSelectedAyah(target);
    setCurrentAyah(target);
    scrollToAyah(target);
  }, [data, scrollToAyah]);
  const [selectedAyah, setSelectedAyah] = useState<number | null>(null);
  const pendingAyah = useRef<number | null>(
    ayahParam && Number(ayahParam) > 0 ? Number(ayahParam) : null,
  );
  const [wordByWordData, setWordByWordData] = useState<Record<number, WordByWordEntry[]>>({});
  const [loadingWBW, setLoadingWBW] = useState<number | null>(null);
  const [wbwError, setWbwError] = useState<string | null>(null);

  // Derived: is this surah playing via the global player?
  const isThisSurahPlaying = globalIsPlaying && nowPlaying?.surahNumber === surahNum;
  const isPlaying = isThisSurahPlaying;
  const audioLoading = false; // Global player handles loading state

  const totalAyahs = data?.arabic?.ayahs?.length || surahMeta?.versesCount || 1;
  const progress = settings.readingProgress?.[surahNum] || 0;
  const progressPct = Math.round((progress / totalAyahs) * 100);

  const bookmarkRef = `quran_${surahNum}`;
  const bookmarked = isBookmarked(bookmarkRef);

  const toggleBookmark = () => {
    if (bookmarked) {
      removeBookmark(bookmarkRef);
    } else {
      addBookmark({
        type: 'quran',
        reference: bookmarkRef,
        title: surahMeta?.transliteration || `Surah ${surahNum}`,
        subtitle: surahMeta?.arabicName,
        arabic: surahMeta?.arabicName,
      });
    }
  };

  const loadWordByWord = useCallback(async (ayahNum: number) => {
    if (wordByWordData[ayahNum] || loadingWBW === ayahNum) return;
    setLoadingWBW(ayahNum);
    setWbwError(null);
    try {
      const words = await fetchWordByWord(surahNum, ayahNum);
      // Cache even an empty result so we do not hammer the API on every tap.
      setWordByWordData(prev => ({ ...prev, [ayahNum]: words }));
      if (words.length === 0) {
        setWbwError('Word-by-word data is unavailable for this verse. Check your connection and tap to retry.');
      }
    } catch {
      setWbwError('Could not load word-by-word. Tap to retry.');
    } finally {
      setLoadingWBW(null);
    }
  }, [wordByWordData, loadingWBW, surahNum]);

  const playAudio = async () => {
    if (isThisSurahPlaying) {
      await togglePlayPause();
    } else {
      await playSurah(surahNum, settings.selectedReciter);
    }
  };

  const shareAyah = useCallback(async (ayahNum: number) => {
    const ayah = data?.arabic?.ayahs[ayahNum - 1];
    const translation = data?.translation?.ayahs[ayahNum - 1];
    if (!ayah) return;
    const text = `${ayah.text}\n\n"${translation?.text || ''}"\n\n— Quran ${surahNum}:${ayahNum} (${surahMeta?.englishName})`;
    await Share.share({ message: text });
  }, [data, surahNum, surahMeta?.englishName]);

  const bookmarkAyah = useCallback((ayahNum: number) => {
    const ref = `quran_${surahNum}_${ayahNum}`;
    if (isBookmarked(ref)) {
      removeBookmark(ref);
    } else {
      addBookmark({
        type: 'quran',
        reference: ref,
        title: `${surahMeta?.transliteration} ${surahNum}:${ayahNum}`,
        subtitle: data?.arabic?.ayahs[ayahNum - 1]?.text?.substring(0, 50) + '...',
      });
    }
    updateReadingProgress(surahNum, ayahNum, totalAyahs);
  }, [
    isBookmarked, addBookmark, removeBookmark, updateReadingProgress,
    surahNum, surahMeta?.transliteration, data, totalAyahs,
  ]);

  const renderAyah = useCallback(({ item, index }: { item: any; index: number }) => {
    const ayahNum = item.numberInSurah;
    const translation = data?.translation?.ayahs[index];
    const isSelected = selectedAyah === ayahNum;
    const isActive = currentAyah === ayahNum;
    const ayahBookmarked = isBookmarked(`quran_${surahNum}_${ayahNum}`);
    const wbwData = wordByWordData[ayahNum];
    const showWBW = settings.showWordByWord && isSelected;
    const highlight = getHighlight(surahNum, ayahNum);
    const hlBg = highlight ? HIGHLIGHT_BG[highlight.color] : undefined;
    const hlBorder = highlight ? HIGHLIGHT_BORDER[highlight.color] : undefined;
    const hlSolid = highlight ? HIGHLIGHT_SOLID[highlight.color] : undefined;

    return (
      <Pressable
        style={[
          styles.ayahContainer,
          { borderBottomColor: C.cardBorder },
          isSelected && [styles.ayahSelected, { backgroundColor: `${C.gold}08` }],
          isActive && [styles.ayahActive, { backgroundColor: `${C.primary}20` }],
          hlBg && { backgroundColor: hlBg, borderLeftWidth: 3, borderLeftColor: hlBorder },
        ]}
        onPress={() => {
          setSelectedAyah(isSelected ? null : ayahNum);
          setCurrentAyah(ayahNum);
          if (!isSelected && settings.showWordByWord) loadWordByWord(ayahNum);
          updateReadingProgress(surahNum, ayahNum, totalAyahs);
        }}
        onLongPress={() => bookmarkAyah(ayahNum)}
      >
        {/* Verse number row */}
        <View style={styles.ayahHeader}>
          <View style={[styles.verseNumber, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}>
            <Text style={[styles.verseNumberText, { color: C.gold }]}>{ayahNum}</Text>
          </View>
          <View style={styles.verseActions}>
            {item.sajda && (
              <View style={[styles.sajdaBadge, { backgroundColor: `${C.sajdah}20`, borderColor: `${C.sajdah}40` }]}>
                <Text style={[styles.sajdaText, { color: C.sajdah }]}>Sajdah</Text>
              </View>
            )}
            {item.hizbQuarter && item.hizbQuarter % 4 === 1 && (
              <View style={[styles.hizbBadge, { backgroundColor: `${C.hizb}20` }]}>
                <Text style={[styles.hizbText, { color: C.hizb }]}>Hizb</Text>
              </View>
            )}
          </View>
        </View>

        {/* Arabic Text */}
        <Text style={[styles.arabicText, { fontSize: settings.arabicFontSize, color: C.textArabic }]}>
          {settings.showTajweed
            ? segmentTajweed(item.text ?? '').map((segment, si) => (
                <Text
                  key={si}
                  style={segment.colorKey ? { color: (C as unknown as Record<string, string>)[segment.colorKey] } : undefined}
                >
                  {segment.text}
                </Text>
              ))
            : item.text}
        </Text>

        {/* Word by Word Mode */}
        {showWBW && (
          <View style={styles.wbwContainer}>
            {loadingWBW === ayahNum ? (
              <View style={styles.wbwLoading}>
                <ActivityIndicator size="small" color={C.gold} />
                <Text style={[styles.wbwLoadingText, { color: C.textMuted }]}>Loading words…</Text>
              </View>
            ) : wbwData && wbwData.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.wbwRow}>
                  {/* `arabic`, `transliteration` and `translation` are always
                      strings here — the service normalises Quran.com's nested
                      objects, which used to crash this screen. */}
                  {wbwData.map((word, wi) => (
                    <View
                      key={`${ayahNum}-${word.position}-${wi}`}
                      style={[styles.wbwWord, { backgroundColor: `${C.primary}20`, borderColor: C.cardBorder }]}
                    >
                      <Text style={[styles.wbwArabic, { color: C.textArabic }]}>{word.arabic}</Text>
                      {!!word.transliteration && (
                        <Text style={[styles.wbwTranslit, { color: C.textMuted }]}>{word.transliteration}</Text>
                      )}
                      {!!word.translation && (
                        <Text style={[styles.wbwMeaning, { color: C.gold }]}>{word.translation}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <Pressable
                onPress={() => {
                  // Clear the cached empty result so the retry actually refetches.
                  setWordByWordData(prev => {
                    const next = { ...prev };
                    delete next[ayahNum];
                    return next;
                  });
                  loadWordByWord(ayahNum);
                }}
                style={[styles.wbwLoad, { borderColor: `${C.gold}30` }]}
              >
                <MaterialIcons name="refresh" size={14} color={C.gold} />
                <Text style={[styles.wbwLoadText, { color: C.gold }]}>
                  {wbwError ? 'Retry word-by-word' : 'Load Word-by-Word'}
                </Text>
              </Pressable>
            )}
            {!!wbwError && !(wbwData && wbwData.length > 0) && (
              <Text style={[styles.wbwErrorText, { color: C.warning }]}>{wbwError}</Text>
            )}
          </View>
        )}

        {/* Transliteration */}
        {settings.showTransliteration && (
          <Text style={[styles.translitText, { color: C.textMuted }]}>
            [{ayahNum}] {surahMeta?.transliteration} — Verse {ayahNum}
          </Text>
        )}

        {/* Translation */}
        {settings.showTranslation && translation && (
          <Text style={[styles.translationText, { fontSize: settings.translationFontSize, color: C.textSecondary }]}>
            {translation.text}
          </Text>
        )}

        {/* Selected Actions */}
        {isSelected && (
          <View style={[styles.ayahActions, { borderTopColor: C.cardBorder }]}>
            <Pressable style={styles.ayahActionBtn} onPress={() => bookmarkAyah(ayahNum)}>
              <MaterialIcons
                name={ayahBookmarked ? 'bookmark' : 'bookmark-border'}
                size={18}
                color={ayahBookmarked ? C.gold : C.textMuted}
              />
              <Text style={[styles.ayahActionText, { color: C.textMuted }]}>Bookmark</Text>
            </Pressable>
            <Pressable style={styles.ayahActionBtn} onPress={() => shareAyah(ayahNum)}>
              <MaterialIcons name="share" size={18} color={C.textMuted} />
              <Text style={[styles.ayahActionText, { color: C.textMuted }]}>Share</Text>
            </Pressable>
            <Pressable
              style={styles.ayahActionBtn}
              onPress={() => {
                // Toggling this off should not leave the words on screen; the
                // disabled state is what reveals the per-ayah control.
                if (!settings.showWordByWord) loadWordByWord(ayahNum);
                updateSettings({ showWordByWord: !settings.showWordByWord });
              }}
            >
              <MaterialIcons
                name="view-column"
                size={18}
                color={settings.showWordByWord ? C.gold : C.textMuted}
              />
              <Text style={[styles.ayahActionText, { color: settings.showWordByWord ? C.gold : C.textMuted }]}>
                Word×Word
              </Text>
            </Pressable>
            <Pressable style={styles.ayahActionBtn} onPress={() => setLastRead({ surahNumber: surahNum, ayahNumber: ayahNum })}>
              <MaterialIcons name="flag" size={18} color={C.textMuted} />
              <Text style={[styles.ayahActionText, { color: C.textMuted }]}>Mark</Text>
            </Pressable>
            <Pressable style={styles.ayahActionBtn} onPress={() => { setNoteInputAyah(ayahNum); setNoteText(''); setNoteTags(''); }}>
              <MaterialIcons name="note-add" size={18} color={C.textMuted} />
              <Text style={[styles.ayahActionText, { color: C.textMuted }]}>Note</Text>
            </Pressable>
            <Pressable style={styles.ayahActionBtn} onPress={() => setHighlightPickerAyah(ayahNum)}>
              <MaterialIcons name="format-color-fill" size={18} color={hlSolid || C.textMuted} />
              <Text style={[styles.ayahActionText, { color: hlSolid || C.textMuted }]}>
                {highlight ? 'Highlighted' : 'Highlight'}
              </Text>
            </Pressable>
            <Pressable style={styles.ayahActionBtn} onPress={() => router.push(`/tafsir/${surahNum}` as any)}>
              <MaterialIcons name="menu-book" size={18} color={C.textMuted} />
              <Text style={[styles.ayahActionText, { color: C.textMuted }]}>Tafsir</Text>
            </Pressable>
            <Pressable style={styles.ayahActionBtn} onPress={() => router.push({ pathname: '/quran-comparison', params: { surah: String(surahNum) } } as any)}>
              <MaterialIcons name="compare-arrows" size={18} color={C.textMuted} />
              <Text style={[styles.ayahActionText, { color: C.textMuted }]}>Compare</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  }, [
    data, settings, selectedAyah, currentAyah, wordByWordData, loadingWBW, wbwError, C,
    getHighlight, isBookmarked, updateReadingProgress, loadWordByWord, router,
    setLastRead, shareAyah, bookmarkAyah, surahNum, surahMeta?.transliteration,
    totalAyahs, updateSettings, setWordByWordData,
  ]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={[styles.loadingText, { color: C.textSecondary }]}>Loading {surahMeta?.transliteration}...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, backgroundColor: C.background }]}>
        <MaterialIcons name="error-outline" size={48} color={C.error} />
        <Text style={[styles.errorText, { color: C.error }]}>{error}</Text>
        <Pressable style={[styles.retryBtn, { backgroundColor: C.primary }]} onPress={reload}>
          <Text style={[styles.retryText, { color: C.gold }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.navBar, { borderBottomColor: C.cardBorder }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.navBtn}>
          <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
        </Pressable>
        <View style={styles.navCenter}>
          <Text style={[styles.navTitle, { color: C.textPrimary }]}>{surahMeta?.transliteration}</Text>
          <Text style={[styles.navSubtitle, { color: C.gold }]}>{surahMeta?.arabicName}</Text>
        </View>
        <View style={styles.navActions}>
          <Pressable onPress={toggleBookmark} style={styles.navBtn}>
            <MaterialIcons name={bookmarked ? 'bookmark' : 'bookmark-border'} size={22} color={bookmarked ? C.gold : C.textPrimary} />
          </Pressable>
          <Pressable onPress={() => setShowSettings(true)} style={styles.navBtn}>
            <MaterialIcons name="tune" size={22} color={C.textPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Reading Progress Bar */}
      {progress > 0 && (
        <View style={[styles.progressBar, { backgroundColor: C.cardBorder }]}>
          <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: C.gold }]} />
          <Text style={[styles.progressText, { color: C.textMuted }]}>{progressPct}% read</Text>
        </View>
      )}

      {/* Surah Info Banner */}
      <View style={[styles.surahBanner, { backgroundColor: C.primaryDark, borderBottomColor: `${C.gold}20` }]}>
        <Text style={[styles.surahBannerName, { color: C.gold }]}>{surahMeta?.arabicName}</Text>
        <View style={styles.surahBannerMeta}>
          <Text style={[styles.surahBannerInfo, { color: C.textSecondary }]}>{surahMeta?.revelationType}</Text>
          <Text style={[styles.surahBannerDot, { color: C.textMuted }]}>·</Text>
          <Text style={[styles.surahBannerInfo, { color: C.textSecondary }]}>{surahMeta?.versesCount} Verses</Text>
          <Text style={[styles.surahBannerDot, { color: C.textMuted }]}>·</Text>
          <Text style={[styles.surahBannerInfo, { color: C.textSecondary }]}>Juz {surahMeta?.juzStart}</Text>
        </View>
        {surahNum !== 9 && (
          <Text style={[styles.bismillah, { color: C.textArabic }]}>
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </Text>
        )}
      </View>

      {/* Verses */}
      <FlatList
        ref={flatListRef}
        data={data?.arabic?.ayahs || []}
        renderItem={renderAyah}
        keyExtractor={item => String(item.numberInSurah)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        extraData={selectedAyah}
        onScrollToIndexFailed={({ index }) => {
          // Long surahs are virtualised; fall back to an approximate offset.
          flatListRef.current?.scrollToOffset({ offset: index * 120, animated: true });
        }}
        ListHeaderComponent={
          currentAyah && currentAyah > 1 ? (
            <Pressable
              style={[styles.resumeBar, { backgroundColor: `${C.gold}12`, borderColor: `${C.gold}25` }]}
              onPress={() => scrollToAyah(currentAyah)}
            >
              <MaterialIcons name="bookmark" size={14} color={C.gold} />
              <Text style={[styles.resumeText, { color: C.gold }]}>
                Continue from ayah {currentAyah}
              </Text>
            </Pressable>
          ) : null
        }
      />

      {/* Audio Player Bar */}
      <View style={[styles.audioBar, { paddingBottom: insets.bottom + 8, backgroundColor: C.surface, borderTopColor: C.cardBorder }]}>
        <Pressable onPress={() => surahNum > 1 && router.push(`/quran/${surahNum - 1}` as any)} style={styles.audioBtn}>
          <MaterialIcons name="skip-previous" size={22} color={C.textSecondary} />
        </Pressable>
        <Pressable onPress={playAudio} style={[styles.audioPlayBtn, { backgroundColor: C.gold }]}>
          {audioLoading ? (
            <ActivityIndicator size="small" color={C.primaryDark} />
          ) : (
            <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={28} color={C.primaryDark} />
          )}
        </Pressable>
        <Pressable onPress={() => surahNum < 114 && router.push(`/quran/${surahNum + 1}` as any)} style={styles.audioBtn}>
          <MaterialIcons name="skip-next" size={22} color={C.textSecondary} />
        </Pressable>
        <View style={styles.recitersInfo}>
          <Text style={[styles.reciterName, { color: C.textSecondary }]}>
            {RECITERS.find(r => r.id === settings.selectedReciter)?.name || 'Alafasy'}
          </Text>
          {isPlaying && <Text style={[styles.playingLabel, { color: C.gold }]}>▶ Playing</Text>}
        </View>
      </View>

      {/* ── Highlight Picker Modal ───────────────────────────────────────── */}
      <Modal visible={highlightPickerAyah !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setHighlightPickerAyah(null)}>
          <View style={[styles.highlightPickerBox, { backgroundColor: C.surface }]}>
            <Text style={[styles.highlightPickerTitle, { color: C.textPrimary }]}>Highlight Verse</Text>
            <View style={styles.highlightColors}>
              {(['yellow', 'green', 'blue', 'red'] as const).map(color => (
                <Pressable
                  key={color}
                  style={[styles.highlightColorBtn, { backgroundColor: HIGHLIGHT_BG[color], borderColor: HIGHLIGHT_BORDER[color] }]}
                  onPress={() => {
                    if (highlightPickerAyah) {
                      const existing = getHighlight(surahNum, highlightPickerAyah);
                      if (existing?.color === color) {
                        removeHighlight(surahNum, highlightPickerAyah);
                      } else {
                        addHighlight({
                          surahNumber: surahNum,
                          ayahNumber: highlightPickerAyah,
                          color,
                          verseText: data?.translation?.ayahs[(highlightPickerAyah ?? 1) - 1]?.text,
                        });
                      }
                    }
                    setHighlightPickerAyah(null);
                  }}
                >
                  <View style={[styles.highlightColorDot, { backgroundColor: HIGHLIGHT_SOLID[color] }]} />
                  <Text style={[styles.highlightColorLabel, { color: C.textSecondary }]}>
                    {color.charAt(0).toUpperCase() + color.slice(1)}
                  </Text>
                  {highlightPickerAyah && getHighlight(surahNum, highlightPickerAyah)?.color === color && (
                    <MaterialIcons name="check" size={14} color={HIGHLIGHT_SOLID[color]} />
                  )}
                </Pressable>
              ))}
            </View>
            {highlightPickerAyah && getHighlight(surahNum, highlightPickerAyah) && (
              <Pressable
                style={[styles.removeHighlightBtn, { borderColor: C.error }]}
                onPress={() => {
                  if (highlightPickerAyah) removeHighlight(surahNum, highlightPickerAyah);
                  setHighlightPickerAyah(null);
                }}
              >
                <MaterialIcons name="highlight-off" size={16} color={C.error} />
                <Text style={[styles.removeHighlightText, { color: C.error }]}>Remove Highlight</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* ── Note Input Modal ──────────────────────────────────────────────── */}
      <Modal visible={noteInputAyah !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.noteModalBox, { backgroundColor: C.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: C.textPrimary }]}>
                Note — {surahMeta?.transliteration} {surahNum}:{noteInputAyah}
              </Text>
              <Pressable onPress={() => setNoteInputAyah(null)}>
                <MaterialIcons name="close" size={22} color={C.textPrimary} />
              </Pressable>
            </View>
            <TextInput
              style={[styles.noteTextArea, { color: C.textPrimary, backgroundColor: C.card, borderColor: C.cardBorder }]}
              placeholder="Write your note or reflection..."
              placeholderTextColor={C.textMuted}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
            <TextInput
              style={[styles.noteTagInput, { color: C.textPrimary, backgroundColor: C.card, borderColor: C.cardBorder }]}
              placeholder="Tags (comma-separated): faith, patience..."
              placeholderTextColor={C.textMuted}
              value={noteTags}
              onChangeText={setNoteTags}
            />
            <View style={styles.noteModalBtns}>
              <Pressable
                style={[styles.noteModalCancel, { backgroundColor: C.card, borderColor: C.cardBorder }]}
                onPress={() => setNoteInputAyah(null)}
              >
                <Text style={[styles.noteModalCancelText, { color: C.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.noteModalSave, { backgroundColor: C.gold }]}
                onPress={() => {
                  if (noteText.trim() && noteInputAyah) {
                    addNote({
                      type: 'quran',
                      reference: `quran_${surahNum}_${noteInputAyah}`,
                      content: noteText.trim(),
                      tags: noteTags.trim() ? noteTags.split(',').map(t => t.trim()).filter(Boolean) : [],
                      surahNumber: surahNum,
                      ayahNumber: noteInputAyah,
                    });
                  }
                  setNoteInputAyah(null);
                }}
              >
                <MaterialIcons name="save" size={16} color={C.primaryDark} />
                <Text style={[styles.noteModalSaveText, { color: C.primaryDark }]}>Save Note</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: C.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: C.textPrimary }]}>Reading Settings</Text>
              <Pressable onPress={() => setShowSettings(false)}>
                <MaterialIcons name="close" size={24} color={C.textPrimary} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.settingsScroll}
              contentContainerStyle={styles.settingsScrollContent}
            >
              {/* Font Size */}
              <Text style={[styles.settingLabel, { color: C.textMuted }]}>Arabic Font Size: {settings.arabicFontSize}px</Text>
              <View style={styles.sliderRow}>
                {[18, 22, 26, 30, 36].map(size => (
                  <Pressable
                    key={size}
                    style={[styles.sizeBtn, { backgroundColor: C.card, borderColor: C.cardBorder }, settings.arabicFontSize === size && [styles.sizeBtnActive, { backgroundColor: C.gold, borderColor: C.gold }]]}
                    onPress={() => updateSettings({ arabicFontSize: size })}
                  >
                    <Text style={[styles.sizeBtnText, { color: C.textSecondary }, settings.arabicFontSize === size && [styles.sizeBtnTextActive, { color: C.primaryDark }]]}>
                      {size}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Toggle Options */}
              {TOGGLE_OPTIONS.map(opt => {
                const enabled = Boolean(settings[opt.key]);
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.toggleRow, { borderBottomColor: C.cardBorder }]}
                    onPress={() => updateSettings({ [opt.key]: !enabled })}
                  >
                    <Text style={[styles.toggleLabel, { color: C.textPrimary }]}>{opt.label}</Text>
                    <View style={[styles.toggle, { backgroundColor: C.cardBorder }, enabled && [styles.toggleOn, { backgroundColor: C.gold }]]}>
                      <View style={[styles.toggleThumb, { backgroundColor: C.textMuted }, enabled && [styles.toggleThumbOn, { backgroundColor: C.primaryDark }]]} />
                    </View>
                  </Pressable>
                );
              })}

              {/* Reciter Selection */}
              <Text style={[styles.settingLabel, { color: C.textMuted }]}>Reciter</Text>
              {RECITERS.map(r => (
                <Pressable
                  key={r.id}
                  style={[styles.reciterItem, { backgroundColor: C.card, borderColor: C.cardBorder }, settings.selectedReciter === r.id && [styles.reciterItemActive, { borderColor: C.gold, backgroundColor: `${C.gold}10` }]]}
                  onPress={() => updateSettings({ selectedReciter: r.id })}
                >
                  <Text style={[styles.reciterItemText, { flex: 1, color: C.textPrimary }, settings.selectedReciter === r.id && [styles.reciterItemTextActive, { color: C.gold }]]}>
                    {r.name}
                  </Text>
                  <Text style={[styles.reciterStyle, { color: C.textMuted }]}>{r.style}</Text>
                  {settings.selectedReciter === r.id && (
                    <MaterialIcons name="check" size={16} color={C.gold} />
                  )}
                </Pressable>
              ))}

              {/* Translation Selection */}
              <Text style={[styles.settingLabel, { color: C.textMuted }]}>Translation</Text>
              {TRANSLATIONS.slice(0, 6).map(t => (
                <Pressable
                  key={t.id}
                  style={[styles.reciterItem, { backgroundColor: C.card, borderColor: C.cardBorder }, settings.selectedTranslation === t.id && [styles.reciterItemActive, { borderColor: C.gold, backgroundColor: `${C.gold}10` }]]}
                  onPress={() => updateSettings({ selectedTranslation: t.id })}
                >
                  <Text style={styles.reciterStyle}>{t.flag}</Text>
                  <Text style={[styles.reciterItemText, { flex: 1, color: C.textPrimary }, settings.selectedTranslation === t.id && [styles.reciterItemTextActive, { color: C.gold }]]}>
                    {t.name}
                  </Text>
                  {settings.selectedTranslation === t.id && (
                    <MaterialIcons name="check" size={16} color={C.gold} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Without a bounded height the settings ScrollView expands forever and the
  // last options (translation list) can never be reached.
  settingsScroll: { flex: 1 },
  settingsScrollContent: { paddingBottom: Spacing.xl },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15 },
  errorText: { fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: Radius.md },
  retryText: { fontWeight: '600' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle: { fontSize: 16, fontWeight: '700' },
  navSubtitle: { fontSize: 14 },
  navActions: { flexDirection: 'row' },
  progressBar: {
    height: 4,
    position: 'relative',
  },
  progressFill: { height: '100%' },
  progressText: {
    position: 'absolute',
    right: 8,
    top: -18,
    fontSize: 11,
  },
  surahBanner: {
    padding: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  surahBannerName: { fontSize: 28, fontWeight: '400' },
  surahBannerMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  surahBannerInfo: { fontSize: 12 },
  surahBannerDot: { fontSize: 12 },
  bismillah: { fontSize: 22, marginTop: Spacing.md, fontWeight: '400' },
  resumeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  resumeText: { fontSize: 12, fontWeight: '600' },
  listContent: { paddingBottom: 100 },
  ayahContainer: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  ayahSelected: {},
  ayahActive: {},
  ayahHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: 8,
  },
  verseNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  verseNumberText: { fontSize: 12, fontWeight: '700' },
  verseActions: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sajdaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  sajdaText: { fontSize: 10, fontWeight: '600' },
  hizbBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  hizbText: { fontSize: 10, fontWeight: '600' },
  arabicText: {
    textAlign: 'right',
    lineHeight: 50,
    fontWeight: '400',
    writingDirection: 'rtl',
  },
  wbwContainer: {
    marginVertical: Spacing.sm,
    paddingVertical: 4,
  },
  wbwRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  wbwWord: {
    alignItems: 'center',
    padding: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    minWidth: 60,
  },
  wbwArabic: { fontSize: 18, textAlign: 'center' },
  wbwTranslit: { fontSize: 10, textAlign: 'center', marginTop: 2, fontStyle: 'italic' },
  wbwMeaning: { fontSize: 10, textAlign: 'center', marginTop: 2, fontWeight: '600' },
  wbwLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  wbwLoadingText: { fontSize: 12 },
  wbwErrorText: { fontSize: 11, marginTop: 6, lineHeight: 15 },
  wbwLoad: {
    padding: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  wbwLoadText: { fontSize: 13, fontWeight: '500' },
  translitText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 20,
  },
  translationText: { lineHeight: 24, marginTop: 6 },
  ayahActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    flexWrap: 'wrap',
  },
  ayahActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ayahActionText: { fontSize: 12 },
  audioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  audioBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  audioPlayBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recitersInfo: { flex: 1 },
  reciterName: { fontSize: 13, fontWeight: '500' },
  playingLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.md,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  settingLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sliderRow: { flexDirection: 'row', gap: 8 },
  sizeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  sizeBtnActive: {},
  sizeBtnText: { fontSize: 13, fontWeight: '500' },
  sizeBtnTextActive: { fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  toggleLabel: { fontSize: 15 },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    padding: 2,
  },
  toggleOn: {},
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  reciterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.md,
    marginBottom: 6,
    borderWidth: 1,
    gap: 8,
  },
  reciterItemActive: {},
  reciterItemText: {},
  reciterItemTextActive: {},
  reciterStyle: { fontSize: 12 },

  // Highlight picker
  highlightPickerBox: {
    margin: 40,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  highlightPickerTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  highlightColors: { flexDirection: 'row', gap: 8 },
  highlightColorBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    gap: 5,
  },
  highlightColorDot: { width: 20, height: 20, borderRadius: 10 },
  highlightColorLabel: { fontSize: 11, fontWeight: '600' },
  removeHighlightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  removeHighlightText: { fontSize: 13, fontWeight: '600' },

  // Note modal
  noteModalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.md,
  },
  noteTextArea: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    marginBottom: Spacing.sm,
  },
  noteTagInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  noteModalBtns: { flexDirection: 'row', gap: 10, marginBottom: Spacing.sm },
  noteModalCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  noteModalCancelText: { fontSize: 14, fontWeight: '600' },
  noteModalSave: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  noteModalSaveText: { fontSize: 14, fontWeight: '700' },
});
