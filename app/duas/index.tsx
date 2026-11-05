import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radius } from '../../constants/theme';
import { DUAS, DUA_CATEGORIES } from '../../constants/duasData';
import { useApp } from '../../contexts/AppContext';

/**
 * Dua categories.
 *
 * The per-category screen is self-contained (it renders its own header and
 * back button), so it is shown *inline* here rather than pushed as a route —
 * that avoids the duplicated chrome users would otherwise get.
 */
export default function DuasIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C } = useApp();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Counts come from the data, not the hand-written `count` field, which had
  // drifted (e.g. "12 duas" for a category holding 4).
  const categoryCount = (id: string) => DUAS.filter(d => d.category === id).length;

  const activeDuas = activeCategory ? DUAS.filter(d => d.category === activeCategory) : [];
  const activeMeta = DUA_CATEGORIES.find(c => c.id === activeCategory);

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: C.cardBorder }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>
            {activeMeta ? activeMeta.name : 'Duas & Azkar'}
          </Text>
          <Text style={[styles.headerSub, { color: C.textMuted }]}>
            {activeMeta
              ? `${activeMeta.arabicName} · ${activeDuas.length} supplication${activeDuas.length === 1 ? '' : 's'}`
              : 'Daily Supplications & Remembrance'}
          </Text>
        </View>
      </View>

      {activeCategory ? (
        <FlatList
          data={activeDuas}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Pressable
                onPress={() => setActiveCategory(null)}
                style={[styles.chip, { backgroundColor: `${C.gold}18`, borderColor: C.gold }]}
              >
                <Text style={[styles.chipText, { color: C.gold }]}>← All categories</Text>
              </Pressable>
              {DUA_CATEGORIES.filter(c => categoryCount(c.id) > 0).map(c => (
                <Pressable
                  key={c.id}
                  onPress={() => setActiveCategory(c.id)}
                  style={[
                    styles.chip,
                    { backgroundColor: C.card, borderColor: C.cardBorder },
                    c.id === activeCategory && { backgroundColor: `${C.gold}18`, borderColor: C.gold },
                  ]}
                >
                  <Text style={[styles.chipText, { color: c.id === activeCategory ? C.gold : C.textSecondary }]}>
                    {c.icon} {c.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          }
          renderItem={({ item, index }) => (
            <View style={[styles.duaCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.duaIndex, { color: C.gold }]}>{index + 1}</Text>
              <Text style={[styles.duaTitle, { color: C.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.duaArabic, { color: C.textArabic }]}>{item.arabic}</Text>
              <Text style={[styles.duaTranslit, { color: C.textMuted }]}>{item.transliteration}</Text>
              <Text style={[styles.duaTranslation, { color: C.textSecondary }]}>{item.translation}</Text>
              {item.benefits ? (
                <Text style={[styles.duaBenefits, { color: C.textMuted }]}>{item.benefits}</Text>
              ) : null}
              <Text style={[styles.duaRef, { color: C.info }]}>{item.reference}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyDua}>
              <MaterialIcons name="menu-book" size={48} color={C.textMuted} />
              <Text style={[styles.emptyDuaText, { color: C.textSecondary }]}>
                Supplications for this category are being added.
              </Text>
            </View>
          }
        />
      ) : (
      <FlatList
        data={DUA_CATEGORIES.filter(c => categoryCount(c.id) > 0)}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }, pressed && { opacity: 0.8 }]}
            onPress={() => setActiveCategory(item.id)}
          >
            <Text style={styles.cardEmoji}>{item.icon}</Text>
            <Text style={[styles.cardTitle, { color: C.textPrimary }]}>{item.name}</Text>
            <Text style={[styles.cardArabic, { color: C.gold }]}>{item.arabicName}</Text>
            <View style={[styles.countBadge, { backgroundColor: `${C.gold}15` }]}>
              <Text style={[styles.countText, { color: C.gold }]}>{categoryCount(item.id)} duas</Text>
            </View>
          </Pressable>
        )}
        ListHeaderComponent={
          <View style={[styles.intro, { backgroundColor: `${C.primary}20`, borderColor: `${C.primary}40` }]}>
            <Text style={[styles.introArabic, { color: C.gold }]}>وَقَالَ رَبُّكُمُ ادْعُونِي أَسْتَجِبْ لَكُمْ</Text>
            <Text style={[styles.introText, { color: C.textSecondary }]}>
              "And your Lord said: Call upon Me, I will respond to you." — Quran 40:60
            </Text>
          </View>
        }
      />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { gap: 8, paddingVertical: Spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.round, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },
  duaCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: 12 },
  duaIndex: { fontSize: 11, fontWeight: '700' },
  duaTitle: { fontSize: 14, fontWeight: '600', marginTop: 2, marginBottom: 6 },
  duaArabic: { fontSize: 20, lineHeight: 34, textAlign: 'right', marginBottom: 8 },
  duaTranslit: { fontSize: 12, fontStyle: 'italic', lineHeight: 18, marginBottom: 6 },
  duaTranslation: { fontSize: 13, lineHeight: 20 },
  duaBenefits: { fontSize: 11, lineHeight: 16, marginTop: 8, fontStyle: 'italic' },
  duaRef: { fontSize: 11, marginTop: 8 },
  emptyDua: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyDuaText: { fontSize: 13, textAlign: 'center' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 13 },
  intro: {
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  introArabic: { fontSize: 18, fontWeight: '400', textAlign: 'center', lineHeight: 32 },
  introText: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 6 },
  list: { padding: Spacing.md, paddingBottom: 100 },
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  cardEmoji: { fontSize: 32 },
  cardTitle: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  cardArabic: { fontSize: 14, textAlign: 'center' },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
  countText: { fontSize: 11, fontWeight: '600' },
});
