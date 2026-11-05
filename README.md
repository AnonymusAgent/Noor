# IslamicGuide

IslamicGuide is a **cross-platform Expo / React Native app** for Quran, Hadith, duas, prayer
tools and personal tracking. It is primarily a **mobile app** (iOS + Android), and also builds
to a **web app** from the same codebase. It is *not* a desktop application.

- **Mobile** — the primary target. Native builds via `expo run:*` / EAS Build, with device
  features that make the app what it is: GPS prayer times, the Qibla magnetometer compass,
  local notifications, background audio playback and haptics.
- **Web** — supported (`expo export --platform web`, static output). Sensor- and
  notification-dependent screens degrade gracefully (the Qibla screen explains that browsers
  have no compass and still shows the bearing).

## Features

| Area | What's included |
| --- | --- |
| Quran | All 114 surahs, translation, transliteration, word-by-word, tajweed colouring, tafsir (Ibn Kathir / Maarif-ul-Quran), 2–3-way translation comparison, super-surah audio with repeat modes, bookmarks, highlights and notes |
| Reading | Resume-where-you-stopped, surah/juz browsing, search across verses, Hifz memorisation tracker with streaks and goal setting |
| Hadith | 9 collections, offline bundle plus cached online pages, full-text search with keyword/narrator/grade filters |
| Duas | 20 categories of azkar and supplications, favourites list |
| Prayer | GPS + AlAdhan prayer times for 13+ calculation methods and both Asr madhabs, monthly timetable, next-prayer countdown, adhan reminders, Salah tracker with heatmap |
| Qibla | Tilt-compensated compass heading, distance to the Kaaba, accuracy guidance |
| Calendar | Hijri calendar with Islamic events, fasting tracker, Ramadan companion (suhoor/iftar, countdown) |
| Knowledge | 99 Names of Allah, Islamic baby names, Hajj & Umrah guide, prayer guide, AI Islamic guide |
| Tools | Zakat calculator, digital tasbeeh with daily history, mosque finder (OpenStreetMap/Overpass), global search |
| Personal | Local-first storage, manual backup export/restore, dark/light/system themes with a scheduled dark window, high-contrast mode, adjustable Arabic typography |

## Getting Started

### 1. Install Dependencies

```bash
corepack pnpm install
```

### 2. Start the Project

- Start the development server (choose your platform):

```bash
corepack pnpm start
corepack pnpm android
corepack pnpm ios
corepack pnpm web
```

### 3. Lint and Type-check

```bash
corepack pnpm lint
npx tsc --noEmit
```

## Main Dependencies

- React Native: 0.79.3
- React: 19.0.0
- Expo: ~53.0.12
- Expo Router: ~5.0.7
- Hadith: api.hadith.gading.dev with cached Arabic/English editions from the Fawaz Hadith API as fallback
- Other commonly used libraries:
  - @expo/vector-icons
  - React Navigation
  - AsyncStorage
  - Expo Location, Notifications, Sensors, and FileSystem

For a full list of dependencies, see [package.json](./package.json).

## Cloud Sync (optional)

The app is **local-first**: every feature works with no account and no network.
Bookmarks, notes, highlights, reading progress, streaks and chat history are
written to the device first and always remain readable offline.

On top of that there is an optional backend in [`server/`](./server/README.md)
that keeps a copy in the cloud so several devices agree:

- **No passwords.** Sign in with a 6-digit code emailed to you (or, in
  development, shown on screen).
- **Nothing is uploaded until you sign in.** Without `EXPO_PUBLIC_API_URL` the
  app never makes a network call for your data.
- **Signing in merges, never wipes.** Existing local bookmarks and notes are
  combined with what is already in the cloud.
- **Offline is a normal state.** A failed sync shows "saved on this device, will
  sync later" and retries the next time the app is opened.

Enable it by starting the server and setting `EXPO_PUBLIC_API_URL`:

```bash
cp .env.example .env      # then set EXPO_PUBLIC_API_URL
corepack pnpm server:dev  # starts server/ on :4000
```

See [`server/README.md`](./server/README.md) for the API, the sync protocol and
deployment notes.

### Manual export

Prefer files to accounts? **Profile → Export backup** produces a portable JSON
file and **Restore** brings that data back on another device. This works with or
without cloud sync.

## Privacy

Your data stays on your device unless you turn on cloud sync. When sync is on,
the server stores the collections you see in Profile (bookmarks, notes,
highlights, progress, settings, activity and chat history) so your devices agree;
it does not store anything else and never sees your reading as analytics. You can
delete the account and all its data from the server at any time — local data is
untouched. Use **Profile → Export backup** for a portable copy.

## Contributing

1. Fork this repository.
2. Create a feature branch.
3. Commit your changes and open a pull request.

## License

See the repository license for usage terms.
