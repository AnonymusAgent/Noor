import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { parseDateKey, toDateKey } from '../lib/date';

// Islamic events per Hijri month
const ISLAMIC_EVENTS: Record<number, { day: number; name: string; type: 'major' | 'minor' | 'fasting' | 'special' }[]> = {
  1: [ // Muharram
    { day: 1, name: 'Islamic New Year', type: 'major' },
    { day: 10, name: "Ashura Fast (Recommended)", type: 'fasting' },
  ],
  2: [ // Safar
    { day: 29, name: 'End of Safar', type: 'minor' },
  ],
  3: [ // Rabi al-Awwal
    { day: 12, name: 'Mawlid an-Nabi ﷺ', type: 'major' },
  ],
  4: [ // Rabi al-Thani
    { day: 1, name: 'Rabi al-Thani Begins', type: 'minor' },
  ],
  5: [ // Jumada al-Awwal
    { day: 1, name: 'Jumada al-Awwal Begins', type: 'minor' },
  ],
  6: [ // Jumada al-Akhirah
    { day: 1, name: 'Jumada al-Akhirah Begins', type: 'minor' },
  ],
  7: [ // Rajab
    { day: 1, name: 'Rajab Begins (Sacred Month)', type: 'special' },
    { day: 27, name: 'Isra Wal Mi\'raj ﷺ', type: 'major' },
  ],
  8: [ // Shaban
    { day: 1, name: 'Shaban Begins', type: 'minor' },
    { day: 15, name: 'Laylat al-Bara\'ah (15th Shaban)', type: 'special' },
  ],
  9: [ // Ramadan
    { day: 1, name: 'First Day of Ramadan', type: 'major' },
    { day: 15, name: 'Mid Ramadan', type: 'fasting' },
    { day: 21, name: 'Last 10 Nights Begin', type: 'special' },
    { day: 27, name: 'Laylat al-Qadr (likely)', type: 'major' },
  ],
  10: [ // Shawwal
    { day: 1, name: 'Eid ul-Fitr 🎉', type: 'major' },
    { day: 2, name: 'Shawwal Fasts Begin (6 days)', type: 'fasting' },
    { day: 7, name: 'Last Shawwal Fast', type: 'fasting' },
  ],
  11: [ // Dhul Qidah
    { day: 1, name: 'Dhul Qidah (Sacred Month)', type: 'special' },
  ],
  12: [ // Dhul Hijjah
    { day: 1, name: 'Dhul Hijjah Begins (Sacred Month)', type: 'special' },
    { day: 8, name: 'Day of Tarwiyah (Hajj begins)', type: 'major' },
    { day: 9, name: 'Day of Arafah (Fast Highly Recommended)', type: 'major' },
    { day: 10, name: 'Eid ul-Adha 🐑', type: 'major' },
    { day: 11, name: 'Ayyam al-Tashreeq (1st)', type: 'special' },
    { day: 12, name: 'Ayyam al-Tashreeq (2nd)', type: 'special' },
    { day: 13, name: 'Ayyam al-Tashreeq (3rd)', type: 'special' },
  ],
};

const HIJRI_MONTH_NAMES = [
  'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
  'Jumada al-Awwal', 'Jumada al-Akhirah', 'Rajab', 'Shaban',
  'Ramadan', 'Shawwal', 'Dhul Qidah', 'Dhul Hijjah',
];

const HIJRI_MONTH_ARABIC = [
  'مُحَرَّم', 'صَفَر', 'رَبِيع الأَوَّل', 'رَبِيع الثَّانِي',
  'جُمَادَى الأُولَى', 'جُمَادَى الآخِرَة', 'رَجَب', 'شَعْبَان',
  'رَمَضَان', 'شَوَّال', 'ذُو القَعْدَة', 'ذُو الحِجَّة',
];

const SACRED_MONTHS = [1, 7, 11, 12];

interface HijriDate {
  day: number;
  month: number;
  year: number;
  monthName: string;
  weekday: string;
}

