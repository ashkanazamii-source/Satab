// src/theme.ts
import { createTheme, alpha, type Shadows } from '@mui/material/styles';

export const brand = {
  primary: '#a5b3f3ff',   // indigo-500
  secondary: '#0f293cff', // pink-500
  success: '#10B981',   // emerald-500
  warning: '#F59E0B',
  error: '#EF4444',
  surfaceGrad: (mode: 'light' | 'dark') =>
    mode === 'light'
      ? `radial-gradient(60% 50% at 100% 0%, ${alpha('#25049bff', .10)} 0%, transparent 60%),
         radial-gradient(70% 55% at 0% 15%, ${alpha('#111246ff', .12)} 0%, transparent 65%)`
      : `radial-gradient(60% 50% at 100% 0%, ${alpha('#25049bff', .12)} 0%, transparent 60%),
         radial-gradient(70% 55% at 0% 15%, ${alpha('#6366F1', .18)} 0%, transparent 65%)`
};
declare module '@mui/material/styles' {
  interface Theme { motion: { dur: any; ease: any } }
  interface ThemeOptions { motion?: { dur?: any; ease?: any } }
}
export const getTheme = (mode: 'light' | 'dark' = 'light') =>
  createTheme({
    direction: 'rtl',
    palette: {
      mode,
      primary: { main: brand.primary },
      secondary: { main: brand.secondary },
      success: { main: brand.success },
      warning: { main: brand.warning },
      error: { main: brand.error },
      /*background: {
        default: mode === 'light' ? '#0B1220' : '#070B14',   // تیره‌ی شیک
        paper: mode === 'light' ? '#0E1626' : '#0C1422',
      },*/
      background: {
        // فیروزه‌ای شیک
        default: mode === 'light' ? '#87b0b8ff' : '#223d50ff',
        paper: mode === 'light' ? '#87b0b8ff' : '#204252ff',
      },
      text: {
        primary: '#EAF0FF',
        secondary: alpha('#EAF0FF', .7)
      },
      divider: alpha('#EAF0FF', .12),
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: `"Vazirmatn", "IRANSansX", "Inter", "Roboto", "Segoe UI", sans-serif`,
      h1: { fontWeight: 900 }, h2: { fontWeight: 900 }, h3: { fontWeight: 900 },
      h4: { fontWeight: 800 }, h5: { fontWeight: 800 }, h6: { fontWeight: 800 },
      button: { fontWeight: 700, textTransform: 'none', letterSpacing: .2 }
    },
    shadows: ([
      'none',
      '0 3px 10px rgba(0,0,0,.12)',
      '0 6px 18px rgba(0,0,0,.14)',
      '0 10px 30px rgba(0,0,0,.16)',
      ...Array.from({ length: 21 }, () => '0 12px 36px rgba(0,0,0,.18)')
    ] as unknown as Shadows),
    components: {
      MuiCssBaseline: {
        styleOverrides: (t) => ({
          ':root': { colorScheme: t.palette.mode },
          body: {
            background: `${brand.surfaceGrad(mode)}, ${t.palette.background.default}`,
            backgroundAttachment: 'fixed',
          },
          '*::-webkit-scrollbar': { height: 8, width: 8 },
          '*::-webkit-scrollbar-thumb': {
            background: alpha('#fff', .18), borderRadius: 8
          }
        })
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            border: `1px solid ${alpha(theme.palette.common.white, .08)}`,
            background: `linear-gradient(${alpha(theme.palette.background.paper, .6)}, ${alpha(theme.palette.background.paper, .6)})`,
            backdropFilter: 'blur(8px)'
          })
        }
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            transition: 'transform .18s ease, box-shadow .18s ease',
            '&:hover': {
              transform: 'translateY(-3px)',
              boxShadow: `0 16px 36px ${alpha(theme.palette.primary.main, .22)}`
            }
          })
        }
      },
      MuiButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 12,
            paddingInline: 16,
          }),
          containedPrimary: ({ theme }) => ({
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          })
        }
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: ({ theme }) => ({
            background: alpha(theme.palette.common.black, .8),
            backdropFilter: 'blur(6px)',
            border: `1px solid ${alpha('#fff', .08)}`
          })
        }
      },
      MuiChip: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 10,
            fontWeight: 700,
            backdropFilter: 'blur(6px)'
          })
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            background: `linear-gradient(${alpha(theme.palette.background.paper, .75)}, ${alpha(theme.palette.background.paper, .75)})`,
            borderInline: `1px solid ${alpha('#fff', .08)}`
          })
        }
      }
    },
    motion: {
      dur: { xs: .16, sm: .22, md: .30, lg: .45 },
      ease: { out: [0.22, 0.61, 0.36, 1], in: [0.4, 0, 1, 1], inOut: [0.85, 0, 0.15, 1] }
    }
  });
