import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  Modal, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius, ThemeColors } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { ASMA_UL_HUSNA, ASMA_CATEGORIES, AsmaName } from '../constants/asmaData';

const CATEGORY_COLOR_KEYS: Record<string, keyof ThemeColors> = {
  essence: 'gold',
  mercy: 'success',
  power: 'error',
  knowledge: 'info',
  creation: 'hizb',
  justice: 'warning',
  guidance: 'gold',
};

export default function AsmaUlHusnaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Favourites live in the context store, so they survive a restart and can be
  // surfaced elsewhere (e.g. the library screen).
  const { colors: C, asmaFavorites: favorites, toggleAsmaFavorite } = useApp();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedName, setSelectedName] = useState<AsmaName | null>(null);

  const filtered = ASMA_UL_HUSNA.filter(n => {
    const matchCat = activeCategory === 'all' || n.category === activeCategory;
    const matchSearch = search.length < 2 || n.arabic.includes(search) ||
      n.transliteration.toLowerCase().includes(search.toLowerCase()) ||
      n.meaning.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const toggleFav = useCallback((num: number) => toggleAsmaFavorite(num), [toggleAsmaFavorite]);


  const getCategoryColor = useCallback((cat: string) => {
    const key = CATEGORY_COLOR_KEYS[cat];
    return (key ? C[key] : undefined) || C.gold;
  }, [C]);

  const renderItem = useCallback(({ item }: { item: AsmaName }) => (
    <Pressable
      style={({ pressed }) => [styles.nameCard, { backgroundColor: C.card, borderColor: C.cardBorder }, pressed && { opacity: 0.85 }]}
      onPress={() => setSelectedName(item)}
    >
      <View style={[styles.numberBadge, { backgroundColor: `${getCategoryColor(item.category)}15`, borderColor: `${getCategoryColor(item.category)}30` }]}>
        <Text style={[styles.numberText, { color: getCategoryColor(item.category) }]}>{item.number}</Text>
      </View>
      <View style={styles.nameInfo}>
        <Text style={[styles.arabicName, { color: C.textArabic }]}>{item.arabic}</Text>
        <Text style={[styles.translit, { color: C.gold }]}>{item.transliteration}</Text>
        <Text style={[styles.meaning, { color: C.textSecondary }]}>{item.meaning}</Text>
      </View>
      <Pressable onPress={() => toggleFav(item.number)} style={styles.favBtn} hitSlop={8}>
        <MaterialIcons
          name={favorites.includes(item.number) ? 'favorite' : 'favorite-border'}
          size={20}
          color={favorites.includes(item.number) ? C.error : C.textMuted}
        />
      </Pressable>
    </Pressable>
  ), [C, favorites, getCategoryColor, toggleFav]);

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
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Asma-ul-Husna</Text>
            <Text style={[styles.headerArabic, { color: C.gold }]}>أَسْمَاءُ اللَّهِ الْحُسْنَى</Text>
            <Text style={[styles.headerSub, { color: C.textSecondary }]}>99 Beautiful Names of Allah</Text>
          </View>
          <View style={[styles.countBadge, { backgroundColor: `${C.gold}20` }]}>
            <Text style={[styles.countText, { color: C.gold }]}>{filtered.length}</Text>
          </View>
        </View>

        {/* Reference Hadith */}
        <View style={[styles.hadithRef, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}>
          <Text style={[styles.hadithText, { color: C.textSecondary }]}>
            "Allah has ninety-nine names, one hundred minus one. Whoever learns them all will enter Paradise."
          </Text>
          <Text style={[styles.hadithSource, { color: C.gold }]}>— Sahih al-Bukhari 2736</Text>
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={[styles.searchRow, { backgroundColor: C.surface, borderBottomColor: C.cardBorder }]}>
        <View style={[styles.searchBar, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <MaterialIcons name="search" size={18} color={C.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: C.textPrimary }]}
            placeholder="Search by name or meaning..."
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={16} color={C.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Category Filter */}
      <View style={[styles.categoryBar, { borderBottomColor: C.cardBorder }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContent}>
          {ASMA_CATEGORIES.map(cat => (
            <Pressable
              key={cat.id}
              style={[
                styles.categoryChip,
                { backgroundColor: C.card, borderColor: C.cardBorder },
                activeCategory === cat.id && { backgroundColor: `${C.gold}20`, borderColor: C.gold },
              ]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <Text style={styles.categoryEmoji}>{cat.icon}</Text>
              <Text style={[styles.categoryLabel, { color: activeCategory === cat.id ? C.gold : C.textMuted }, activeCategory === cat.id && styles.categoryLabelActive]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.number)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        numColumns={1}
      />

      {/* Detail Modal */}
      <Modal visible={!!selectedName} transparent animationType="slide">
        {selectedName && (
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: C.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: C.cardBorder }]}>
                <View style={[styles.modalNum, { backgroundColor: `${getCategoryColor(selectedName.category)}20` }]}>
                  <Text style={[styles.modalNumText, { color: getCategoryColor(selectedName.category) }]}>#{selectedName.number}</Text>
                </View>
                <Pressable onPress={() => setSelectedName(null)}>
                  <MaterialIcons name="close" size={24} color={C.textPrimary} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={[styles.modalArabic, { color: C.textArabic }]}>{selectedName.arabic}</Text>
                <Text style={[styles.modalTranslit, { color: C.gold }]}>{selectedName.transliteration}</Text>
                <Text style={[styles.modalMeaning, { color: C.textPrimary }]}>{selectedName.meaning}</Text>
                <Text style={[styles.modalMeaningUrdu, { color: C.textMuted }]}>{selectedName.meaningUrdu}</Text>

                <View style={[styles.modalSection, { borderTopColor: C.cardBorder }]}>
                  <Text style={[styles.modalSectionTitle, { color: C.textMuted }]}>Explanation</Text>
                  <Text style={[styles.modalExplanation, { color: C.textSecondary }]}>{selectedName.explanation}</Text>
                </View>

                {selectedName.quranRef && (
                  <View style={[styles.refBadge, { backgroundColor: `${C.gold}10`, borderColor: `${C.gold}20` }]}>
                    <MaterialIcons name="menu-book" size={14} color={C.gold} />
                    <Text style={[styles.refText, { color: C.gold }]}>Quran: {selectedName.quranRef}</Text>
                  </View>
                )}

                <View style={[styles.categoryTag, { backgroundColor: `${getCategoryColor(selectedName.category)}15` }]}>
                  <Text style={[styles.categoryTagText, { color: getCategoryColor(selectedName.category) }]}>
                    {selectedName.category.charAt(0).toUpperCase() + selectedName.category.slice(1)}
                  </Text>
                </View>

                <Pressable
                  style={[styles.favBtnLarge, { borderColor: C.cardBorder, backgroundColor: favorites.includes(selectedName.number) ? `${C.error}15` : C.card }]}
                  onPress={() => toggleFav(selectedName.number)}
                >
                  <MaterialIcons name={favorites.includes(selectedName.number) ? 'favorite' : 'favorite-border'} size={20} color={C.error} />
                  <Text style={[styles.favBtnText, { color: favorites.includes(selectedName.number) ? C.error : C.textMuted }]}>
                    {favorites.includes(selectedName.number) ? 'Remove from Favorites' : 'Add to Favorites'}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerArabic: { fontSize: 18, marginTop: 2 },
  headerSub: { fontSize: 12, marginTop: 2 },
  countBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 14, fontWeight: '700' },
  hadithRef: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  hadithText: { fontSize: 12, fontStyle: 'italic', lineHeight: 18 },
  hadithSource: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  searchRow: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, paddingHorizontal: 12, gap: 8, borderWidth: 1 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  categoryBar: { borderBottomWidth: 1 },
  categoryContent: { paddingHorizontal: Spacing.md, paddingVertical: 8, gap: 8 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.round, borderWidth: 1, gap: 4 },
  categoryEmoji: { fontSize: 12 },
  categoryLabel: { fontSize: 12, fontWeight: '500' },
  categoryLabelActive: { fontWeight: '700' },
  list: { padding: Spacing.md, gap: 10, paddingBottom: 100 },
  nameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  numberBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  numberText: { fontSize: 14, fontWeight: '700' },
  nameInfo: { flex: 1 },
  arabicName: { fontSize: 22, fontWeight: '400' },
  translit: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  meaning: { fontSize: 13, marginTop: 2 },
  favBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.md, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: Spacing.md, borderBottomWidth: 1, marginBottom: Spacing.md },
  modalNum: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  modalNumText: { fontSize: 13, fontWeight: '700' },
  modalArabic: { fontSize: 38, textAlign: 'center', lineHeight: 60, fontWeight: '400' },
  modalTranslit: { fontSize: 22, textAlign: 'center', fontWeight: '700', marginTop: 4 },
  modalMeaning: { fontSize: 18, textAlign: 'center', fontWeight: '600', marginTop: 6 },
  modalMeaningUrdu: { fontSize: 16, textAlign: 'center', marginTop: 4 },
  modalSection: { marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1 },
  modalSectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  modalExplanation: { fontSize: 15, lineHeight: 24 },
  refBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: Radius.sm, borderWidth: 1, marginTop: 12 },
  refText: { fontSize: 13, fontWeight: '600' },
  categoryTag: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.round, marginTop: 10 },
  categoryTagText: { fontSize: 12, fontWeight: '700' },
  favBtnLarge: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.lg, justifyContent: 'center' },
  favBtnText: { fontSize: 15, fontWeight: '600' },
});
