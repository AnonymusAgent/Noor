/**
 * Offline Audio Manager — Download, manage, and play Quran recitations offline
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Alert, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { SURAH_LIST, RECITERS } from '../constants/quranData';
import { getAudioUrl as getSurahAudioUrl } from '../services/quranService';

// Audio directory
const AUDIO_DIR = `${FileSystem.documentDirectory}quran_audio/`;

interface DownloadInfo {
  surahNum: number;
  reciterId: string;
  fileSize?: number;
  downloadedSize?: number;
  progress?: number;
  status: 'idle' | 'downloading' | 'downloaded' | 'error' | 'playing';
}

// Share the streaming URL builder so a download and the in-app player always
// point at the same file (the CDN path is keyed by the reciter's identifier,
// not its edition id).
function getAudioUrl(surahNum: number, identifier: string): string {
  return getSurahAudioUrl(surahNum, identifier);
}

function getFilePath(surahNum: number, reciterId: string): string {
  const safeId = reciterId.replace(/\./g, '_');
  return `${AUDIO_DIR}${safeId}_${String(surahNum).padStart(3, '0')}.mp3`;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AudioManagerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, colors: C } = useApp();

  const [downloads, setDownloads] = useState<Record<string, DownloadInfo>>({});
  const [existingFiles, setExistingFiles] = useState<Set<string>>(new Set());
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [selectedReciter, setSelectedReciter] = useState(settings.selectedReciter);
  const [storageUsed, setStorageUsed] = useState<number>(0);
  const [showReciterPicker, setShowReciterPicker] = useState(false);
  const [search, setSearch] = useState('');

  const downloadRefs = useRef<Record<string, FileSystem.DownloadResumable>>({});
  const soundRef = useRef<Audio.Sound | null>(null);

  const currentReciter = RECITERS.find(r => r.id === selectedReciter) || RECITERS[0];

  useEffect(() => {
    initAudioDir();
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    scanDownloadedFiles();
  }, [selectedReciter]);

  const initAudioDir = async () => {
    try {
      const info = await FileSystem.getInfoAsync(AUDIO_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
      }
    } catch { /* silent */ }
  };

  const scanDownloadedFiles = async () => {
    try {
      const files = await FileSystem.readDirectoryAsync(AUDIO_DIR);
      const existing = new Set(files);
      setExistingFiles(existing);

      // Calculate total storage
      let total = 0;
      for (const file of files) {
        const info = await FileSystem.getInfoAsync(`${AUDIO_DIR}${file}`);
        if (info.exists && 'size' in info) total += (info as any).size || 0;
      }
      setStorageUsed(total);
    } catch { /* silent */ }
  };

  const isDownloaded = (surahNum: number): boolean => {
    const filePath = getFilePath(surahNum, selectedReciter);
    const fileName = filePath.replace(AUDIO_DIR, '');
    return existingFiles.has(fileName);
  };

  const startDownload = async (surahNum: number) => {
    const key = `${selectedReciter}_${surahNum}`;
    const reciter = RECITERS.find(r => r.id === selectedReciter) || RECITERS[0];
    const url = getAudioUrl(surahNum, reciter.identifier);
    const filePath = getFilePath(surahNum, selectedReciter);

    setDownloads(prev => ({
      ...prev,
      [key]: { surahNum, reciterId: selectedReciter, status: 'downloading', progress: 0 },
    }));

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        filePath,
        {},
        (progress) => {
          const pct = progress.totalBytesExpectedToWrite > 0
            ? (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100
            : 0;
          setDownloads(prev => ({
            ...prev,
            [key]: {
              ...prev[key],
              progress: pct,
              downloadedSize: progress.totalBytesWritten,
              fileSize: progress.totalBytesExpectedToWrite,
            },
          }));
        }
      );

      downloadRefs.current[key] = downloadResumable;
      const result = await downloadResumable.downloadAsync();

      if (result) {
        setDownloads(prev => ({
          ...prev,
          [key]: { ...prev[key], status: 'downloaded', progress: 100 },
        }));
        await scanDownloadedFiles();
      }
    } catch {
      setDownloads(prev => ({
        ...prev,
        [key]: { ...prev[key], status: 'error' },
      }));
      Alert.alert('Download Failed', 'The recitation could not be downloaded. Check your connection and try again.');
    }
  };

  const cancelDownload = (surahNum: number) => {
    const key = `${selectedReciter}_${surahNum}`;
    downloadRefs.current[key]?.pauseAsync().catch(() => {});
    setDownloads(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const deleteDownload = async (surahNum: number) => {
    const filePath = getFilePath(surahNum, selectedReciter);
    try {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      await scanDownloadedFiles();
      const key = `${selectedReciter}_${surahNum}`;
      setDownloads(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch { /* silent */ }
  };

  const confirmDelete = (surahNum: number, surahName: string) => {
    Alert.alert(
      'Delete Audio',
      `Remove downloaded audio for ${surahName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteDownload(surahNum) },
      ]
    );
  };

  const playAudio = async (surahNum: number) => {
    const key = `${selectedReciter}_${surahNum}`;

    // Stop current playback
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      if (playingKey === key) {
        setPlayingKey(null);
        return;
      }
    }

    const filePath = getFilePath(surahNum, selectedReciter);
    const reciter = RECITERS.find(r => r.id === selectedReciter) || RECITERS[0];
    const url = getAudioUrl(surahNum, reciter.identifier);
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    const source = fileInfo.exists ? { uri: filePath } : { uri: url };

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        source,
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingKey(null);
          }
        }
      );

      soundRef.current = sound;
      setPlayingKey(key);
    } catch {
      setPlayingKey(null);
      Alert.alert('Playback Error', 'Unable to play this audio. Please try again.');
    }
  };

  const filteredSurahs = SURAH_LIST.filter(s =>
    !search || s.transliteration.toLowerCase().includes(search.toLowerCase()) ||
    s.englishName?.toLowerCase().includes(search.toLowerCase()) ||
    String(s.number).includes(search)
  );

  const downloadedCount = SURAH_LIST.filter(s => isDownloaded(s.number)).length;

  const renderSurah = ({ item: surah }: { item: typeof SURAH_LIST[0] }) => {
    const key = `${selectedReciter}_${surah.number}`;
    const dl = downloads[key];
    const downloaded = isDownloaded(surah.number);
    const isPlaying = playingKey === key;

    return (
      <View style={[styles.surahRow, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        {/* Surah info */}
        <View style={[styles.surahNum, { backgroundColor: `${C.gold}15` }]}>
          <Text style={[styles.surahNumText, { color: C.gold }]}>{surah.number}</Text>
        </View>
        <View style={styles.surahInfo}>
          <View style={styles.surahNameRow}>
            <Text style={[styles.surahName, { color: C.textPrimary }]}>{surah.transliteration}</Text>
            <Text style={[styles.surahArabic, { color: C.textArabic }]}>{surah.arabicName}</Text>
          </View>
          <Text style={[styles.surahMeta, { color: C.textMuted }]}>
            {surah.revelationType} · {surah.versesCount} verses
            {downloaded ? ` · ${formatSize(undefined)}` : ''}
          </Text>

          {/* Download progress bar */}
          {dl?.status === 'downloading' && (
            <View style={styles.progressArea}>
              <View style={[styles.progressTrack, { backgroundColor: C.cardBorder }]}>
                <View style={[styles.progressFill, { width: `${dl.progress || 0}%`, backgroundColor: C.gold }]} />
              </View>
              <Text style={[styles.progressText, { color: C.textMuted }]}>
                {Math.round(dl.progress || 0)}%
                {dl.downloadedSize ? ` · ${formatSize(dl.downloadedSize)}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {/* Play button */}
          <Pressable
            style={[styles.actionBtn, { backgroundColor: `${C.gold}20` }]}
            onPress={() => playAudio(surah.number)}
          >
            <MaterialIcons
              name={isPlaying ? 'stop' : 'play-arrow'}
              size={20}
              color={isPlaying ? C.error : C.gold}
            />
          </Pressable>

          {/* Download / Delete button */}
          {downloaded ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: `${C.success}20` }]}
              onPress={() => confirmDelete(surah.number, surah.transliteration)}
            >
              <MaterialIcons name="check" size={18} color={C.success} />
            </Pressable>
          ) : dl?.status === 'downloading' ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: `${C.error}20` }]}
              onPress={() => cancelDownload(surah.number)}
            >
              <MaterialIcons name="close" size={18} color={C.error} />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: C.surfaceElevated, borderColor: C.cardBorder }]}
              onPress={() => startDownload(surah.number)}
            >
              <MaterialIcons name="download" size={18} color={C.textMuted} />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Audio Library</Text>
            <Text style={[styles.headerSub, { color: C.textSecondary }]}>Download Quran recitations for offline use</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { icon: 'download-done', label: 'Downloaded', value: `${downloadedCount}/114`, color: C.success },
            { icon: 'storage', label: 'Storage Used', value: formatSize(storageUsed) || '0 KB', color: C.info },
          ].map(s => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: `${s.color}15`, borderColor: `${s.color}25` }]}>
              <MaterialIcons name={s.icon as any} size={18} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: C.textMuted }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Reciter Selector */}
      <Pressable
        style={[styles.reciterBar, { backgroundColor: C.card, borderColor: C.cardBorder }]}
        onPress={() => setShowReciterPicker(!showReciterPicker)}
      >
        <View style={[styles.reciterAvatar, { backgroundColor: `${C.primary}40` }]}>
          <Text style={[styles.reciterInitial, { color: C.gold }]}>{currentReciter.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.reciterName, { color: C.textPrimary }]}>{currentReciter.name}</Text>
          <Text style={[styles.reciterStyle, { color: C.textMuted }]}>{currentReciter.arabicName} · {currentReciter.style}</Text>
        </View>
        <MaterialIcons name={showReciterPicker ? 'expand-less' : 'expand-more'} size={22} color={C.textMuted} />
      </Pressable>

      {/* Reciter Picker */}
      {showReciterPicker && (
        <View style={[styles.reciterPicker, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
          {RECITERS.map(r => (
            <Pressable
              key={r.id}
              style={[
                styles.reciterOption,
                { borderBottomColor: C.divider },
                selectedReciter === r.id && { backgroundColor: `${C.gold}10` },
              ]}
              onPress={() => { setSelectedReciter(r.id); updateSettings({ selectedReciter: r.id }); setShowReciterPicker(false); }}
            >
              <Text style={[styles.reciterOptionName, { color: C.textPrimary }]}>{r.name}</Text>
              <Text style={[styles.reciterOptionSub, { color: C.textMuted }]}>{r.style}</Text>
              {selectedReciter === r.id && <MaterialIcons name="check" size={18} color={C.gold} />}
            </Pressable>
          ))}
        </View>
      )}

      {/* Download All shortcut */}
      <View style={[styles.quickActions, { borderBottomColor: C.cardBorder }]}>
        <Text style={[styles.quickTitle, { color: C.textMuted }]}>Quick Actions</Text>
        <Pressable
          style={[styles.quickBtn, { backgroundColor: `${C.primary}20`, borderColor: `${C.primary}30` }]}
          onPress={() => {
            const short = SURAH_LIST.filter(s => s.versesCount <= 20 && !isDownloaded(s.number));
            short.slice(0, 5).forEach(s => startDownload(s.number));
          }}
        >
          <MaterialIcons name="download" size={16} color={C.gold} />
          <Text style={[styles.quickBtnText, { color: C.gold }]}>Download Short Surahs</Text>
        </Pressable>
        <Pressable
          style={[styles.quickBtn, { backgroundColor: `${C.error}15`, borderColor: `${C.error}25` }]}
          onPress={() => {
            Alert.alert(
              'Delete All Downloads',
              'Remove all downloaded audio files?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete All',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await FileSystem.deleteAsync(AUDIO_DIR, { idempotent: true });
                      await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
                      await scanDownloadedFiles();
                    } catch { /* silent */ }
                  },
                },
              ]
            );
          }}
        >
          <MaterialIcons name="delete-sweep" size={16} color={C.error} />
          <Text style={[styles.quickBtnText, { color: C.error }]}>Delete All Downloads</Text>
        </Pressable>
      </View>

      {/* Search — `search` already filters the list; without an input it was
          permanently stuck on the unfiltered value. */}
      <View style={[styles.searchBox, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        <MaterialIcons name="search" size={18} color={C.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: C.textPrimary }]}
          placeholder="Search surah by name or number..."
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <MaterialIcons name="close" size={16} color={C.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Surah List */}
      <FlatList
        data={filteredSurahs}
        keyExtractor={item => String(item.number)}
        renderItem={renderSurah}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: 4, marginBottom: Spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: Radius.md, borderWidth: 1 },
  statValue: { fontSize: 14, fontWeight: '700' },
  statLabel: { fontSize: 11 },

  reciterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  reciterAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reciterInitial: { fontSize: 18, fontWeight: '700' },
  reciterName: { fontSize: 15, fontWeight: '600' },
  reciterStyle: { fontSize: 12 },

  reciterPicker: { borderBottomWidth: 1, borderTopWidth: 0 },
  reciterOption: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md, borderBottomWidth: 1 },
  reciterOptionName: { flex: 1, fontSize: 14, fontWeight: '500' },
  reciterOptionSub: { fontSize: 12 },

  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: 10,
    borderBottomWidth: 1,
  },
  quickTitle: { fontSize: 11, fontWeight: '600' },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.round,
    borderWidth: 1,
  },
  quickBtnText: { fontSize: 12, fontWeight: '600' },

  list: { padding: Spacing.md, paddingBottom: 100 },
  surahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  surahNum: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  surahNumText: { fontSize: 13, fontWeight: '700' },
  surahInfo: { flex: 1 },
  surahNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  surahName: { fontSize: 14, fontWeight: '600' },
  surahArabic: { fontSize: 16 },
  surahMeta: { fontSize: 11, marginTop: 2 },
  progressArea: { marginTop: 6 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 3 },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 10 },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
