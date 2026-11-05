import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../../constants/theme';
import { HADITH_COLLECTIONS } from '../../constants/hadithData';
import { getOfflineHadithCount } from '../../constants/offlineHadithDb';
import { useApp } from '../../contexts/AppContext';

export default function HadithIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C } = useApp();

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Hadith Collections</Text>
            <Text style={[styles.headerSub, { color: C.textSecondary }]}>Authentic Prophetic Traditions</Text>
          </View>
          <Pressable
            style={[styles.searchIconBtn, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}
            onPress={() => router.push('/hadith/search' as any)}
          >
            <MaterialIcons name="search" size={22} color={C.gold} />
          </Pressable>
        </View>
        <Pressable
          style={[styles.searchBanner, { backgroundColor: `${C.info}12`, borderColor: `${C.info}25` }]}
          onPress={() => router.push('/hadith/search' as any)}
        >
          <MaterialIcons name="manage-search" size={16} color={C.info} />
          <Text style={[styles.searchBannerText, { color: C.info }]}>
            Search across 180+ offline hadiths + all cached online content
          </Text>
          <MaterialIcons name="chevron-right" size={16} color={C.info} />
        </Pressable>
        <View style={[styles.offlineBadge, { backgroundColor: `${C.success}20`, borderColor: `${C.success}30` }]}>
          <MaterialIcons name="offline-bolt" size={13} color={C.success} />
          <Text style={[styles.offlineBadgeText, { color: C.success }]}>
            Collections download online and are cached for later reading
          </Text>
        </View>
      </LinearGradient>

      <FlatList
        data={HADITH_COLLECTIONS}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const offlineCount = getOfflineHadithCount(item.id);
          return (
            <Pressable
              style={({ pressed }) => [styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }, pressed && { opacity: 0.8 }]}
              onPress={() => router.push(`/hadith/${item.id}` as any)}
            >
              <View style={[styles.cardIcon, { backgroundColor: `${item.color}20` }]}>
                <Text style={styles.cardEmoji}>{item.icon}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: C.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.cardArabic, { color: C.textArabic }]}>{item.arabicName}</Text>
                <Text style={[styles.cardScholar, { color: C.textMuted }]}>{item.scholar}</Text>
                <View style={styles.cardMeta}>
                  <View style={[styles.badge, { backgroundColor: `${C.gold}20`, borderColor: `${C.gold}30` }]}>
                    <MaterialIcons name="offline-bolt" size={10} color={C.gold} />
                    <Text style={[styles.badgeText, { color: C.gold }]}>
                      {offlineCount > 0 ? `${offlineCount} available offline` : 'Core hadiths available'}
                    </Text>
                  </View>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={C.textMuted} />
            </Pressable>
          );
        }}
        ListHeaderComponent={
          <View style={[styles.intro, { backgroundColor: `${C.primary}20`, borderColor: `${C.primary}40` }]}>
            <Text style={[styles.introText, { color: C.textSecondary }]}>
              Browse the Kutub al-Sittah, Riyad as-Salihin, and Nawawi's 40 Hadiths. Online editions are cached on this device; curated offline records remain available without a connection.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: 4,
    marginBottom: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchIconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  searchBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: Radius.md, borderWidth: 1, marginBottom: 8 },
  searchBannerText: { flex: 1, fontSize: 12, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 13, marginTop: 2 },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  offlineBadgeText: { fontSize: 12, fontWeight: '600' },
  intro: {
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  introText: { fontSize: 13, lineHeight: 20 },
  list: { paddingBottom: 120 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: 12,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  cardIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 26 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardArabic: { fontSize: 18, fontWeight: '400', marginTop: 2 },
  cardScholar: { fontSize: 12, marginTop: 2 },
  cardMeta: { flexDirection: 'row', gap: 8, marginTop: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
});
