import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { markLocalChange } from '../services/syncEngine';
import { Appearance, ColorSchemeName } from 'react-native';
import { getColors, getHighContrastColors, ThemeColors } from '../constants/theme';
import { isWithinDarkWindow, toDateKey } from '../lib/date';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Bookmark {
  id: string;
  type: 'quran' | 'hadith' | 'dua';
  reference: string;
  title: string;
  subtitle?: string;
  arabic?: string;
  timestamp: number;
}

export interface Note {
  id: string;
  type: 'quran' | 'hadith' | 'dua';
  reference: string;
  content: string;
  timestamp: number;
  tags?: string[];
  surahNumber?: number;
  ayahNumber?: number;
  color?: HighlightColor;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'red';

export interface Highlight {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  color: HighlightColor;
  verseText?: string;
  timestamp: number;
}

export interface SalahRecord {
  date: string; // YYYY-MM-DD
  fajr: boolean;
  dhuhr: boolean;
  asr: boolean;
  maghrib: boolean;
  isha: boolean;
  journal?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AIConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

export interface FastingDay {
  date: string; // YYYY-MM-DD
  fasted: boolean;
  note?: string;
}

export interface NotificationSettings {
  fajrReminder: boolean;
  dhuhrReminder: boolean;
  asrReminder: boolean;
  maghribReminder: boolean;
  ishaReminder: boolean;
  dailyAyah: boolean;
  dailyHadith: boolean;
  morningAzkar: boolean;
  eveningAzkar: boolean;
  fridayReminder: boolean;
  tahajjudReminder: boolean;
  fastingReminder: boolean;
  reminderMinutesBefore: number;
}

export interface DarkModeSchedule {
  enabled: boolean;
  mode: 'custom' | 'sunrise_sunset';
  startHour: number;   // 0-23
  startMinute: number; // 0-59
  endHour: number;
  endMinute: number;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  darkModeSchedule: DarkModeSchedule;
  arabicFontSize: number;
  translationFontSize: number;
  selectedTranslation: string;
  selectedReciter: string;
  showTransliteration: boolean;
  showTranslation: boolean;
  showWordByWord: boolean;
  showTajweed: boolean;
  prayerCalculationMethod: number;
  madhab: number;
  language: string;
  autoPlayNext: boolean;
  repeatMode: 'none' | 'ayah' | 'surah';
  quranViewMode: 'surah' | 'juz' | 'page';
  readingProgress: Record<string, number>; // surahNumber -> lastAyah
  notifications: NotificationSettings;
  hapticFeedback: boolean;
  highContrastMode: boolean;
  textScaling: number; // 0.8 – 1.4
  /** Set once the first-run welcome has been completed or skipped. */
  hasCompletedOnboarding: boolean;
}

// ─── Context Interface ─────────────────────────────────────────────────────────

interface AppContextType {
  colors: ThemeColors;
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  /** Persisted flag driving the first-run welcome screen. */
  completeOnboarding: () => Promise<void>;
  /** True once stored settings have been read (screens can wait on this). */
  hydrated: boolean;
  /**
   * Re-reads everything from storage. Cloud sync calls this after downloading
   * remote data so the UI reflects it without restarting the app.
   */
  reloadFromStorage: () => Promise<void>;

  // Bookmarks
  bookmarks: Bookmark[];
  addBookmark: (bookmark: Omit<Bookmark, 'id' | 'timestamp'>) => void;
  removeBookmark: (id: string) => void;
  isBookmarked: (reference: string) => boolean;

  // Notes
  notes: Note[];
  addNote: (note: Omit<Note, 'id' | 'timestamp'>) => void;
  removeNote: (id: string) => void;

  // Reading
  lastRead: { surahNumber: number; ayahNumber: number } | null;
  setLastRead: (data: { surahNumber: number; ayahNumber: number }) => void;
  updateReadingProgress: (surahNumber: number, ayahNumber: number, totalAyahs: number) => void;

  // Tasbeeh
  tasbeehCount: number;
  setTasbeehCount: (count: number) => void;
  dailyTasbeehHistory: { date: string; count: number }[];

  // Duas
  favoritedDuas: string[];
  toggleFavoriteDua: (duaId: string) => void;

  // AI Chat
  aiMessages: AIMessage[];
  addAIMessage: (msg: Omit<AIMessage, 'id' | 'timestamp'>) => void;
  clearAIChat: () => void;
  aiConversations: AIConversation[];
  createConversation: (title?: string) => string;
  updateConversationTitle: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  pinConversation: (id: string) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;

