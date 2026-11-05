import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radius, ThemeColors } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

const PRAYER_GUIDE_SECTIONS = [
  {
    id: 'five-daily',
    title: 'Five Daily Prayers',
    arabic: 'الصلوات الخمس',
    icon: '🕌',
    color: '#1B5E4A',
    content: [
      {
        prayer: 'Fajr',
        arabicName: 'صلاة الفجر',
        time: 'Dawn to Sunrise',
        rakaat: 2,
        type: 'Fard',
        description: 'The pre-dawn prayer — two obligatory rak\'ahs.',
        steps: [
          'Make intention (Niyyah) for Fajr prayer',
          'Say Takbiratul Ihram: "Allahu Akbar"',
          'Recite Surah Al-Fatihah',
          'Recite any portion of the Quran',
          'Perform Ruku (bowing)',
          'Rise from Ruku: "Samiallahu liman hamidah"',
          'Perform Sujood (prostration) twice',
          'Rise for second rak\'ah and repeat',
          'Recite At-Tashahhud in final sitting',
          'Perform Tasleem: "Assalamu Alaikum wa Rahmatullah" on both sides',
        ],
        reference: 'Sahih al-Bukhari 1132, Sahih Muslim 726',
      },
      {
        prayer: 'Dhuhr',
        arabicName: 'صلاة الظهر',
        time: 'After midday to Asr time',
        rakaat: 4,
        type: 'Fard',
        description: 'The midday prayer — four obligatory rak\'ahs.',
        steps: [
          'Make Niyyah for Dhuhr prayer',
          'Say Takbiratul Ihram',
          'Recite Surah Al-Fatihah in all 4 rak\'ahs',
          'Recite additional Quranic verses in first 2 rak\'ahs',
          'After 2nd rak\'ah, sit for first Tashahhud',
          'Complete 3rd and 4th rak\'ahs',
          'Final Tashahhud with Durood Ibrahim and dua',
          'Perform Tasleem on both sides',
        ],
        reference: 'Sahih al-Bukhari 541',
      },
      {
        prayer: 'Asr',
        arabicName: 'صلاة العصر',
        time: 'Mid-afternoon to before Maghrib',
        rakaat: 4,
        type: 'Fard',
        description: 'The afternoon prayer — four obligatory rak\'ahs.',
        steps: [
          'Make Niyyah for Asr prayer',
          'Follow same structure as Dhuhr — 4 rak\'ahs',
          'First Tashahhud after 2nd rak\'ah',
          'Final Tashahhud after 4th rak\'ah',
          'Perform Tasleem',
        ],
        reference: 'Quran 2:238, Sahih al-Bukhari 527',
      },
      {
        prayer: 'Maghrib',
        arabicName: 'صلاة المغرب',
        time: 'After sunset until Isha',
        rakaat: 3,
        type: 'Fard',
        description: 'The sunset prayer — three obligatory rak\'ahs.',
        steps: [
          'Make Niyyah for Maghrib prayer',
          'Say Takbiratul Ihram',
          'Recite Surah Al-Fatihah in all 3 rak\'ahs',
          'Recite additional verses in first 2 rak\'ahs',
          'Sit after 2nd rak\'ah for first Tashahhud',
          'Stand for 3rd rak\'ah — only Al-Fatihah',
          'Final sitting with full Tashahhud, Durood, and dua',
          'Perform Tasleem',
        ],
        reference: 'Sahih al-Bukhari 1170',
      },
      {
        prayer: 'Isha',
        arabicName: 'صلاة العشاء',
        time: 'Night — after Maghrib ends until Fajr',
        rakaat: 4,
        type: 'Fard',
        description: 'The night prayer — four obligatory rak\'ahs.',
        steps: [
          'Make Niyyah for Isha prayer',
          'Same structure as Dhuhr and Asr — 4 rak\'ahs',
          'Recommended to recite longer surahs',
          'Witr prayer is highly recommended after Isha',
        ],
        reference: 'Sahih al-Bukhari 564',
      },
    ],
  },
  {
    id: 'eid',
    title: 'Eid Prayer',
    arabic: 'صلاة العيد',
    icon: '🌙',
    color: '#6B4A2D',
    content: [],
    summary: `Eid prayer consists of 2 rak'ahs with additional Takbeers.

First Rak'ah: After Takbiratul Ihram, say 7 additional Takbeers with hands raised before recitation.

Second Rak'ah: After rising, say 5 additional Takbeers before recitation.

The Imam delivers 2 Khutbahs after the prayer.

References: Abu Dawood 1149, Ibn Majah 1277`,
  },
  {
    id: 'janazah',
    title: 'Funeral Prayer',
    arabic: 'صلاة الجنازة',
    icon: '🤲',
    color: '#2D2D6B',
    content: [],
    summary: `Janazah prayer has 4 Takbeers and is performed standing.

1st Takbeer: Recite Surah Al-Fatihah
2nd Takbeer: Recite Durood Ibrahim (Salawat on the Prophet ﷺ)
3rd Takbeer: Recite the specific dua for the deceased

For an Adult Male: "Allahummaghfir lahu warhamhu wa'afihi wa'fu 'anhu"
For an Adult Female: "Allahummaghfir laha warhamha wa'afiha wa'fu 'anha"
For a Male Child: "Allahumma ij'alhu lana salafan wa faratun wa ujran"
For a Female Child: "Allahumma ij'alha lana salafan wa faratan wa ujran"

4th Takbeer: Pause briefly, then give Tasleem on both sides.

Reference: Sahih Muslim 963, Abu Dawood 3198`,
  },
  {
    id: 'special',
    title: 'Special Prayers',
    arabic: 'الصلوات الخاصة',
    icon: '⭐',
    color: '#4A6B2D',
    content: [],
    summary: `Witr Prayer: Minimum 1, maximum 11 rak'ahs performed after Isha.

Tahajjud: Night prayer in pairs, performed after midnight. Highly recommended.

Duha Prayer: 2–8 rak'ahs performed after sunrise until before Dhuhr.

Taraweeh: 20 rak'ahs in Ramadan after Isha — performed in congregation.

Istikharah: 2 rak'ahs nafl followed by the specific Istikharah dua.

References: Sahih Muslim 752, Tirmidhi 480`,
  },
];

