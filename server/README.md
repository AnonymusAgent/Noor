# Sync API (`@islamicguide/server`)

Optional backend for the IslamicGuide app: passwordless accounts plus
cross-device sync of bookmarks, notes, highlights, reading progress, settings,
fasting, salah, tasbeeh and AI chat history.

The app **works fully without this server**. Nothing here is required to read
the Quran, bookmark an ayah or use the app offline — this only adds a cloud copy
so several devices agree.

> **This package must never be imported by `app/`, `components/`, `contexts/`,
> `hooks/` or `services/`.** A `DATABASE_URL` shipped inside a mobile binary is a
> full-database compromise: anyone can extract it and read or delete every
> account. The client talks to this API over HTTPS and knows only a public base
> URL (`EXPO_PUBLIC_API_URL`).

## Run it locally

```bash
corepack pnpm install
cp ../.env.example ../server/.env   # then fill in DATABASE_URL
corepack pnpm --filter @islamicguide/server db:migrate
corepack pnpm --filter @islamicguide/server dev     # http://localhost:4000
```

Point the app at it:

```bash
# .env in the repository root
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000   # LAN address, not localhost:
```

`localhost` inside a phone or an emulator points at the device itself, so use
your machine's LAN IP (or a tunnel) while developing.

## Tests

```bash
corepack pnpm --filter @islamicguide/server test
```

The suite runs the real migration against [PGlite](https://pglite.dev)
(Postgres compiled to WASM) and drives the real Fastify routes through
`app.inject()`, so no database server is needed. It covers sign-in, code reuse,
token forgery, cross-user isolation, stale-write rejection, tie-breaks, and
malformed payloads.

## Endpoints

| Method | Path                  | Auth | Purpose                                        |
| ------ | --------------------- | ---- | ---------------------------------------------- |
| GET    | `/health`             | –    | Liveness probe.                                |
| POST   | `/auth/request-code`  | –    | Email a 6-digit sign-in code.                  |
| POST   | `/auth/verify`        | –    | Exchange the code for a bearer token.          |
| GET    | `/auth/me`            | ✓    | The signed-in account.                         |
| POST   | `/auth/logout`        | ✓    | Revoke this session's token.                   |
| GET    | `/sync`               | ✓    | Download every stored entity.                  |
| POST   | `/sync`               | ✓    | Upload entities; response contains the truth.  |
| DELETE | `/account`            | ✓    | Delete the account and all its rows.           |

## Security model

- **No passwords.** Sign-in is an emailed 6-digit code. Codes are stored
  hashed, single-use, expire in 10 minutes, and allow 5 attempts. Every failure
  returns the same message so the API cannot be used to discover which emails
  have accounts.
- **Session tokens are opaque** 256-bit random values. Only their SHA-256 hash
  is stored, so a database leak does not hand over usable sessions.
- **`userId` always comes from the token**, never from the request body, so a
  client cannot address another user's data.
- **CORS** is restricted to `PUBLIC_ORIGIN`. Set it explicitly in production;
  the default `*` is only for development.
- **Body limit** is 1 MB, which bounds the size of any single sync payload.

### Known gap

No mail provider is wired up yet. Until one is, `POST /auth/request-code`
returns the code in the response body when `RETURN_LOGIN_CODE_IN_RESPONSE=true`
**and** `NODE_ENV` is not `production`. Wire SMTP/Resend (or similar) into
`requestLoginCode` in `src/auth/index.ts` before deploying.

## Sync protocol

Deliberately small and auditable:

- Each entity is a **whole-document last-writer-wins register**. Pushing a
  collection sends the entire list; the server does not merge inside a list.
- Each push carries a **`revision`** (a client clock that only moves forward)
  and a **`deviceId`**. The higher revision wins; equal revisions are broken by
  the lexicographically greater `deviceId`, so every device computes the same
  winner regardless of arrival order.
- A push is **never rejected wholesale** — each entity is decided separately and
  the response always contains authoritative state, so one round-trip settles.
- A stale device therefore cannot overwrite newer data.

Entities: `bookmarks`, `notes`, `highlights`, `readingProgress`,
`favoriteDuas`, `asmaFavorites`, `nameFavorites`, `fastingDays`,
`salahRecords`, `tasbeehHistory`, `aiConversations`, `aiMessages`, `settings`,
`lastRead`.

`settings` is stored as opaque JSON so client-side shape changes can never fail
a sync. `lastRead` is its own single-row document.

**First link is a merge, not a replace.** When a device that already holds data
signs in, the client unions its collections by `id` with the server's, so
signing in never deletes what the user created before.

## Schema

Drizzle definitions live in `src/db/schema/`; migrations are generated into
`drizzle/`. Run `corepack pnpm --filter @islamicguide/server db:generate` after
editing a table.

| Table | Purpose |
| --- | --- |
| `users` | One row per account (email + optional display name). |
| `sessions` | Bearer tokens, stored hashed, with expiry and revocation. |
| `login_codes` | Pending sign-in codes, hashed, single-use. |
| `collections` | Whole-document JSON per user per entity (`user_id, key`). |
| `user_settings` | The opaque settings document. |
| `last_read` | Last-read pointer. |
| `sync_state` | Revision + deviceId per user per entity (the tie-break record). |
| `reading_progress`, `bookmarks`, `notes`, `highlights` | Relational reading tables. |
| `favorite_duas`, `asma_favorites`, `name_favorites`, `ai_conversations` | Content favourites. |
| `salah_records`, `fasting_days`, `tasbeeh_history` | Activity tracking. |

## Deploying

Any Node 20+ host that can reach Postgres works. Set `DATABASE_URL`,
`PUBLIC_ORIGIN`, and `NODE_ENV=production`, then run `db:migrate` as a release
step. Neon, Supabase and plain Postgres all work — the driver is
`@neondatabase/serverless`, which speaks standard Postgres wire protocol.
