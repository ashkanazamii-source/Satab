// src/pages/DashboardPage.tsx
import { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import {
  Typography, CircularProgress, Box, Grid, Card, CardActionArea,
  Divider, Stack, Paper, IconButton, Tooltip,
  Chip, TextField,
  Drawer
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ListAltIcon from '@mui/icons-material/ListAlt';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import PublicIcon from '@mui/icons-material/Public';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ApartmentIcon from '@mui/icons-material/Apartment';
import MapIcon from '@mui/icons-material/Map';
import RoomIcon from '@mui/icons-material/Room';
import { TreeView, TreeItem } from '@mui/lab';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import type { Map as LeafletMap } from 'leaflet';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import React from 'react';
import {
  List,
  ListItem, ListItemButton, ListItemIcon, ListItemText
} from '@mui/material';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import PersonOutline from '@mui/icons-material/PersonOutline';
import DirectionsBusFilled from '@mui/icons-material/DirectionsBusFilled';
import AltRouteOutlined from '@mui/icons-material/AltRouteOutlined';
import PaidOutlined from '@mui/icons-material/PaidOutlined';
import BuildOutlined from '@mui/icons-material/BuildOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import 'leaflet/dist/leaflet.css';






// react-leaflet
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
// برای مارکر پیش‌فرض Leaflet در Vite/CRA:
import L from 'leaflet';
import Tilt from '../theme/Tilt';
const defaultIcon = new L.Icon({
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

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


type SAType = 'fleet' | 'device' | 'universal';
const saTypeLabel: Record<SAType, string> = {
  fleet: 'ناوگانی',
  device: 'مدیریت دستگاه',
  universal: 'جامع',
};


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
  const [me, setMe] = useState<{ id: number; role_level: number; full_name: string; sa_type?: SAType | null } | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [saType, setSaType] = useState<SAType | null>(null);
  const [loadingSaType, setLoadingSaType] = useState(true);
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
  const fetchMe = async () => {
    try {
      const { data } = await api.get('/auth/me'); // باید sa_type را هم برگرداند
      setMe(data);
    } catch {
      setMe(null);
    } finally {
      setLoadingMe(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchRoleData();
    fetchMe();             // 👈 فقط همین
  }, []);



  const totals = useMemo(() => ({
    users: summaryData?.totalUsers ?? 0,
    logs: summaryData?.totalLogs ?? 0,
  }), [summaryData]);

  const handleReload = async () => {
    setReloading(true);
    await Promise.all([fetchSummary(), fetchMe()]); // ✅ هر دو
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
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="h4">داشبرد مدیریتی</Typography>

            {!loadingMe && (
              me?.sa_type
                ? <Chip size="small" color="primary" label={`نوع حوزه: ${saTypeLabel[me.sa_type]}`} sx={{ fontWeight: 700 }} />
                : <Chip size="small" variant="outlined" label="نوع حوزه نامشخص" sx={{ opacity: .8 }} />
            )}
          </Stack>

          {/* دکمه رفرش شما */}
          <Tooltip title="به‌روزرسانی">
            <span>
              <IconButton onClick={handleReload} disabled={reloading}>
                <RefreshRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
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
        {!loadingMe && (
          me?.sa_type === 'fleet' ? (
            <Grid item xs={12} sm={6} md={4}><FleetModeActions /></Grid>
          ) : me?.sa_type === 'device' ? (
            <Grid item xs={12} sm={6} md={4}><DeviceModeActions /></Grid>
          ) : (
            // 'universal' یا null/undefined ⇒ جامع
            <Grid item xs={12} sm={6} md={4}><UniversalModeActions /></Grid>
          )
        )}
      </Grid>


    </Box>
  );
}

function FleetModeActions() {
  const theme = useTheme();
  const [driverCount, setDriverCount] = useState<number>(0);
  type ConsumableRow = {
    id: number;
    vehicleId: number;
    mode: 'km' | 'time';
    note: string | null;
    startAt: string | null;
    baseOdometerKm: number | null;
    createdAt: string; // ISO
  };
  const [live, setLive] = React.useState(false);          // وضعیت «لایو بودن» استریم پوزیشن
  const [wsConnected, setWsConnected] = React.useState(false); // وضعیت اتصال سوکت (اختیاری)
  const lastMsgRef = React.useRef<number>(0);             // زمان آخرین پیام پوزیشن (ms)
  const [vehicleCount, setVehicleCount] = useState<number>(0);

  const [markers, setMarkers] = useState<MiniVehicle[]>([]);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const focusMap = React.useCallback((lat: number, lng: number, zoom = 14) => {
    const m = mapRef.current;
    if (!m) return;
    // اگر زوم فعلی کمه، flyTo با زوم؛ وگرنه panTo
    const needsZoom = (m.getZoom?.() ?? 12) < zoom;
    needsZoom ? m.flyTo([lat, lng], zoom, { animate: true }) : m.panTo([lat, lng], { animate: true });
  }, []);
  const POS_TOPIC = (vid: number) => `vehicle/${vid}/pos`;
  const [duLoading, setDuLoading] = useState(false);
  const [duErr, setDuErr] = useState<string | null>(null);
  const [driverUsage, setDriverUsage] = useState<DriverUsageRow[]>([]); const focusDriver = React.useCallback(async (driverId: number) => {
    // 1) از حضور امروز (اگر خودرو دارد)
    const today = driverUsage.find(r => r.driverId === driverId && (r.vehicleId || r.vehiclePlate));
    if (today) {
      const vid = today.vehicleId ?? undefined;
      const m = vid != null
        ? markers.find(x => x.id === vid && x.last_location)
        : markers.find(x => (today.vehiclePlate ?? '').includes(x.plate_no) && x.last_location);
      if (m?.last_location) {
        focusMap(m.last_location.lat, m.last_location.lng);
        return;
      }
    }

    // 2) API اختصاصی لوکیشنِ راننده (اگر داری)
    try {
      const { data } = await api.get(`/drivers/${driverId}/last-location`, { validateStatus: s => s < 500 });
      const lat = Number(data?.lat ?? data?.latitude);
      const lng = Number(data?.lng ?? data?.lon ?? data?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        focusMap(lat, lng);
        return;
      }
    } catch { }

    // 3) API خودرو فعلیِ راننده (اگر داری) → از markers پیدا کن
    try {
      const { data } = await api.get(`/drivers/${driverId}/current-vehicle`, { validateStatus: s => s < 500 });
      const vid = Number(data?.vehicle_id ?? data?.id);
      if (Number.isFinite(vid)) {
        const m = markers.find(x => x.id === vid && x.last_location);
        if (m?.last_location) {
          focusMap(m.last_location.lat, m.last_location.lng);
          return;
        }
      }
    } catch { }

    // 4) فالبک نهایی: اگر هیچ‌کدوم نبود، چیزی نمی‌کنیم یا snackbar نشان بده
    // enqueueSnackbar?.('موقعیت این راننده در دسترس نیست', { variant: 'info' });
  }, [driverUsage, markers, focusMap]);

  const socketRef = React.useRef<Socket | null>(null);
  // مجموعه‌ای از VIDهایی که الان سابسکرایب شده‌ایم
  const posSubsRef = React.useRef<Set<number>>(new Set());

  // هندلر واحد برای پیام‌های موقعیت
  const onVehiclePos = React.useCallback((msg: { vehicle_id: number; lat: number; lng: number; ts?: string | number }) => {
    const { vehicle_id, lat, lng } = msg || ({} as any);
    if (!Number.isFinite(vehicle_id) || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    lastMsgRef.current = Date.now();
    if (!live) setLive(true); // اولین پیام، لایو را روشن کن

    setMarkers(prev => {
      const i = prev.findIndex(m => m.id === vehicle_id);
      if (i === -1) return [...prev, { id: vehicle_id, plate_no: `#${vehicle_id}`, last_location: { lat, lng } }];
      const next = prev.slice();
      next[i] = { ...next[i], last_location: { lat, lng } };
      return next;
    });
  }, [live]);


  useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const s = io(url + '/vehicles', { transports: ['websocket'] });
    socketRef.current = s;

    s.on('vehicle:pos', onVehiclePos);

    s.on('connect', () => { setWsConnected(true); /* اتصال برقرار شد */ });
    s.on('disconnect', () => { setWsConnected(false); setLive(false); });
    s.on('connect_error', () => { setWsConnected(false); setLive(false); });
    s.on('reconnect_failed', () => { setWsConnected(false); setLive(false); });

    return () => {
      try {
        Array.from(posSubsRef.current).forEach(vid => s.emit('unsubscribe', { topic: POS_TOPIC(vid) }));
        posSubsRef.current.clear();
      } catch { }
      s.off('vehicle:pos', onVehiclePos);
      s.off('connect');
      s.off('disconnect');
      s.off('connect_error');
      s.off('reconnect_failed');
      s.disconnect();
      socketRef.current = null;
    };
  }, [onVehiclePos]);

  useEffect(() => {
    const INTERVAL = 5000;  // هر ۵ ثانیه
    const STALE = 15000;    // اگر ۱۵ ثانیه پیام نیامد، آفلاین حساب کن
    const id = setInterval(() => {
      const last = lastMsgRef.current || 0;
      const stale = Date.now() - last > STALE;
      // اگر سوکت هم وصل نیست، مستقیم آفلاین
      if (!wsConnected || stale) {
        if (live) setLive(false);
      }
    }, INTERVAL);
    return () => clearInterval(id);
  }, [wsConnected, live]);

  const fetchVehicles = React.useCallback(async () => {
    setMapLoading(true);
    try {
      const { data } = await api.get('/vehicles', { params: { limit: 200 } })
        .catch(() => ({ data: { items: [] } }));
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const slim: MiniVehicle[] = items.map((v: any) => ({
        id: Number(v.id),
        plate_no: String(v.plate_no ?? v.plate ?? '—'),
        last_location:
          v?.last_location &&
            Number.isFinite(+v.last_location.lat) &&
            Number.isFinite(+v.last_location.lng)
            ? { lat: +v.last_location.lat, lng: +v.last_location.lng }
            : undefined,
      }));
      setMarkers(slim);
    } finally {
      setMapLoading(false);
    }
  }, []);

  // هر بار که لیست خودروها/مارکرها عوض شود، سابسکرایب‌ها همگام شوند
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const have = new Set<number>(markers.map(m => m.id).filter(Number.isFinite));
    const subbed = posSubsRef.current;

    // آن‌ساب آنهایی که دیگر لازم نیست
    subbed.forEach(vid => {
      if (!have.has(vid)) {
        s.emit('unsubscribe', { topic: POS_TOPIC(vid) });
        subbed.delete(vid);
      }
    });

    // سابسکرایب جدیدها
    have.forEach(vid => {
      if (!subbed.has(vid)) {
        s.emit('subscribe', { topic: POS_TOPIC(vid) });
        subbed.add(vid);
      }
    });
  }, [markers]);


  // ====== types & state (بالای کامپوننت، کنار بقیه stateها) ======
  type DriverUsageRow = {
    driverId: number;
    driverName: string;
    vehicleId: number | null;
    vehiclePlate?: string | null;
    startAt: string;        // ISO
    durationSec: number;    // مدت کار به ثانیه
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/vehicles', { params: { limit: 500 } });
        const rows = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        setVehicleCount(rows.length);
      } catch (err) {
        setVehicleCount(0);
      }
    })();
  }, []);

  const fmtTime = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '—';

  const fmtDur = (sec: number) => {
    if (!Number.isFinite(sec) || sec <= 0) return '—';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h ? h + 'ساعت ' : ''}${m}دقیقه`;
  };

  // ====== fetch today usage ======
  const fetchDriverUsageToday = async () => {
    setDuLoading(true); setDuErr(null);
    try {
      const { data } = await api.get('/assignments/today-for-me');
      setDriverUsage(Array.isArray(data) ? data : (data?.items ?? []));
    } catch {
      setDuErr('خطا در دریافت حضور امروز');
    } finally {
      setDuLoading(false);
    }
  };


  useEffect(() => { fetchDriverUsageToday(); }, []);


  // ===== Drivers (زیرمجموعه‌های من) =====
  type FlatUser = {
    id: number;
    full_name: string;
    role_level: number;
  };

  const [drivers, setDrivers] = React.useState<FlatUser[]>([]);
  const [driversLoading, setDriversLoading] = React.useState(false);
  const [driversErr, setDriversErr] = React.useState<string | null>(null);
  const [driverQ, setDriverQ] = React.useState('');

  // ✅ تنها منبع حقیقت: زیرمجموعه‌های من
  const fetchDrivers = React.useCallback(async () => {
    setDriversLoading(true);
    setDriversErr(null);
    try {
      const { data } = await api.get('/users/my-subordinates-flat'); // دامنه‌ی کاربر جاری
      const list: FlatUser[] = Array.isArray(data) ? data : (data?.items ?? []);
      const onlyDrivers = list.filter(u => Number(u.role_level) === 6);
      setDrivers(onlyDrivers);
      // ✅ همین‌جا تعداد راننده‌های زیرمجموعه را ست کن
      setDriverCount(onlyDrivers.length);
    } catch {
      setDriversErr('خطا در دریافت راننده‌ها');
      setDrivers([]);
      setDriverCount(0);
    } finally {
      setDriversLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // ❌ اینجا await لازم نیست
    fetchDrivers();
  }, [fetchDrivers]);

  // فیلتر جستجو (فقط برای نمایش، روی driverCount اثری نمی‌گذاریم)
  const filteredDrivers = React.useMemo(() => {
    const s = driverQ.trim().toLowerCase();
    if (!s) return drivers;
    return drivers.filter(u =>
      (u.full_name || '').toLowerCase().includes(s) ||
      String(u.id).includes(s)
    );
  }, [driverQ, drivers]);


  // === state ها
  const [consLoading, setConsLoading] = useState(false);
  const [consErr, setConsErr] = useState<string | null>(null);
  const [consumables, setConsumables] = useState<ConsumableRow[]>([]);
  type User = { id: number; role_level?: number; full_name?: string };

  // اگر قبلاً لیست خودروها را جایی داری، از همان استفاده کن.
  // در غیراینصورت این مپ را می‌سازیم تا vehicleId → پلاک/نام
  const [vehMap, setVehMap] = useState<Record<number, string>>({});
  const [user, setUser] = useState<User | null>(null);

  // یک بار خودروها را برای نمایش نام/پلاک بخوان
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const { data } = await api.get('/vehicles', { params: { limit: 500 } });
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        const m: Record<number, string> = {};
        for (const v of items) {
          const id = Number(v.id);
          const label = String(v.plate_no ?? v.plate ?? v.name ?? `خودرو ${id}`);
          m[id] = label;
        }
        if (ok) setVehMap(m);
      } catch {
        /* ignore */
      }
    })();
    return () => { ok = false; };
  }, []);
  /*useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/users/super-admin/${user?.id}/subordinates`, { params: { depth: 'all' } });
        const all = Array.isArray(data) ? data : (data?.items ?? []);
        const drivers = all.filter((u: any) => u.role_level === 6);
        setDriverCount(drivers.length);
      } catch (err) {
        setDriverCount(0);
      }
    })();
  }, [user?.id]);*/


  // 2) فراخوانی داخل useEffect بدون await
  React.useEffect(() => {
    fetchDrivers();           // ← اینجا await نمی‌خوایم
  },
    [fetchDrivers]); useEffect(() => {
      let ok = true;
      (async () => {
        setConsLoading(true);
        setConsErr(null);
        try {
          // اگر user.id در دسترسه:
          const { data } = await api.get(`/super-admins/${user?.id}/consumables`, {
            params: { limit: 300 },
          });
          const rows: ConsumableRow[] = Array.isArray(data) ? data : (data?.items ?? []);
          if (ok) setConsumables(rows);
        } catch (e: any) {
          if (ok) setConsErr('خطا در دریافت مصرفی‌ها');
        } finally {
          if (ok) setConsLoading(false);
        }
      })();
      return () => { ok = false; };
    }, [user?.id]);

  type MiniVehicle = { id: number; plate_no: string; last_location?: { lat: number; lng: number } };
  const [mapLoading, setMapLoading] = useState(true);
  const [q, setQ] = useState('');

  type Node = { id: number; name: string; role_level?: number; children?: Node[] };
  const [tree, setTree] = useState<Node | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);


  useEffect(() => {
    let ok = true;

    type Raw = any;
    const toNum = (v: any) => (v == null ? undefined : Number(v));
    const getParentId = (u: Raw) =>
      toNum(u?.parent_id ?? u?.parentId ?? u?.manager_id ?? u?.managerId);
    const getLabel = (u: Raw) =>
      String(u?.full_name ?? u?.name ?? u?.username ?? u?.mobile ?? `کاربر ${u?.id ?? ''}`);

    // نرمال‌سازی درخت از سرور
    const normalizeServerTree = (r: any): Node => ({
      id: Number(r?.id),
      name: String(r?.name ?? r?.full_name ?? r?.username ?? `کاربر ${r?.id ?? ''}`),
      role_level: toNum(r?.role_level),
      children: Array.isArray(r?.children ?? r?.subordinates)
        ? (r.children ?? r.subordinates).map((c: any) => normalizeServerTree(c))
        : [],
    });

    // ساخت از فلت
    const buildTreeFromFlat = (flat: Raw[], rootLabel = 'زیرمجموعه‌های من'): Node => {
      const items = Array.isArray(flat) ? flat : [];
      const map = new Map<number, Node>();
      const roots: Node[] = [];

      for (const u of items) {
        const id = toNum(u?.id);
        if (id == null) continue;
        map.set(id, { id, name: getLabel(u), role_level: toNum(u?.role_level), children: [] });
      }
      for (const u of items) {
        const id = toNum(u?.id);
        if (id == null) continue;
        const pid = getParentId(u);
        const me = map.get(id)!;
        if (pid != null && map.has(pid)) map.get(pid)!.children!.push(me);
        else roots.push(me);
      }
      return { id: 0, name: rootLabel, children: roots };
    };

    // فقط نودهایی را نگه دار که خودشون role=6 هستند یا زیرشاخه‌شان دارد
    const keepIfHasRole = (node: Node | null | undefined, target = 6): Node | null => {
      if (!node) return null;
      const kids = Array.isArray(node.children) ? node.children : [];
      const keptKids = kids.map(ch => keepIfHasRole(ch, target)).filter(Boolean) as Node[];
      const isTarget = Number(node.role_level) === target;
      if (!isTarget && keptKids.length === 0) return null;
      return { ...node, children: keptKids };
    };

    const normalizeList = (res: any) =>
      Array.isArray(res?.data?.items) ? res.data.items : Array.isArray(res?.data) ? res.data : [];

    // --- vehicles ---
    (async () => {
      try {
        setMapLoading(true);
        const res = await api
          .get('/vehicles', { params: { limit: 200 } })
          .catch(() => ({ data: { items: [] } }));
        const items = normalizeList(res);
        const slim: MiniVehicle[] = items.map((v: any) => ({
          id: Number(v.id),
          plate_no: String(v.plate_no ?? v.plate ?? '—'),
          last_location:
            v?.last_location &&
              Number.isFinite(+v.last_location.lat) &&
              Number.isFinite(+v.last_location.lng)
              ? { lat: +v.last_location.lat, lng: +v.last_location.lng }
              : undefined,
        }));
        if (ok) setMarkers(slim);
      } finally {
        if (ok) setMapLoading(false);
      }
    })();

    // --- me + tree ---
    (async () => {
      try {
        setTreeLoading(true);
        const { data: me } = await api.get('/auth/me');
        if (ok) setUser(me);

        // تابع کمکی برای set کردن با prune
        const setWithPrune = (root: Node) => {
          const pruned = keepIfHasRole(root, 6);
          if (ok) {
            setTree(pruned ?? { id: 0, name: 'راننده‌ای یافت نشد', children: [] });
          }
        };

        if (me?.role_level === 1) {
          const flatRes = await api.get('/users/my-subordinates-flat').catch(() => ({ data: [] }));
          const flat = normalizeList(flatRes);
          const rootLabel = me?.full_name ? `زیرمجموعه‌های ${me.full_name}` : 'زیرمجموعه‌های من';
          const treeBuilt = buildTreeFromFlat(flat, rootLabel);
          setWithPrune(treeBuilt); // 👈 prune
          return;
        }

        // تلاش برای درخت سرور
        const treeRes = await api.get(`/users/hierarchy/${me?.id}`).catch(() => null);
        const serverTree = treeRes?.data;

        if (serverTree && (serverTree.children?.length || serverTree.subordinates?.length || serverTree.name || serverTree.full_name)) {
          const normalized = normalizeServerTree(serverTree);
          if (!normalized.name) {
            normalized.name = me?.full_name ? `زیرمجموعه‌های ${me.full_name}` : 'زیرمجموعه‌های من';
          }
          setWithPrune(normalized); // 👈 prune
          return;
        }

        // fallback: ساخت از فلت
        const flatRes = await api.get('/users/my-subordinates-flat').catch(() => ({ data: [] }));
        const flat = normalizeList(flatRes);
        const rootLabel = me?.full_name ? `زیرمجموعه‌های ${me.full_name}` : 'زیرمجموعه‌های من';
        const treeBuilt = buildTreeFromFlat(flat, rootLabel);
        setWithPrune(treeBuilt); // 👈 prune
      } finally {
        if (ok) setTreeLoading(false);
      }
    })();

    return () => {
      ok = false;
    };
  }, []);

  const filteredMarkers = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return markers;
    return markers.filter((m) => m.plate_no.toLowerCase().includes(s));
  }, [q, markers]);

  const renderNode = (n: Node) => (
    <TreeItem
      key={n.id}
      nodeId={String(n.id)}
      label={
        <Stack direction="row" alignItems="center" spacing={1}>
          {n.children?.length ? <ApartmentIcon fontSize="small" /> : <PersonOutlineIcon fontSize="small" />}
          <Typography variant="body2">{n.name}</Typography>
          {!!n.role_level && <Chip size="small" variant="outlined" label={`RL${n.role_level}`} sx={{ ml: 0.5 }} />}
        </Stack>
      }
    >
      {Array.isArray(n.children) && n.children.map(renderNode)}
    </TreeItem>
  );

  const firstWithLoc = filteredMarkers.find((m) => m.last_location);
  const center: [number, number] = firstWithLoc?.last_location
    ? [firstWithLoc.last_location.lat, firstWithLoc.last_location.lng]
    : [35.6892, 51.389]; // تهران
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const openSidebar = () => setSidebarOpen(true);
  const closeSidebar = () => setSidebarOpen(false);

  return (

    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        gridTemplateRows: '64px 1fr',                 // 1) نوار بالا  2) محتوای اصلی
        gridTemplateColumns: '1fr',
        gap: 2,
        p: 2,
        bgcolor: 'background.default',
        direction: 'rtl',
        boxSizing: 'border-box',
      }}
    >
      <Drawer
        anchor="left" // ⬅️ مهم: تعیین می‌کند که از راست باز شود
        open={sidebarOpen}
        onClose={closeSidebar}
        PaperProps={{
          sx: { width: 260, p: 1.5, direction: 'rtl' }
        }}
      >
        <Typography variant="subtitle1" sx={{ mb: .5, px: .5 }}>ناوبری</Typography>
        <List dense>
          {[
            { label: 'داشبورد', icon: <DashboardOutlined />, to: '/dashboard' },
            { label: 'مدیریت نقش‌ها', icon: <GroupsIcon />, to: '/role-management' },
            { label: 'مدیریت راننده/ناوگان', icon: <DirectionsCarIcon />, to: '/driver-management' },
            { label: 'تحلیل‌ها', icon: <InsightsRoundedIcon />, to: '/analytics' },
            { label: 'لاگ‌ها', icon: <ListAltIcon />, to: '/logs' },
            { label: 'گفتگو', icon: <ChatRoundedIcon />, to: '/chat' },
            { label: 'تعریف خط', icon: <AltRouteOutlined />, to: '/define-line' },
            { label: 'تعیین شیفت‌ها', icon: <CalendarMonthRoundedIcon />, to: '/shifts' },

          ].map((item, i) => (
            <ListItem key={i} disablePadding>
              <ListItemButton
                component="a"
                href={item.to}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeSidebar}     // ← تب جدید باز می‌شود و سایدبارِ فعلی هم بسته می‌شود
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>


      </Drawer>

      {/* ==== Topbar (both columns) ==== */}
      <Paper
        elevation={0}
        sx={{
          gridColumn: '1 / -1',
          gridRow: '1',
          px: 2, py: 1.25,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h5" sx={{ fontWeight: 800 }}>داشبورد</Typography>
        </Stack>


      </Paper>

      {/* ==== Main content (left) ==== */}
      <Box
        sx={{
          gridColumn: { xs: '1', lg: '1' },
          gridRow: '2',
          display: 'grid',
          gridTemplateRows: 'auto 1fr',     // ردیف ۱: کارت‌های KPI ، ردیف ۲: بقیه
          gap: 2,
          minHeight: 0,
        }}
      >
        {/* === KPI cards row === */}

          <Box
            component="section"
            sx={{
              direction: 'rtl',
              display: 'grid',
              gap: 2,
              gridAutoRows: 'min-content',            // ردیف‌ها به اندازه محتوا
              alignItems: 'start',
              alignContent: 'start',
              gridTemplateColumns: {                  // ستون‌های واکنش‌گرا
                xs: 'repeat(2, minmax(160px, 1fr))',
                sm: 'repeat(3, minmax(160px, 1fr))',
                md: 'repeat(4, minmax(160px, 1fr))',
                lg: 'repeat(6, minmax(160px, 1fr))',
              },
            }}
          >
            {[
              { title: 'تعداد راننده‌ها', value: driverCount },   // ← عدد واقعی
              { title: 'تعداد ماشین‌ها', value: vehicleCount },  // ← عدد واقعی
            ].map((k, i) => (
              <Paper key={i} sx={{ p: 2, display: 'block' }}>
                <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1 }}>
                  {Number.isFinite(k.value as number)
                    ? Number(k.value).toLocaleString('fa-IR')
                    : '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {k.title}
                </Typography>
              </Paper>
            ))}
          </Box>


        {/* content grid like the mock */}
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, // چپ: نقشه | راست: نمودار/پنل
            gridTemplateRows: 'minmax(320px, 1fr) auto',        // ردیف ۱: نقشه/نمودار  ردیف ۲: جداول
            minHeight: 0,
          }}
        >
          {/* ⬅️ Live map */}
          <Paper
            sx={{
              gridColumn: { xs: '1', md: '1' },
              gridRow: '1',
              p: 1.5,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">نقشه زنده</Typography>
              <Stack direction="row" spacing={1}>



                {/* دکمه فقط وقتی استریم لایو نیست */}
                {!live && (
                  <Tooltip title="به‌روزرسانی (استریم زنده فعال نیست)">
                    <span>
                      <IconButton
                        size="small"
                        onClick={fetchVehicles}   // همون تابعی که دستی از API می‌کشه
                        disabled={mapLoading}
                      >
                        {mapLoading ? <CircularProgress size={16} thickness={5} /> : <RefreshRoundedIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </Stack>


            </Stack>

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                borderRadius: 1,
                overflow: 'hidden',
                border: (t) => `1px solid ${alpha(t.palette.divider, 0.6)}`,
              }}
            >
              <MapContainer center={center} zoom={12} minZoom={3} style={{ width: '100%', height: '100%' }} whenCreated={(m) => (mapRef.current = m)}   // +++ این خط
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                {filteredMarkers
                  .filter((m) => m.last_location)
                  .map((m) => (
                    <Marker key={m.id} position={[m.last_location!.lat, m.last_location!.lng]}>
                      <Popup>
                        <strong>{m.plate_no}</strong>
                        <br />
                        <small>ID: {m.id}</small>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            </Box>
          </Paper>

          {/* ➡️ Drivers (role=6) list for current SA */}
          <Paper
            dir="rtl" // این ویژگی جهت کلی کامپوننت را روی راست-به-چپ تنظیم می‌کند
            sx={{
              gridColumn: { xs: '1', md: '2' },
              gridRow: '1',
              p: 1.5,
              display: 'flex',
              flexDirection: 'column',
              // نیازی به textAlign در اینجا نیست چون dir="rtl" کار را انجام می‌دهد
            }}
          >
            {/* بخش هدر و جستجو */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ mb: 1, justifyContent: 'flex-end' }} // همه آیتم‌ها را به سمت راست هول می‌دهد
            >
              <Typography variant="subtitle1">راننده‌های زیرمجموعه</Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  placeholder="جستجو‌ی نام راننده…"
                  value={driverQ}
                  onChange={(e) => setDriverQ(e.target.value)}
                  sx={{ width: 220 }}
                  // InputProps برای استایل‌دهی به متن داخل فیلد استفاده می‌شود
                  InputProps={{ sx: { textAlign: 'right' } }}
                />
                <Tooltip title="به‌روزرسانی">
                  <span>
                    <IconButton size="small" onClick={fetchDrivers} disabled={driversLoading}>
                      <RefreshRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>

            {/* بخش جدول */}
            <Box sx={{ flex: 1, minHeight: 0, border: '1px dashed', borderColor: 'divider', borderRadius: 1, overflow: 'auto' }}>
              {driversLoading ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>در حال بارگذاری…</Typography>
              ) : driversErr ? (
                <Typography variant="body2" color="error" sx={{ p: 1 }}>{driversErr}</Typography>
              ) : filteredDrivers.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>راننده‌ای یافت نشد.</Typography>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>نام</th>
                      <th style={{ padding: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>شناسه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrivers.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => focusDriver(u.id)}   // 👈 کلیک‌هندلر
                        style={{ cursor: 'pointer' }}       // 👈 نشانگرِ کلیک‌پذیر
                        role="button"                       // (اختیاری) برای دسترس‌پذیری
                        tabIndex={0}                        // (اختیاری)
                      >
                        <td style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,0.08)', textAlign: 'right' }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <span>{u.full_name}</span>
                            <PersonOutlineIcon fontSize="small" />
                          </Stack>
                        </td>
                        <td style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,0.08)', textAlign: 'right' }}>
                          <span dir="ltr">{u.id}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                </table>
              )}
            </Box>
          </Paper>



          {/* ⬅️ Recent incidents */}
          {/* ====== Drivers used today ====== */}
          <Paper sx={{ gridColumn: { xs: '1', md: '1' }, gridRow: '2', p: 1.5, direction: 'rtl' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">حضور راننده‌ها امروز</Typography>
              <Tooltip title="به‌روزرسانی">
                <span>
                  <IconButton size="small" onClick={fetchDriverUsageToday} disabled={duLoading}>
                    <RefreshRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>

            <Box sx={{ overflow: 'auto', border: (t) => `1px dashed ${t.palette.divider}`, borderRadius: 1 }}>
              {duLoading ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>در حال بارگذاری…</Typography>
              ) : duErr ? (
                <Typography variant="body2" color="error" sx={{ p: 1 }}>{duErr}</Typography>
              ) : driverUsage.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>رکوردی برای امروز نیست.</Typography>
              ) : (
                <table dir="rtl" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'right', padding: 8, whiteSpace: 'nowrap' }}>نام راننده</th>
                      <th style={{ textAlign: 'right', padding: 8, whiteSpace: 'nowrap' }}>خودرو</th>
                      <th style={{ textAlign: 'right', padding: 8, whiteSpace: 'nowrap' }}>شروع کار</th>
                      <th style={{ textAlign: 'right', padding: 8, whiteSpace: 'nowrap' }}>مدت کار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverUsage.map((r) => {
                      const plate = r.vehiclePlate ?? (r.vehicleId ? (vehMap[r.vehicleId] ?? `#${r.vehicleId}`) : '—');
                      return (
                        <tr key={`${r.driverId}-${r.startAt}`}>
                          <td style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>{r.driverName}</td>
                          <td style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>{plate}</td>
                          <td style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>{fmtTime(r.startAt)}</td>
                          <td style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>{fmtDur(r.durationSec)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Box>
          </Paper>

          {/* ➡️ Alerts */}
          <Paper sx={{ gridColumn: { xs: '1', md: '2' }, gridRow: '2', p: 1.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">مصرفی‌ها</Typography>
              <Stack direction="row" spacing={1}>
                <Tooltip title="به‌روزرسانی">
                  <span>
                    <IconButton
                      size="small"
                      onClick={async () => {
                        setConsLoading(true);
                        setConsErr(null);
                        try {
                          const { data } = await api.get(`/super-admins/${user?.id}/consumables`, { params: { limit: 300 } });
                          const rows: ConsumableRow[] = Array.isArray(data) ? data : (data?.items ?? []);
                          setConsumables(rows);
                        } catch {
                          setConsErr('خطا در دریافت مصرفی‌ها');
                        } finally {
                          setConsLoading(false);
                        }
                      }}
                      disabled={consLoading}
                    >
                      <RefreshRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>

            <Box sx={{ overflow: 'auto' }}>
              {consLoading ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                  در حال بارگذاری…
                </Typography>
              ) : consErr ? (
                <Typography variant="body2" color="error" sx={{ p: 1 }}>
                  {consErr}
                </Typography>
              ) : consumables.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                  داده‌ای یافت نشد.
                </Typography>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'right', padding: 8, whiteSpace: 'nowrap' }}>تاریخ</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>خودرو</th>
                      <th style={{ textAlign: 'right', padding: 8, whiteSpace: 'nowrap' }}>حالت</th>
                      <th style={{ textAlign: 'right', padding: 8, whiteSpace: 'nowrap' }}>شروع/کیلومتر مبنا</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>یادداشت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumables.map((c) => {
                      const veh = vehMap[c.vehicleId] ?? `#${c.vehicleId}`;
                      const dateStr = new Date(c.createdAt).toLocaleString('fa-IR');
                      const modeLabel = c.mode === 'km' ? 'مسافت (km)' : 'زمانی';
                      const baseLabel =
                        c.mode === 'km'
                          ? (c.baseOdometerKm ?? '—')
                          : (c.startAt ? new Date(c.startAt).toLocaleString('fa-IR') : '—');

                      return (
                        <tr key={c.id}>
                          <td style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>{dateStr}</td>
                          <td style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>{veh}</td>
                          <td style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>{modeLabel}</td>
                          <td style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>{String(baseLabel)}</td>
                          <td style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,0.08)', maxWidth: 320 }}>
                            <span style={{ display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
                              {c.note ?? '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Box>
          </Paper>

        </Box>
      </Box>


      {/* ناحیه‌ی نامرئی برای هاور در لبه‌ی راست */}
      <Box
        onMouseEnter={openSidebar}
        sx={{
          position: 'fixed',
          top: 64,              // زیر تاپ‌بار 64px
          left: 0,
          width: 16,            // پهنای لبه‌ی حساس
          height: 'calc(100vh - 64px)',
          zIndex: (t) => t.zIndex.drawer + 1,
          cursor: 'pointer',
        }}
      />

      {/* دکمه‌ی همبرگری شناور در سمت چپ */}
      <IconButton
        onClick={openSidebar}
        aria-label="باز کردن ناوبری"
        sx={{
          position: 'fixed',
          top: 20,
          left: 20, // ⬅️ تغییر اصلی اینجا بود
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          boxShadow: 1,
          '&:hover': { bgcolor: 'background.default' },
        }}
      >
        <MenuRoundedIcon />
      </IconButton>

    </Box>
  );




}



function DeviceModeActions() {
  return (
    <>

    </>
  );
}

function UniversalModeActions() {
  // جامع = هر دو مجموعه. اگر خواستی اینجا اختلاف‌ها رو کاستوم کن
  return (
    <>
      <FleetModeActions />
      <DeviceModeActions />
    </>
  );
}