const FAQS = [
  { q: 'What if I forget a rak\'ah?', a: 'If you realize during prayer, complete the missing rak\'ah. If realized after Salam, add the missed rak\'ah and perform Sajdah Sahw (two extra prostrations). Reference: Sahih al-Bukhari 1228' },
  { q: 'What invalidates the prayer?', a: 'The prayer is invalidated by: speaking intentionally, laughing, losing wudu, exposing awrah, turning completely away from qibla, or eating/drinking. Reference: Abu Dawood 175' },
  { q: 'How many Takbeers in Eid prayer?', a: '7 additional Takbeers in the first rak\'ah and 5 in the second, according to the majority of scholars (Maliki, Shafi\'i, Hanbali). Hanafi: 3+3 extra Takbeers. Reference: Abu Dawood 1149' },
  { q: 'Can I pray sitting due to illness?', a: 'Yes. If unable to stand, pray sitting. If unable to sit, pray lying down. If unable to move, pray with your eyes/intention. Reference: Sahih al-Bukhari 1117' },
  { q: 'What is Sajdah Sahw?', a: 'Two prostrations performed at the end of prayer to compensate for unintentional mistakes (forgetting Tashahhud, adding/missing a rak\'ah due to doubt). Reference: Sahih al-Bukhari 1226' },
];

