import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  Modal, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { ISLAMIC_NAMES, NAME_CATEGORIES, IslamicName } from '../constants/islamicNamesData';

type Gender = 'all' | 'boy' | 'girl';

export default function IslamicNamesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Favourites live in the context store (persisted), not in local state.
  const { colors: C, nameFavorites: favorites, toggleNameFavorite } = useApp();
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState<Gender>('all');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<IslamicName | null>(null);

  const filtered = ISLAMIC_NAMES.filter(n => {
    const matchGender = gender === 'all' || n.gender === gender;
    const matchCat = category === 'all' || n.category === category;
    const matchSearch = search.length < 2 ||
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.arabic.includes(search) ||
      n.meaning.toLowerCase().includes(search.toLowerCase());
    return matchGender && matchCat && matchSearch;
  });

  const toggleFav = (id: string) => toggleNameFavorite(id);

  const getPopularityColor = (p: string) => {
    if (p === 'very popular') return C.success;
    if (p === 'popular') return C.info;
    if (p === 'uncommon') return C.warning;
    return C.textMuted;
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Islamic Baby Names</Text>
            <Text style={[styles.headerSub, { color: C.textSecondary }]}>{filtered.length} names found</Text>
          </View>
        </View>

        {/* Gender Toggle */}
        <View style={[styles.genderRow, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}20` }]}>
          {(['all', 'boy', 'girl'] as Gender[]).map(g => (
            <Pressable
              key={g}
              style={[styles.genderBtn, gender === g && [styles.genderBtnActive, { backgroundColor: C.gold }]]}
              onPress={() => setGender(g)}
            >
              <Text style={[styles.genderText, { color: gender === g ? C.primaryDark : C.textSecondary }, gender === g && styles.genderTextActive]}>
                {g === 'all' ? '👶 All' : g === 'boy' ? '👦 Boys' : '👧 Girls'}
              </Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: C.cardBorder }]}>
        <View style={[styles.searchBar, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <MaterialIcons name="search" size={18} color={C.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: C.textPrimary }]}
            placeholder="Search name, meaning..."
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
      <View style={[styles.catBar, { borderBottomColor: C.cardBorder }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catContent}>
          {NAME_CATEGORIES.map(cat => (
            <Pressable
              key={cat.id}
              style={[
                styles.catChip,
                { backgroundColor: C.card, borderColor: C.cardBorder },
                category === cat.id && { backgroundColor: `${cat.color}20`, borderColor: cat.color },
              ]}
              onPress={() => setCategory(cat.id)}
            >
              <Text style={[styles.catLabel, { color: category === cat.id ? cat.color : C.textMuted }]}>{cat.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.nameCard, { backgroundColor: C.card, borderColor: C.cardBorder }, pressed && { opacity: 0.85 }]}
            onPress={() => setSelected(item)}
          >
            <View style={[styles.genderIcon, { backgroundColor: item.gender === 'boy' ? '#4A9BE820' : '#E84A9B20' }]}>
              <Text style={styles.genderEmoji}>{item.gender === 'boy' ? '👦' : '👧'}</Text>
            </View>
            <View style={styles.nameInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.nameLatin, { color: C.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.nameArabic, { color: C.textArabic }]}>{item.arabic}</Text>
              </View>
              <Text style={[styles.nameMeaning, { color: C.textSecondary }]} numberOfLines={1}>{item.meaning}</Text>
              <View style={styles.nameMeta}>
                <View style={[styles.catTag, { backgroundColor: `${C.primary}20` }]}>
                  <Text style={[styles.catTagText, { color: C.textMuted }]}>{item.category}</Text>
                </View>
                <View style={[styles.popularityTag, { backgroundColor: `${getPopularityColor(item.popularity)}15` }]}>
                  <Text style={[styles.popularityText, { color: getPopularityColor(item.popularity) }]}>{item.popularity}</Text>
                </View>
              </View>
            </View>
            <Pressable onPress={() => toggleFav(item.id)} hitSlop={8}>
              <MaterialIcons
                name={favorites.includes(item.id) ? 'favorite' : 'favorite-border'}
                size={20}
                color={favorites.includes(item.id) ? C.error : C.textMuted}
              />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>No names found</Text>
            <Text style={[styles.emptyText, { color: C.textMuted }]}>Try different search terms or filters.</Text>
          </View>
        }
      />

      {/* Detail Modal */}
      <Modal visible={!!selected} transparent animationType="slide">
        {selected && (
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: C.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: C.cardBorder }]}>
                <Text style={[styles.modalHeaderTitle, { color: C.textPrimary }]}>{selected.name}</Text>
                <Pressable onPress={() => setSelected(null)}>
                  <MaterialIcons name="close" size={24} color={C.textPrimary} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={[styles.modalArabic, { color: C.textArabic }]}>{selected.arabic}</Text>

                <View style={[styles.detailRow, { borderBottomColor: C.cardBorder }]}>
                  <Text style={[styles.detailLabel, { color: C.textMuted }]}>Meaning</Text>
                  <Text style={[styles.detailValue, { color: C.textPrimary }]}>{selected.meaning}</Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: C.cardBorder }]}>
                  <Text style={[styles.detailLabel, { color: C.textMuted }]}>Origin</Text>
                  <Text style={[styles.detailValue, { color: C.textPrimary }]}>{selected.origin}</Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: C.cardBorder }]}>
                  <Text style={[styles.detailLabel, { color: C.textMuted }]}>Gender</Text>
                  <Text style={[styles.detailValue, { color: C.textPrimary }]}>{selected.gender === 'boy' ? 'Boy 👦' : 'Girl 👧'}</Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: C.cardBorder }]}>
                  <Text style={[styles.detailLabel, { color: C.textMuted }]}>Popularity</Text>
                  <Text style={[styles.detailValue, { color: getPopularityColor(selected.popularity) }]}>{selected.popularity}</Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: C.cardBorder }]}>
                  <Text style={[styles.detailLabel, { color: C.textMuted }]}>Category</Text>
                  <Text style={[styles.detailValue, { color: C.textPrimary }]}>{selected.category}</Text>
                </View>

                {selected.quranRef && (
                  <View style={[styles.refCard, { backgroundColor: `${C.gold}10`, borderColor: `${C.gold}20` }]}>
                    <MaterialIcons name="menu-book" size={16} color={C.gold} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.refLabel, { color: C.textMuted }]}>Quranic Reference</Text>
                      <Text style={[styles.refValue, { color: C.gold }]}>{selected.quranRef}</Text>
                    </View>
                  </View>
                )}
                {selected.propheticRef && (
                  <View style={[styles.refCard, { backgroundColor: `${C.success}10`, borderColor: `${C.success}20` }]}>
                    <MaterialIcons name="verified" size={16} color={C.success} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.refLabel, { color: C.textMuted }]}>Prophetic Connection</Text>
                      <Text style={[styles.refValue, { color: C.success }]}>{selected.propheticRef}</Text>
                    </View>
                  </View>
                )}

                {selected.relatedNames && selected.relatedNames.length > 0 && (
                  <View style={styles.relatedSection}>
                    <Text style={[styles.relatedTitle, { color: C.textMuted }]}>Related Names</Text>
                    <View style={styles.relatedRow}>
                      {selected.relatedNames.map(n => (
                        <View key={n} style={[styles.relatedChip, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                          <Text style={[styles.relatedChipText, { color: C.textSecondary }]}>{n}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
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
  header: { padding: Spacing.md, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  genderRow: { flexDirection: 'row', borderRadius: Radius.md, padding: 4, borderWidth: 1 },
  genderBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.md - 4 },
  genderBtnActive: {},
  genderText: { fontSize: 13, fontWeight: '500' },
  genderTextActive: { fontWeight: '700' },
  searchRow: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, paddingHorizontal: 12, gap: 8, borderWidth: 1 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  catBar: { borderBottomWidth: 1 },
  catContent: { paddingHorizontal: Spacing.md, paddingVertical: 8, gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.round, borderWidth: 1 },
  catLabel: { fontSize: 12, fontWeight: '500' },
  list: { padding: Spacing.md, gap: 10, paddingBottom: 100 },
  nameCard: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, gap: Spacing.md },
  genderIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  genderEmoji: { fontSize: 24 },
  nameInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameLatin: { fontSize: 17, fontWeight: '700' },
  nameArabic: { fontSize: 18, fontWeight: '400' },
  nameMeaning: { fontSize: 13, marginTop: 2 },
  nameMeta: { flexDirection: 'row', gap: 6, marginTop: 4 },
  catTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  catTagText: { fontSize: 10, fontWeight: '600' },
  popularityTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  popularityText: { fontSize: 10, fontWeight: '600' },
  empty: { padding: 40, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.md, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: Spacing.md, borderBottomWidth: 1, marginBottom: Spacing.md },
  modalHeaderTitle: { fontSize: 20, fontWeight: '700' },
  modalArabic: { fontSize: 40, textAlign: 'center', fontWeight: '400', lineHeight: 64, marginBottom: Spacing.lg },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  detailLabel: { fontSize: 13, fontWeight: '500' },
  detailValue: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  refCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, marginTop: 10 },
  refLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  refValue: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  relatedSection: { marginTop: Spacing.lg },
  relatedTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  relatedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  relatedChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.round, borderWidth: 1 },
  relatedChipText: { fontSize: 13 },
});
