/**
 * AccountPanel — cloud sync sign-in and status for the Profile screen.
 *
 * Chooses one of four presentations:
 *  - **Not configured** (no `EXPO_PUBLIC_API_URL`): explains that everything is
 *    local, so a build without a backend still reads sensibly.
 *  - **Signed out**: passwordless email form (request a 6-digit code, then
 *    enter it). No password field, because there are no passwords.
 *  - **Signed in**: account identity, last-sync time, and a manual sync button.
 *  - **Offline**: same as signed in, but with an explicit "saved on this
 *    device, will sync later" state so a failed sync never looks like data loss.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useSync } from '../contexts/SyncContext';

function formatRelative(iso: string | null): string {
  if (!iso) return 'not yet';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'not yet';
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export default function AccountPanel() {
  const { colors: C } = useApp();
  const { configured, ready, account, status, sendCode, signIn, signOut, syncNow } = useSync();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (busy) return;
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await sendCode(trimmed);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStage('code');
      setNotice(
        result.value.devCode
          // Development servers echo the code back so this can be tested
          // without a mail provider configured.
          ? `Development mode — your code is ${result.value.devCode}.`
          : `We sent a 6-digit code to ${trimmed}. It expires in ${result.value.expiresInMinutes} minutes.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (busy) return;
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await signIn(email.trim(), trimmed);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(null);
      setCode('');
      setStage('email');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign out?',
      'Your data stays on this device. You can sign back in any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => { void signOut(); } },
      ],
    );
  };

  const panelStyle = [styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }];

  /* ── 1. No backend in this build ───────────────────────────────────────── */
  if (!configured) {
    return (
      <View style={[styles.section, { paddingHorizontal: Spacing.md }]}>
        <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Cloud Sync</Text>
        <View style={panelStyle}>
          <View style={[styles.statusRow, { backgroundColor: `${C.info}15`, borderColor: `${C.info}30` }]}>
            <MaterialIcons name="phonelink-off" size={18} color={C.info} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: C.info }]}>Local only</Text>
              <Text style={[styles.statusSub, { color: C.textMuted }]}>
                This build has no sync server configured, so every bookmark, note and setting
                stays on this device. Nothing is lost — it simply is not backed up to the cloud.
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  /* ── 2. Signed in ──────────────────────────────────────────────────────── */
  if (account) {
    const offline = status.phase === 'offline';
    const accent = offline ? C.warning : C.success;
    return (
      <View style={[styles.section, { paddingHorizontal: Spacing.md }]}>
        <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Cloud Sync</Text>
        <View style={panelStyle}>
          <View style={[styles.statusRow, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}>
            <MaterialIcons name={offline ? 'cloud-off' : 'cloud-done'} size={18} color={accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: accent }]}>
                {offline ? 'Offline — will sync later' : 'Signed in'}
              </Text>
              <Text style={[styles.statusSub, { color: C.textMuted }]} numberOfLines={2}>
                {account.user.email}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: C.textMuted }]}>Last synced</Text>
            <Text style={[styles.metaValue, { color: C.textSecondary }]}>
              {status.phase === 'syncing' ? 'syncing…' : formatRelative(status.lastSyncedAt)}
            </Text>
          </View>

          {status.message ? (
            <Text style={[styles.hint, { color: offline ? C.warning : C.error }]}>
              {status.message}
            </Text>
          ) : (
            <Text style={[styles.hint, { color: C.textMuted }]}>
              Changes on this device sync automatically when the app is opened.
            </Text>
          )}

          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => { void syncNow(); }}
              disabled={status.phase === 'syncing'}
              accessibilityRole="button"
              accessibilityLabel="Sync now"
              style={[styles.primaryBtn, {
                backgroundColor: status.phase === 'syncing' ? C.cardBorder : `${C.primary}30`,
                borderColor: C.primary,
              }]}
            >
              {status.phase === 'syncing' ? (
                <ActivityIndicator size="small" color={C.textSecondary} />
              ) : (
                <MaterialIcons name="sync" size={16} color={C.textPrimary} />
              )}
              <Text style={[styles.primaryBtnText, { color: C.textPrimary }]}>Sync now</Text>
            </Pressable>

            <Pressable
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={[styles.secondaryBtn, { borderColor: C.cardBorder }]}
            >
              <Text style={[styles.secondaryBtnText, { color: C.textSecondary }]}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  /* ── 3. Signed out ─────────────────────────────────────────────────────── */
  const inputStyle = [styles.input, {
    backgroundColor: C.background, borderColor: C.cardBorder, color: C.textPrimary,
  }];

  return (
    <View style={[styles.section, { paddingHorizontal: Spacing.md }]}>
      <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>Cloud Sync</Text>
      <View style={panelStyle}>
        <View style={[styles.statusRow, { backgroundColor: `${C.gold}12`, borderColor: `${C.gold}30` }]}>
          <MaterialIcons name="cloud-upload" size={18} color={C.gold} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: C.gold }]}>
              {ready ? 'Back up across devices' : 'Checking account…'}
            </Text>
            <Text style={[styles.statusSub, { color: C.textMuted }]}>
              Sign in to keep your bookmarks, notes, highlights and reading progress in sync.
              No password — we email you a 6-digit code.
            </Text>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={text => { setEmail(text); setError(null); }}
              placeholder="you@example.com"
              placeholderTextColor={C.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy && stage === 'email'}
              onSubmitEditing={handleSendCode}
              returnKeyType="send"
              accessibilityLabel="Email address"
              style={inputStyle}
            />
          </View>

          {stage === 'code' && (
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>6-digit code</Text>
              <TextInput
                value={code}
                onChangeText={text => { setCode(text.replace(/[^0-9]/g, '').slice(0, 6)); setError(null); }}
                placeholder="123456"
                placeholderTextColor={C.textMuted}
                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                maxLength={6}
                editable={!busy}
                onSubmitEditing={handleVerify}
                returnKeyType="go"
                accessibilityLabel="Login code"
                style={[inputStyle, styles.codeInput]}
              />
            </View>
          )}

          {notice && !error && (
            <Text style={[styles.notice, { color: C.info }]}>{notice}</Text>
          )}
          {error && <Text style={[styles.errorText, { color: C.error }]}>{error}</Text>}

          <Pressable
            onPress={stage === 'email' ? handleSendCode : handleVerify}
            disabled={busy}
            accessibilityRole="button"
            style={[styles.submitBtn, { backgroundColor: busy ? C.cardBorder : C.primary }]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={C.textPrimary} />
            ) : (
              <Text style={[styles.submitBtnText, { color: C.textPrimary }]}>
                {stage === 'email' ? 'Email me a code' : 'Sign in'}
              </Text>
            )}
          </Pressable>

          {stage === 'code' && (
            <Pressable
              onPress={() => { setStage('email'); setCode(''); setError(null); setNotice(null); }}
              accessibilityRole="button"
              style={styles.linkBtn}
            >
              <Text style={[styles.linkText, { color: C.textSecondary }]}>
                Use a different email
              </Text>
            </Pressable>
          )}

          <Text style={[styles.hint, { color: C.textMuted }]}>
            Your data stays on this device and keeps working offline. Signing in only adds a
            copy in the cloud.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.sm },
  card: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  statusRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderBottomWidth: 1,
  },
  statusTitle: { fontSize: 14, fontWeight: '700' },
  statusSub: { fontSize: 12, marginTop: 2, lineHeight: 18 },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 12,
  },
  metaLabel: { fontSize: 12 },
  metaValue: { fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 11, lineHeight: 17, paddingHorizontal: 14, paddingTop: 8 },
  buttonRow: { flexDirection: 'row', gap: 10, padding: 14 },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: Radius.round, borderWidth: 1,
  },
  primaryBtnText: { fontSize: 13, fontWeight: '700' },
  secondaryBtn: {
    paddingHorizontal: 16, paddingVertical: 11,
    borderRadius: Radius.round, borderWidth: 1, justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '600' },
  form: { padding: 14, gap: 12 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15,
  },
  codeInput: { fontSize: 20, letterSpacing: 6, textAlign: 'center' },
  notice: { fontSize: 12, lineHeight: 18 },
  errorText: { fontSize: 12, lineHeight: 18 },
  submitBtn: {
    paddingVertical: 13, borderRadius: Radius.round,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '700' },
  linkBtn: { alignItems: 'center', paddingVertical: 2 },
  linkText: { fontSize: 12, fontWeight: '600' },
});
