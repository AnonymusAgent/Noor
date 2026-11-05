/**
 * Client-side sync engine.
 *
 * Sits between AsyncStorage (the source of truth for the app) and the
 * `server/` API. Three rules drive the design:
 *
 * 1. **Local data is never destroyed.** The first sync of a device that already
 *    has data is a *merge*: the local collection is unioned by `id` with the
 *    server's, so signing in on a phone you have been using for months does not
 *    wipe bookmarks, notes or chat history.
 * 2. **Every device agrees.** Writes carry a `revision` (a clock that only moves
 *    forward) and a `deviceId`; the higher revision wins and `deviceId` breaks
 *    exact ties. The server is the arbiter, so all devices converge.
 * 3. **Offline is normal.** Any failure is recorded in the sync status and
 *    retried later; it never throws into the UI or blocks a local write.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDeviceId, pullAll, pushEntities, isSyncConfigured,
  type EntityMap, type SyncEntity,
} from './syncService';

/* ─────────────────────────── entity ↔ storage mapping ─────────────────────────── */

const STORAGE_KEY: Record<SyncEntity, string> = {
  bookmarks: 'bookmarks',
  notes: 'notes',
  highlights: 'highlights',
  readingProgress: 'app_settings_v2', // lives inside settings.readingProgress
  favoriteDuas: 'favorite_duas',
  asmaFavorites: 'asma_favorites',
  nameFavorites: 'name_favorites',
  fastingDays: 'fasting_days',
  salahRecords: 'salah_records',
  tasbeehHistory: 'tasbeeh_history',
  aiConversations: 'ai_conversations',
  aiMessages: 'ai_messages',
  settings: 'app_settings_v2',
  lastRead: 'last_read',
};

/** Collections: list-shaped data that is merged by `id` on first sync. */
const MERGE_BY_ID: SyncEntity[] = [
  'bookmarks', 'notes', 'highlights', 'favoriteDuas', 'asmaFavorites',
  'nameFavorites', 'fastingDays', 'salahRecords', 'tasbeehHistory',
  'aiConversations', 'aiMessages',
];

/** Entities that live inside the settings document rather than their own key. */
const SETTINGS_BACKED: SyncEntity[] = ['settings', 'readingProgress'];

const REVISION_PREFIX = 'sync_revision:';

export const ALL_ENTITIES: SyncEntity[] = [
  'bookmarks', 'notes', 'highlights', 'readingProgress', 'favoriteDuas',
  'asmaFavorites', 'nameFavorites', 'fastingDays', 'salahRecords',
  'tasbeehHistory', 'aiConversations', 'aiMessages', 'settings', 'lastRead',
];

/* ─────────────────────────── helpers ─────────────────────────── */

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Monotonic per-entity clock. `Date.now()` is fine as a base, but two writes in
 * the same millisecond would tie, so we always stay at least one ahead of the
 * last revision this device used.
 */
export async function nextRevision(entity: SyncEntity): Promise<number> {
  const key = `${REVISION_PREFIX}${entity}`;
  const stored = Number((await AsyncStorage.getItem(key)) ?? 0) || 0;
  const revision = Math.max(Date.now(), stored + 1);
  await AsyncStorage.setItem(key, String(revision));
  return revision;
}

/**
 * Stable fingerprint of a value, used to decide whether an entity actually
 * changed since the last sync.
 *
 * This is what makes the protocol *last-edit-wins* rather than
 * *last-device-to-push-wins*: a device holding unchanged old data pushes
 * nothing, so it cannot overwrite a newer edit made elsewhere just because its
 * clock is further ahead. FNV-1a is enough — a collision here would at worst
 * skip one push, and the next local edit re-sends it.
 */
