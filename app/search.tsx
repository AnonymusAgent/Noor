import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, Pressable, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radius } from '../constants/theme';
import { useQuranSearch } from '../hooks/useQuran';
import { DUAS } from '../constants/duasData';
import { getAllOfflineHadiths, OfflineHadith } from '../constants/offlineHadithDb';
import { SAMPLE_HADITHS } from '../constants/hadithData';
import { useApp } from '../contexts/AppContext';

type SearchTab = 'quran' | 'hadith' | 'dua';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C } = useApp();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SearchTab>('quran');
  const { results: quranResults, loading, search } = useQuranSearch();

  // Search the full bundled hadith set, not just the handful of samples the
  // home screen shows — otherwise most hadiths were unsearchable here.
  const hadithResults = query.length > 2
    ? (() => {
        const q = query.toLowerCase();
        const bundled: OfflineHadith[] = getAllOfflineHadiths();
        const extras = SAMPLE_HADITHS.filter(
          sample => !bundled.some(h => h.collection === sample.collection && h.number === sample.hadithNumber)
        ).map<OfflineHadith>(sample => ({
          id: `${sample.collection}_${sample.hadithNumber}`,
          collection: sample.collection,
          number: sample.hadithNumber,
          bookName: sample.bookName,
          chapterName: sample.chapterName ?? '',
          arabic: sample.arabic ?? '',
          english: sample.english,
          narrator: sample.narrator,
          grade: sample.grade ?? '',
          reference: sample.reference ?? `${sample.bookName} ${sample.hadithNumber}`,
        }));

        return [...bundled, ...extras].filter(h =>
          h.english.toLowerCase().includes(q) ||
          h.arabic.includes(query) ||
          h.narrator.toLowerCase().includes(q) ||
          h.bookName.toLowerCase().includes(q)
        );
      })()
    : [];

  const duaResults = query.length > 2
    ? DUAS.filter(d =>
        d.title.toLowerCase().includes(query.toLowerCase()) ||
        d.translation.toLowerCase().includes(query.toLowerCase()) ||
        d.arabic.includes(query)
      )
    : [];

  const handleSearch = (text: string) => {
    setQuery(text);
    if (tab === 'quran' && text.length > 2) search(text);
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: C.cardBorder }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
        </Pressable>
        <View style={[styles.searchBar, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <MaterialIcons name="search" size={20} color={C.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: C.textPrimary }]}
            placeholder="Search Quran, Hadith, Duas..."
            placeholderTextColor={C.textMuted}
            value={query}
            onChangeText={handleSearch}
            autoFocus
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <MaterialIcons name="close" size={18} color={C.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={[styles.tabRow, { borderBottomColor: C.cardBorder }]}>
        {(['quran', 'hadith', 'dua'] as SearchTab[]).map(t => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && [styles.tabActive, { borderBottomColor: C.gold }]]}
            onPress={() => { setTab(t); if (t === 'quran' && query.length > 2) search(query); }}
          >
            <Text style={[styles.tabText, { color: tab === t ? C.gold : C.textMuted }, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'quran' && quranResults.length > 0 ? ` (${quranResults.length})` : ''}
              {t === 'hadith' && hadithResults.length > 0 ? ` (${hadithResults.length})` : ''}
              {t === 'dua' && duaResults.length > 0 ? ` (${duaResults.length})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.gold} />
          <Text style={[styles.loadingText, { color: C.textSecondary }]}>Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={tab === 'quran' ? quranResults : tab === 'hadith' ? hadithResults : duaResults}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (tab === 'quran') {
              return (
                <Pressable style={[styles.resultCard, { backgroundColor: C.card, borderColor: C.cardBorder }]} onPress={() => router.push(`/quran/${item.surah?.number || 1}` as any)}>
                  <View style={[styles.resultBadge, { backgroundColor: `${C.gold}15` }]}>
                    <Text style={[styles.resultBadgeText, { color: C.gold }]}>{item.surah?.number}:{item.numberInSurah}</Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={[styles.resultArabic, { color: C.textArabic }]} numberOfLines={2}>{item.text}</Text>
                    <Text style={[styles.resultMeta, { color: C.textMuted }]}>{item.surah?.englishName}</Text>
                  </View>
                </Pressable>
              );
            }
            if (tab === 'hadith') {
              const h = item as OfflineHadith;
              return (
                <Pressable style={[styles.resultCard, { backgroundColor: C.card, borderColor: C.cardBorder }]} onPress={() => router.push(`/hadith/${h.collection}` as any)}>
                  <View style={[styles.resultBadge, { backgroundColor: `${C.info}20` }]}>
                    <Text style={[styles.resultBadgeText, { color: C.info }]}>#{h.number}</Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={[styles.resultText, { color: C.textSecondary }]} numberOfLines={3}>{h.english}</Text>
                    <Text style={[styles.resultMeta, { color: C.textMuted }]}>{h.bookName} · {h.narrator}</Text>
                  </View>
                </Pressable>
              );
            }
            const d = item as typeof DUAS[0];
            return (
              <Pressable style={[styles.resultCard, { backgroundColor: C.card, borderColor: C.cardBorder }]} onPress={() => router.push(`/duas/${d.category}` as any)}>
                <View style={[styles.resultBadge, { backgroundColor: `${C.error}20` }]}>
                  <MaterialIcons name="favorite" size={16} color={C.error} />
                </View>
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultTitle, { color: C.textPrimary }]}>{d.title}</Text>
                  <Text style={[styles.resultArabic, { color: C.textArabic }]} numberOfLines={1}>{d.arabic}</Text>
                  <Text style={[styles.resultText, { color: C.textSecondary }]} numberOfLines={2}>{d.translation}</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            query.length === 0 ? (
              <View style={styles.emptyHint}>
                <MaterialIcons name="search" size={64} color={C.textMuted} />
                <Text style={[styles.emptyHintTitle, { color: C.textSecondary }]}>Search Islamic Content</Text>
                <Text style={[styles.emptyHintText, { color: C.textMuted }]}>Search for Quran verses, hadith, and duas in Arabic or English.</Text>
                <View style={styles.suggestions}>
                  {['mercy', 'patience', 'prayer', 'forgiveness'].map(s => (
                    <Pressable key={s} style={[styles.suggestion, { backgroundColor: C.card, borderColor: C.cardBorder }]} onPress={() => { setQuery(s); if (tab === 'quran') search(s); }}>
                      <Text style={[styles.suggestionText, { color: C.gold }]}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyHint}>
                <Text style={[styles.emptyHintTitle, { color: C.textSecondary }]}>No results for "{query}"</Text>
                <Text style={[styles.emptyHintText, { color: C.textMuted }]}>Try a different search term.</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: {},
  tabText: { fontSize: 14, fontWeight: '500' },
  tabTextActive: { fontWeight: '700' },
  list: { padding: Spacing.md, gap: 10, paddingBottom: 100 },
  resultCard: { flexDirection: 'row', gap: Spacing.md, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1 },
  resultBadge: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  resultBadgeText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  resultInfo: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: '600' },
  resultArabic: { fontSize: 16, textAlign: 'right', marginBottom: 4, lineHeight: 26 },
  resultText: { fontSize: 13, lineHeight: 20 },
  resultMeta: { fontSize: 11, marginTop: 4 },
  emptyHint: { padding: 40, alignItems: 'center', gap: 12 },
  emptyHintTitle: { fontSize: 18, fontWeight: '700' },
  emptyHintText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 },
  suggestion: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.round, borderWidth: 1 },
  suggestionText: { fontSize: 13, fontWeight: '500' },
});
