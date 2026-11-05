/**
 * Enhanced Reading Statistics Screen — Weekly Quran bar chart, Hadith counter,
 * 30-day prayer heatmap, streak milestone badges, and reading achievements.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { SURAH_LIST } from '../constants/quranData';
import { toDateKey } from '../lib/date';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - Spacing.md * 2 - 32;
const PRAYER_NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return toDateKey(d);
}

function getShortDay(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()];
}

function getShortDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getDate()}`;
}

// ─── Bar Chart (weekly verses read) ──────────────────────────────────────────

function WeeklyBarChart({
  data,
  maxVal,
  colors: C,
}: {
  data: { day: string; verses: number }[];
  maxVal: number;
  colors: any;
}) {
  const barW = Math.floor((CHART_WIDTH - 6 * 8) / 7);
  const chartH = 80;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: chartH + 32 }}>
      {data.map((d, i) => {
        const barH = maxVal > 0 ? Math.max(4, (d.verses / maxVal) * chartH) : 4;
        const isToday = i === 6;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            {d.verses > 0 && (
              <Text style={{ fontSize: 9, color: C.textMuted, marginBottom: 2 }}>{d.verses}</Text>
            )}
            <View
              style={{
                width: barW,
                height: barH,
                borderRadius: 6,
                backgroundColor: isToday ? C.gold : `${C.gold}50`,
              }}
            />
            <Text style={{ fontSize: 10, color: isToday ? C.gold : C.textMuted, fontWeight: isToday ? '700' : '400' }}>
              {d.day}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Prayer Heatmap (30 days) ─────────────────────────────────────────────────

function PrayerHeatmap({ records, C }: { records: Record<string, any>; C: any }) {
  const cells = Array.from({ length: 30 }, (_, i) => {
    const key = getDateKey(29 - i);
    const rec = records[key];
    const count = rec
      ? Object.values(rec.prayers || {}).filter(Boolean).length
      : 0;
    return { key, count, date: getShortDate(29 - i) };
  });

  const getColor = (count: number) => {
    if (count === 0) return C.cardBorder;
    if (count === 1) return `${C.primary}40`;
    if (count === 2) return `${C.primary}65`;
    if (count === 3) return `${C.primary}85`;
    if (count === 4) return C.primary;
    return C.gold; // 5/5
  };

  const cellSize = Math.floor((CHART_WIDTH - 29 * 4) / 30);

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {cells.map((cell, i) => (
          <View key={cell.key} style={{ alignItems: 'center', gap: 2 }}>
            <View
              style={{
                width: cellSize,
                height: cellSize,
                borderRadius: 3,
                backgroundColor: getColor(cell.count),
              }}
            />
            {i % 5 === 0 && (
              <Text style={{ fontSize: 7, color: C.textMuted }}>{cell.date}</Text>
            )}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, justifyContent: 'flex-end' }}>
        <Text style={{ fontSize: 10, color: C.textMuted }}>0</Text>
        {[0, 1, 2, 3, 4, 5].map(v => (
          <View key={v} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: getColor(v) }} />
        ))}
        <Text style={{ fontSize: 10, color: C.textMuted }}>5/5</Text>
      </View>
    </View>
  );
}

// ─── Streak Badge ─────────────────────────────────────────────────────────────

function StreakBadge({ days, earned, C }: { days: number; earned: boolean; C: any }) {
  const icons: Record<number, string> = { 7: '🌙', 30: '⭐', 100: '🏆', 365: '👑' };
  const labels: Record<number, string> = { 7: '7-Day', 30: '30-Day', 100: '100-Day', 365: '1-Year' };

  return (
    <View
      style={[
        {
          alignItems: 'center',
          padding: 12,
          borderRadius: Radius.md,
          borderWidth: 1.5,
          flex: 1,
          opacity: earned ? 1 : 0.4,
        },
        earned
          ? { backgroundColor: `${C.gold}12`, borderColor: C.gold }
          : { backgroundColor: C.card, borderColor: C.cardBorder },
      ]}
    >
      <Text style={{ fontSize: 24 }}>{icons[days] || '🔥'}</Text>
      <Text style={[{ fontSize: 12, fontWeight: '700', marginTop: 4 }, { color: earned ? C.gold : C.textSecondary }]}>
        {labels[days]}
      </Text>
      <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>Streak</Text>
      {earned && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
          <MaterialIcons name="verified" size={12} color={C.gold} />
          <Text style={{ fontSize: 9, color: C.gold, fontWeight: '600' }}>Earned</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReadingStatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, settings, dailyTasbeehHistory, bookmarks, notes, fastingDays, salahRecords } = useApp();
  const [activeTab, setActiveTab] = useState<'quran' | 'hadith' | 'prayer'>('quran');

  // Convert SalahRecord[] array to date-keyed map for O(1) lookup
  const salahRecordMap = useMemo(() => {
    const map: Record<string, { prayers: Record<string, boolean>; journal?: string }> = {};
    for (const rec of (salahRecords || [])) {
      map[rec.date] = {
        prayers: { fajr: rec.fajr, dhuhr: rec.dhuhr, asr: rec.asr, maghrib: rec.maghrib, isha: rec.isha },
        journal: rec.journal,
      };
    }
    return map;
  }, [salahRecords]);

  const readingProgress = settings.readingProgress;
  const progressEntries = Object.entries(readingProgress);
  const surahsStarted = progressEntries.length;
  const surahsCompleted = progressEntries.filter(([k, v]) => {
    const surah = SURAH_LIST[parseInt(k) - 1];
    return surah && v >= surah.versesCount;
  }).length;
  const totalAyahsRead = progressEntries.reduce((sum, [key, lastAyah]) => {
    const surah = SURAH_LIST[parseInt(key, 10) - 1];
    return sum + (surah ? Math.min(lastAyah, surah.versesCount) : lastAyah);
  }, 0);
  const totalAyahs = 6236;
  const completionPct = Math.min(100, Math.round((totalAyahsRead / totalAyahs) * 100));
  const juzCompleted = Math.min(30, Math.floor((totalAyahsRead / totalAyahs) * 30));
  const pagesRead = Math.min(604, Math.floor((totalAyahsRead / totalAyahs) * 604));

  // ── Weekly Quran Bar Chart ──────────────────────────────────────────────────
  // We estimate daily verses from tasbeeh history as a proxy (no per-day verse tracking yet)
  // Real verse-per-day tracking would need date stamps on readingProgress entries
  const weeklyData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const daysAgo = 6 - i;
      const dateKey = getDateKey(daysAgo);
      // Check tasbeeh activity as proxy for engagement
      const tasbeehEntry = dailyTasbeehHistory.find(h => h.date === dateKey);
      // Also check if any salah were recorded that day
      const salahEntry = salahRecordMap?.[dateKey];
      const salahCount = salahEntry
        ? Object.values(salahEntry.prayers || {}).filter(Boolean).length
        : 0;
      // Estimate: if user was engaged, they might have read Quran
      const estimatedVerses = tasbeehEntry?.count
        ? Math.min(50, Math.floor(tasbeehEntry.count / 20))
        : 0;
      return {
        day: getShortDay(daysAgo),
        verses: estimatedVerses,
        date: dateKey,
        salah: salahCount,
      };
    });
  }, [dailyTasbeehHistory, salahRecordMap]);

  const maxWeeklyVerses = Math.max(1, ...weeklyData.map(d => d.verses));

  // ── Prayer Stats ───────────────────────────────────────────────────────────
  const records = salahRecordMap;
  const todayKey = getDateKey(0);
  const todayRecord = records[todayKey];
  const todayPrayersCount = todayRecord
    ? Object.values(todayRecord.prayers || {}).filter(Boolean).length
    : 0;

  // Total prayers last 30 days
  const totalPrayers30d = useMemo(() => {
    let total = 0;
    for (let i = 0; i < 30; i++) {
      const key = getDateKey(i);
      const rec = records[key];
      if (rec) total += Object.values(rec.prayers || {}).filter(Boolean).length;
    }
    return total;
  }, [records]);

  const possiblePrayers30d = 30 * 5;
  const prayerCompletion30d = Math.round((totalPrayers30d / possiblePrayers30d) * 100);

  // Per-prayer completion rates
  const perPrayerRates = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of PRAYER_NAMES) counts[p] = 0;
    for (let i = 0; i < 30; i++) {
      const rec = records[getDateKey(i)];
      if (rec) {
        for (const p of PRAYER_NAMES) {
          if (rec.prayers?.[p]) counts[p]++;
        }
      }
    }
    return counts;
  }, [records]);

  // ── Streaks ────────────────────────────────────────────────────────────────
  const prayerStreak = useMemo(() => {
    const countFor = (key: string) => {
      const rec = records[key];
      return rec ? Object.values(rec.prayers || {}).filter(Boolean).length : 0;
    };
    // Today is often still in progress, so don't reset the streak on it.
    const start = countFor(getDateKey(0)) >= 3 ? 0 : 1;
    let streak = 0;
    for (let i = start; i < 365; i++) {
      if (countFor(getDateKey(i)) >= 3) streak++;
      else break;
    }
    return streak;
  }, [records]);

  const tasbeehStreak = useMemo(() => {
    const byDate = new Map(dailyTasbeehHistory.map(h => [h.date, h.count]));
    const start = (byDate.get(getDateKey(0)) || 0) > 0 ? 0 : 1;
    let streak = 0;
    for (let i = start; i < 366; i++) {
      if ((byDate.get(getDateKey(i)) || 0) > 0) streak++;
      else break;
    }
    return streak;
  }, [dailyTasbeehHistory]);

  const maxStreak = Math.max(prayerStreak, tasbeehStreak);

  // ── Hadith stats ───────────────────────────────────────────────────────────
  const hadithBookmarks = bookmarks.filter(b => b.type === 'hadith').length;
  const hadithNotes = notes.filter(n => n.type === 'hadith').length;

  // ── Most read surahs ───────────────────────────────────────────────────────
  const topSurahs = useMemo(() =>
    progressEntries
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([k, v]) => ({ surah: SURAH_LIST[parseInt(k) - 1], ayahsRead: v }))
      .filter(s => s.surah),
    [progressEntries]
  );

  const tasbeehTotal = dailyTasbeehHistory.reduce((s, d) => s + d.count, 0);
  const fastingTotal = fastingDays.filter(d => d.fasted).length;

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Reading Statistics</Text>
            <Text style={[styles.headerSub, { color: C.textSecondary }]}>Your Islamic journey progress</Text>
          </View>
        </View>

        {/* Quran Completion Ring */}
        <View style={styles.ringArea}>
          <View style={[styles.ringOuter, { borderColor: `${C.gold}40` }]}>
            <View style={[styles.ringInner, { backgroundColor: `${C.gold}15` }]}>
              <Text style={[styles.ringPct, { color: C.gold }]}>{completionPct}%</Text>
              <Text style={[styles.ringLabel, { color: C.textSecondary }]}>Quran</Text>
            </View>
          </View>
          <View style={styles.ringStats}>
            {[
              { label: 'Ayahs', value: totalAyahsRead.toLocaleString(), color: C.gold },
              { label: 'Surahs', value: `${surahsStarted}/114`, color: C.info },
              { label: 'Juz', value: `${juzCompleted}/30`, color: C.success },
              { label: 'Pages', value: `${pagesRead}/604`, color: C.warning },
            ].map(({ label, value, color }) => (
              <View key={label} style={[styles.ringStat, { backgroundColor: `${color}15` }]}>
                <Text style={[styles.ringStatVal, { color }]}>{value}</Text>
                <Text style={[styles.ringStatLabel, { color: C.textMuted }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: C.surface, borderBottomColor: C.cardBorder }]}>
        {(['quran', 'prayer', 'hadith'] as const).map(tab => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: C.gold, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <MaterialIcons
              name={tab === 'quran' ? 'menu-book' : tab === 'prayer' ? 'mosque' : 'library-books'}
              size={16}
              color={activeTab === tab ? C.gold : C.textMuted}
            />
            <Text style={[styles.tabText, { color: activeTab === tab ? C.gold : C.textMuted }]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── QURAN TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'quran' && (
          <>
            {/* Key stats grid */}
            <View style={[styles.statsGrid, { paddingHorizontal: Spacing.md, paddingTop: Spacing.md }]}>
              {[
                { icon: 'auto-stories', label: 'Completed', value: surahsCompleted, color: C.success },
                { icon: 'bookmark', label: 'Bookmarks', value: bookmarks.length, color: C.gold },
                { icon: 'note', label: 'Notes', value: notes.length, color: C.info },
                { icon: 'local-fire-department', label: 'Day Streak', value: maxStreak, color: '#FF6B35' },
                { icon: 'loop', label: 'Tasbeeh', value: tasbeehTotal.toLocaleString(), color: C.warning },
                { icon: 'favorite', label: 'Fasts', value: fastingTotal, color: C.error },
              ].map(({ icon, label, value, color }) => (
                <View key={label} style={[styles.statCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                  <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
                    <MaterialIcons name={icon as any} size={20} color={color} />
                  </View>
                  <Text style={[styles.statValue, { color }]}>{value}</Text>
                  <Text style={[styles.statLabel, { color: C.textMuted }]}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Weekly reading bar chart */}
            <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Weekly Activity</Text>
                <Text style={[styles.sectionSub, { color: C.textMuted }]}>Last 7 days</Text>
              </View>
              <View style={[styles.chartCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <WeeklyBarChart data={weeklyData} maxVal={maxWeeklyVerses} colors={C} />
                <Text style={[styles.chartNote, { color: C.textMuted }]}>
                  Based on daily engagement. Enable daily tracking for precise verse counts.
                </Text>
              </View>
            </View>

            {/* Top Surahs */}
            {topSurahs.length > 0 && (
              <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
                <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Most Read Surahs</Text>
                <View style={[styles.listCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                  {topSurahs.map(({ surah, ayahsRead }, i) => {
                    const pct = Math.min(100, (ayahsRead / surah.versesCount) * 100);
                    return (
                      <Pressable
                        key={surah.number}
                        style={[styles.surahRow, i > 0 && { borderTopColor: C.cardBorder, borderTopWidth: 1 }]}
                        onPress={() => router.push(`/quran/${surah.number}` as any)}
                      >
                        <View style={[styles.rankBadge, { backgroundColor: `${C.gold}15` }]}>
                          <Text style={[styles.rankText, { color: C.gold }]}>#{i + 1}</Text>
                        </View>
                        <View style={styles.surahInfo}>
                          <View style={styles.surahNameRow}>
                            <Text style={[styles.surahName, { color: C.textPrimary }]}>{surah.transliteration}</Text>
                            <Text style={[styles.surahArabic, { color: C.textArabic }]}>{surah.arabicName}</Text>
                          </View>
                          <View style={[styles.progressBar, { backgroundColor: C.cardBorder }]}>
                            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: C.gold }]} />
                          </View>
                          <Text style={[styles.surahProgress, { color: C.textMuted }]}>
                            {ayahsRead}/{surah.versesCount} verses · {Math.round(pct)}%
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Streak Milestone Badges */}
            <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
              <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Streak Milestones</Text>
              <View style={styles.badgeRow}>
                {[7, 30, 100, 365].map(days => (
                  <StreakBadge key={days} days={days} earned={maxStreak >= days} C={C} />
                ))}
              </View>
              <View style={[styles.streakInfo, { backgroundColor: `${C.info}10`, borderColor: `${C.info}20` }]}>
                <MaterialIcons name="local-fire-department" size={14} color="#FF6B35" />
                <Text style={[styles.streakInfoText, { color: C.textSecondary }]}>
                  Current best streak: <Text style={{ color: '#FF6B35', fontWeight: '700' }}>{maxStreak} days</Text>
                </Text>
              </View>
            </View>

            {/* Quran Achievements */}
            <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
              <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Achievements</Text>
              <View style={styles.achievementGrid}>
                {[
                  { icon: '📖', title: 'First Surah', desc: 'Read any Surah', earned: surahsStarted >= 1 },
                  { icon: '📚', title: 'Scholar', desc: 'Read 10 Surahs', earned: surahsStarted >= 10 },
                  { icon: '🌙', title: 'Hifz Journey', desc: 'Read 30 Surahs', earned: surahsStarted >= 30 },
                  { icon: '🕌', title: 'Khatam', desc: 'Complete Quran', earned: surahsCompleted >= 114 },
                  { icon: '🤲', title: 'Dhikr Master', desc: '1000 Tasbeeh', earned: tasbeehTotal >= 1000 },
                  { icon: '🌟', title: 'Ramadan Fast', desc: 'Log 10 fasts', earned: fastingTotal >= 10 },
                  { icon: '📝', title: 'Annotator', desc: 'Write 5 notes', earned: notes.length >= 5 },
                  { icon: '🔖', title: 'Curator', desc: '10 bookmarks', earned: bookmarks.length >= 10 },
                  { icon: '🔥', title: 'Consistent', desc: '7-day streak', earned: maxStreak >= 7 },
                ].map((a, i) => (
                  <View
                    key={i}
                    style={[
                      styles.achievement,
                      { backgroundColor: C.card, borderColor: a.earned ? C.gold : C.cardBorder },
                      !a.earned && { opacity: 0.45 },
                    ]}
                  >
                    <Text style={styles.achievementIcon}>{a.icon}</Text>
                    <Text style={[styles.achievementTitle, { color: a.earned ? C.gold : C.textSecondary }]}>{a.title}</Text>
                    <Text style={[styles.achievementDesc, { color: C.textMuted }]}>{a.desc}</Text>
                    {a.earned && <MaterialIcons name="verified" size={13} color={C.gold} style={{ marginTop: 3 }} />}
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ── PRAYER TAB ────────────────────────────────────────────────────── */}
        {activeTab === 'prayer' && (
          <>
            {/* Today's summary */}
            <View style={[styles.section, { paddingHorizontal: Spacing.md, paddingTop: Spacing.md }]}>
              <View style={[styles.todayCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <View style={styles.todayLeft}>
                  <Text style={[styles.todayTitle, { color: C.textPrimary }]}>Today</Text>
                  <Text style={[styles.todayCount, { color: C.gold }]}>{todayPrayersCount}/5</Text>
                  <Text style={[styles.todayLabel, { color: C.textMuted }]}>Prayers Completed</Text>
                </View>
                <View style={styles.todayDots}>
                  {PRAYER_NAMES.map(p => (
                    <View key={p} style={styles.dotRow}>
                      <View style={[
                        styles.prayerDot,
                        { backgroundColor: todayRecord?.prayers?.[p] ? C.gold : C.cardBorder }
                      ]} />
                      <Text style={[styles.prayerDotLabel, { color: C.textMuted }]}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* 30-Day Heatmap */}
            <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>30-Day Prayer Heatmap</Text>
                <Text style={[styles.sectionSub, { color: C.textMuted }]}>{prayerCompletion30d}% completion</Text>
              </View>
              <View style={[styles.chartCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <PrayerHeatmap records={records} C={C} />
              </View>
            </View>

            {/* Per-prayer rates */}
            <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
              <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Last 30 Days — Per Prayer</Text>
              <View style={[styles.listCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                {PRAYER_NAMES.map((p, i) => {
                  const count = perPrayerRates[p] || 0;
                  const pct = Math.round((count / 30) * 100);
                  const pColor = pct >= 80 ? C.success : pct >= 50 ? C.gold : C.error;
                  return (
                    <View
                      key={p}
                      style={[
                        styles.prayerStatRow,
                        i > 0 && { borderTopColor: C.cardBorder, borderTopWidth: 1 },
                      ]}
                    >
                      <Text style={[styles.prayerStatName, { color: C.textPrimary }]}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                      <View style={styles.prayerStatBar}>
                        <View style={[styles.prayerStatBarFill, { width: `${pct}%`, backgroundColor: pColor }]} />
                      </View>
                      <Text style={[styles.prayerStatPct, { color: pColor }]}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Prayer streak badges */}
            <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
              <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Prayer Streak Milestones</Text>
              <View style={styles.badgeRow}>
                {[7, 30, 100, 365].map(days => (
                  <StreakBadge key={days} days={days} earned={prayerStreak >= days} C={C} />
                ))}
              </View>
              <Pressable
                style={[styles.gotoBtn, { backgroundColor: `${C.primary}20`, borderColor: `${C.primary}40` }]}
                onPress={() => router.push('/salah-tracker' as any)}
              >
                <MaterialIcons name="mosque" size={16} color={C.primary} />
                <Text style={[styles.gotoBtnText, { color: C.primary }]}>Open Salah Tracker</Text>
                <MaterialIcons name="chevron-right" size={16} color={C.primary} />
              </Pressable>
            </View>
          </>
        )}

        {/* ── HADITH TAB ────────────────────────────────────────────────────── */}
        {activeTab === 'hadith' && (
          <>
            <View style={[styles.section, { paddingHorizontal: Spacing.md, paddingTop: Spacing.md }]}>
              {/* Summary cards */}
              <View style={styles.hadithSummary}>
                {[
                  { icon: 'library-books', label: 'Saved Hadiths', value: hadithBookmarks, color: C.gold },
                  { icon: 'note', label: 'Hadith Notes', value: hadithNotes, color: C.info },
                  { icon: 'offline-bolt', label: 'Offline Available', value: '180+', color: C.success },
                  { icon: 'cloud-download', label: 'Online Loaded', value: 'Cache', color: C.primary },
                ].map(({ icon, label, value, color }) => (
                  <View key={label} style={[styles.hadithStatCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                    <View style={[styles.hadithStatIcon, { backgroundColor: `${color}20` }]}>
                      <MaterialIcons name={icon as any} size={22} color={color} />
                    </View>
                    <Text style={[styles.hadithStatValue, { color }]}>{value}</Text>
                    <Text style={[styles.hadithStatLabel, { color: C.textMuted }]}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* API Language Note */}
              <View style={[styles.languageNote, { backgroundColor: `${C.warning}12`, borderColor: `${C.warning}30` }]}>
                <MaterialIcons name="translate" size={16} color={C.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.languageNoteTitle, { color: C.warning }]}>Online Source Language Note</Text>
                  <Text style={[styles.languageNoteText, { color: C.textSecondary }]}>
                    The primary Hadith API provides Arabic and Indonesian translations; the fallback editions provide Arabic and English text with section references. Curated offline records remain available when a network is unavailable.
                  </Text>
                </View>
              </View>

              {/* Collections summary */}
              <Text style={[styles.sectionTitle, { color: C.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
                Collection Coverage
              </Text>
              <View style={[styles.listCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                {[
                  { name: 'Nawawi 40', offline: 42, total: 42 },
                  { name: 'Sahih Bukhari', offline: 34, total: 7563 },
                  { name: 'Sahih Muslim', offline: 25, total: 7470 },
                  { name: 'Abu Dawud', offline: 12, total: 5274 },
                  { name: 'Tirmidhi', offline: 15, total: 3956 },
                  { name: "An-Nasa'i", offline: 8, total: 5758 },
                  { name: 'Ibn Majah', offline: 10, total: 4341 },
                  { name: 'Muwatta Malik', offline: 10, total: 1832 },
                  { name: 'Riyad as-Salihin', offline: 20, total: 1896 },
                  { name: 'Bulugh al-Maram', offline: 14, total: 1358 },
                ].map((col, i) => {
                  const offlinePct = Math.min(100, (col.offline / col.total) * 100);
                  return (
                    <View
                      key={col.name}
                      style={[styles.collectionRow, i > 0 && { borderTopColor: C.cardBorder, borderTopWidth: 1 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.collectionRowName, { color: C.textPrimary }]}>{col.name}</Text>
                        <View style={[styles.progressBar, { backgroundColor: C.cardBorder, marginTop: 4 }]}>
                          <View style={[styles.progressFill, { width: `${Math.max(1, offlinePct)}%`, backgroundColor: C.success }]} />
                        </View>
                      </View>
                      <View style={styles.collectionRowRight}>
                        <Text style={[styles.collectionOffline, { color: C.success }]}>{col.offline}</Text>
                        <Text style={[styles.collectionTotal, { color: C.textMuted }]}>/{col.total.toLocaleString()}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Quick nav */}
              <View style={styles.quickNavRow}>
                <Pressable
                  style={[styles.gotoBtn, { backgroundColor: `${C.primary}20`, borderColor: `${C.primary}40`, flex: 1 }]}
                  onPress={() => router.push('/hadith' as any)}
                >
                  <MaterialIcons name="library-books" size={16} color={C.primary} />
                  <Text style={[styles.gotoBtnText, { color: C.primary }]}>Browse Collections</Text>
                </Pressable>
                <Pressable
                  style={[styles.gotoBtn, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30`, flex: 1 }]}
                  onPress={() => router.push('/hadith/search' as any)}
                >
                  <MaterialIcons name="search" size={16} color={C.gold} />
                  <Text style={[styles.gotoBtnText, { color: C.gold }]}>Search Hadiths</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: Spacing.md, paddingBottom: Spacing.xl },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },

  ringArea: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  ringOuter: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 5, alignItems: 'center', justifyContent: 'center',
  },
  ringInner: {
    width: 92, height: 92, borderRadius: 46,
    alignItems: 'center', justifyContent: 'center',
  },
  ringPct: { fontSize: 24, fontWeight: '800' },
  ringLabel: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  ringStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  ringStat: { borderRadius: Radius.sm, padding: 7, alignItems: 'center', minWidth: 58 },
  ringStatVal: { fontSize: 14, fontWeight: '700' },
  ringStatLabel: { fontSize: 9, marginTop: 1 },

  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '600' },

  section: {},
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionSub: { fontSize: 12 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: (width - Spacing.md * 2 - 20) / 3,
    borderRadius: Radius.md, padding: 12,
    alignItems: 'center', borderWidth: 1,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, textAlign: 'center', marginTop: 2 },

  chartCard: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1 },
  chartNote: { fontSize: 11, marginTop: 8, textAlign: 'center', fontStyle: 'italic' },

  listCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  surahRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  rankBadge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 11, fontWeight: '700' },
  surahInfo: { flex: 1 },
  surahNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  surahName: { fontSize: 14, fontWeight: '600' },
  surahArabic: { fontSize: 15 },
  progressBar: { height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 3 },
  progressFill: { height: '100%', borderRadius: 3 },
  surahProgress: { fontSize: 10 },

  badgeRow: { flexDirection: 'row', gap: 8 },
  streakInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.sm,
  },
  streakInfoText: { fontSize: 13 },

  achievementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  achievement: {
    width: (width - Spacing.md * 2 - 16) / 3,
    borderRadius: Radius.md, padding: 10,
    alignItems: 'center', borderWidth: 1,
  },
  achievementIcon: { fontSize: 22, marginBottom: 4 },
  achievementTitle: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  achievementDesc: { fontSize: 9, textAlign: 'center', marginTop: 2 },

  // Prayer tab
  todayCard: {
    borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
  },
  todayLeft: { alignItems: 'center' },
  todayTitle: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  todayCount: { fontSize: 32, fontWeight: '800' },
  todayLabel: { fontSize: 10, marginTop: 2 },
  todayDots: { flex: 1, gap: 8 },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prayerDot: { width: 14, height: 14, borderRadius: 7 },
  prayerDotLabel: { fontSize: 13 },
  prayerStatRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, gap: 10,
  },
  prayerStatName: { width: 68, fontSize: 13, fontWeight: '600' },
  prayerStatBar: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: 'transparent', overflow: 'hidden',
  },
  prayerStatBarFill: { height: '100%', borderRadius: 4 },
  prayerStatPct: { width: 38, textAlign: 'right', fontSize: 12, fontWeight: '700' },

  gotoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.md,
  },
  gotoBtnText: { fontSize: 13, fontWeight: '600', flex: 1 },

  // Hadith tab
  hadithSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  hadithStatCard: {
    width: (width - Spacing.md * 2 - 10) / 2,
    borderRadius: Radius.md, padding: 14,
    alignItems: 'center', borderWidth: 1, gap: 4,
  },
  hadithStatIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hadithStatValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  hadithStatLabel: { fontSize: 11, textAlign: 'center' },
  languageNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 12, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.md,
  },
  languageNoteTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  languageNoteText: { fontSize: 12, lineHeight: 18 },
  collectionRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, gap: 10,
  },
  collectionRowName: { fontSize: 13, fontWeight: '600' },
  collectionRowRight: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  collectionOffline: { fontSize: 14, fontWeight: '700' },
  collectionTotal: { fontSize: 11 },
  quickNavRow: { flexDirection: 'row', gap: 8 },
});