  // Fasting Tracker
  fastingDays: FastingDay[];
  toggleFastingDay: (date: string) => void;

  // Highlights
  highlights: Highlight[];
  addHighlight: (h: Omit<Highlight, 'id' | 'timestamp'>) => void;
  removeHighlight: (surahNumber: number, ayahNumber: number) => void;
  getHighlight: (surahNumber: number, ayahNumber: number) => Highlight | undefined;

  // Salah Tracker
  salahRecords: SalahRecord[];
  toggleSalah: (date: string, prayer: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha') => void;
  updateSalahJournal: (date: string, journal: string) => void;

  // Asma-ul-Husna Favorites
  asmaFavorites: number[];
  toggleAsmaFavorite: (num: number) => void;

  // Islamic Names Favorites
  nameFavorites: string[];
  toggleNameFavorite: (id: string) => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultNotifications: NotificationSettings = {
  fajrReminder: false,
  dhuhrReminder: false,
  asrReminder: false,
  maghribReminder: false,
  ishaReminder: false,
  dailyAyah: false,
  dailyHadith: false,
  morningAzkar: false,
  eveningAzkar: false,
  fridayReminder: false,
  tahajjudReminder: false,
  fastingReminder: false,
  reminderMinutesBefore: 10,
};

const defaultSettings: AppSettings = {
  theme: 'dark',
  darkModeSchedule: {
    enabled: false,
    mode: 'custom',
    startHour: 21,
    startMinute: 0,
    endHour: 6,
    endMinute: 0,
  },
  arabicFontSize: 26,
  translationFontSize: 16,
  selectedTranslation: 'en.sahih',
  selectedReciter: 'ar.alafasy',
  showTransliteration: true,
  showTranslation: true,
  showWordByWord: false,
  showTajweed: false,
  prayerCalculationMethod: 3,
  madhab: 0,
  language: 'en',
  autoPlayNext: true,
  repeatMode: 'none',
  quranViewMode: 'surah',
  readingProgress: {},
  notifications: defaultNotifications,
  hapticFeedback: true,
  highContrastMode: false,
  textScaling: 1.0,
  hasCompletedOnboarding: false,
};

// ─── Context & Provider ────────────────────────────────────────────────────────

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [lastRead, setLastReadState] = useState<{ surahNumber: number; ayahNumber: number } | null>(null);
  const [tasbeehCount, setTasbeehCountState] = useState(0);
  const [dailyTasbeehHistory, setDailyTasbeehHistory] = useState<{ date: string; count: number }[]>([]);
  const [favoritedDuas, setFavoritedDuas] = useState<string[]>([]);
  const [aiMessages, setAIMessages] = useState<AIMessage[]>([]);
  const [aiConversations, setAIConversations] = useState<AIConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [fastingDays, setFastingDays] = useState<FastingDay[]>([]);
  const [asmaFavorites, setAsmaFavorites] = useState<number[]>([]);
  const [nameFavorites, setNameFavorites] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [salahRecords, setSalahRecords] = useState<SalahRecord[]>([]);
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());
  const [now, setNow] = useState(() => new Date());
  // Every mutator below persists the whole collection it touches. Before the
  // AsyncStorage read resolves (which is async, and slow on cold start), that
  // collection is still `[]` — so any early write would erase the user's data.
  const [hydrated, setHydrated] = useState(false);

  // Resolve effective theme. A manual theme choice still loses to the
  // auto dark-mode schedule while its window is active.
  const scheduleActive = isWithinDarkWindow(settings.darkModeSchedule, now);
  const effectiveTheme: 'dark' | 'light' = scheduleActive
    ? 'dark'
    : settings.theme === 'system'
      ? (systemColorScheme === 'light' ? 'light' : 'dark')
      : settings.theme;

  const baseColors = getColors(effectiveTheme);
  const colors = settings.highContrastMode ? getHighContrastColors(effectiveTheme) : baseColors;

