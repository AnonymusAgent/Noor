import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Spacing, Radius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { fetchPrayerTimesByCoords, formatPrayerTime } from '../../services/prayerService';
import { toDateKey } from '../../lib/date';
import { OFFLINE_HADITHS } from '../../constants/offlineHadithDb';
import { SURAH_LIST } from '../../constants/quranData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Prayer display config ─────────────────────────────────────────────────────
const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
type PrayerName = typeof PRAYER_ORDER[number];

const PRAYER_CONFIG: Record<PrayerName, { emoji: string; color: string }> = {
  Fajr:    { emoji: '🌙', color: '#5B6FA6' },
  Dhuhr:   { emoji: '☀️', color: '#E8A800' },
  Asr:     { emoji: '🌤️', color: '#E07B00' },
  Maghrib: { emoji: '🌅', color: '#C94830' },
  Isha:    { emoji: '🌃', color: '#2D4A6B' },
};

const DAILY_AYAHS = [
  { arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', translation: 'Indeed, with hardship will be ease.', reference: 'Ash-Sharh 94:6' },
  { arabic: 'وَبَشِّرِ الصَّابِرِينَ', translation: 'And give good tidings to the patient.', reference: 'Al-Baqarah 2:155' },
  { arabic: 'وَاللَّهُ خَيْرُ الرَّازِقِينَ', translation: 'And Allah is the best of providers.', reference: 'Al-Jumuah 62:11' },
  { arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', translation: 'Allah is sufficient for us, the best Disposer of affairs.', reference: 'Al-Imran 3:173' },
  { arabic: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', translation: 'Indeed, Allah is with the patient.', reference: 'Al-Baqarah 2:153' },
  { arabic: 'وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ', translation: 'Do not despair of the mercy of Allah.', reference: 'Yusuf 12:87' },
  { arabic: 'وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ', translation: 'And He is with you wherever you are.', reference: 'Al-Hadid 57:4' },
  { arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', translation: 'For indeed, with hardship will be ease.', reference: 'Ash-Sharh 94:5' },
  { arabic: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا', translation: 'And whoever fears Allah — He will make for him a way out.', reference: 'At-Talaq 65:2' },
  { arabic: 'رَبِّ زِدْنِي عِلْمًا', translation: 'My Lord, increase me in knowledge.', reference: 'Ta-Ha 20:114' },
  { arabic: 'وَتَوَكَّلْ عَلَى اللَّهِ ۚ وَكَفَىٰ بِاللَّهِ وَكِيلًا', translation: 'And rely upon Allah; and sufficient is Allah as Disposer of affairs.', reference: 'Al-Ahzab 33:3' },
  { arabic: 'يُرِيدُ اللَّهُ بِكُمُ الْيُسْرَ وَلَا يُرِيدُ بِكُمُ الْعُسْرَ', translation: 'Allah intends for you ease and does not intend for you hardship.', reference: 'Al-Baqarah 2:185' },
  { arabic: 'وَأَنَّ اللَّهَ مَعَ الْمُؤْمِنِينَ', translation: 'And that Allah is with the believers.', reference: 'Al-Anfal 8:19' },
  { arabic: 'اللَّهُ لَطِيفٌ بِعِبَادِهِ', translation: 'Allah is subtle with His servants.', reference: 'Ash-Shura 42:19' },
];

const QUICK_ACTIONS = [
  { id: 'quran', title: 'Quran', subtitle: '114 Surahs', icon: 'menu-book', color: '#2D6B57', route: '/quran' },
  { id: 'hadith', title: 'Hadith', subtitle: '9 Collections', icon: 'library-books', color: '#2D4A6B', route: '/hadith' },
  { id: 'duas', title: 'Duas', subtitle: 'Daily Azkar', icon: 'favorite', color: '#6B2D4A', route: '/duas' },
  { id: 'ai-guide', title: 'AI Guide', subtitle: 'Ask Islam', icon: 'smart-toy', color: '#2D6B5A', route: '/ai-guide' },
  { id: 'qibla', title: 'Qibla', subtitle: 'Compass', icon: 'explore', color: '#4A6B2D', route: '/qibla' },
  { id: 'tasbeeh', title: 'Tasbeeh', subtitle: 'Counter', icon: 'loop', color: '#6B4A2D', route: '/tasbeeh' },
  { id: 'calendar', title: 'Calendar', subtitle: 'Hijri', icon: 'calendar-today', color: '#6B2D6B', route: '/hijri-calendar' },
  { id: 'prayer-guide', title: 'Prayer', subtitle: 'Guide', icon: 'mosque', color: '#2D2D6B', route: '/prayer-guide' },
  { id: 'asma', title: '99 Names', subtitle: 'Asma Allah', icon: 'star', color: '#5B2D6B', route: '/asma-ul-husna' },
  { id: 'ramadan', title: 'Ramadan', subtitle: 'Companion', icon: 'nightlight', color: '#1B4D8A', route: '/ramadan' },
  { id: 'hajj', title: 'Hajj', subtitle: 'Guide', icon: 'flight-takeoff', color: '#4A2D6B', route: '/hajj-guide' },
  { id: 'stats', title: 'Statistics', subtitle: 'Progress', icon: 'bar-chart', color: '#2D6B4A', route: '/reading-stats' },
  { id: 'search', title: 'Search', subtitle: 'Quran', icon: 'manage-search', color: '#1B5E6B', route: '/quran-search' },
  { id: 'hifz', title: 'Hifz', subtitle: 'Memorize', icon: 'psychology', color: '#2D4A2D', route: '/hifz' },
  { id: 'names', title: 'Names', subtitle: 'Islamic', icon: 'child-care', color: '#2D6B8A', route: '/islamic-names' },
  { id: 'mosque', title: 'Mosques', subtitle: 'Near Me', icon: 'location-on', color: '#2D6B2D', route: '/mosque-finder' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 4) return 'Tahajjud Time 🌌';
  if (h < 12) return 'Good Morning ☀️';
  if (h < 17) return 'Good Afternoon 🌤️';
  if (h < 21) return 'Good Evening 🌅';
  return 'Good Night 🌙';
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function computeCountdown(timings: Record<string, string>): { name: PrayerName; ms: number; timeStr: string } {
  const now = new Date();
  let best: { name: PrayerName; ms: number; timeStr: string } = {
    name: 'Fajr', ms: Infinity, timeStr: '',
  };

  for (const prayer of PRAYER_ORDER) {
    const raw = timings[prayer];
    if (!raw) continue;
    const [hh, mm] = raw.split(':').map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;

    const t = new Date(now);
    t.setHours(hh, mm, 0, 0);
    // If the time already passed today, the next occurrence is tomorrow.
    if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);

    const diff = t.getTime() - now.getTime();
    if (diff < best.ms) best = { name: prayer, ms: diff, timeStr: raw };
  }
  return best;
}

function prayerCompleted(record: any, key: string): boolean {
  return !!(record && record[key]);
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    lastRead, settings, colors: C, salahRecords,
  } = useApp();

  const [prayerTimings, setPrayerTimings] = useState<Record<string, string> | null>(null);
  const [nextPrayer, setNextPrayer] = useState<{ name: PrayerName; ms: number; timeStr: string } | null>(null);
  const [countdown, setCountdown] = useState('--:--');
  const [hijriDate, setHijriDate] = useState('');
  const [loadingPrayer, setLoadingPrayer] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Day-based seeds for daily content
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
  const dailyAyah = DAILY_AYAHS[dayOfYear % DAILY_AYAHS.length];
  const dailyHadith = OFFLINE_HADITHS[dayOfYear % OFFLINE_HADITHS.length];

  // ── Today's Salah record ────────────────────────────────────────────────────
  const today = toDateKey();
  const todayRecord = salahRecords.find(r => r.date === today);
  const todayPrayerCount = todayRecord
    ? PRAYER_ORDER.filter(p => prayerCompleted(todayRecord, p.toLowerCase())).length
    : 0;

  // ── Prayer streak (consecutive days with ≥1 prayer) ────────────────────────
  const prayerStreak = useMemo(() => {
    const loggedCount = (dateKey: string) => {
      const rec = salahRecords.find(r => r.date === dateKey);
      return rec
        ? PRAYER_ORDER.filter(p => rec[p.toLowerCase() as keyof typeof rec]).length
        : 0;
    };

    const d = new Date();
    let streak = 0;
    // Today usually has not been logged yet, so start from yesterday in that case.
    if (loggedCount(toDateKey(d)) === 0) d.setDate(d.getDate() - 1);

    while (streak < 366) {
      if (loggedCount(toDateKey(d)) === 0) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }, [salahRecords]);

  // ── Quran completion ────────────────────────────────────────────────────────
  const quranStats = useMemo(() => {
    const prog = settings.readingProgress || {};
    let totalRead = 0;
    let surahsStarted = 0;

    // `readingProgress` stores the last ayah reached per surah, so the verses
    // actually read in a finished surah is its full verse count, not the index
    // of the last ayah (which would undercount by one per surah).
    for (let i = 1; i <= 114; i++) {
      const lastAyah = prog[i] || 0;
      if (lastAyah > 0) {
        surahsStarted++;
        totalRead += Math.min(
          lastAyah,
          SURAH_LIST[i - 1]?.versesCount ?? lastAyah,
        );
      }
    }
    const totalVerses = 6236;
    const pct = Math.min(100, Math.round((totalRead / totalVerses) * 100));
    return { surahsStarted, totalRead, pct };
  }, [settings.readingProgress]);

  // ── Load prayer times ───────────────────────────────────────────────────────
  useEffect(() => {
    loadHijriDate();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPrayer = async () => {
      setLoadingPrayer(true);
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        const coords = status === 'granted'
          ? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })).coords
          : { latitude: 21.4225, longitude: 39.8262 };
        const data = await fetchPrayerTimesByCoords(
          coords.latitude, coords.longitude, settings.prayerCalculationMethod, settings.madhab
        );
        if (!cancelled) setPrayerTimings(data.timings);
      } catch {
        // Fallback placeholder timings (Makkah approximate)
        if (!cancelled) {
          setPrayerTimings({ Fajr: '05:00', Dhuhr: '12:30', Asr: '15:45', Maghrib: '18:15', Isha: '19:45' });
        }
      } finally {
        if (!cancelled) setLoadingPrayer(false);
      }
    };

    loadPrayer();
    return () => { cancelled = true; };
  }, [settings.prayerCalculationMethod, settings.madhab]);

  const loadHijriDate = async () => {
    try {
      const now = new Date();
      const res = await fetch(
        `https://api.aladhan.com/v1/gToH/${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`
      );
      const json = await res.json();
      if (json.data?.hijri) {
        const h = json.data.hijri;
        setHijriDate(`${h.day} ${h.month.en} ${h.year} AH`);
      }
    } catch { /* silent */ }
  };

  // ── Live countdown ticker ───────────────────────────────────────────────────
  useEffect(() => {
    if (!prayerTimings) return;

    const tick = () => {
      const result = computeCountdown(prayerTimings);
      setNextPrayer(result);
      setCountdown(fmtCountdown(result.ms));
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [prayerTimings]);

  // ── Layout ──────────────────────────────────────────────────────────────────
  const colSize = Math.floor((SCREEN_WIDTH - Spacing.md * 2 - 9 * 3) / 4);
  const prayerCfg = nextPrayer ? PRAYER_CONFIG[nextPrayer.name] : PRAYER_CONFIG.Fajr;

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Hero Header ──────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Image
            source={require('../../assets/images/home-bg.png')}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
          <LinearGradient colors={['rgba(0,0,0,0.06)', C.background]} style={StyleSheet.absoluteFillObject} />
          <View style={[styles.heroContent, { paddingBottom: Spacing.md }]}>
            <View style={styles.heroLeft}>
              <Text style={[styles.bismillah, { color: C.gold }]}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</Text>
              <Text style={[styles.greeting, { color: C.textPrimary }]}>{getGreeting()}</Text>
              <View style={styles.dateRow}>
                {hijriDate ? (
                  <View style={[styles.dateBadge, { backgroundColor: `${C.primary}30` }]}>
                    <MaterialIcons name="calendar-today" size={11} color={C.gold} />
                    <Text style={[styles.dateText, { color: C.gold }]}>{hijriDate}</Text>
                  </View>
                ) : null}
                <Text style={[styles.dateText, { color: C.textMuted, marginLeft: 6 }]}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </View>
            </View>
            <View style={styles.heroRight}>
              <Pressable
                onPress={() => router.push('/reading-stats')}
                style={[styles.heroBtn, { backgroundColor: `${C.gold}20`, borderColor: `${C.gold}30` }]}
              >
                <MaterialIcons name="bar-chart" size={18} color={C.gold} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings')}
                style={[styles.heroBtn, { backgroundColor: `${C.gold}20`, borderColor: `${C.gold}30` }]}
              >
                <MaterialIcons name="settings" size={18} color={C.gold} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Live Prayer Countdown Card ────────────────────────────────────── */}
        <Pressable
          onPress={() => router.push('/prayer')}
          style={[styles.prayerCard, { marginHorizontal: Spacing.md, marginBottom: Spacing.sm }]}
        >
          <LinearGradient
            colors={[C.primaryDark, C.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.prayerGradient}
          >
            {/* Left: prayer info */}
            <View style={styles.prayerLeft}>
              <View style={styles.prayerNameRow}>
                <Text style={styles.prayerEmoji}>{prayerCfg.emoji}</Text>
                <View>
                  <Text style={[styles.prayerNextLabel, { color: `${C.gold}90` }]}>NEXT PRAYER</Text>
                  <Text style={[styles.prayerName, { color: C.textPrimary }]}>
                    {nextPrayer?.name ?? '—'}
                  </Text>
                </View>
              </View>
              {loadingPrayer && !prayerTimings ? (
                <Text style={[styles.prayerActualTime, { color: C.textSecondary }]}>
                  Fetching times…
                </Text>
              ) : nextPrayer?.timeStr ? (
                <Text style={[styles.prayerActualTime, { color: C.textSecondary }]}>
                  {formatPrayerTime(nextPrayer.timeStr)}
                </Text>
              ) : null}

              {/* Prayer dots for today */}
              <View style={styles.prayerDotsRow}>
                {PRAYER_ORDER.map(p => {
                  const done = prayerCompleted(todayRecord, p.toLowerCase());
                  return (
                    <View
                      key={p}
                      style={[
                        styles.prayerDot,
                        { backgroundColor: done ? C.gold : `${C.gold}30` },
                      ]}
                    />
                  );
                })}
                <Text style={[styles.prayerDotLabel, { color: C.textSecondary }]}>
                  {todayPrayerCount}/5 today
                </Text>
              </View>
            </View>

            {/* Right: countdown */}
            <View style={styles.prayerRight}>
              <Text style={[styles.prayerCountdown, { color: C.gold }]}>{countdown}</Text>
              <Text style={[styles.prayerCountdownLabel, { color: `${C.gold}70` }]}>remaining</Text>
            </View>
          </LinearGradient>
        </Pressable>

        {/* ── Stats Row ──────────────────────────────────────────────────────── */}
        <View style={[styles.statsRow, { marginHorizontal: Spacing.md, marginBottom: Spacing.md }]}>
          {/* Quran Progress */}
          <Pressable
            style={[styles.statCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}
            onPress={() => router.push('/reading-stats')}
          >
            <MaterialIcons name="menu-book" size={20} color={C.gold} />
            <Text style={[styles.statNum, { color: C.gold }]}>{quranStats.surahsStarted}</Text>
            <Text style={[styles.statLabel, { color: C.textMuted }]}>Surahs Read</Text>
            {quranStats.pct > 0 ? (
              <View style={[styles.miniBar, { backgroundColor: C.cardBorder }]}>
                <View style={[styles.miniBarFill, { width: `${quranStats.pct}%` as any, backgroundColor: C.gold }]} />
              </View>
            ) : null}
          </Pressable>

          {/* Prayer Streak */}
          <Pressable
            style={[styles.statCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}
            onPress={() => router.push('/salah-tracker')}
          >
            <Text style={styles.statFire}>🔥</Text>
            <Text style={[styles.statNum, { color: '#FF6B35' }]}>{prayerStreak}</Text>
            <Text style={[styles.statLabel, { color: C.textMuted }]}>Day Streak</Text>
            <Text style={[styles.statSub, { color: C.textMuted }]}>prayers</Text>
          </Pressable>

          {/* Today's Prayers */}
          <Pressable
            style={[styles.statCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}
            onPress={() => router.push('/salah-tracker')}
          >
            <MaterialIcons
              name={todayPrayerCount === 5 ? 'verified' : 'radio-button-unchecked'}
              size={20}
              color={todayPrayerCount === 5 ? C.success : C.info}
            />
            <Text style={[styles.statNum, { color: todayPrayerCount === 5 ? C.success : C.info }]}>
              {todayPrayerCount}/5
            </Text>
            <Text style={[styles.statLabel, { color: C.textMuted }]}>Today's</Text>
            <Text style={[styles.statSub, { color: C.textMuted }]}>Salah</Text>
          </Pressable>
        </View>

        {/* ── Continue Reading ───────────────────────────────────────────────── */}
        {lastRead ? (
          <Pressable
            onPress={() => router.push(`/quran/${lastRead.surahNumber}` as any)}
            style={[styles.continueCard, { marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: C.surfaceElevated, borderColor: C.cardBorder }]}
          >
            <View style={[styles.continueIcon, { backgroundColor: `${C.gold}20` }]}>
              <MaterialIcons name="bookmark" size={20} color={C.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.continueLabel, { color: C.textMuted }]}>Continue Reading</Text>
              <Text style={[styles.continueSurah, { color: C.textPrimary }]}>
                {SURAH_LIST[lastRead.surahNumber - 1]?.transliteration ?? `Surah ${lastRead.surahNumber}`} — Verse {lastRead.ayahNumber}
              </Text>
            </View>
            <MaterialIcons name="arrow-forward-ios" size={16} color={C.gold} />
          </Pressable>
        ) : null}

        {/* ── Daily Verse ────────────────────────────────────────────────────── */}
        <Pressable
          onPress={() => router.push('/quran')}
          style={[styles.ayahCard, { marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: C.card, borderColor: `${C.gold}25` }]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIconBox, { backgroundColor: `${C.gold}15` }]}>
              <MaterialIcons name="format-quote" size={14} color={C.gold} />
            </View>
            <Text style={[styles.cardLabel, { color: C.gold }]}>Verse of the Day</Text>
            <MaterialIcons name="chevron-right" size={16} color={C.textMuted} />
          </View>
          <Text style={[styles.ayahArabic, { color: C.textArabic }]}>{dailyAyah.arabic}</Text>
          <Text style={[styles.ayahTranslation, { color: C.textSecondary }]}>{dailyAyah.translation}</Text>
          <Text style={[styles.ayahRef, { color: C.gold }]}>{dailyAyah.reference}</Text>
        </Pressable>

        {/* ── Quick Action Grid ──────────────────────────────────────────────── */}
        <View style={[styles.section, { marginHorizontal: Spacing.md, marginBottom: Spacing.md }]}>
          <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Islamic Library</Text>
          <View style={styles.grid}>
            {QUICK_ACTIONS.map(action => (
              <Pressable
                key={action.id}
                style={({ pressed }) => [
                  styles.gridItem,
                  { width: colSize, backgroundColor: C.card, borderColor: C.cardBorder },
                  pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                ]}
                onPress={() => router.push(action.route as any)}
              >
                <View style={[styles.gridIcon, { backgroundColor: `${action.color}25` }]}>
                  <MaterialIcons name={action.icon as any} size={22} color={action.color + 'CC'} />
                </View>
                <Text style={[styles.gridTitle, { color: C.textPrimary }]} numberOfLines={1}>{action.title}</Text>
                <Text style={[styles.gridSubtitle, { color: C.textMuted }]} numberOfLines={1}>{action.subtitle}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Hadith of the Day ──────────────────────────────────────────────── */}
        <Pressable
          onPress={() => router.push('/hadith')}
          style={[styles.hadithCard, { marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: C.card, borderColor: `${C.primary}40` }]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIconBox, { backgroundColor: `${C.primary}20` }]}>
              <MaterialIcons name="library-books" size={14} color={C.gold} />
            </View>
            <Text style={[styles.cardLabel, { color: C.gold }]}>Hadith of the Day</Text>
            <View style={[styles.gradeBadge, { backgroundColor: `${C.success}15` }]}>
              <Text style={[styles.gradeText, { color: C.success }]}>{dailyHadith.grade}</Text>
            </View>
          </View>
          {dailyHadith.arabic ? (
            <Text style={[styles.hadithArabic, { color: C.textArabic }]} numberOfLines={2}>
              {dailyHadith.arabic}
            </Text>
          ) : null}
          <Text style={[styles.hadithText, { color: C.textPrimary }]} numberOfLines={4}>
            "{dailyHadith.english}"
          </Text>
          <Text style={[styles.hadithMeta, { color: C.textMuted }]}>
            {dailyHadith.narrator} · {dailyHadith.reference}
          </Text>
        </Pressable>

        {/* ── AI Guide Promo ─────────────────────────────────────────────────── */}
        <Pressable
          style={[styles.aiCard, { marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: C.card, borderColor: `${C.success}25` }]}
          onPress={() => router.push('/ai-guide')}
        >
          <LinearGradient colors={[`${C.success}15`, `${C.primary}25`]} style={styles.aiInner}>
            <View style={[styles.aiIcon, { backgroundColor: `${C.success}20` }]}>
              <MaterialIcons name="smart-toy" size={26} color={C.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aiTitle, { color: C.textPrimary }]}>AI Islamic Guide</Text>
              <Text style={[styles.aiDesc, { color: C.textSecondary }]}>
                Ask any Islamic question — powered by Gemini with Quran &amp; Hadith citations.
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={C.textMuted} />
          </LinearGradient>
        </Pressable>

        {/* ── Featured ───────────────────────────────────────────────────────── */}
        <View style={[styles.section, { marginHorizontal: Spacing.md, marginBottom: Spacing.md }]}>
          <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Featured</Text>
          {[
            { id: 'ramadan', title: 'Ramadan Companion', desc: 'Fasting tracker, Suhoor/Iftar times & duas', icon: '🌙', color: '#1B4D8A', route: '/ramadan' },
            { id: 'asma', title: 'Asma-ul-Husna', desc: '99 Beautiful Names of Allah with meanings', icon: '✨', color: '#5B2D6B', route: '/asma-ul-husna' },
            { id: 'hajj', title: 'Hajj & Umrah Guide', desc: 'Step-by-step rituals, duas & packing list', icon: '🕋', color: '#4A2D6B', route: '/hajj-guide' },
            { id: 'salah', title: 'Salah Tracker', desc: '5 daily prayers · 30-day streak · achievements', icon: '🕌', color: '#2D6B3A', route: '/salah-tracker' },
          ].map(card => (
            <Pressable
              key={card.id}
              style={({ pressed }) => [
                styles.featCard,
                { backgroundColor: C.card, borderColor: C.cardBorder },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => router.push(card.route as any)}
            >
              <View style={[styles.featIcon, { backgroundColor: `${card.color}20` }]}>
                <Text style={styles.featEmoji}>{card.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featTitle, { color: C.textPrimary }]}>{card.title}</Text>
                <Text style={[styles.featDesc, { color: C.textSecondary }]}>{card.desc}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={C.textMuted} />
            </Pressable>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  hero: { height: 190, position: 'relative', marginBottom: Spacing.xs },
  heroContent: {
    position: 'absolute', bottom: 0, left: Spacing.md, right: Spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  heroLeft: { flex: 1 },
  bismillah: { fontSize: 17, fontWeight: '600', textAlign: 'right' },
  greeting: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  dateText: { fontSize: 11 },
  heroRight: { flexDirection: 'row', gap: 8, marginLeft: Spacing.sm },
  heroBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  // Prayer card
  prayerCard: { borderRadius: Radius.lg, overflow: 'hidden' },
  prayerGradient: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md, paddingVertical: 18,
  },
  prayerLeft: { flex: 1 },
  prayerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  prayerEmoji: { fontSize: 28 },
  prayerNextLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  prayerName: { fontSize: 22, fontWeight: '800', marginTop: 1 },
  prayerActualTime: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  prayerDotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prayerDot: { width: 10, height: 10, borderRadius: 5 },
  prayerDotLabel: { fontSize: 11, fontWeight: '500', marginLeft: 4 },
  prayerRight: { alignItems: 'center', gap: 4 },
  prayerCountdown: { fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  prayerCountdownLabel: { fontSize: 11, fontWeight: '600' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, alignItems: 'center', borderRadius: Radius.lg, borderWidth: 1,
    paddingVertical: 14, paddingHorizontal: 6, gap: 3,
  },
  statFire: { fontSize: 20 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  statSub: { fontSize: 10, textAlign: 'center' },
  miniBar: { width: '80%', height: 4, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 2 },

  // Continue Reading
  continueCard: {
    borderRadius: Radius.md, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1,
  },
  continueIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  continueLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  continueSurah: { fontSize: 15, fontWeight: '600', marginTop: 2 },

  // Verse card
  ayahCard: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  cardIconBox: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
  ayahArabic: { fontSize: 24, fontWeight: '400', textAlign: 'right', lineHeight: 44, marginBottom: Spacing.xs },
  ayahTranslation: { fontSize: 14, lineHeight: 22, fontStyle: 'italic', marginBottom: 4 },
  ayahRef: { fontSize: 11, fontWeight: '600' },

  // Grid
  section: {},
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  gridItem: { alignItems: 'center', borderRadius: Radius.md, padding: 10, borderWidth: 1 },
  gridIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  gridTitle: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  gridSubtitle: { fontSize: 9, textAlign: 'center', marginTop: 1 },

  // Hadith card
  hadithCard: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1 },
  hadithArabic: { fontSize: 18, textAlign: 'right', lineHeight: 34, marginBottom: Spacing.sm },
  hadithText: { fontSize: 14, lineHeight: 22, fontStyle: 'italic', marginBottom: 6 },
  hadithMeta: { fontSize: 11 },
  gradeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  gradeText: { fontSize: 10, fontWeight: '700' },

  // AI card
  aiCard: { borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1 },
  aiInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  aiIcon: { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  aiTitle: { fontSize: 15, fontWeight: '700' },
  aiDesc: { fontSize: 12, lineHeight: 18, marginTop: 2 },

  // Featured cards
  featCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, gap: Spacing.md, marginBottom: 10,
  },
  featIcon: { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  featEmoji: { fontSize: 24 },
  featTitle: { fontSize: 14, fontWeight: '700' },
  featDesc: { fontSize: 12, lineHeight: 18, marginTop: 2 },
});
