// src/theme.ts
import { createTheme, alpha, type Shadows } from '@mui/material/styles';

/* تم سفیدِ روشن و سنگین (بدون حالت تیره) */
export const brand = {
  primary: '#111827',   // برای هدینگ/تاکید
  secondary: '#374151',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  surfaceGrad: `radial-gradient(60% 50% at 100% 0%, ${alpha('#000', .04)} 0%, transparent 60%),
                radial-gradient(70% 55% at 0% 15%, ${alpha('#000', .05)} 0%, transparent 65%)`
};

declare module '@mui/material/styles' {
  interface Theme { motion: { dur: any; ease: any } }
  interface ThemeOptions { motion?: { dur?: any; ease?: any } }
}

export const getTheme = () =>
  createTheme({
    direction: 'rtl',
    palette: {
      mode: 'light',
      primary: { main: brand.primary },
      secondary: { main: brand.secondary },
      success: { main: brand.success },
      warning: { main: brand.warning },
      error: { main: brand.error },

      // کاملاً سفید/روشن
      /*background: {
        default: '#F7F9FC',
        paper:   '#FFFFFF',
      },*/
      background: {
        default: '#eef0f2ff',
        paper: '#dde2e7f3',
      },
      text: {
        primary: '#0A0A0A',
        secondary: '#4B5563',
      },

      divider: alpha('#111827', .12),
    },

    shape: { borderRadius: 14 },

    // تایپوگرافی درشت‌تر و سنگین‌تر
    typography: {
      fontFamily: `"Vazirmatn","IRANSansX","Inter","Roboto","Segoe UI",sans-serif`,
      htmlFontSize: 16,
      fontSize: 15,
      h1: { fontWeight: 900, fontSize: '2.4rem', lineHeight: 1.2 },
      h2: { fontWeight: 900, fontSize: '2rem', lineHeight: 1.25 },
      h3: { fontWeight: 900, fontSize: '1.75rem', lineHeight: 1.3 },
      h4: { fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.35 },
      h5: { fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.4 },
      h6: { fontWeight: 800, fontSize: '1.125rem', lineHeight: 1.45 },
      subtitle1: { fontWeight: 700, fontSize: '1rem' },
      subtitle2: { fontWeight: 700, fontSize: '0.95rem' },
      body1: { fontSize: '0.975rem' },
      body2: { fontSize: '0.92rem' },
      button: { fontWeight: 800, textTransform: 'none', letterSpacing: .2, fontSize: '0.95rem' },
    },

    // سایه‌های ملایم مناسب زمینه سفید
    shadows: ([
      'none',
      '0 2px 8px rgba(17,24,39,.06)',
      '0 6px 16px rgba(17,24,39,.08)',
      '0 10px 24px rgba(17,24,39,.10)',
      ...Array.from({ length: 21 }, () => '0 12px 32px rgba(17,24,39,.10)')
    ] as unknown as Shadows),

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { colorScheme: 'light' },
          body: {
            background: `${brand.surfaceGrad}, #F7F9FC`,
            backgroundAttachment: 'fixed',
          },
          '*::-webkit-scrollbar': { height: 8, width: 8 },
          '*::-webkit-scrollbar-thumb': {
            background: alpha('#111827', .25), borderRadius: 8
          }
        }
      },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            border: `1px solid ${alpha('#111827', .08)}`,
            background: `linear-gradient(
              ${alpha(theme.palette.background.paper, .95)},
              ${alpha(theme.palette.background.paper, .95)}
            )`,
            backdropFilter: 'blur(8px)'
          })
        }
      },

      MuiCard: {
        styleOverrides: {
          root: {
            transition: 'transform .18s ease, box-shadow .18s ease',
            '&:hover': {
              transform: 'translateY(-3px)',
              boxShadow: '0 18px 44px rgba(17,24,39,.10)'
            }
          }
        }
      },

      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 12, paddingInline: 18, paddingBlock: 10 },
          containedPrimary: {
            color: '#FFFFFF',
            background: 'linear-gradient(135deg, #1F2937, #111827)',
            '&:hover': { background: 'linear-gradient(135deg, #111827, #0B0F13)' }
          },
          outlinedPrimary: {
            borderColor: alpha('#111827', .28),
            color: '#111827',
            background: alpha('#111827', .04),
            '&:hover': { background: alpha('#111827', .08), borderColor: alpha('#111827', .42) }
          }
        }
      },
      MuiDialog: {
        defaultProps: {
          PaperProps: { elevation: 0 }, // از سایه‌ی خشن جلوگیری می‌کند
        },
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: 18,
            border: `1px solid ${alpha('#111827', .12)}`,
            boxShadow: '0 22px 60px rgba(17,24,39,.16)',
            // شیشه‌ای: شفاف + بلور
            background: `linear-gradient(
          ${alpha(theme.palette.background.paper, .58)},
          ${alpha(theme.palette.background.paper, .58)}
        )`,
            backdropFilter: 'blur(16px) saturate(120%)',
            WebkitBackdropFilter: 'blur(16px) saturate(120%)',
          }),
          // اختیاری: چینش وسطِ صفحه و فاصله‌ها
          container: {
            alignItems: 'center',
          },
        },
      },

      // 👇 شیشه‌ای/مه‌آلود کردن پس‌زمینه‌ی پشت دیالوگ
      MuiBackdrop: {
        styleOverrides: {
          root: {
            backgroundColor: alpha('#0B0F13', .35), // تیرگی لطیف
            backdropFilter: 'blur(2px)',            // محوِ پس‌زمینه
            WebkitBackdropFilter: 'blur(2px)',
          },
        },
      },

      // اختیاری: هماهنگی عنوان/اکشن‌ها
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontWeight: 900,
            padding: '16px 20px',
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: 20,
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: 16,
            gap: 8,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            color: '#0A0A0A',
            background: alpha('#FFFFFF', .98),
            border: `1px solid ${alpha('#111827', .10)}`,
            backdropFilter: 'blur(6px)'
          }
        }
      },

      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            fontWeight: 800,
            background: alpha('#111827', .06),
            border: `1px solid ${alpha('#111827', .16)}`,
            backdropFilter: 'blur(6px)'
          }
        }
      },

      MuiDrawer: {
        styleOverrides: {
          paper: {
            background: `linear-gradient(#FFFFFF,#FFFFFF)`,
            borderInline: `1px solid ${alpha('#111827', .10)}`
          }
        }
      }
    },

    motion: {
      dur: { xs: .16, sm: .22, md: .30, lg: .45 },
      ease: { out: [0.22, 0.61, 0.36, 1], in: [0.4, 0, 1, 1], inOut: [0.85, 0, 0.15, 1] }
    }
  });
