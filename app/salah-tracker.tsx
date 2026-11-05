import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { parseDateKey, toDateKey } from '../lib/date';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRAYERS = [
  { key: 'fajr', label: 'Fajr', emoji: '🌙', time: '5:00 AM', color: '#5B6FA6' },
  { key: 'dhuhr', label: 'Dhuhr', emoji: '☀️', time: '12:30 PM', color: '#E8A800' },
  { key: 'asr', label: 'Asr', emoji: '🌤️', time: '4:00 PM', color: '#E07B00' },
  { key: 'maghrib', label: 'Maghrib', emoji: '🌅', time: '7:30 PM', color: '#C94830' },
  { key: 'isha', label: "Isha'", emoji: '🌃', time: '9:00 PM', color: '#2D4A6B' },
] as const;

type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

interface BadgeDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  threshold: number; // streak days needed
}

const BADGES: BadgeDef[] = [
  { id: 'week', title: 'Week Warrior', desc: '7-day full prayer streak', icon: '🥉', color: '#CD7F32', threshold: 7 },
  { id: 'month', title: 'Month Master', desc: '30-day full prayer streak', icon: '🥈', color: '#C0C0C0', threshold: 30 },
  { id: 'century', title: 'Century Champion', desc: '100-day full prayer streak', icon: '🥇', color: '#FFD700', threshold: 100 },
  { id: 'halfyear', title: 'Devoted Worshipper', desc: '180-day full prayer streak', icon: '🏆', color: '#4CAF50', threshold: 180 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toDateKey(d);
}

function getPastDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => getDateStr(-(n - 1 - i)));
}

function getPrayerCount(record: any): number {
  if (!record) return 0;
  return PRAYERS.filter(p => record[p.key]).length;
}

function getHeatColor(count: number): string {
  if (count === 0) return '#2A2A2A';
  if (count <= 2) return '#3A6B57';
  if (count <= 4) return '#2D8B6B';
  return '#4CAF7D';
}

