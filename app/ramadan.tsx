import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { toDateKey } from '../lib/date';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

const RAMADAN_DUAS = [
  {
    arabic: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي',
    transliteration: 'Allahumma innaka afuwwun tuhibbul afwa fafu anni',
    translation: 'O Allah, You are the Pardoner, You love to forgive, so forgive me.',
    source: 'Tirmidhi 3513 - Recommended for Laylatul Qadr',
    ref: 'Laylatul Qadr Dua',
  },
  {
    arabic: 'اللَّهُمَّ صُمْ قَلْبِي عَنِ الشَّهَوَاتِ',
    transliteration: 'Allahumma sum qalbi anis shahawat',
    translation: 'O Allah, fast with my heart from desires.',
    ref: 'General Fasting Dua',
  },
  {
    arabic: 'ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الأَجْرُ إِنْ شَاءَ اللَّهُ',
    transliteration: 'Dhahaba az-zama wa abtallatil uruq wa thabatal ajru in sha Allah',
    translation: 'The thirst has gone, the veins are moist and the reward is certain if Allah wills.',
    source: 'Abu Dawud 2357',
    ref: 'Dua at Iftar',
  },
  {
    arabic: 'اللَّهُمَّ لَكَ صُمْتُ وَعَلَى رِزْقِكَ أَفْطَرْتُ',
    transliteration: 'Allahumma laka sumtu wa ala rizqika aftartu',
    translation: 'O Allah, I fasted for You and I break my fast with Your sustenance.',
    source: 'Abu Dawud 2358',
    ref: 'Dua at Iftar (alternate)',
  },
];

const RAMADAN_QURAN_GOALS = [
  { label: 'Complete Quran Once', target: 114, icon: '📖' },
  { label: 'Read 1 Juz Daily', target: 30, icon: '📚' },
  { label: 'Read 2 Surahs Daily', target: 60, icon: '🌙' },
  { label: 'Read Short Surahs', target: 20, icon: '✨' },
];

interface SuhoorIftarTimes {
  suhoor: string;
  iftar: string;
}

async function fetchSuhoorIftar(lat: number, lng: number): Promise<SuhoorIftarTimes | null> {
  try {
    const now = new Date();
    const d = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const res = await fetch(`https://api.aladhan.com/v1/timings/${d}?latitude=${lat}&longitude=${lng}&method=3`);
    const data = await res.json();
    if (data.data?.timings) {
      return {
        suhoor: data.data.timings.Fajr,
        iftar: data.data.timings.Maghrib,
      };
    }
  } catch { /* silent */ }
  return null;
}

