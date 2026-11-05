/**
 * Date helpers.
 *
 * `Date#toISOString()` converts to UTC before formatting, so for anyone living
 * west of Greenwich (e.g. US timezones) it returns *yesterday's* date for most
 * of the evening. Anything that keys daily data (salah records, fasting log,
 * tasbeeh history, streaks…) must use the device's local calendar day instead.
 */

/** Local calendar day as `YYYY-MM-DD` (never shifts across timezones). */
export function toDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Local calendar day for "today minus `days`". */
export function dateKeyDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateKey(d);
}

/** Parses a `YYYY-MM-DD` key into a local-midnight Date (avoids UTC parsing). */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/** `YYYY-MM-DD` for the day after `key`. */
export function nextDateKey(key: string): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + 1);
  return toDateKey(d);
}

/** Minimal shape needed to read the user's dark-mode schedule. */
export interface DarkModeScheduleLike {
  enabled: boolean;
  mode: 'custom' | 'sunrise_sunset';
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

/**
 * True when the current local time falls inside the configured dark-mode
 * window. Handles windows that cross midnight (e.g. 21:00 → 06:00).
 *
 * For `sunrise_sunset` we fall back to approximate civil twilight hours because
 * an exact answer needs GPS + an astronomy calculation; this keeps the setting
 * functional until real sunrise/sunset data is available.
 */
export function isWithinDarkWindow(
  schedule: DarkModeScheduleLike,
  now: Date = new Date(),
): boolean {
  if (!schedule.enabled) return false;

  let start: number;
  let end: number;
  if (schedule.mode === 'sunrise_sunset') {
    start = 19 * 60; // ~sunset
    end = 6 * 60;    // ~sunrise
  } else {
    start = schedule.startHour * 60 + schedule.startMinute;
    end = schedule.endHour * 60 + schedule.endMinute;
  }

  if (start === end) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  if (start < end) return current >= start && current < end;
  // Window wraps past midnight.
  return current >= start || current < end;
}
