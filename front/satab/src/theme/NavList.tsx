// src/components/NavList.tsx
import * as React from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import {
  Box, Typography, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, TextField, Chip, Tooltip
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { m } from 'framer-motion';

// icons
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import AltRouteOutlined from '@mui/icons-material/AltRouteOutlined';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';

type Item = { label: string; icon: React.ReactNode; to: string; badge?: string | number; live?: boolean };

const NAV_ITEMS: Item[] = [
  { label: 'داشبورد', icon: <DashboardOutlined />, to: '/dashboard' },
  { label: 'مدیریت نقش‌ها', icon: <GroupsIcon />, to: '/role-management' },
  { label: 'مدیریت راننده/ناوگان', icon: <DirectionsCarIcon />, to: '/driver-management', live: true },
  { label: 'تحلیل‌ها', icon: <InsightsRoundedIcon />, to: '/analytics' },
  { label: 'لاگ‌ها', icon: <ListAltIcon />, to: '/logs', badge: 8 },
  { label: 'گفتگو', icon: <ChatRoundedIcon />, to: '/chat', badge: '3' },
  { label: 'تعریف خط', icon: <AltRouteOutlined />, to: '/define-line' },
  { label: 'تعیین شیفت‌ها', icon: <CalendarMonthRoundedIcon />, to: '/shifts' },
];

export default function NavList({ closeSidebar }: { closeSidebar?: () => void }) {
  const theme = useTheme();
  const { pathname } = useLocation();
  const [q, setQ] = React.useState('');

  const items = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? NAV_ITEMS.filter(it => it.label.toLowerCase().includes(s)) : NAV_ITEMS;
  }, [q]);

  const activeSx = {
    bgcolor: alpha(theme.palette.primary.main, 0.10),
    '& .MuiListItemIcon-root': { color: theme.palette.primary.main },
    '& .MuiListItemText-primary': { color: theme.palette.text.primary, fontWeight: 900 },
    borderRadius: 1.2,
    position: 'relative',
    '&::before': {
      content: '""',
      position: 'absolute',
      insetInlineStart: -8,
      top: 6,
      bottom: 6,
      width: 3,
      borderRadius: 2,
      background: `linear-gradient(180deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
    },
  } as const;

  const hoverLift = { whileHover: { y: -2 }, transition: { type: 'spring', stiffness: 320, damping: 22 } };

  // میانبر Ctrl/⌘+K برای فوکوس سرچ
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Box sx={{ px: .5 }}>
      {/* عنوان بزرگ‌تر */}
      <Typography variant="h6" sx={{ fontWeight: 900, mb: 1, px: .5, fontSize: 18 }}>
        ناوبری
      </Typography>

      {/* سرچ */}
      <TextField
        inputRef={inputRef}
        size="small"
        placeholder="جستجوی ناوبری…  (Ctrl/⌘+K)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 1 }}
        InputProps={{ sx: { height: 40, fontSize: 14 } }}
      />

      <List dense sx={{ py: 0 }}>
        {items.map((item, i) => {
          const isActive = pathname.startsWith(item.to);
          return (
            <ListItem key={i} disablePadding sx={{ mb: .25 }}>
              <m.div {...hoverLift} style={{ width: '100%' }}>
                <ListItemButton
                  component={NavLink}
                  to={item.to}
                  onClick={closeSidebar}
                  sx={{
                    borderRadius: 1.2,
                    px: 1.25,
                    py: 0.75,
                    ...(isActive ? activeSx : {
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                    }),
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: isActive ? theme.palette.primary.main : 'text.secondary',
                      '& svg': { fontSize: 22 }, // آیکون بزرگ‌تر
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>

                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      noWrap: true,
                      fontWeight: isActive ? 900 : 700,
                      fontSize: 15, // متن بزرگ‌تر
                    }}
                  />

                  {/* لایو و بیج */}
                  {item.live && (
                    <Tooltip title="Live">
                      <Chip
                        size="small"
                        label="Live"
                        color="primary"
                        sx={{ mr: .5, fontWeight: 800, fontSize: 11 }}
                      />
                    </Tooltip>
                  )}
                  {item.badge && (
                    <Chip
                      size="small"
                      label={item.badge}
                      sx={{
                        ml: .5,
                        fontWeight: 800,
                        fontSize: 11,
                        bgcolor: alpha(theme.palette.info.main, .18),
                        border: `1px solid ${alpha(theme.palette.info.main, .35)}`
                      }}
                    />
                  )}
                </ListItemButton>
              </m.div>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}