function fingerprint(value: unknown): string {
  const text = JSON.stringify(value ?? null);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${text.length}:${hash.toString(16)}`;
}

const SNAPSHOT_PREFIX = 'sync_snapshot:';

async function readSnapshot(entity: SyncEntity): Promise<string | null> {
  try { return await AsyncStorage.getItem(`${SNAPSHOT_PREFIX}${entity}`); } catch { return null; }
}

async function writeSnapshot(entity: SyncEntity, value: unknown): Promise<void> {
  try { await AsyncStorage.setItem(`${SNAPSHOT_PREFIX}${entity}`, fingerprint(value)); } catch { /* ignore */ }
}

async function noteRevision(entity: SyncEntity, revision: number): Promise<void> {
  const key = `${REVISION_PREFIX}${entity}`;
  const stored = Number((await AsyncStorage.getItem(key)) ?? 0) || 0;
  if (revision > stored) await AsyncStorage.setItem(key, String(revision));
}

/** Removes duplicates by `id`, preferring the incoming item on a clash. */
function mergeById(local: unknown[], remote: unknown[]): unknown[] {
  const seen = new Map<string, unknown>();
  const keyOf = (value: unknown, index: number) => {
    const id = (value as { id?: unknown } | null)?.id;
    return typeof id === 'string' || typeof id === 'number' ? String(id) : `#${index}`;
  };
  local.forEach((item, i) => seen.set(keyOf(item, i), item));
  remote.forEach((item, i) => seen.set(keyOf(item, i), item));
  return [...seen.values()];
}

/* ─────────────────────────── status ─────────────────────────── */

export type SyncPhase = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  /** Human-readable detail for the profile screen. */
  message: string | null;
  lastSyncedAt: string | null;
  /** Entities that the last sync pushed, for a "what changed" summary. */
  lastApplied: SyncEntity[];
}

export const IDLE_STATUS: SyncStatus = {
  phase: 'idle', message: null, lastSyncedAt: null, lastApplied: [],
};

const STATUS_KEY = 'sync_status';

export async function loadStatus(): Promise<SyncStatus> {
  const stored = await readJson<SyncStatus>(STATUS_KEY);
  return stored ? { ...IDLE_STATUS, ...stored, phase: stored.phase === 'syncing' ? 'idle' : stored.phase } : IDLE_STATUS;
}

async function saveStatus(status: SyncStatus): Promise<SyncStatus> {
  try { await AsyncStorage.setItem(STATUS_KEY, JSON.stringify(status)); } catch { /* ignore */ }
  return status;
}

/* ─────────────────────────── local snapshot ─────────────────────────── */

export interface LocalSnapshot {
  settings: Record<string, unknown> | null;
  values: Partial<Record<SyncEntity, unknown>>;
}

/**
 * Reads what this device currently holds. `readingProgress` and `lastRead` are
 * extracted from their containers so each can carry its own revision.
 */
export async function readLocalSnapshot(): Promise<LocalSnapshot> {
  const [settingsDoc, keys] = await Promise.all([
    readJson<Record<string, unknown>>('app_settings_v2'),
    AsyncStorage.multiGet(
      ALL_ENTITIES
        .filter(entity => !SETTINGS_BACKED.includes(entity) && entity !== 'lastRead')
        .map(entity => STORAGE_KEY[entity]),
    ),
  ]);

  const byKey = new Map(keys.map(([key, value]) => [key, value]));
  const values: Partial<Record<SyncEntity, unknown>> = {};

  for (const entity of ALL_ENTITIES) {
    if (SETTINGS_BACKED.includes(entity) || entity === 'lastRead') continue;
    const raw = byKey.get(STORAGE_KEY[entity]);
    if (!raw) continue;
    try { values[entity] = JSON.parse(raw); } catch { /* skip corrupt entry */ }
  }

  if (settingsDoc) values.settings = settingsDoc;
  if (settingsDoc && settingsDoc.readingProgress) {
    values.readingProgress = settingsDoc.readingProgress;
  }

  const lastRead = await readJson<unknown>('last_read');
  if (lastRead) values.lastRead = lastRead;

  return { settings: settingsDoc ?? null, values };
}

/* ─────────────────────────── write remote state locally ─────────────────────────── */

/**
 * Applies server state to local storage.
 *
 * `merge` mode is used the first time a device links to an account: existing
 * local collections are unioned with the server's so nothing the user created
 * before signing in is lost. Afterwards the server is authoritative.
 */
