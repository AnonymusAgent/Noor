import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radius } from '../constants/theme';
import { DUAS, DUA_CATEGORIES } from '../constants/duasData';
import { useApp } from '../contexts/AppContext';

/**
 * Saved supplications.
 *
 * `favoritedDuas` has existed in the context (and is toggled by the dua cards)
 * since the beginning, but nothing ever read it back — a star that silently did
 * nothing. This screen is that list.
 */
export default function FavoriteDuasScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, favoritedDuas, toggleFavoriteDua } = useApp();

  const favoriteDuas = useMemo(
    () => favoritedDuas
      .map(id => DUAS.find(d => d.id === id))
      .filter((d): d is typeof DUAS[number] => Boolean(d)),
    [favoritedDuas],
  );

  const categoryName = (id: string) =>
    DUA_CATEGORIES.find(c => c.id === id)?.name ?? 'Dua';

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: C.cardBorder }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Favorite Duas</Text>
          <Text style={[styles.headerSub, { color: C.textMuted }]}>
            {favoriteDuas.length} saved supplication{favoriteDuas.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <FlatList
        data={favoriteDuas}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push(`/duas/${item.category}` as any)}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: `${C.gold}15` }]}>
                <Text style={[styles.badgeText, { color: C.gold }]}>{categoryName(item.category)}</Text>
              </View>
              <Pressable onPress={() => toggleFavoriteDua(item.id)} hitSlop={10}>
                <MaterialIcons name="favorite" size={20} color={C.error} />
              </Pressable>
            </View>
            <Text style={[styles.title, { color: C.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.arabic, { color: C.textArabic }]} numberOfLines={2}>{item.arabic}</Text>
            <Text style={[styles.translation, { color: C.textSecondary }]} numberOfLines={3}>
              {item.translation}
            </Text>
            <Text style={[styles.reference, { color: C.textMuted }]}>{item.reference}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="favorite-border" size={64} color={C.textMuted} />
            <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>No favorite duas yet</Text>
            <Text style={[styles.emptyText, { color: C.textMuted }]}>
              Open any supplication and tap the heart to keep it here for quick access.
            </Text>
            <Pressable
              style={[styles.browseBtn, { backgroundColor: C.gold }]}
              onPress={() => router.push('/duas' as any)}
            >
              <Text style={[styles.browseBtnText, { color: C.primaryDark }]}>Browse Duas</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  headerSub: { fontSize: 13, marginTop: 2 },
  list: { padding: Spacing.md, gap: 12, paddingBottom: 80 },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  title: { fontSize: 14, fontWeight: '600' },
  arabic: { fontSize: 20, lineHeight: 34, textAlign: 'right' },
  translation: { fontSize: 13, lineHeight: 19 },
  reference: { fontSize: 11 },
  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: Spacing.sm },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  browseBtn: { marginTop: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: 12, borderRadius: Radius.round },
  browseBtnText: { fontWeight: '700', fontSize: 14 },
});