  // Listen to system theme changes
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  // Re-evaluate the dark-mode schedule every minute so the app flips theme
  // without needing a restart.
  useEffect(() => {
    if (!settings.darkModeSchedule.enabled) return;
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [settings.darkModeSchedule.enabled]);

  const loadData = useCallback(async () => {
    try {
      const keys = [
        'app_settings_v2', 'bookmarks', 'notes', 'last_read',
        'tasbeeh_history', 'favorite_duas', 'ai_messages', 'ai_conversations',
        'fasting_days', 'asma_favorites', 'name_favorites', 'highlights', 'salah_records',
      ];
      const results = await AsyncStorage.multiGet(keys);
      const map = Object.fromEntries(results.map(([k, v]) => [k, v]));

      if (map['app_settings_v2']) {
        const saved = JSON.parse(map['app_settings_v2']);
        setSettings({ ...defaultSettings, ...saved, notifications: { ...defaultNotifications, ...saved.notifications } });
      }
      if (map['bookmarks']) setBookmarks(JSON.parse(map['bookmarks']));
      if (map['notes']) setNotes(JSON.parse(map['notes']));
      if (map['last_read']) setLastReadState(JSON.parse(map['last_read']));
      if (map['tasbeeh_history']) {
        const history: { date: string; count: number }[] = JSON.parse(map['tasbeeh_history']);
        setDailyTasbeehHistory(history);
        // History is per-day, so restore today's tally for the tasbeeh screen.
        setTasbeehCountState(history.find(h => h.date === toDateKey())?.count ?? 0);
      }
      if (map['favorite_duas']) setFavoritedDuas(JSON.parse(map['favorite_duas']));
      if (map['ai_messages']) setAIMessages(JSON.parse(map['ai_messages']));
      if (map['ai_conversations']) {
        const convs = JSON.parse(map['ai_conversations']);
        setAIConversations(convs);
        if (convs.length > 0) setActiveConversationId(convs[0].id);
      }
      if (map['fasting_days']) setFastingDays(JSON.parse(map['fasting_days']));
      if (map['asma_favorites']) setAsmaFavorites(JSON.parse(map['asma_favorites']));
      if (map['name_favorites']) setNameFavorites(JSON.parse(map['name_favorites']));
      if (map['highlights']) setHighlights(JSON.parse(map['highlights']));
      if (map['salah_records']) setSalahRecords(JSON.parse(map['salah_records']));
    } catch { /* use defaults */ }
    setHydrated(true);
  }, []);

  // Load all persisted data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Settings are read through a ref so `updateSettings` keeps a stable identity
  // and, more importantly, so two updates dispatched in the same tick merge
  // instead of the second one clobbering the first with stale state.
  const settingsRef = useRef<AppSettings>(defaultSettings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  /**
   * Persists a collection only after the initial load has finished, so a fast
   * tap during startup can never overwrite stored data with an empty list.
   */
  const persist = useCallback(async (key: string, value: unknown) => {
    if (!hydrated) return;
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      // Tells the cloud layer that this device holds changes the server has not
      // seen yet. A no-op when cloud sync is not configured.
      void markLocalChange();
    } catch { /* storage full / unavailable — keep the in-memory value */ }
  }, [hydrated]);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const newSettings = { ...settingsRef.current, ...updates };
    settingsRef.current = newSettings;
    setSettings(newSettings);
    await AsyncStorage.setItem('app_settings_v2', JSON.stringify(newSettings));
    void markLocalChange();
  }, []);

  const completeOnboarding = useCallback(async () => {
    await updateSettings({ hasCompletedOnboarding: true });
  }, [updateSettings]);

  // ── Bookmarks ────────────────────────────────────────────────────────────────

  const addBookmark = useCallback(async (bookmark: Omit<Bookmark, 'id' | 'timestamp'>) => {
    const newBookmark: Bookmark = { ...bookmark, id: `bm_${Date.now()}`, timestamp: Date.now() };
    const updated = [newBookmark, ...bookmarks];
    setBookmarks(updated);
    await persist('bookmarks', updated);
  }, [bookmarks, persist]);

  const removeBookmark = useCallback(async (id: string) => {
    const updated = bookmarks.filter(b => b.id !== id && b.reference !== id);
    setBookmarks(updated);
    await persist('bookmarks', updated);
  }, [bookmarks, persist]);

  const isBookmarked = useCallback((reference: string) =>
    bookmarks.some(b => b.reference === reference), [bookmarks]);

  // ── Notes ────────────────────────────────────────────────────────────────────

  const addNote = useCallback(async (note: Omit<Note, 'id' | 'timestamp'>) => {
    const newNote: Note = { ...note, id: `note_${Date.now()}`, timestamp: Date.now() };
    const updated = [newNote, ...notes];
    setNotes(updated);
    await persist('notes', updated);
  }, [notes, persist]);

  const removeNote = useCallback(async (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    await persist('notes', updated);
  }, [notes, persist]);

  // ── Reading ──────────────────────────────────────────────────────────────────

