import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

// Hajj & Umrah step-by-step guide
const HAJJ_STEPS = [
  {
    day: 'Before Departure',
    icon: '✈️',
    title: 'Preparation',
    arabic: 'التحضير',
    steps: [
      { title: 'Learn the rituals', desc: 'Study the Hajj manasik thoroughly from reliable sources.', ref: 'Obligatory' },
      { title: 'Settle debts & make will', desc: 'Pay off debts, make a will, and leave sufficient provision for family.', ref: 'Recommended' },
      { title: 'Seek forgiveness', desc: 'Repent from sins and seek forgiveness from those you may have wronged.', ref: 'Recommended' },
      { title: 'Hajj savings', desc: 'Ensure your Hajj funds are from halal sources.', ref: 'Obligatory' },
    ],
  },
  {
    day: '8 Dhul Hijjah - Yawm at-Tarwiyah',
    icon: '🕌',
    title: 'Day 1 - Ihram & Mina',
    arabic: 'يوم التروية',
    steps: [
      { title: 'Enter Ihram from Miqat', desc: 'Perform ghusl, wear Ihram garments, make niyyah, and recite Talbiyah: لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ', ref: 'Obligatory' },
      { title: 'Travel to Mina', desc: 'Spend the day and night in Mina. Pray Dhuhr, Asr, Maghrib, Isha, and Fajr shortened (Qasr) but not combined.', ref: 'Sunnah' },
      { title: 'Make Dua', desc: 'Spend time in remembrance of Allah and making dua.', ref: 'Recommended' },
    ],
  },
  {
    day: '9 Dhul Hijjah - Yawm Arafah',
    icon: '🌄',
    title: 'Day 2 - Arafah (The Pillar of Hajj)',
    arabic: 'يوم عرفة',
    steps: [
      { title: 'Travel to Arafah after Fajr', desc: 'Move to Arafah. The entire plain of Arafah is a valid standing area.', ref: 'Obligatory' },
      { title: 'Wuquf (Standing) at Arafah', desc: 'This is THE PILLAR of Hajj. Stand in dua from Dhuhr until sunset. Pray Dhuhr and Asr combined and shortened.', ref: 'Obligatory - Rukn' },
      { title: 'Abundant Dua at Arafah', desc: 'The Prophet ﷺ said: The best dua is the dua on the Day of Arafah. Make dua, cry, and beg Allah.', ref: 'Tirmidhi 3585' },
      { title: 'Travel to Muzdalifah after Maghrib', desc: 'After sunset, travel to Muzdalifah. Pray Maghrib and Isha combined.', ref: 'Obligatory' },
    ],
  },
  {
    day: '10 Dhul Hijjah - Yawm an-Nahr',
    icon: '🐑',
    title: 'Day 3 - Eid ul-Adha (The Day of Sacrifice)',
    arabic: 'يوم النحر',
    steps: [
      { title: 'Wuquf at Muzdalifah', desc: 'Remain in Muzdalifah until after Fajr prayer. Collect pebbles for Jamarat.', ref: 'Obligatory' },
      { title: 'Rami al-Jamarat (Stoning)', desc: 'Stone Jamrat al-Aqabah (the large pillar) with 7 pebbles, saying Allahu Akbar with each throw.', ref: 'Obligatory - Wajib' },
      { title: 'Sacrifice (Hady)', desc: 'Sacrifice an animal or arrange for one to be sacrificed in your name.', ref: 'Wajib for Tamattu & Qiran' },
      { title: 'Shaving or cutting hair (Halq/Taqsir)', desc: 'Men shave their heads completely. Women cut a fingertip length of hair. This is the partial release from Ihram.', ref: 'Obligatory - Wajib' },
      { title: 'Tawaf al-Ifadhah', desc: 'Perform 7 circuits of the Kaabah. This is a PILLAR of Hajj.', ref: 'Obligatory - Rukn' },
      { title: "Sa'i between Safa and Marwa", desc: 'Walk 7 times between Safa and Marwa. Required for Tamattu pilgrims.', ref: 'Obligatory - Rukn' },
    ],
  },
  {
    day: '11-13 Dhul Hijjah - Ayyam at-Tashreeq',
    icon: '🌙',
    title: 'Days 4-5-6 - Mina (Tashreeq Days)',
    arabic: 'أيام التشريق',
    steps: [
      { title: 'Rami al-Jamarat (Daily Stoning)', desc: 'Stone all three pillars (Sughra, Wusta, Aqabah) with 7 pebbles each, after Dhuhr. Say Allahu Akbar with each throw.', ref: 'Obligatory - Wajib' },
      { title: 'Dhikr and Dua in Mina', desc: '"Remember Allah in the numbered days." (Quran 2:203)', ref: 'Al-Baqarah 2:203' },
      { title: 'Remain in Mina for 2 or 3 nights', desc: 'Spending nights in Mina is wajib. Those who hasten can leave after Day 12 before sunset.', ref: 'Wajib' },
    ],
  },
  {
    day: 'Before Leaving Makkah',
    icon: '🕋',
    title: 'Farewell Tawaf',
    arabic: 'طواف الوداع',
    steps: [
      { title: 'Tawaf al-Wada (Farewell Tawaf)', desc: 'The last act before leaving Makkah. Perform 7 circuits of the Kaabah. Obligatory for non-residents of Makkah.', ref: 'Sahih al-Bukhari 1755 - Wajib' },
      { title: 'Final farewell prayer', desc: 'Pray 2 rakahs at Maqam Ibrahim if possible. Make final dua at the Kaabah before departing.', ref: 'Recommended' },
    ],
  },
];

