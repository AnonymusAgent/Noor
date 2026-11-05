import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { APP_NAME, APP_VERSION, APP_TAGLINE } from '../../constants/appInfo';

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, settings, updateSettings } = useApp();

  const MENU_SECTIONS = [
    {
      title: 'AI & Guidance',
      items: [
        { id: 'ai-guide', title: 'AI Islamic Guide', subtitle: 'Ask questions with Quran & Hadith citations', icon: 'smart-toy', color: '#2D6B57', route: '/ai-guide' },
        { id: 'prayer-guide', title: 'Prayer Guide', subtitle: 'Complete Salah, Janazah & Eid instructions', icon: 'mosque', color: '#2D2D6B', route: '/prayer-guide' },
        { id: 'hajj-guide', title: 'Hajj & Umrah Guide', subtitle: 'Step-by-step rituals, duas & packing list', icon: 'flight-takeoff', color: '#4A2D6B', route: '/hajj-guide' },
      ],
    },
    {
      title: 'Islamic Content',
      items: [
        { id: 'hadith', title: 'Hadith Collections', subtitle: 'Bukhari, Muslim, Abu Dawood & more', icon: 'library-books', color: '#2D4A6B', route: '/hadith' },
        { id: 'hadith-search', title: 'Hadith Search', subtitle: 'Search 180+ offline + cached online hadiths', icon: 'manage-search', color: '#1B4D6B', route: '/hadith/search' },
        { id: 'duas', title: 'Duas & Azkar', subtitle: 'Morning, Evening & Daily Supplications', icon: 'favorite', color: '#6B2D4A', route: '/duas' },
        { id: 'asma-ul-husna', title: '99 Names of Allah', subtitle: 'Asma-ul-Husna with explanations', icon: 'star', color: '#5B2D6B', route: '/asma-ul-husna' },
        { id: 'islamic-names', title: 'Islamic Baby Names', subtitle: 'Boys & girls names with meanings', icon: 'child-care', color: '#2D6B8A', route: '/islamic-names' },
      ],
    },
    {
      title: 'Islamic Calendar',
      items: [
        { id: 'hijri-calendar', title: 'Hijri Calendar', subtitle: 'Islamic events & fasting tracker', icon: 'calendar-today', color: '#6B2D6B', route: '/hijri-calendar' },
        { id: 'ramadan', title: 'Ramadan Companion', subtitle: 'Suhoor/Iftar times, fasting tracker', icon: 'nightlight', color: '#1B4D8A', route: '/ramadan' },
      ],
    },
    {
      title: 'Tools & Tracking',
      items: [
        { id: 'zakat', title: 'Zakat Calculator', subtitle: 'Work out 2.5% of your zakatable wealth', icon: 'calculate', color: '#1B5E4A', route: '/zakat-calculator' },
        { id: 'monthly-times', title: 'Monthly Prayer Times', subtitle: 'Full timetables for any month', icon: 'calendar-view-month', color: '#1B5E4A', route: '/prayer-times-monthly' },
        { id: 'fav-duas', title: 'Favorite Duas', subtitle: 'Your saved supplications', icon: 'favorite', color: '#6B2D4A', route: '/favorite-duas' },
        { id: 'qibla', title: 'Qibla Compass', subtitle: 'Find the direction of Makkah', icon: 'explore', color: '#4A6B2D', route: '/qibla' },
        { id: 'tasbeeh', title: 'Digital Tasbeeh', subtitle: 'Counter with daily history', icon: 'loop', color: '#6B4A2D', route: '/tasbeeh' },
        { id: 'stats', title: 'Reading Statistics', subtitle: 'Quran progress, achievements & streaks', icon: 'bar-chart', color: '#2D6B4A', route: '/reading-stats' },
        { id: 'search', title: 'Global Search', subtitle: 'Search Quran, Hadith & Duas', icon: 'search', color: '#2D6B6B', route: '/search' },
        { id: 'audio', title: 'Audio Library', subtitle: 'Download & manage offline recitations', icon: 'headphones', color: '#6B2D5B', route: '/audio-manager' },
        { id: 'hifz', title: 'Hifz Manager', subtitle: 'Quran memorization tracker & test mode', icon: 'psychology', color: '#2D4A2D', route: '/hifz' },
        { id: 'comparison', title: 'Quran Comparison', subtitle: 'View 2-3 translations side-by-side', icon: 'compare-arrows', color: '#6B4A2D', route: '/quran-comparison' },
        { id: 'mosque-finder', title: 'Mosque Finder', subtitle: 'Find nearby mosques with GPS', icon: 'location-on', color: '#2D6B2D', route: '/mosque-finder' },
        { id: 'quran-search', title: 'Quran Search', subtitle: 'Search verses by keyword or Arabic text', icon: 'manage-search', color: '#1B5E6B', route: '/quran-search' },
        { id: 'salah-tracker', title: 'Salah Tracker', subtitle: '5 daily prayers, streak & heatmap', icon: 'check-circle', color: '#2D6B3A', route: '/salah-tracker' },
        { id: 'profile', title: 'Profile & Sync', subtitle: 'Data summary, cloud sync status', icon: 'account-circle', color: '#4A3D7A', route: '/profile' },
      ],
    },
    {
      title: 'Personal',
      items: [
        { id: 'bookmarks', title: 'Bookmarks', subtitle: 'Saved verses, hadiths & duas', icon: 'bookmark', color: '#6B6B2D', route: '/bookmarks' },
        { id: 'notes', title: 'Notes & Highlights', subtitle: 'Notes, verse highlights & tags', icon: 'note', color: '#4A2D7A', route: '/notes-library' },
        { id: 'settings', title: 'Settings', subtitle: 'Theme, translations, reciters', icon: 'settings', color: '#4A4A4A', route: '/settings' },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: C.cardBorder }]}>
        <View>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>More</Text>
          <Text style={[styles.headerSubtitle, { color: C.textMuted }]}>Islamic Resources & Tools</Text>
        </View>
        <Pressable
          style={[styles.themeToggle, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}
          onPress={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        >
          <MaterialIcons
            name={settings.theme === 'dark' ? 'wb-sunny' : 'nights-stay'}
            size={20}
            color={C.gold}
          />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {MENU_SECTIONS.map(section => (
          <View key={section.title} style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.md }]}>
            <Text style={[styles.sectionTitle, { color: C.textMuted }]}>{section.title.toUpperCase()}</Text>
            <View style={[styles.sectionCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              {section.items.map((item, index) => (
                <React.Fragment key={item.id}>
                  <Pressable
                    style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: C.surfaceElevated }]}
                    onPress={() => router.push(item.route as any)}
                  >
                    <View style={[styles.menuIcon, { backgroundColor: `${item.color}20` }]}>
                      <MaterialIcons name={item.icon as any} size={22} color={item.color + 'CC'} />
                    </View>
                    <View style={styles.menuInfo}>
                      <Text style={[styles.menuTitle, { color: C.textPrimary }]}>{item.title}</Text>
                      <Text style={[styles.menuSubtitle, { color: C.textMuted }]}>{item.subtitle}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={18} color={C.textMuted} />
                  </Pressable>
                  {index < section.items.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: C.cardBorder }]} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* App Info */}
        <View style={[styles.appInfo, { margin: Spacing.md, marginTop: Spacing.xl, backgroundColor: `${C.primary}20`, borderRadius: Radius.lg, borderWidth: 1, borderColor: `${C.gold}20` }]}>
          <Text style={[styles.appName, { color: C.gold }]}>🕌 {APP_NAME}</Text>
          <Text style={[styles.appVersion, { color: C.textMuted }]}>v{APP_VERSION} · {APP_TAGLINE}</Text>
          <Text style={[styles.appDesc, { color: C.textSecondary }]}>
            Complete Quran with word-by-word, authentic Hadith, Duas, AI Guide, 99 Names, Islamic Names, Ramadan Companion, Hajj Guide, Prayer Times, Qibla, Tasbeeh & more.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  themeToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  section: {},
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
  },
  sectionCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuInfo: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '600' },
  menuSubtitle: { fontSize: 12, marginTop: 1 },
  divider: { height: 1, marginLeft: 44 + Spacing.md * 2 },
  appInfo: { padding: Spacing.md, alignItems: 'center' },
  appName: { fontSize: 16, fontWeight: '700' },
  appVersion: { fontSize: 12, marginTop: 2 },
  appDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: Spacing.sm },
});
