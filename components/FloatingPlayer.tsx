/**
 * FloatingPlayer — Persistent mini-player bar shown at bottom of all screens
 * when Quran audio is playing. Tapping opens the full Now Playing sheet.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, ScrollView,
  ActivityIndicator, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, RepeatMode, PlaybackSpeed } from '../contexts/AudioPlayerContext';
import { useApp } from '../contexts/AppContext';
import { SURAH_LIST } from '../constants/quranData';
import { Radius, Spacing } from '../constants/theme';

const SPEED_OPTIONS: PlaybackSpeed[] = [0.75, 1, 1.25, 1.5];

function formatTime(ms: number): string {
  if (!ms || isNaN(ms)) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function FloatingPlayer() {
  const insets = useSafeAreaInsets();
  const { colors: C } = useApp();
  const {
    nowPlaying, isPlaying, isLoading, positionMs, durationMs,
    repeatMode, playbackSpeed,
    togglePlayPause, stop, skipNext, skipPrev, seekTo,
    setRepeatMode, setPlaybackSpeed, playSurah,
  } = useAudioPlayer();

  const [showNowPlaying, setShowNowPlaying] = useState(false);

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  const cycleRepeat = useCallback(() => {
    // Matches AppSettings['repeatMode'] — ayah/surah loop the current track.
    const modes: RepeatMode[] = ['none', 'ayah', 'surah'];
    const idx = modes.indexOf(repeatMode);
    setRepeatMode(modes[(idx + 1) % modes.length]);
  }, [repeatMode, setRepeatMode]);

  if (!nowPlaying) return null;

  const TAB_BAR_HEIGHT = Platform.select({
    ios: insets.bottom + 64,
    android: insets.bottom + 64,
    default: 72,
  });

  return (
    <>
      {/* ── Mini Player Bar ── */}
      <Pressable
        style={[
          styles.bar,
          {
            backgroundColor: C.surface,
            borderColor: C.cardBorder,
            bottom: TAB_BAR_HEIGHT,
          },
        ]}
        onPress={() => setShowNowPlaying(true)}
      >
        {/* Progress line */}
        <View style={[styles.progressTrack, { backgroundColor: C.cardBorder }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: C.gold }]} />
        </View>

        <View style={styles.barContent}>
          <View style={[styles.surahIcon, { backgroundColor: `${C.gold}20` }]}>
            <MaterialIcons name="menu-book" size={18} color={C.gold} />
          </View>
          <View style={styles.barInfo}>
            <Text style={[styles.barTitle, { color: C.textPrimary }]} numberOfLines={1}>
              {nowPlaying.surahArabic}
            </Text>
            <Text style={[styles.barSub, { color: C.textMuted }]} numberOfLines={1}>
              {nowPlaying.surahName} · {nowPlaying.reciterName}
            </Text>
          </View>

          <Pressable style={styles.barBtn} onPress={(e) => { e.stopPropagation(); skipPrev(); }} hitSlop={8}>
            <MaterialIcons name="skip-previous" size={22} color={C.textSecondary} />
          </Pressable>
          <Pressable
            style={[styles.barPlayBtn, { backgroundColor: C.gold }]}
            onPress={(e) => { e.stopPropagation(); togglePlayPause(); }}
            hitSlop={8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={C.primaryDark} />
            ) : (
              <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={22} color={C.primaryDark} />
            )}
          </Pressable>
          <Pressable style={styles.barBtn} onPress={(e) => { e.stopPropagation(); skipNext(); }} hitSlop={8}>
            <MaterialIcons name="skip-next" size={22} color={C.textSecondary} />
          </Pressable>
          <Pressable style={styles.barBtn} onPress={(e) => { e.stopPropagation(); stop(); }} hitSlop={8}>
            <MaterialIcons name="close" size={20} color={C.textMuted} />
          </Pressable>
        </View>
      </Pressable>

      {/* ── Full Now Playing Modal ── */}
      <Modal
        visible={showNowPlaying}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNowPlaying(false)}
      >
        <View style={[styles.nowPlayingContainer, { backgroundColor: C.background }]}>
          <LinearGradient
            colors={[C.primaryDark, C.primary, `${C.primary}40`, 'transparent']}
            style={styles.nowPlayingGradient}
          />

          {/* Header */}
          <View style={[styles.npHeader, { paddingTop: insets.top + 12 }]}>
            <Pressable onPress={() => setShowNowPlaying(false)} style={styles.npDismiss}>
              <MaterialIcons name="keyboard-arrow-down" size={32} color={C.textPrimary} />
            </Pressable>
            <Text style={[styles.npHeaderTitle, { color: C.textPrimary }]}>Now Playing</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={styles.npContent} showsVerticalScrollIndicator={false}>
            {/* Artwork */}
            <View style={[styles.artwork, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}30` }]}>
              <Text style={[styles.artworkArabic, { color: C.gold }]}>{nowPlaying.surahArabic}</Text>
              <Text style={[styles.artworkSurahNum, { color: `${C.gold}80` }]}>
                Surah {nowPlaying.surahNumber}
              </Text>
              <Text style={[styles.artworkSubtext, { color: C.textMuted }]}>
                {SURAH_LIST[nowPlaying.surahNumber - 1]?.versesCount} Verses
                {' · '}{SURAH_LIST[nowPlaying.surahNumber - 1]?.revelationType}
              </Text>
            </View>

            {/* Surah Name & Reciter */}
            <View style={styles.npMeta}>
              <Text style={[styles.npSurahName, { color: C.textPrimary }]}>
                {nowPlaying.surahName}
              </Text>
              <Text style={[styles.npReciter, { color: C.gold }]}>
                {nowPlaying.reciterName}
              </Text>
            </View>

            {/* Progress Scrubber */}
            <View style={styles.scrubberWrap}>
              <Pressable
                style={[styles.scrubberTrack, { backgroundColor: C.cardBorder }]}
                onPress={(e) => {
                  const { locationX } = e.nativeEvent;
                  const trackWidth = (e.currentTarget as any)?.offsetWidth;
                  if (trackWidth && durationMs > 0) {
                    seekTo((locationX / trackWidth) * durationMs);
                  }
                }}
              >
                <View style={[styles.scrubberFill, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: C.gold }]}>
                  <View style={[styles.scrubberThumb, { backgroundColor: C.gold, borderColor: C.background }]} />
                </View>
              </Pressable>
              <View style={styles.timeRow}>
                <Text style={[styles.timeText, { color: C.textMuted }]}>{formatTime(positionMs)}</Text>
                <Text style={[styles.timeText, { color: C.textMuted }]}>{formatTime(durationMs)}</Text>
              </View>
            </View>

            {/* Main Controls */}
            <View style={styles.mainControls}>
              <Pressable onPress={skipPrev} style={styles.controlBtn}>
                <MaterialIcons name="skip-previous" size={40} color={C.textSecondary} />
              </Pressable>
              <Pressable
                onPress={togglePlayPause}
                style={[styles.playBtn, { backgroundColor: C.gold }]}
              >
                {isLoading ? (
                  <ActivityIndicator size="large" color={C.primaryDark} />
                ) : (
                  <MaterialIcons
                    name={isPlaying ? 'pause' : 'play-arrow'}
                    size={48}
                    color={C.primaryDark}
                  />
                )}
              </Pressable>
              <Pressable onPress={skipNext} style={styles.controlBtn}>
                <MaterialIcons name="skip-next" size={40} color={C.textSecondary} />
              </Pressable>
            </View>

            {/* Secondary Controls */}
            <View style={styles.secondaryControls}>
              {/* Repeat */}
              <Pressable
                onPress={cycleRepeat}
                style={[
                  styles.secBtn,
                  {
                    backgroundColor: repeatMode !== 'none' ? `${C.gold}20` : C.card,
                    borderColor: repeatMode !== 'none' ? `${C.gold}40` : C.cardBorder,
                  },
                ]}
              >
                <MaterialIcons
                  name={repeatMode === 'ayah' ? 'repeat-one' : 'repeat'}
                  size={18}
                  color={repeatMode !== 'none' ? C.gold : C.textMuted}
                />
                <Text style={[styles.secBtnLabel, { color: repeatMode !== 'none' ? C.gold : C.textMuted }]}>
                  {repeatMode === 'none' ? 'Off' : repeatMode === 'ayah' ? 'Ayah' : 'Surah'}
                </Text>
              </Pressable>

              {/* Playback Speed */}
              <View style={[styles.speedWrap, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                {SPEED_OPTIONS.map(speed => (
                  <Pressable
                    key={speed}
                    style={[styles.speedBtn, playbackSpeed === speed && { backgroundColor: C.gold }]}
                    onPress={() => setPlaybackSpeed(speed)}
                  >
                    <Text style={[
                      styles.speedBtnText,
                      { color: playbackSpeed === speed ? C.primaryDark : C.textMuted },
                    ]}>
                      {speed}×
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Stop */}
              <Pressable
                onPress={() => { stop(); setShowNowPlaying(false); }}
                style={[styles.secBtn, { backgroundColor: `${C.error}15`, borderColor: `${C.error}30` }]}
              >
                <MaterialIcons name="stop" size={18} color={C.error} />
                <Text style={[styles.secBtnLabel, { color: C.error }]}>Stop</Text>
              </Pressable>
            </View>

            {/* Quick Surah Jump */}
            <Text style={[styles.quickJumpTitle, { color: C.textPrimary }]}>All Surahs</Text>
            <View style={styles.surahGrid}>
              {SURAH_LIST.map(s => (
                <Pressable
                  key={s.number}
                  style={[
                    styles.surahGridItem,
                    { backgroundColor: C.card, borderColor: C.cardBorder },
                    nowPlaying.surahNumber === s.number && {
                      backgroundColor: `${C.gold}20`,
                      borderColor: C.gold,
                    },
                  ]}
                  onPress={() => playSurah(s.number, nowPlaying.reciterId)}
                >
                  <Text style={[
                    styles.surahGridNum,
                    { color: nowPlaying.surahNumber === s.number ? C.gold : C.textMuted },
                  ]}>
                    {s.number}
                  </Text>
                  <Text
                    style={[
                      styles.surahGridName,
                      { color: nowPlaying.surahNumber === s.number ? C.gold : C.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {s.transliteration}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  progressTrack: { height: 3 },
  progressFill: { height: '100%' },
  barContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 8,
  },
  surahIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  barInfo: { flex: 1 },
  barTitle: { fontSize: 15, fontWeight: '700' },
  barSub: { fontSize: 11, marginTop: 1 },
  barBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  barPlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nowPlayingContainer: { flex: 1 },
  nowPlayingGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  npHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    justifyContent: 'space-between',
  },
  npDismiss: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  npHeaderTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  npContent: { paddingHorizontal: Spacing.lg, alignItems: 'center' },

  artwork: {
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
  },
  artworkArabic: { fontSize: 52, fontWeight: '400', textAlign: 'center' },
  artworkSurahNum: { fontSize: 16, fontWeight: '600' },
  artworkSubtext: { fontSize: 13 },

  npMeta: { alignItems: 'center', marginBottom: Spacing.lg, gap: 4 },
  npSurahName: { fontSize: 24, fontWeight: '700' },
  npReciter: { fontSize: 15, fontWeight: '500' },

  scrubberWrap: { width: '100%', marginBottom: Spacing.lg },
  scrubberTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  scrubberFill: {
    height: '100%',
    borderRadius: 3,
    alignItems: 'flex-end',
    justifyContent: 'center',
    position: 'relative',
  },
  scrubberThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    position: 'absolute',
    right: -8,
    borderWidth: 2,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  timeText: { fontSize: 12 },

  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  controlBtn: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  secondaryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.xl,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  secBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  secBtnLabel: { fontSize: 13, fontWeight: '600' },
  speedWrap: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  speedBtn: { paddingHorizontal: 10, paddingVertical: 9 },
  speedBtnText: { fontSize: 12, fontWeight: '700' },

  quickJumpTitle: { fontSize: 16, fontWeight: '700', alignSelf: 'flex-start', marginBottom: Spacing.sm },
  surahGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
    width: '100%',
  },
  surahGridItem: {
    width: 60,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  surahGridNum: { fontSize: 11, fontWeight: '700' },
  surahGridName: { fontSize: 9, marginTop: 2, textAlign: 'center' },
});