export default function PrayerGuideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedPrayer, setExpandedPrayer] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'guide' | 'faq'>('guide');
  const { colors: C } = useApp();
  const styles = useMemo(() => createStyles(C), [C]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Prayer Guide</Text>
          <Text style={styles.headerSub}>Complete Salah Instructions</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {(['guide', 'faq'] as const).map(t => (
          <Pressable
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'guide' ? 'Prayer Guide' : 'FAQs'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {activeTab === 'guide' ? (
          <>
            {PRAYER_GUIDE_SECTIONS.map(section => (
              <View key={section.id} style={styles.sectionCard}>
                <Pressable
                  style={styles.sectionHeader}
                  onPress={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                >
                  <Text style={styles.sectionEmoji}>{section.icon}</Text>
                  <View style={styles.sectionTitleArea}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionArabic}>{section.arabic}</Text>
                  </View>
                  <MaterialIcons
                    name={expandedSection === section.id ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={C.textMuted}
                  />
                </Pressable>

                {expandedSection === section.id && (
                  <View style={styles.sectionContent}>
                    {section.summary ? (
                      <Text style={styles.summaryText}>{section.summary}</Text>
                    ) : null}
                    {section.content.map((prayer: any) => (
                      <View key={prayer.prayer} style={styles.prayerItem}>
                        <Pressable
                          style={styles.prayerItemHeader}
                          onPress={() => setExpandedPrayer(expandedPrayer === prayer.prayer ? null : prayer.prayer)}
                        >
                          <View style={styles.prayerMeta}>
                            <Text style={styles.prayerItemName}>{prayer.prayer}</Text>
                            <Text style={styles.prayerItemArabic}>{prayer.arabicName}</Text>
                            <View style={styles.prayerBadges}>
                              <View style={styles.badge}>
                                <Text style={styles.badgeText}>{prayer.rakaat} Rak\'ahs</Text>
                              </View>
                              <View style={[styles.badge, styles.badgeFard]}>
                                <Text style={styles.badgeText}>{prayer.type}</Text>
                              </View>
                            </View>
                            <Text style={styles.prayerTime}>{prayer.time}</Text>
                          </View>
                          <MaterialIcons
                            name={expandedPrayer === prayer.prayer ? 'expand-less' : 'expand-more'}
                            size={20}
                            color={C.textMuted}
                          />
                        </Pressable>

                        {expandedPrayer === prayer.prayer && (
                          <View style={styles.prayerSteps}>
                            <Text style={styles.prayerDesc}>{prayer.description}</Text>
                            {prayer.steps.map((step: string, i: number) => (
                              <View key={i} style={styles.step}>
                                <View style={styles.stepNum}>
                                  <Text style={styles.stepNumText}>{i + 1}</Text>
                                </View>
                                <Text style={styles.stepText}>{step}</Text>
                              </View>
                            ))}
                            <View style={styles.refBox}>
                              <MaterialIcons name="verified" size={12} color={C.success} />
                              <Text style={styles.refText}>{prayer.reference}</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </>
        ) : (
          <View style={styles.faqSection}>
            <Text style={styles.faqIntro}>
              Common questions about prayer, answered with authentic Islamic references.
            </Text>
            {FAQS.map((faq, i) => (
              <Pressable
                key={i}
                style={[styles.faqCard, expandedFaq === i && styles.faqCardOpen]}
                onPress={() => setExpandedFaq(expandedFaq === i ? null : i)}
              >
                <View style={styles.faqQuestion}>
                  <MaterialIcons name="help-outline" size={18} color={C.gold} />
                  <Text style={styles.faqQ}>{faq.q}</Text>
                  <MaterialIcons
                    name={expandedFaq === i ? 'expand-less' : 'expand-more'}
                    size={18}
                    color={C.textMuted}
                  />
                </View>
                {expandedFaq === i && (
                  <Text style={styles.faqA}>{faq.a}</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, color: Colors.textPrimary, fontWeight: '700' },
  headerSub: { fontSize: 13, color: Colors.textMuted },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.gold },
  tabText: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: Colors.gold, fontWeight: '700' },
  scroll: { padding: Spacing.md },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  sectionEmoji: { fontSize: 28 },
  sectionTitleArea: { flex: 1 },
  sectionTitle: { fontSize: 17, color: Colors.textPrimary, fontWeight: '700' },
  sectionArabic: { fontSize: 16, color: Colors.gold, marginTop: 2 },
  sectionContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  summaryText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 24, whiteSpace: 'pre-line' } as any,
  prayerItem: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  prayerItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  prayerMeta: { flex: 1 },
  prayerItemName: { fontSize: 16, color: Colors.textPrimary, fontWeight: '700' },
  prayerItemArabic: { fontSize: 15, color: Colors.gold },
  prayerBadges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: {
    backgroundColor: `${Colors.gold}15`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeFard: { backgroundColor: `${Colors.success}15` },
  badgeText: { fontSize: 10, color: Colors.gold, fontWeight: '600' },
  prayerTime: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  prayerSteps: { padding: 12, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  prayerDesc: { fontSize: 14, color: Colors.textSecondary, fontStyle: 'italic', marginBottom: 10, lineHeight: 20 },
  step: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}40`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: { fontSize: 11, color: Colors.gold, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 14, color: Colors.textPrimary, lineHeight: 22 },
  refBox: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    padding: 8,
    backgroundColor: `${Colors.success}10`,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: `${Colors.success}20`,
  },
  refText: { flex: 1, fontSize: 11, color: Colors.textMuted },
  faqSection: { gap: 10 },
  faqIntro: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    padding: Spacing.md,
    backgroundColor: `${Colors.primary}20`,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  faqCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
  },
  faqCardOpen: { borderColor: `${Colors.gold}40` },
  faqQuestion: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  faqQ: { flex: 1, fontSize: 15, color: Colors.textPrimary, fontWeight: '600', lineHeight: 22 },
  faqA: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
});
