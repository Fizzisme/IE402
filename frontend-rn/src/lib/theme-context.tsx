import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  colorScheme: 'light' | 'dark';
  setColorScheme: (mode: ThemeMode) => void;
  toggleColorScheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() ?? 'light';
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  const colorScheme = themeMode === 'system' ? systemScheme : themeMode;

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        colorScheme,
        setColorScheme: setThemeMode,
        toggleColorScheme: () =>
          setThemeMode(
            themeMode === 'system' ? 'light' : themeMode === 'light' ? 'dark' : 'system'
          ),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