const UMRAH_STEPS = [
  {
    step: 1,
    icon: '🧳',
    title: 'Ihram at Miqat',
    arabic: 'الإحرام',
    desc: 'Perform ghusl, wear Ihram, make niyyah for Umrah, and recite Talbiyah: لَبَّيْكَ اللَّهُمَّ عُمْرَةً',
    ref: 'Obligatory - Rukn',
  },
  {
    step: 2,
    icon: '🕋',
    title: 'Tawaf al-Umrah',
    arabic: 'طواف العمرة',
    desc: 'Perform 7 circuits around the Kaabah, starting and ending at the Black Stone (Hajar al-Aswad). Begin with Istilam (touching or pointing to Black Stone).',
    ref: 'Obligatory - Rukn',
  },
  {
    step: 3,
    icon: '🏃',
    title: "Sa'i between Safa and Marwa",
    arabic: 'السعي',
    desc: 'Walk 7 times between Safa and Marwa. Start at Safa, end at Marwa. Climb Safa, face Kaabah, make dua. Walk to Marwa. Repeat 7 times.',
    ref: 'Obligatory - Rukn',
  },
  {
    step: 4,
    icon: '✂️',
    title: 'Halq or Taqsir',
    arabic: 'الحلق أو التقصير',
    desc: 'Men: shave entire head (Halq) or cut hair evenly (Taqsir). Women: cut a fingertip length from end of hair. This releases you from Ihram.',
    ref: 'Obligatory - Wajib',
  },
];

