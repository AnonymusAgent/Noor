const ALADHAN_BASE = 'https://api.aladhan.com/v1';

export interface PrayerTimes {
  // AlAdhan returns a string per timing; the index signature keeps the object
  // usable as a plain string map (e.g. in component state).
  [key: string]: string;
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Sunset: string;
  Maghrib: string;
  Isha: string;
  Imsak: string;
  Midnight: string;
  Firstthird: string;
  Lastthird: string;
}

/**
 * AlAdhan sometimes appends a timezone label, e.g. `"05:00 (EST)"`.
 * Everything downstream expects a bare `HH:MM`, so normalise it here.
 */
export function sanitizeTime(time: string | undefined | null): string {
  if (!time) return '';
  const match = time.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '';
}

/** Converts `"HH:MM"` (optionally with a timezone suffix) to minutes after midnight. */
export function timeToMinutes(time: string | undefined | null): number | null {
  const clean = sanitizeTime(time);
  if (!clean) return null;
  const [hours, minutes] = clean.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export interface PrayerTimesData {
  timings: PrayerTimes;
  date: {
    readable: string;
    timestamp: string;
    gregorian: any;
    hijri: {
      date: string;
      format: string;
      day: string;
      weekday: { en: string; ar: string };
      month: { number: number; en: string; ar: string };
      year: string;
      designation: { abbreviated: string; expanded: string };
      holidays: string[];
    };
  };
  meta: {
    latitude: number;
    longitude: number;
    timezone: string;
    method: {
      id: number;
      name: string;
    };
  };
}

export async function fetchPrayerTimesByCoords(
  latitude: number,
  longitude: number,
  method: number = 3,
  school: number = 0
): Promise<PrayerTimesData> {
  const today = new Date();
  const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
  
  const response = await fetch(
    `${ALADHAN_BASE}/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${method}&school=${school}`
  );
  
  if (!response.ok) throw new Error('Failed to fetch prayer times');
  const data = await response.json();
  return normalizePrayerTimesData(data.data);
}

export async function fetchPrayerTimesByCity(
  city: string,
  country: string,
  method: number = 3,
  school: number = 0
): Promise<PrayerTimesData> {
  const today = new Date();
  const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
  
  const response = await fetch(
    `${ALADHAN_BASE}/timingsByCity/${dateStr}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}&school=${school}`
  );
  
  if (!response.ok) throw new Error('Failed to fetch prayer times');
  const data = await response.json();
  return normalizePrayerTimesData(data.data);
}

export async function fetchMonthlyPrayerTimes(
  latitude: number,
  longitude: number,
  year: number,
  month: number,
  method: number = 3
): Promise<PrayerTimesData[]> {
  const response = await fetch(
    `${ALADHAN_BASE}/calendar/${year}/${month}?latitude=${latitude}&longitude=${longitude}&method=${method}`
  );
  
  if (!response.ok) throw new Error('Failed to fetch monthly prayer times');
  const data = await response.json();
  return data.data || [];
}

/** Strips AlAdhan's timezone suffixes so timings are always `HH:MM`. */
function normalizePrayerTimesData(data: PrayerTimesData): PrayerTimesData {
  if (!data?.timings) return data;
  const timings = Object.fromEntries(
    Object.entries(data.timings).map(([key, value]) => [key, sanitizeTime(String(value))])
  ) as PrayerTimes;
  return { ...data, timings };
}

export async function fetchHijriDate(date?: Date): Promise<any> {
  const d = date || new Date();
  const dateStr = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
  const response = await fetch(`${ALADHAN_BASE}/gToH/${dateStr}`);
  if (!response.ok) throw new Error('Failed to fetch Hijri date');
  const data = await response.json();
  return data.data;
}

export function getNextPrayer(timings: PrayerTimes): { name: string; time: string; minutesLeft: number } | null {
  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTotalMinutes = currentHours * 60 + currentMinutes;

  for (const prayer of prayers) {
    const raw = timings[prayer];
    const prayerTotalMinutes = timeToMinutes(raw);
    if (prayerTotalMinutes === null) continue;

    if (prayerTotalMinutes > currentTotalMinutes) {
      return {
        name: prayer,
        time: sanitizeTime(raw),
        minutesLeft: prayerTotalMinutes - currentTotalMinutes,
      };
    }
  }

  // Next prayer is Fajr tomorrow
  const fajrMinutes = timeToMinutes(timings.Fajr);
  if (fajrMinutes === null) return null;
  const minutesLeft = (24 * 60 - currentTotalMinutes) + fajrMinutes;

  return { name: 'Fajr', time: sanitizeTime(timings.Fajr), minutesLeft };
}

export function formatPrayerTime(time: string | undefined | null): string {
  const clean = sanitizeTime(time);
  if (!clean) return '—';
  const [hours, minutes] = clean.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function calculateQiblaDirection(latitude: number, longitude: number): number {
  const kaabaLat = 21.4225;
  const kaabaLng = 39.8262;
  
  const lat1 = (latitude * Math.PI) / 180;
  const lat2 = (kaabaLat * Math.PI) / 180;
  const dLng = ((kaabaLng - longitude) * Math.PI) / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  bearing = (bearing + 360) % 360;
  
  return bearing;
}

export function calculateDistanceToKaaba(latitude: number, longitude: number): number {
  const kaabaLat = 21.4225;
  const kaabaLng = 39.8262;
  const R = 6371;
  
  const dLat = ((kaabaLat - latitude) * Math.PI) / 180;
  const dLon = ((kaabaLng - longitude) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((latitude * Math.PI) / 180) *
    Math.cos((kaabaLat * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