function calculateStreak(salahRecords: any[]): { current: number; longest: number } {
  const today = getDateStr(0);
  let current = 0;
  let longest = 0;

  // Current streak (backwards from today). Today may still be incomplete, so
  // start from yesterday when today is not yet a full-prayer day.
  const d = new Date();
  if (getPrayerCount(salahRecords.find(r => r.date === today)) !== 5) {
    d.setDate(d.getDate() - 1);
  }
  while (true) {
    const ds = toDateKey(d);
    const rec = salahRecords.find(r => r.date === ds);
    if (rec && getPrayerCount(rec) === 5) {
      current++;
      longest = Math.max(longest, current);
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // Scan all records for longest streak
  const sorted = [...salahRecords].sort((a, b) => a.date.localeCompare(b.date));
  let tempStreak = 0;
  let prevDate: string | null = null;
  for (const rec of sorted) {
    if (getPrayerCount(rec) === 5) {
      if (prevDate) {
        const prev = parseDateKey(prevDate);
        prev.setDate(prev.getDate() + 1);
        const expectedNext = toDateKey(prev);
        if (rec.date === expectedNext) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      longest = Math.max(longest, tempStreak);
      prevDate = rec.date;
    } else {
      tempStreak = 0;
      prevDate = null;
    }
  }

  return { current, longest };
}

function getMonthlyStats(salahRecords: any[]) {
  const today = new Date();
  const monthStr = toDateKey(today).slice(0, 7); // YYYY-MM

  const stats: Record<PrayerKey, { offered: number; total: number }> = {
    fajr: { offered: 0, total: 0 },
    dhuhr: { offered: 0, total: 0 },
    asr: { offered: 0, total: 0 },
    maghrib: { offered: 0, total: 0 },
    isha: { offered: 0, total: 0 },
  };

  // Count days passed this month
  const daysPassed = today.getDate();
  PRAYERS.forEach(p => {
    stats[p.key].total = daysPassed;
  });

  for (const rec of salahRecords) {
    if (!rec.date.startsWith(monthStr)) continue;
    PRAYERS.forEach(p => {
      if (rec[p.key]) stats[p.key].offered++;
    });
  }

  return stats;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SalahTrackerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, salahRecords, toggleSalah, updateSalahJournal } = useApp();

  const today = getDateStr(0);
  const todayRecord = salahRecords.find(r => r.date === today);
  const todayCount = getPrayerCount(todayRecord);

  const { current: streak, longest } = useMemo(() => calculateStreak(salahRecords), [salahRecords]);
  const monthlyStats = useMemo(() => getMonthlyStats(salahRecords), [salahRecords]);

  const past30 = getPastDays(30);
  const heatCells = past30.map(date => {
    const rec = salahRecords.find(r => r.date === date);
    return { date, count: getPrayerCount(rec) };
  });

  const [journalText, setJournalText] = useState(todayRecord?.journal || '');
  const [journalSaved, setJournalSaved] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const handleTogglePrayer = (prayer: PrayerKey) => {
    toggleSalah(today, prayer);
  };

  const handleSaveJournal = async () => {
    await updateSalahJournal(today, journalText);
    setJournalSaved(true);
    setTimeout(() => setJournalSaved(false), 2000);
  };

  const earnedBadges = BADGES.filter(b => longest >= b.threshold);

  const totalOffered = PRAYERS.reduce((sum, p) => {
    return sum + salahRecords.filter(r => r[p.key]).length;
  }, 0);

  // Only days on which at least one prayer was logged can count towards the rate.
  const trackedDays = salahRecords.filter(r => getPrayerCount(r) > 0).length;
  const totalPossible = Math.max(trackedDays * 5, totalOffered);
  const completionRate = totalPossible > 0 ? Math.round((totalOffered / totalPossible) * 100) : 0;

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Salah Tracker</Text>
            <Text style={[styles.headerDate, { color: C.textSecondary }]}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          <View style={[styles.streakPill, { backgroundColor: `${C.gold}20`, borderColor: `${C.gold}30` }]}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={[styles.streakNum, { color: C.gold }]}>{streak}</Text>
          </View>
        </View>

        {/* Today summary bar */}
        <View style={[styles.todaySummary, { backgroundColor: `${C.gold}10`, borderColor: `${C.gold}20` }]}>
          <View style={styles.todayProgress}>
            {PRAYERS.map((p, i) => (
              <View
                key={p.key}
                style={[
                  styles.todayDot,
                  { backgroundColor: todayRecord?.[p.key] ? C.gold : `${C.gold}30` },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.todaySummaryText, { color: C.textSecondary }]}>
            {todayCount}/5 prayers today
          </Text>
          <View style={[styles.todayPct, { backgroundColor: todayCount === 5 ? `${C.success}20` : `${C.gold}15` }]}>
            <Text style={[styles.todayPctText, { color: todayCount === 5 ? C.success : C.gold }]}>
              {Math.round((todayCount / 5) * 100)}%
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Today's Prayers ────────────────────────────────────────────── */}
        <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.md }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted }]}>TODAY'S PRAYERS</Text>
          <View style={[styles.sectionCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            {PRAYERS.map((prayer, idx) => {
              const offered = todayRecord?.[prayer.key] ?? false;
              return (
                <React.Fragment key={prayer.key}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.prayerRow,
                      pressed && { backgroundColor: C.surfaceElevated },
                      offered && { backgroundColor: `${C.success}06` },
                    ]}
                    onPress={() => handleTogglePrayer(prayer.key)}
                  >
                    <View style={[styles.prayerEmoji, { backgroundColor: `${prayer.color}15` }]}>
                      <Text style={styles.prayerEmojiText}>{prayer.emoji}</Text>
                    </View>
                    <View style={styles.prayerInfo}>
                      <Text style={[styles.prayerName, { color: C.textPrimary }]}>{prayer.label}</Text>
                      <Text style={[styles.prayerTime, { color: C.textMuted }]}>{prayer.time}</Text>
                    </View>
                    <View style={[
                      styles.prayerCheck,
                      offered
                        ? { backgroundColor: C.success, borderColor: C.success }
                        : { backgroundColor: 'transparent', borderColor: C.cardBorder },
                    ]}>
                      {offered && <MaterialIcons name="check" size={16} color="white" />}
                    </View>
                  </Pressable>
                  {idx < PRAYERS.length - 1 && <View style={[styles.divider, { backgroundColor: C.cardBorder }]} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* ── Streak Stats ───────────────────────────────────────────────── */}
        <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted }]}>STREAK OVERVIEW</Text>
          <View style={styles.streakRow}>
            <View style={[styles.streakCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={styles.streakCardFire}>🔥</Text>
              <Text style={[styles.streakCardNum, { color: C.gold }]}>{streak}</Text>
              <Text style={[styles.streakCardLabel, { color: C.textMuted }]}>Current Streak</Text>
              <Text style={[styles.streakCardSub, { color: C.textMuted }]}>consecutive days</Text>
            </View>
            <View style={[styles.streakCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={styles.streakCardFire}>🏆</Text>
              <Text style={[styles.streakCardNum, { color: C.info }]}>{longest}</Text>
              <Text style={[styles.streakCardLabel, { color: C.textMuted }]}>Longest Streak</Text>
              <Text style={[styles.streakCardSub, { color: C.textMuted }]}>personal best</Text>
            </View>
            <View style={[styles.streakCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={styles.streakCardFire}>🕌</Text>
              <Text style={[styles.streakCardNum, { color: C.success }]}>{totalOffered}</Text>
              <Text style={[styles.streakCardLabel, { color: C.textMuted }]}>Total Prayers</Text>
              <Text style={[styles.streakCardSub, { color: C.textMuted }]}>
                {completionRate}% of logged days
              </Text>
            </View>
          </View>
        </View>

        {/* ── 30-Day Heatmap ─────────────────────────────────────────────── */}
        <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: C.textMuted }]}>30-DAY HEATMAP</Text>
            <View style={styles.heatLegend}>
              {[0, 2, 4, 5].map(c => (
                <View key={c} style={[styles.heatLegendDot, { backgroundColor: getHeatColor(c) }]} />
              ))}
              <Text style={[styles.heatLegendText, { color: C.textMuted }]}>0→5</Text>
            </View>
          </View>

          <View style={[styles.heatGrid, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            {/* Day labels */}
            <View style={styles.heatDayLabels}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <Text key={d} style={[styles.heatDayLabel, { color: C.textMuted }]}>{d}</Text>
              ))}
            </View>

            {/* Build weekly grid: find the Sunday before or on the first of our 30-day range */}
            {(() => {
              const cells = heatCells;
              // Pad the start so the first cell aligns to correct weekday
              const firstDate = new Date(cells[0].date);
              const startDay = firstDate.getDay(); // 0 = Sunday
              const paddedCells = [
                ...Array.from({ length: startDay }, () => null),
                ...cells,
              ];
              // Group into weeks
              const weeks: (typeof cells[number] | null)[][] = [];
              for (let i = 0; i < paddedCells.length; i += 7) {
                weeks.push(paddedCells.slice(i, i + 7));
              }

              return (
                <View style={styles.heatWeeksRow}>
                  {weeks.map((week, wi) => (
                    <View key={wi} style={styles.heatWeek}>
                      {Array.from({ length: 7 }, (_, di) => {
                        const cell = week[di];
                        if (!cell) return <View key={di} style={styles.heatCellEmpty} />;
                        const isToday = cell.date === today;
                        return (
                          <Pressable
                            key={di}
                            style={[
                              styles.heatCell,
                              { backgroundColor: getHeatColor(cell.count) },
                              isToday && { borderWidth: 2, borderColor: C.gold },
                            ]}
                            onPress={() => setSelectedDay(cell.date === selectedDay ? null : cell.date)}
                          >
                            {selectedDay === cell.date && (
                              <View style={[styles.heatTooltip, { backgroundColor: C.surface }]}>
                                <Text style={[styles.heatTooltipText, { color: C.textPrimary }]}>
                                  {new Date(cell.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: {cell.count}/5
                                </Text>
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        </View>

        {/* ── Monthly Stats ──────────────────────────────────────────────── */}
        <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted }]}>THIS MONTH</Text>
          <View style={[styles.sectionCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            {PRAYERS.map((prayer, idx) => {
              const stat = monthlyStats[prayer.key];
              const pct = stat.total > 0 ? Math.round((stat.offered / stat.total) * 100) : 0;
              return (
                <React.Fragment key={prayer.key}>
                  <View style={styles.statRow}>
                    <Text style={[styles.statEmoji]}>{prayer.emoji}</Text>
                    <Text style={[styles.statLabel, { color: C.textPrimary }]}>{prayer.label}</Text>
                    <View style={styles.statBarWrap}>
                      <View style={[styles.statBar, { backgroundColor: C.cardBorder }]}>
                        <View
                          style={[
                            styles.statBarFill,
                            {
                              width: `${pct}%` as any,
                              backgroundColor: pct >= 80 ? C.success : pct >= 50 ? C.gold : C.warning,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={[styles.statPct, { color: pct >= 80 ? C.success : pct >= 50 ? C.gold : C.warning }]}>
                      {pct}%
                    </Text>
                    <Text style={[styles.statCount, { color: C.textMuted }]}>
                      {stat.offered}/{stat.total}
                    </Text>
                  </View>
                  {idx < PRAYERS.length - 1 && <View style={[styles.divider, { backgroundColor: C.cardBorder }]} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* ── Achievements ───────────────────────────────────────────────── */}
        <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted }]}>
            {`ACHIEVEMENTS · ${earnedBadges.length}/${BADGES.length} EARNED`}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesScroll}>
            {BADGES.map(badge => {
              const earned = longest >= badge.threshold;
              return (
                <View
                  key={badge.id}
                  style={[
                    styles.badgeCard,
                    {
                      backgroundColor: earned ? `${badge.color}15` : C.card,
                      borderColor: earned ? badge.color : C.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.badgeEmoji, { opacity: earned ? 1 : 0.3 }]}>{badge.icon}</Text>
                  <Text style={[styles.badgeTitle, { color: earned ? C.textPrimary : C.textMuted }]}>
                    {badge.title}
                  </Text>
                  <Text style={[styles.badgeDesc, { color: C.textMuted }]}>{badge.desc}</Text>
                  {!earned && (
                    <View style={[styles.badgeLock, { backgroundColor: C.surfaceElevated }]}>
                      <Text style={[styles.badgeLockText, { color: C.textMuted }]}>
                        {badge.threshold - longest} days to go
                      </Text>
                    </View>
                  )}
                  {earned && (
                    <View style={[styles.badgeEarned, { backgroundColor: `${badge.color}20` }]}>
                      <MaterialIcons name="verified" size={12} color={badge.color} />
                      <Text style={[styles.badgeEarnedText, { color: badge.color }]}>Earned</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Prayer Journal ─────────────────────────────────────────────── */}
        <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted }]}>TODAY'S JOURNAL</Text>
          <View style={[styles.journalCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <View style={styles.journalHeader}>
              <MaterialIcons name="edit-note" size={18} color={C.gold} />
              <Text style={[styles.journalTitle, { color: C.textPrimary }]}>Reflection & Notes</Text>
            </View>
            <TextInput
              style={[styles.journalInput, {
                color: C.textPrimary,
                backgroundColor: C.surfaceElevated,
                borderColor: C.cardBorder,
              }]}
              placeholder="Write your thoughts, prayers, or reflections for today..."
              placeholderTextColor={C.textMuted}
              value={journalText}
              onChangeText={setJournalText}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <Pressable
              style={[styles.journalSaveBtn, { backgroundColor: journalSaved ? C.success : C.gold }]}
              onPress={handleSaveJournal}
            >
              <MaterialIcons name={journalSaved ? 'check' : 'save'} size={16} color={C.primaryDark} />
              <Text style={[styles.journalSaveText, { color: C.primaryDark }]}>
                {journalSaved ? 'Saved!' : 'Save Journal'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Tips ──────────────────────────────────────────────────────── */}
        <View style={[styles.tipsCard, { backgroundColor: `${C.primary}12`, borderColor: `${C.primary}20`, marginHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
          <Text style={[styles.tipsEmoji]}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tipsTitle, { color: C.gold }]}>Building the Prayer Habit</Text>
            <Text style={[styles.tipsBody, { color: C.textSecondary }]}>
              The Prophet ﷺ said: "The first matter that the slave will be brought to account for on the Day of Judgment is the prayer." (Tirmidhi). Mark each prayer as you complete it to build a consistent habit.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: 4, marginBottom: Spacing.sm },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerDate: { fontSize: 12, marginTop: 2 },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  streakFire: { fontSize: 16 },
  streakNum: { fontSize: 18, fontWeight: '800' },

  todaySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  todayProgress: { flexDirection: 'row', gap: 5 },
  todayDot: { width: 8, height: 8, borderRadius: 4 },
  todaySummaryText: { flex: 1, fontSize: 13, fontWeight: '500' },
  todayPct: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  todayPctText: { fontSize: 13, fontWeight: '700' },

  section: { marginBottom: 0 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1, marginHorizontal: Spacing.md },

  prayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 12,
  },
  prayerEmoji: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  prayerEmojiText: { fontSize: 20 },
  prayerInfo: { flex: 1 },
  prayerName: { fontSize: 16, fontWeight: '600' },
  prayerTime: { fontSize: 12, marginTop: 2 },
  prayerCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  streakRow: { flexDirection: 'row', gap: 10 },
  streakCard: {
    flex: 1,
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 3,
  },
  streakCardFire: { fontSize: 22 },
  streakCardNum: { fontSize: 26, fontWeight: '800' },
  streakCardLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  streakCardSub: { fontSize: 10, textAlign: 'center' },

  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  heatLegendDot: { width: 10, height: 10, borderRadius: 2 },
  heatLegendText: { fontSize: 10, marginLeft: 2 },
  heatGrid: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  heatDayLabels: { flexDirection: 'row', gap: 4, paddingLeft: 2 },
  heatDayLabel: { flex: 1, fontSize: 9, textAlign: 'center', fontWeight: '600' },
  heatWeeksRow: { flexDirection: 'row', gap: 4 },
  heatWeek: { flex: 1, gap: 4 },
  heatCell: {
    height: 14,
    borderRadius: 2,
    position: 'relative',
  },
  heatCellEmpty: { height: 14 },
  heatTooltip: {
    position: 'absolute',
    bottom: 18,
    left: -20,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 10,
    minWidth: 80,
  },
  heatTooltipText: { fontSize: 10, fontWeight: '600', textAlign: 'center' },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 10,
  },
  statEmoji: { fontSize: 18, width: 24, textAlign: 'center' },
  statLabel: { fontSize: 14, fontWeight: '500', width: 56 },
  statBarWrap: { flex: 1 },
  statBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  statBarFill: { height: '100%', borderRadius: 3 },
  statPct: { fontSize: 13, fontWeight: '700', width: 38, textAlign: 'right' },
  statCount: { fontSize: 11, width: 32, textAlign: 'right' },

  badgesScroll: { marginHorizontal: -Spacing.md },
  badgeCard: {
    width: 140,
    marginLeft: Spacing.md,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  badgeEmoji: { fontSize: 36 },
  badgeTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  badgeDesc: { fontSize: 10, textAlign: 'center', lineHeight: 14 },
  badgeLock: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeLockText: { fontSize: 10 },
  badgeEarned: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeEarnedText: { fontSize: 11, fontWeight: '700' },

  journalCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  journalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  journalTitle: { fontSize: 14, fontWeight: '600' },
  journalInput: {
    margin: 12,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 100,
  },
  journalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    margin: 12,
    marginTop: 0,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  journalSaveText: { fontSize: 14, fontWeight: '700' },

  tipsCard: { flexDirection: 'row', gap: 10, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, marginBottom: 8 },
  tipsEmoji: { fontSize: 20 },
  tipsTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  tipsBody: { fontSize: 12, lineHeight: 20 },
});
