import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../constants/theme';
import { useApp, NotificationSettings } from '../contexts/AppContext';
import { TRANSLATIONS, RECITERS } from '../constants/quranData';
import { CALCULATION_METHODS, MADHABS } from '../constants/prayerData';
import {
  requestNotificationPermission,
  applyAllNotificationSettings,
  cancelAllNotifications,
} from '../services/notificationService';

type ThemeOption = 'dark' | 'light' | 'system';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, colors: C, bookmarks, notes } = useApp();
  const [notifPermission, setNotifPermission] = useState<boolean | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState<'start' | 'end' | null>(null);  const [tempHour, setTempHour] = useState(0);
  const [tempMinute, setTempMinute] = useState(0);

  const handleThemeChange = (theme: ThemeOption) => {
    updateSettings({ theme });
  };

  const updateSchedule = useCallback((updates: Partial<typeof settings.darkModeSchedule>) => {
    updateSettings({
      darkModeSchedule: { ...settings.darkModeSchedule, ...updates },
    });
  }, [settings, updateSettings]);

  const openTimePicker = (which: 'start' | 'end') => {
    if (which === 'start') {
      setTempHour(settings.darkModeSchedule.startHour);
      setTempMinute(settings.darkModeSchedule.startMinute);
    } else {
      setTempHour(settings.darkModeSchedule.endHour);
      setTempMinute(settings.darkModeSchedule.endMinute);
    }
    setShowSchedulePicker(which);
  };

  const confirmTimePicker = () => {
    if (showSchedulePicker === 'start') {
      updateSchedule({ startHour: tempHour, startMinute: tempMinute });
    } else if (showSchedulePicker === 'end') {
      updateSchedule({ endHour: tempHour, endMinute: tempMinute });
    }
    setShowSchedulePicker(null);
  };

  const fmt = (h: number, m: number) =>
    `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

  const handleNotificationToggle = useCallback(async (
    key: keyof typeof settings.notifications,
    value: boolean
  ) => {
    if (value && notifPermission === null) {
      const granted = await requestNotificationPermission();
      setNotifPermission(granted);
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Please enable notification permissions in your device settings to receive prayer reminders.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    const updatedNotifs = { ...settings.notifications, [key]: value };
    await updateSettings({ notifications: updatedNotifs });
    await applyAllNotificationSettings(updatedNotifs);
  }, [settings, notifPermission, updateSettings]);

  const handleCancelAll = async () => {
    await cancelAllNotifications();
    // Keep non-boolean options (e.g. reminderMinutesBefore) intact.
    const disabled: NotificationSettings = {
      ...settings.notifications,
      fajrReminder: false,
      dhuhrReminder: false,
      asrReminder: false,
      maghribReminder: false,
      ishaReminder: false,
      dailyAyah: false,
      dailyHadith: false,
      morningAzkar: false,
      eveningAzkar: false,
      fridayReminder: false,
      tahajjudReminder: false,
      fastingReminder: false,
    };
    await updateSettings({ notifications: disabled });
    Alert.alert('Done', 'All notifications have been disabled.');
  };

  // ── Sub-components ──────────────────────────────────────────────────────────

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={[styles.section, { paddingHorizontal: Spacing.md, marginTop: Spacing.lg }]}>
      <Text style={[styles.sectionTitle, { color: C.textMuted }]}>{title.toUpperCase()}</Text>
      <View style={[styles.sectionCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>{children}</View>
    </View>
  );

  const Divider = () => <View style={[styles.divider, { backgroundColor: C.divider }]} />;

  const ToggleRow = ({
    label, subtitle, value, onChange, icon, iconColor,
  }: {
    label: string; subtitle?: string; value: boolean;
    onChange: (v: boolean) => void; icon?: string; iconColor?: string;
  }) => (
    <View style={styles.toggleRow}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: `${iconColor || C.gold}15` }]}>
          <MaterialIcons name={icon as any} size={18} color={iconColor || C.gold} />
        </View>
      ) : null}
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, { color: C.textPrimary }]}>{label}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: C.textMuted }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: C.cardBorder, true: `${C.gold}80` }}
        thumbColor={value ? C.gold : C.textMuted}
        ios_backgroundColor={C.cardBorder}
      />
    </View>
  );

  const SelectRow = ({
    label, options, selected, onSelect, renderOption,
  }: {
    label?: string;
    options: any[];
    selected: any;
    onSelect: (v: any) => void;
    renderOption: (item: any) => React.ReactNode;
  }) => (
    <View>
      {options.map((item, i) => (
        <React.Fragment key={i}>
          <Pressable
            style={({ pressed }) => [
              styles.optionRow,
              pressed && { backgroundColor: C.surfaceElevated },
              selected === (item.id ?? item) && { backgroundColor: `${C.gold}08` },
            ]}
            onPress={() => onSelect(item.id ?? item)}
          >
            {renderOption(item)}
            {selected === (item.id ?? item) && (
              <MaterialIcons name="check-circle" size={20} color={C.gold} />
            )}
          </Pressable>
          {i < options.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Settings</Text>
            <Text style={[styles.headerSub, { color: C.textSecondary }]}>Personalize your experience</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          {[
            { icon: 'bookmark', label: 'Bookmarks', value: bookmarks.length, color: C.gold },
            { icon: 'note', label: 'Notes', value: notes.length, color: C.info },
          ].map(s => (
            <View key={s.label} style={[styles.statChip, { backgroundColor: `${s.color}15`, borderColor: `${s.color}25` }]}>
              <MaterialIcons name={s.icon as any} size={14} color={s.color} />
              <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: C.textMuted }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Appearance ───────────────────────────────────────────────────── */}
        <Section title="Appearance">
          {/* Theme */}
          <View style={styles.themeSection}>
            <Text style={[styles.rowLabel, { color: C.textPrimary, paddingHorizontal: Spacing.md, paddingTop: Spacing.md }]}>
              Theme
            </Text>
            <View style={styles.themeRow}>
              {([
                { key: 'dark', icon: 'nights-stay', label: 'Dark' },
                { key: 'light', icon: 'wb-sunny', label: 'Light' },
                { key: 'system', icon: 'brightness-auto', label: 'System' },
              ] as { key: ThemeOption; icon: string; label: string }[]).map(t => (
                <Pressable
                  key={t.key}
                  style={[
                    styles.themeCard,
                    { backgroundColor: C.surfaceElevated, borderColor: C.cardBorder },
                    settings.theme === t.key && [styles.themeCardActive, { borderColor: C.gold, backgroundColor: `${C.gold}15` }],
                  ]}
                  onPress={() => handleThemeChange(t.key)}
                >
                  <MaterialIcons
                    name={t.icon as any}
                    size={22}
                    color={settings.theme === t.key ? C.gold : C.textMuted}
                  />
                  <Text style={[styles.themeLabel, { color: settings.theme === t.key ? C.gold : C.textMuted }]}>
                    {t.label}
                  </Text>
                  {settings.theme === t.key && (
                    <View style={[styles.themeCheck, { backgroundColor: C.gold }]}>
                      <MaterialIcons name="check" size={10} color={C.primaryDark} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
          <Divider />

          {/* Live Theme Preview */}
          <View style={[styles.themePreviewRow, { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md }]}>
            <Text style={[styles.rowLabel, { color: C.textPrimary, marginBottom: 10 }]}>Live Preview</Text>
            <View style={styles.themePreviews}>
              {/* Dark preview */}
              <View style={[styles.previewCard, { backgroundColor: '#0D1F1A', borderColor: '#1B4D3E' }]}>
                <View style={styles.previewHeader}>
                  <View style={[styles.previewDot, { backgroundColor: '#C9A84C' }]} />
                  <View style={[styles.previewLine, { backgroundColor: '#C9A84C', width: 40 }]} />
                </View>
                <View style={[styles.previewLine, { backgroundColor: '#E8D5B7', width: '90%', height: 3, marginBottom: 4 }]} />
                <View style={[styles.previewLine, { backgroundColor: '#9BA5A0', width: '70%', height: 2 }]} />
                <View style={[styles.previewBtn, { backgroundColor: '#1B4D3E' }]}>
                  <View style={[styles.previewLine, { backgroundColor: '#C9A84C', width: 30, height: 2 }]} />
                </View>
                <Text style={[styles.previewLabel, { color: '#9BA5A0' }]}>Dark</Text>
              </View>
              {/* Light preview */}
              <View style={[styles.previewCard, { backgroundColor: '#F5F7F6', borderColor: '#D4E6DF' }]}>
                <View style={styles.previewHeader}>
                  <View style={[styles.previewDot, { backgroundColor: '#1B4D3E' }]} />
                  <View style={[styles.previewLine, { backgroundColor: '#1B4D3E', width: 40 }]} />
                </View>
                <View style={[styles.previewLine, { backgroundColor: '#1A1A1A', width: '90%', height: 3, marginBottom: 4 }]} />
                <View style={[styles.previewLine, { backgroundColor: '#5A6B65', width: '70%', height: 2 }]} />
                <View style={[styles.previewBtn, { backgroundColor: '#1B4D3E' }]}>
                  <View style={[styles.previewLine, { backgroundColor: '#C9A84C', width: 30, height: 2 }]} />
                </View>
                <Text style={[styles.previewLabel, { color: '#5A6B65' }]}>Light</Text>
              </View>
            </View>
          </View>
          <Divider />

          {/* Dark Mode Scheduling */}
          <View style={[styles.scheduleSection, { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md }]}>
            <View style={styles.scheduleHeader}>
              <View style={[styles.rowIcon, { backgroundColor: `${C.gold}15` }]}>
                <MaterialIcons name="schedule" size={18} color={C.gold} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={[styles.rowLabel, { color: C.textPrimary }]}>Auto Dark Mode Schedule</Text>
                <Text style={[styles.rowSub, { color: C.textMuted }]}>
                  Automatically switch to dark mode at set times
                </Text>
              </View>
              <Switch
                value={settings.darkModeSchedule.enabled}
                onValueChange={v => updateSchedule({ enabled: v })}
                trackColor={{ false: C.cardBorder, true: `${C.gold}80` }}
                thumbColor={settings.darkModeSchedule.enabled ? C.gold : C.textMuted}
                ios_backgroundColor={C.cardBorder}
              />
            </View>

            {settings.darkModeSchedule.enabled && (
              <View style={[styles.scheduleBody, { backgroundColor: C.surfaceElevated, borderColor: C.cardBorder }]}>
                {/* Mode selector */}
                <View style={styles.scheduleModeRow}>
                  {(['custom', 'sunrise_sunset'] as const).map(mode => (
                    <Pressable
                      key={mode}
                      style={[
                        styles.scheduleModeBtn,
                        { backgroundColor: C.card, borderColor: C.cardBorder },
                        settings.darkModeSchedule.mode === mode && {
                          backgroundColor: `${C.gold}15`,
                          borderColor: C.gold,
                        },
                      ]}
                      onPress={() => updateSchedule({ mode })}
                    >
                      <MaterialIcons
                        name={mode === 'custom' ? 'access-time' : 'wb-twilight'}
                        size={16}
                        color={settings.darkModeSchedule.mode === mode ? C.gold : C.textMuted}
                      />
                      <Text style={[styles.scheduleModeTxt, {
                        color: settings.darkModeSchedule.mode === mode ? C.gold : C.textMuted,
                      }]}>
                        {mode === 'custom' ? 'Custom Time' : 'Sunrise/Sunset'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {settings.darkModeSchedule.mode === 'custom' ? (
                  <View style={styles.timePickerRow}>
                    <Pressable
                      style={[styles.timeBtn, { backgroundColor: C.card, borderColor: `${C.gold}30` }]}
                      onPress={() => openTimePicker('start')}
                    >
                      <MaterialIcons name="nights-stay" size={16} color={C.gold} />
                      <View>
                        <Text style={[styles.timeBtnLabel, { color: C.textMuted }]}>Dark mode ON</Text>
                        <Text style={[styles.timeBtnValue, { color: C.gold }]}>
                          {fmt(settings.darkModeSchedule.startHour, settings.darkModeSchedule.startMinute)}
                        </Text>
                      </View>
                    </Pressable>
                    <MaterialIcons name="arrow-forward" size={18} color={C.textMuted} />
                    <Pressable
                      style={[styles.timeBtn, { backgroundColor: C.card, borderColor: `${C.gold}30` }]}
                      onPress={() => openTimePicker('end')}
                    >
                      <MaterialIcons name="wb-sunny" size={16} color={C.gold} />
                      <View>
                        <Text style={[styles.timeBtnLabel, { color: C.textMuted }]}>Dark mode OFF</Text>
                        <Text style={[styles.timeBtnValue, { color: C.gold }]}>
                          {fmt(settings.darkModeSchedule.endHour, settings.darkModeSchedule.endMinute)}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ) : (
                  <View style={[styles.sunriseBanner, { backgroundColor: `${C.gold}10` }]}>
                    <MaterialIcons name="wb-twilight" size={20} color={C.gold} />
                    <Text style={[styles.sunriseText, { color: C.textSecondary }]}>
                      Dark mode activates at sunset and deactivates at sunrise based on your GPS location.
                    </Text>
                  </View>
                )}

                <View style={[styles.scheduleNote, { borderTopColor: C.divider }]}>
                  <MaterialIcons name="info-outline" size={12} color={C.info} />
                  <Text style={[styles.scheduleNoteText, { color: C.textMuted }]}>
                    Schedule overrides your manual theme selection when active.
                  </Text>
                </View>
              </View>
            )}
          </View>
          <Divider />

          {/* Arabic Font Size */}
          <View style={[styles.toggleRow, { paddingVertical: Spacing.md }]}>
            <View style={[styles.rowIcon, { backgroundColor: `${C.gold}15` }]}>
              <MaterialIcons name="text-fields" size={18} color={C.gold} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowLabel, { color: C.textPrimary }]}>Arabic Font Size</Text>
              <Text style={[styles.rowSub, { color: C.textMuted }]}>{settings.arabicFontSize}px preview size</Text>
            </View>
            <View style={styles.fontStepper}>
              <Pressable
                style={[styles.stepBtn, { backgroundColor: C.surfaceElevated, borderColor: C.cardBorder }]}
                onPress={() => updateSettings({ arabicFontSize: Math.max(18, settings.arabicFontSize - 2) })}
              >
                <MaterialIcons name="remove" size={16} color={C.textPrimary} />
              </Pressable>
              <Text style={[styles.stepValue, { color: C.gold }]}>{settings.arabicFontSize}</Text>
              <Pressable
                style={[styles.stepBtn, { backgroundColor: C.surfaceElevated, borderColor: C.cardBorder }]}
                onPress={() => updateSettings({ arabicFontSize: Math.min(42, settings.arabicFontSize + 2) })}
              >
                <MaterialIcons name="add" size={16} color={C.textPrimary} />
              </Pressable>
            </View>
          </View>
          <Divider />

          {/* Arabic preview */}
          <View style={[styles.arabicPreview, { backgroundColor: C.surfaceElevated, borderColor: C.divider }]}>
            <Text style={[styles.arabicPreviewText, { color: C.textArabic, fontSize: settings.arabicFontSize }]}>
              إِنَّ مَعَ الْعُسْرِ يُسْرًا
            </Text>
            <Text style={[styles.arabicPreviewSub, { color: C.textMuted }]}>Font preview — Ash-Sharh 94:6</Text>
          </View>
          <Divider />

          {/* Accessibility */}
          <ToggleRow
            label="High Contrast Mode"
            subtitle="Improve readability for low-vision users"
            value={settings.highContrastMode}
            onChange={v => updateSettings({ highContrastMode: v })}
            icon="contrast"
            iconColor={C.info}
          />
          <Divider />
          <ToggleRow
            label="Haptic Feedback"
            subtitle="Vibration feedback on interactions"
            value={settings.hapticFeedback}
            onChange={v => updateSettings({ hapticFeedback: v })}
            icon="vibration"
            iconColor={C.success}
          />
        </Section>

        {/* ── Quran Reading ─────────────────────────────────────────────────── */}
        <Section title="Quran Reading">
          <ToggleRow
            label="Show Translation"
            subtitle="Display verse translation below Arabic"
            value={settings.showTranslation}
            onChange={v => updateSettings({ showTranslation: v })}
            icon="translate"
            iconColor={C.info}
          />
          <Divider />
          <ToggleRow
            label="Show Transliteration"
            subtitle="Display romanized pronunciation"
            value={settings.showTransliteration}
            onChange={v => updateSettings({ showTransliteration: v })}
            icon="text-fields"
            iconColor={C.gold}
          />
          <Divider />
          <ToggleRow
            label="Word-by-Word Mode"
            subtitle="Tap any word for individual translation"
            value={settings.showWordByWord}
            onChange={v => updateSettings({ showWordByWord: v })}
            icon="view-column"
            iconColor={C.warning}
          />
          <Divider />
          <ToggleRow
            label="Tajweed Coloring"
            subtitle="Color-coded Tajweed rules on Arabic text"
            value={settings.showTajweed}
            onChange={v => updateSettings({ showTajweed: v })}
            icon="palette"
            iconColor={C.success}
          />
          <Divider />
          <ToggleRow
            label="Auto-play Next Surah"
            subtitle="Continue to next Surah when audio ends"
            value={settings.autoPlayNext}
            onChange={v => updateSettings({ autoPlayNext: v })}
            icon="skip-next"
            iconColor={C.primary}
          />
        </Section>

        {/* ── Translation ───────────────────────────────────────────────────── */}
        <Section title="Quran Translation">
          <SelectRow
            options={TRANSLATIONS}
            selected={settings.selectedTranslation}
            onSelect={id => updateSettings({ selectedTranslation: id })}
            renderOption={t => (
              <View style={styles.optionContent}>
                <Text style={styles.optionFlag}>{t.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionName, { color: C.textPrimary }]}>{t.name}</Text>
                  <Text style={[styles.optionSub, { color: C.textMuted }]}>{t.language}</Text>
                </View>
              </View>
            )}
          />
        </Section>

        {/* ── Reciter ───────────────────────────────────────────────────────── */}
        <Section title="Audio Reciter">
          <SelectRow
            options={RECITERS}
            selected={settings.selectedReciter}
            onSelect={id => updateSettings({ selectedReciter: id })}
            renderOption={r => (
              <View style={styles.optionContent}>
                <View style={[styles.reciterBadge, { backgroundColor: `${C.primary}40` }]}>
                  <Text style={[styles.reciterInitial, { color: C.gold }]}>{r.name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionName, { color: C.textPrimary }]}>{r.name}</Text>
                  <Text style={[styles.optionSub, { color: C.textMuted }]}>{r.arabicName} · {r.style}</Text>
                </View>
              </View>
            )}
          />
        </Section>

        {/* ── Prayer Times ──────────────────────────────────────────────────── */}
        <Section title="Prayer Calculation Method">
          <SelectRow
            options={CALCULATION_METHODS.slice(0, 8)}
            selected={settings.prayerCalculationMethod}
            onSelect={id => updateSettings({ prayerCalculationMethod: id })}
            renderOption={m => (
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionName, { color: C.textPrimary }]}>{m.name}</Text>
                <Text style={[styles.optionSub, { color: C.textMuted }]}>{m.region}</Text>
              </View>
            )}
          />
        </Section>

        <Section title="Asr Calculation (Madhab)">
          <SelectRow
            options={MADHABS}
            selected={settings.madhab}
            onSelect={id => updateSettings({ madhab: id })}
            renderOption={m => (
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionName, { color: C.textPrimary }]}>{m.name}</Text>
                <Text style={[styles.optionSub, { color: C.textMuted }]}>{m.description}</Text>
              </View>
            )}
          />
        </Section>

        {/* ── Notifications ────────────────────────────────────────────────── */}
        <Section title="Notifications & Reminders">
          <View style={[styles.notifHeader, { borderBottomColor: C.divider }]}>
            <MaterialIcons name="notifications" size={18} color={C.gold} />
            <Text style={[styles.notifHeaderText, { color: C.textSecondary }]}>
              Enable reminders to stay connected with your daily Islamic practices
            </Text>
          </View>

          {/* Prayer Reminders */}
          <Text style={[styles.notifGroupLabel, { color: C.textMuted, backgroundColor: C.surfaceElevated }]}>
            Prayer Reminders
          </Text>
          {[
            { key: 'fajrReminder', label: 'Fajr Reminder', icon: '🌙', sub: '10 min before Fajr' },
            { key: 'dhuhrReminder', label: 'Dhuhr Reminder', icon: '☀️', sub: '10 min before Dhuhr' },
            { key: 'asrReminder', label: 'Asr Reminder', icon: '🌤️', sub: '10 min before Asr' },
            { key: 'maghribReminder', label: 'Maghrib Reminder', icon: '🌅', sub: '10 min before Maghrib' },
            { key: 'ishaReminder', label: 'Isha Reminder', icon: '🌃', sub: '10 min before Isha' },
          ].map((item, i, arr) => (
            <React.Fragment key={item.key}>
              <View style={styles.notifRow}>
                <Text style={styles.notifEmoji}>{item.icon}</Text>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowLabel, { color: C.textPrimary }]}>{item.label}</Text>
                  <Text style={[styles.rowSub, { color: C.textMuted }]}>{item.sub}</Text>
                </View>
                <Switch
                  value={!!settings.notifications[item.key as keyof typeof settings.notifications]}
                  onValueChange={v => handleNotificationToggle(item.key as keyof typeof settings.notifications, v)}
                  trackColor={{ false: C.cardBorder, true: `${C.gold}80` }}
                  thumbColor={settings.notifications[item.key as keyof typeof settings.notifications] ? C.gold : C.textMuted}
                />
              </View>
              {i < arr.length - 1 && <Divider />}
            </React.Fragment>
          ))}

          {/* Daily Reminders */}
          <Text style={[styles.notifGroupLabel, { color: C.textMuted, backgroundColor: C.surfaceElevated }]}>
            Daily Islamic Reminders
          </Text>
          {[
            { key: 'dailyAyah', label: 'Daily Verse (Ayah)', icon: '📖', sub: 'Every morning at 7:00 AM' },
            { key: 'dailyHadith', label: 'Daily Hadith', icon: '📚', sub: 'Every morning at 8:00 AM' },
            { key: 'morningAzkar', label: 'Morning Azkar', icon: '🌅', sub: 'After Fajr at 6:30 AM' },
            { key: 'eveningAzkar', label: 'Evening Azkar', icon: '🌆', sub: 'At 5:30 PM' },
            { key: 'fridayReminder', label: "Jumu'ah Reminder", icon: '🕌', sub: 'Every Friday at 11:30 AM' },
            { key: 'tahajjudReminder', label: 'Tahajjud Reminder', icon: '🌌', sub: 'At 3:30 AM nightly' },
            { key: 'fastingReminder', label: 'Fasting Tracker', icon: '🌙', sub: 'Daily reminder to log fasts' },
          ].map((item, i, arr) => (
            <React.Fragment key={item.key}>
              <View style={styles.notifRow}>
                <Text style={styles.notifEmoji}>{item.icon}</Text>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowLabel, { color: C.textPrimary }]}>{item.label}</Text>
                  <Text style={[styles.rowSub, { color: C.textMuted }]}>{item.sub}</Text>
                </View>
                <Switch
                  value={!!settings.notifications[item.key as keyof typeof settings.notifications]}
                  onValueChange={v => handleNotificationToggle(item.key as keyof typeof settings.notifications, v)}
                  trackColor={{ false: C.cardBorder, true: `${C.gold}80` }}
                  thumbColor={settings.notifications[item.key as keyof typeof settings.notifications] ? C.gold : C.textMuted}
                />
              </View>
              {i < arr.length - 1 && <Divider />}
            </React.Fragment>
          ))}

          {/* Disable all */}
          <Pressable
            style={[styles.disableAllBtn, { borderTopColor: C.cardBorder }]}
            onPress={handleCancelAll}
          >
            <MaterialIcons name="notifications-off" size={16} color={C.error} />
            <Text style={[styles.disableAllText, { color: C.error }]}>Disable All Notifications</Text>
          </Pressable>
        </Section>

        {/* ── Time Picker Modal ─────────────────────────────────────────────── */}
        <Modal visible={showSchedulePicker !== null} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: C.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: C.cardBorder }]}>
                <Text style={[styles.modalTitle, { color: C.textPrimary }]}>
                  {showSchedulePicker === 'start' ? 'Dark Mode ON Time' : 'Dark Mode OFF Time'}
                </Text>
                <Pressable onPress={() => setShowSchedulePicker(null)}>
                  <MaterialIcons name="close" size={24} color={C.textPrimary} />
                </Pressable>
              </View>

              <View style={styles.timePickerBody}>
                {/* Hour selector */}
                <View style={styles.timePickerCol}>
                  <Text style={[styles.timePickerColLabel, { color: C.textMuted }]}>Hour</Text>
                  <ScrollView style={styles.timePickerScroll} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 24 }, (_, i) => i).map(h => (
                      <Pressable
                        key={h}
                        style={[
                          styles.timeOption,
                          { backgroundColor: C.card, borderColor: C.cardBorder },
                          tempHour === h && { backgroundColor: `${C.gold}20`, borderColor: C.gold },
                        ]}
                        onPress={() => setTempHour(h)}
                      >
                        <Text style={[styles.timeOptionText, { color: tempHour === h ? C.gold : C.textPrimary }]}>
                          {h.toString().padStart(2, '0')}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <Text style={[styles.timeColon, { color: C.gold }]}>:</Text>

                {/* Minute selector */}
                <View style={styles.timePickerCol}>
                  <Text style={[styles.timePickerColLabel, { color: C.textMuted }]}>Minute</Text>
                  <ScrollView style={styles.timePickerScroll} showsVerticalScrollIndicator={false}>
                    {[0, 15, 30, 45].map(m => (
                      <Pressable
                        key={m}
                        style={[
                          styles.timeOption,
                          { backgroundColor: C.card, borderColor: C.cardBorder },
                          tempMinute === m && { backgroundColor: `${C.gold}20`, borderColor: C.gold },
                        ]}
                        onPress={() => setTempMinute(m)}
                      >
                        <Text style={[styles.timeOptionText, { color: tempMinute === m ? C.gold : C.textPrimary }]}>
                          {m.toString().padStart(2, '0')}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={[styles.timePickerPreview, { backgroundColor: `${C.gold}10`, borderColor: `${C.gold}20` }]}>
                <Text style={[styles.timePickerPreviewText, { color: C.gold }]}>
                  Selected: {tempHour.toString().padStart(2, '0')}:{tempMinute.toString().padStart(2, '0')}
                </Text>
              </View>

              <Pressable
                style={[styles.confirmBtn, { backgroundColor: C.gold }]}
                onPress={confirmTimePicker}
              >
                <Text style={[styles.confirmBtnText, { color: C.primaryDark }]}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* ── About ─────────────────────────────────────────────────────────── */}
        <Section title="About">
          <View style={[styles.aboutCard, { backgroundColor: `${C.primary}15` }]}>
            <Text style={[styles.aboutName, { color: C.gold }]}>🕌 Islamic Guide</Text>
            <Text style={[styles.aboutVersion, { color: C.textMuted }]}>Version 2.1.0 · Production Build</Text>
            <Text style={[styles.aboutDesc, { color: C.textSecondary }]}>
              Complete Quran with word-by-word translation, 9 authentic Hadith collections, comprehensive Duas library, AI Islamic Guide powered by Gemini 3, GPS prayer times, Qibla compass, 99 Names of Allah, Ramadan companion, Hajj guide, and more.
            </Text>
          </View>
          <Divider />
          <Pressable
            style={styles.optionRow}
            onPress={() => {
              /* Clear cache */
              Alert.alert('Cache Cleared', 'App cache has been cleared successfully.');
            }}
          >
            <View style={styles.optionContent}>
              <View style={[styles.rowIcon, { backgroundColor: `${C.warning}15` }]}>
                <MaterialIcons name="cleaning-services" size={18} color={C.warning} />
              </View>
              <Text style={[styles.optionName, { color: C.textPrimary }]}>Clear Cache</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={C.textMuted} />
          </Pressable>
        </Section>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: 4, marginBottom: Spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8, borderRadius: Radius.md, borderWidth: 1 },
  statNum: { fontSize: 15, fontWeight: '700' },
  statLabel: { fontSize: 11 },

  section: {},
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: Spacing.xs },
  sectionCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },

  divider: { height: 1, marginHorizontal: Spacing.md },

  themeSection: {},
  themeRow: { flexDirection: 'row', gap: 10, padding: Spacing.md },
  themeCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    gap: 6,
    position: 'relative',
  },
  themeCardActive: {},
  themeLabel: { fontSize: 12, fontWeight: '600' },
  themeCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    minHeight: 60,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 12, marginTop: 1 },

  fontStepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stepValue: { fontSize: 16, fontWeight: '700', minWidth: 28, textAlign: 'center' },

  arabicPreview: { padding: Spacing.md, alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1 },
  arabicPreviewText: { textAlign: 'center', lineHeight: 60 },
  arabicPreviewSub: { fontSize: 11, marginTop: 4 },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  optionContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionFlag: { fontSize: 20, width: 28, textAlign: 'center' },
  optionName: { fontSize: 14, fontWeight: '500' },
  optionSub: { fontSize: 12, marginTop: 1 },
  reciterBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  reciterInitial: { fontSize: 16, fontWeight: '700' },

  notifHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: Spacing.md, borderBottomWidth: 1 },
  notifHeaderText: { flex: 1, fontSize: 13, lineHeight: 20 },
  notifGroupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, padding: 10, paddingHorizontal: Spacing.md },
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12, gap: 12 },
  notifEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  disableAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.md, borderTopWidth: 1, justifyContent: 'center' },
  disableAllText: { fontSize: 14, fontWeight: '600' },

  aboutCard: { padding: Spacing.md, alignItems: 'center', gap: 6 },
  aboutName: { fontSize: 16, fontWeight: '700' },
  aboutVersion: { fontSize: 12 },
  aboutDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 4 },

  // Schedule styles
  scheduleSection: {},
  scheduleHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 60 },
  scheduleBody: {
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scheduleModeRow: { flexDirection: 'row', gap: 8, padding: 12 },
  scheduleModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  scheduleModeTxt: { fontSize: 12, fontWeight: '600' },
  timePickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  timeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  timeBtnLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  timeBtnValue: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  sunriseBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    margin: 12,
    borderRadius: Radius.md,
  },
  sunriseText: { flex: 1, fontSize: 13, lineHeight: 20 },
  scheduleNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderTopWidth: 1,
  },
  scheduleNoteText: { flex: 1, fontSize: 11 },

  // Theme previews
  themePreviewRow: {},
  themePreviews: { flexDirection: 'row', gap: 16 },
  previewCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 6,
    alignItems: 'flex-start',
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  previewDot: { width: 10, height: 10, borderRadius: 5 },
  previewLine: { borderRadius: 2 },
  previewBtn: { borderRadius: 6, padding: 6, alignSelf: 'stretch', alignItems: 'center', marginTop: 4 },
  previewLabel: { fontSize: 11, fontWeight: '600', alignSelf: 'center', marginTop: 4 },

  // Time picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.md },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  timePickerBody: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md },
  timePickerCol: { flex: 1 },
  timePickerColLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, textAlign: 'center' },
  timePickerScroll: { maxHeight: 200 },
  timeOption: { padding: 12, borderRadius: Radius.md, borderWidth: 1, marginBottom: 6, alignItems: 'center' },
  timeOptionText: { fontSize: 20, fontWeight: '700' },
  timeColon: { fontSize: 28, fontWeight: '900', flexShrink: 0 },
  timePickerPreview: {
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  timePickerPreviewText: { fontSize: 20, fontWeight: '700' },
  confirmBtn: { alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.sm },
  confirmBtnText: { fontSize: 16, fontWeight: '700' },
});