const IMPORTANT_DUAS = [
  { title: 'Talbiyah', arabic: 'لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ', transliteration: 'Labbayk Allahumma Labbayk, Labbayk la sharika laka Labbayk', translation: 'Here I am O Allah, here I am. Here I am, You have no partner, here I am.' },
  { title: 'Dua at Arafah', arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', transliteration: 'La ilaha illallah wahdahu la sharika lah, lahul mulku walahul hamdu wahuwa ala kulli shay in qadir', translation: 'There is no deity except Allah alone, with no partner. To Him belongs the dominion and all praise, and He has power over all things.' },
  { title: 'Dua when seeing the Kaabah', arabic: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ فَحَيِّنَا رَبَّنَا بِالسَّلَامِ', transliteration: 'Allahumma Antas-Salam wa minkas-Salam fa hayyina Rabbana bis-Salam', translation: 'O Allah, You are As-Salam (Peace) and from You is peace. O our Lord, greet us with peace.' },
  { title: 'Dua between Safa and Marwa', arabic: 'رَبِّ اغْفِرْ وَارْحَمْ وَأَنْتَ الأَعَزُّ الأَكْرَمُ', transliteration: 'Rabbi ighfir warham wa Antal-Aazzul Akram', translation: 'My Lord, forgive and have mercy, for You are the Most Mighty, the Most Noble.' },
];

export default function HajjGuideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C } = useApp();
  const [activeTab, setActiveTab] = useState<'hajj' | 'umrah' | 'duas' | 'checklist'>('hajj');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const CHECKLIST_ITEMS = [
    { category: 'Documents', items: ['Passport (valid 6+ months)', 'Hajj/Umrah visa', 'Vaccination certificate', 'Travel insurance', 'Emergency contacts', 'Hotel booking confirmation'] },
    { category: 'Ihram Clothing', items: ['2 white Ihram sheets (men)', 'White dress or abaya (women)', 'Belt for Ihram', 'White socks (optional)', 'Flip flops or sandals'] },
    { category: 'Personal Items', items: ['Small backpack', 'Water bottle', 'Unscented soap/shampoo', 'Unscented deodorant', 'Basic medicines', 'First aid kit', 'Sunscreen (unscented)', 'Sunglasses', 'Prayer mat'] },
    { category: 'Islamic Items', items: ['Quran', 'Tasbeeh (prayer beads)', 'Dua book', 'Hajj guide book', 'Pocket-sized directions to holy sites'] },
    { category: 'Electronics', items: ['Phone charger', 'Portable battery bank', 'Adapter plug', 'Headphones (for Quran)'] },
  ];

  const toggleCheck = (key: string) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const totalItems = CHECKLIST_ITEMS.reduce((sum, cat) => sum + cat.items.length, 0);
  const checkedItems = Object.values(checklist).filter(Boolean).length;

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityLabel="Go back"
          accessibilityRole="button" style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Hajj & Umrah Guide</Text>
            <Text style={[styles.headerSub, { color: C.gold }]}>حَجٌّ وَعُمْرَة</Text>
          </View>
        </View>
        <Text style={[styles.headerQuote, { color: C.textSecondary }]}>
          "And proclaim to the people the Hajj; they will come to you on foot and on every lean camel." — Quran 22:27
        </Text>
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: C.cardBorder }]}>
        {(['hajj', 'umrah', 'duas', 'checklist'] as const).map(t => (
          <Pressable
            key={t}
            style={[styles.tab, activeTab === t && [styles.tabActive, { borderBottomColor: C.gold }]]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, { color: activeTab === t ? C.gold : C.textMuted }, activeTab === t && styles.tabTextActive]}>
              {t === 'hajj' ? '🕋 Hajj' : t === 'umrah' ? '🌙 Umrah' : t === 'duas' ? '🤲 Duas' : `✅ Packing (${checkedItems}/${totalItems})`}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {activeTab === 'hajj' && (
          <View style={styles.content}>
            <View style={[styles.infoNote, { backgroundColor: `${C.gold}10`, borderColor: `${C.gold}20` }]}>
              <MaterialIcons name="info-outline" size={16} color={C.gold} />
              <Text style={[styles.infoText, { color: C.textSecondary }]}>
                Hajj is one of the Five Pillars of Islam, obligatory once in a lifetime for every able Muslim.
              </Text>
            </View>
            {HAJJ_STEPS.map((phase, i) => (
              <View key={i} style={[styles.phaseCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Pressable style={styles.phaseHeader} onPress={() => setExpandedStep(expandedStep === i ? null : i)}>
                  <Text style={styles.phaseIcon}>{phase.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.phaseDay, { color: C.gold }]}>{phase.day}</Text>
                    <Text style={[styles.phaseTitle, { color: C.textPrimary }]}>{phase.title}</Text>
                    <Text style={[styles.phaseArabic, { color: C.textArabic }]}>{phase.arabic}</Text>
                  </View>
                  <MaterialIcons name={expandedStep === i ? 'expand-less' : 'expand-more'} size={24} color={C.textMuted} />
                </Pressable>
                {expandedStep === i && (
                  <View style={[styles.phaseSteps, { borderTopColor: C.cardBorder }]}>
                    {phase.steps.map((step, j) => (
                      <View key={j} style={[styles.step, j > 0 && { borderTopColor: C.cardBorder, borderTopWidth: 1 }]}>
                        <View style={[styles.stepNum, { backgroundColor: `${C.gold}20` }]}>
                          <Text style={[styles.stepNumText, { color: C.gold }]}>{j + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.stepTitle, { color: C.textPrimary }]}>{step.title}</Text>
                          <Text style={[styles.stepDesc, { color: C.textSecondary }]}>{step.desc}</Text>
                          <View style={[styles.stepRef, { backgroundColor: `${C.success}10` }]}>
                            <Text style={[styles.stepRefText, { color: C.success }]}>{step.ref}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'umrah' && (
          <View style={styles.content}>
            <View style={[styles.infoNote, { backgroundColor: `${C.info}10`, borderColor: `${C.info}20` }]}>
              <MaterialIcons name="info-outline" size={16} color={C.info} />
              <Text style={[styles.infoText, { color: C.textSecondary }]}>
                Umrah can be performed at any time of year. It consists of 4 main rituals.
              </Text>
            </View>
            {UMRAH_STEPS.map((step, i) => (
              <View key={i} style={[styles.umrahCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <View style={[styles.umrahNum, { backgroundColor: `${C.gold}20` }]}>
                  <Text style={[styles.umrahNumText, { color: C.gold }]}>{step.step}</Text>
                  <Text style={styles.umrahIcon}>{step.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.umrahTitleRow}>
                    <Text style={[styles.umrahTitle, { color: C.textPrimary }]}>{step.title}</Text>
                    <Text style={[styles.umrahArabic, { color: C.textArabic }]}>{step.arabic}</Text>
                  </View>
                  <Text style={[styles.umrahDesc, { color: C.textSecondary }]}>{step.desc}</Text>
                  <View style={[styles.stepRef, { backgroundColor: `${C.success}10` }]}>
                    <Text style={[styles.stepRefText, { color: C.success }]}>{step.ref}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'duas' && (
          <View style={styles.content}>
            {IMPORTANT_DUAS.map((dua, i) => (
              <View key={i} style={[styles.duaCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Text style={[styles.duaTitle, { color: C.gold }]}>{dua.title}</Text>
                <Text style={[styles.duaArabic, { color: C.textArabic }]}>{dua.arabic}</Text>
                <Text style={[styles.duaTranslit, { color: C.textMuted, fontStyle: 'italic' }]}>{dua.transliteration}</Text>
                <Text style={[styles.duaTranslation, { color: C.textSecondary }]}>{dua.translation}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'checklist' && (
          <View style={styles.content}>
            <View style={[styles.checkProgress, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.checkProgressTitle, { color: C.textPrimary }]}>Packing Progress</Text>
              <Text style={[styles.checkProgressPct, { color: C.gold }]}>{Math.round((checkedItems / totalItems) * 100)}%</Text>
              <View style={[styles.checkProgressBar, { backgroundColor: C.cardBorder }]}>
                <View style={[styles.checkProgressFill, { width: `${(checkedItems / totalItems) * 100}%`, backgroundColor: C.gold }]} />
              </View>
              <Text style={[styles.checkProgressSub, { color: C.textMuted }]}>{checkedItems} of {totalItems} items packed</Text>
            </View>
            {CHECKLIST_ITEMS.map((cat) => (
              <View key={cat.category} style={[styles.checkCat, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Text style={[styles.checkCatTitle, { color: C.gold }]}>{cat.category}</Text>
                {cat.items.map((item) => {
                  const key = `${cat.category}-${item}`;
                  return (
                    <Pressable key={item} style={[styles.checkItem, { borderTopColor: C.cardBorder }]} onPress={() => toggleCheck(key)}>
                      <MaterialIcons
                        name={checklist[key] ? 'check-box' : 'check-box-outline-blank'}
                        size={22}
                        color={checklist[key] ? C.success : C.textMuted}
                      />
                      <Text style={[styles.checkItemText, { color: checklist[key] ? C.textMuted : C.textPrimary, textDecorationLine: checklist[key] ? 'line-through' : 'none' }]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 18, marginTop: 2 },
  headerQuote: { fontSize: 12, fontStyle: 'italic', lineHeight: 18 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: {},
  tabText: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  tabTextActive: { fontWeight: '700' },
  content: { padding: Spacing.md, gap: 12 },
  infoNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: Radius.md, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20 },
  phaseCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  phaseHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  phaseIcon: { fontSize: 28 },
  phaseDay: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  phaseTitle: { fontSize: 15, fontWeight: '700' },
  phaseArabic: { fontSize: 16, marginTop: 2 },
  phaseSteps: { borderTopWidth: 1 },
  step: { flexDirection: 'row', padding: 12, gap: 10 },
  stepNum: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 12, fontWeight: '700' },
  stepTitle: { fontSize: 14, fontWeight: '600' },
  stepDesc: { fontSize: 13, lineHeight: 20, marginTop: 3 },
  stepRef: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  stepRefText: { fontSize: 10, fontWeight: '600' },
  umrahCard: { flexDirection: 'row', borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.md },
  umrahNum: { alignItems: 'center', justifyContent: 'center', width: 52, borderRadius: 12, padding: 8 },
  umrahNumText: { fontSize: 16, fontWeight: '700' },
  umrahIcon: { fontSize: 20, marginTop: 2 },
  umrahTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  umrahTitle: { fontSize: 15, fontWeight: '700' },
  umrahArabic: { fontSize: 18 },
  umrahDesc: { fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 6 },
  duaCard: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1 },
  duaTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  duaArabic: { fontSize: 18, textAlign: 'right', lineHeight: 34, marginBottom: 6 },
  duaTranslit: { fontSize: 13, lineHeight: 20, marginBottom: 4 },
  duaTranslation: { fontSize: 14, lineHeight: 22 },
  checkProgress: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, alignItems: 'center' },
  checkProgressTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  checkProgressPct: { fontSize: 36, fontWeight: '700' },
  checkProgressBar: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: 8 },
  checkProgressFill: { height: '100%', borderRadius: 4 },
  checkProgressSub: { fontSize: 13 },
  checkCat: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  checkCatTitle: { fontSize: 14, fontWeight: '700', padding: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 1 },
  checkItemText: { fontSize: 14, flex: 1 },
});