export async function applyRemote(
  entities: EntityMap,
  mode: 'merge' | 'replace',
  /**
   * Entities known to hold local edits the server should receive. They are left
   * untouched so the push that follows can send them. Defaults to none, which
   * makes the server authoritative for everything.
   */
  keepLocal: SyncEntity[] = [],
  /** Entities to union with the local list rather than replace outright. */
  mergeEntities: SyncEntity[] = [],
): Promise<SyncEntity[]> {
  const changed: SyncEntity[] = [];
  const writes: [string, string][] = [];
  let settingsDoc: Record<string, unknown> | null = null;

  // Read settings once: two entities (settings, readingProgress) share the doc.
  if (entities.settings || entities.readingProgress) {
    settingsDoc = await readJson<Record<string, unknown>>('app_settings_v2');
  }

  for (const entity of ALL_ENTITIES) {
    const state = entities[entity];
    if (!state) continue;
    if (keepLocal.includes(entity)) continue;

    await noteRevision(entity, state.revision);

    if (entity === 'settings') {
      const remote = (state.data ?? {}) as Record<string, unknown>;
      if (mode === 'merge' || mergeEntities.includes('settings')) {
        // Local values win on the first link; the server fills in what is missing.
        settingsDoc = { ...remote, ...(settingsDoc ?? {}) };
      } else {
        settingsDoc = { ...(settingsDoc ?? {}), ...remote };
      }
      changed.push(entity);
      continue;
    }

    if (entity === 'readingProgress') {
      const remote = (state.data ?? {}) as Record<string, unknown>;
      settingsDoc = { ...(settingsDoc ?? {}), readingProgress: remote };
      changed.push(entity);
      continue;
    }

    if (entity === 'lastRead') {
      const data = (state.data ?? null) as { surahNumber?: unknown; ayahNumber?: unknown } | null;
      if (!data || typeof data.surahNumber !== 'number' || typeof data.ayahNumber !== 'number') continue;
      if (mode === 'merge' || mergeEntities.includes('lastRead')) {
        const local = await readJson<{ surahNumber?: number; ayahNumber?: number }>('last_read');
        const localAt = Number(local?.surahNumber ?? 0) * 1000 + Number(local?.ayahNumber ?? 0);
        const remoteAt = data.surahNumber * 1000 + data.ayahNumber;
        if (local && localAt >= remoteAt) continue; // reading further locally wins
      }
      writes.push(['last_read', JSON.stringify(data)]);
      changed.push(entity);
      continue;
    }

    // Remaining entities are arrays.
    const remote = Array.isArray(state.data) ? (state.data as unknown[]) : [];
    const shouldMerge = mode === 'merge' || mergeEntities.includes(entity);
    if (MERGE_BY_ID.includes(entity) && shouldMerge) {
      const local = (await readJson<unknown[]>(STORAGE_KEY[entity])) ?? [];
      const merged = mergeById(local, remote);
      writes.push([STORAGE_KEY[entity], JSON.stringify(merged)]);
    } else {
      writes.push([STORAGE_KEY[entity], JSON.stringify(remote)]);
    }
    changed.push(entity);
  }

  if (settingsDoc) writes.push(['app_settings_v2', JSON.stringify(settingsDoc)]);
  if (writes.length > 0) await AsyncStorage.multiSet(writes);

  return changed;
}

/* ─────────────────────────── the sync cycle ─────────────────────────── */

/**
 * Pushes everything this device holds, then applies what comes back.
 *
 * On the very first sync after linking an account the server may already hold
 * data from another device, so we merge instead of replacing. The caller passes
 * `mode: 'merge'` from the sign-in flow and leaves it as `'replace'` thereafter.
 */
