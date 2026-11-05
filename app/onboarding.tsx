import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

const { width } = Dimensions.get('window');

/**
 * First-run welcome.
 *
 * The app shipped with an `onboarding-hero.png` and no screen that used it: a
 * brand-new user landed straight on the Home tab with no explanation of what
 * the app does and no prompt for the two permissions it needs. This is the
 * missing introduction — it can be dismissed permanently or revisited from
 * Settings → About.
 */

interface Slide {
  key: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  emoji: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    key: 'quran',
    icon: 'menu-book',
    emoji: '📖',
    title: 'The complete Quran',
    body: 'All 114 surahs with translation, transliteration, word-by-word meanings, tafsir, recitation and a resume-from-where-you-stopped marker.',
  },
  {
    key: 'prayer',
    icon: 'mosque',
    emoji: '🕌',
    title: 'Prayer, exactly on time',
    body: 'GPS prayer times for your calculation method, a monthly timetable, reminders that respect your madhab, and a Salah tracker for streaks.',
  },
  {
    key: 'tools',
    icon: 'explore',
    emoji: '🧭',
    title: 'Tools for every day',
    body: 'Qibla compass, digital tasbeeh, 99 Names of Allah, duas and azkar, mosque finder, Hijri calendar, zakat calculator and more.',
  },
  {
    key: 'privacy',
    icon: 'lock',
    emoji: '🔒',
    title: 'Yours, on your device',
    body: 'Bookmarks, notes, highlights and progress stay on this device — nothing is uploaded. You can back up or start fresh at any time.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, completeOnboarding } = useApp();
  const [index, setIndex] = useState(0);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const finish = useCallback(async () => {
    await completeOnboarding();
    router.replace('/(tabs)');
  }, [completeOnboarding, router]);

  const next = () => {
    if (isLast) finish();
    else setIndex(i => Math.min(i + 1, SLIDES.length - 1));
  };

  const dots = useMemo(
    () => SLIDES.map((s, i) => (
      <Pressable
        key={s.key}
        onPress={() => setIndex(i)}
        style={[
          styles.dot,
          { backgroundColor: i === index ? C.gold : `${C.gold}35` },
          i === index && styles.dotActive,
        ]}
      />
    )),
    [index, C.gold],
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <LinearGradient colors={[C.primaryDark, C.background]} style={StyleSheet.absoluteFillObject} />

      <View style={styles.skipRow}>
        {!isLast ? (
          <Pressable onPress={finish} hitSlop={10}>
            <Text style={[styles.skipText, { color: `${C.textPrimary}99` }]}>Skip</Text>
          </Pressable>
        ) : <View />}
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={() => { /* swiping is handled by the indicators */ }}
      >
        <Image
          source={require('../assets/images/onboarding-hero.png')}
          style={styles.hero}
          contentFit="contain"
        />

        <View style={[styles.iconBadge, { backgroundColor: `${C.gold}18`, borderColor: `${C.gold}30` }]}>
          <MaterialIcons name={slide.icon} size={26} color={C.gold} />
        </View>

        <Text style={[styles.title, { color: C.textPrimary }]}>{slide.title}</Text>
        <Text style={[styles.bodyText, { color: C.textSecondary }]}>{slide.body}</Text>

        <View style={styles.dots}>{dots}</View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, { backgroundColor: C.gold }, pressed && { opacity: 0.9 }]}
          onPress={next}
        >
          <Text style={[styles.primaryBtnText, { color: C.primaryDark }]}>
            {isLast ? 'Get Started' : 'Next'}
          </Text>
          <MaterialIcons name={isLast ? 'check' : 'arrow-forward'} size={18} color={C.primaryDark} />
        </Pressable>

        {isLast && (
          <Pressable onPress={() => router.push('/(tabs)/settings' as any)} style={styles.secondaryBtn}>
            <Text style={[styles.secondaryText, { color: `${C.textPrimary}99` }]}>
              Set up location & notifications in Settings
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, minHeight: 32 },
  skipText: { fontSize: 14, fontWeight: '600' },
  body: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  hero: { width: Math.min(width - 96, 240), height: Math.min(width - 96, 240) * 0.62, marginBottom: Spacing.lg },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: Radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: Spacing.sm },
  bodyText: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 340 },
  dots: { flexDirection: 'row', gap: 8, marginTop: Spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 22 },
  footer: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radius.round,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  secondaryText: { fontSize: 12 },
});
