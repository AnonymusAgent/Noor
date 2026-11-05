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

## Privacy

Bookmarks, notes, highlights, reading progress, streaks and chat history are stored on the
device only. Nothing is uploaded. Use **Profile → Export backup** to produce a portable JSON
file, and **Restore** to bring that data back on another device.

## Contributing

1. Fork this repository.
2. Create a feature branch.
3. Commit your changes and open a pull request.

## License

See the repository license for usage terms.
