import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  dangerSoft: '#FBE4E5',
  live: '#15803D',
  liveSoft: '#DCF5E3',
  night: '#4F46E5',
  nightSoft: '#E6E4FB',
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
  dangerSoft: '#3A1C1E',
  live: '#4ADE80',
  liveSoft: '#173322',
  night: '#A5B4FC',
  nightSoft: '#22213D',
  mapGrid: '#4A4038',
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

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
