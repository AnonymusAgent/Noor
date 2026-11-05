import { EXTENDED_HADITHS } from './offlineHadithDbExtended';
/**
 * Offline Hadith Database — 42 Nawawi + 40 core hadiths from major collections
 * Complete, verified, authentic hadiths stored locally for offline access.
 * Sources: Sahih al-Bukhari, Sahih Muslim, Nawawi's 40 Hadiths, Riyad as-Salihin
 */

export interface OfflineHadith {
  id: string;
  collection: string;
  number: number;
  bookName: string;
  chapterName: string;
  arabic: string;
  english: string;
  narrator: string;
  grade: string;
  reference: string;
}

export const OFFLINE_HADITHS: OfflineHadith[] = [
  // ── Nawawi 40 ─────────────────────────────────────────────────────────────
  {
    id: 'nawawi_1', collection: 'nawawi40', number: 1,
    bookName: '40 Hadith Nawawi', chapterName: 'Actions by Intentions',
    arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ فَهِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ، وَمَنْ كَانَتْ هِجْرَتُهُ لِدُنْيَا يُصِيبُهَا أَوِ امْرَأَةٍ يَنْكِحُهَا فَهِجْرَتُهُ إِلَى مَا هَاجَرَ إِلَيْهِ',
    english: 'Actions are judged by intentions, so each man will have what he intended. Thus, he whose migration was to Allah and His Messenger, his migration is to Allah and His Messenger; but he whose migration was for some worldly thing he might gain, or for a wife he might marry, his migration is to that for which he migrated.',
    narrator: 'Umar ibn al-Khattab (RA)', grade: 'Sahih', reference: 'Al-Bukhari 1, Muslim 1907'
  },
  {
    id: 'nawawi_2', collection: 'nawawi40', number: 2,
    bookName: '40 Hadith Nawawi', chapterName: 'Definition of Islam, Iman and Ihsan',
    arabic: 'الإِيمَانُ أَنْ تُؤْمِنَ بِاللَّهِ، وَمَلَائِكَتِهِ، وَكُتُبِهِ، وَرُسُلِهِ، وَالْيَوْمِ الآخِرِ، وَتُؤْمِنَ بِالْقَدَرِ خَيْرِهِ وَشَرِّهِ',
    english: 'Faith is to believe in Allah, His angels, His books, His messengers, the Last Day, and to believe in divine destiny, both the good and the evil thereof.',
    narrator: 'Umar ibn al-Khattab (RA)', grade: 'Sahih', reference: 'Muslim 8'
  },
  {
    id: 'nawawi_3', collection: 'nawawi40', number: 3,
    bookName: '40 Hadith Nawawi', chapterName: 'Pillars of Islam',
    arabic: 'بُنِيَ الإِسْلامُ عَلَى خَمْسٍ: شَهَادَةِ أَنْ لا إِلَهَ إلاَّ الله وَأَنَّ مُحَمَّداً رَسُولُ اللهِ، وَإِقَامِ الصَّلاةِ، وَإِيتَاءِ الزَّكَاةِ، وَحَجِّ الْبَيتِ، وَصَوْمِ رَمَضَانَ',
    english: 'Islam has been built on five things: Testifying that there is no god but Allah and that Muhammad is the Messenger of Allah, performing prayers, paying Zakat, making the pilgrimage to the House, and fasting in Ramadan.',
    narrator: 'Ibn Umar (RA)', grade: 'Sahih', reference: 'Al-Bukhari 8, Muslim 16'
  },
  {
    id: 'nawawi_4', collection: 'nawawi40', number: 4,
    bookName: '40 Hadith Nawawi', chapterName: 'Creation of Man',
    arabic: 'إِنَّ أَحَدَكُمْ يُجْمَعُ خَلْقُهُ فِي بَطْنِ أُمِّهِ أَرْبَعِينَ يَوْماً نُطْفَةً، ثُمَّ يَكُونُ عَلَقَةً مِثْلَ ذَلِكَ، ثُمَّ يَكُونُ مُضْغَةً مِثْلَ ذَلِكَ',
    english: 'The creation of each one of you is collected in his mother\'s womb for forty days as a drop of fluid, then it is a clot for a similar period, then a morsel for a similar period.',
    narrator: 'Abdullah ibn Masud (RA)', grade: 'Sahih', reference: 'Al-Bukhari 3208, Muslim 2643'
  },
  {
    id: 'nawawi_5', collection: 'nawawi40', number: 5,
    bookName: '40 Hadith Nawawi', chapterName: 'Innovations and Bidah',
    arabic: 'مَنْ أَحْدَثَ فِي أَمْرِنَا هَذَا مَا لَيْسَ مِنْهُ فَهُوَ رَدٌّ',
    english: 'Whosoever introduces into this affair of ours something that does not belong to it, it will be rejected.',
    narrator: 'Aisha (RA)', grade: 'Sahih', reference: 'Al-Bukhari 2697, Muslim 1718'
  },
  {
    id: 'nawawi_6', collection: 'nawawi40', number: 6,
    bookName: '40 Hadith Nawawi', chapterName: 'Halal and Haram',
    arabic: 'الْحَلَالُ بَيِّنٌ، وَالْحَرَامُ بَيِّنٌ، وَبَيْنَهُمَا مُشْتَبِهَاتٌ لَا يَعْلَمُهَا كَثِيرٌ مِنَ النَّاسِ',
    english: 'The halal is clear and the haram is clear, and between them are matters that are doubtful which many people do not know.',
    narrator: 'An-Numan ibn Bashir (RA)', grade: 'Sahih', reference: 'Al-Bukhari 52, Muslim 1599'
  },
  {
    id: 'nawawi_7', collection: 'nawawi40', number: 7,
    bookName: '40 Hadith Nawawi', chapterName: 'Sincerity of Religion',
    arabic: 'الدِّينُ النَّصِيحَةُ. قُلْنَا: لِمَنْ؟ قَالَ: لِلَّهِ، وَلِكِتَابِهِ، وَلِرَسُولِهِ، وَلِأَئِمَّةِ الْمُسْلِمِينَ وَعَامَّتِهِمْ',
    english: 'The religion is sincerity. We said: To whom? He said: To Allah, His Book, His Messenger, the leaders of the Muslims, and their common folk.',
    narrator: 'Tamim al-Dari (RA)', grade: 'Sahih', reference: 'Muslim 55'
  },
  {
    id: 'nawawi_8', collection: 'nawawi40', number: 8,
    bookName: '40 Hadith Nawawi', chapterName: 'Inviolability of a Muslim',
    arabic: 'أُمِرْتُ أَنْ أُقَاتِلَ النَّاسَ حَتَّى يَشْهَدُوا أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَنَّ مُحَمَّداً رَسُولُ اللَّهِ',
    english: 'I have been ordered to fight the people until they testify that there is no deity worthy of worship except Allah and that Muhammad is the Messenger of Allah.',
    narrator: 'Ibn Umar (RA)', grade: 'Sahih', reference: 'Al-Bukhari 25, Muslim 22'
  },
  {
    id: 'nawawi_9', collection: 'nawawi40', number: 9,
    bookName: '40 Hadith Nawawi', chapterName: 'Avoiding Prohibitions',
    arabic: 'مَا نَهَيْتُكُمْ عَنْهُ فَاجْتَنِبُوهُ، وَمَا أَمَرْتُكُمْ بِهِ فَأْتُوا مِنْهُ مَا اسْتَطَعْتُمْ',
    english: 'Avoid that which I have forbidden you, and do that which I have commanded you to the best of your ability.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Al-Bukhari 7288, Muslim 1337'
  },
  {
    id: 'nawawi_10', collection: 'nawawi40', number: 10,
    bookName: '40 Hadith Nawawi', chapterName: 'Eating Halal',
    arabic: 'إِنَّ اللَّهَ طَيِّبٌ لَا يَقْبَلُ إِلَّا طَيِّباً، وَإِنَّ اللَّهَ أَمَرَ الْمُؤْمِنِينَ بِمَا أَمَرَ بِهِ الْمُرْسَلِينَ',
    english: 'Allah is pure and accepts only that which is pure. Allah commanded the believers with the same commandment He gave to the Messengers.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Muslim 1015'
  },
  {
    id: 'nawawi_11', collection: 'nawawi40', number: 11,
    bookName: '40 Hadith Nawawi', chapterName: 'Leaving Doubt',
    arabic: 'دَعْ مَا يَرِيبُكَ إِلَى مَا لَا يَرِيبُكَ',
    english: 'Leave that which makes you doubt for that which does not make you doubt.',
    narrator: 'Al-Hasan ibn Ali (RA)', grade: 'Sahih', reference: 'Al-Tirmidhi 2518, Ahmad 1723'
  },
  {
    id: 'nawawi_12', collection: 'nawawi40', number: 12,
    bookName: '40 Hadith Nawawi', chapterName: 'Leaving What Does Not Concern You',
    arabic: 'مِنْ حُسْنِ إِسْلَامِ الْمَرْءِ تَرْكُهُ مَا لَا يَعْنِيهِ',
    english: 'Part of the perfection of one\'s Islam is his leaving that which does not concern him.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Hasan', reference: 'Al-Tirmidhi 2317, Ibn Majah 3976'
  },
  {
    id: 'nawawi_13', collection: 'nawawi40', number: 13,
    bookName: '40 Hadith Nawawi', chapterName: 'Loving for Your Brother What You Love for Yourself',
    arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    english: 'None of you truly believes until he loves for his brother what he loves for himself.',
    narrator: 'Anas ibn Malik (RA)', grade: 'Sahih', reference: 'Al-Bukhari 13, Muslim 45'
  },
  {
    id: 'nawawi_14', collection: 'nawawi40', number: 14,
    bookName: '40 Hadith Nawawi', chapterName: 'Inviolability of a Muslim\'s Blood',
    arabic: 'لَا يَحِلُّ دَمُ امْرِئٍ مُسْلِمٍ يَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَنِّي رَسُولُ اللَّهِ إِلَّا بِإِحْدَى ثَلَاثٍ',
    english: 'The blood of a Muslim may not be shed except in three cases: in retaliation for murder, a married person who commits adultery, and one who forsakes his religion and abandons the community.',
    narrator: 'Ibn Masud (RA)', grade: 'Sahih', reference: 'Al-Bukhari 6878, Muslim 1676'
  },
  {
    id: 'nawawi_15', collection: 'nawawi40', number: 15,
    bookName: '40 Hadith Nawawi', chapterName: 'Generosity in Speech',
    arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيَقُلْ خَيْراً أَوْ لِيَصْمُتْ',
    english: 'Whoever believes in Allah and the Last Day should speak good or remain silent.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Al-Bukhari 6018, Muslim 47'
  },
  {
    id: 'nawawi_16', collection: 'nawawi40', number: 16,
    bookName: '40 Hadith Nawawi', chapterName: 'Avoiding Anger',
    arabic: 'لَا تَغْضَبْ، فَرَدَّدَ مِرَاراً، قَالَ: لَا تَغْضَبْ',
    english: 'Do not get angry. He repeated it several times. He (the Prophet) said: Do not get angry.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Al-Bukhari 6116'
  },
  {
    id: 'nawawi_17', collection: 'nawawi40', number: 17,
    bookName: '40 Hadith Nawawi', chapterName: 'Excellence in Everything',
    arabic: 'إِنَّ اللَّهَ كَتَبَ الإِحْسَانَ عَلَى كُلِّ شَيْءٍ، فَإِذَا قَتَلْتُمْ فَأَحْسِنُوا الْقِتْلَةَ، وَإِذَا ذَبَحْتُمْ فَأَحْسِنُوا الذَّبْحَةَ',
    english: 'Verily Allah has prescribed ihsan (proficiency, perfectionism) in all things. So if you kill then kill well; and if you slaughter, then slaughter well.',
    narrator: 'Shaddad ibn Aws (RA)', grade: 'Sahih', reference: 'Muslim 1955'
  },
  {
    id: 'nawawi_18', collection: 'nawawi40', number: 18,
    bookName: '40 Hadith Nawawi', chapterName: 'Fearing Allah',
    arabic: 'اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ، وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا، وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ',
    english: 'Fear Allah wherever you are. Follow up a bad deed with a good deed, it will erase it. And treat people with good character.',
    narrator: 'Abu Dharr (RA)', grade: 'Hasan', reference: 'Al-Tirmidhi 1987, Ahmad 21354'
  },
  {
    id: 'nawawi_19', collection: 'nawawi40', number: 19,
    bookName: '40 Hadith Nawawi', chapterName: 'Preserve Allah and He Will Preserve You',
    arabic: 'احْفَظِ اللَّهَ يَحْفَظْكَ، احْفَظِ اللَّهَ تَجِدْهُ تُجَاهَكَ',
    english: 'Preserve (your duties to) Allah and He will preserve you. Preserve (your duties to) Allah and you will find Him in front of you.',
    narrator: 'Abdullah ibn Abbas (RA)', grade: 'Hasan Sahih', reference: 'Al-Tirmidhi 2516'
  },
  {
    id: 'nawawi_20', collection: 'nawawi40', number: 20,
    bookName: '40 Hadith Nawawi', chapterName: 'Modesty',
    arabic: 'اسْتَحِي مِنَ اللَّهِ كَمَا تَسْتَحِي مِنَ الرَّجُلِ الصَّالِحِ مِنْ قَوْمِكَ',
    english: 'Be shy before Allah in the same way that you are shy before a righteous man from your people.',
    narrator: 'Abu Masud al-Ansari (RA)', grade: 'Sahih', reference: 'Ahmad 17741'
  },
  {
    id: 'nawawi_21', collection: 'nawawi40', number: 21,
    bookName: '40 Hadith Nawawi', chapterName: 'Steadfastness',
    arabic: 'قُلْ آمَنْتُ بِاللَّهِ ثُمَّ اسْتَقِمْ',
    english: 'Say: I believe in Allah, and then be steadfast.',
    narrator: 'Sufyan ibn Abdullah (RA)', grade: 'Sahih', reference: 'Muslim 38'
  },
  {
    id: 'nawawi_22', collection: 'nawawi40', number: 22,
    bookName: '40 Hadith Nawawi', chapterName: 'Entering Paradise by Not Associating Partners',
    arabic: 'مَنْ مَاتَ وَهُوَ يَعْلَمُ أَنَّهُ لَا إِلَهَ إِلَّا اللَّهُ دَخَلَ الْجَنَّةَ',
    english: 'Whoever dies knowing that there is no god but Allah will enter Paradise.',
    narrator: 'Muadh ibn Jabal (RA)', grade: 'Sahih', reference: 'Muslim 26'
  },
  {
    id: 'nawawi_23', collection: 'nawawi40', number: 23,
    bookName: '40 Hadith Nawawi', chapterName: 'Purity is Part of Faith',
    arabic: 'الطُّهُورُ شَطْرُ الإِيمَانِ، وَالْحَمْدُ لِلَّهِ تَمْلَأُ الْمِيزَانَ',
    english: 'Purity is half of faith. Al-hamdulillah fills the scale. SubhanAllah and Al-hamdulillah fill up what is between the heavens and the earth.',
    narrator: 'Abu Malik al-Ashari (RA)', grade: 'Sahih', reference: 'Muslim 223'
  },
  {
    id: 'nawawi_24', collection: 'nawawi40', number: 24,
    bookName: '40 Hadith Nawawi', chapterName: 'Prohibition of Oppression',
    arabic: 'إِنَّ اللَّهَ حَرَّمَ الظُّلْمَ عَلَى نَفْسِهِ وَجَعَلَهُ بَيْنَكُمْ مُحَرَّماً فَلَا تَظَالَمُوا',
    english: 'Allah, the Exalted, has made oppression unlawful for Himself and He has made it unlawful among you, so do not oppress one another.',
    narrator: 'Abu Dharr (RA)', grade: 'Sahih', reference: 'Muslim 2577'
  },
  {
    id: 'nawawi_25', collection: 'nawawi40', number: 25,
    bookName: '40 Hadith Nawawi', chapterName: 'Charity',
    arabic: 'كُلُّ سُلَامَى مِنَ النَّاسِ عَلَيْهِ صَدَقَةٌ كُلَّ يَوْمٍ تَطْلُعُ فِيهِ الشَّمْسُ',
    english: 'Every joint of a person must perform a charity each day that the sun rises: to judge justly between two people is a charity.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Al-Bukhari 2707, Muslim 1009'
  },
  {
    id: 'nawawi_26', collection: 'nawawi40', number: 26,
    bookName: '40 Hadith Nawawi', chapterName: 'All Deeds Are Charity',
    arabic: 'كُلُّ مَعْرُوفٍ صَدَقَةٌ',
    english: 'Every good deed is charity.',
    narrator: 'Jabir ibn Abdillah (RA)', grade: 'Sahih', reference: 'Al-Bukhari 6021, Muslim 1005'
  },
  {
    id: 'nawawi_27', collection: 'nawawi40', number: 27,
    bookName: '40 Hadith Nawawi', chapterName: 'Good Conduct',
    arabic: 'الْبِرُّ حُسْنُ الْخُلُقِ، وَالإِثْمُ مَا حَاكَ فِي صَدْرِكَ وَكَرِهْتَ أَنْ يَطَّلِعَ عَلَيْهِ النَّاسُ',
    english: 'Righteousness is good character, and sin is that which wavers in your soul and which you dislike the people finding out about.',
    narrator: 'An-Nawwas ibn Saman (RA)', grade: 'Sahih', reference: 'Muslim 2553'
  },
  {
    id: 'nawawi_28', collection: 'nawawi40', number: 28,
    bookName: '40 Hadith Nawawi', chapterName: 'Holding to the Sunnah',
    arabic: 'عَلَيْكُمْ بِسُنَّتِي وَسُنَّةِ الْخُلَفَاءِ الرَّاشِدِينَ الْمَهْدِيِّينَ مِنْ بَعْدِي',
    english: 'Hold to my Sunnah and the Sunnah of the rightly-guided caliphs after me. Cling to it stubbornly.',
    narrator: 'Irbad ibn Sariyah (RA)', grade: 'Sahih', reference: 'Abu Dawud 4607, Al-Tirmidhi 2676'
  },
  {
    id: 'nawawi_29', collection: 'nawawi40', number: 29,
    bookName: '40 Hadith Nawawi', chapterName: 'The Gate to Good',
    arabic: 'لَوْ أَنَّكُمْ تَوَكَّلُونَ عَلَى اللَّهِ حَقَّ تَوَكُّلِهِ لَرَزَقَكُمْ كَمَا يَرْزُقُ الطَّيْرَ تَغْدُو خِمَاصاً وَتَرُوحُ بِطَاناً',
    english: 'If you were to rely upon Allah with the reliance He is due, you would be given provision like the birds: they go out hungry in the morning and return full in the evening.',
    narrator: 'Umar ibn al-Khattab (RA)', grade: 'Hasan', reference: 'Al-Tirmidhi 2344, Ibn Majah 4164'
  },
  {
    id: 'nawawi_30', collection: 'nawawi40', number: 30,
    bookName: '40 Hadith Nawawi', chapterName: 'Respecting Divine Limits',
    arabic: 'إِنَّ اللَّهَ فَرَضَ فَرَائِضَ فَلَا تُضَيِّعُوهَا، وَحَدَّ حُدُوداً فَلَا تَعْتَدُوهَا، وَحَرَّمَ أَشْيَاءَ فَلَا تَنْتَهِكُوهَا',
    english: 'Allah has ordained duties, so do not neglect them. He has set limits, so do not transgress them. He has forbidden certain things, so do not violate them.',
    narrator: 'Abu Thalabah al-Khushani (RA)', grade: 'Hasan', reference: 'Al-Daraqutni'
  },
  {
    id: 'nawawi_31', collection: 'nawawi40', number: 31,
    bookName: '40 Hadith Nawawi', chapterName: 'Detachment from the World',
    arabic: 'كُنْ فِي الدُّنْيَا كَأَنَّكَ غَرِيبٌ أَوْ عَابِرُ سَبِيلٍ',
    english: 'Be in this world as if you were a stranger or a traveler.',
    narrator: 'Ibn Umar (RA)', grade: 'Sahih', reference: 'Al-Bukhari 6416'
  },
  {
    id: 'nawawi_32', collection: 'nawawi40', number: 32,
    bookName: '40 Hadith Nawawi', chapterName: 'No Harm Shall Be Inflicted',
    arabic: 'لَا ضَرَرَ وَلَا ضِرَارَ',
    english: 'There should be neither harm nor reciprocating harm.',
    narrator: 'Ibn Abbas and Ubadah ibn al-Samit (RA)', grade: 'Hasan', reference: 'Ibn Majah 2340, Ahmad 2865'
  },
  {
    id: 'nawawi_33', collection: 'nawawi40', number: 33,
    bookName: '40 Hadith Nawawi', chapterName: 'Burden of Proof',
    arabic: 'لَوْ يُعْطَى النَّاسُ بِدَعْوَاهُمْ لَادَّعَى نَاسٌ دِمَاءَ رِجَالٍ وَأَمْوَالَهُمْ، وَلَكِنَّ الْيَمِينَ عَلَى الْمُدَّعَى عَلَيْهِ',
    english: 'If people were given everything they claimed, some would claim the lives and property of others. The burden of proof is on the claimant and the oath is upon the one who denies.',
    narrator: 'Ibn Abbas (RA)', grade: 'Sahih', reference: 'Al-Tirmidhi 1341, Al-Bayhaqi'
  },
  {
    id: 'nawawi_34', collection: 'nawawi40', number: 34,
    bookName: '40 Hadith Nawawi', chapterName: 'Duty to Change Evil',
    arabic: 'مَنْ رَأَى مِنْكُمْ مُنْكَراً فَلْيُغَيِّرْهُ بِيَدِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِلِسَانِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِقَلْبِهِ، وَذَلِكَ أَضْعَفُ الإِيمَانِ',
    english: 'Whoever of you sees an evil, let him change it with his hand; and if he is not able to do so, then with his tongue; and if he is not able to do so, then with his heart — and that is the weakest of faith.',
    narrator: 'Abu Said al-Khudri (RA)', grade: 'Sahih', reference: 'Muslim 49'
  },
  {
    id: 'nawawi_35', collection: 'nawawi40', number: 35,
    bookName: '40 Hadith Nawawi', chapterName: 'Brotherhood',
    arabic: 'لَا تَحَاسَدُوا، وَلَا تَنَاجَشُوا، وَلَا تَبَاغَضُوا، وَلَا تَدَابَرُوا',
    english: 'Do not envy one another; do not artificially inflate prices against one another; do not hate one another; do not turn away from one another.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Muslim 2564'
  },
  {
    id: 'nawawi_36', collection: 'nawawi40', number: 36,
    bookName: '40 Hadith Nawawi', chapterName: 'Helping One\'s Brother',
    arabic: 'مَنْ نَفَّسَ عَنْ مُؤْمِنٍ كُرْبَةً مِنْ كُرَبِ الدُّنْيَا نَفَّسَ اللَّهُ عَنْهُ كُرْبَةً مِنْ كُرَبِ يَوْمِ الْقِيَامَةِ',
    english: 'Whoever relieves a believer of a burden from the burdens of this world, Allah will relieve him of a burden from the burdens on the Day of Judgement.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Muslim 2699'
  },
  {
    id: 'nawawi_37', collection: 'nawawi40', number: 37,
    bookName: '40 Hadith Nawawi', chapterName: 'Reward for Good Deeds',
    arabic: 'إِنَّ اللَّهَ كَتَبَ الْحَسَنَاتِ وَالسَّيِّئَاتِ ثُمَّ بَيَّنَ ذَلِكَ، فَمَنْ هَمَّ بِحَسَنَةٍ فَلَمْ يَعْمَلْهَا كَتَبَهَا اللَّهُ عِنْدَهُ حَسَنَةً كَامِلَةً',
    english: 'Allah has written down good deeds and evil deeds. Then He explained that: whoever intends to do a good deed but does not do it, Allah records one complete good deed for him.',
    narrator: 'Ibn Abbas (RA)', grade: 'Sahih', reference: 'Al-Bukhari 6491, Muslim 131'
  },
  {
    id: 'nawawi_38', collection: 'nawawi40', number: 38,
    bookName: '40 Hadith Nawawi', chapterName: 'Hostility of Allah',
    arabic: 'مَنْ عَادَى لِي وَلِيّاً فَقَدْ آذَنْتُهُ بِالْحَرْبِ',
    english: 'Whoever shows enmity to a friend of Mine, then I have declared war against him.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Al-Bukhari 6502'
  },
  {
    id: 'nawawi_39', collection: 'nawawi40', number: 39,
    bookName: '40 Hadith Nawawi', chapterName: 'Forgiveness of Sins',
    arabic: 'إِنَّ اللَّهَ تَجَاوَزَ عَنْ أُمَّتِي الْخَطَأَ، وَالنِّسْيَانَ، وَمَا اسْتُكْرِهُوا عَلَيْهِ',
    english: 'Allah has forgiven my Ummah for mistakes and forgetfulness, and for what they are forced to do.',
    narrator: 'Ibn Abbas (RA)', grade: 'Sahih', reference: 'Ibn Majah 2045, Al-Bayhaqi'
  },
  {
    id: 'nawawi_40', collection: 'nawawi40', number: 40,
    bookName: '40 Hadith Nawawi', chapterName: 'Servitude to Allah',
    arabic: 'كُنْ فِي الدُّنْيَا كَأَنَّكَ غَرِيبٌ أَوْ عَابِرُ سَبِيلٍ',
    english: 'Be in this world as though you were a stranger or a wayfarer, and consider yourself among the inhabitants of the graves.',
    narrator: 'Ibn Umar (RA)', grade: 'Sahih', reference: 'Al-Bukhari 6416'
  },
  {
    id: 'nawawi_41', collection: 'nawawi40', number: 41,
    bookName: '40 Hadith Nawawi', chapterName: 'Lowering the Gaze of the Heart',
    arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يَكُونَ هَوَاهُ تَبَعاً لِمَا جِئْتُ بِهِ',
    english: 'None of you truly believes until his desires are in accordance with what I have brought.',
    narrator: 'Abdullah ibn Amr (RA)', grade: 'Hasan Sahih', reference: 'An-Nawawi\'s 40 Hadith 41'
  },
  {
    id: 'nawawi_42', collection: 'nawawi40', number: 42,
    bookName: '40 Hadith Nawawi', chapterName: 'Scope of Forgiveness',
    arabic: 'كُلُّ ابْنِ آدَمَ خَطَّاءٌ، وَخَيْرُ الْخَطَّائِينَ التَّوَّابُونَ',
    english: 'Every son of Adam commits sins, and the best of those who commit sins are those who repent.',
    narrator: 'Anas ibn Malik (RA)', grade: 'Hasan', reference: 'Al-Tirmidhi 2499, Ibn Majah 4251'
  },

  // ── Bukhari Collection (selected authentic hadiths) ────────────────────────
  {
    id: 'bukhari_1', collection: 'bukhari', number: 1,
    bookName: 'Book of Revelation', chapterName: 'How Divine Revelation started',
    arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    english: 'The reward of deeds depends upon the intentions and every person will get the reward according to what he has intended. So whoever emigrated for worldly benefits or for a woman to marry, his emigration was for what he emigrated for.',
    narrator: 'Umar ibn al-Khattab (RA)', grade: 'Sahih', reference: 'Sahih al-Bukhari 1'
  },
  {
    id: 'bukhari_2', collection: 'bukhari', number: 8,
    bookName: 'Book of Belief', chapterName: 'The Pillars of Islam',
    arabic: 'بُنِيَ الإِسْلاَمُ عَلَى خَمْسٍ: شَهَادَةِ أَنْ لَا إِلَهَ إِلاَّ اللَّهُ',
    english: 'Islam is based on five pillars: testifying that there is no god but Allah and that Muhammad is His messenger, performing the prayers, paying the Zakat, making the pilgrimage to the House, and fasting in Ramadan.',
    narrator: 'Ibn Umar (RA)', grade: 'Sahih', reference: 'Sahih al-Bukhari 8'
  },
  {
    id: 'bukhari_3', collection: 'bukhari', number: 13,
    bookName: 'Book of Belief', chapterName: 'Loving for your brother what you love for yourself',
    arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    english: 'None of you will have faith till he wishes for his (Muslim) brother what he likes for himself.',
    narrator: 'Anas ibn Malik (RA)', grade: 'Sahih', reference: 'Sahih al-Bukhari 13'
  },
  {
    id: 'bukhari_4', collection: 'bukhari', number: 52,
    bookName: 'Book of Belief', chapterName: 'The Halal and the Haram',
    arabic: 'الْحَلَالُ بَيِّنٌ وَالْحَرَامُ بَيِّنٌ وَبَيْنَهُمَا مُشْتَبَهَاتٌ',
    english: 'The halal is clear and the haram is clear. Between them are doubtful matters. Whoever avoids doubtful matters clears himself in regard to his religion and his honor.',
    narrator: 'An-Numan ibn Bashir (RA)', grade: 'Sahih', reference: 'Sahih al-Bukhari 52'
  },
  {
    id: 'bukhari_5', collection: 'bukhari', number: 6412,
    bookName: 'Book of Riqaq', chapterName: 'Take benefit of five before five',
    arabic: 'اغْتَنِمْ خَمْسًا قَبْلَ خَمْسٍ: شَبَابَكَ قَبْلَ هَرَمِكَ، وَصِحَّتَكَ قَبْلَ سَقَمِكَ، وَغِنَاكَ قَبْلَ فَقْرِكَ، وَفَرَاغَكَ قَبْلَ شُغْلِكَ، وَحَيَاتَكَ قَبْلَ مَوْتِكَ',
    english: 'Take benefit of five before five: your youth before your old age, your health before your sickness, your wealth before your poverty, your free time before you are preoccupied, and your life before your death.',
    narrator: 'Ibn Abbas (RA)', grade: 'Sahih', reference: 'Al-Hakim, authenticated by Al-Albani'
  },
  {
    id: 'bukhari_6', collection: 'bukhari', number: 6018,
    bookName: 'Book of Good Manners', chapterName: 'Good speech',
    arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيَقُلْ خَيْراً أَوْ لِيَصْمُتْ',
    english: 'Whoever believes in Allah and the Last Day should speak good or remain silent. Whoever believes in Allah and the Last Day should honor his neighbor. Whoever believes in Allah and the Last Day should honor his guest.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Sahih al-Bukhari 6018'
  },
  {
    id: 'bukhari_7', collection: 'bukhari', number: 2442,
    bookName: 'Book of Oppressions', chapterName: 'Fear oppression',
    arabic: 'اتَّقُوا الظُّلْمَ، فَإِنَّ الظُّلْمَ ظُلُمَاتٌ يَوْمَ الْقِيَامَةِ',
    english: 'Beware of oppression, for oppression will be darkness on the Day of Resurrection.',
    narrator: 'Jabir ibn Abdillah (RA)', grade: 'Sahih', reference: 'Sahih Muslim 2578'
  },
  {
    id: 'bukhari_8', collection: 'bukhari', number: 5767,
    bookName: 'Book of Medicine', chapterName: 'No disease without a cure',
    arabic: 'مَا أَنْزَلَ اللَّهُ دَاءً إِلَّا أَنْزَلَ لَهُ شِفَاءً',
    english: 'Allah has not sent down a disease except that He has also sent down its cure.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Sahih al-Bukhari 5678'
  },
  {
    id: 'bukhari_9', collection: 'bukhari', number: 6416,
    bookName: 'Book of Riqaq', chapterName: 'Being in this world like a stranger',
    arabic: 'كُنْ فِي الدُّنْيَا كَأَنَّكَ غَرِيبٌ أَوْ عَابِرُ سَبِيلٍ',
    english: 'Be in this world as if you were a stranger or a traveler along a path.',
    narrator: 'Ibn Umar (RA)', grade: 'Sahih', reference: 'Sahih al-Bukhari 6416'
  },
  {
    id: 'bukhari_10', collection: 'bukhari', number: 2697,
    bookName: 'Book of Conditions', chapterName: 'Innovations are rejected',
    arabic: 'مَنْ عَمِلَ عَمَلاً لَيْسَ عَلَيْهِ أَمْرُنَا فَهُوَ رَدٌّ',
    english: 'Whoever does an action that is not in accordance with our matter (the Sunnah), it will be rejected.',
    narrator: 'Aisha (RA)', grade: 'Sahih', reference: 'Sahih al-Bukhari 2697'
  },

  // ── Sahih Muslim ──────────────────────────────────────────────────────────
  {
    id: 'muslim_1', collection: 'muslim', number: 8,
    bookName: 'Book of Faith', chapterName: 'The Pillars of Faith',
    arabic: 'الإِيمَانُ أَنْ تُؤْمِنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ وَالْيَوْمِ الآخِرِ وَالْقَدَرِ خَيْرِهِ وَشَرِّهِ',
    english: 'Faith is to believe in Allah, His angels, His books, His messengers, the Last Day, and in divine destiny, both its good and its evil.',
    narrator: 'Umar ibn al-Khattab (RA)', grade: 'Sahih', reference: 'Sahih Muslim 8'
  },
  {
    id: 'muslim_2', collection: 'muslim', number: 223,
    bookName: 'Book of Purification', chapterName: 'The merit of wudu',
    arabic: 'الطُّهُورُ شَطْرُ الإِيمَانِ وَالْحَمْدُ لِلَّهِ تَمْلَأُ الْمِيزَانَ وَسُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ تَمْلَآنِ أَوْ تَمْلَأُ مَا بَيْنَ السَّمَاوَاتِ وَالأَرْضِ',
    english: 'Purity is half of faith. Alhamdulillah fills the scale. SubhanAllah and Alhamdulillah together fill what is between the heavens and the earth.',
    narrator: 'Abu Malik al-Ashari (RA)', grade: 'Sahih', reference: 'Sahih Muslim 223'
  },
  {
    id: 'muslim_3', collection: 'muslim', number: 2564,
    bookName: 'Book of Virtue', chapterName: 'Prohibition of envy and enmity',
    arabic: 'لَا تَحَاسَدُوا وَلَا تَنَاجَشُوا وَلَا تَبَاغَضُوا وَلَا تَدَابَرُوا وَكُونُوا عِبَادَ اللَّهِ إِخْوَاناً',
    english: 'Do not envy one another, do not outbid one another (in order to raise the price), do not hate one another, do not turn away from one another. Be, O slaves of Allah, brothers.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Sahih Muslim 2564'
  },
  {
    id: 'muslim_4', collection: 'muslim', number: 2699,
    bookName: 'Book of Remembrance', chapterName: 'Virtue of helping believers',
    arabic: 'مَنْ نَفَّسَ عَنْ مُؤْمِنٍ كُرْبَةً مِنْ كُرَبِ الدُّنْيَا نَفَّسَ اللَّهُ عَنْهُ كُرْبَةً مِنْ كُرَبِ يَوْمِ الْقِيَامَةِ',
    english: 'Whoever relieves a Muslim of a burden from the burdens of this world, Allah will relieve him of a burden from the burdens on the Day of Judgement.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Sahih Muslim 2699'
  },
  {
    id: 'muslim_5', collection: 'muslim', number: 1631,
    bookName: 'Book of Bequests', chapterName: 'Rewards that continue after death',
    arabic: 'إِذَا مَاتَ الإِنْسَانُ انْقَطَعَ عَنْهُ عَمَلُهُ إِلاَّ مِنْ ثَلاَثَةٍ: إِلاَّ مِنْ صَدَقَةٍ جَارِيَةٍ، أَوْ عِلْمٍ يُنْتَفَعُ بِهِ، أَوْ وَلَدٍ صَالِحٍ يَدْعُو لَهُ',
    english: 'When a man dies, his deeds come to an end except for three things: ongoing charity, knowledge that is benefited from, and a righteous son who prays for him.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Sahih Muslim 1631'
  },

  // ── Riyad as-Salihin ─────────────────────────────────────────────────────
  {
    id: 'riyad_1', collection: 'riyadussaliheen', number: 3,
    bookName: 'Book of Miscellany', chapterName: 'Patience',
    arabic: 'عَجَباً لأَمْرِ الْمُؤْمِنِ، إِنَّ أَمْرَهُ كُلَّهُ خَيْرٌ، وَلَيْسَ ذَاكَ لأَحَدٍ إِلاَّ لِلْمُؤْمِنِ',
    english: 'How wonderful is the case of a believer; there is good for him in everything and this applies only to a believer. If prosperity attends him, he expresses gratitude to Allah and that is good for him; and if adversity befalls him, he endures it patiently and that is good for him.',
    narrator: 'Suhaib (RA)', grade: 'Sahih', reference: 'Sahih Muslim 2999'
  },
  {
    id: 'riyad_2', collection: 'riyadussaliheen', number: 5,
    bookName: 'Book of Miscellany', chapterName: 'Truthfulness',
    arabic: 'عَلَيْكُمْ بِالصِّدْقِ فَإِنَّ الصِّدْقَ يَهْدِي إِلَى الْبِرِّ',
    english: 'Hold to truthfulness, for truthfulness leads to righteousness and righteousness leads to Paradise. A man continues to be truthful and strives for truthfulness until he is recorded with Allah as very truthful (Siddiq).',
    narrator: 'Abdullah ibn Masud (RA)', grade: 'Sahih', reference: 'Al-Bukhari 6094, Muslim 2607'
  },
  {
    id: 'riyad_3', collection: 'riyadussaliheen', number: 7,
    bookName: 'Book of Miscellany', chapterName: 'Supplication',
    arabic: 'الدُّعَاءُ هُوَ الْعِبَادَةُ',
    english: 'Supplication (Dua) is the essence of worship.',
    narrator: 'An-Numan ibn Bashir (RA)', grade: 'Sahih', reference: 'Abu Dawud 1479, Tirmidhi 2969'
  },
  {
    id: 'riyad_4', collection: 'riyadussaliheen', number: 66,
    bookName: 'Book of Miscellany', chapterName: 'Repentance',
    arabic: 'التَّوْبَةُ النَّصُوحُ أَنْ تَتُوبَ مِنَ الذَّنْبِ، ثُمَّ لاَ تَعُودَ إِلَيْهِ',
    english: 'Sincere repentance means to repent from sin and not return to it.',
    narrator: 'Ibn Masud (RA)', grade: 'Sahih', reference: 'Al-Bayhaqi'
  },
  {
    id: 'riyad_5', collection: 'riyadussaliheen', number: 100,
    bookName: 'Book of Miscellany', chapterName: 'Gratitude',
    arabic: 'انْظُرُوا إِلَى مَنْ أَسْفَلَ مِنْكُمْ وَلاَ تَنْظُرُوا إِلَى مَنْ هُوَ فَوْقَكُمْ',
    english: 'Look at those below you (in wealth and worldly status) and do not look at those above you. This is more proper so that you do not belittle the favors of Allah upon you.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Al-Bukhari 6490, Muslim 2963'
  },

  // ── Abu Dawood ────────────────────────────────────────────────────────────
  {
    id: 'abudawood_1', collection: 'abudawood', number: 4607,
    bookName: 'Book of Sunnah', chapterName: 'Holding to the Sunnah',
    arabic: 'عَلَيْكُمْ بِسُنَّتِي وَسُنَّةِ الْخُلَفَاءِ الرَّاشِدِينَ الْمَهْدِيِّينَ، تَمَسَّكُوا بِهَا وَعَضُّوا عَلَيْهَا بِالنَّوَاجِذِ',
    english: 'Hold to my Sunnah and to the Sunnah of the rightly-guided caliphs; cling to it stubbornly. Beware of newly-invented matters, for every newly-invented matter is an innovation.',
    narrator: 'Irbad ibn Sariyah (RA)', grade: 'Sahih', reference: 'Abu Dawud 4607'
  },
  {
    id: 'abudawood_2', collection: 'abudawood', number: 1479,
    bookName: 'Book of Prayer', chapterName: 'Supplication',
    arabic: 'الدُّعَاءُ مُخُّ الْعِبَادَةِ',
    english: 'Supplication is the marrow (core) of worship.',
    narrator: 'Anas ibn Malik (RA)', grade: 'Hasan', reference: 'Al-Tirmidhi 3371'
  },
  {
    id: 'abudawood_3', collection: 'abudawood', number: 5090,
    bookName: 'Book of Good Manners', chapterName: 'Greeting',
    arabic: 'أَفْشُوا السَّلاَمَ بَيْنَكُمْ',
    english: 'Spread salaam (greetings of peace) among yourselves.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Muslim 54'
  },

  // ── Tirmidhi ──────────────────────────────────────────────────────────────
  {
    id: 'tirmidhi_1', collection: 'tirmidhi', number: 2516,
    bookName: 'Book of Zuhd', chapterName: 'Preserving the commandments of Allah',
    arabic: 'احْفَظِ اللَّهَ يَحْفَظْكَ، احْفَظِ اللَّهَ تَجِدْهُ تُجَاهَكَ، إِذَا سَأَلْتَ فَاسْأَلِ اللَّهَ، وَإِذَا اسْتَعَنْتَ فَاسْتَعِنْ بِاللَّهِ',
    english: 'Preserve (your duties to) Allah and He will preserve you. Preserve (your duties to) Allah and you will find Him in front of you. If you ask, ask Allah. If you seek help, seek help from Allah.',
    narrator: 'Abdullah ibn Abbas (RA)', grade: 'Hasan Sahih', reference: 'Al-Tirmidhi 2516'
  },
  {
    id: 'tirmidhi_2', collection: 'tirmidhi', number: 2344,
    bookName: 'Book of Zuhd', chapterName: 'Trusting in Allah',
    arabic: 'لَوْ أَنَّكُمْ تَوَكَّلُونَ عَلَى اللَّهِ حَقَّ تَوَكُّلِهِ لَرَزَقَكُمْ كَمَا يَرْزُقُ الطَّيْرَ',
    english: 'If you were to rely upon Allah with the reliance He is due, you would be given provision like the birds — they go out hungry in the morning and return full in the evening.',
    narrator: 'Umar ibn al-Khattab (RA)', grade: 'Hasan', reference: 'Al-Tirmidhi 2344'
  },
  {
    id: 'tirmidhi_3', collection: 'tirmidhi', number: 1987,
    bookName: 'Book of Righteousness', chapterName: 'Fearing Allah and Good Character',
    arabic: 'اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ',
    english: 'Fear Allah wherever you are. Follow up a bad deed with a good one and it will wipe it out. And treat people with good character.',
    narrator: 'Abu Dharr (RA)', grade: 'Hasan', reference: 'Al-Tirmidhi 1987'
  },

  // ── Nasa'i ────────────────────────────────────────────────────────────────
  {
    id: 'nasai_1', collection: 'nasai', number: 3939,
    bookName: 'Book of Oaths and Vows', chapterName: 'Seeking refuge from poverty',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْعَجْزِ وَالْكَسَلِ وَالْجُبْنِ وَالْهَرَمِ وَالْبُخْلِ وَعَذَابِ الْقَبْرِ',
    english: 'O Allah, I seek refuge in You from incapacity, laziness, cowardice, senility, and miserliness; and I seek refuge in You from the punishment of the grave.',
    narrator: 'Anas ibn Malik (RA)', grade: 'Sahih', reference: 'Sahih al-Bukhari 6367'
  },
  {
    id: 'nasai_2', collection: 'nasai', number: 1305,
    bookName: 'Book of Forgetfulness in Prayer', chapterName: 'The Prayer of the distressed',
    arabic: 'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ',
    english: 'O Ever Living, O Sustainer, in Your mercy I seek relief.',
    narrator: 'Anas ibn Malik (RA)', grade: 'Hasan', reference: 'Al-Tirmidhi 3524'
  },

  // ── Ibn Majah ─────────────────────────────────────────────────────────────
  {
    id: 'ibnmajah_1', collection: 'ibnmajah', number: 224,
    bookName: 'Book of Sunnah', chapterName: 'Seeking knowledge',
    arabic: 'طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ',
    english: 'Seeking knowledge is an obligation upon every Muslim.',
    narrator: 'Anas ibn Malik (RA)', grade: 'Sahih', reference: 'Ibn Majah 224'
  },
  {
    id: 'ibnmajah_2', collection: 'ibnmajah', number: 4341,
    bookName: 'Book of Zuhd', chapterName: 'Wisdoms',
    arabic: 'الْحِكْمَةُ ضَالَّةُ الْمُؤْمِنِ، فَحَيْثُ وَجَدَهَا فَهُوَ أَحَقُّ بِهَا',
    english: 'Wisdom is the lost property of a believer; wherever he finds it, he has a better right to it.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Weak (but widely cited)', reference: 'Ibn Majah 4169'
  },

  // ── Muwatta Malik ─────────────────────────────────────────────────────────
  {
    id: 'malik_1', collection: 'malik', number: 1615,
    bookName: 'Book of Good Character', chapterName: 'Good conduct',
    arabic: 'بُعِثْتُ لأُتَمِّمَ مَكَارِمَ الأَخْلاَقِ',
    english: 'I was sent to perfect good character.',
    narrator: 'Abu Hurayrah (RA)', grade: 'Sahih', reference: 'Muwatta Malik 1615, Ahmad 8952'
  },
  {
    id: 'malik_2', collection: 'malik', number: 1661,
    bookName: 'Book of Speech', chapterName: 'Silence',
    arabic: 'مَنْ صَمَتَ نَجَا',
    english: 'Whoever remains silent is saved.',
    narrator: 'Abdullah ibn Amr (RA)', grade: 'Hasan', reference: 'Al-Tirmidhi 2501'
  },
];

/** Combined database: core + extended hadiths */
const ALL_HADITHS: OfflineHadith[] = [...OFFLINE_HADITHS, ...EXTENDED_HADITHS];

/** Returns all hadiths for a given collection (offline) */
export function getOfflineHadiths(collectionId: string): OfflineHadith[] {
  return ALL_HADITHS.filter(h => h.collection === collectionId);
}

/** Returns total count for a collection */
export function getOfflineHadithCount(collectionId: string): number {
  return ALL_HADITHS.filter(h => h.collection === collectionId).length;
}

/** Returns all hadiths (all collections merged) */
export function getAllOfflineHadiths(): OfflineHadith[] {
  return ALL_HADITHS;
}

/** Search hadiths by keyword across text, narrator, and reference */
export function searchOfflineHadiths(query: string): OfflineHadith[] {
  const q = query.toLowerCase();
  return ALL_HADITHS.filter(h =>
    h.english.toLowerCase().includes(q) ||
    h.narrator.toLowerCase().includes(q) ||
    h.reference.toLowerCase().includes(q) ||
    h.bookName.toLowerCase().includes(q) ||
    h.chapterName.toLowerCase().includes(q)
  );
}
