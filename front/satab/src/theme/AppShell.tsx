// src/layout/AppShell.tsx
import { alpha } from '@mui/material/styles';
import { Box, IconButton, Paper, Stack, Typography, Tooltip } from '@mui/material';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import { ThemeModeContext } from './ThemeModeProvider';
import React from 'react';

export default function AppShell({
  title = 'داشبورد',
  onOpenNav,
  children
}: { title?: string; onOpenNav?: () => void; children: React.ReactNode }) {
  const { mode, toggle } = React.useContext(ThemeModeContext);

  return (
    <Box sx={{
      position:'fixed', inset:0, display:'grid',
      gridTemplateRows:'64px 1fr', gridTemplateColumns:'1fr',
      gap:2, p:2, boxSizing:'border-box'
    }}>
      <Paper elevation={0} sx={{
        gridRow:'1', gridColumn:'1 / -1',
        px:2, py:1.25,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background: (t) => `
          linear-gradient(${alpha(t.palette.background.paper, .7)}, ${alpha(t.palette.background.paper, .7)})
        `,
        backdropFilter:'blur(10px)'
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {onOpenNav && (
            <IconButton onClick={onOpenNav} sx={{ mr:-.5 }}>
              <MenuRounded />
            </IconButton>
          )}
          <Typography variant="h5" sx={{ fontWeight: 900 }}>{title}</Typography>
        </Stack>
        <Tooltip title={mode === 'dark' ? 'حالت روشن' : 'حالت تیره'}>
          <IconButton onClick={toggle}>
            {mode === 'dark' ? <LightModeRounded /> : <DarkModeRounded />}
          </IconButton>
        </Tooltip>
      </Paper>

      <Box sx={{ gridRow:'2', minHeight:0, overflow:'auto' }}>
        {children}
      </Box>
    </Box>
  );
}
