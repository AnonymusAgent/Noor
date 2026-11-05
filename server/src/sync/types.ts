import { z } from 'zod';

/**
 * Entities the client may push.
 *
 * `collection` entities replace the whole list (last-writer-wins by revision);
 * `settings` and `lastRead` are single documents with the same rule. Keeping
 * the protocol this small means conflict behaviour is auditable.
 */
export const SYNC_ENTITIES = [
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
  'settings',
  'lastRead',
] as const;

export type SyncEntity = typeof SYNC_ENTITIES[number];

export const syncEnvelopeSchema = z.object({
  /**
   * Monotonic client clock (e.g. Date.now(), or an incrementing counter).
   * Higher wins when two devices race; the deviceId breaks exact ties.
   */
  revision: z.number().int().nonnegative(),
  deviceId: z.string().min(1).max(128),
  /** UTC ISO timestamp the client believes it wrote at (informational). */
  clientUpdatedAt: z.string().datetime().optional(),
  /** Collection payload, or a single object for settings/lastRead. */
  data: z.unknown(),
});

export type SyncEnvelope = z.infer<typeof syncEnvelopeSchema>;

// zod v3 has no `partialRecord`, so the entity map is spelled out. A compile-
// time check below keeps it in step with SYNC_ENTITIES.
const entitySchema = syncEnvelopeSchema.optional();

const entitiesShape = {
  bookmarks: entitySchema,
  notes: entitySchema,
  highlights: entitySchema,
  readingProgress: entitySchema,
  favoriteDuas: entitySchema,
  asmaFavorites: entitySchema,
  nameFavorites: entitySchema,
  fastingDays: entitySchema,
  salahRecords: entitySchema,
  tasbeehHistory: entitySchema,
  aiConversations: entitySchema,
  aiMessages: entitySchema,
  settings: entitySchema,
  lastRead: entitySchema,
} satisfies Record<SyncEntity, typeof entitySchema>;

export const pushSchema = z.object({
  entities: z.object(entitiesShape).partial().default({}),
});

export type PushRequest = z.infer<typeof pushSchema>;

export interface SyncEntityState {
  revision: number;
  deviceId: string | null;
  updatedAt: string;
  data: unknown;
}

export interface PullResponse {
  entities: Partial<Record<SyncEntity, SyncEntityState>>;
  serverTime: string;
}

export interface PushResponse {
  /** Entities the server accepted. */
  applied: SyncEntity[];
  /** Entities rejected because the stored revision was newer. */
  rejected: SyncEntity[];
  /** Authoritative state after the push (lets the client settle in one trip). */
  entities: Partial<Record<SyncEntity, SyncEntityState>>;
  serverTime: string;
}
