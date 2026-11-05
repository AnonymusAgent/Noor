import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radius, ThemeColors } from '../../constants/theme';
import { DUAS, DUA_CATEGORIES } from '../../constants/duasData';
import { useApp } from '../../contexts/AppContext';

export default function DuaCategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { favoritedDuas, toggleFavoriteDua, addBookmark, removeBookmark, isBookmarked, colors: C } = useApp();
  // The palette depends on the active theme, so the stylesheet is rebuilt when
  // the theme changes instead of being frozen at the dark-mode defaults.
  const styles = useMemo(() => createStyles(C), [C]);

  const catMeta = DUA_CATEGORIES.find(c => c.id === category);
  const duas = DUAS.filter(d => d.category === category);

  const [expanded, setExpanded] = useState<string | null>(null);

  const shareDua = async (dua: typeof DUAS[0]) => {
    const text = `${dua.arabic}\n\n${dua.translation}\n\nTransliteration: ${dua.transliteration}\n\nReference: ${dua.reference}`;
    await Share.share({ message: text });
  };

  const renderDua = ({ item, index }: { item: typeof DUAS[0]; index: number }) => {
    const isOpen = expanded === item.id;
    const isFav = favoritedDuas.includes(item.id);
    const isBook = isBookmarked(`dua_${item.id}`);

    return (
      <Pressable
        style={[styles.duaCard, isOpen && styles.duaCardOpen]}
        onPress={() => setExpanded(isOpen ? null : item.id)}
      >
        <View style={styles.duaHeader}>
          <View style={styles.duaIndex}>
            <Text style={styles.duaIndexText}>{index + 1}</Text>
          </View>
          <View style={styles.duaTitleArea}>
            <Text style={styles.duaTitle}>{item.title}</Text>
            {item.occasion ? <Text style={styles.duaOccasion}>{item.occasion}</Text> : null}
          </View>
          <MaterialIcons
            name={isOpen ? 'expand-less' : 'expand-more'}
            size={22}
            color={C.textMuted}
          />
        </View>

        {/* Arabic always visible */}
        <Text style={styles.arabicText}>{item.arabic}</Text>

        {isOpen && (
          <>
            <View style={styles.divider} />

            <Text style={styles.translitLabel}>Transliteration</Text>
            <Text style={styles.translitText}>{item.transliteration}</Text>

            <Text style={styles.translationLabel}>Translation</Text>
            <Text style={styles.translationText}>{item.translation}</Text>

            {item.benefits ? (
              <>
                <Text style={styles.benefitLabel}>Benefits</Text>
                <Text style={styles.benefitText}>{item.benefits}</Text>
              </>
            ) : null}

            <View style={styles.refCard}>
              <MaterialIcons name="verified" size={14} color={C.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.refSource}>{item.source}</Text>
                <Text style={styles.refText}>{item.reference}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={styles.actionBtn}
                onPress={() => toggleFavoriteDua(item.id)}
              >
                <MaterialIcons
                  name={isFav ? 'favorite' : 'favorite-border'}
                  size={18}
                  color={isFav ? C.error : C.textMuted}
                />
                <Text style={styles.actionText}>Favorite</Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                onPress={() => isBook
                  ? removeBookmark(`dua_${item.id}`)
                  : addBookmark({ type: 'dua', reference: `dua_${item.id}`, title: item.title, subtitle: item.reference, arabic: item.arabic })}
              >
                <MaterialIcons
                  name={isBook ? 'bookmark' : 'bookmark-border'}
                  size={18}
                  color={isBook ? C.gold : C.textMuted}
                />
                <Text style={styles.actionText}>Bookmark</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => shareDua(item)}>
                <MaterialIcons name="share" size={18} color={C.textMuted} />
                <Text style={styles.actionText}>Share</Text>
              </Pressable>
            </View>
          </>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.emoji}>{catMeta?.icon}</Text>
          <View>
            <Text style={styles.headerTitle}>{catMeta?.name || category}</Text>
            <Text style={styles.headerArabic}>{catMeta?.arabicName}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={duas}
        renderItem={renderDua}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>🤲</Text>
            <Text style={styles.emptyLabel}>No duas available for this category yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  emoji: { fontSize: 28 },
  headerTitle: { fontSize: 18, color: Colors.textPrimary, fontWeight: '700' },
  headerArabic: { fontSize: 15, color: Colors.gold },
  list: { padding: Spacing.md, gap: 12, paddingBottom: 100 },
  duaCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  duaCardOpen: { borderColor: `${Colors.gold}40` },
  duaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  duaIndex: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: `${Colors.gold}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duaIndexText: { fontSize: 12, color: Colors.gold, fontWeight: '700' },
  duaTitleArea: { flex: 1 },
  duaTitle: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  duaOccasion: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  arabicText: {
    fontSize: 22,
    color: Colors.textArabic,
    textAlign: 'right',
    lineHeight: 40,
    writingDirection: 'rtl',
  },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: Spacing.sm },
  translitLabel: { fontSize: 11, color: Colors.gold, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  translitText: { fontSize: 14, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2, lineHeight: 22 },
  translationLabel: { fontSize: 11, color: Colors.info, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: Spacing.sm },
  translationText: { fontSize: 15, color: Colors.textPrimary, lineHeight: 24, marginTop: 2 },
  benefitLabel: { fontSize: 11, color: Colors.success, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: Spacing.sm },
  benefitText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginTop: 2 },
  refCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: `${Colors.success}10`,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: `${Colors.success}20`,
  },
  refSource: { fontSize: 12, color: Colors.success, fontWeight: '600' },
  refText: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, color: Colors.textMuted },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 40, marginBottom: 8 },
  emptyLabel: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
