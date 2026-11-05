import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { AppProvider, useApp } from '../contexts/AppContext';
import { AudioPlayerProvider } from '../contexts/AudioPlayerContext';
import FloatingPlayer from '../components/FloatingPlayer';
import { initQuranOfflineCache } from '../services/quranService';
import { preCacheTafsirBackground } from '../services/tafsirCacheService';
import { schedulePrayerNotificationsWithGPS } from '../services/notificationService';
import { preCacheAllCollections } from '../services/hadithService';

function AppContent() {
  const { settings } = useApp();
  const didInitRef = useRef(false);

  // Kick off background pre-caching, once per app launch.
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    // Pre-cache top surahs and common translations
    initQuranOfflineCache(
      [1, 2, 3, 18, 36, 55, 67, 112, 113, 114],
      [settings.selectedTranslation]
    );
    // Pre-cache Tafsir Ibn Kathir for top 10 surahs
    preCacheTafsirBackground();
  }, [settings.selectedTranslation]);

  // The hadith pre-cache timer must be cleared on unmount, otherwise a
  // re-mount (fast refresh, dev reload) leaves orphaned timers behind.
  useEffect(() => {
    const timer = setTimeout(() => { preCacheAllCollections(); }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Refresh GPS-based prayer notifications whenever the reminder settings
  // change (the previous effect never reacted to them).
  useEffect(() => {
    const notifs = settings.notifications;
    const anyPrayerEnabled =
      notifs.fajrReminder || notifs.dhuhrReminder || notifs.asrReminder ||
      notifs.maghribReminder || notifs.ishaReminder;
    if (!anyPrayerEnabled) return;
    schedulePrayerNotificationsWithGPS(
      notifs,
      false,
      settings.prayerCalculationMethod,
      settings.madhab,
    ).catch(() => {});
  }, [settings.notifications, settings.prayerCalculationMethod, settings.madhab]);

  return (
    <>
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="quran/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="hadith/index" options={{ headerShown: false }} />
        <Stack.Screen name="hadith/[collection]" options={{ headerShown: false }} />
        <Stack.Screen name="duas/index" options={{ headerShown: false }} />
        <Stack.Screen name="duas/[category]" options={{ headerShown: false }} />
        <Stack.Screen name="tasbeeh" options={{ headerShown: false }} />
        <Stack.Screen name="qibla" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="bookmarks" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ headerShown: false }} />
        <Stack.Screen name="prayer-guide/index" options={{ headerShown: false }} />
        <Stack.Screen name="ai-guide" options={{ headerShown: false }} />
        <Stack.Screen name="hijri-calendar" options={{ headerShown: false }} />
        <Stack.Screen name="asma-ul-husna" options={{ headerShown: false }} />
        <Stack.Screen name="islamic-names" options={{ headerShown: false }} />
        <Stack.Screen name="ramadan" options={{ headerShown: false }} />
        <Stack.Screen name="reading-stats" options={{ headerShown: false }} />
        <Stack.Screen name="hajj-guide" options={{ headerShown: false }} />
        <Stack.Screen name="audio-manager" options={{ headerShown: false }} />
        <Stack.Screen name="tafsir/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="mosque-finder" options={{ headerShown: false }} />
        <Stack.Screen name="quran-comparison" options={{ headerShown: false }} />
        <Stack.Screen name="hifz" options={{ headerShown: false }} />
        <Stack.Screen name="quran-search" options={{ headerShown: false }} />
        <Stack.Screen name="salah-tracker" options={{ headerShown: false }} />
        <Stack.Screen name="notes-library" options={{ headerShown: false }} />
        <Stack.Screen name="hadith/search" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
      </Stack>
      <FloatingPlayer />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AudioPlayerProvider>
          <AppContent />
        </AudioPlayerProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
