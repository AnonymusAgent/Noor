/**
 * Hifz (Quran Memorization) Screen — Daily targets, per-surah progress tracking,
 * revision scheduler, weak verse detection, listening/test mode, streak notifications.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Modal, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { SURAH_LIST } from '../constants/quranData';
import { fetchSurah, getAyahAudioUrl } from '../services/quranService';
import { toDateKey } from '../lib/date';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SurahHifzProgress {
  surahNum: number;
  memorizedAyahs: number[];  // ayah numbers memorized
  weakAyahs: number[];       // ayah numbers flagged as weak
  memorizedAt?: Record<number, number>; // ayah number -> timestamp memorized
  lastRevised?: number;      // timestamp
  startedAt?: number;
  completedAt?: number;
}

interface HifzSettings {
  dailyTarget: number;       // ayahs per day
  activeReciter: string;
  revisionIntervalDays: number;
  testMode: boolean;
}

interface HifzStats {
  totalMemorized: number;
  totalSurahs: number;
  currentStreak: number;
  longestStreak: number;
  weeklyProgress: number[];  // last 7 days counts
}

type ActiveTab = 'overview' | 'surahs' | 'revision' | 'test';

const STORAGE_KEY = 'hifz_data_v2';
const SETTINGS_KEY = 'hifz_settings_v2';

const TOTAL_QURAN_AYAHS = 6236;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRevisionDue(progress: SurahHifzProgress, intervalDays: number): boolean {
  if (!progress.lastRevised) return progress.memorizedAyahs.length > 0;
  const daysSince = (Date.now() - progress.lastRevised) / (1000 * 60 * 60 * 24);
  return daysSince >= intervalDays;
}

function getCompletionPct(progress: SurahHifzProgress, surahNum: number): number {
  const total = SURAH_LIST[surahNum - 1]?.versesCount || 1;
  return Math.round((progress.memorizedAyahs.length / total) * 100);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HifzScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, settings: appSettings } = useApp();

  const [progress, setProgress] = useState<Record<number, SurahHifzProgress>>({});
  const [hifzSettings, setHifzSettings] = useState<HifzSettings>({
    dailyTarget: 3,
    activeReciter: appSettings.selectedReciter,
    revisionIntervalDays: 3,
    testMode: false,
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(true);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [showSurahModal, setShowSurahModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Test / Listen mode
  const [testSurahNum, setTestSurahNum] = useState<number | null>(null);
  const [testAyahs, setTestAyahs] = useState<{ num: number; text: string }[]>([]);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [testScore, setTestScore] = useState<{ correct: number; incorrect: number }>({ correct: 0, incorrect: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    loadData();
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  const loadData = async () => {
    try {
      const [progressRaw, settingsRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(SETTINGS_KEY),
      ]);
      if (progressRaw) setProgress(JSON.parse(progressRaw));
      if (settingsRaw) setHifzSettings(s => ({ ...s, ...JSON.parse(settingsRaw) }));
    } catch { /* use defaults */ }
    setLoading(false);
  };

  const saveProgress = async (updated: Record<number, SurahHifzProgress>) => {
    setProgress(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const saveSettings = async (updated: Partial<HifzSettings>) => {
    const newSettings = { ...hifzSettings, ...updated };
    setHifzSettings(newSettings);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  // Toggle a memorized ayah
  const toggleMemorized = useCallback(async (surahNum: number, ayahNum: number) => {
    const current = progress[surahNum] || {
      surahNum,
      memorizedAyahs: [],
      weakAyahs: [],
      startedAt: Date.now(),
    };
    const mem = current.memorizedAyahs.includes(ayahNum)
      ? current.memorizedAyahs.filter(a => a !== ayahNum)
      : [...current.memorizedAyahs, ayahNum];

    const total = SURAH_LIST[surahNum - 1]?.versesCount || 1;
    const memorizedAt = { ...(current.memorizedAt || {}) };
    if (mem.includes(ayahNum)) memorizedAt[ayahNum] = Date.now();
    else delete memorizedAt[ayahNum];

    const updated = {
      ...progress,
      [surahNum]: {
        ...current,
        memorizedAyahs: mem,
        memorizedAt,
        lastRevised: Date.now(),
        completedAt: mem.length === total ? Date.now() : undefined,
      },
    };
    await saveProgress(updated);
  }, [progress]);

  const markWeak = useCallback(async (surahNum: number, ayahNum: number) => {
    const current = progress[surahNum] || { surahNum, memorizedAyahs: [], weakAyahs: [] };
    const weak = current.weakAyahs.includes(ayahNum)
      ? current.weakAyahs.filter(a => a !== ayahNum)
      : [...current.weakAyahs, ayahNum];
    await saveProgress({ ...progress, [surahNum]: { ...current, weakAyahs: weak } });
  }, [progress]);

  const markRevised = useCallback(async (surahNum: number) => {
    const current = progress[surahNum];
    if (!current) return;
    await saveProgress({ ...progress, [surahNum]: { ...current, lastRevised: Date.now() } });
  }, [progress]);

  // Verses memorised per local calendar day (for today's goal + streaks).
  const dailyMemorized = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of Object.values(progress)) {
      for (const ts of Object.values(p.memorizedAt || {})) {
        if (!ts) continue;
        const key = toDateKey(new Date(ts));
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return counts;
  }, [progress]);

  // Stats
  const stats: HifzStats = React.useMemo(() => {
    const totalMem = Object.values(progress).reduce((s, p) => s + p.memorizedAyahs.length, 0);
    const totalSurahs = Object.values(progress).filter(
      p => p.memorizedAyahs.length === (SURAH_LIST[p.surahNum - 1]?.versesCount || 0)
    ).length;

    const keyFor = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return toDateKey(d);
    };

    let longestStreak = 0;
    const sortedKeys = Object.keys(dailyMemorized).sort();
    let run = 0;
    let prev: Date | null = null;
    for (const key of sortedKeys) {
      const [y, m, day] = key.split('-').map(Number);
      const current = new Date(y, m - 1, day);
      if (prev && (current.getTime() - prev.getTime()) / 86_400_000 === 1) run += 1;
      else run = 1;
      longestStreak = Math.max(longestStreak, run);
      prev = current;
    }

    // Today may not be logged yet, so don't reset the streak on it.
    let start = dailyMemorized[keyFor(0)] ? 0 : 1;
    let currentStreak = 0;
    for (let i = start; i < 400; i++) {
      if (dailyMemorized[keyFor(i)]) currentStreak++;
      else break;
    }

    const weeklyProgress = Array.from({ length: 7 }, (_, i) =>
      dailyMemorized[keyFor(6 - i)] || 0
    );

    return {
      totalMemorized: totalMem,
      totalSurahs,
      currentStreak,
      longestStreak,
      weeklyProgress,
    };
  }, [progress, dailyMemorized]);

  const memorizedToday = dailyMemorized[toDateKey()] || 0;

  // Listen mode — play (or stop) an individual ayah.
  const stopAyah = useCallback(async () => {
    try {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
    } catch { /* already unloaded */ }
    soundRef.current = null;
    setIsPlaying(false);
  }, []);

  const playAyah = async (surahNum: number, ayahNum: number) => {
    // Tapping while a playback is active stops it (the button shows "stop").
    if (soundRef.current) {
      await stopAyah();
      return;
    }
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      const url = getAyahAudioUrl(surahNum, ayahNum, hifzSettings.activeReciter);
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        status => {
          // Release the sound once it ends, otherwise the next tap only stops.
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync().catch(() => {});
            if (soundRef.current === sound) soundRef.current = null;
            setIsPlaying(false);
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch {
      soundRef.current = null;
      setIsPlaying(false);
      Alert.alert('Playback failed', 'This ayah audio could not be loaded. Check your connection.');
    }
  };

  // Load test mode for a surah
  const startTest = async (surahNum: number) => {
    const surahProg = progress[surahNum];
    if (!surahProg || surahProg.memorizedAyahs.length === 0) {
      Alert.alert('No Memorized Ayahs', 'Memorize at least one ayah before starting a test.');
      return;
    }
    try {
      const data = await fetchSurah(surahNum, 'quran-uthmani');
      const memorized = data.ayahs.filter(a => surahProg.memorizedAyahs.includes(a.numberInSurah));
      // Shuffle
      const shuffled = [...memorized].sort(() => Math.random() - 0.5);
      setTestAyahs(shuffled.map(a => ({ num: a.numberInSurah, text: a.text })));
      setTestSurahNum(surahNum);
      setCurrentTestIndex(0);
      setShowAnswer(false);
      setTestScore({ correct: 0, incorrect: 0 });
      setActiveTab('test');
    } catch {
      Alert.alert('Error', 'Could not load test. Check your connection.');
    }
  };

  // Due for revision
  const dueForRevision = Object.values(progress).filter(p =>
    p.memorizedAyahs.length > 0 &&
    getRevisionDue(p, hifzSettings.revisionIntervalDays)
  );

  const completedCount = stats.totalMemorized;
  const completionPct = Math.round((completedCount / TOTAL_QURAN_AYAHS) * 100);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: C.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Hifz Manager</Text>
            <Text style={[styles.headerSub, { color: C.textSecondary }]}>Quran Memorization Tracker</Text>
          </View>
          <Pressable
            style={[styles.settingsBtn, { backgroundColor: `${C.gold}20` }]}
            onPress={() => setShowSettingsModal(true)}
          >
            <MaterialIcons name="tune" size={20} color={C.gold} />
          </Pressable>
        </View>

        {/* Progress Ring Summary */}
        <View style={styles.progressSummary}>
          <View style={[styles.progressRing, { borderColor: `${C.gold}40`, backgroundColor: `${C.gold}10` }]}>
            <Text style={[styles.progressRingPct, { color: C.gold }]}>{completionPct}%</Text>
            <Text style={[styles.progressRingLabel, { color: C.textMuted }]}>Complete</Text>
          </View>
          <View style={styles.statsGrid}>
            {[
              { label: 'Verses', value: stats.totalMemorized, icon: 'menu-book', color: C.gold },
              { label: 'Surahs', value: stats.totalSurahs, icon: 'book', color: C.success },
              { label: 'Due', value: dueForRevision.length, icon: 'event-repeat', color: C.warning },
              { label: 'Daily Target', value: hifzSettings.dailyTarget, icon: 'track-changes', color: C.info },
            ].map(s => (
              <View key={s.label} style={[styles.statBox, { backgroundColor: `${s.color}15`, borderColor: `${s.color}25` }]}>
                <MaterialIcons name={s.icon as any} size={14} color={s.color} />
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: C.textMuted }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: C.surface, borderBottomColor: C.cardBorder }]}>
        {(['overview', 'surahs', 'revision', 'test'] as ActiveTab[]).map(tab => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && [styles.tabActive, { borderBottomColor: C.gold }]]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === tab ? C.gold : C.textMuted },
            ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'revision' && dueForRevision.length > 0 && (
                ` (${dueForRevision.length})`
              )}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <View>
            {/* Daily Target Card */}
            <View style={[styles.targetCard, { backgroundColor: C.card, borderColor: `${C.gold}30` }]}>
              <View style={styles.targetHeader}>
                <View style={[styles.targetIcon, { backgroundColor: `${C.gold}15` }]}>
                  <MaterialIcons name="track-changes" size={22} color={C.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.targetTitle, { color: C.textPrimary }]}>Today's Goal</Text>
                  <Text style={[styles.targetSub, { color: C.textMuted }]}>
                    Memorize {hifzSettings.dailyTarget} verses
                  </Text>
                </View>
                <View style={[styles.targetBadge, {
                  backgroundColor: memorizedToday >= hifzSettings.dailyTarget ? `${C.success}20` : `${C.gold}15`,
                }]}>
                  <Text style={[styles.targetBadgeText, {
                    color: memorizedToday >= hifzSettings.dailyTarget ? C.success : C.gold,
                  }]}>
                    {memorizedToday}/{hifzSettings.dailyTarget}
                  </Text>
                </View>
              </View>
            </View>

            {/* Recently active surahs */}
            <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>In Progress</Text>
            {Object.values(progress)
              .filter(p => p.memorizedAyahs.length > 0 && p.memorizedAyahs.length < (SURAH_LIST[p.surahNum - 1]?.versesCount || 0))
              .sort((a, b) => (b.lastRevised || 0) - (a.lastRevised || 0))
              .slice(0, 5)
              .map(p => {
                const meta = SURAH_LIST[p.surahNum - 1];
                const pct = getCompletionPct(p, p.surahNum);
                return (
                  <Pressable
                    key={p.surahNum}
                    style={[styles.surahProgressCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}
                    onPress={() => { setSelectedSurah(p.surahNum); setShowSurahModal(true); }}
                  >
                    <View style={[styles.surahNum, { backgroundColor: `${C.gold}15` }]}>
                      <Text style={[styles.surahNumText, { color: C.gold }]}>{p.surahNum}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.surahName, { color: C.textPrimary }]}>{meta?.transliteration}</Text>
                      <View style={[styles.progressBar, { backgroundColor: C.cardBorder }]}>
                        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: C.gold }]} />
                      </View>
                      <Text style={[styles.progressLabel, { color: C.textMuted }]}>
                        {p.memorizedAyahs.length}/{meta?.versesCount} verses · {pct}%
                        {p.weakAyahs.length > 0 && ` · ${p.weakAyahs.length} weak`}
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.testBtn, { backgroundColor: `${C.info}15`, borderColor: `${C.info}25` }]}
                      onPress={() => startTest(p.surahNum)}
                    >
                      <MaterialIcons name="quiz" size={16} color={C.info} />
                    </Pressable>
                  </Pressable>
                );
              })}

            {Object.values(progress).filter(p => p.memorizedAyahs.length > 0).length === 0 && (
              <View style={[styles.emptyCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Text style={styles.emptyEmoji}>📖</Text>
                <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>Start Your Hifz Journey</Text>
                <Text style={[styles.emptySub, { color: C.textMuted }]}>
                  Go to the Surahs tab to begin memorizing your first surah.
                </Text>
                <Pressable
                  style={[styles.startBtn, { backgroundColor: C.gold }]}
                  onPress={() => setActiveTab('surahs')}
                >
                  <Text style={[styles.startBtnText, { color: C.primaryDark }]}>Browse Surahs</Text>
                </Pressable>
              </View>
            )}

            {/* Completed Surahs */}
            {stats.totalSurahs > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Completed ✅</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.completedRow}>
                  {Object.values(progress)
                    .filter(p => p.memorizedAyahs.length === (SURAH_LIST[p.surahNum - 1]?.versesCount || 0))
                    .map(p => {
                      const meta = SURAH_LIST[p.surahNum - 1];
                      return (
                        <View key={p.surahNum} style={[styles.completedChip, { backgroundColor: `${C.success}15`, borderColor: `${C.success}30` }]}>
                          <Text style={[styles.completedChipText, { color: C.success }]}>{meta?.transliteration}</Text>
                        </View>
                      );
                    })}
                </ScrollView>
              </>
            )}
          </View>
        )}

        {/* ── Surahs Tab ── */}
        {activeTab === 'surahs' && (
          <View>
            {SURAH_LIST.map(surah => {
              const p = progress[surah.number];
              const memorized = p?.memorizedAyahs.length || 0;
              const pct = Math.round((memorized / surah.versesCount) * 100);
              const isComplete = memorized === surah.versesCount;
              const hasWeak = (p?.weakAyahs.length || 0) > 0;

              return (
                <Pressable
                  key={surah.number}
                  style={({ pressed }) => [
                    styles.surahItem,
                    { backgroundColor: C.card, borderColor: C.cardBorder },
                    isComplete && { borderColor: `${C.success}40` },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => { setSelectedSurah(surah.number); setShowSurahModal(true); }}
                >
                  <View style={[styles.surahNum, { backgroundColor: isComplete ? `${C.success}15` : `${C.gold}15` }]}>
                    <Text style={[styles.surahNumText, { color: isComplete ? C.success : C.gold }]}>
                      {surah.number}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.surahNameRow}>
                      <Text style={[styles.surahName, { color: C.textPrimary }]}>{surah.transliteration}</Text>
                      <Text style={[styles.surahArabic, { color: C.textArabic }]}>{surah.arabicName}</Text>
                    </View>
                    <Text style={[styles.surahMeta, { color: C.textMuted }]}>
                      {surah.versesCount} verses · {surah.revelationType}
                    </Text>
                    {memorized > 0 && (
                      <View style={styles.miniProgressWrap}>
                        <View style={[styles.miniBar, { backgroundColor: C.cardBorder }]}>
                          <View style={[styles.miniBarFill, {
                            width: `${pct}%`,
                            backgroundColor: isComplete ? C.success : C.gold,
                          }]} />
                        </View>
                        <Text style={[styles.miniBarText, { color: isComplete ? C.success : C.gold }]}>
                          {memorized}/{surah.versesCount}
                          {hasWeak && ` · ⚠️ ${p!.weakAyahs.length}`}
                        </Text>
                      </View>
                    )}
                  </View>
                  {isComplete ? (
                    <MaterialIcons name="check-circle" size={22} color={C.success} />
                  ) : (
                    <MaterialIcons name="chevron-right" size={18} color={C.textMuted} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Revision Tab ── */}
        {activeTab === 'revision' && (
          <View>
            {dueForRevision.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Text style={styles.emptyEmoji}>✅</Text>
                <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>All Caught Up!</Text>
                <Text style={[styles.emptySub, { color: C.textMuted }]}>
                  No surahs are due for revision. Check back in {hifzSettings.revisionIntervalDays} days.
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.revisionNote, { color: C.textMuted }]}>
                  {dueForRevision.length} surah{dueForRevision.length > 1 ? 's' : ''} need revision.
                  Revise every {hifzSettings.revisionIntervalDays} days.
                </Text>
                {dueForRevision.map(p => {
                  const meta = SURAH_LIST[p.surahNum - 1];
                  const daysSince = p.lastRevised
                    ? Math.floor((Date.now() - p.lastRevised) / (1000 * 60 * 60 * 24))
                    : null;
                  return (
                    <View key={p.surahNum} style={[styles.revisionCard, {
                      backgroundColor: C.card,
                      borderColor: p.weakAyahs.length > 0 ? `${C.warning}40` : C.cardBorder,
                    }]}>
                      <View style={styles.revisionCardHeader}>
                        <View style={[styles.surahNum, { backgroundColor: `${C.warning}15` }]}>
                          <Text style={[styles.surahNumText, { color: C.warning }]}>{p.surahNum}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.surahName, { color: C.textPrimary }]}>{meta?.transliteration}</Text>
                          <Text style={[styles.surahMeta, { color: C.textMuted }]}>
                            {p.memorizedAyahs.length} verses memorized
                            {daysSince !== null ? ` · Last: ${daysSince}d ago` : ' · Never revised'}
                            {p.weakAyahs.length > 0 && ` · ⚠️ ${p.weakAyahs.length} weak`}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.revisionActions}>
                        <Pressable
                          style={[styles.revisionBtn, { backgroundColor: `${C.gold}20`, borderColor: `${C.gold}30` }]}
                          onPress={() => startTest(p.surahNum)}
                        >
                          <MaterialIcons name="quiz" size={16} color={C.gold} />
                          <Text style={[styles.revisionBtnText, { color: C.gold }]}>Test</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.revisionBtn, { backgroundColor: `${C.success}15`, borderColor: `${C.success}25` }]}
                          onPress={() => markRevised(p.surahNum)}
                        >
                          <MaterialIcons name="check" size={16} color={C.success} />
                          <Text style={[styles.revisionBtnText, { color: C.success }]}>Mark Revised</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.revisionBtn, { backgroundColor: `${C.info}15`, borderColor: `${C.info}25` }]}
                          onPress={() => { setSelectedSurah(p.surahNum); setShowSurahModal(true); }}
                        >
                          <MaterialIcons name="edit" size={16} color={C.info} />
                          <Text style={[styles.revisionBtnText, { color: C.info }]}>Review</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* ── Test Tab ── */}
        {activeTab === 'test' && (
          <View>
            {testAyahs.length === 0 || testSurahNum === null ? (
              <View style={[styles.emptyCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Text style={styles.emptyEmoji}>📝</Text>
                <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>Start a Test</Text>
                <Text style={[styles.emptySub, { color: C.textMuted }]}>
                  Go to a surah you have memorized and tap "Test" to begin.
                </Text>
                <Pressable
                  style={[styles.startBtn, { backgroundColor: C.gold }]}
                  onPress={() => setActiveTab('surahs')}
                >
                  <Text style={[styles.startBtnText, { color: C.primaryDark }]}>Browse Surahs</Text>
                </Pressable>
              </View>
            ) : currentTestIndex >= testAyahs.length ? (
              // Test Complete
              <View style={[styles.testResultCard, { backgroundColor: C.card, borderColor: `${C.success}30` }]}>
                <Text style={styles.testResultEmoji}>🎉</Text>
                <Text style={[styles.testResultTitle, { color: C.textPrimary }]}>Test Complete!</Text>
                <View style={styles.testScoreRow}>
                  <View style={[styles.testScoreBox, { backgroundColor: `${C.success}15` }]}>
                    <Text style={[styles.testScoreNum, { color: C.success }]}>{testScore.correct}</Text>
                    <Text style={[styles.testScoreLabel, { color: C.textMuted }]}>Correct</Text>
                  </View>
                  <View style={[styles.testScoreBox, { backgroundColor: `${C.error}15` }]}>
                    <Text style={[styles.testScoreNum, { color: C.error }]}>{testScore.incorrect}</Text>
                    <Text style={[styles.testScoreLabel, { color: C.textMuted }]}>Needs Work</Text>
                  </View>
                  <View style={[styles.testScoreBox, { backgroundColor: `${C.gold}15` }]}>
                    <Text style={[styles.testScoreNum, { color: C.gold }]}>
                      {Math.round((testScore.correct / testAyahs.length) * 100)}%
                    </Text>
                    <Text style={[styles.testScoreLabel, { color: C.textMuted }]}>Score</Text>
                  </View>
                </View>
                <Pressable
                  style={[styles.startBtn, { backgroundColor: C.gold }]}
                  onPress={() => {
                    setCurrentTestIndex(0);
                    setShowAnswer(false);
                    setTestScore({ correct: 0, incorrect: 0 });
                    const shuffled = [...testAyahs].sort(() => Math.random() - 0.5);
                    setTestAyahs(shuffled);
                  }}
                >
                  <Text style={[styles.startBtnText, { color: C.primaryDark }]}>Retry Test</Text>
                </Pressable>
              </View>
            ) : (
              // Active Test Card
              <View>
                <View style={[styles.testProgressBar, { backgroundColor: C.cardBorder }]}>
                  <View style={[styles.testProgressFill, {
                    width: `${((currentTestIndex) / testAyahs.length) * 100}%`,
                    backgroundColor: C.gold,
                  }]} />
                </View>
                <Text style={[styles.testCounter, { color: C.textMuted }]}>
                  {currentTestIndex + 1} / {testAyahs.length}
                </Text>

                <View style={[styles.testCard, { backgroundColor: C.card, borderColor: `${C.gold}20` }]}>
                  {/* Surah + verse number */}
                  <View style={styles.testCardHeader}>
                    <Text style={[styles.testCardRef, { color: C.gold }]}>
                      {SURAH_LIST[testSurahNum - 1]?.transliteration} {testSurahNum}:{testAyahs[currentTestIndex].num}
                    </Text>
                    <Pressable
                      style={[styles.testAudioBtn, { backgroundColor: `${C.primary}25` }]}
                      onPress={() => playAyah(testSurahNum, testAyahs[currentTestIndex].num)}
                    >
                      <MaterialIcons name={isPlaying ? 'stop' : 'volume-up'} size={18} color={C.gold} />
                    </Pressable>
                  </View>

                  {/* Hidden Answer */}
                  {!showAnswer ? (
                    <View style={styles.hiddenAnswer}>
                      <Text style={[styles.hiddenText, { color: C.textMuted }]}>
                        Try to recite verse {testAyahs[currentTestIndex].num}
                      </Text>
                      <Pressable
                        style={[styles.revealBtn, { backgroundColor: C.gold }]}
                        onPress={() => setShowAnswer(true)}
                      >
                        <Text style={[styles.revealBtnText, { color: C.primaryDark }]}>Reveal Answer</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={[styles.testArabicText, { color: C.textArabic }]}>
                      {testAyahs[currentTestIndex].text}
                    </Text>
                  )}

                  {showAnswer && (
                    <View style={styles.testJudgment}>
                      <Pressable
                        style={[styles.judgmentBtn, { backgroundColor: `${C.success}15`, borderColor: `${C.success}30` }]}
                        onPress={() => {
                          setTestScore(s => ({ ...s, correct: s.correct + 1 }));
                          setCurrentTestIndex(i => i + 1);
                          setShowAnswer(false);
                        }}
                      >
                        <MaterialIcons name="check" size={20} color={C.success} />
                        <Text style={[styles.judgmentText, { color: C.success }]}>Correct</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.judgmentBtn, { backgroundColor: `${C.error}15`, borderColor: `${C.error}30` }]}
                        onPress={() => {
                          setTestScore(s => ({ ...s, incorrect: s.incorrect + 1 }));
                          if (testSurahNum) markWeak(testSurahNum, testAyahs[currentTestIndex].num);
                          setCurrentTestIndex(i => i + 1);
                          setShowAnswer(false);
                        }}
                      >
                        <MaterialIcons name="close" size={20} color={C.error} />
                        <Text style={[styles.judgmentText, { color: C.error }]}>Needs Work</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Surah Detail Modal */}
      {selectedSurah && (
        <SurahDetailModal
          surahNum={selectedSurah}
          progress={progress[selectedSurah]}
          onToggle={toggleMemorized}
          onMarkWeak={markWeak}
          onClose={() => setShowSurahModal(false)}
          visible={showSurahModal}
          C={C}
          onStartTest={startTest}
          setActiveTab={setActiveTab}
        />
      )}

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: C.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: C.textPrimary }]}>Hifz Settings</Text>
              <Pressable onPress={() => setShowSettingsModal(false)}>
                <MaterialIcons name="close" size={24} color={C.textPrimary} />
              </Pressable>
            </View>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: C.textPrimary }]}>Daily Target (verses)</Text>
              <View style={styles.stepper}>
                {[1, 3, 5, 10, 20].map(n => (
                  <Pressable
                    key={n}
                    style={[styles.stepOption, {
                      backgroundColor: hifzSettings.dailyTarget === n ? C.gold : `${C.gold}15`,
                      borderColor: `${C.gold}30`,
                    }]}
                    onPress={() => saveSettings({ dailyTarget: n })}
                  >
                    <Text style={[styles.stepOptionText, { color: hifzSettings.dailyTarget === n ? C.primaryDark : C.gold }]}>
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: C.textPrimary }]}>Revision Every (days)</Text>
              <View style={styles.stepper}>
                {[1, 3, 7, 14].map(n => (
                  <Pressable
                    key={n}
                    style={[styles.stepOption, {
                      backgroundColor: hifzSettings.revisionIntervalDays === n ? C.gold : `${C.gold}15`,
                      borderColor: `${C.gold}30`,
                    }]}
                    onPress={() => saveSettings({ revisionIntervalDays: n })}
                  >
                    <Text style={[styles.stepOptionText, { color: hifzSettings.revisionIntervalDays === n ? C.primaryDark : C.gold }]}>
                      {n}d
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Surah Detail Modal ────────────────────────────────────────────────────────

function SurahDetailModal({
  surahNum, progress, onToggle, onMarkWeak, onClose, visible, C, onStartTest, setActiveTab,
}: {
  surahNum: number;
  progress?: SurahHifzProgress;
  onToggle: (s: number, a: number) => void;
  onMarkWeak: (s: number, a: number) => void;
  onClose: () => void;
  visible: boolean;
  C: any;
  onStartTest: (s: number) => void;
  setActiveTab: (t: ActiveTab) => void;
}) {
  const meta = SURAH_LIST[surahNum - 1];
  const memorized = progress?.memorizedAyahs || [];
  const weak = progress?.weakAyahs || [];
  const total = meta?.versesCount || 0;
  const pct = Math.round((memorized.length / total) * 100);

  const rows = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: C.surface, maxHeight: '85%' }]}>
          <View style={[styles.modalHeader, { borderBottomColor: C.cardBorder }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: C.textPrimary }]}>{meta?.transliteration}</Text>
              <Text style={[styles.modalSub, { color: C.textMuted }]}>
                {memorized.length}/{total} verses · {pct}% complete
              </Text>
            </View>
            <Pressable
              style={[styles.testSmallBtn, { backgroundColor: `${C.info}15` }]}
              onPress={() => {
                onClose();
                onStartTest(surahNum);
                setActiveTab('test');
              }}
            >
              <MaterialIcons name="quiz" size={16} color={C.info} />
              <Text style={[styles.testSmallBtnText, { color: C.info }]}>Test</Text>
            </Pressable>
            <Pressable onPress={onClose} style={{ marginLeft: 8 }}>
              <MaterialIcons name="close" size={24} color={C.textPrimary} />
            </Pressable>
          </View>

          <View style={[styles.progressBarLg, { backgroundColor: C.cardBorder }]}>
            <View style={[styles.progressFillLg, { width: `${pct}%`, backgroundColor: C.gold }]} />
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={styles.verseGrid}>
              {rows.map(ayahNum => {
                const isMem = memorized.includes(ayahNum);
                const isWeak = weak.includes(ayahNum);
                return (
                  <View key={ayahNum} style={styles.verseCell}>
                    <Pressable
                      style={[
                        styles.verseCellBtn,
                        {
                          backgroundColor: isMem
                            ? isWeak ? `${C.warning}25` : `${C.success}20`
                            : C.card,
                          borderColor: isMem
                            ? isWeak ? C.warning : C.success
                            : C.cardBorder,
                        },
                      ]}
                      onPress={() => onToggle(surahNum, ayahNum)}
                      onLongPress={() => onMarkWeak(surahNum, ayahNum)}
                    >
                      <Text style={[
                        styles.verseCellText,
                        { color: isMem ? (isWeak ? C.warning : C.success) : C.textMuted },
                      ]}>
                        {ayahNum}
                      </Text>
                      {isWeak && <Text style={styles.weakDot}>⚠</Text>}
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <View style={[styles.legendRow, { borderTopColor: C.cardBorder }]}>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: `${C.success}20`, borderColor: C.success }]} />
                <Text style={[styles.legendText, { color: C.textMuted }]}>Memorized (tap to toggle)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: `${C.warning}25`, borderColor: C.warning }]} />
                <Text style={[styles.legendText, { color: C.textMuted }]}>Weak (long-press to flag)</Text>
              </View>
            </View>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: 4,
    marginBottom: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  settingsBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },

  progressSummary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  progressRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  progressRingPct: { fontSize: 18, fontWeight: '800' },
  progressRingLabel: { fontSize: 10, fontWeight: '500' },
  statsGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statBox: {
    flexBasis: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 7,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  statValue: { fontSize: 13, fontWeight: '700' },
  statLabel: { fontSize: 10, flex: 1 },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {},
  tabText: { fontSize: 12, fontWeight: '600' },

  content: { padding: Spacing.md },

  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.sm, marginTop: Spacing.md },

  targetCard: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.md },
  targetHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  targetIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  targetTitle: { fontSize: 15, fontWeight: '700' },
  targetSub: { fontSize: 12, marginTop: 2 },
  targetBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.round },
  targetBadgeText: { fontSize: 13, fontWeight: '700' },

  surahProgressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: 10,
  },
  surahNum: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  surahNumText: { fontSize: 13, fontWeight: '700' },
  surahName: { fontSize: 14, fontWeight: '600' },
  surahNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  surahArabic: { fontSize: 16 },
  surahMeta: { fontSize: 11, marginTop: 2 },
  progressBar: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { fontSize: 10, marginTop: 3 },
  testBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  surahItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: 8,
  },
  miniProgressWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  miniBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 2 },
  miniBarText: { fontSize: 10, fontWeight: '600' },

  emptyCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  startBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.md, marginTop: 4 },
  startBtnText: { fontSize: 15, fontWeight: '700' },

  completedRow: { paddingBottom: Spacing.sm, gap: 8 },
  completedChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.round,
    borderWidth: 1,
  },
  completedChipText: { fontSize: 12, fontWeight: '600' },

  revisionNote: { fontSize: 13, marginBottom: Spacing.md, lineHeight: 20 },
  revisionCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: 10,
  },
  revisionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  revisionActions: { flexDirection: 'row', gap: 8 },
  revisionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  revisionBtnText: { fontSize: 12, fontWeight: '600' },

  testProgressBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  testProgressFill: { height: '100%', borderRadius: 3 },
  testCounter: { fontSize: 12, textAlign: 'right', marginBottom: Spacing.md },
  testCard: { borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1 },
  testCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  testCardRef: { fontSize: 14, fontWeight: '700' },
  testAudioBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  hiddenAnswer: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  hiddenText: { fontSize: 15, fontStyle: 'italic' },
  revealBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.md },
  revealBtnText: { fontSize: 15, fontWeight: '700' },
  testArabicText: { fontSize: 24, textAlign: 'right', lineHeight: 44, marginVertical: Spacing.md },
  testJudgment: { flexDirection: 'row', gap: 10, marginTop: Spacing.md },
  judgmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  judgmentText: { fontSize: 14, fontWeight: '700' },
  testResultCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  testResultEmoji: { fontSize: 56 },
  testResultTitle: { fontSize: 20, fontWeight: '700' },
  testScoreRow: { flexDirection: 'row', gap: 12 },
  testScoreBox: { flex: 1, alignItems: 'center', padding: 12, borderRadius: Radius.md },
  testScoreNum: { fontSize: 24, fontWeight: '800' },
  testScoreLabel: { fontSize: 11, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.md, maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    gap: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSub: { fontSize: 12, marginTop: 2 },
  testSmallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.md },
  testSmallBtnText: { fontSize: 12, fontWeight: '600' },

  progressBarLg: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: Spacing.md },
  progressFillLg: { height: '100%', borderRadius: 3 },

  verseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  verseCell: {},
  verseCellBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  verseCellText: { fontSize: 13, fontWeight: '700' },
  weakDot: { position: 'absolute', top: 2, right: 4, fontSize: 8 },

  legendRow: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendBox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5 },
  legendText: { fontSize: 12 },

  settingRow: { marginBottom: Spacing.md },
  settingLabel: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  stepper: { flexDirection: 'row', gap: 8 },
  stepOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  stepOptionText: { fontSize: 13, fontWeight: '700' },
});
