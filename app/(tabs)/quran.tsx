import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radius } from '../../constants/theme';
import { SURAH_LIST } from '../../constants/quranData';
import { useApp } from '../../contexts/AppContext';

type FilterType = 'all' | 'meccan' | 'medinan';

export default function QuranScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, settings, updateSettings } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  // "Juz" browsing was advertised by the settings type (`quranViewMode`) but
  // never implemented; it is a first-class way to navigate the mushaf.
  const viewMode: 'surah' | 'juz' = settings.quranViewMode === 'page' ? 'surah' : (settings.quranViewMode ?? 'surah');
  const isJuzView = viewMode === 'juz';

  const juzGroups = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const juz = i + 1;
      // Surahs that *begin* in this juz, plus the one that contains its start.
      const starting = SURAH_LIST.filter(s => s.juzStart === juz);
      const startSurah = starting[0] ?? SURAH_LIST.find(s => s.juzStart > juz) ?? SURAH_LIST[0];
      return {
        juz,
        starting,
        startSurahNumber: startSurah.number,
        searchText: `${juz} ${starting.map(s => s.transliteration).join(' ')}`.toLowerCase(),
      };
    });
  }, []);

  const filteredJuz = useMemo(
    () => juzGroups.filter(g => !search || g.searchText.includes(search.toLowerCase())),
    [juzGroups, search],
  );

  const filtered = useMemo(() => {
    return SURAH_LIST.filter(s => {
      const matchesSearch = !search ||
        s.englishName.toLowerCase().includes(search.toLowerCase()) ||
        s.transliteration.toLowerCase().includes(search.toLowerCase()) ||
        s.arabicName.includes(search) ||
        String(s.number).includes(search);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'meccan' && s.revelationType === 'Meccan') ||
        (filter === 'medinan' && s.revelationType === 'Medinan');
      return matchesSearch && matchesFilter;
    });
  }, [search, filter]);

  const getProgress = (surahNum: number) => {
    const lastAyah = settings.readingProgress?.[surahNum] || 0;
    const total = SURAH_LIST[surahNum - 1]?.versesCount || 1;
    return lastAyah > 0 ? Math.round((lastAyah / total) * 100) : 0;
  };

  const renderSurah = ({ item }: { item: typeof SURAH_LIST[0] }) => {
    const progress = getProgress(item.number);
    return (
      <Pressable
        style={({ pressed }) => [styles.surahItem, { backgroundColor: pressed ? C.card : C.background }]}
        onPress={() => router.push(`/quran/${item.number}`)}
      >
        <View style={[styles.surahNumber, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}>
          <Text style={[styles.surahNumberText, { color: C.gold }]}>{item.number}</Text>
        </View>
        <View style={styles.surahInfo}>
          <View style={styles.surahRow}>
            <Text style={[styles.surahEnglish, { color: C.textPrimary }]}>{item.transliteration}</Text>
            <Text style={[styles.surahArabic, { color: C.textArabic }]}>{item.arabicName}</Text>
          </View>
          <View style={styles.surahMeta}>
            <View style={[styles.badge, { backgroundColor: item.revelationType === 'Meccan' ? `${C.gold}20` : `${C.info}20` }]}>
              <Text style={[styles.badgeText, { color: item.revelationType === 'Meccan' ? C.gold : C.info }]}>
                {item.revelationType}
              </Text>
            </View>
            <Text style={[styles.surahVersesText, { color: C.textMuted }]}>{item.versesCount} verses</Text>
            <Text style={[styles.surahJuz, { color: C.textMuted }]}>Juz {item.juzStart}</Text>
            {progress > 0 && (
              <View style={[styles.progressBadge, { backgroundColor: `${C.success}20` }]}>
                <Text style={[styles.progressText, { color: C.success }]}>{progress}%</Text>
              </View>
            )}
          </View>
          {progress > 0 && (
            <View style={[styles.miniProgress, { backgroundColor: C.cardBorder }]}>
              <View style={[styles.miniProgressFill, { width: `${progress}%`, backgroundColor: C.success }]} />
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const renderJuz = ({ item }: { item: typeof juzGroups[0] }) => {
    // Surahs that begin in this juz read better than a bare number.
    const label = item.starting.length > 0
      ? item.starting.map(s => s.transliteration).join(', ')
      : SURAH_LIST[item.startSurahNumber - 1]?.transliteration ?? '';
    // `pages` is the madani mushaf page range for the surah starting the juz.
    const firstPage = SURAH_LIST[item.startSurahNumber - 1]?.pages?.[0];
    return (
      <Pressable
        style={({ pressed }) => [styles.surahItem, { backgroundColor: pressed ? C.card : C.background }]}
        onPress={() => router.push(`/quran/${item.startSurahNumber}` as any)}
      >
        <View style={[styles.surahNumber, { backgroundColor: `${C.info}15`, borderColor: `${C.info}30` }]}>
          <Text style={[styles.surahNumberText, { color: C.info }]}>{item.juz}</Text>
        </View>
        <View style={styles.surahInfo}>
          <View style={styles.surahRow}>
            <Text style={[styles.surahEnglish, { color: C.textPrimary }]}>Juz {item.juz}</Text>
            <Text style={[styles.surahArabic, { color: C.textArabic }]}>الجزء {item.juz}</Text>
          </View>
          <View style={styles.surahMeta}>
            <Text style={[styles.surahVersesText, { color: C.textMuted }]} numberOfLines={1}>
              Starts at {label || 'the beginning'}
            </Text>
            {firstPage ? (
              <Text style={[styles.surahJuz, { color: C.textMuted }]}>Page {firstPage}</Text>
            ) : null}
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={C.textMuted} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: `${C.gold}20` }]}>
        <Text style={[styles.headerTitle, { color: C.gold }]}>القرآن الكريم</Text>
        <Text style={[styles.headerSubtitle, { color: C.textPrimary }]}>The Holy Quran</Text>
        <Text style={[styles.headerMeta, { color: C.textMuted }]}>114 Surahs · 6,236 Verses · 30 Juz</Text>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        <MaterialIcons name="search" size={20} color={C.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: C.textPrimary }]}
          placeholder="Search Surah by name or number..."
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={18} color={C.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {(['all', 'meccan', 'medinan'] as FilterType[]).map(f => (
          <Pressable
            key={f}
            style={[styles.filterBtn, { backgroundColor: C.card, borderColor: C.cardBorder }, filter === f && [styles.filterBtnActive, { backgroundColor: C.gold, borderColor: C.gold }]]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, { color: C.textSecondary }, filter === f && [styles.filterTextActive, { color: C.primaryDark }]]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.filterBtn, { backgroundColor: C.card, borderColor: C.cardBorder }, isJuzView && { backgroundColor: C.info, borderColor: C.info }]}
          onPress={() => updateSettings({ quranViewMode: isJuzView ? 'surah' : 'juz' })}
        >
          <Text style={[styles.filterText, { color: isJuzView ? C.textInverse : C.textSecondary }]}>
            {isJuzView ? 'Juz' : 'Surah'}
          </Text>
        </Pressable>
        <View style={styles.filterSpacer} />
        <Text style={[styles.filterCount, { color: C.textMuted }]}>
          {isJuzView ? `${filteredJuz.length} juz` : `${filtered.length} surahs`}
        </Text>
      </View>

      {/* Surah or Juz List */}
      {isJuzView ? (
        <FlatList
          data={filteredJuz}
          renderItem={renderJuz}
          keyExtractor={item => String(item.juz)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: C.cardBorder }]} />}
        />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderSurah}
          keyExtractor={item => String(item.number)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: C.cardBorder }]} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  headerSubtitle: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  headerMeta: { fontSize: 12, marginTop: 4 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.round,
    borderWidth: 1,
  },
  filterBtnActive: {},
  filterText: { fontSize: 13, fontWeight: '500' },
  filterTextActive: { fontWeight: '700' },
  filterSpacer: { flex: 1 },
  filterCount: { fontSize: 12 },
  listContent: { paddingBottom: 100 },
  surahItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  surahNumber: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
  },
  surahNumberText: { fontSize: 14, fontWeight: '700' },
  surahInfo: { flex: 1 },
  surahRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  surahEnglish: { fontSize: 16, fontWeight: '600' },
  surahArabic: { fontSize: 20, fontWeight: '400' },
  surahMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.round },
  badgeText: { fontSize: 10, fontWeight: '600' },
  surahVersesText: { fontSize: 12 },
  surahJuz: { fontSize: 12 },
  progressBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  progressText: { fontSize: 10, fontWeight: '700' },
  miniProgress: { height: 2, borderRadius: 1, marginTop: 4, overflow: 'hidden' },
  miniProgressFill: { height: '100%', borderRadius: 1 },
  separator: { height: 1, marginHorizontal: Spacing.md },
});