export async function syncNow(options: { mode?: 'merge' | 'replace' } = {}): Promise<SyncStatus> {
  if (!isSyncConfigured) {
    return saveStatus({
      ...IDLE_STATUS,
      phase: 'offline',
      message: 'Sync is not configured for this build. Your data stays on this device.',
    });
  }

  const previous = await loadStatus();
  const mode = options.mode ?? 'replace';
  const deviceId = await getDeviceId();
  const clientUpdatedAt = new Date().toISOString();

  /* 1. Read the server first. Deciding what to send needs the server's side of
        the story: a device that has never synced has no fingerprints, so its
        data could be a genuine edit or a stale copy restored from a backup. */
  const pulled = await pullAll();
  if (!pulled.ok) {
    return saveStatus({
      phase: pulled.status === 0 ? 'offline' : 'error',
      message: pulled.message,
      lastSyncedAt: previous.lastSyncedAt,
      lastApplied: [],
    });
  }
  const remote = pulled.value.entities;

  /* 2. Classify each entity this device holds. */
  const before = await readLocalSnapshot();
  const toPush: SyncEntity[] = [];
  const firstContact: SyncEntity[] = [];

  for (const entity of ALL_ENTITIES) {
    const local = before.values[entity];
    if (local === undefined) continue;

    const fingerprintOfLocal = fingerprint(local);
    const lastSynced = await readSnapshot(entity);
    const remoteState = remote[entity];

    if (lastSynced === null && remoteState) {
      // We hold data but have never synced this entity, while the account
      // already has some: treat it as a merge-on-first-contact instead of an
      // edit, so restoring an old backup cannot stampede newer cloud data.
      firstContact.push(entity);
      continue;
    }

    if (lastSynced === fingerprintOfLocal) continue; // unchanged: nothing to send
    if (mode !== 'merge' && isUnchangedFromRemote(local, remoteState?.data)) {
      // Identical content, newer local clock — sending would be a pointless write.
      await writeSnapshot(entity, local);
      continue;
    }
    toPush.push(entity);
  }

  /* 3. Apply server state. Entities with a pending local edit are protected in
        replace mode (the push below settles them); first-contact entities are
        unioned so neither side loses anything. */
  const protectedEntities = mode === 'merge' ? [] : toPush;
  const mergeEntities = mode === 'merge'
    ? [...new Set([...firstContact, ...toPush])]
    : firstContact;
  await applyRemote(remote, mode, protectedEntities, mergeEntities);

  /* 4. Push only real local edits. */
  const payload: Record<string, { revision: number; deviceId: string; clientUpdatedAt: string; data: unknown }> = {};
  const afterMerge = await readLocalSnapshot();
  for (const entity of toPush) {
    const data = afterMerge.values[entity];
    if (data === undefined) continue;
    // A merge may have changed this collection, in which case the merged value
    // is what should be sent — it is the union the user actually sees.
    payload[entity] = {
      revision: await nextRevision(entity),
      deviceId,
      clientUpdatedAt,
      data,
    };
  }

  let applied: SyncEntity[] = [];
  if (Object.keys(payload).length > 0) {
    const pushed = await pushEntities(payload as never);
    if (!pushed.ok) {
      return saveStatus({
        phase: pushed.status === 0 ? 'offline' : 'error',
        message: pushed.message,
        lastSyncedAt: previous.lastSyncedAt,
        lastApplied: [],
      });
    }
    applied = pushed.value.applied;
    // Whatever the server rejected is newer there, so take its version.
    await applyRemote(pushed.value.entities, 'replace');
  }

  /* 5. Remember what is on disk now, so the next run only sends real edits. */
  const settled = await readLocalSnapshot();
  for (const entity of ALL_ENTITIES) {
    if (settled.values[entity] !== undefined) {
      await writeSnapshot(entity, settled.values[entity]);
    }
  }

  return saveStatus({
    phase: 'synced',
    message: null,
    lastSyncedAt: new Date().toISOString(),
    lastApplied: applied,
  });
}

/** Structural equality used to skip redundant pushes. */
function isUnchangedFromRemote(local: unknown, remoteData: unknown): boolean {
  if (remoteData === undefined) return false;
  return fingerprint(local) === fingerprint(remoteData);
}

/* ─────────────────────────── change tracking ─────────────────────────── */

/**
 * Called after any local mutation so the UI can show "unsynced changes" and the
 * app knows a sync is worthwhile. Deliberately cheap: it only clears a flag.
 */
export async function markLocalChange(): Promise<void> {
  try { await AsyncStorage.setItem('sync_dirty', '1'); } catch { /* ignore */ }
}

export async function hasLocalChanges(): Promise<boolean> {
  return (await AsyncStorage.getItem('sync_dirty')) === '1';
}

export async function clearLocalChanges(): Promise<void> {
  try { await AsyncStorage.removeItem('sync_dirty'); } catch { /* ignore */ }
}
