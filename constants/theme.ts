// Islamic App Design Tokens — Production-Grade Dynamic Theme System
import { Appearance } from 'react-native';

export const DarkColors = {
  // Primary Brand — Deep Emerald
  primary: '#1B5E4A',
  primaryLight: '#2E7D5E',
  primaryDark: '#0D3526',

  // Accent — Warm Gold
  gold: '#D4AA5A',
  goldLight: '#EDD080',
  goldDark: '#AA8430',

  // Surface Hierarchy
  background: '#0A1A14',
  surface: '#111E18',
  surfaceElevated: '#172A20',
  card: '#162219',
  cardBorder: '#233D2E',
  divider: '#1C3228',

  // Text — High contrast for accessibility
  textPrimary: '#F2EDE0',       // WCAG AA on dark bg
  textSecondary: '#BDCFC7',    // Medium contrast
  textMuted: '#7A9B8E',        // Subtle
  textArabic: '#F5ECD5',       // Warm for Arabic script
  textInverse: '#0A1A14',

  // Semantic
  success: '#52C98A',
  successBg: '#0F2E1E',
  warning: '#F0B450',
  warningBg: '#2A1E08',
  error: '#F06A5A',
  errorBg: '#2A0F0A',
  info: '#5AABF0',
  infoBg: '#0A1E2A',

  // Quran Reader
  sajdah: '#D4AA5A',
  ruku: '#5AABF0',
  hizb: '#B06AF0',
  tajweedGhunna: '#4CAF7D',
  tajweedMadd: '#5AABF0',
  tajweedQalqalah: '#F0B450',
  tajweedIkhfa: '#D4AA5A',
  tajweedIdgham: '#52C98A',

  // Prayer Time Colors
  fajr: '#2D5A7A',
  sunrise: '#D4AA5A',
  dhuhr: '#F0A020',
  asr: '#E87840',
  maghrib: '#C85040',
  isha: '#2A3580',

  // Chat
  aiMessage: '#162A22',
  userMessage: '#0D2E22',
  chatInput: '#131F18',
  chatBubbleBorder: '#233D2E',

  // Overlay
  overlay: 'rgba(0,0,0,0.75)',
  overlayLight: 'rgba(0,0,0,0.4)',
  overlayCard: 'rgba(10,26,20,0.95)',

  // Navigation
  tabBarBg: '#0D1A14',
  tabBarBorder: '#1C3228',
  statusBar: 'light' as 'light' | 'dark',

  // Compass
  compassBg: '#0D1A14',
  compassRing: '#D4AA5A',
  compassNeedle: '#D4AA5A',
  compassNeedleBack: '#4A6A58',
};

export const LightColors = {
  // Primary Brand
  primary: '#1B5E4A',
  primaryLight: '#2E7D5E',
  primaryDark: '#0D3526',

  // Accent — Richer gold for light mode
  gold: '#9A6A1A',
  goldLight: '#C9A84C',
  goldDark: '#6A4A10',

  // Surface Hierarchy
  background: '#F5F0E6',
  surface: '#FFFFFF',
  surfaceElevated: '#EDE8DC',
  card: '#FAFAF5',
  cardBorder: '#DDD5C0',
  divider: '#E8E0CE',

  // Text — High contrast for light mode
  textPrimary: '#1A2820',       // WCAG AAA on white
  textSecondary: '#3D5A4E',
  textMuted: '#7A8E86',
  textArabic: '#1E3028',        // Deep for Arabic script
  textInverse: '#F5F0E6',

  // Semantic
  success: '#1E6E42',
  successBg: '#E8F5EE',
  warning: '#8A5A10',
  warningBg: '#FFF3E0',
  error: '#B02A20',
  errorBg: '#FDECEA',
  info: '#1A5A9E',
  infoBg: '#E6F2FF',

  // Quran Reader
  sajdah: '#9A6A1A',
  ruku: '#1A5A9E',
  hizb: '#6A1A9A',
  tajweedGhunna: '#1E6E42',
  tajweedMadd: '#1A5A9E',
  tajweedQalqalah: '#8A5A10',
  tajweedIkhfa: '#9A6A1A',
  tajweedIdgham: '#1E6E42',

  // Prayer Time Colors
  fajr: '#1A3A5A',
  sunrise: '#9A6A1A',
  dhuhr: '#B07010',
  asr: '#A05020',
  maghrib: '#882A18',
  isha: '#1A1F6A',

  // Chat
  aiMessage: '#EBF5EE',
  userMessage: '#D8EDE2',
  chatInput: '#FFFFFF',
  chatBubbleBorder: '#C8D8CE',

  // Overlay
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.2)',
  overlayCard: 'rgba(245,240,230,0.97)',

  // Navigation
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E0D8C8',
  statusBar: 'dark' as 'light' | 'dark',

  // Compass
  compassBg: '#F0EBE0',
  compassRing: '#9A6A1A',
  compassNeedle: '#9A6A1A',
  compassNeedleBack: '#8A9E96',
};

// Default export — dark mode
export const Colors = DarkColors;

export type ThemeColors = typeof DarkColors;

// High-contrast palette: identical hues, but text and surfaces are pushed to
// the extremes of the scale so low-vision users get maximum separation.
export const HighContrastDarkColors: ThemeColors = {
  ...DarkColors,
  background: '#000000',
  surface: '#0A0F0C',
  surfaceElevated: '#121A15',
  card: '#0D140F',
  cardBorder: '#4E7A63',
  divider: '#3A5C4A',
  textPrimary: '#FFFFFF',
  textSecondary: '#E8F3EC',
  textMuted: '#C3D8CC',
  textArabic: '#FFFFFF',
  gold: '#F7D27C',
  goldLight: '#FFE7AE',
  textInverse: '#000000',
};

export const HighContrastLightColors: ThemeColors = {
  ...LightColors,
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#F2F2F2',
  card: '#FFFFFF',
  cardBorder: '#1F3D30',
  divider: '#3A5C4A',
  textPrimary: '#000000',
  textSecondary: '#152A20',
  textMuted: '#274A38',
  textArabic: '#000000',
  gold: '#6B4E10',
  goldLight: '#4E3908',
  textInverse: '#FFFFFF',
};

export function getHighContrastColors(theme: 'dark' | 'light'): ThemeColors {
  return theme === 'light' ? HighContrastLightColors : HighContrastDarkColors;
}

export function getColors(theme: 'dark' | 'light' | 'system'): ThemeColors {
  if (theme === 'system') {
    const colorScheme = Appearance.getColorScheme();
    return colorScheme === 'light' ? LightColors : DarkColors;
  }
  return theme === 'light' ? LightColors : DarkColors;
}

export const Fonts = {
  arabic: 'System',
  body: 'System',
  sizes: {
    arabic_xl: 34,
    arabic_lg: 28,
    arabic_md: 24,
    arabic_sm: 20,
    h1: 28,
    h2: 22,
    h3: 18,
    h4: 16,
    body: 16,
    small: 14,
    xs: 12,
    xxs: 10,
  },
  lineHeights: {
    arabic_xl: 58,
    arabic_lg: 48,
    arabic_md: 42,
    arabic_sm: 36,
    body: 26,
    small: 22,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  round: 100,
};

export const Shadow = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  gold: {
    shadowColor: '#D4AA5A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Responsive scaling helpers
export function getResponsiveSize(base: number, screenWidth: number): number {
  if (screenWidth < 360) return base * 0.875;
  if (screenWidth > 600) return base * 1.125;
  return base;
}
