// src/pages/DashboardPage.tsx
import { useEffect, useState, useMemo } from 'react';
import api from '../services/api';

import {
  Typography, CircularProgress, Box, Grid, Card, CardActionArea,
  Divider, Stack, Paper, IconButton, Tooltip
} from '@mui/material';

import GroupsIcon from '@mui/icons-material/Groups';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ListAltIcon from '@mui/icons-material/ListAlt';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';

import { alpha, keyframes, useTheme } from '@mui/material/styles';

/* ====== انیمیشن‌ها و افکت‌ها ====== */
const shimmer = keyframes`
  0% { background-position: 0% 50% }
  50% { background-position: 100% 50% }
  100% { background-position: 0% 50% }
`;
const floatY = keyframes`
  0% { transform: translateY(0) }
  50% { transform: translateY(-2px) }
  100% { transform: translateY(0) }
`;
const glowPulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(99,102,241,.25) }
  70% { box-shadow: 0 0 0 10px rgba(99,102,241,0) }
  100% { box-shadow: 0 0 0 0 rgba(99,102,241,0) }
`;

/* قاب گرادیانی شیشه‌ای */
const fancyBorder = (theme: any) => ({
  border: '1px solid transparent',
  borderRadius: 14,
  background: `
    linear-gradient(${alpha(theme.palette.background.paper, .75)}, ${alpha(theme.palette.background.paper, .75)}) padding-box,
    linear-gradient(120deg, rgba(99,102,241,.5), rgba(236,72,153,.45), rgba(16,185,129,.45)) border-box
  `,
  backdropFilter: 'blur(8px)',
  backgroundClip: 'padding-box, border-box',
  backgroundOrigin: 'border-box',
  backgroundSize: '200% 200%, 200% 200%',
  animation: `${shimmer} 10s ease infinite`,
});

/* فرمت اعداد فارسی */
const nfFa = new Intl.NumberFormat('fa-IR');
const fmtFa = (v: number | string | undefined) =>
  typeof v === 'number' ? nfFa.format(v) : (v ?? '-');

/* کارت عددی (متریک) */
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode; label: string; value?: number;
}) {
  const theme = useTheme();
  return (
    <Paper elevation={0} sx={{ ...fancyBorder(theme), p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 46, height: 46, borderRadius: '14px',
            display: 'grid', placeItems: 'center',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, .25)}, ${alpha(theme.palette.secondary.main, .25)})`,
            boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, .15)}`,
            animation: `${floatY} 2.6s ease-in-out infinite`,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.1 }}>
            {fmtFa(value as any)}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

/* کارت اقدام سریع */
function ActionCard({
  icon, title, desc, onClick,
}: { icon: React.ReactNode; title: string; desc: string; onClick: () => void; }) {
  const theme = useTheme();
  return (
    <Card elevation={0} sx={{
      ...fancyBorder(theme),
      transition: 'transform .18s ease, box-shadow .18s ease',
      '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 16px 36px ${alpha(theme.palette.primary.main, .18)}` },
    }}>
      <CardActionArea onClick={onClick} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{
            width: 42, height: 42, borderRadius: 2,
            display: 'grid', placeItems: 'center',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, .22)}, ${alpha(theme.palette.secondary.main, .22)})`,
          }}>
            {icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={800}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">{desc}</Typography>
          </Box>
          <ArrowForwardRoundedIcon sx={{ opacity: .7 }} />
        </Stack>
      </CardActionArea>
    </Card>
  );
}

export default function DashboardPage() {
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [reloading, setReloading] = useState(false);
  const theme = useTheme();

  const fetchSummary = async () => {
    try {
      const res = await api.get('/dashboard/summary');
      setSummaryData(res.data);
    } catch (err) {
      console.error('❌ خطا در دریافت داشبرد:', err);
      setSummaryData(null);
    } finally {
      setLoadingSummary(false);
    }
  };
  const fetchRoleData = async () => {
    try {
      await api.get('/dashboard/role-management');
    } catch (err) {
      console.error('❌ خطا در دریافت افراد و نقش‌ها:', err);
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchRoleData();
  }, []);

  const totals = useMemo(() => ({
    users: summaryData?.totalUsers ?? 0,
    logs: summaryData?.totalLogs ?? 0,
  }), [summaryData]);

  const handleReload = async () => {
    setReloading(true);
    await fetchSummary();
    setReloading(false);
  };

  if (loadingSummary || loadingRoles) {
    return (
      <Box
        sx={{
          height: '65vh',
          display: 'grid',
          placeItems: 'center',
          background: `radial-gradient(80% 60% at 50% 0%, ${alpha(theme.palette.primary.main, .12)} 0%, transparent 60%)`,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!summaryData) {
    return (
      <Box p={3}>
        <Paper sx={{ p: 3, ...fancyBorder(theme) }}>
          <Typography variant="h6" fontWeight={800} gutterBottom>
            مشکلی پیش آمده
          </Typography>
          <Typography color="text.secondary" gutterBottom>
            داده‌ای برای نمایش پیدا نشد. لطفاً مجدداً تلاش کنید.
          </Typography>
          <IconButton onClick={handleReload} sx={{ mt: 1 }}><RefreshRoundedIcon /></IconButton>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      p={3}
      sx={{
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          background: `
            radial-gradient(60% 50% at 100% 0%, ${alpha(theme.palette.secondary.main, .10)} 0%, transparent 60%),
            radial-gradient(70% 55% at 0% 15%, ${alpha(theme.palette.primary.main, .12)} 0%, transparent 65%)
          `,
          filter: 'blur(0.5px)',
        },
      }}
    >
      {/* هدر با اکشن رفرش */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ display: 'grid', placeItems: 'center' }}>
            <CelebrationRoundedIcon
              sx={{
                fontSize: 28,
                color: theme.palette.primary.main,
                animation: `${glowPulse} 2.2s ease-in-out infinite`,
              }}
            />
          </Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 900,
              background: 'linear-gradient(90deg,#6366F1,#EC4899,#22C55E)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              backgroundSize: '220% 220%',
              animation: `${shimmer} 12s ease infinite`,
            }}
          >
            داشبرد مدیریتی
          </Typography>
        </Stack>

        <Tooltip title="به‌روزرسانی">
          <span>
            <IconButton onClick={handleReload} disabled={reloading}>
              <RefreshRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* متریک‌ها: فقط تعداد کاربران و لاگ‌ها */}
      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} sm={6} md={6}>
          <StatCard
            icon={<GroupsIcon />}
            label="تعداد کاربران"
            value={totals.users}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={6}>
          <StatCard
            icon={<ListAltIcon />}
            label="کل لاگ‌ها"
            value={totals.logs}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3, opacity: .5 }} />

      {/* ابزارهای مدیریتی */}
      <Typography variant="h5" fontWeight={900} mb={2}>🛠 ابزارهای مدیریتی</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <ActionCard
            icon={<GroupsIcon />}
            title="کنترل افراد و نقش‌ها"
            desc="مدیریت سطوح دسترسی، نقش‌ها و زیرمجموعه‌ها"
            onClick={() => window.open('/role-management', '_blank', 'noopener,noreferrer')}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <ActionCard
            icon={<DirectionsCarIcon />}
            title="مدیریت راننده‌ها"
            desc="مسیرها، موقعیت زنده و کنترل مسیرهای حرکتی"
            onClick={() => window.open('/driver-management', '_blank', 'noopener,noreferrer')}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <ActionCard
            icon={<ListAltIcon />}
            title="لاگ سیستم"
            desc="مشاهده گزارش‌ها و لاگ‌های کاربران و سیستم"
            onClick={() => window.open('/logs', '_blank', 'noopener,noreferrer')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <ActionCard
            icon={<InsightsRoundedIcon />}
            title="تحلیل داده"
            desc="گزارش‌های تحلیلی و داشبوردهای پیشرفته"
            onClick={() => window.open('/analytics', '_blank', 'noopener,noreferrer')}
          />
        </Grid>
        {/* کارت چت: تب جدید */}
        <Grid item xs={12} sm={6} md={4}>
          <ActionCard
            icon={<ChatRoundedIcon />}
            title="چت"
            desc="گفت‌وگو و پشتیبانی لحظه‌ای"
            onClick={() => window.open('/chat', '_blank', 'noopener,noreferrer')}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
