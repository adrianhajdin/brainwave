import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

// "Clean Signal" redesign. Same keys as before, new values; three keys are new:
// primary / primaryText (ink buttons) and warn / warnSoft (low battery).
const light = {
  bg: '#F3F5F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F5',
  text: '#0C1220',
  textMuted: '#5B6577',
  border: '#E1E6EC',
  primary: '#0C1220',
  primaryText: '#FFFFFF',
  accent: '#2449E8',
  accentText: '#FFFFFF',
  accentSoft: '#E7EDFF',
  danger: '#C21F2B',
  dangerSoft: '#FDE8EA',
  live: '#067448',
  liveSoft: '#DBF4EA',
  liveDot: '#12B76A',
  night: '#6236E0',
  nightSoft: '#EFE9FF',
  warn: '#B23A0A',
  warnSoft: '#FFEEDF',
  mapGrid: '#E8ECF0',
  shadow: 'rgba(12, 18, 32, 0.12)',
};

const dark: typeof light = {
  bg: '#0A0E15',
  surface: '#141A24',
  surfaceAlt: '#1C2431',
  text: '#EEF2F8',
  textMuted: '#97A1B2',
  border: '#263042',
  primary: '#EEF2F8',
  primaryText: '#0A0E15',
  accent: '#7D9BFF',
  accentText: '#0A0E15',
  accentSoft: '#1B2547',
  danger: '#FF6B73',
  dangerSoft: '#3A1A20',
  live: '#3DDC97',
  liveSoft: '#12301F',
  liveDot: '#3DDC97',
  night: '#B39CFF',
  nightSoft: '#251D45',
  warn: '#FFA266',
  warnSoft: '#3A2416',
  mapGrid: '#121821',
  shadow: 'rgba(0, 0, 0, 0.5)',
};

export type Theme = typeof light & { isDark: boolean };
export type ThemePref = 'system' | 'light' | 'dark';

const PREF_KEY = 'appearance';
const PrefContext = createContext<{ pref: ThemePref; setPref: (p: ThemePref) => void }>({
  pref: 'system',
  setPref: () => undefined,
});

export function ThemePrefProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>('system');
  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY)
      .then((v) => (v === 'light' || v === 'dark' || v === 'system') && setPrefState(v))
      .catch(() => undefined);
  }, []);
  const value = useMemo(
    () => ({
      pref,
      setPref: (p: ThemePref) => {
        setPrefState(p);
        void AsyncStorage.setItem(PREF_KEY, p).catch(() => undefined);
      },
    }),
    [pref],
  );
  return createElement(PrefContext.Provider, { value }, children);
}

export function useThemePref() {
  return useContext(PrefContext);
}

export function useTheme(): Theme {
  const system = useColorScheme();
  const { pref } = useContext(PrefContext);
  const isDark = pref === 'dark' || (pref === 'system' && system === 'dark');
  return useMemo(() => ({ ...(isDark ? dark : light), isDark }), [isDark]);
}

// sm: chips and small controls · md: inputs and secondary buttons · lg: cards · sheet: bottom sheets
export const radius = { sm: 10, md: 14, lg: 24, sheet: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

// Load these with expo-font before using them (Google Fonts, OFL licence).
export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  body: 'Geist_400Regular',
  bodyMedium: 'Geist_500Medium',
  bodySemibold: 'Geist_600SemiBold',
  mono: 'GeistMono_500Medium',
};