  const setLastRead = useCallback(async (data: { surahNumber: number; ayahNumber: number }) => {
    setLastReadState(data);
    await AsyncStorage.setItem('last_read', JSON.stringify(data));
  }, []);

  const updateReadingProgress = useCallback(async (surahNumber: number, ayahNumber: number, _totalAyahs: number) => {
    const newProgress = { ...settings.readingProgress, [surahNumber]: ayahNumber };
    await updateSettings({ readingProgress: newProgress });
    await setLastRead({ surahNumber, ayahNumber });
  }, [settings.readingProgress, updateSettings, setLastRead]);

  // ── Tasbeeh ──────────────────────────────────────────────────────────────────

  const setTasbeehCount = useCallback(async (count: number) => {
    setTasbeehCountState(count);
    const today = toDateKey();
    // Functional update: several taps can land before the next render, and a
    // captured `dailyTasbeehHistory` would drop all but the last one.
    let toPersist: { date: string; count: number }[] = [];
    setDailyTasbeehHistory(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(h => h.date === today);
      if (idx >= 0) updated[idx] = { date: today, count };
      else updated.unshift({ date: today, count });
      toPersist = updated.slice(0, 60);
      return toPersist;
    });
    if (toPersist.length > 0) {
      await persist('tasbeeh_history', toPersist);
    }
  }, [persist]);

  // ── Duas ─────────────────────────────────────────────────────────────────────

  const toggleFavoriteDua = useCallback(async (duaId: string) => {
    const updated = favoritedDuas.includes(duaId)
      ? favoritedDuas.filter(id => id !== duaId)
      : [...favoritedDuas, duaId];
    setFavoritedDuas(updated);
    await persist('favorite_duas', updated);
  }, [favoritedDuas, persist]);

  // ── AI Chat ──────────────────────────────────────────────────────────────────

  const addAIMessage = useCallback(async (msg: Omit<AIMessage, 'id' | 'timestamp'>) => {
    const newMsg: AIMessage = { ...msg, id: `ai_${Date.now()}_${Math.random().toString(36).slice(2)}`, timestamp: Date.now() };
    const updated = [...aiMessages, newMsg].slice(-200);
    setAIMessages(updated);
    await persist('ai_messages', updated);

    // Mirror the message into its conversation so switching chats (or
    // reloading the app) does not show an empty history.
    if (activeConversationId) {
      const convs = aiConversations.map(c =>
        c.id === activeConversationId
          ? { ...c, messages: [...c.messages, newMsg].slice(-200), updatedAt: newMsg.timestamp }
          : c
      );
      setAIConversations(convs);
      await persist('ai_conversations', convs);
    }
  }, [aiMessages, activeConversationId, aiConversations, persist]);

  const clearAIChat = useCallback(async () => {
    setAIMessages([]);
    await AsyncStorage.removeItem('ai_messages');
    if (activeConversationId) {
      const convs = aiConversations.map(c =>
        c.id === activeConversationId ? { ...c, messages: [], updatedAt: Date.now() } : c
      );
      setAIConversations(convs);
      await persist('ai_conversations', convs);
    }
  }, [activeConversationId, aiConversations, persist]);

