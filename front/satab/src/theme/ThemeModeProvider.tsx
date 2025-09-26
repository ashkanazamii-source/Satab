// src/providers/ThemeModeProvider.tsx
import React from 'react';
import { getTheme } from './theme';
import { ThemeProvider } from '@mui/material/styles';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';
import CssBaseline from '@mui/material/CssBaseline';

type Ctx = { mode: 'light'|'dark', toggle: () => void };
export const ThemeModeContext = React.createContext<Ctx>({ mode:'dark', toggle: () => {} });

const rtlCache = createCache({ key: 'mui-rtl', stylisPlugins: [prefixer, rtlPlugin] });

export default function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<'light'|'dark'>('dark');
  const toggle = () => setMode(m => (m === 'light' ? 'dark' : 'light'));

  return (
    <CacheProvider value={rtlCache}>
      <ThemeModeContext.Provider value={{ mode, toggle }}>
        <ThemeProvider theme={getTheme(mode)}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </ThemeModeContext.Provider>
    </CacheProvider>
  );
}