function parseTime(t: string): Date {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function timeUntil(t: Date): string {
  const now = new Date();
  const diff = t.getTime() - now.getTime();
  if (diff <= 0) return 'Time has passed';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function RamadanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, fastingDays, toggleFastingDay, settings } = useApp();
  const [times, setTimes] = useState<SuhoorIftarTimes | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tracker' | 'duas' | 'goals' | 'virtues'>('tracker');
  const [selectedGoal, setSelectedGoal] = useState(0);
  const [now, setNow] = useState(new Date());

  const today = toDateKey();
  const todayFasted = fastingDays.find(d => d.date === today)?.fasted || false;
  const totalFasts = fastingDays.filter(d => d.fasted).length;
  const thisMonthFasts = fastingDays.filter(d => d.fasted && d.date.startsWith(today.slice(0, 7))).length;
  const readingProgress = settings.readingProgress;
  const surahsRead = Object.keys(readingProgress).length;

  useEffect(() => {
    loadTimes();
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTimes = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const coords = status === 'granted'
        ? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low })).coords
        : { latitude: 21.4225, longitude: 39.8262 };
      const t = await fetchSuhoorIftar(coords.latitude, coords.longitude);
      setTimes(t);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  const suhoorDate = times ? parseTime(times.suhoor) : null;
  const iftarDate = times ? parseTime(times.iftar) : null;
  const isBeforeIftar = iftarDate ? now < iftarDate : true;
  const countdownLabel = isBeforeIftar ? 'Time until Iftar' : 'Time until Suhoor';
  const countdownTime = isBeforeIftar && iftarDate ? timeUntil(iftarDate) : suhoorDate ? timeUntil(suhoorDate) : '--';

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Ramadan Companion</Text>
            <Text style={[styles.headerSub, { color: C.textSecondary }]}>رَمَضَان مُبَارَك</Text>
          </View>
          <Pressable onPress={() => router.push('/hijri-calendar')} style={[styles.calBtn, { backgroundColor: `${C.gold}20` }]}>
            <MaterialIcons name="calendar-today" size={18} color={C.gold} />
          </Pressable>
        </View>

        {/* Suhoor / Iftar Countdown */}
        {loading ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 12 }} />
        ) : times ? (
          <View style={styles.timingCards}>
            <View style={[styles.timingCard, { backgroundColor: `${C.primary}40`, borderColor: `${C.gold}20` }]}>
              <Text style={[styles.timingLabel, { color: C.textMuted }]}>Suhoor</Text>
              <Text style={[styles.timingTime, { color: C.gold }]}>{formatTime12(times.suhoor)}</Text>
            </View>
            <View style={[styles.countdownCard, { backgroundColor: `${C.gold}20`, borderColor: `${C.gold}40` }]}>
              <Text style={[styles.countdownLabel, { color: C.textSecondary }]}>{countdownLabel}</Text>
              <Text style={[styles.countdownTime, { color: C.gold }]}>{countdownTime}</Text>
            </View>
            <View style={[styles.timingCard, { backgroundColor: `${C.primary}40`, borderColor: `${C.gold}20` }]}>
              <Text style={[styles.timingLabel, { color: C.textMuted }]}>Iftar</Text>
              <Text style={[styles.timingTime, { color: C.gold }]}>{formatTime12(times.iftar)}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.noTimings, { backgroundColor: `${C.warning}10` }]}>
            <Text style={[styles.noTimingsText, { color: C.warning }]}>Enable location for accurate Suhoor/Iftar times</Text>
          </View>
        )}
      </LinearGradient>

      {/* Stats Row */}
      <View style={[styles.statsRow, { borderBottomColor: C.cardBorder }]}>
        {[
          { value: totalFasts, label: 'Total Fasts', color: C.gold },
          { value: thisMonthFasts, label: 'This Month', color: C.info },
          { value: surahsRead, label: 'Surahs Read', color: C.success },
        ].map(({ value, label, color }) => (
          <View key={label} style={styles.statItem}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: C.textMuted }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: C.cardBorder }]}>
        {(['tracker', 'duas', 'goals', 'virtues'] as const).map(t => (
          <Pressable
            key={t}
            style={[styles.tab, activeTab === t && [styles.tabActive, { borderBottomColor: C.gold }]]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, { color: activeTab === t ? C.gold : C.textMuted }, activeTab === t && styles.tabTextActive]}>
              {t === 'tracker' ? '📅 Tracker' : t === 'duas' ? '🤲 Duas' : t === 'goals' ? '🎯 Goals' : '✨ Virtues'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {activeTab === 'tracker' && (
          <View style={styles.tabContent}>
            {/* Today's Fast */}
            <Pressable
              style={[styles.todayCard, { backgroundColor: todayFasted ? `${C.success}20` : C.card, borderColor: todayFasted ? C.success : C.cardBorder }]}
              onPress={() => toggleFastingDay(today)}
            >
              <MaterialIcons name={todayFasted ? 'check-circle' : 'radio-button-unchecked'} size={32} color={todayFasted ? C.success : C.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.todayTitle, { color: C.textPrimary }]}>
                  {todayFasted ? 'Today Fasted ✓' : "Log Today's Fast"}
                </Text>
                <Text style={[styles.todayDate, { color: C.textMuted }]}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
              </View>
            </Pressable>

            {/* Last 30 days calendar */}
            <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Fasting Calendar</Text>
            <View style={styles.calendarGrid}>
              {Array.from({ length: 30 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (29 - i));
                const dateStr = toDateKey(d);
                const fasted = fastingDays.find(fd => fd.date === dateStr)?.fasted || false;
                const isToday = dateStr === today;
                return (
                  <Pressable
                    key={i}
                    style={[
                      styles.calCell,
                      { backgroundColor: fasted ? `${C.success}30` : C.card, borderColor: isToday ? C.gold : C.cardBorder },
                      isToday && { borderWidth: 2 },
                    ]}
                    onPress={() => toggleFastingDay(dateStr)}
                  >
                    <Text style={[styles.calNum, { color: fasted ? C.success : isToday ? C.gold : C.textMuted }]}>
                      {d.getDate()}
                    </Text>
                    {fasted && <Text style={styles.calCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>

            {/* Fasting streak */}
            {(() => {
              const fastedDates = new Set(fastingDays.filter(d => d.fasted).map(d => d.date));
              // Today may not be logged yet — start yesterday in that case.
              const cursor = new Date();
              if (!fastedDates.has(toDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
              let streak = 0;
              while (streak < 366 && fastedDates.has(toDateKey(cursor))) {
                streak++;
                cursor.setDate(cursor.getDate() - 1);
              }
              return streak > 0 ? (
                <View style={[styles.streakCard, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}>
                  <Text style={styles.streakEmoji}>🔥</Text>
                  <View>
                    <Text style={[styles.streakNum, { color: C.gold }]}>{streak} Day Streak</Text>
                    <Text style={[styles.streakSub, { color: C.textMuted }]}>Keep it going!</Text>
                  </View>
                </View>
              ) : null;
            })()}
          </View>
        )}

        {activeTab === 'duas' && (
          <View style={styles.tabContent}>
            {RAMADAN_DUAS.map((dua, i) => (
              <View key={i} style={[styles.duaCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Text style={[styles.duaRef, { color: C.gold }]}>{dua.ref}</Text>
                <Text style={[styles.duaArabic, { color: C.textArabic }]}>{dua.arabic}</Text>
                <Text style={[styles.duaTranslit, { color: C.textMuted, fontStyle: 'italic' }]}>{dua.transliteration}</Text>
                <Text style={[styles.duaTranslation, { color: C.textSecondary }]}>{dua.translation}</Text>
                {dua.source && (
                  <View style={[styles.duaSource, { backgroundColor: `${C.success}10` }]}>
                    <MaterialIcons name="verified" size={12} color={C.success} />
                    <Text style={[styles.duaSourceText, { color: C.textMuted }]}>{dua.source}</Text>
                  </View>
                )}
              </View>
            ))}
            <Pressable style={[styles.moreDuasBtn, { borderColor: C.gold }]} onPress={() => router.push('/duas')}>
              <Text style={[styles.moreDuasText, { color: C.gold }]}>View Complete Dua Library →</Text>
            </Pressable>
          </View>
        )}

        {activeTab === 'goals' && (
          <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Quran Reading Goal</Text>
            <View style={styles.goalGrid}>
              {RAMADAN_QURAN_GOALS.map((g, i) => (
                <Pressable
                  key={i}
                  style={[
                    styles.goalCard,
                    { backgroundColor: C.card, borderColor: C.cardBorder },
                    selectedGoal === i && { borderColor: C.gold, backgroundColor: `${C.gold}10` },
                  ]}
                  onPress={() => setSelectedGoal(i)}
                >
                  <Text style={styles.goalIcon}>{g.icon}</Text>
                  <Text style={[styles.goalLabel, { color: selectedGoal === i ? C.gold : C.textPrimary }]}>{g.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Reading Progress */}
            <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Reading Progress</Text>
            <View style={[styles.progressCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <View style={styles.progressStats}>
                <View style={styles.progressStat}>
                  <Text style={[styles.progressStatNum, { color: C.gold }]}>{surahsRead}</Text>
                  <Text style={[styles.progressStatLabel, { color: C.textMuted }]}>Surahs Started</Text>
                </View>
                <View style={styles.progressStat}>
                  <Text style={[styles.progressStatNum, { color: C.success }]}>{Math.round((surahsRead / 114) * 100)}%</Text>
                  <Text style={[styles.progressStatLabel, { color: C.textMuted }]}>Complete</Text>
                </View>
              </View>
              <View style={[styles.progressBarOuter, { backgroundColor: C.cardBorder }]}>
                <View style={[styles.progressBarFill, { width: `${(surahsRead / 114) * 100}%`, backgroundColor: C.gold }]} />
              </View>
              <Pressable style={[styles.continueReading, { backgroundColor: `${C.primary}30` }]} onPress={() => router.push('/quran')}>
                <MaterialIcons name="menu-book" size={16} color={C.gold} />
                <Text style={[styles.continueReadingText, { color: C.gold }]}>Continue Reading Quran</Text>
              </Pressable>
            </View>

            {/* Taraweeh Tracker */}
            <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Worship Tracker</Text>
            {[
              { label: 'Taraweeh Prayer', arabic: 'تراويح', description: '8 or 20 Rakahs after Isha' },
              { label: 'Qiyam al-Layl', arabic: 'قيام الليل', description: 'Night prayer in last 10 nights' },
              { label: 'Itikaf', arabic: 'اعتكاف', description: 'Seclusion in mosque last 10 days' },
              { label: 'Laylatul Qadr', arabic: 'ليلة القدر', description: 'Night of Power - odd nights 21-29' },
            ].map((item, i) => (
              <View key={i} style={[styles.worshipItem, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.worshipRow}>
                    <Text style={[styles.worshipLabel, { color: C.textPrimary }]}>{item.label}</Text>
                    <Text style={[styles.worshipArabic, { color: C.gold }]}>{item.arabic}</Text>
                  </View>
                  <Text style={[styles.worshipDesc, { color: C.textMuted }]}>{item.description}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'virtues' && (
          <View style={styles.tabContent}>
            {[
              {
                title: 'Fasting is for Allah',
                arabic: 'الصَّوْمُ لِي وَأَنَا أَجْزِي بِهِ',
                hadith: '"Fasting is for Me and I will reward it. The fasting person gives up food, drink and desires for My sake..."',
                ref: 'Sahih al-Bukhari 1904',
              },
              {
                title: 'Laylatul Qadr',
                arabic: 'لَيْلَةُ الْقَدْرِ خَيْرٌ مِّنْ أَلْفِ شَهْرٍ',
                hadith: '"The Night of Power is better than a thousand months."',
                ref: 'Quran 97:3',
              },
              {
                title: 'Gates of Paradise',
                arabic: 'إِذَا جَاءَ رَمَضَانُ فُتِّحَتْ أَبْوَابُ الْجَنَّةِ',
                hadith: '"When Ramadan comes, the gates of Paradise are opened, the gates of Hell are closed and the devils are chained."',
                ref: 'Sahih al-Bukhari 1899',
              },
              {
                title: 'The Fast-Breaker Dua',
                arabic: 'ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الأَجْرُ',
                hadith: '"The thirst has gone, the veins are moist and the reward is certain if Allah wills."',
                ref: 'Abu Dawud 2357',
              },
              {
                title: 'Charity in Ramadan',
                arabic: 'كَانَ النَّبِيُّ أَجْوَدَ النَّاسِ',
                hadith: '"The Prophet was the most generous person, and he was even more generous in Ramadan when Jibril met him."',
                ref: 'Sahih al-Bukhari 6',
              },
            ].map((item, i) => (
              <View key={i} style={[styles.virtueCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Text style={[styles.virtueTitle, { color: C.gold }]}>{item.title}</Text>
                <Text style={[styles.virtueArabic, { color: C.textArabic }]}>{item.arabic}</Text>
                <Text style={[styles.virtueHadith, { color: C.textSecondary, fontStyle: 'italic' }]}>{item.hadith}</Text>
                <View style={[styles.virtueRef, { backgroundColor: `${C.success}10` }]}>
                  <MaterialIcons name="verified" size={12} color={C.success} />
                  <Text style={[styles.virtueRefText, { color: C.textMuted }]}>{item.ref}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 16, marginTop: 2 },
  calBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  timingCards: { flexDirection: 'row', gap: 8 },
  timingCard: { flex: 1, padding: 12, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1 },
  timingLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  timingTime: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  countdownCard: { flex: 2, padding: 12, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1 },
  countdownLabel: { fontSize: 10, textTransform: 'uppercase', fontWeight: '600' },
  countdownTime: { fontSize: 20, fontWeight: '700', marginTop: 4, fontVariant: ['tabular-nums'] },
  noTimings: { padding: 12, borderRadius: Radius.md },
  noTimingsText: { fontSize: 12, textAlign: 'center' },
  statsRow: { flexDirection: 'row', borderBottomWidth: 1 },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: {},
  tabText: { fontSize: 12, fontWeight: '500' },
  tabTextActive: { fontWeight: '700' },
  tabContent: { padding: Spacing.md, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  todayTitle: { fontSize: 16, fontWeight: '700' },
  todayDate: { fontSize: 13, marginTop: 2 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  calCell: {
    width: (width - Spacing.md * 2 - 6 * 5) / 6,
    height: 44,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  calNum: { fontSize: 13, fontWeight: '600' },
  calCheck: { fontSize: 8, marginTop: 1 },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  streakEmoji: { fontSize: 28 },
  streakNum: { fontSize: 18, fontWeight: '700' },
  streakSub: { fontSize: 12 },
  duaCard: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1 },
  duaRef: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  duaArabic: { fontSize: 20, textAlign: 'right', lineHeight: 36, marginBottom: 6 },
  duaTranslit: { fontSize: 13, lineHeight: 20, marginBottom: 4 },
  duaTranslation: { fontSize: 14, lineHeight: 22 },
  duaSource: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, padding: 6, borderRadius: 6 },
  duaSourceText: { fontSize: 11 },
  moreDuasBtn: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center' },
  moreDuasText: { fontSize: 14, fontWeight: '600' },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  goalCard: { width: (width - Spacing.md * 2 - 10) / 2, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, alignItems: 'center' },
  goalIcon: { fontSize: 28, marginBottom: 6 },
  goalLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  progressCard: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1 },
  progressStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.md },
  progressStat: { alignItems: 'center' },
  progressStatNum: { fontSize: 28, fontWeight: '700' },
  progressStatLabel: { fontSize: 11, marginTop: 2 },
  progressBarOuter: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: Spacing.md },
  progressBarFill: { height: '100%', borderRadius: 4 },
  continueReading: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, justifyContent: 'center' },
  continueReadingText: { fontSize: 14, fontWeight: '600' },
  worshipItem: { borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1 },
  worshipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  worshipLabel: { fontSize: 15, fontWeight: '600' },
  worshipArabic: { fontSize: 16 },
  worshipDesc: { fontSize: 12, marginTop: 4 },
  virtueCard: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1 },
  virtueTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  virtueArabic: { fontSize: 18, textAlign: 'right', lineHeight: 32, marginBottom: 6 },
  virtueHadith: { fontSize: 13, lineHeight: 20 },
  virtueRef: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, borderRadius: 6, marginTop: 8 },
  virtueRefText: { fontSize: 11 },
});