  const createConversation = useCallback((title?: string): string => {
    const id = `conv_${Date.now()}`;
    const now = Date.now();
    const conv: AIConversation = {
      id,
      title: title || `Chat ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    const updated = [conv, ...aiConversations].slice(0, 50);
    setAIConversations(updated);
    setActiveConversationId(id);
    AsyncStorage.setItem('ai_conversations', JSON.stringify(updated));
    return id;
  }, [aiConversations]);

  const updateConversationTitle = useCallback(async (id: string, title: string) => {
    const updated = aiConversations.map(c => c.id === id ? { ...c, title } : c);
    setAIConversations(updated);
    await persist('ai_conversations', updated);
  }, [aiConversations, persist]);

  const deleteConversation = useCallback(async (id: string) => {
    const updated = aiConversations.filter(c => c.id !== id);
    setAIConversations(updated);
    if (activeConversationId === id) setActiveConversationId(updated[0]?.id || null);
    await persist('ai_conversations', updated);
  }, [aiConversations, activeConversationId, persist]);

  const pinConversation = useCallback(async (id: string) => {
    const updated = aiConversations.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c);
    setAIConversations(updated);
    await persist('ai_conversations', updated);
  }, [aiConversations, persist]);

  // ── Fasting ──────────────────────────────────────────────────────────────────

  const toggleFastingDay = useCallback(async (date: string) => {
    const existing = fastingDays.find(d => d.date === date);
    const updated = existing
      ? fastingDays.map(d => d.date === date ? { ...d, fasted: !d.fasted } : d)
      : [...fastingDays, { date, fasted: true }];
    setFastingDays(updated);
    await persist('fasting_days', updated);
  }, [fastingDays, persist]);

  // ── Asma / Names Favorites ────────────────────────────────────────────────────

  const toggleAsmaFavorite = useCallback(async (num: number) => {
    const updated = asmaFavorites.includes(num)
      ? asmaFavorites.filter(n => n !== num)
      : [...asmaFavorites, num];
    setAsmaFavorites(updated);
    await persist('asma_favorites', updated);
  }, [asmaFavorites, persist]);

  const toggleNameFavorite = useCallback(async (id: string) => {
    const updated = nameFavorites.includes(id)
      ? nameFavorites.filter(n => n !== id)
      : [...nameFavorites, id];
    setNameFavorites(updated);
    await persist('name_favorites', updated);
  }, [nameFavorites, persist]);

  // ── Highlights ────────────────────────────────────────────────────────────────

  const addHighlight = useCallback(async (h: Omit<Highlight, 'id' | 'timestamp'>) => {
    const filtered = highlights.filter(x => !(x.surahNumber === h.surahNumber && x.ayahNumber === h.ayahNumber));
    const newH: Highlight = { ...h, id: `hl_${Date.now()}`, timestamp: Date.now() };
    const updated = [newH, ...filtered];
    setHighlights(updated);
    await persist('highlights', updated);
  }, [highlights, persist]);

  const removeHighlight = useCallback(async (surahNumber: number, ayahNumber: number) => {
    const updated = highlights.filter(h => !(h.surahNumber === surahNumber && h.ayahNumber === ayahNumber));
    setHighlights(updated);
    await persist('highlights', updated);
  }, [highlights, persist]);

  const getHighlight = useCallback((surahNumber: number, ayahNumber: number): Highlight | undefined => {
    return highlights.find(h => h.surahNumber === surahNumber && h.ayahNumber === ayahNumber);
  }, [highlights]);

  // ── Salah Tracker ─────────────────────────────────────────────────────────────

  const toggleSalah = useCallback(async (date: string, prayer: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha') => {
    const existing = salahRecords.find(r => r.date === date);
    let updated: SalahRecord[];
    if (existing) {
      updated = salahRecords.map(r => r.date === date ? { ...r, [prayer]: !r[prayer] } : r);
    } else {
      const newRecord: SalahRecord = {
        date,
        fajr: prayer === 'fajr',
        dhuhr: prayer === 'dhuhr',
        asr: prayer === 'asr',
        maghrib: prayer === 'maghrib',
        isha: prayer === 'isha',
      };
      updated = [...salahRecords, newRecord];
    }
    setSalahRecords(updated);
    await persist('salah_records', updated);
  }, [salahRecords, persist]);

  const updateSalahJournal = useCallback(async (date: string, journal: string) => {
    const existing = salahRecords.find(r => r.date === date);
    let updated: SalahRecord[];
    if (existing) {
      updated = salahRecords.map(r => r.date === date ? { ...r, journal } : r);
    } else {
      updated = [...salahRecords, { date, fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false, journal }];
    }
    setSalahRecords(updated);
    await persist('salah_records', updated);
  }, [salahRecords, persist]);

  return (
    <AppContext.Provider value={{
      colors,
      settings,
      updateSettings,
      completeOnboarding,
      hydrated,
      reloadFromStorage: loadData,
      bookmarks,
      addBookmark,
      removeBookmark,
      isBookmarked,
      notes,
      addNote,
      removeNote,
      lastRead,
      setLastRead,
      updateReadingProgress,
      tasbeehCount,
      setTasbeehCount,
      dailyTasbeehHistory,
      favoritedDuas,
      toggleFavoriteDua,
      aiMessages,
      addAIMessage,
      clearAIChat,
      aiConversations,
      createConversation,
      updateConversationTitle,
      deleteConversation,
      pinConversation,
      activeConversationId,
      setActiveConversationId,
      fastingDays,
      toggleFastingDay,
      asmaFavorites,
      toggleAsmaFavorite,
      nameFavorites,
      toggleNameFavorite,
      highlights,
      addHighlight,
      removeHighlight,
      getHighlight,
      salahRecords,
      toggleSalah,
      updateSalahJournal,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
