/**
 * Cloud sync client.
 *
 * Talks to the `server/` package: passwordless sign-in (emailed 6-digit code)
 * and whole-document last-writer-wins sync of the app's local data.
 *
 * Design rules that matter:
 *
 * - **The app is local-first.** Nothing here is required to read the Quran,
 *   bookmark, or use the app offline. Every function fails soft: if the API is
 *   unreachable or unconfigured, local state is untouched and the UI shows an
 *   "offline, will sync later" state.
 * - **The token lives in the device keychain** (`expo-secure-store`), never in
 *   AsyncStorage, and is never logged.
 * - **No secrets ship in the binary.** Only a public base URL
 *   (`EXPO_PUBLIC_API_URL`) is bundled; the database connection string stays on
 *   the server.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/* ─────────────────────────── configuration ─────────────────────────── */

const RAW_API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();

/** Trailing slashes are stripped so paths join predictably. */
export const API_URL = RAW_API_URL.replace(/\/+$/, '');

/** True when a backend URL has been baked into this build. */
export const isSyncConfigured = API_URL.length > 0;

const TOKEN_KEY = 'sync_session_token';
const DEVICE_KEY = 'sync_device_id';

/* ─────────────────────────── types ─────────────────────────── */

export type SyncEntity =
  | 'bookmarks' | 'notes' | 'highlights' | 'readingProgress'
  | 'favoriteDuas' | 'asmaFavorites' | 'nameFavorites' | 'fastingDays'
  | 'salahRecords' | 'tasbeehHistory' | 'aiConversations' | 'aiMessages'
  | 'settings' | 'lastRead';

export interface EntityState {
  revision: number;
  deviceId: string | null;
  updatedAt: string;
  data: unknown;
}

export type EntityMap = Partial<Record<SyncEntity, EntityState>>;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

export interface Account {
  user: SessionUser;
  expiresAt: string;
}

export interface PushResult {
  applied: SyncEntity[];
  rejected: SyncEntity[];
  entities: EntityMap;
  serverTime: string;
}

export type SyncOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; message: string };

/* ─────────────────────────── tokens & device id ─────────────────────────── */

let cachedToken: string | null | undefined;

/**
 * Secure storage is native-only. On web we fall back to AsyncStorage, which is
 * localStorage — acceptable because the web build is a secondary target and the
 * token is still scoped to this origin.
 */
async function readStore(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return await AsyncStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeStore(key: string, value: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (value === null) await AsyncStorage.removeItem(key);
      else await AsyncStorage.setItem(key, value);
      return;
    }
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch { /* keychain unavailable — session simply won't persist */ }
}

export async function getToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  cachedToken = await readStore(TOKEN_KEY);
  return cachedToken;
}

async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
  await writeStore(TOKEN_KEY, token);
}

/**
 * Stable per-install identifier used only to break exact revision ties between
 * two devices. Not a hardware id, not a tracking id, and not sent anywhere
 * except with sync payloads.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await readStore(DEVICE_KEY);
  if (existing) return existing;
  const random = Math.random().toString(36).slice(2, 10);
  const id = `${Platform.OS}-${Date.now().toString(36)}-${random}`;
  await writeStore(DEVICE_KEY, id);
  return id;
}

/* ─────────────────────────── transport ─────────────────────────── */

const REQUEST_TIMEOUT_MS = 15_000;

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<SyncOutcome<T>> {
  if (!isSyncConfigured) {
    return { ok: false, status: 0, message: 'Sync is not configured for this build.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    if (init.auth) {
      const token = await getToken();
      if (!token) return { ok: false, status: 401, message: 'Please sign in again.' };
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = null; }
    }

    if (!response.ok) {
      const message = (payload as { error?: string } | null)?.error
        ?? `Request failed (${response.status}).`;
      // A revoked or expired token must not keep looking like a network blip.
      if (response.status === 401) await setToken(null);
      return { ok: false, status: response.status, message };
    }

    return { ok: true, value: payload as T };
  } catch (error) {
    const aborted = (error as { name?: string } | null)?.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      message: aborted
        ? 'The server took too long to respond. Your changes are saved on this device.'
        : 'No connection. Your changes are saved on this device and will sync later.',
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ─────────────────────────── auth ─────────────────────────── */

export interface RequestCodeResult {
  email: string;
  expiresInMinutes: number;
  /** Present only when the server runs with codes echoed back (development). */
  devCode?: string;
}

export function requestLoginCode(email: string) {
  return call<RequestCodeResult>('/auth/request-code', {
    method: 'POST',
    body: { email: email.trim() },
  });
}

export async function verifyLoginCode(email: string, code: string): Promise<SyncOutcome<Account>> {
  const result = await call<Account & { token: string; expiresAt: string }>('/auth/verify', {
    method: 'POST',
    body: { email: email.trim(), code: code.trim() },
  });
  if (!result.ok) return result;

  await setToken(result.value.token);
  return {
    ok: true,
    value: { user: result.value.user, expiresAt: result.value.expiresAt },
  };
}

/** Returns the signed-in account, or null when there is no valid session. */
export async function fetchAccount(): Promise<SyncOutcome<Account | null>> {
  if (!(await getToken())) return { ok: true, value: null };
  const result = await call<Account>('/auth/me', { auth: true });
  if (!result.ok) {
    // 401 is expected after expiry; anything else is a real problem.
    if (result.status === 401) return { ok: true, value: null };
    return result;
  }
  return { ok: true, value: result.value };
}

export async function signOut(): Promise<void> {
  if (isSyncConfigured && (await getToken())) {
    await call('/auth/logout', { method: 'POST', auth: true });
  }
  await setToken(null);
}

/** Deletes the account and every row it owns. Local data is left alone. */
export async function deleteAccount(): Promise<SyncOutcome<{ deleted: boolean }>> {
  const result = await call<{ deleted: boolean }>('/account', { method: 'DELETE', auth: true });
  if (result.ok) await setToken(null);
  return result;
}

/* ─────────────────────────── sync ─────────────────────────── */

export function pullAll() {
  return call<{ entities: EntityMap; serverTime: string }>('/sync', { auth: true });
}

export function pushEntities(
  entities: Partial<Record<SyncEntity, { revision: number; deviceId: string; clientUpdatedAt?: string; data: unknown }>>,
) {
  return call<PushResult>('/sync', { method: 'POST', body: { entities }, auth: true });
}

export function healthCheck() {
  return call<{ ok: boolean; time: string }>('/health');
}
