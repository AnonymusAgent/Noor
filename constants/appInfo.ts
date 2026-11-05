/**
 * App identity in one place.
 *
 * The version string used to be hardcoded separately in `more.tsx` (v2.0.0)
 * and `settings.tsx` (2.1.0), so the two screens contradicted each other.
 */

export const APP_NAME = 'IslamicGuide';

/** Keep in sync with `app.json` → `expo.version`. */
export const APP_VERSION = '2.1.0';

export const APP_TAGLINE = 'Quran, Hadith & prayer companion';

export const APP_DESCRIPTION =
  'Complete Quran with translations and tafsir, 9 Hadith collections, duas and azkar, ' +
  'AI Islamic guide, GPS prayer times, Qibla compass, 99 Names of Allah, Ramadan and Hajj ' +
  'guides, zakat calculator and more — all stored on your device.';
