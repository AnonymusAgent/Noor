import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../../constants/theme';
import { usePrayerTimes } from '../../hooks/usePrayer';
import { PRAYER_ICONS, PRAYER_COLORS } from '../../constants/prayerData';
import { useApp } from '../../contexts/AppContext';
import { formatPrayerTime } from '../../services/prayerService';

const PRAYER_ORDER = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export default function PrayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, colors: C } = useApp();
  const { prayerData, loading, error, locationName, nextPrayer, reload } = usePrayerTimes(
    settings.prayerCalculationMethod,
    settings.madhab
  );

  if (loading) {
    return (
      <View style={[styles.center, { flex: 1, backgroundColor: C.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={[styles.loadingText, { color: C.textSecondary }]}>Fetching prayer times...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { flex: 1, backgroundColor: C.background, paddingTop: insets.top }]}>
        <MaterialIcons name="error-outline" size={48} color={C.error} />
        <Text style={[styles.errorText, { color: C.error }]}>{error}</Text>
        <Pressable style={[styles.retryBtn, { backgroundColor: C.primary }]} onPress={reload}>
          <Text style={[styles.retryText, { color: C.gold }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Prayer Times</Text>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => router.push('/prayer-times-monthly' as any)}
                style={[styles.refreshBtn, { backgroundColor: `${C.gold}20` }]}
              >
                <MaterialIcons name="calendar-month" size={20} color={C.gold} />
              </Pressable>
              <Pressable onPress={reload} style={[styles.refreshBtn, { backgroundColor: `${C.gold}20` }]}>
                <MaterialIcons name="refresh" size={20} color={C.gold} />
              </Pressable>
            </View>
          </View>
          {locationName ? (
            <View style={styles.locationRow}>
              <MaterialIcons name="location-on" size={14} color={`${C.gold}80`} />
              <Text style={[styles.location, { color: `${C.textPrimary}80` }]}>{locationName}</Text>
            </View>
          ) : null}
          {prayerData?.date?.hijri && (
            <Text style={[styles.hijriDate, { color: C.gold }]}>
              {prayerData.date.hijri.day} {prayerData.date.hijri.month.en} {prayerData.date.hijri.year} AH
            </Text>
          )}
          {prayerData?.date?.readable && (
            <Text style={[styles.gregorianDate, { color: C.textSecondary }]}>{prayerData.date.readable}</Text>
          )}

          {/* Next Prayer */}
          {nextPrayer && (
            <View style={[styles.nextPrayer, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}>
              <Text style={[styles.nextLabel, { color: `${C.gold}80` }]}>Next Prayer</Text>
              <Text style={[styles.nextName, { color: C.textPrimary }]}>{nextPrayer.name}</Text>
              <Text style={[styles.nextTime, { color: C.gold }]}>{formatPrayerTime(nextPrayer.time)}</Text>
              <Text style={[styles.nextCountdown, { color: C.textSecondary }]}>
                in {nextPrayer.minutesLeft < 60
                  ? `${nextPrayer.minutesLeft} minutes`
                  : `${Math.floor(nextPrayer.minutesLeft / 60)}h ${nextPrayer.minutesLeft % 60}m`}
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Prayer Times List */}
        <View style={[styles.prayersContainer, { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: 8 }]}>
          {PRAYER_ORDER.map(prayer => {
            const time = prayerData?.timings?.[prayer as keyof typeof prayerData.timings];
            const isNext = nextPrayer?.name === prayer;
            const color = PRAYER_COLORS[prayer] || C.primary;

            return (
              <View
                key={prayer}
                style={[
                  styles.prayerRow,
                  { backgroundColor: C.card, borderColor: C.cardBorder },
                  isNext && [styles.prayerRowActive, { borderColor: C.gold, backgroundColor: `${C.gold}10` }],
                ]}
              >
                <View style={[styles.prayerIcon, { backgroundColor: `${color}20` }]}>
                  <Text style={styles.prayerEmoji}>{PRAYER_ICONS[prayer] || '🕌'}</Text>
                </View>
                <View style={styles.prayerInfo}>
                  <Text style={[styles.prayerName, { color: isNext ? C.gold : C.textPrimary }]}>{prayer}</Text>
                  {isNext && (
                    <Text style={[styles.prayerNextBadge, { color: C.primaryDark, backgroundColor: C.gold }]}>Next</Text>
                  )}
                </View>
                <Text style={[styles.prayerTime, { color: isNext ? C.gold : C.textSecondary }]}>
                  {time ? formatPrayerTime(time) : '---'}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <Pressable style={[styles.actionBtn, { backgroundColor: C.card, borderColor: `${C.gold}30` }]} onPress={() => router.push('/qibla')}>
            <MaterialIcons name="explore" size={22} color={C.gold} />
            <Text style={[styles.actionText, { color: C.textPrimary }]}>Qibla</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: C.card, borderColor: `${C.gold}30` }]} onPress={() => router.push('/prayer-guide')}>
            <MaterialIcons name="mosque" size={22} color={C.gold} />
            <Text style={[styles.actionText, { color: C.textPrimary }]}>Prayer Guide</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: C.card, borderColor: `${C.gold}30` }]} onPress={() => router.push('/tasbeeh')}>
            <MaterialIcons name="loop" size={22} color={C.gold} />
            <Text style={[styles.actionText, { color: C.textPrimary }]}>Tasbeeh</Text>
          </Pressable>
        </View>

        {prayerData?.meta?.method && (
          <View style={[styles.methodCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.methodLabel, { color: C.textMuted }]}>Calculation Method</Text>
            <Text style={[styles.methodName, { color: C.textSecondary }]}>{prayerData.meta.method.name}</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: 15, marginTop: Spacing.sm },
  errorText: { fontSize: 15, textAlign: 'center', paddingHorizontal: Spacing.xl },
  retryBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  retryText: { fontWeight: '600' },
  header: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  location: { fontSize: 13 },
  hijriDate: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  gregorianDate: { fontSize: 13, marginTop: 2 },
  nextPrayer: {
    marginTop: Spacing.lg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  nextLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  nextName: { fontSize: 28, fontWeight: '700', marginTop: 2 },
  nextTime: { fontSize: 20, fontWeight: '600' },
  nextCountdown: { fontSize: 13, marginTop: 2 },
  prayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  prayerRowActive: {},
  prayerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  prayerEmoji: { fontSize: 22 },
  prayerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  prayerName: { fontSize: 16, fontWeight: '600' },
  prayerNextBadge: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontWeight: '700' },
  prayerTime: { fontSize: 15, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: Spacing.md, marginTop: Spacing.md },
  actionBtn: { flex: 1, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: 6, borderWidth: 1 },
  actionText: { fontSize: 12, fontWeight: '600' },
  methodCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
  },
  methodLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  methodName: { fontSize: 14 },
  prayersContainer: {},
});
