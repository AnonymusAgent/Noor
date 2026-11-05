import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Vibration, ScrollView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

const PRESETS = [
  { name: 'SubhanAllah', arabic: 'سُبْحَانَ اللَّهِ', target: 33 },
  { name: 'Alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', target: 33 },
  { name: 'Allahu Akbar', arabic: 'اللَّهُ أَكْبَرُ', target: 34 },
  { name: 'La ilaha illallah', arabic: 'لَا إِلَهَ إِلَّا اللَّهُ', target: 100 },
  { name: 'Astaghfirullah', arabic: 'أَسْتَغْفِرُ اللَّهَ', target: 100 },
  { name: 'Durood Ibrahim', arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', target: 100 },
  { name: 'La hawla wa la quwwata', arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', target: 100 },
  { name: 'SubhanAllahi wa bihamdih', arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', target: 100 },
  { name: 'Hasbunallahu wa ni\'mal wakeel', arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', target: 100 },
];

/** Target counts a user can cycle through with the target stepper. */
const TARGET_CHOICES = [10, 33, 34, 66, 99, 100, 500, 1000];

export default function TasbeehScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setTasbeehCount, tasbeehCount, dailyTasbeehHistory, settings, colors: C } = useApp();
  const [count, setCount] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
  // Persisting the chosen dhikr/target means the counter reopens where it left
  // off instead of always resetting to SubhanAllah ×33.
  const [targetIndex, setTargetIndex] = useState(() => Math.max(0, TARGET_CHOICES.indexOf(PRESETS[0].target)));
  const [target, setTarget] = useState(33);
  // Today's tally lives in context (persisted per day), so it must be the
  // single source of truth — a local mirror started back at 0 on every mount.
  const totalCount = tasbeehCount;
  // Session-level mute; the app-wide Haptic Feedback setting still applies.
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  const progress = Math.min(count / target, 1);
  const completed = Math.floor(count / target);

  const handlePress = () => {
    const newCount = count + 1;
    setCount(newCount);
    setTasbeehCount(totalCount + 1);
    if (vibrationEnabled && settings.hapticFeedback && Platform.OS !== 'web') {
      if (newCount % target === 0) Vibration.vibrate([0, 100, 50, 100]);
      else Vibration.vibrate(30);
    }
  };

  const selectPreset = (preset: typeof PRESETS[0]) => {
    setSelectedPreset(preset);
    setTarget(preset.target);
    const idx = TARGET_CHOICES.indexOf(preset.target);
    setTargetIndex(idx >= 0 ? idx : TARGET_CHOICES.length - 1);
    setCount(0);
  };

  const cycleTarget = (delta: number) => {
    const next = Math.min(Math.max(targetIndex + delta, 0), TARGET_CHOICES.length - 1);
    setTargetIndex(next);
    setTarget(TARGET_CHOICES[next]);
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: C.cardBorder }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Digital Tasbeeh</Text>
        <Pressable onPress={() => setVibrationEnabled(!vibrationEnabled)} style={styles.vibrateBtn}>
          <MaterialIcons
            name={vibrationEnabled ? 'vibration' : 'phonelink-erase'}
            size={22}
            color={vibrationEnabled ? C.gold : C.textMuted}
          />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Preset Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.md }}>
          {PRESETS.map(preset => (
            <Pressable
              key={preset.name}
              style={[
                styles.presetChip,
                { backgroundColor: C.card, borderColor: C.cardBorder },
                selectedPreset.name === preset.name && { borderColor: C.gold, backgroundColor: `${C.gold}10` },
              ]}
              onPress={() => selectPreset(preset)}
            >
              <Text style={[styles.presetText, { color: C.textSecondary }, selectedPreset.name === preset.name && { color: C.gold }]}>
                {preset.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.arabicName, { color: C.gold }]}>{selectedPreset.arabic}</Text>
        <Text style={[styles.presetName, { color: C.textPrimary }]}>{selectedPreset.name}</Text>

        {/* Target stepper — one fixed target per dhikr is too rigid */}
        <View style={styles.targetRow}>
          <Pressable
            onPress={() => cycleTarget(-1)}
            style={[styles.targetBtn, { backgroundColor: C.card, borderColor: C.cardBorder }]}
            disabled={targetIndex === 0}
          >
            <MaterialIcons name="remove" size={16} color={targetIndex === 0 ? C.textMuted : C.textPrimary} />
          </Pressable>
          <Text style={[styles.targetText, { color: C.textMuted }]}>
            Target {target} · Completed {completed}×
          </Text>
          <Pressable
            onPress={() => cycleTarget(1)}
            style={[styles.targetBtn, { backgroundColor: C.card, borderColor: C.cardBorder }]}
            disabled={targetIndex === TARGET_CHOICES.length - 1}
          >
            <MaterialIcons
              name="add"
              size={16}
              color={targetIndex === TARGET_CHOICES.length - 1 ? C.textMuted : C.textPrimary}
            />
          </Pressable>
        </View>

        {/* Counter Display */}
        <View style={styles.counterArea}>
          <LinearGradient
            colors={[`${C.gold}30`, `${C.gold}08`]}
            style={[styles.counterRing, { borderColor: `${C.gold}30` }]}
          >
            <View style={styles.counterInner}>
              <Text style={[styles.countDisplay, { color: C.textPrimary }]}>{count % target === 0 && count > 0 ? target : count % target}</Text>
              <Text style={[styles.countTotal, { color: C.textMuted }]}>Session: {count} · Today: {totalCount}</Text>
              <Text style={[styles.countRemaining, { color: C.gold }]}>
                {target - (count % target) === target ? 'Ready' : `${target - (count % target)} more`}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressBar, { backgroundColor: C.cardBorder }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: C.gold }]} />
        </View>
        <Text style={[styles.progressText, { color: C.textMuted }]}>{Math.round(progress * 100)}% of target</Text>

        {/* TAP BUTTON */}
        <Pressable
          style={({ pressed }) => [styles.tapBtn, { backgroundColor: C.gold }, pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] }]}
          onPress={handlePress}
        >
          <Text style={[styles.tapBtnText, { color: C.primaryDark }]}>Tap</Text>
          <Text style={[styles.tapBtnArabic, { color: `${C.primaryDark}80` }]}>اضغط</Text>
        </Pressable>

        <Pressable
          style={styles.resetBtn}
          onPress={() => {
            setCount(0);
            // Also restart today's recorded tally, otherwise "Today" keeps the
            // old number and the next tap resumes from it.
            setTasbeehCount(0);
          }}
        >
          <MaterialIcons name="refresh" size={18} color={C.textMuted} />
          <Text style={[styles.resetText, { color: C.textMuted }]}>Reset Counter</Text>
        </Pressable>

        {dailyTasbeehHistory.length > 0 && (
          <View style={[styles.historySection, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.historySectionTitle, { color: C.textPrimary }]}>Recent Activity</Text>
            {dailyTasbeehHistory.slice(0, 7).map(h => (
              <View key={h.date} style={[styles.historyItem, { borderBottomColor: C.cardBorder }]}>
                <Text style={[styles.historyDate, { color: C.textSecondary }]}>{h.date}</Text>
                <Text style={[styles.historyCount, { color: C.gold }]}>{h.count} counts</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  vibrateBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.round,
    borderWidth: 1,
    marginRight: 8,
  },
  presetText: { fontSize: 13, fontWeight: '500' },
  arabicName: { fontSize: 32, textAlign: 'center', fontWeight: '400', marginTop: Spacing.md, lineHeight: 52 },
  presetName: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  targetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 },
  targetBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  targetText: { fontSize: 13, textAlign: 'center', marginTop: 4 },
  counterArea: { alignItems: 'center', marginTop: Spacing.xl },
  counterRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  counterInner: { alignItems: 'center' },
  countDisplay: { fontSize: 64, fontWeight: '700', lineHeight: 72 },
  countTotal: { fontSize: 14 },
  countRemaining: { fontSize: 13, fontWeight: '600' },
  progressBar: { height: 6, borderRadius: 3, marginHorizontal: Spacing.xl, marginTop: Spacing.lg, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  tapBtn: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  tapBtnText: { fontSize: 24, fontWeight: '700' },
  tapBtnArabic: { fontSize: 18, marginTop: 2 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.lg, padding: 12 },
  resetText: { fontSize: 14 },
  historySection: {
    margin: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  historySectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: Spacing.sm },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  historyDate: { fontSize: 13 },
  historyCount: { fontSize: 13, fontWeight: '600' },
});
