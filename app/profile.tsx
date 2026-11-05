/**
 * Profile Screen — Shows local account status and data summary.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Alert, Share,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { SURAH_LIST } from '../constants/quranData';
import { APP_VERSION } from '../constants/appInfo';
import {
  createBackup, parseBackup, restoreBackup, writeBackupFile, BackupDocument,
} from '../services/backupService';

const { width: Dimensions_width } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, settings, bookmarks, notes, fastingDays, aiConversations } = useApp();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupDocument | null>(null);

  const handleExport = async () => {
    if (busy) return;
    setBusy('export');
    try {
      const { doc, summary } = await createBackup(APP_VERSION);
      if (summary.keyCount === 0) {
        Alert.alert('Nothing to back up yet', 'Your bookmarks, notes and progress are empty.');
        return;
      }
      const fileUri = await writeBackupFile(doc);
      await Share.share({
        message: `IslamicGuide backup (${summary.keyCount} sections) saved to: ${fileUri}`,
        url: fileUri,
        title: 'IslamicGuide backup',
      });
    } catch {
      Alert.alert('Backup failed', 'Could not create the backup file. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  /**
   * Restore reads the pasted/provided JSON. Without a file picker dependency we
   * accept the backup text itself, which is exactly what the export produces
   * and what a user can copy from their notes app or desktop.
   */
  const handleImportPrompt = () => {
    Alert.prompt?.(
      'Restore from backup',
      'Paste the contents of your IslamicGuide backup file.',
      async (text?: string) => {
        if (!text) return;
        try {
          const doc = parseBackup(text);
          setPendingBackup(doc);
          Alert.alert(
            'Replace local data?',
            `This backup contains ${Object.keys(doc.data).length} sections from ${new Date(doc.createdAt).toLocaleDateString()}. Your current bookmarks, notes and progress will be overwritten.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setPendingBackup(null) },
              {
                text: 'Restore',
                style: 'destructive',
                onPress: async () => {
                  setBusy('import');
                  try {
                    const count = await restoreBackup(doc);
                    Alert.alert('Restored', `${count} sections restored. Reopen the app to see them.`);
                  } catch {
                    Alert.alert('Restore failed', 'The backup could not be applied.');
                  } finally {
                    setBusy(null);
                    setPendingBackup(null);
                  }
                },
              },
            ],
          );
        } catch (error) {
          Alert.alert(
            'Invalid backup',
            error instanceof Error ? error.message : 'That text is not a valid backup.',
          );
        }
      },
      'plain-text',
    ) ?? Alert.alert(
      'Restore not available',
      'Paste-based restore is only available on iOS. On this device, keep your exported backup file and contact support.',
    );
  };

  const readingProgress = settings.readingProgress;
  const progressEntries = Object.entries(readingProgress);
  const surahsStarted = progressEntries.length;
  // `readingProgress` holds the last ayah reached per surah, so cap each entry
  // at the surah's verse count instead of summing raw indices.
  const totalAyahsRead = progressEntries.reduce((sum, [key, lastAyah]) => {
    const surah = SURAH_LIST[parseInt(key, 10) - 1];
    return sum + (surah ? Math.min(lastAyah, surah.versesCount) : lastAyah);
  }, 0);
  const completionPct = Math.min(100, Math.round((totalAyahsRead / 6236) * 100));

  const DATA_ITEMS = [
    {
      icon: 'bookmark', label: 'Bookmarks', value: bookmarks.length,
      sub: 'Verses, Hadiths & Duas', color: C.gold,
    },
    {
      icon: 'note', label: 'Notes & Highlights', value: notes.length,
      sub: 'Personal annotations', color: C.info,
    },
    {
      icon: 'menu-book', label: 'Quran Progress', value: `${surahsStarted} Surahs`,
      sub: `${totalAyahsRead.toLocaleString()} ayahs · ${completionPct}%`, color: C.success,
    },
    {
      icon: 'smart-toy', label: 'AI Conversations', value: aiConversations?.length ?? 0,
      sub: 'Chat history with Islamic Guide', color: '#7B68EE',
    },
    {
      icon: 'favorite', label: 'Fasting Records', value: fastingDays.filter(d => d.fasted).length,
      sub: 'Days fasted', color: C.error,
    },
  ];

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
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Profile</Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: `${C.gold}20`, borderColor: `${C.gold}40` }]}>
            <MaterialIcons name="person" size={40} color={C.gold} />
          </View>
          <Text style={[styles.guestName, { color: C.textPrimary }]}>Guest User</Text>
          <Text style={[styles.guestSub, { color: C.textSecondary }]}>Using Islamic Guide locally</Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* ── Connect Backend Banner ─────────────────────────────────────────── */}
        <View style={[styles.connectBanner, { backgroundColor: `${C.gold}10`, borderColor: `${C.gold}30`, margin: Spacing.md }]}>
          <View style={[styles.connectIconBox, { backgroundColor: `${C.gold}20` }]}>
            <MaterialIcons name="cloud" size={28} color={C.gold} />
          </View>
          <View style={styles.connectInfo}>
            <Text style={[styles.connectTitle, { color: C.textPrimary }]}>Enable Cloud Sync</Text>
            <Text style={[styles.connectDesc, { color: C.textSecondary }]}>
              Cloud sync is not configured. Bookmarks, notes, reading progress, and AI history stay on this device for now.
            </Text>
            <View style={styles.connectSteps}>
              {[
                'Configure a secure account API on your server',
                'Enable authentication on that API',
                'Connect this app through the server API',
              ].map((step, i) => (
                <View key={i} style={styles.connectStep}>
                  <View style={[styles.stepNum, { backgroundColor: `${C.gold}20` }]}>
                    <Text style={[styles.stepNumText, { color: C.gold }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: C.textSecondary }]}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Auth Status ────────────────────────────────────────────────────── */}
        <View style={[styles.section, { paddingHorizontal: Spacing.md }]}>
          <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Authentication</Text>
          <View style={[styles.authCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <View style={[styles.authStatus, { backgroundColor: `${C.warning}15`, borderColor: `${C.warning}30` }]}>
              <MaterialIcons name="cloud-off" size={18} color={C.warning} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.authStatusTitle, { color: C.warning }]}>Not Connected</Text>
                <Text style={[styles.authStatusSub, { color: C.textMuted }]}>
                  Sign-in is unavailable until a secure account backend is configured.
                </Text>
              </View>
            </View>

            {/* Sign in form placeholder */}
            <View style={styles.authFormPlaceholder}>
              <View style={[styles.inputPlaceholder, { backgroundColor: C.background, borderColor: C.cardBorder }]}>
                <MaterialIcons name="email" size={16} color={C.textMuted} />
                <Text style={[styles.inputPlaceholderText, { color: C.textMuted }]}>Email address</Text>
              </View>
              <View style={[styles.inputPlaceholder, { backgroundColor: C.background, borderColor: C.cardBorder }]}>
                <MaterialIcons name="lock" size={16} color={C.textMuted} />
                <Text style={[styles.inputPlaceholderText, { color: C.textMuted }]}>Password</Text>
              </View>
              <View style={[styles.disabledBtn, { backgroundColor: C.cardBorder }]}>
                <MaterialIcons name="lock" size={16} color={C.textMuted} />
                <Text style={[styles.disabledBtnText, { color: C.textMuted }]}>
                  Authentication Not Configured
                </Text>
              </View>
              <Text style={[styles.authFormNote, { color: C.textMuted }]}>
                Once connected: sign up · sign in · forgot password · email verification — all available here.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Local Data Summary ─────────────────────────────────────────────── */}
        <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Your Local Data</Text>
            <View style={[styles.localBadge, { backgroundColor: `${C.success}15` }]}>
              <MaterialIcons name="offline-bolt" size={12} color={C.success} />
              <Text style={[styles.localBadgeText, { color: C.success }]}>Stored locally</Text>
            </View>
          </View>
          <Text style={[styles.sectionDesc, { color: C.textMuted }]}>
            Your data is saved on this device. Cloud backup is not configured.
          </Text>

          <View style={[styles.dataList, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            {DATA_ITEMS.map((item, i) => (
              <View
                key={item.label}
                style={[styles.dataRow, i > 0 && { borderTopColor: C.cardBorder, borderTopWidth: 1 }]}
              >
                <View style={[styles.dataIcon, { backgroundColor: `${item.color}15` }]}>
                  <MaterialIcons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={styles.dataInfo}>
                  <Text style={[styles.dataLabel, { color: C.textPrimary }]}>{item.label}</Text>
                  <Text style={[styles.dataSub, { color: C.textMuted }]}>{item.sub}</Text>
                </View>
                <View style={[styles.dataValueBox, { backgroundColor: `${item.color}10` }]}>
                  <Text style={[styles.dataValue, { color: item.color }]}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Sync Status ────────────────────────────────────────────────────── */}
        <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
          <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Cloud Sync Status</Text>
          <View style={[styles.syncCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            {[
              { label: 'Bookmarks', status: 'Local only', icon: 'bookmark' },
              { label: 'Notes & Highlights', status: 'Local only', icon: 'note' },
              { label: 'Reading Progress', status: 'Local only', icon: 'menu-book' },
              { label: 'AI Chat History', status: 'Local only', icon: 'smart-toy' },
              { label: 'Prayer Records', status: 'Local only', icon: 'mosque' },
              { label: 'Fasting Log', status: 'Local only', icon: 'favorite' },
            ].map((item, i) => (
              <View
                key={item.label}
                style={[styles.syncRow, i > 0 && { borderTopColor: C.cardBorder, borderTopWidth: 1 }]}
              >
                <MaterialIcons name={item.icon as any} size={16} color={C.textMuted} />
                <Text style={[styles.syncLabel, { color: C.textSecondary }]}>{item.label}</Text>
                <View style={[styles.syncStatusBadge, { backgroundColor: `${C.warning}12` }]}>
                  <MaterialIcons name="cloud-off" size={11} color={C.warning} />
                  <Text style={[styles.syncStatusText, { color: C.warning }]}>{item.status}</Text>
                </View>
              </View>
            ))}
            <View style={[styles.syncFooter, { borderTopColor: C.cardBorder }]}>
              <MaterialIcons name="info-outline" size={13} color={C.textMuted} />
              <Text style={[styles.syncFooterText, { color: C.textMuted }]}>
                Account sync is not configured. Until it is, back up manually below — the file
                contains everything listed above.
              </Text>
            </View>

            <View style={styles.backupRow}>
              <Pressable
                style={[styles.backupBtn, { backgroundColor: `${C.gold}15`, borderColor: `${C.gold}40` }]}
                onPress={handleExport}
                disabled={busy !== null}
              >
                {busy === 'export'
                  ? <ActivityIndicator size="small" color={C.gold} />
                  : <MaterialIcons name="download" size={16} color={C.gold} />}
                <Text style={[styles.backupBtnText, { color: C.gold }]}>Export backup</Text>
              </Pressable>
              <Pressable
                style={[styles.backupBtn, { backgroundColor: `${C.info}15`, borderColor: `${C.info}40` }]}
                onPress={handleImportPrompt}
                disabled={busy !== null || pendingBackup !== null}
              >
                {busy === 'import'
                  ? <ActivityIndicator size="small" color={C.info} />
                  : <MaterialIcons name="upload" size={16} color={C.info} />}
                <Text style={[styles.backupBtnText, { color: C.info }]}>Restore</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Quick Actions ──────────────────────────────────────────────────── */}
        <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
          <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Quick Actions</Text>
          <View style={styles.quickActions}>
            {[
              { icon: 'bookmark', label: 'My Bookmarks', route: '/bookmarks', color: C.gold },
              { icon: 'note', label: 'My Notes', route: '/notes-library', color: C.info },
              { icon: 'bar-chart', label: 'Statistics', route: '/reading-stats', color: C.success },
              { icon: 'settings', label: 'Settings', route: '/settings', color: C.textSecondary },
            ].map(action => (
              <Pressable
                key={action.label}
                style={[styles.quickActionBtn, { backgroundColor: C.card, borderColor: C.cardBorder }]}
                onPress={() => router.push(action.route as any)}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}15` }]}>
                  <MaterialIcons name={action.icon as any} size={22} color={action.color} />
                </View>
                <Text style={[styles.quickActionLabel, { color: C.textSecondary }]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: Spacing.md, paddingBottom: Spacing.xl },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md, marginBottom: Spacing.lg,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },

  backupRow: { flexDirection: 'row', gap: 10, padding: Spacing.md },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  backupBtnText: { fontSize: 12, fontWeight: '700' },
  avatarSection: { alignItems: 'center', gap: 8 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  guestName: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  guestSub: { fontSize: 13 },

  connectBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md,
  },
  connectIconBox: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  connectInfo: { flex: 1 },
  connectTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  connectDesc: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  connectSteps: { gap: 8 },
  connectStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontSize: 12, fontWeight: '700' },
  stepText: { fontSize: 12, flex: 1, lineHeight: 18 },

  section: {},
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.sm },
  sectionDesc: { fontSize: 12, marginBottom: Spacing.sm, lineHeight: 18 },
  localBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  localBadgeText: { fontSize: 11, fontWeight: '600' },

  authCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  authStatus: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderWidth: 0,
    borderBottomWidth: 1,
  },
  authStatusTitle: { fontSize: 14, fontWeight: '700' },
  authStatusSub: { fontSize: 12, marginTop: 2, lineHeight: 18 },
  authFormPlaceholder: { padding: 14, gap: 10 },
  inputPlaceholder: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: Radius.md, borderWidth: 1, padding: 12,
  },
  inputPlaceholderText: { fontSize: 14 },
  disabledBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: Radius.md,
  },
  disabledBtnText: { fontSize: 13, fontWeight: '600' },
  authFormNote: { fontSize: 11, textAlign: 'center', lineHeight: 17 },

  dataList: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  dataRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
  dataIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dataInfo: { flex: 1 },
  dataLabel: { fontSize: 14, fontWeight: '600' },
  dataSub: { fontSize: 11, marginTop: 2 },
  dataValueBox: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  dataValue: { fontSize: 14, fontWeight: '700' },

  syncCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  syncRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12,
  },
  syncLabel: { flex: 1, fontSize: 13 },
  syncStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  syncStatusText: { fontSize: 10, fontWeight: '600' },
  syncFooter: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    padding: 12, borderTopWidth: 1,
  },
  syncFooterText: { flex: 1, fontSize: 11, lineHeight: 17 },

  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickActionBtn: {
    width: (Dimensions_width - Spacing.md * 2 - 10) / 2,
    borderRadius: Radius.lg, borderWidth: 1,
    padding: 14, alignItems: 'center', gap: 8,
  },
  quickActionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 13, fontWeight: '600' },
});

