import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import {
  fetchMonthlyPrayerTimes,
  formatPrayerTime,
  PrayerTimesData,
  sanitizeTime,
} from '../services/prayerService';
import { toDateKey, parseDateKey } from '../lib/date';

const PRAYER_COLUMNS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Monthly prayer timetable.
 *
 * `fetchMonthlyPrayerTimes` already existed in the prayer service but nothing
 * called it, so there was no way to look beyond today. This is the missing
 * screen: a scrollable month with the five daily prayers, today highlighted,
 * and the next/previous month controls people actually need when travelling.
 */
export default function PrayerTimesMonthlyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, settings } = useApp();

  const today = useMemo(() => new Date(), []);
  const [monthDate, setMonthDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [days, setDays] = useState<PrayerTimesData[]>([]);
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTwelveHour, setShowTwelveHour] = useState(true);

  const month = monthDate.getMonth();
  const year = monthDate.getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let coords: { latitude: number; longitude: number } | null = null;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        const granted = status === 'granted'
          ? true
          : (await Location.requestForegroundPermissionsAsync()).status === 'granted';

        if (granted) {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = pos.coords;
        }
      } catch { /* fall through to the Makkah default below */ }

      const data = coords
        ? await fetchMonthlyPrayerTimes(
            coords.latitude, coords.longitude, year, month + 1, settings.prayerCalculationMethod,
          )
        : [];

      if (!coords) {
        setError('Location permission is needed to build the monthly timetable.');
        setDays([]);
        return;
      }

      setDays(data);

      // Location name is cosmetic; a failure must not blank the timetable.
      if (coords) {
        const geocode = await Location.reverseGeocodeAsync(coords).catch(() => []);
        const g = geocode[0];
        setLocationName(g ? [g.city || g.subregion, g.country].filter(Boolean).join(', ') : '');
      }
    } catch {
      setError('Could not load this month. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [month, year, settings.prayerCalculationMethod]);

  useEffect(() => { load(); }, [load]);

  const todayKey = toDateKey(today);

  const shiftMonth = (delta: number) => {
    setMonthDate(new Date(year, month + delta, 1));
  };

  const dayKey = (day: PrayerTimesData): string => {
    const greg = day?.date?.gregorian;
    if (greg?.date) {
      // AlAdhan's gregorian.date is DD-MM-YYYY.
      const [d, m, y] = String(greg.date).split('-').map(Number);
      if (d && m && y) return toDateKey(new Date(y, m - 1, d));
    }
    return '';
  };

  const displayTime = (raw: string) => {
    const clean = sanitizeTime(raw);
    if (!showTwelveHour) return clean || '—';
    return formatPrayerTime(raw);
  };

  const renderHeader = () => (
    <>
      <View style={[styles.controls, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        <Pressable onPress={() => shiftMonth(-1)} style={styles.monthBtn} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={24} color={C.gold} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.monthLabel, { color: C.textPrimary }]}>
            {MONTH_NAMES[month]} {year}
          </Text>
          {locationName ? (
            <Text style={[styles.locationLabel, { color: C.textMuted }]}>{locationName}</Text>
          ) : null}
        </View>
        <Pressable onPress={() => shiftMonth(1)} style={styles.monthBtn} hitSlop={8}>
          <MaterialIcons name="chevron-right" size={24} color={C.gold} />
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <Pressable
          onPress={() => setShowTwelveHour(v => !v)}
          style={[styles.toggle, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}
        >
          <MaterialIcons name="schedule" size={14} color={C.gold} />
          <Text style={[styles.toggleText, { color: C.gold }]}>
            {showTwelveHour ? '12-hour' : '24-hour'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1))}
          style={[styles.toggle, { backgroundColor: `${C.info}15`, borderColor: `${C.info}30` }]}
        >
          <MaterialIcons name="today" size={14} color={C.info} />
          <Text style={[styles.toggleText, { color: C.info }]}>This month</Text>
        </Pressable>
      </View>

      {/* Column headings */}
      <View style={[styles.row, styles.headRow, { borderBottomColor: C.divider }]}>
        <Text style={[styles.headCell, styles.dateCell, { color: C.textMuted }]}>DATE</Text>
        {PRAYER_COLUMNS.map(p => (
          <Text key={p} style={[styles.headCell, { color: C.textMuted }]}>{p.slice(0, 3).toUpperCase()}</Text>
        ))}
      </View>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: C.cardBorder }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Monthly Timetable</Text>
          <Text style={[styles.headerSub, { color: C.textMuted }]}>
            Calculation method: {settings.prayerCalculationMethod} · Asr: {settings.madhab === 1 ? 'Hanafi' : 'Standard'}
          </Text>
        </View>
        <Pressable onPress={load} style={styles.backBtn}>
          <MaterialIcons name="refresh" size={20} color={C.gold} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={[styles.centerText, { color: C.textSecondary }]}>Loading timetable…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={48} color={C.error} />
          <Text style={[styles.centerText, { color: C.error, textAlign: 'center' }]}>{error}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: C.primary }]} onPress={load}>
            <Text style={[styles.retryText, { color: C.gold }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={days}
          keyExtractor={(day, index) => dayKey(day) || String(index)}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const key = dayKey(item);
            const isToday = key === todayKey;
            const greg = item?.date?.gregorian;
            const weekday = greg?.weekday?.en?.slice(0, 3) ?? parseDateKey(key || todayKey).toDateString().slice(0, 3);
            return (
              <View
                style={[
                  styles.row,
                  { borderBottomColor: C.divider },
                  isToday && { backgroundColor: `${C.gold}12` },
                ]}
              >
                <View style={styles.dateCell}>
                  <Text style={[styles.dayNum, { color: isToday ? C.gold : C.textPrimary }]}>
                    {greg?.day ?? key.slice(-2)}
                  </Text>
                  <Text style={[styles.dayName, { color: C.textMuted }]}>{weekday}</Text>
                </View>
                {PRAYER_COLUMNS.map(p => (
                  <Text
                    key={p}
                    style={[styles.cell, { color: isToday ? C.gold : C.textSecondary }]}
                  >
                    {displayTime(item.timings?.[p])}
                  </Text>
                ))}
              </View>
            );
          }}
          ListFooterComponent={
            <Text style={[styles.footer, { color: C.textMuted }]}>
              Times are calculated for your current location. If you travel, reopen this screen to refresh.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg },
  centerText: { fontSize: 14 },
  retryBtn: { marginTop: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: 10, borderRadius: Radius.md },
  retryText: { fontWeight: '700' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  monthBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700' },
  locationLabel: { fontSize: 11, marginTop: 2 },
  toolbar: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.round,
    borderWidth: 1,
  },
  toggleText: { fontSize: 11, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.md },
  headRow: { borderBottomWidth: 1 },
  headCell: { flex: 1, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textAlign: 'center' },
  dateCell: { width: 48, flex: 0 },
  cell: { flex: 1, fontSize: 12, textAlign: 'center', fontVariant: ['tabular-nums'] },
  dayNum: { fontSize: 15, fontWeight: '700' },
  dayName: { fontSize: 10 },
  footer: { fontSize: 11, textAlign: 'center', padding: Spacing.lg, lineHeight: 16 },
});
