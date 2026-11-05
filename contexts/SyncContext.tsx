/**
 * Account + cloud sync state.
 *
 * Kept separate from `AppContext` on purpose: `AppContext` is the offline data
 * layer and must stay usable with no network and no backend. This provider adds
 * the optional cloud layer on top, and everything here degrades to "signed out,
 * local only" when `EXPO_PUBLIC_API_URL` is not set.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState } from 'react-native';
import { useApp } from './AppContext';
import {
  fetchAccount, isSyncConfigured, signOut as signOutRequest,
  verifyLoginCode, requestLoginCode, type Account, type SyncOutcome,
} from '../services/syncService';
import {
  IDLE_STATUS, loadStatus, syncNow, clearLocalChanges, type SyncStatus,
} from '../services/syncEngine';

interface SyncContextType {
  /** False when the build has no `EXPO_PUBLIC_API_URL`; the UI hides sign-in. */
  configured: boolean;
  ready: boolean;
  account: Account | null;
  status: SyncStatus;
  /** Asks the server to email a code. */
  sendCode: (email: string) => Promise<SyncOutcome<{ email: string; expiresInMinutes: number; devCode?: string }>>;
  /** Verifies the code, links this device, and merges local + cloud data. */
  signIn: (email: string, code: string) => Promise<SyncOutcome<Account>>;
  signOut: () => Promise<void>;
  /** Manual "Sync now" from the profile screen. */
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { reloadFromStorage, hydrated } = useApp();
  const [account, setAccount] = useState<Account | null>(null);
  const [status, setStatus] = useState<SyncStatus>(IDLE_STATUS);
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(true);
  const syncingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const runSync = useCallback(async (mode: 'merge' | 'replace' = 'replace') => {
    if (!isSyncConfigured || syncingRef.current || !hydrated) return;
    syncingRef.current = true;
    setStatus(previous => ({ ...previous, phase: 'syncing', message: null }));
    try {
      const next = await syncNow({ mode });
      if (mountedRef.current) setStatus(next);
      if (next.phase === 'synced') {
        await clearLocalChanges();
        // Remote data may have replaced what is on disk, so pull it into the
        // running app instead of waiting for the next launch.
        await reloadFromStorage();
      }
    } finally {
      syncingRef.current = false;
    }
  }, [reloadFromStorage, hydrated]);

  // Restore the session, then sync once. A failure here is not fatal: the app
  // simply stays local-only.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus(await loadStatus());

      if (!isSyncConfigured) {
        if (!cancelled) setReady(true);
        return;
      }

      const result = await fetchAccount();
      if (cancelled) return;

      if (result.ok && result.value) {
        setAccount(result.value);
        await runSync('replace');
      } else if (!result.ok) {
        setStatus(previous => ({
          ...previous,
          phase: result.status === 0 ? 'offline' : 'error',
          message: result.message,
        }));
      }

      if (!cancelled) setReady(true);
    })();

    return () => { cancelled = true; };
  }, [runSync, hydrated]);

  // Sync whenever the app returns to the foreground (cheap and predictable:
  // no background timers, no hidden network traffic while the app is closed).
  useEffect(() => {
    if (!isSyncConfigured) return;
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && account) runSync('replace');
    });
    return () => subscription.remove();
  }, [account, runSync]);

  const sendCode = useCallback((email: string) => requestLoginCode(email), []);

  const signIn = useCallback(async (email: string, code: string) => {
    const result = await verifyLoginCode(email, code);
    if (!result.ok) return result;

    setAccount(result.value);
    // First link: union local and cloud collections so this device's existing
    // bookmarks and notes survive signing in.
    await runSync('merge');
    return result;
  }, [runSync]);

  const signOut = useCallback(async () => {
    await signOutRequest();
    setAccount(null);
    setStatus(previous => ({ ...previous, phase: 'idle', message: null, lastApplied: [] }));
  }, []);

  const value = useMemo<SyncContextType>(() => ({
    configured: isSyncConfigured,
    ready,
    account,
    status,
    sendCode,
    signIn,
    signOut,
    syncNow: () => runSync('replace'),
  }), [ready, account, status, sendCode, signIn, signOut, runSync]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextType {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used inside SyncProvider');
  return context;
}
