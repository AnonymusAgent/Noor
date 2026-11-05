import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { collections, lastRead, syncState, userSettings } from '../db/schema/index.ts';
import { SYNC_ENTITIES } from './types.ts';
import type { PushRequest, SyncEntity, SyncEntityState, SyncEnvelope } from './types.ts';

/**
 * Sync semantics (deliberately simple and explainable):
 *
 * - Every entity is a whole-document last-writer-wins register.
 * - The winner is the higher `revision`; equal revisions are broken by the
 *   lexicographically greater `deviceId`, so both sides agree on the outcome.
 * - A push is never rejected wholesale: each entity is decided independently,
 *   and the response always contains authoritative state so the client can
 *   converge in a single round-trip.
 *
 * That means a stale device can never overwrite newer data, and two devices
 * that sync in either order end up byte-identical.
 */

/** Entities stored in the generic `collections` table. */
const COLLECTION_ENTITIES: SyncEntity[] = [
  'bookmarks',
  'notes',
  'highlights',
  'readingProgress',
  'favoriteDuas',
  'asmaFavorites',
  'nameFavorites',
  'fastingDays',
  'salahRecords',
  'tasbeehHistory',
  'aiConversations',
  'aiMessages',
];

function isCollection(entity: SyncEntity): boolean {
  return COLLECTION_ENTITIES.includes(entity);
}

/** True when the incoming write should win over what is stored. */
export function incomingWins(
  incoming: Pick<SyncEnvelope, 'revision' | 'deviceId'>,
  stored: Pick<SyncEntityState, 'revision' | 'deviceId'> | null,
): boolean {
  if (!stored) return true;
  if (incoming.revision > stored.revision) return true;
  if (incoming.revision < stored.revision) return false;
  // Same clock: deterministic tie-break so every device picks the same winner.
  return incoming.deviceId > (stored.deviceId ?? '');
}

async function readEntityState(
  userId: string,
  entity: SyncEntity,
): Promise<SyncEntityState | null> {
  const [state] = await db
    .select()
    .from(syncState)
    .where(and(eq(syncState.userId, userId), eq(syncState.entity, entity)))
    .limit(1);

  if (isCollection(entity)) {
    const [row] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.userId, userId), eq(collections.key, entity)))
      .limit(1);
    if (!row) return null;
    return {
      revision: state?.revision ?? 0,
      deviceId: state?.deviceId ?? null,
      updatedAt: (state?.updatedAt ?? row.updatedAt).toISOString(),
      data: row.items,
    };
  }

  if (entity === 'settings') {
    const [row] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    if (!row) return null;
    return {
      revision: state?.revision ?? 0,
      deviceId: state?.deviceId ?? null,
      updatedAt: (state?.updatedAt ?? row.updatedAt).toISOString(),
      data: row.settings,
    };
  }

  // lastRead
  const [row] = await db
    .select()
    .from(lastRead)
    .where(eq(lastRead.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    revision: state?.revision ?? 0,
    deviceId: state?.deviceId ?? null,
    updatedAt: (state?.updatedAt ?? row.updatedAt).toISOString(),
    data: { surahNumber: row.surahNumber, ayahNumber: row.ayahNumber },
  };
}

async function writeEntityState(
  userId: string,
  entity: SyncEntity,
  envelope: SyncEnvelope,
): Promise<void> {
  const now = new Date();

  if (isCollection(entity)) {
    const items = Array.isArray(envelope.data) ? envelope.data : [];
    await db
      .insert(collections)
      .values({ userId, key: entity, items, revision: envelope.revision, updatedAt: now })
      .onConflictDoUpdate({
        target: [collections.userId, collections.key],
        set: { items, revision: envelope.revision, updatedAt: now },
      });
  } else if (entity === 'settings') {
    const settings =
      envelope.data && typeof envelope.data === 'object' && !Array.isArray(envelope.data)
        ? (envelope.data as Record<string, unknown>)
        : {};
    await db
      .insert(userSettings)
      .values({ userId, settings, updatedAt: now })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { settings, updatedAt: now },
      });
  } else {
    const data = (envelope.data ?? {}) as { surahNumber?: number; ayahNumber?: number };
    const surahNumber = Number.isInteger(data.surahNumber) ? (data.surahNumber as number) : 1;
    const ayahNumber = Number.isInteger(data.ayahNumber) ? (data.ayahNumber as number) : 1;
    await db
      .insert(lastRead)
      .values({ userId, surahNumber, ayahNumber, updatedAt: now })
      .onConflictDoUpdate({
        target: lastRead.userId,
        set: { surahNumber, ayahNumber, updatedAt: now },
      });
  }

  await db
    .insert(syncState)
    .values({
      userId, entity, revision: envelope.revision,
      deviceId: envelope.deviceId, updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [syncState.userId, syncState.entity],
      set: { revision: envelope.revision, deviceId: envelope.deviceId, updatedAt: now },
    });
}

/** Returns every entity the user has stored (used for a fresh device). */
export async function pullAll(userId: string) {
  const entities: Partial<Record<SyncEntity, SyncEntityState>> = {};
  const states = await db.select().from(syncState).where(eq(syncState.userId, userId));
  const known = new Set(states.map(s => s.entity as SyncEntity));

  for (const entity of [...known, ...SYNC_ENTITIES]) {
    if (entities[entity] !== undefined) continue;
    const state = await readEntityState(userId, entity);
    if (state) entities[entity] = state;
  }

  return { entities, serverTime: new Date().toISOString() };
}

export async function pushEntities(userId: string, request: PushRequest) {
  const applied: SyncEntity[] = [];
  const rejected: SyncEntity[] = [];
  const entities: Partial<Record<SyncEntity, SyncEntityState>> = {};

  for (const entity of Object.keys(request.entities) as SyncEntity[]) {
    const envelope = request.entities[entity];
    if (!envelope) continue;

    const stored = await readEntityState(userId, entity);
    if (incomingWins(envelope, stored)) {
      await writeEntityState(userId, entity, envelope);
      applied.push(entity);
    } else {
      rejected.push(entity);
    }

    // Always report the authoritative post-write state.
    const after = await readEntityState(userId, entity);
    if (after) entities[entity] = after;
  }

  return { applied, rejected, entities, serverTime: new Date().toISOString() };
}
