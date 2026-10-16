import { useColorScheme } from 'react-native';

const light = {
  bg: '#FBF7F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F3ECE3',
  text: '#1F1A17',
  textMuted: '#6F655C',
  border: '#E7DED3',
  accent: '#D97706',
  accentText: '#FFFFFF',
  accentSoft: '#FDEFD9',
  danger: '#C8323A',
  live: '#15803D',
  liveSoft: '#DCF5E3',
  mapGrid: '#E9E1D6',
  shadow: 'rgba(60, 40, 20, 0.12)',
};

const dark: typeof light = {
  bg: '#14110F',
  surface: '#1E1A17',
  surfaceAlt: '#2A2420',
  text: '#F4EEE8',
  textMuted: '#A99E93',
  border: '#3A322C',
  accent: '#F5A524',
  accentText: '#1A1205',
  accentSoft: '#3A2A12',
  danger: '#F0646B',
  live: '#4ADE80',
  liveSoft: '#173322',
  mapGrid: '#4A4038',
  shadow: 'rgba(0, 0, 0, 0.5)',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