interface CalendarDay {
  gregorian: Date;
  hijri: HijriDate | null;
  isToday: boolean;
  isCurrentMonth: boolean;
  events: { name: string; type: string }[];
  isFasted: boolean;
}

const DAILY_VERSES = [
  { arabic: 'وَبَشِّرِ الصَّابِرِينَ', translation: 'And give good tidings to the patient.', ref: '2:155' },
  { arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', translation: 'Indeed, with hardship comes ease.', ref: '94:6' },
  { arabic: 'وَاللَّهُ خَيْرُ الرَّازِقِينَ', translation: 'And Allah is the best of providers.', ref: '62:11' },
  { arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً', translation: 'Our Lord, give us good in this world.', ref: '2:201' },
  { arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', translation: 'Allah is sufficient for us and He is the best disposer of affairs.', ref: '3:173' },
  { arabic: 'وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ', translation: 'Do not despair of the mercy of Allah.', ref: '12:87' },
  { arabic: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', translation: 'Indeed, Allah is with the patient.', ref: '2:153' },
];

async function getHijriDate(date: Date): Promise<HijriDate | null> {
  try {
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    const response = await fetch(`https://api.aladhan.com/v1/gToH/${d}-${m}-${y}`);
    const data = await response.json();
    if (data.data?.hijri) {
      const h = data.data.hijri;
      return {
        day: parseInt(h.day),
        month: parseInt(h.month.number),
        year: parseInt(h.year),
        monthName: h.month.en,
        weekday: h.weekday.en,
      };
    }
  } catch { /* fail silently */ }
  return null;
}

export default function HijriCalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, fastingDays, toggleFastingDay } = useApp();

  // Stable key for "today" so the memoised calendar does not rebuild on every
  // render (a fresh Date object changes identity each time).
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const today = useMemo(() => parseDateKey(todayKey), [todayKey]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [hijriToday, setHijriToday] = useState<HijriDate | null>(null);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'events' | 'fasting'>('calendar');

  const todayVerse = DAILY_VERSES[parseDateKey(todayKey).getDate() % DAILY_VERSES.length];

  const buildCalendar = useCallback(async () => {
    setLoading(true);
    try {
      // Get hijri for today
      const todayHijri = await getHijriDate(parseDateKey(todayKey));
      setHijriToday(todayHijri);

      // Build month grid
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      // Start grid from Sunday of the week containing the 1st
      const startDay = new Date(firstDay);
      startDay.setDate(startDay.getDate() - startDay.getDay());

      const days: CalendarDay[] = [];
      const curr = new Date(startDay);

      // Get hijri for first of month to estimate rest
      const firstHijri = await getHijriDate(firstDay);

      while (curr <= lastDay || days.length % 7 !== 0) {
        const dayDate = new Date(curr);
          const isToday = curr.toDateString() === parseDateKey(todayKey).toDateString();
        const isCurrentMonth = curr.getMonth() === month;
        const dateStr = toDateKey(curr);

        // Approximate hijri for this day using offset from firstDay
        let hijri: HijriDate | null = null;
        if (firstHijri) {
          const dayOffset = Math.round((curr.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24));
          const hijriDay = firstHijri.day + dayOffset;
          let hijriMonth = firstHijri.month;
          let hijriYear = firstHijri.year;
          let hDay = hijriDay;
          // Approximate month length as 30 days
          while (hDay > 30) {
            hDay -= 30;
            hijriMonth++;
            if (hijriMonth > 12) { hijriMonth = 1; hijriYear++; }
          }
          while (hDay < 1) {
            hijriMonth--;
            if (hijriMonth < 1) { hijriMonth = 12; hijriYear--; }
            hDay += 30;
          }
          hijri = { day: hDay, month: hijriMonth, year: hijriYear, monthName: HIJRI_MONTH_NAMES[hijriMonth - 1], weekday: '' };
        }

        const monthEvents = hijri ? (ISLAMIC_EVENTS[hijri.month] || []) : [];
        const dayEvents = monthEvents.filter(e => e.day === (hijri?.day || 0));
        const isFasted = fastingDays.find(d => d.date === dateStr)?.fasted || false;

        days.push({
          gregorian: dayDate,
          hijri,
          isToday,
          isCurrentMonth,
          events: dayEvents,
          isFasted,
        });

        curr.setDate(curr.getDate() + 1);
        if (days.length >= 42) break;
      }

      setCalendarDays(days);
    } catch {
      // Build basic calendar without hijri
    } finally {
      setLoading(false);
    }
  }, [currentMonth, fastingDays, todayKey]);

  useEffect(() => {
    buildCalendar();
  }, [buildCalendar]);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const currentMonthHijri = calendarDays.find(d => d.isCurrentMonth && d.hijri)?.hijri;
  const isSacredMonth = currentMonthHijri ? SACRED_MONTHS.includes(currentMonthHijri.month) : false;

  const fastedCount = fastingDays.filter(d => d.fasted).length;

  const getEventColor = (type: string) => {
    switch (type) {
      case 'major': return C.gold;
      case 'fasting': return C.info;
      case 'special': return C.success;
      default: return C.textMuted;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Hijri Calendar</Text>
          {hijriToday && (
            <Text style={[styles.hijriToday, { color: C.gold }]}>
              {hijriToday.day} {hijriToday.monthName} {hijriToday.year} AH
            </Text>
          )}
          <Text style={[styles.gregorianToday, { color: C.textSecondary }]}>
            {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>
      </LinearGradient>

      {/* Daily Verse */}
      <View style={[styles.verseCard, { backgroundColor: C.card, borderColor: `${C.gold}30` }]}>
        <Text style={[styles.verseLabel, { color: C.gold }]}>📖 Verse of the Day</Text>
        <Text style={[styles.verseArabic, { color: C.textArabic }]}>{todayVerse.arabic}</Text>
        <Text style={[styles.verseTranslation, { color: C.textSecondary }]}>{todayVerse.translation}</Text>
        <Text style={[styles.verseRef, { color: C.textMuted }]}>Quran {todayVerse.ref}</Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: C.cardBorder }]}>
        {(['calendar', 'events', 'fasting'] as const).map(t => (
          <Pressable key={t} style={[styles.tab, activeTab === t && styles.tabActive, activeTab === t && { borderBottomColor: C.gold }]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, { color: activeTab === t ? C.gold : C.textMuted }, activeTab === t && styles.tabTextActive]}>
              {t === 'calendar' ? '📅 Calendar' : t === 'events' ? '🌙 Events' : '🌙 Fasting'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === 'calendar' && (
          <>
            {/* Month Navigation */}
            <View style={[styles.monthNav, { borderBottomColor: C.cardBorder }]}>
              <Pressable onPress={prevMonth} style={styles.navBtn}>
                <MaterialIcons name="chevron-left" size={28} color={C.gold} />
              </Pressable>
              <View style={styles.monthInfo}>
                <Text style={[styles.monthName, { color: C.textPrimary }]}>
                  {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </Text>
                {currentMonthHijri && (
                  <Text style={[styles.hijriMonthName, { color: C.gold }]}>
                    {HIJRI_MONTH_ARABIC[currentMonthHijri.month - 1]} {currentMonthHijri.year}
                  </Text>
                )}
                {isSacredMonth && (
                  <View style={[styles.sacredBadge, { backgroundColor: `${C.gold}20`, borderColor: `${C.gold}40` }]}>
                    <Text style={[styles.sacredText, { color: C.gold }]}>Sacred Month</Text>
                  </View>
                )}
              </View>
              <Pressable onPress={nextMonth} style={styles.navBtn}>
                <MaterialIcons name="chevron-right" size={28} color={C.gold} />
              </Pressable>
            </View>

            {/* Weekday Headers */}
            <View style={styles.weekdays}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <Text key={d} style={[styles.weekdayText, { color: d === 'Fri' ? C.gold : C.textMuted }]}>{d}</Text>
              ))}
            </View>

            {/* Calendar Grid */}
            {loading ? (
              <View style={styles.loadingArea}>
                <ActivityIndicator color={C.gold} />
              </View>
            ) : (
              <View style={styles.grid}>
                {calendarDays.map((day, i) => (
                  <Pressable
                    key={i}
                    style={[
                      styles.dayCell,
                      !day.isCurrentMonth && styles.dayCellOtherMonth,
                      day.isToday && [styles.dayCellToday, { backgroundColor: C.gold }],
                      selectedDay?.gregorian.toDateString() === day.gregorian.toDateString() && [styles.dayCellSelected, { borderColor: C.gold }],
                    ]}
                    onPress={() => setSelectedDay(day)}
                  >
                    <Text style={[
                      styles.dayNum,
                      { color: day.isToday ? C.primaryDark : day.isCurrentMonth ? C.textPrimary : C.textMuted },
                    ]}>
                      {day.gregorian.getDate()}
                    </Text>
                    {day.hijri && (
                      <Text style={[styles.hijriNum, { color: day.isToday ? C.primaryDark : C.textMuted }]}>
                        {day.hijri.day}
                      </Text>
                    )}
                    {day.events.length > 0 && (
                      <View style={[styles.eventDot, { backgroundColor: getEventColor(day.events[0].type) }]} />
                    )}
                    {day.isFasted && (
                      <View style={[styles.fastDot, { backgroundColor: C.info }]} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            {/* Selected Day Info */}
            {selectedDay && (
              <View style={[styles.selectedInfo, { backgroundColor: C.card, borderColor: `${C.gold}30` }]}>
                <View style={styles.selectedHeader}>
                  <View>
                    <Text style={[styles.selectedDate, { color: C.textPrimary }]}>
                      {selectedDay.gregorian.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </Text>
                    {selectedDay.hijri && (
                      <Text style={[styles.selectedHijri, { color: C.gold }]}>
                        {selectedDay.hijri.day} {selectedDay.hijri.monthName} {selectedDay.hijri.year} AH
                      </Text>
                    )}
                  </View>
                  <Pressable
                    style={[styles.fastBtn, { borderColor: selectedDay.isFasted ? C.info : C.cardBorder, backgroundColor: selectedDay.isFasted ? `${C.info}20` : 'transparent' }]}
                    onPress={() => toggleFastingDay(toDateKey(selectedDay.gregorian))}
                  >
                    <MaterialIcons name={selectedDay.isFasted ? 'check-circle' : 'radio-button-unchecked'} size={20} color={selectedDay.isFasted ? C.info : C.textMuted} />
                    <Text style={[styles.fastBtnText, { color: selectedDay.isFasted ? C.info : C.textMuted }]}>
                      {selectedDay.isFasted ? 'Fasted' : 'Log Fast'}
                    </Text>
                  </Pressable>
                </View>
                {selectedDay.events.length > 0 && (
                  <View style={styles.eventList}>
                    {selectedDay.events.map((e, idx) => (
                      <View key={idx} style={[styles.eventItem, { backgroundColor: `${getEventColor(e.type)}15` }]}>
                        <View style={[styles.eventItemDot, { backgroundColor: getEventColor(e.type) }]} />
                        <Text style={[styles.eventName, { color: C.textPrimary }]}>{e.name}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {activeTab === 'events' && (
          <View style={styles.eventsSection}>
            {Object.entries(ISLAMIC_EVENTS).map(([month, events]) => (
              <View key={month} style={[styles.eventMonth, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <View style={styles.eventMonthHeader}>
                  <Text style={[styles.eventMonthArabic, { color: C.gold }]}>{HIJRI_MONTH_ARABIC[parseInt(month) - 1]}</Text>
                  <Text style={[styles.eventMonthName, { color: C.textPrimary }]}>{HIJRI_MONTH_NAMES[parseInt(month) - 1]}</Text>
                  {SACRED_MONTHS.includes(parseInt(month)) && (
                    <View style={[styles.sacredBadge, { backgroundColor: `${C.gold}20`, borderColor: `${C.gold}40` }]}>
                      <Text style={[styles.sacredText, { color: C.gold }]}>Sacred</Text>
                    </View>
                  )}
                </View>
                {events.map((e, i) => (
                  <View key={i} style={[styles.eventRow, { borderTopColor: C.cardBorder }]}>
                    <View style={[styles.eventDayBadge, { backgroundColor: `${getEventColor(e.type)}20` }]}>
                      <Text style={[styles.eventDayText, { color: getEventColor(e.type) }]}>{e.day}</Text>
                    </View>
                    <Text style={[styles.eventRowName, { color: C.textPrimary }]}>{e.name}</Text>
                    <View style={[styles.eventTypeBadge, { backgroundColor: `${getEventColor(e.type)}15` }]}>
                      <Text style={[styles.eventTypeText, { color: getEventColor(e.type) }]}>{e.type}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'fasting' && (
          <View style={styles.fastingSection}>
            {/* Stats */}
            <View style={[styles.fastStats, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <View style={styles.fastStat}>
                <Text style={[styles.fastStatNum, { color: C.gold }]}>{fastedCount}</Text>
                <Text style={[styles.fastStatLabel, { color: C.textMuted }]}>Total Fasts</Text>
              </View>
              <View style={[styles.fastStatDivider, { backgroundColor: C.cardBorder }]} />
              <View style={styles.fastStat}>
                <Text style={[styles.fastStatNum, { color: C.info }]}>
                  {fastingDays.filter(d => d.fasted && d.date.startsWith(new Date().getFullYear().toString())).length}
                </Text>
                <Text style={[styles.fastStatLabel, { color: C.textMuted }]}>This Year</Text>
              </View>
              <View style={[styles.fastStatDivider, { backgroundColor: C.cardBorder }]} />
              <View style={styles.fastStat}>
                <Text style={[styles.fastStatNum, { color: C.success }]}>
                  {fastingDays.filter(d => d.fasted && d.date >= toDateKey(new Date(new Date().setDate(1)))).length}
                </Text>
                <Text style={[styles.fastStatLabel, { color: C.textMuted }]}>This Month</Text>
              </View>
            </View>

            {/* Fasting Info Cards */}
            {[
              { title: 'Ramadan Fasting (Fard)', arabic: 'صَوْمُ رَمَضَان', desc: 'Obligatory fasting for the entire month of Ramadan. One of the Five Pillars of Islam.', ref: 'Quran 2:183, Sahih al-Bukhari 1791' },
              { title: 'Day of Arafah (9 Dhul Hijjah)', arabic: 'صَوْمُ يَوْمِ عَرَفَة', desc: 'Highly recommended Sunnah fast. Expiation of sins for the past and coming year.', ref: 'Sahih Muslim 1162' },
              { title: 'Day of Ashura (10 Muharram)', arabic: 'صَوْمُ عَاشُورَاء', desc: 'Recommended fast. Expiation of sins of the past year. Combine with 9th or 11th Muharram.', ref: 'Sahih Muslim 1162' },
              { title: 'Six Days of Shawwal', arabic: 'صَوْمُ سِتَّةٍ مِنْ شَوَّال', desc: 'Equivalent in reward to fasting the whole year if combined with Ramadan fasting.', ref: 'Sahih Muslim 1164' },
              { title: 'Monday & Thursday', arabic: 'صَوْمُ الإثْنَيْن وَالخَمِيس', desc: 'The Prophet ﷺ would fast on these days. Deeds are presented to Allah on these days.', ref: 'Tirmidhi 747' },
              { title: 'The White Days (13, 14, 15)', arabic: 'صَوْمُ أَيَّامِ البِيض', desc: 'Three middle days of each Hijri month. Equivalent to fasting all the time.', ref: 'Abu Dawood 2449' },
            ].map((card, i) => (
              <View key={i} style={[styles.fastCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Text style={[styles.fastCardTitle, { color: C.textPrimary }]}>{card.title}</Text>
                <Text style={[styles.fastCardArabic, { color: C.gold }]}>{card.arabic}</Text>
                <Text style={[styles.fastCardDesc, { color: C.textSecondary }]}>{card.desc}</Text>
                <View style={[styles.fastCardRef, { backgroundColor: `${C.success}10`, borderColor: `${C.success}20` }]}>
                  <MaterialIcons name="verified" size={12} color={C.success} />
                  <Text style={[styles.fastCardRefText, { color: C.textMuted }]}>{card.ref}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  hijriToday: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  gregorianToday: { fontSize: 12, marginTop: 2 },
  verseCard: {
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  verseLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  verseArabic: { fontSize: 22, textAlign: 'right', lineHeight: 38, marginBottom: 6 },
  verseTranslation: { fontSize: 14, fontStyle: 'italic', lineHeight: 22 },
  verseRef: { fontSize: 11, marginTop: 4, fontWeight: '500' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: {},
  tabText: { fontSize: 13, fontWeight: '500' },
  tabTextActive: { fontWeight: '700' },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthInfo: { flex: 1, alignItems: 'center' },
  monthName: { fontSize: 18, fontWeight: '700' },
  hijriMonthName: { fontSize: 18, fontWeight: '400', marginTop: 2 },
  sacredBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  sacredText: { fontSize: 10, fontWeight: '700' },
  weekdays: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  weekdayText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  loadingArea: { height: 280, alignItems: 'center', justifyContent: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.sm,
  },
  dayCell: {
    width: '14.28%',
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    borderRadius: Radius.sm,
    position: 'relative',
  },
  dayCellOtherMonth: { opacity: 0.3 },
  dayCellToday: { borderRadius: Radius.md },
  dayCellSelected: { borderWidth: 1.5, borderRadius: Radius.md },
  dayNum: { fontSize: 15, fontWeight: '600' },
  hijriNum: { fontSize: 9, marginTop: 1 },
  eventDot: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  fastDot: {
    position: 'absolute',
    bottom: 6,
    right: 10,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  selectedInfo: {
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  selectedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  selectedDate: { fontSize: 16, fontWeight: '700' },
  selectedHijri: { fontSize: 14, marginTop: 2 },
  fastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.round,
    borderWidth: 1.5,
  },
  fastBtnText: { fontSize: 12, fontWeight: '600' },
  eventList: { marginTop: Spacing.sm, gap: 6 },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  eventItemDot: { width: 8, height: 8, borderRadius: 4 },
  eventName: { fontSize: 13, fontWeight: '500', flex: 1 },
  eventsSection: { padding: Spacing.md, gap: 12 },
  eventMonth: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  eventMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
  },
  eventMonthArabic: { fontSize: 18 },
  eventMonthName: { fontSize: 16, fontWeight: '700', flex: 1 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  eventDayBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDayText: { fontSize: 14, fontWeight: '700' },
  eventRowName: { flex: 1, fontSize: 14, fontWeight: '500' },
  eventTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  eventTypeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  fastingSection: { padding: Spacing.md, gap: 12 },
  fastStats: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: 4,
  },
  fastStat: { flex: 1, alignItems: 'center' },
  fastStatNum: { fontSize: 28, fontWeight: '700' },
  fastStatLabel: { fontSize: 11, marginTop: 2 },
  fastStatDivider: { width: 1 },
  fastCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  fastCardTitle: { fontSize: 15, fontWeight: '700' },
  fastCardArabic: { fontSize: 18, marginTop: 4 },
  fastCardDesc: { fontSize: 13, lineHeight: 20, marginTop: 6 },
  fastCardRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  fastCardRefText: { fontSize: 11, flex: 1 },
});
