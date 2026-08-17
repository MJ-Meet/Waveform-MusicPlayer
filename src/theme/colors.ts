// Core color palette for Waveform dark theme

export const Colors = {
  // Backgrounds
  background: '#0D0D0D',
  surface: '#161616',
  surfaceElevated: '#1E1E1E',
  surfaceHighlight: '#252525',
  card: '#1A1A1A',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textTertiary: '#555555',
  textDisabled: '#333333',

  // Default accent (dynamically overridden per track)
  accent: '#A855F7',
  accentLight: '#C084FC',
  accentDark: '#7C3AED',
  accentMuted: 'rgba(168, 85, 247, 0.2)',

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  glassBackground: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',

  // Tab bar
  tabBarBackground: '#111111',
  tabBarBorder: '#222222',
  tabBarActive: '#A855F7',
  tabBarInactive: '#555555',

  // Mini player
  miniPlayerBackground: '#1A1A1A',
  miniPlayerBorder: '#2A2A2A',

  // Transparent
  transparent: 'transparent',
} as const;

// Mood color themes
export const MoodColors = {
  chill: {
    primary: '#6366F1',
    secondary: '#818CF8',
    background: 'rgba(99, 102, 241, 0.15)',
  },
  focus: {
    primary: '#06B6D4',
    secondary: '#22D3EE',
    background: 'rgba(6, 182, 212, 0.15)',
  },
  workout: {
    primary: '#F97316',
    secondary: '#FB923C',
    background: 'rgba(249, 115, 22, 0.15)',
  },
} as const;

export type ColorKey = keyof typeof Colors;
export type MoodType = keyof typeof MoodColors;
