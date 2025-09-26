'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ButtonGroup, Collapse } from '@mui/material';
import {
  Box, Typography, CircularProgress, Paper, IconButton, Chip, ListItemAvatar, Accordion, AccordionSummary, AccordionDetails, Divider,
  List, ListItem, ListItemText, Avatar, Stack, TextField, InputAdornment, Tabs, Tab, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
// مطمئن شو این ایمپورت را داری:
import { Pane } from 'react-leaflet';
import * as L from 'leaflet';
import SearchIcon from '@mui/icons-material/Search';
import { Checkbox, ListItemButton, } from '@mui/material';
import api from '../services/api';
import './mapStyles.css';
import { lineString, buffer as turfBuffer } from '@turf/turf';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvent } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { io, Socket } from 'socket.io-client';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { LocalizationProvider } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import 'dayjs/locale/fa';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import Grid2 from '@mui/material/Unstable_Grid2';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { AdapterDateFnsJalali } from '@mui/x-date-pickers/AdapterDateFnsJalali';
import faIR from 'date-fns-jalali/locale/fa-IR';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { ListItemIcon } from '@mui/material';
import { Circle, Polyline } from 'react-leaflet';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddRoadIcon from '@mui/icons-material/AddRoad';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import CloseIcon from '@mui/icons-material/Close';
import UndoIcon from '@mui/icons-material/Undo';
import SaveIcon from '@mui/icons-material/Save';
import ClearIcon from '@mui/icons-material/Clear';
import AddIcon from '@mui/icons-material/Add';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { Polygon } from 'react-leaflet';
import { alpha } from '@mui/material/styles';
import PowerSettingsNewRoundedIcon from '@mui/icons-material/PowerSettingsNewRounded';
import AvTimerRoundedIcon from '@mui/icons-material/AvTimerRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import DeviceThermostatRoundedIcon from '@mui/icons-material/DeviceThermostatRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import AddLocationAltRoundedIcon from '@mui/icons-material/AddLocationAltRounded';
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded';
import { Card, CardActionArea, CardContent, CardHeader, Grow, Zoom } from '@mui/material';
import { darken } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import DownloadIcon from '@mui/icons-material/Download'; // آیکون جدید برای دکمه بارگذاری
import * as turf from '@turf/turf';
import { CircleMarker } from 'react-leaflet';
import type { Feature, MultiPolygon } from 'geojson';
import type { AllGeoJSON } from '@turf/helpers';
import ReplayIcon from '@mui/icons-material/Replay';
import StopIcon from '@mui/icons-material/Stop';

// ✅ تایپ نقشه از خود useMap
const MAP_COLORS = {
  track: '#1f7a1f', // سبز مسیر طی‌شده
  trackGlow: '#8fd98f',
  liveTail: '#0b4410',
  route: '#0e5ec9', // آبی خود مسیر تعریف‌شده
  corridor: '#8ab4f8', // کریدور مسیر (淡)
  geofence: '#1565c0',   // خط مرز آبی
  geofenceFill: '#bbdefb',   // آبی کم‌رنگ داخل
  station: '#ff8c00', // ایستگاه‌ها
  stationFill: '#ffe4c2',
  violation: '#7b1fa2', // بنفش نقاط تخلف
};

type RLMap = ReturnType<typeof useMap>;
const ACC = '#00c6be'; // فیروزه‌ای اکسنت، نه رو کل UI
const royal = '#00c6be'; // فیروزه‌ای اکسنت، نه رو کل UI
import { point, featureCollection } from '@turf/helpers';
import convex from '@turf/convex';
import concave from '@turf/concave';
import buffer from '@turf/buffer';

type LL = { lat: number; lng: number };

function autoFenceFromPoints(
  pts: LL[],
  mode: 'convex' | 'concave' = 'concave',
  concavity = 1.5,         // هرچه کمتر، تیزتر
  bufferMeters = 50        // حاشیه اختیاری
) {
  if (!pts?.length) return null;
  const fc = featureCollection(pts.map(p => point([p.lng, p.lat])));
  let poly: any = (mode === 'concave' ? concave(fc, { maxEdge: concavity }) : null) || convex(fc);
  if (!poly) return null;
  if (bufferMeters > 0) poly = buffer(poly, bufferMeters, { units: 'meters' });

  const ring: [number, number][] = poly.geometry.coordinates[0]; // [lng,lat]
  const fencePts = ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
  return { type: 'polygon' as const, points: fencePts, tolerance_m: 15 };
}



const breath = keyframes`
  0%,100% { box-shadow: 0 10px 24px rgba(0,198,190,.12); }
  50%     { box-shadow: 0 18px 42px rgba(0,198,190,.28); }
`;

// شیمِر برای نوار اکسنت کنار کارت
const shimmer = keyframes`
  0% { background-position: 0% 50% }
  100% { background-position: 100% 50% }
`;

// حرکت خیلی لطیف برای «زنده» بودن
const floatY = keyframes`
  0%,100% { transform: translateY(0) }
  50%     { transform: translateY(-2px) }
`;

// برای هایلایت موضعی (نور نقطه‌ای زیر موس)
const onCardPointerMove = (e: React.MouseEvent<HTMLElement>) => {
  const el = e.currentTarget as HTMLElement;
  const r = el.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  el.style.setProperty('--spot-x', `${x}px`);
  el.style.setProperty('--spot-y', `${y}px`);

  // تیلت خیلی سبک
  const dx = (x / r.width) - 0.5;
  const dy = (y / r.height) - 0.5;
  el.style.setProperty('--tilt-x', `${(-dy * 4).toFixed(2)}deg`);
  el.style.setProperty('--tilt-y', `${(dx * 4).toFixed(2)}deg`);
};
const onCardPointerLeave = (e: React.MouseEvent<HTMLElement>) => {
  const el = e.currentTarget as HTMLElement;
  el.style.removeProperty('--spot-x');
  el.style.removeProperty('--spot-y');
  el.style.setProperty('--tilt-x', '0deg');
  el.style.setProperty('--tilt-y', '0deg');
};
type UserNode = {
  id: number;
  full_name?: string;
  role_level: number;
  subordinates?: UserNode[];
};
// --- AI Compliance Types (STEP 1) ---
type BoolUnknown = boolean | null;

export type AiComplianceReason =
  | "UNKNOWN"
  | "OK"               // روی مسیر و داخل ژئوفنس
  | "OFF_ROUTE"        // خارج از مسیر
  | "OUT_OF_FENCE"     // خارج از ژئوفنس
  | "IDLE_OFF_ROUTE"   // ایست/درجا خارج از مسیر
  | "LOW_CONFIDENCE";  // عدم قطعیت بالا

export interface AiComplianceStatus {
  onRoute: BoolUnknown;        // روی مسیر هست؟
  routeDistM: number | null;   // فاصله تا مسیر (متر)
  inFence: BoolUnknown;        // داخل ژئوفنس هست؟
  fenceDistM: number | null;   // فاصله تا مرز ژئوفنس (متر؛ منفی یعنی داخل)
  confidence: number | null;   // 0..1
  reason: AiComplianceReason;  // دلیل نهایی
  lastChangeAt: number | null; // epoch ms زمان آخرین تغییر وضعیت
  lastUpdateAt: number | null; // epoch ms آخرین آپدیت دریافتی
}

const defaultAiStatus = (): AiComplianceStatus => ({
  onRoute: null,
  routeDistM: null,
  inFence: null,
  fenceDistM: null,
  confidence: null,
  reason: "UNKNOWN",
  lastChangeAt: null,
  lastUpdateAt: null,
});


function levelsOf(root: UserNode): UserNode[][] {
  const res: UserNode[][] = [];
  let q: UserNode[] = [root];
  while (q.length) {
    res.push(q);
    q = q.flatMap(n => n.subordinates || []);
  }
  return res;
}
function TileCard({
  u,
  isRoot = false,
  onEdit, onDelete, onEditVehiclePolicy, onGrantMonitors,
  currentUserId, currentUserRoleLevel, canDelete,
}: {
  u: UserNode;
  isRoot?: boolean;
  onEdit?: (u: UserNode) => void;
  onDelete?: (u: UserNode) => void;
  onEditVehiclePolicy?: (u: UserNode) => void;
  onGrantMonitors?: (u: UserNode) => void;
  currentUserId?: number;
  currentUserRoleLevel?: number;
  canDelete?: boolean;
}) {
  const roleColor =
    u.role_level === 2 ? royal.c2 :
      u.role_level === 1 ? '#60A5FA' : royal.c1;

  return (
    <Paper
      elevation={0}
      sx={(t) => ({
        position: 'relative',
        borderRadius: 14,
        width: 'min(240px, 28vw)',
        aspectRatio: '1 / 1',              // 👈 مربعی
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflow: 'hidden',
        ...fancyBorderRoyal(t),
        boxShadow: `0 10px 20px ${alpha(royal.c2, .08)}`,
        transition: 'transform .18s ease, box-shadow .18s ease, background .3s ease',
        backgroundBlendMode: 'overlay',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 18px 36px ${alpha(royal.c2, .20)}`,
          background: `
            linear-gradient(135deg, ${royal.c1}14, ${royal.c2}14) border-box
          `,
        },
      })}
    >
      {/* اکشن‌ها */}
      <Stack direction="row" gap={0.5} sx={{ position: 'absolute', top: 6, left: 6 }}>
        {onEditVehiclePolicy && currentUserRoleLevel === 1 && u.role_level === 2 && (
          <Tooltip title="سهمیه و مجوز ماشین‌ها">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEditVehiclePolicy(u); }}>
              <DirectionsBusIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {onGrantMonitors && currentUserRoleLevel === 2 && u.role_level > 2 && (
          <Tooltip title="واگذاری پرمیشن‌های مانیتورینگ">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onGrantMonitors(u); }}>
              <DirectionsBusIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {onDelete && u.id !== currentUserId && (
          ((currentUserRoleLevel === 1 && u.role_level > 1) ||
            (currentUserRoleLevel === 2 && canDelete && u.role_level > 2)) && (
            <Tooltip title="حذف کاربر">
              <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDelete(u); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )
        )}

        {((currentUserRoleLevel === 2 && u.role_level > 2 && u.id !== currentUserId) ||
          (currentUserRoleLevel === 1 && u.role_level === 2)) && (
            <Tooltip title="ویرایش کاربر">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit?.(u); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
      </Stack>

      {/* محتوا */}
      <Stack spacing={1} alignItems="center" sx={{ px: 1.25, textAlign: 'center' }}>
        <Avatar
          sx={{
            width: 44, height: 44,
            background: `linear-gradient(135deg, ${royal.c1}, ${royal.c2})`,
            border: '2px solid #fff',
            animation: isRoot ? `${glow} 1.8s ease-in-out infinite` : 'none',
          }}
        >
          {String(u.full_name || '?').slice(0, 1)}
        </Avatar>

        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap fontWeight={800}>{u.full_name}</Typography>
          <Typography noWrap variant="caption" sx={{ color: roleColor }}>
            ({roleNameFa(u.role_level)})
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}




const DefaultIcon = L.icon({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
(L.Marker as any).prototype.options.icon = DefaultIcon;
const MT_KEY = import.meta.env.VITE_MAPTILER_KEY;


dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
//dayjs.extend(jalaliPlugin);
dayjs.locale('fa');

const fa = (dayjs as any).Ls?.fa ?? {};
fa.formats = fa.formats || {
  L: 'YYYY/MM/DD',
  LL: 'D MMMM YYYY',
  LLL: 'D MMMM YYYY HH:mm',
  LLLL: 'dddd, D MMMM YYYY HH:mm',
  LT: 'HH:mm',
  LTS: 'HH:mm:ss',
};
(dayjs as any).Ls.fa = fa;

type VehicleTypeCode =
  | 'bus' | 'minibus' | 'van' | 'tanker' | 'truck' | 'khavar' | 'sedan' | 'pickup';


type Vehicle = {
  id: number;
  owner_user_id: number;
  plate_no: string;
  vehicle_type_code: VehicleTypeCode;
  // اگر دارید:
  current_driver_user_id?: number | null;
};
// همون آرایه MONITOR_PARAMS که در VehicleQuotaDialog داری، اینجا هم لازم است (می‌تونی از یک فایل مشترک ایمپورتش کنی)
const MONITOR_PARAMS = [
  { key: 'gps', label: 'GPS / موقعیت لحظه‌ای' },
  { key: 'ignition', label: 'وضعیت سوییچ (روشن/خاموش)' },
  { key: 'idle_time', label: 'مدت توقف' },
  { key: 'odometer', label: 'کیلومترشمار' },
  { key: 'engine_temp', label: 'دمای موتور' },
  { key: 'geo_fence', label: 'ژئوفنس/منطقه مجاز' },
  { key: 'stations', label: 'ایستگاه‌ها' },
  { key: 'routes', label: 'مسیر ها' },
  { key: 'consumables', label: 'تعویض لوازم مصرفی' },
] as const;
type MonitorKey = typeof MONITOR_PARAMS[number]['key'];


const vehicleMarkerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/481/481153.png',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});
interface User { id: number; full_name: string; role_level: number; phone?: string; last_location?: { lat: number; lng: number }; }




function FocusOn({ target }: { target?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    const current = Math.max(map.getZoom(), 16);
    map.flyTo(target, Math.min(current, 20), { duration: 0.6 });
  }, [target, map]);
  return null;
}
/* آیکون مارکر راننده */
const driverMarkerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/194/194927.webp',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});
const INITIAL_CENTER: [number, number] = [32.4279, 53.6880];
const INITIAL_ZOOM = 16;
const MIN_ZOOM = 7;
const MAX_ZOOM = 22;
/* --- ابزارهای نقشه --- */

function InitView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}
function TileErrorLogger({ onMapTilerFail }: { onMapTilerFail: () => void }) {
  useMapEvent('tileerror', (e: any) => {
    console.error('[TileErrorLogger] tileerror event:', e);
    const src: string | undefined = e?.tile?.src;
    if (src && src.includes('api.maptiler.com')) {
      console.warn('[TileErrorLogger] MapTiler failed → switching to OSM');
      onMapTilerFail();
    }
  });
  return null;
}






// ------------------------ SuperAdminRoleSection ------------------------
// ⛔️ مهم: بالای فایل مطمئن شو این‌ها ایمپورت شدن:



dayjs.locale('fa');

function PickPointsForStations({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => {
    if (enabled) onPick(e.latlng.lat, e.latlng.lng);
  });
  return null;
}

/* ------------ Sections ------------ */
function ManagerRoleSection({ user }: { user: User }) {
  const ELLIPSE_RX_M = 80;    // محور افقی
  const ELLIPSE_RY_M = 40;    // محور عمودی
  const ELLIPSE_ROT_DEG = 0;  // چرخش بیضی (درجه)
  const ELLIPSE_SEGMENTS = 72;
  const ALL_KEYS: MonitorKey[] = MONITOR_PARAMS.map(m => m.key);
  const TELEMETRY_KEYS: MonitorKey[] = ['ignition', 'idle_time', 'odometer', 'engine_temp'];
  const POS_TOPIC = (vid: number) => `vehicle/${vid}/pos`;
  const STATIONS_TOPIC = (vid: number, uid: number) => `vehicle/${vid}/stations/${uid}`;
  const [useMapTiler, setUseMapTiler] = useState(Boolean(MT_KEY));
  const STATIONS_PUBLIC_TOPIC = (vid: number) => `vehicle/${vid}/stations`;
  const mapRef = React.useRef<RLMap | null>(null);
  const [polyline, setPolyline] = useState<[number, number][]>([]);
  const [selectedDriver, setSelectedDriver] = useState<FlatUser | null>(null);
  const [driverFrom, setDriverFrom] = useState<Date | null>(null);
  const [driverTo, setDriverTo] = useState<Date | null>(null);
  const [driverStats, setDriverStats] = useState<{
    distance_km?: number | null;
    runtime_sec?: number | null;
  } | null>(null);
  const [driverViolations, setDriverViolations] = useState<any[]>([]);
  const [driverViolationsLoading, setDriverViolationsLoading] = useState(false);
  const [driverTrack, setDriverTrack] = useState<[number, number][]>([]);
  const [driverTrackLoading, setDriverTrackLoading] = useState(false);
  const [driverSummaryLoading, setDriverSummaryLoading] = useState(false);
  // ✨ state ها (کنار بقیه‌ی stateهای پنل ماشین)

  // types
  type Violation = {
    id: number;
    vehicle_id: number;
    type?: string;       // یا code
    code?: string;
    occurred_at?: string; // ممکنه سرویس time بده
    time?: string;
    distance_m?: number;
    speed?: number;
    lat?: number;
    lng?: number;
    message?: string;
  };

  // state
  const [vehicleViolations, setVehicleViolations] = React.useState<Violation[]>([]);
  const [vehicleViolationsLoading, setVehicleViolationsLoading] = React.useState(false);
  const [vehicleViolationsError, setVehicleViolationsError] = React.useState<string | null>(null);
  const [violationsLimit, setViolationsLimit] = React.useState<number>(50);

  // (اختیاری) برای ویوی “همه‌ی تخلفات اخیر”
  const [recentViolations, setRecentViolations] = React.useState<Violation[]>([]);
  const [recentViolationsLoading, setRecentViolationsLoading] = React.useState(false);

  // کمکی: فرمت زمان
  function fmtHMS(totalSec?: number | null) {
    if (!Number.isFinite(Number(totalSec))) return '—';
    const s = Math.max(0, Math.floor(Number(totalSec)));
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  const fetchDriverTrack = useCallback(async (driverId: number, from?: Date | null, to?: Date | null) => {
    setDriverTrackLoading(true);
    try {
      const params: any = {};
      if (from) params.from = from.toISOString();
      if (to) params.to = to.toISOString();
      // امتحان 1
      let { data } = await api.get(`/drivers/${driverId}/track`, { params, validateStatus: s => s < 500 });
      // فالبک به فرمت‌های رایج
      const points: any[] =
        (Array.isArray(data?.items) && data.items) ||
        (Array.isArray(data?.points) && data.points) ||
        (Array.isArray(data) && data) || [];
      const poly = points
        .map((p: any) => {
          const lat = Number(p.lat ?? p.latitude ?? p[1]);
          const lng = Number(p.lng ?? p.lon ?? p.longitude ?? p[0]);
          return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] as [number, number] : null;
        })
        .filter(Boolean) as [number, number][];
      setDriverTrack(poly);
      setPolyline(poly);                       // ← همان state عمومی مسیر
      if (poly.length) setFocusLatLng(poly[0]);
    } catch {
      setDriverTrack([]); setPolyline([]);
    } finally {
      setDriverTrackLoading(false);
    }
  }, [setPolyline]);

  const fetchDriverSummary = useCallback(async (driverId: number, from?: Date | null, to?: Date | null) => {
    setDriverSummaryLoading(true);
    try {
      const params: any = {};
      if (from) params.from = from.toISOString();
      if (to) params.to = to.toISOString();
      // امتحان 1
      let { data } = await api.get(`/drivers/${driverId}/summary`, { params, validateStatus: s => s < 500 });
      // فالبک به کلیدهای متداول
      const distance_km = Number(
        data?.distance_km ?? data?.distanceKm ?? data?.distance ??
        data?.stats?.distance_km ?? data?.stats?.distance
      );
      const runtime_sec = Number(
        data?.runtime_sec ?? data?.runtimeSec ?? data?.runtime_seconds ??
        data?.stats?.runtime_sec ?? data?.stats?.duration_sec
      );
      setDriverStats({
        distance_km: Number.isFinite(distance_km) ? distance_km : null,
        runtime_sec: Number.isFinite(runtime_sec) ? runtime_sec : null,
      });
    } catch {
      setDriverStats({ distance_km: null, runtime_sec: null });
    } finally {
      setDriverSummaryLoading(false);
    }
  }, []);

  const fetchDriverViolations = useCallback(async (driverId: number, from?: Date | null, to?: Date | null) => {
    setDriverViolationsLoading(true);
    try {
      const params: any = { driver_user_id: driverId, limit: 100 };
      if (from) params.from = from.toISOString();
      if (to) params.to = to.toISOString();
      let { data } = await api.get(`/violations`, { params, validateStatus: s => s < 500 });
      const arr: any[] =
        (Array.isArray(data?.items) && data.items) ||
        (Array.isArray(data) && data) || [];
      setDriverViolations(arr);
    } catch {
      setDriverViolations([]);
    } finally {
      setDriverViolationsLoading(false);
    }
  }, []);

  // اطلاعات تکمیلی راننده و ماشین‌های مرتبط
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [driverVehicles, setDriverVehicles] = useState<Vehicle[]>([]);
  const onPickDriver = useCallback(async (d: FlatUser) => {
    unsubscribeAll();

    setSelectedDriver(d);
    setSelectedVehicle(null);
    setPolyline([]);
    setVehicleTlm({});
    setVehicleRoute(null);
    setAddingStationsForVid(null);
    setEditingStation(null);
    setMovingStationId(null);
    setTempStation(null);
    setGfDrawing(false);
    setGfCenter(null);
    setGfPoly([]);
    setSheetOpen(true);
    setConsumables([]);
    setConsumablesStatus('idle');

    if (d.last_location) setFocusLatLng([d.last_location.lat, d.last_location.lng]);

    // پروفایل راننده
    try {
      const { data } = await api.get(`/users/${d.id}`, { validateStatus: s => s < 500 });
      setDriverInfo(data || d);
    } catch { setDriverInfo(d); }

    // ماشین‌های مرتبط راننده
    try {
      const res = await api.get('/vehicles', {
        params: { driver_user_id: d.id, limit: 1000 },
        validateStatus: s => s < 500
      });
      const items: any[] = Array.isArray(res?.data?.items) ? res.data.items : (Array.isArray(res?.data) ? res.data : []);
      const list: Vehicle[] = items.map((v: any) => ({
        id: Number(v.id),
        owner_user_id: Number(v.owner_user_id ?? v.ownerUserId ?? d.parent_id ?? 0),
        plate_no: String(v.plate_no ?? v.plateNo ?? ''),
        vehicle_type_code: String(v.vehicle_type_code ?? v.vehicleTypeCode ?? ''),
        ...(v.last_location ? { last_location: { lat: Number(v.last_location.lat), lng: Number(v.last_location.lng) } } : {})
      })).sort((a, b) => a.plate_no.localeCompare(b.plate_no, 'fa', { numeric: true }));
      setDriverVehicles(list);
    } catch { setDriverVehicles([]); }

    // بازه پیش‌فرض امروز
    const now = new Date();
    const from = new Date(now); from.setHours(0, 0, 0, 0);
    setDriverFrom(from); setDriverTo(now);

    // داده‌های بازه‌ای
    await Promise.allSettled([
      fetchDriverTrack(d.id, from, now),
      fetchDriverSummary(d.id, from, now),
      fetchDriverViolations(d.id, from, now),
    ]);

    // (اختیاری) اگر API ماشین جاری راننده داری، اینجا سابسکرایب کن
    // try {
    //   const { data: cur } = await api.get(`/drivers/${d.id}/current-vehicle`, { validateStatus: s => s < 500 });
    //   const vid = Number(cur?.vehicle_id);
    //   if (Number.isFinite(vid) && socketRef.current) {
    //     const s = socketRef.current;
    //     TELEMETRY_KEYS.forEach(k => s.emit('subscribe', { topic: `vehicle/${vid}/${k}` }));
    //     lastTelemSubRef.current = { vid, keys: TELEMETRY_KEYS };
    //     s.emit('subscribe', { topic: POS_TOPIC(vid) });
    //     lastPosSubRef.current = vid;
    //   }
    // } catch {}
  }, [fetchDriverTrack, fetchDriverSummary, fetchDriverViolations]);


  // قبلی‌ات می‌تونه همین بمونه
  function coerceLL(p: any) {
    let lat = Number(p.lat ?? p.latitude ?? p[1]);
    let lng = Number(p.lng ?? p.lon ?? p.longitude ?? p[0]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: NaN, lng: NaN };
    const latOk = Math.abs(lat) <= 90, lngOk = Math.abs(lng) <= 180;
    const latOkIfSwap = Math.abs(lng) <= 90, lngOkIfSwap = Math.abs(lat) <= 180;
    if ((!latOk || !lngOk) && latOkIfSwap && lngOkIfSwap) [lat, lng] = [lng, lat];
    return { lat, lng };
  }


  // نرمالایزر واحد برای نقاط مسیر
  function normalizeRoutePoints(payload: any[]): RoutePoint[] {
    const arr = Array.isArray(payload) ? payload : [];
    return arr
      .map((raw: any, i: number) => {
        const { lat, lng } = coerceLL(raw);                    // فقط lat/lng
        const order = Number(raw.order_no ?? raw.orderNo ?? i); // «ترتیب» از raw
        return { lat, lng, order_no: Number.isFinite(order) ? order : i };
      })
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }

  const focusMaxZoom = React.useCallback((lat: number, lng: number) => {
    const m = mapRef.current;
    if (!m) return;
    // فقط پَن؛ زوم دست‌نخورده بماند
    m.panTo([lat, lng], { animate: true });
  }, []);
  const [clickFences, setClickFences] = useState<{ lat: number; lng: number }[]>([]);
  function ClickToAddCircleAndEllipse() {
    useMapEvent('click', (e: { latlng: { lat: any; lng: any; }; }) => {
      const { lat, lng } = e.latlng;
      setClickFences((prev) => [...prev, { lat, lng }]);
    });
    return null;
  }
  const [routes, setRoutes] = useState<{ id: number; name: string; threshold_m?: number }[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<number | ''>('');

  const normalizeRoutes = (payload: any) => {
    const arr: any[] = Array.isArray(payload?.items) ? payload.items
      : Array.isArray(payload) ? payload : [];
    return arr.map((r: any) => ({
      id: Number(r.id),
      name: String(r.name ?? `Route ${r.id}`),
      threshold_m: Number.isFinite(Number(r.threshold_m)) ? Number(r.threshold_m) : undefined,
    })).filter(r => Number.isFinite(r.id));
  };
  const fetchRoutesForVehicle = useCallback(async (vid: number) => {
    setRoutesLoading(true);
    try {
      let resp = await api.get(`/vehicles/${vid}/routes`, {
        params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }, validateStatus: s => s < 500
      });

      // ✅ فالبک روی 404/403 یا پاسخ خالی
      if (resp.status >= 400 || !resp.data || (Array.isArray(resp.data?.items) && !resp.data.items.length)) {
        resp = await api.get(`/routes`, {
          params: { vehicle_id: vid, limit: 1000, _: Date.now() },
          headers: { 'Cache-Control': 'no-store' },
          validateStatus: s => s < 500,
        });
      }
      setRoutes(normalizeRoutes(resp.data));
    } catch (e: any) {
      console.error('routes fetch failed', e?.response?.data || e);
      setRoutes([]);
    } finally {
      setRoutesLoading(false);
    }
  }, []);
  // ✅ اضافه کن:
  const getRoutePoints = useCallback(async (rid: number): Promise<RoutePoint[]> => {
    const normalize = (arr: any[]) => arr
      .map((raw: any, i: number) => {
        const { lat, lng } = coerceLL(raw);
        const order_no = Number(raw.order_no ?? raw.orderNo ?? raw.sequence ?? i);
        return { lat, lng, order_no: Number.isFinite(order_no) ? order_no : i };
      })
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    let data = await maybeGet(`/routes/${rid}/stations`);
    if (!data) data = await maybeGet(`/routes/${rid}/points`);

    const arr: any[] =
      (Array.isArray(data) && data) ||
      (Array.isArray(data?.items) && data.items) ||
      (Array.isArray(data?.stations) && data.stations) ||
      (Array.isArray(data?.points) && data.points) ||
      (Array.isArray(data?.data?.items) && data.data.items) ||
      [];

    return normalize(arr);
  }, []);

  type RoutePoint = { lat: number; lng: number; order_no: number };

  const previewRoute = useCallback(async (rid: number) => {
    try {
      const pts = await getRoutePoints(rid);
      if (!pts.length) { alert('برای این مسیر نقطه‌ای پیدا نشد.'); return; }

      const meta = routes.find(r => r.id === rid);
      const th = Number.isFinite(Number(meta?.threshold_m))
        ? Number(meta!.threshold_m)
        : (routeThresholdRef.current || 60);

      setVehicleRoute({ id: rid, name: meta?.name ?? 'مسیر', threshold_m: th, points: pts });
      setRouteThreshold(th);
      routeThresholdRef.current = th;

      routePolylineRef.current = pts
        .slice().sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0))
        .map(p => [p.lat, p.lng] as [number, number]);

      focusMaxZoom(pts[0].lat, pts[0].lng);
    } catch (e) {
      console.error('previewRoute failed', e);
    }
  }, [routes, focusMaxZoom, getRoutePoints]);

  async function loadCurrentRoute(vid: number) {
    const cur = await api.get(`/vehicles/${vid}/routes/current`).catch(() => ({ data: null }));
    const rid: number | undefined = cur?.data?.route_id;
    if (!rid) { setVehicleRoute(null); return; }

    let pts: RoutePoint[] = [];

    // اول تلاش /routes/:id/points
    const p1 = await api.get(`/routes/${rid}/points`, { validateStatus: s => s < 500 }).catch(() => null);
    if (Array.isArray(p1?.data)) {
      pts = p1!.data;
    } else {
      // بعد /routes/:id/stations
      /*const p2 = await api.get(`/routes/${rid}/stations`, { validateStatus: s => s < 500 }).catch(() => null);
      if (Array.isArray(p2?.data)) {
        pts = p2!.data;
      } else {
        // fallback مخصوص منیجر: vehicle-scoped
        const p3 = await api.get(`/vehicles/${vid}/routes/current`).catch(() => ({ data: [] }));
        pts = Array.isArray(p3.data) ? p3.data : [];
      }*/
    }

    setVehicleRoute({
      id: rid,
      name: cur?.data?.name ?? 'مسیر',
      threshold_m: cur?.data?.threshold_m ?? 60,
      points: pts,
    });
    setRouteThreshold(cur?.data?.threshold_m ?? 60);
  }


  // ✅ کد نهایی و صحیح برای setAsCurrentRoute
  const setAsCurrentRoute = useCallback(async (vid: number, rid: number) => {
    try {
      // ❌ در کد شما body این درخواست خالی بود
      // ✅ حالا route_id به درستی ارسال می‌شود
      await api.put(`/vehicles/${vid}/routes/current`, { route_id: rid });
      await loadCurrentRoute(vid);
    } catch (e: any) {
      console.error('set current route failed', e?.response?.data || e);
      alert(e?.response?.data?.message || 'خطا در ست‌کردن مسیر جاری');
    }
  }, [loadCurrentRoute]); // وابستگی فراموش نشود

  // ---- Off-route config (عین چیزی که گفتیم) ----
  const OFF_ROUTE_N = 3;                    // چند موقعیتِ متوالی بیرون از کریدور؟
  const OFF_ROUTE_COOLDOWN_MS = 2 * 60_000; // کول‌داون ثبت تخلف برای هر ماشین

  // شمارنده‌ی متوالی و کول‌داونِ پرماشین
  const offRouteCountsRef = useRef<Record<number, number>>({});
  const lastViolationAtRef = useRef<Record<number, number>>({});
  // فاصله‌ی نقطه تا قطعه‌خط در دستگاه XY (متر)
  function distPointToSegXY(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
    const vx = bx - ax, vy = by - ay;
    const wx = px - ax, wy = py - ay;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.hypot(px - ax, py - ay);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.hypot(px - bx, py - by);
    const t = c1 / c2;
    const qx = ax + t * vx, qy = ay + t * vy;
    return Math.hypot(px - qx, py - qy);
  }

  // فاصله‌ی نقطه (lat/lng) تا پلی‌لاین (آرایه‌ی [lat,lng]) بر حسب متر
  function distancePointToPolylineMeters(
    pt: { lat: number; lng: number },
    poly: [number, number][]
  ): number {
    if (!poly || poly.length < 2) return Infinity;
    // مبنا = خودِ نقطه، تا خطا کم بشه
    const lat0 = pt.lat, lng0 = pt.lng;
    const P = poly.map(([la, ln]) => toXY(la, ln, lat0, lng0));
    let best = Infinity;
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, ay] = P[i], [bx, by] = P[i + 1];
      const d = distPointToSegXY(0, 0, ax, ay, bx, by); // خود نقطه در (0,0)
      if (d < best) best = d;
    }
    return best;
  }
  async function reportOffRouteViolation(vid: number, distM: number, thresholdM: number, lat: number, lng: number) {
    try {
      await api.post('/violations', {
        type: 'OFF_ROUTE',
        vehicle_id: vid,
        distance_m: Math.round(distM),
        threshold_m: Math.round(thresholdM),
        occurred_at: new Date().toISOString(),
        point: { lat, lng },
        route_id: vehicleRoute?.id ?? null,
        route_name: vehicleRoute?.name ?? undefined,
      });
    } catch { /* بی‌صدا */ }
  }

  const [aiStatus, setAiStatus] = useState<AiComplianceStatus>(defaultAiStatus());
  const [aiLoading, setAiLoading] = useState(false);
  function normalizeAiStatus(raw: any): AiComplianceStatus {
    const n = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : null);
    const b = (x: any): BoolUnknown =>
      x === true ? true : x === false ? false : null;

    const reason = ((): AiComplianceReason => {
      const r = String(raw?.reason ?? "").toUpperCase();
      return (["UNKNOWN", "OK", "OFF_ROUTE", "OUT_OF_FENCE", "IDLE_OFF_ROUTE", "LOW_CONFIDENCE"] as AiComplianceReason[])
        .includes(r as AiComplianceReason) ? (r as AiComplianceReason) : "UNKNOWN";
    })();

    return {
      onRoute: b(raw?.onRoute ?? raw?.on_route),
      routeDistM: n(raw?.routeDistM ?? raw?.route_dist_m ?? raw?.routeDist),
      inFence: b(raw?.inFence ?? raw?.in_fence),
      fenceDistM: n(raw?.fenceDistM ?? raw?.fence_dist_m ?? raw?.fenceDist),
      confidence: n(raw?.confidence),
      reason,
      lastChangeAt: n(raw?.lastChangeAt ?? raw?.last_change_at),
      lastUpdateAt: Date.now(),
    };
  }
  const maybeGet = (url: string) =>
    api.get(url, {
      validateStatus: s => s < 500,
      headers: { 'Cache-Control': 'no-store' },
    }).then(r => (r.status === 404 ? null : r.data)).catch(() => null);

  // بیضیِ ژئودتیکِ تقریبی با گام‌های یکنواخت (برحسب متر)
  // XY ← lat/lng  (محلیِ equirectangular برحسب متر با مبدا ثابت)
  function toXY(lat: number, lng: number, lat0: number, lng0: number): [number, number] {
    const R = 6371000;
    const dLat = (lat - lat0) * Math.PI / 180;
    const dLng = (lng - lng0) * Math.PI / 180;
    const x = dLng * Math.cos((lat0 * Math.PI) / 180) * R;
    const y = dLat * R;
    return [x, y];
  }
  // lat/lng ← XY
  function toLL(x: number, y: number, lat0: number, lng0: number) {
    const R = 6371000, toDeg = (r: number) => (r * 180) / Math.PI;
    return {
      lat: lat0 + toDeg(y / R),
      lng: lng0 + toDeg(x / (R * Math.cos((lat0 * Math.PI) / 180))),
    };
  }
  // برخورد دو خط p + t*r  و  q + u*s  (در XY)
  function lineIntersect(
    p: [number, number], r: [number, number],
    q: [number, number], s: [number, number]
  ): [number, number] | null {
    const [rx, ry] = r, [sx, sy] = s;
    const det = rx * sy - ry * sx;
    if (Math.abs(det) < 1e-9) return null; // تقریباً موازی
    const [px, py] = p, [qx, qy] = q;
    const t = ((qx - px) * sy - (qy - py) * sx) / det;
    return [px + t * rx, py + t * ry];
  }

  /** یک پولیگونِ پیوسته (buffer) دور کل مسیر می‌سازد */
  function buildRouteBufferPolygon(
    pts: { lat: number; lng: number }[],
    radius_m: number,
    miterLimit = 4     // ✅ حداکثر کشیدگی نسبت به شعاع
  ): { lat: number; lng: number }[] {
    if (!pts || pts.length < 2) return [];
    const lat0 = pts[0].lat, lng0 = pts[0].lng;

    const P = pts.map(p => toXY(p.lat, p.lng, lat0, lng0));
    const L = P.length;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    const dir: [number, number][] = [];
    const nor: [number, number][] = [];

    for (let i = 0; i < L - 1; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[i + 1];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1e-9;
      const ux = dx / len, uy = dy / len;
      dir.push([ux, uy]);
      nor.push([-uy, ux]);
    }

    {
      const [x, y] = P[0], [nx, ny] = nor[0];
      left.push([x + nx * radius_m, y + ny * radius_m]);
      right.push([x - nx * radius_m, y - ny * radius_m]);
    }

    for (let i = 1; i < L - 1; i++) {
      const [xi, yi] = P[i];
      const uPrev = dir[i - 1], nPrev = nor[i - 1];
      const uNext = dir[i], nNext = nor[i];

      const a1: [number, number] = [xi + nPrev[0] * radius_m, yi + nPrev[1] * radius_m];
      const r1: [number, number] = uPrev;
      const a2: [number, number] = [xi + nNext[0] * radius_m, yi + nNext[1] * radius_m];
      const r2: [number, number] = uNext;

      let Lp = lineIntersect(a1, r1, a2, r2) || a2;
      // ✅ miter limit
      if (Math.hypot(Lp[0] - xi, Lp[1] - yi) > miterLimit * radius_m) {
        Lp = a2; // bevel
      }
      left.push(Lp);

      const b1: [number, number] = [xi - nPrev[0] * radius_m, yi - nPrev[1] * radius_m];
      const b2: [number, number] = [xi - nNext[0] * radius_m, yi - nNext[1] * radius_m];
      let Rp = lineIntersect(b1, r1, b2, r2) || b2;
      if (Math.hypot(Rp[0] - xi, Rp[1] - yi) > miterLimit * radius_m) {
        Rp = b2; // bevel
      }
      right.push(Rp);
    }

    {
      const [x, y] = P[L - 1], [nx, ny] = nor[nor.length - 1];
      left.push([x + nx * radius_m, y + ny * radius_m]);
      right.push([x - nx * radius_m, y - ny * radius_m]);
    }

    const ringXY = [...left, ...right.reverse()];
    const ringLL = ringXY.map(([x, y]) => toLL(x, y, lat0, lng0));
    // ✅ اگر لازم داری حلقه بسته شود:
    if (ringLL.length && (ringLL[0].lat !== ringLL.at(-1)!.lat || ringLL[0].lng !== ringLL.at(-1)!.lng)) {
      ringLL.push({ ...ringLL[0] });
    }
    return ringLL;
  }

  function ellipsePolygonPoints(center: { lat: number; lng: number }, rx_m: number, ry_m: number, rotationDeg = 0, segments = 72) {
    const R = 6378137, toRad = Math.PI / 180, cosLat = Math.cos(center.lat * toRad), rot = rotationDeg * toRad;
    const pts = [] as { lat: number; lng: number }[];
    for (let i = 0; i < segments; i++) {
      const t = i / segments * 2 * Math.PI, x = rx_m * Math.cos(t), y = ry_m * Math.sin(t);
      const xr = x * Math.cos(rot) - y * Math.sin(rot), yr = x * Math.sin(rot) + y * Math.cos(rot);
      const dLat = (yr / R) * (180 / Math.PI), dLng = (xr / (R * cosLat)) * (180 / Math.PI);
      pts.push({ lat: center.lat + dLat, lng: center.lng + dLng });
    }
    pts.push(pts[0]); return pts;
  }





  // 🔹 ذخیره‌ی مسیرِ در حال ترسیم به‌عنوان مسیر جدید و ست‌کردن روی ماشین
  async function saveDrawnRoute(vid: number) {
    if (routePoints.length < 2) { alert('حداقل ۲ نقطه برای مسیر لازم است.'); return; }

    const routePayload = {
      name: `مسیر ${new Date().toLocaleDateString('fa-IR')}`,
      threshold_m: Math.max(1, Math.trunc(routeThreshold || 60)),
      points: routePoints.map(p => ({ lat: +p.lat, lng: +p.lng })),
    };

    try {
      // 1) ساخت مسیر و گرفتن شناسه
      const { data } = await api.post(`/vehicles/${vid}/routes`, routePayload);
      const rid = Number(data?.route_id ?? data?.id ?? data?.route?.id);
      if (!Number.isFinite(rid)) throw new Error('شناسه‌ی مسیر جدید مشخص نشد');

      // 2) ست‌کردن مسیر ساخته‌شده به‌عنوان «جاری»
      await api.put(`/vehicles/${vid}/routes/current`, { route_id: rid });

      // 3) (اختیاری) ژئوفنس کلی مسیر
      const gfWhole = buildGeofenceAroundRoutePoints(routePoints, 50, 15);
      if (gfWhole) {
        const payloadWhole = {
          type: 'polygon',
          polygonPoints: gfWhole.points.map(p => ({ lat: p.lat, lng: p.lng })),
          toleranceM: gfWhole.tolerance_m,
        };
        await api.put(`/vehicles/${vid}/geofence`, payloadWhole).catch(() =>
          api.post(`/vehicles/${vid}/geofence`, payloadWhole)
        );
      }

      // 4) بیضی دور تک‌تک نقاط (اگر بک‌اند چند ژئوفنس را ساپورت می‌کند)
      for (const p of routePoints) {
        const poly = ellipsePolygonPoints(
          { lat: +p.lat, lng: +p.lng },
          ELLIPSE_RX_M, ELLIPSE_RY_M, ELLIPSE_ROT_DEG, ELLIPSE_SEGMENTS
        );
        const gfEach = {
          type: 'polygon' as const,
          polygonPoints: poly.map(pt => ({ lat: pt.lat, lng: pt.lng })),
          toleranceM: 10,
        };
        await api.post(`/vehicles/${vid}/geofence`, gfEach).catch(() =>
          api.put(`/vehicles/${vid}/geofence`, gfEach)
        );
      }

      // 5) ریست UI و ریفرش‌ها
      setDrawingRoute(false);
      setRoutePoints([]);
      await Promise.allSettled([
        loadCurrentRoute(vid),
        fetchRoutesForVehicle(vid),
        loadVehicleGeofences(vid),
      ]);
      // انتخاب خودکار مسیر تازه‌ساخته برای کنترل‌های بالا
      setSelectedRouteId(rid);

      alert('مسیر ذخیره و به‌عنوان مسیر جاری ست شد. ژئوفنس‌ها هم اعمال شدند.');
    } catch (error: any) {
      console.error('saveDrawnRoute error:', error?.response?.data || error);
      alert(error?.response?.data?.message || 'خطا در ذخیره/ست‌کردن مسیر');
    }
  }




  // 🔹 تغییر آستانه‌ی انحراف مسیر (threshold_m)
  async function applyRouteThreshold(vid: number, th: number) {
    const m = Math.max(1, Math.trunc(th));
    setRouteThreshold(m);
    routeThresholdRef.current = m;
    await api.put(`/vehicles/${vid}/routes/current`, { threshold_m: m }).catch(() => { });
    setVehicleRoute(r => r ? { ...r, threshold_m: m } : r);
  }

  // 🔹 حذف/لغو مسیر جاری از روی ماشین
  async function deleteCurrentRoute(vid: number) {
    if (!confirm('مسیر جاری از این ماشین برداشته شود؟')) return;
    await api.delete(`/vehicles/${vid}/routes/current`).catch(() =>
      api.put(`/vehicles/${vid}/routes/current`, { route_id: null })
    );
    setVehicleRoute(null);
    setRoutePoints([]);
    setDrawingRoute(false);
  }

  async function fetchAiStatus(vid: number) {
    setAiLoading(true);
    try {
      const { data } = await api.get(`/vehicles/${vid}/ai-status`, {
        params: { _: Date.now() },
        headers: { "Cache-Control": "no-store" },
        validateStatus: s => s < 500, // 404 => نامشخص
      });
      if (data) setAiStatus(normalizeAiStatus(data));
      else setAiStatus(defaultAiStatus());
    } catch {
      setAiStatus(defaultAiStatus());
    } finally {
      setAiLoading(false);
    }
  }

  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const [defaultsOpen, setDefaultsOpen] = useState(false);

  // ====================================================================
  // ✅ START: بخش جدید برای مدیریت پروفایل‌ها (مبتنی بر دیتابیس)
  // ====================================================================

  const [profiles, setProfiles] = useState<SettingsProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'list' | 'edit'>('list');
  const [profileName, setProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null);

  const loadProfiles = useCallback(async () => {
    try {
      setProfilesLoading(true);
      // فراخوانی API برای گرفتن لیست پروفایل‌ها
      const { data } = await api.get('/vehicle-setting-profiles');
      setProfiles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch profiles from API", error);
      alert('خطا در دریافت لیست پروفایل‌ها');
      setProfiles([]);
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  const resetForms = () => {
    setDfStations([]);
    setDfGfMode('circle');
    setDfGfCircle({ radius_m: 150, tolerance_m: 15, center: undefined });
    setDfGfPoly([]);
    setDfDrawing(false);
    setDfTempSt(null);
    setDfAuto(1);
    setDfAddingStation(false);
    setProfileName('');
    setEditingProfileId(null);
    setClickFences([]);               // ✅ این خط
  };

  const handleCreateNewProfile = () => {
    resetForms();
    setCurrentView('edit');
  };

  const handleLoadProfile = (profileId: number) => {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    resetForms(); // شروع با فرم خالی

    setEditingProfileId(profile.id);
    setProfileName(profile.name);
    setDfStations(profile.settings.stations || []);

    const gf = profile.settings.geofence;
    if (gf) {
      if (gf.type === 'circle') {
        setDfGfMode('circle');
        setDfGfCircle({
          center: gf.center,
          radius_m: gf.radius_m,
          tolerance_m: gf.tolerance_m ?? 15
        });
      } else if (gf.type === 'polygon') {
        setDfGfMode('polygon');
        setDfGfPoly(gf.points || []);
        // مطمئن می‌شویم tolerance هم ست شود
        setDfGfCircle(c => ({ ...c, tolerance_m: gf.tolerance_m ?? 15 }));
      }
    }

    setCurrentView('edit');
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      alert('لطفاً نام پروفایل را وارد کنید.');
      return;
    }

    const settings = {
      stations: dfStations,
      geofence: buildDfGeofence(),
    };

    try {
      if (editingProfileId) { // آپدیت پروفایل موجود
        await api.put(`/vehicle-setting-profiles/${editingProfileId}`, {
          name: profileName.trim(),
          settings,
        });
      } else { // ساخت پروفایل جدید
        await api.post('/vehicle-setting-profiles', {
          name: profileName.trim(),
          settings,
        });
      }

      await loadProfiles(); // بارگذاری مجدد لیست از سرور
      setCurrentView('list');

    } catch (error) {
      console.error("Failed to save profile via API", error);
      alert("خطا در ذخیره پروفایل. لطفاً دوباره تلاش کنید.");
    }
  };

  const handleDeleteProfile = async (profileId: number) => {
    if (window.confirm('آیا از حذف این پروفایل مطمئن هستید؟')) {
      try {
        await api.delete(`/vehicle-setting-profiles/${profileId}`);
        await loadProfiles(); // به‌روزرسانی لیست پس از حذف
      } catch (error) {
        console.error("Failed to delete profile via API", error);
        alert("خطا در حذف پروفایل.");
      }
    }
  };

  useEffect(() => {
    if (defaultsOpen) {
      loadProfiles();
      setCurrentView('list'); // همیشه با نمای لیست شروع شود
    } else {
      // با بستن دیالوگ، همه چیز ریست شود
      resetForms();
    }
  }, [defaultsOpen, loadProfiles]);


  type TmpStation = { name: string; lat: number; lng: number; radius_m: number; order_no?: number };




  // ... بقیه کد شما تا شروع JSX بدون تغییر باقی می‌ماند ...
  type TmpLatLng = { lat: number; lng: number };
  type TmpGeofence =
    | { type: 'circle'; center: TmpLatLng; radius_m: number; tolerance_m?: number }
    | { type: 'polygon'; points: TmpLatLng[]; tolerance_m?: number };

  const [dfStations, setDfStations] = useState<TmpStation[]>([]);
  const [dfGfMode, setDfGfMode] = useState<'circle' | 'polygon'>('circle');
  const [dfGfCircle, setDfGfCircle] = useState<{ center?: TmpLatLng; radius_m: number; tolerance_m: number }>({ radius_m: 150, tolerance_m: 15 });
  const [dfGfPoly, setDfGfPoly] = useState<TmpLatLng[]>([]);
  const [dfDrawing, setDfDrawing] = useState(false);
  const [dfTempSt, setDfTempSt] = useState<TmpStation | null>(null);
  const [dfAuto, setDfAuto] = useState(1);
  const [dfAddingStation, setDfAddingStation] = useState(false);


  const mapDefaultsRef = React.useRef<RLMap | null>(null);
  function PickPointsDF({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lng: number) => void }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }

  // ساختن آبجکت geofence نهایی از state
  const buildDfGeofence = (): TmpGeofence | null => {
    if (dfGfMode === 'circle') {
      if (!dfGfCircle.center || !Number.isFinite(dfGfCircle.radius_m)) return null;
      return { type: 'circle', center: dfGfCircle.center, radius_m: Math.max(1, dfGfCircle.radius_m), tolerance_m: Math.max(0, dfGfCircle.tolerance_m) };
    }
    if (dfGfPoly.length >= 3) return { type: 'polygon', points: dfGfPoly.slice(), tolerance_m: Math.max(0, dfGfCircle.tolerance_m) };
    return null;
  };

  const [supers, setSupers] = useState<FlatUser[]>([]);
  const [driversBySA, setDriversBySA] = useState<Record<number, FlatUser[]>>({});
  const [vehiclesBySA, setVehiclesBySA] = useState<Record<number, Vehicle[]>>({});
  const [dfApplying, setDfApplying] = useState(false);
  const [dfApplyLog, setDfApplyLog] = useState<string[]>([]);
  const [dfTarget, setDfTarget] = useState<'currentVehicle' | 'currentSA'>('currentSA'); // مود هدف
  // --- انتخاب ماشین‌ها برای دیالوگ «تنظیمات پیش‌فرض» ---
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [qSA, setQSA] = useState('');
  const [selectedSAId, setSelectedSAId] = useState<number | null>(null);
  const [tabSA, setTabSA] = useState<'drivers' | 'vehicles'>('drivers');
  const toggleVehiclePick = useCallback((vid: number) => {
    setSelectedVehicleIds(prev => {
      const next = new Set(prev);
      next.has(vid) ? next.delete(vid) : next.add(vid);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectAll(checked);
    if (!selectedSAId) { setSelectedVehicleIds(new Set()); return; }
    const list = vehiclesBySA[selectedSAId] || [];
    setSelectedVehicleIds(checked ? new Set(list.map(v => v.id)) : new Set());
  }, [selectedSAId, vehiclesBySA]);

  useEffect(() => {
    if (!defaultsOpen) return;
    if (!selectedSAId) { setSelectedVehicleIds(new Set()); setSelectAll(false); return; }
    const list = vehiclesBySA[selectedSAId] || [];
    setSelectedVehicleIds(selectAll ? new Set(list.map(v => v.id)) : new Set());
  }, [defaultsOpen, selectedSAId, vehiclesBySA, selectAll]);

  useEffect(() => {
    if (dfTarget === 'currentVehicle') { setSelectedVehicleIds(new Set()); setSelectAll(false); }
  }, [dfTarget]);

  async function handleApplyDefaults() {
    if (!user?.id) return;
    const geofence = buildDfGeofence();
    if (!dfStations.length && !geofence) { alert('هیچ آیتمی برای اعمال تنظیم نشده.'); return; }

    const profile = {
      stations: dfStations.length ? dfStations : undefined,
      geofence: geofence ?? undefined,
    };

    const targetVids: number[] =
      dfTarget === 'currentVehicle'
        ? (selectedVehicle ? [selectedVehicle.id] : [])
        : (selectedSAId
          ? (selectedVehicleIds.size
            ? Array.from(selectedVehicleIds)
            : (vehiclesBySA[selectedSAId] || []).map(v => v.id)) // فالبک: همه
          : []);

    if (!targetVids.length) { alert('ماشینی برای اعمال تنظیمات پیدا نشد.'); return; }

    setDfApplying(true);
    setDfApplyLog([]);
    try {
      const logs: string[] = [];
      for (const vid of targetVids) {
        try {
          const res = await applyVehicleProfile(api, vid, profile, user.id, user.role_level as any, { stationsMode: 'replace' });
          logs.push(`✅ VID ${vid}: ${JSON.stringify(res.applied || {})}`);
        } catch (e: any) {
          logs.push(`❌ VID ${vid}: ${e?.response?.data?.message || e?.message || 'خطا'}`);
        }
        setDfApplyLog([...logs]);
      }
    } finally {
      setDfApplying(false);
    }
  }


  const INITIAL_CENTER: [number, number] = [35.6892, 51.3890];
  const INITIAL_ZOOM = 6, MIN_ZOOM = 3, MAX_ZOOM = 18;

  // ====== تایپ‌های کوچک ======
  type FlatUser = User & { parent_id?: number | null; last_location?: { lat: number; lng: number } };
  type Vehicle = {
    id: number; owner_user_id: number; plate_no: string;
    vehicle_type_code?: string; last_location?: { lat: number; lng: number };
  };
  type GeofenceCircle = { id?: number; type: 'circle'; center: { lat: number; lng: number }; radius_m: number; tolerance_m?: number | null };
  type GeofencePolygon = { id?: number; type: 'polygon'; points: { lat: number; lng: number }[]; tolerance_m?: number | null };
  type Geofence = GeofenceCircle | GeofencePolygon;

  // ====== State اصلی ======
  const [loadingAll, setLoadingAll] = useState(true);
  const [errorAll, setErrorAll] = useState<string | null>(null);


  // آخرین سابسکرایب ایستگاه‌ها (هم scoped هم عمومی)


  function freezeProgrammaticZoom(m: any) {
    const keep = () => m.getZoom();

    const patch = (name: string, handler: (orig: any, ...args: any[]) => any) => {
      if (!m[name] || (m[name] as any)._patched) return;
      const orig = m[name].bind(m);
      m[name] = function (...args: any[]) { return handler(orig, ...args); };
      (m[name] as any)._patched = true;
    };

    // هر جا زوم پاس می‌دن، نادیده بگیر و زوم فعلی رو نگه دار
    patch('setView', (orig, center, _zoom, options) => orig(center, keep(), options));
    patch('flyTo', (orig, center, _zoom, options) => orig(center, keep(), options));

    // fitBounds / flyToBounds هم فقط مرکز رو پَن کنن، بی‌تغییر زوم
    patch('fitBounds', (_orig, bounds, options) => {
      const L: any = (window as any).L;
      const center = L?.latLngBounds ? L.latLngBounds(bounds).getCenter()
        : (bounds?.getCenter ? bounds.getCenter() : bounds);
      return m.setView(center, keep(), options);
    });
    patch('flyToBounds', (_orig, bounds, options) => m.fitBounds(bounds, options));
  }


  const [focusLatLng, setFocusLatLng] = useState<[number, number] | undefined>(undefined);
  // گزینه‌های فعال مانیتورینگ برای مدیر: همیشه همه
  const [vehicleOptions, setVehicleOptions] = useState<MonitorKey[]>(ALL_KEYS);

  // تله‌متری زنده ماشین انتخاب‌شده
  type VehicleTelemetry = { ignition?: boolean; idle_time?: number; odometer?: number; engine_temp?: number };
  // تله‌متری لازم برای نمایش و چک‌ها
  const [vehicleTlm, setVehicleTlm] = React.useState<{
    ignition?: boolean;
    idle_time?: number;
    odometer?: number;
    engine_temp?: number; // ⬅️ اضافه شد
  }>({});
  const lastTelemTempVidRef = React.useRef<number | null>(null);

  // مسیر (پلی‌لاین تاریخچه یا لایو)

  // سابسکرایب‌های فعال برای POS و تله‌متری
  const lastPosSubRef = useRef<number | null>(null);
  const lastTelemSubRef = useRef<{ vid: number; keys: MonitorKey[] } | null>(null);

  // مسیر فعلی
  type VehicleRoute = { id: number; name: string; threshold_m?: number; points?: RoutePoint[] };
  const [vehicleRoute, setVehicleRoute] = useState<VehicleRoute | null>(null);
  const [drawingRoute, setDrawingRoute] = useState(false);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [routeThreshold, setRouteThreshold] = useState<number>(100);
  // منیجر این صفحه همیشه مجاز است
  const MANAGER_ALWAYS_ALLOWED = true; // ⬅️ اگر خواستی شرطی‌اش کنی، role_level منیجر را چک کن
  const canTrackVehicles = MANAGER_ALWAYS_ALLOWED;
  const canStations = MANAGER_ALWAYS_ALLOWED;
  const canConsumables = MANAGER_ALWAYS_ALLOWED;
  const canIgnition = MANAGER_ALWAYS_ALLOWED;
  const canIdleTime = MANAGER_ALWAYS_ALLOWED;
  const canOdometer = MANAGER_ALWAYS_ALLOWED;
  const canEngineTemp = MANAGER_ALWAYS_ALLOWED; // ⬅️ جدید
  const canGeoFence = MANAGER_ALWAYS_ALLOWED;

  const normalizeStations = useCallback((payload: any): Station[] => {
    const src: any[] =
      Array.isArray(payload) ? payload :
        Array.isArray(payload?.items) ? payload.items :
          Array.isArray(payload?.data?.items) ? payload.data.items :
            Array.isArray(payload?.data) ? payload.data :
              Array.isArray(payload?.result) ? payload.result :
                Array.isArray(payload?.rows) ? payload.rows :
                  Array.isArray(payload?.list) ? payload.list :
                    Array.isArray(payload?.stations) ? payload.stations : [];

    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    };
    const list = src.map((s: any) => {
      const idNum = Number(s.id ?? s._id ?? s.station_id ?? s.stationId);
      return {
        id: idNum,
        name: String(s.name ?? s.title ?? 'ایستگاه').trim(),
        lat: toNum(s.lat ?? s.latitude ?? s.location?.lat ?? (Array.isArray(s) ? s[1] : undefined)),
        lng: toNum(s.lng ?? s.lon ?? s.longitude ?? s.location?.lng ?? (Array.isArray(s) ? s[0] : undefined)),
        radius_m: toNum(s.radius_m ?? s.radiusM ?? s.radius ?? 60),
        order_no: toNum(s.order_no ?? s.orderNo ?? s.order),
      } as Station;
    }).filter(s => Number.isFinite(s.id) && Number.isFinite(s.lat) && Number.isFinite(s.lng));

    // dedupe + sort
    const map = new Map<number, Station>();
    list.forEach(s => map.set(s.id, s));
    return [...map.values()].sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0));
  }, []);


  // برای فاصله از مسیر
  const routePolylineRef = useRef<[number, number][]>([]);
  const routeThresholdRef = useRef<number>(60);
  useEffect(() => { routeThresholdRef.current = routeThreshold; }, [routeThreshold]);
  useEffect(() => {
    const pts = (vehicleRoute?.points ?? []).slice().sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0));
    routePolylineRef.current = pts.map(p => [p.lat, p.lng] as [number, number]);
  }, [vehicleRoute?.id, vehicleRoute?.points?.length]);

  // انتخاب‌های تب Vehicles
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // ====== ایستگاه‌ها ======
  const [vehicleStationsMap, setVehicleStationsMap] = useState<Record<number, Station[]>>({});
  const [addingStationsForVid, setAddingStationsForVid] = useState<number | null>(null);
  const [stationRadius, setStationRadius] = useState<number>(60);
  const [tempStation, setTempStation] = useState<{ lat: number; lng: number } | null>(null);
  const [tempName, setTempName] = useState<string>('');
  const [autoIndex, setAutoIndex] = useState(1);
  const [editingStation, setEditingStation] = useState<{ vid: number; st: Station } | null>(null);
  const [movingStationId, setMovingStationId] = useState<number | null>(null);
  const lastStationsSubRef = useRef<{ vid: number; uid: number } | null>(null);

  // ====== ژئوفنس ======
  const [geofencesByVid, setGeofencesByVid] = useState<Record<number, Geofence[]>>({});
  const [gfMode, setGfMode] = useState<'circle' | 'polygon'>('circle');
  const [gfDrawing, setGfDrawing] = useState(false);
  const [gfCenter, setGfCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [gfRadius, setGfRadius] = useState<number>(150);
  const [gfPoly, setGfPoly] = useState<{ lat: number; lng: number }[]>([]);
  const [gfTolerance, setGfTolerance] = useState<number>(15);
  // ====== Station types & state ======
  type Station = { id: number; name: string; lat: number; lng: number; radius_m: number; order_no?: number };

  const [loadingStationsForVid, setLoadingStationsForVid] = React.useState<number | null>(null);
  const stationsReqIdRef = React.useRef(0);


  // ====== Loader از DB ======
  const loadStations = React.useCallback(async (vid: number) => {
    const my = ++stationsReqIdRef.current;
    setLoadingStationsForVid(vid);
    try {
      const { data } = await api.get(`/vehicles/${vid}/stations`, {
        params: { _: Date.now() },
        headers: { 'Cache-Control': 'no-store' },
      });
      if (my !== stationsReqIdRef.current) return;
      const list = normalizeStations(data);
      setVehicleStationsMap((prev) => ({ ...prev, [vid]: list }));
    } catch (e) {
      if (my !== stationsReqIdRef.current) return;
      setVehicleStationsMap((prev) => ({ ...prev, [vid]: [] }));
      // اختیاری: console.error('[stations] load error', e);
    } finally {
      if (my === stationsReqIdRef.current) setLoadingStationsForVid(null);
    }
  }, [normalizeStations]);







  // ====== CRUD helpers که UI فراخوانی‌شون می‌کند ======
  const confirmTempStation = React.useCallback(async () => {
    if (!selectedVehicle || !tempStation) return;
    try {
      const body = {
        name: (tempName || `ایستگاه ${autoIndex}`).trim(),
        lat: tempStation.lat,
        lng: tempStation.lng,
        radius_m: stationRadius,
      };
      await api.post(`/vehicles/${selectedVehicle.id}/stations`, body);
      // یا منتظر سوکت بمون، یا فوراً ریفرش کن
      await loadStations(selectedVehicle.id);
      setAutoIndex((i) => i + 1);
      setTempStation(null);
      setAddingStationsForVid(null);
    } catch (e: any) {
      console.error('[stations] create error', e?.response?.data || e);
      alert(e?.response?.data?.message || 'ثبت ایستگاه ناموفق بود');
    }
  }, [selectedVehicle?.id, tempStation, tempName, autoIndex, stationRadius, loadStations]);

  const saveEditStation = React.useCallback(async () => {
    if (!editingStation) return;
    const { vid, st } = editingStation;
    try {
      await api.put(`/vehicles/${vid}/stations/${st.id}`, {
        name: (st.name || '').trim(),
        lat: st.lat, lng: st.lng, radius_m: Math.max(1, Number(st.radius_m || 0)),
      });
      await loadStations(vid);
      setEditingStation(null);
      setMovingStationId(null);
    } catch (e: any) {
      console.error('[stations] update error', e?.response?.data || e);
      alert(e?.response?.data?.message || 'ذخیره ویرایش ناموفق بود');
    }
  }, [editingStation, loadStations]);

  const deleteStation = React.useCallback(async (vid: number, st: { id: number }) => {
    if (!st?.id) return;
    if (!confirm('ایستگاه حذف شود؟')) return;
    try {
      await api.delete(`/vehicles/${vid}/stations/${st.id}`);
      await loadStations(vid);
    } catch (e: any) {
      console.error('[stations] delete error', e?.response?.data || e);
      alert(e?.response?.data?.message || 'حذف ناموفق بود');
    }
  }, [loadStations]);

  // ====== سوکت ======
  const socketRef = useRef<Socket | null>(null);

  // ====== Utility‌های نقشه ======
  function PickPoints({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lng: number) => void }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }



  // ====== Helpers ======
  const normNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const AI_TOPIC = (vid: number, uid: number) => `vehicle/${vid}/ai/${uid}`;
  const lastAiSubRef = useRef<{ vid: number; uid: number } | null>(null);

  const normalizeGeofences = (payload: any): Geofence[] => {
    const arr: any[] = Array.isArray(payload) ? payload
      : Array.isArray(payload?.items) ? payload.items
        : payload?.rule ? [payload.rule]
          : payload ? [payload] : [];
    const out: Geofence[] = [];
    for (const g of arr) {
      const type = String(g?.type ?? g?.geometry?.type ?? '').toLowerCase();
      const tol = normNum(g?.tolerance_m ?? g?.toleranceM ?? g?.tolerance);
      // circle
      const centerLat = normNum(g?.center?.lat ?? g?.centerLat ?? g?.center_lat ?? g?.lat);
      const centerLng = normNum(g?.center?.lng ?? g?.centerLng ?? g?.center_lng ?? g?.lng);
      const radius = normNum(g?.radius_m ?? g?.radiusM ?? g?.radius);
      if ((type === 'circle' || (centerLat != null && centerLng != null && radius != null))
      ) {
        if (centerLat != null && centerLng != null && radius != null) {
          out.push({
            type: 'circle',
            id: normNum(g?.id),
            center: { lat: centerLat, lng: centerLng },
            radius_m: radius,
            tolerance_m: tol ?? null,
          } as GeofenceCircle);
          continue;
        }
      }
      // polygon via points
      const rawPts = g?.points ?? g?.polygonPoints ?? g?.polygon_points ?? g?.geometry?.coordinates?.[0];
      if (Array.isArray(rawPts)) {
        const pts = rawPts
          .map((p: any) =>
            Array.isArray(p) ? { lat: normNum(p[1]), lng: normNum(p[0]) } : { lat: normNum(p?.lat), lng: normNum(p?.lng) }
          )
          .filter((p: any) => p?.lat != null && p?.lng != null);
        if (pts.length >= 3) {
          out.push({ type: 'polygon', id: normNum(g?.id), points: pts as any, tolerance_m: tol ?? null });
        }
      }
    }
    // dedupe by id
    const seen = new Set<number>();
    return out.filter(g => (g.id ? !seen.has(g.id) && (seen.add(g.id), true) : true));
  };

  const loadVehicleGeofences = useCallback(async (vid: number) => {
    try {
      const { data } = await api.get(`/vehicles/${vid}/geofence`, {
        params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }
      });
      setGeofencesByVid(p => ({ ...p, [vid]: normalizeGeofences(data) }));
    } catch {
      setGeofencesByVid(p => ({ ...p, [vid]: [] }));
    }
  }, []);

  const saveGeofence = useCallback(async (vid: number) => {
    const toInt = (v: any, min: number) => Math.max(min, Math.trunc(Number(v)));
    let payload: any;
    if (gfMode === 'circle') {
      if (!gfCenter || !Number.isFinite(gfCenter.lat) || !Number.isFinite(gfCenter.lng) || !Number.isFinite(gfRadius) || gfRadius <= 0) {
        alert('مرکز و شعاع دایره را درست وارد کنید.'); return;
      }
      payload = {
        type: 'circle',
        centerLat: +gfCenter.lat, centerLng: +gfCenter.lng,
        radiusM: toInt(gfRadius, 1),
        toleranceM: toInt(gfTolerance ?? 5, 0),
      };
    } else {
      if (!Array.isArray(gfPoly) || gfPoly.length < 3) { alert('چندضلعی حداقل به ۳ نقطه نیاز دارد.'); return; }
      payload = {
        type: 'polygon',
        polygonPoints: gfPoly.map(p => ({ lat: +p.lat, lng: +p.lng })),
        toleranceM: toInt(gfTolerance ?? 5, 0),
      };
    }
    try {
      await api.put(`/vehicles/${vid}/geofence`, payload).catch(() =>
        api.post(`/vehicles/${vid}/geofence`, payload)
      );
      await loadVehicleGeofences(vid);
      setGfDrawing(false); setGfCenter(null); setGfPoly([]);
    } catch (e: any) {
      console.error('saveGeofence error:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'ثبت ژئوفنس ناموفق بود');
    }
  }, [gfMode, gfCenter, gfRadius, gfTolerance, gfPoly, loadVehicleGeofences]);

  const deleteGeofence = useCallback(async (vid: number) => {
    if (!confirm('ژئوفنس حذف شود؟')) return;
    try {
      await api.delete(`/vehicles/${vid}/geofence`);
      setGeofencesByVid(p => ({ ...p, [vid]: [] }));
      setGfDrawing(false); setGfCenter(null); setGfPoly([]);
    } catch {
      alert('حذف ژئوفنس ناموفق بود');
    }
  }, []);

  // ====== ایستگاه‌ها ======
  const fetchStations = useCallback(async (vid: number) => {
    try {
      const { data } = await api.get(`/vehicles/${vid}/stations`, {
        params: { _: Date.now() },
        headers: { 'Cache-Control': 'no-store' },
      });
      const stations = normalizeStations(data);
      setVehicleStationsMap(prev => ({ ...prev, [vid]: stations }));
    } catch {
      setVehicleStationsMap(prev => ({ ...prev, [vid]: [] }));
    }
  }, []);

  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const onAi = (msg: any) => {
      // انتظار: { vehicle_id, ...status }
      if (selectedVehicle?.id && Number(msg?.vehicle_id) !== selectedVehicle.id) return;
      setAiStatus(normalizeAiStatus(msg));
    };

    s.on('vehicle:ai', onAi);
    return () => { s.off('vehicle:ai', onAi); };
  }, [selectedVehicle?.id]);


  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const onStations = (msg: any) => {
      const vid = Number(
        msg?.vehicle_id ?? msg?.vehicleId ??
        lastStationsSubRef.current?.vid ?? selectedVehicle?.id
      );
      if (!Number.isFinite(vid)) return;

      setVehicleStationsMap(prev => {
        const cur = (prev[vid] || []).slice();

        // لیست کامل
        if (Array.isArray(msg?.stations)) {
          const list = normalizeStations(msg.stations);
          return { ...prev, [vid]: list };
        }

        // created/updated
        if ((msg?.type === 'created' || msg?.type === 'updated') && msg?.station) {
          const sNorm = normalizeStations([msg.station])[0];
          if (!sNorm) return prev;
          const i = cur.findIndex(x => x.id == sNorm.id);
          if (i === -1) cur.push(sNorm); else cur[i] = sNorm;
          return { ...prev, [vid]: cur };
        }
        if (msg?.type === 'deleted') {
          const delId = msg.station_id ?? msg.stationId ?? msg.id ?? msg._id;
          if (delId != null) {
            const next = cur.filter(x => String(x.id) !== String(delId));
            return { ...prev, [vid]: next };
          }
        }

        return prev;
      });
    };

    s.on('vehicle:stations', onStations);
    return () => { s.off('vehicle:stations', onStations); };
  }, []);




  const ensureStationsLive = useCallback(async (vid: number) => {
    // همیشه یک‌بار از سرور تازه‌سازی کن
    await fetchStations(vid).catch(() => { });

    const s = socketRef.current;
    if (!s) return;

    const prev = lastStationsSubRef.current;
    if (prev?.vid === vid && prev?.uid === user.id) return;

    // آن‌ساب قبلی (هر دو تاپیک)
    if (prev) {
      s.emit('unsubscribe', { topic: STATIONS_TOPIC(prev.vid, prev.uid) });
      s.emit('unsubscribe', { topic: STATIONS_PUBLIC_TOPIC(prev.vid) });
    }

    // سابسکرایب جدید (scoped + public)
    s.emit('subscribe', { topic: STATIONS_TOPIC(vid, user.id) });
    s.emit('subscribe', { topic: STATIONS_PUBLIC_TOPIC(vid) });
    lastStationsSubRef.current = { vid, uid: user.id };
  }, [user.id, fetchStations]);





  const onVehiclePos = React.useCallback(
    (v: { vehicle_id: number; lat: number; lng: number; ts?: string | number }) => {
      const id = v.vehicle_id;

      // 🔹 آپدیت UI و مسیر لحظه‌ای برای ماشین انتخاب‌شده
      if (selectedVehicle?.id === id) {
        setFocusLatLng([v.lat, v.lng]);
        setPolyline(prev => {
          const arr = [...prev, [v.lat, v.lng] as [number, number]];
          if (arr.length > 2000) arr.shift();
          return arr;
        });

        // 🔸 تشخیص خروج از مسیر (عین همون منطق)
        const poly = routePolylineRef.current;
        const th = Number(routeThresholdRef.current || vehicleRoute?.threshold_m || 0);
        if (poly && poly.length >= 2 && th > 0 && Number.isFinite(v.lat) && Number.isFinite(v.lng)) {
          const dist = distancePointToPolylineMeters({ lat: v.lat, lng: v.lng }, poly);
          const now = Date.now();

          if (dist > th) {
            offRouteCountsRef.current[id] = (offRouteCountsRef.current[id] || 0) + 1;
            if (offRouteCountsRef.current[id] >= OFF_ROUTE_N) {
              const last = lastViolationAtRef.current[id] || 0;
              if (now - last >= OFF_ROUTE_COOLDOWN_MS) {
                reportOffRouteViolation(id, dist, th, v.lat, v.lng);
                lastViolationAtRef.current[id] = now;
              }
              offRouteCountsRef.current[id] = 0; // ریست بعد از ثبت/چک
            }
          } else {
            offRouteCountsRef.current[id] = 0;
          }
        }
      }

      // 🔹 ریفرش لوکیشن ماشین‌ها در لیست SA انتخاب‌شده
      if (selectedSAId) {
        setVehiclesBySA(prev => {
          const list = (prev[selectedSAId] || []).slice();
          const i = list.findIndex(x => x.id === id);
          if (i >= 0) list[i] = { ...list[i], last_location: { lat: v.lat, lng: v.lng } };
          return { ...prev, [selectedSAId]: list };
        });
      }
    },
    [selectedVehicle?.id, selectedSAId, vehicleRoute?.threshold_m]
  );


  // ==== Consumables: storage helpers ====
  const CONS_KEY = (vid: number) => `consumables_${vid}`;
  function loadConsumablesFromStorage(vid: number): any[] {
    try { return normalizeConsumables(JSON.parse(localStorage.getItem(CONS_KEY(vid)!) || '[]')); }
    catch { return []; }
  }
  function saveConsumablesToStorage(vid: number, items: any[]) {
    try { localStorage.setItem(CONS_KEY(vid), JSON.stringify(items)); } catch { }
  }

  // ==== Consumables: states ====
  const [consumables, setConsumables] = useState<any[]>([]);
  const [consumablesStatus, setConsumablesStatus] =
    useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [consumablesOpen, setConsumablesOpen] = useState(false);
  const [consumableMode, setConsumableMode] = useState<'time' | 'km'>('km');
  const [tripNote, setTripNote] = useState('');
  const [tripDate, setTripDate] = useState<Date | null>(new Date());
  const [tripBaseKm, setTripBaseKm] = useState<number | null>(null);
  const [editingCons, setEditingCons] = useState<any | null>(null);
  const [savingCons, setSavingCons] = useState(false);
  const consReqIdRef = React.useRef(0);

  // یادآوری بر اساس مسافت/زمان
  const DEFAULT_KM_REMINDER = 5000;
  const notifiedRef = React.useRef<Set<string>>(new Set());
  const keyOfCons = (c: any) => String(c?.id ?? `${c.mode}:${c.start_at ?? c.base_odometer_km ?? c.note ?? Math.random()}`);
  const [toast, setToast] = useState<{ open: boolean; msg: string } | null>(null);
  const notifyOnce = (c: any, msg: string) => {
    const k = keyOfCons(c);
    if (notifiedRef.current.has(k)) return;
    notifiedRef.current.add(k);
    setToast({ open: true, msg });
  };

  // نرمالایزر (عین SA)
  const normalizeConsumables = (payload: any) => {
    let arr: any[] =
      Array.isArray(payload) ? payload :
        Array.isArray(payload?.items) ? payload.items :
          Array.isArray(payload?.data?.items) ? payload.data.items :
            Array.isArray(payload?.data) ? payload.data :
              Array.isArray(payload?.result) ? payload.result :
                Array.isArray(payload?.consumables) ? payload.consumables :
                  Array.isArray(payload?.records) ? payload.records :
                    Array.isArray(payload?.list) ? payload.list :
                      Array.isArray(payload?.rows) ? payload.rows :
                        (payload && typeof payload === 'object' ? [payload] : []);

    const toNum = (v: any) => Number.isFinite(Number(v)) ? Number(v) : null;
    const toISO = (v: any) => v ? (isNaN(+new Date(v)) ? null : new Date(v).toISOString()) : null;

    const out = arr.map((c: any) => ({
      ...c,
      id: c.id ?? c._id ?? undefined,
      mode: (c.mode ?? c.type) === 'time' ? 'time' : 'km',
      note: c.note ?? c.description ?? '',
      title: c.title ?? c.name ?? c.note ?? undefined,
      created_at: toISO(c.created_at ?? c.createdAt),
      start_at: toISO(c.start_at ?? c.startAt ?? c.start_time ?? c.startTime),
      base_odometer_km: toNum(c.base_odometer_km ?? c.baseOdometerKm ?? c.base_odo ?? c.base_odo_km),
      vehicle_id: c.vehicle_id ?? c.vehicleId ?? null,
    }));

    const map = new Map<string | number, any>();
    out.forEach(x => map.set(x.id ?? `${x.mode}:${x.start_at ?? x.base_odometer_km ?? x.note ?? ''}`, x));
    return Array.from(map.values());
  };

  function mergeConsumables(prev: any[], next: any[]) {
    const map = new Map<string | number, any>();
    [...prev, ...next].forEach(c => map.set(c?.id ?? `${c.mode}:${c.start_at ?? c.base_odometer_km ?? c.note ?? ''}`, c));
    return Array.from(map.values());
  }

  // API helpers (عین SA با فالبک snake/camel)
  async function updateConsumable(vid: number, id: number, payload: { mode: 'km' | 'time'; note: string; start_at?: string | null; base_odometer_km?: number | null }) {
    const snake = payload.mode === 'time'
      ? { mode: 'time', note: payload.note, start_at: payload.start_at }
      : { mode: 'km', note: payload.note, base_odometer_km: payload.base_odometer_km };
    try {
      return await api.patch(`/vehicles/${vid}/consumables/${id}`, snake);
    } catch {
      const camel = payload.mode === 'time'
        ? { mode: 'time', note: payload.note, startAt: payload.start_at }
        : { mode: 'km', note: payload.note, baseOdometerKm: payload.base_odometer_km };
      return await api.patch(`/vehicles/${vid}/consumables/${id}`, camel);
    }
  }

  async function createConsumable(vid: number, payload: { mode: 'km' | 'time'; note: string; start_at?: string | null; base_odometer_km?: number | null }) {
    const snake = payload.mode === 'time'
      ? { mode: 'time', note: payload.note, start_at: payload.start_at }
      : { mode: 'km', note: payload.note, base_odometer_km: payload.base_odometer_km };
    try { return await api.post(`/vehicles/${vid}/consumables`, snake); }
    catch {
      const camel = payload.mode === 'time'
        ? { mode: 'time', note: payload.note, startAt: payload.start_at }
        : { mode: 'km', note: payload.note, baseOdometerKm: payload.base_odometer_km };
      try { return await api.post(`/vehicles/${vid}/consumables`, camel); }
      catch {
        try { return await api.post(`/vehicles/${vid}/consumables`, { consumable: snake }); }
        catch { return await api.post(`/vehicles/${vid}/consumables`, { consumable: camel }); }
      }
    }
  }

  const refreshConsumables = React.useCallback(async (vid: number, forceServer = false) => {
    const myId = ++consReqIdRef.current;
    setConsumablesStatus('loading');

    if (!forceServer) {
      const cached = loadConsumablesFromStorage(vid);
      if (cached.length) setConsumables(prev => mergeConsumables(prev, cached));
    }

    try {
      const { data } = await api.get(`/vehicles/${vid}/consumables`, { params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' } });
      if (myId !== consReqIdRef.current) return;
      const list = normalizeConsumables(data);
      setConsumables(() => {
        saveConsumablesToStorage(vid, list);
        return list;
      });
      setConsumablesStatus('loaded');
    } catch {
      if (myId !== consReqIdRef.current) return;
      setConsumablesStatus('error');
    }
  }, []);

  const openEditConsumable = (c: any) => setEditingCons({
    id: c.id, mode: c.mode, note: c.note ?? '',
    start_at: c.start_at ?? null, base_odometer_km: c.base_odometer_km ?? null,
  });
  const closeEditConsumable = () => setEditingCons(null);

  const saveEditConsumable = async () => {
    if (!selectedVehicle || !editingCons?.id) return;
    setSavingCons(true);
    try {
      const payload: any = { mode: editingCons.mode, note: (editingCons.note ?? '').trim() };
      if (editingCons.mode === 'time') {
        if (!editingCons.start_at) { alert('start_at لازم است'); setSavingCons(false); return; }
        payload.start_at = new Date(editingCons.start_at).toISOString();
      } else {
        const n = Number(editingCons.base_odometer_km);
        if (!Number.isFinite(n)) { alert('base_odometer_km معتبر نیست'); setSavingCons(false); return; }
        payload.base_odometer_km = n;
      }
      await updateConsumable(selectedVehicle.id, editingCons.id, payload);
      await refreshConsumables(selectedVehicle.id, true);
      closeEditConsumable();
    } catch (e: any) {
      console.error('PATCH /consumables failed:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'خطا در ویرایش آیتم');
    } finally { setSavingCons(false); }
  };

  const deleteConsumable = async (c: any) => {
    if (!selectedVehicle || !c?.id) return;
    if (!confirm('آیتم حذف شود؟')) return;
    const vid = selectedVehicle.id;
    setConsumables(prev => { const next = prev.filter(x => x.id !== c.id); saveConsumablesToStorage(vid, next); return next; });
    try {
      await api.delete(`/vehicles/${vid}/consumables/${c.id}`);
      await refreshConsumables(vid, true);
      if (editingCons?.id === c.id) closeEditConsumable();
    } catch (e: any) {
      await refreshConsumables(vid, true);
      console.error('DELETE /consumables failed:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'حذف روی سرور ناموفق بود');
    }
  };

  const handleAddConsumable = async () => {
    if (!selectedVehicle) return;
    try {
      const payload: any = { mode: consumableMode, note: (tripNote || '').trim() };
      if (consumableMode === 'time') {
        if (!tripDate) { alert('تاریخ لازم است'); return; }
        payload.start_at = new Date(tripDate).toISOString();
      } else {
        const base = Number(tripBaseKm ?? vehicleTlm.odometer);
        if (!Number.isFinite(base)) { alert('مقدار مبنا معتبر نیست'); return; }
        payload.base_odometer_km = base;
      }
      const { data } = await createConsumable(selectedVehicle.id, payload);
      const [created] = normalizeConsumables([data]);
      setConsumables(prev => {
        const next = created ? [created, ...prev] : prev;
        saveConsumablesToStorage(selectedVehicle.id!, next);
        return next;
      });
      setConsumablesStatus('loaded');
      await refreshConsumables(selectedVehicle.id, true);
      setConsumablesOpen(false); setTripNote(''); setTripBaseKm(null);
    } catch (err: any) {
      console.error('POST /consumables failed:', err?.response?.data || err);
      alert(err?.response?.data?.message || 'خطا در ذخیره لوازم مصرفی');
    }
  };

  const handleTripReset = async () => {
    if (!selectedVehicle) return;
    const liveOdoKm = vehicleTlm.odometer;
    if (liveOdoKm == null) { alert('داده‌ی کیلومترشمار در دسترس نیست.'); return; }
    try {
      await api.post(`/vehicles/${selectedVehicle.id}/trip/start`, {
        base_odometer_km: Number(liveOdoKm),
        started_at: (tripDate || new Date()).toISOString(),
        note: (tripNote || '').trim(),
      }).catch(() => { });
    } catch { }
    setTripBaseKm(Number(liveOdoKm));
  };

  // یادآوری‌ها
  const checkConsumableDue = React.useCallback(() => {
    const now = Date.now();
    consumables.forEach((c: any) => {
      if (c.mode === 'time' && c.start_at) {
        const t = new Date(c.start_at).getTime();
        if (!Number.isNaN(t) && now >= t) {
          notifyOnce(c, `یادآوری: «${c.title ?? c.note ?? 'آیتم'}» به زمان تعیین‌شده رسید.`);
        }
      }
      if (c.mode === 'km' && c.base_odometer_km != null && vehicleTlm.odometer != null) {
        const dist = Number(vehicleTlm.odometer) - Number(c.base_odometer_km);
        if (dist >= DEFAULT_KM_REMINDER) {
          notifyOnce(c, `یادآوری: «${c.title ?? c.note ?? 'آیتم'}» به ${DEFAULT_KM_REMINDER.toLocaleString('fa-IR')} کیلومتر پس از صفر رسید.`);
        }
      }
    });
  }, [consumables, vehicleTlm.odometer]);
  const fetchVehicleViolations = React.useCallback(async (vehicleId: number, limit: number = 50) => {
    if (!vehicleId) return;
    setVehicleViolationsLoading(true);
    setVehicleViolationsError(null);
    try {
      const { data } = await api.get(`/vehicles/${vehicleId}/violations`, { params: { limit } });
      setVehicleViolations(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setVehicleViolationsError(e?.message || 'خطا در دریافت تخلفات خودرو');
      setVehicleViolations([]);
    } finally {
      setVehicleViolationsLoading(false);
    }
  }, []);

  const fetchRecentViolations = React.useCallback(async (limit: number = 50) => {
    setRecentViolationsLoading(true);
    try {
      const { data } = await api.get(`/violations/recent`, { params: { limit } });
      setRecentViolations(Array.isArray(data) ? data : []);
    } finally {
      setRecentViolationsLoading(false);
    }
  }, []);

  useEffect(() => { checkConsumableDue(); }, [checkConsumableDue]);
  useEffect(() => {
    const id = setInterval(checkConsumableDue, 30_000);
    return () => clearInterval(id);
  }, [checkConsumableDue]);

  // --- تله‌متری‌ها ---
  const onIgn = React.useCallback((d: { vehicle_id: number; ignition: boolean }) => {
    if (selectedVehicle?.id === d.vehicle_id) setVehicleTlm(p => ({ ...p, ignition: d.ignition }));
  }, [selectedVehicle?.id]);

  const onIdle = React.useCallback((d: { vehicle_id: number; idle_time: number }) => {
    if (selectedVehicle?.id === d.vehicle_id) setVehicleTlm(p => ({ ...p, idle_time: d.idle_time }));
  }, [selectedVehicle?.id]);

  const onOdo = React.useCallback((d: { vehicle_id: number; odometer: number }) => {
    if (selectedVehicle?.id === d.vehicle_id) setVehicleTlm(p => ({ ...p, odometer: d.odometer }));
  }, [selectedVehicle?.id]);

  const onTemp = React.useCallback((d: { vehicle_id: number; engine_temp: number }) => {
    if (selectedVehicle?.id === d.vehicle_id) setVehicleTlm(p => ({ ...p, engine_temp: d.engine_temp }));
  }, [selectedVehicle?.id]);
  // ====== سوکت اتصال و لیسنر ======
  // اتصال سوکت (یک‌بار)
  useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const s = io(url + '/vehicles', { transports: ['websocket'] });
    socketRef.current = s;

    // ✅ cleanup درست
    return () => {
      if (lastPosSubRef.current != null) s.emit('unsubscribe', { topic: POS_TOPIC(lastPosSubRef.current) });
      if (lastTelemSubRef.current) {
        const { vid, keys } = lastTelemSubRef.current;
        keys.forEach(k => s.emit('unsubscribe', { topic: `vehicle/${vid}/${k}` }));
      }
      if (lastStationsSubRef.current) {
        const { vid, uid } = lastStationsSubRef.current;
        s.emit('unsubscribe', { topic: STATIONS_TOPIC(vid, uid) });
        s.emit('unsubscribe', { topic: STATIONS_PUBLIC_TOPIC(vid) });
      }
      if (lastAiSubRef.current) {
        const { vid, uid } = lastAiSubRef.current;
        s.emit('unsubscribe', { topic: AI_TOPIC(vid, uid) });
        lastAiSubRef.current = null;
      }
      s.disconnect();
      socketRef.current = null;
    };

  }, []);



  // ====== داده‌ها: SA + راننده‌ها ======
  const findTopSuperAdmin = (userId: number | null | undefined, byId: Record<number, FlatUser>): number | null => {
    let cursor = (userId != null) ? byId[userId] : undefined;
    let steps = 0;
    while (cursor && steps < 1000) {
      if (cursor.role_level === 2) return cursor.id;
      const pid = cursor.parent_id ?? null;
      cursor = (pid != null) ? byId[pid] : undefined;
      steps++;
    }
    return null;
  };

  const fetchAll = useCallback(async () => {
    setLoadingAll(true);
    setErrorAll(null);
    try {
      const { data } = await api.get('/users/my-subordinates-flat');
      const all: FlatUser[] = Array.isArray(data) ? data : [];
      const byId: Record<number, FlatUser> = {}; all.forEach(u => { byId[u.id] = u; });

      const superAdmins = all.filter(u => u.role_level === 2);
      const drivers = all.filter(u => u.role_level === 6);

      const grouped: Record<number, FlatUser[]> = {};
      for (const d of drivers) {
        let saId: number | null = null;
        if (d.parent_id && byId[d.parent_id]?.role_level === 2) saId = d.parent_id;
        else saId = findTopSuperAdmin(d.parent_id, byId);
        if (saId != null) (grouped[saId] ||= []).push(d);
      }

      superAdmins.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'fa'));
      Object.keys(grouped).forEach(k => grouped[+k].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'fa')));

      setSupers(superAdmins);
      setDriversBySA(grouped);

      if (!selectedSAId) {
        const myTopSA = user?.role_level === 2
          ? user.id
          : findTopSuperAdmin(user?.id ?? null, byId);
        const fallback = superAdmins[0]?.id ?? null;
        setSelectedSAId(myTopSA ?? fallback);
      }
    } catch (e: any) {
      setErrorAll(e?.message || 'خطای دریافت داده');
      setSupers([]); setDriversBySA({}); setSelectedSAId(null);
    } finally { setLoadingAll(false); }
  }, [selectedSAId]);

  useEffect(() => { fetchAll(); }, [fetchAll, user?.id]);

  // ====== وسایل نقلیه SA ======
  const fetchVehiclesOfSA = useCallback(async (saId: number) => {
    try {
      const { data } = await api.get('/vehicles', { params: { owner_user_id: saId, limit: 1000 } });
      const items: any[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      const list: Vehicle[] = items.map((v: any) => ({
        id: Number(v.id),
        owner_user_id: Number(v.owner_user_id ?? v.ownerUserId ?? saId),
        plate_no: String(v.plate_no ?? v.plateNo ?? ''),
        vehicle_type_code: String(v.vehicle_type_code ?? v.vehicleTypeCode ?? ''),
        ...(v.last_location ? { last_location: { lat: Number(v.last_location.lat), lng: Number(v.last_location.lng) } } : {}),
      })).sort((a, b) => a.plate_no.localeCompare(b.plate_no, 'fa', { numeric: true }));
      setVehiclesBySA(prev => ({ ...prev, [saId]: list }));
    } catch {
      setVehiclesBySA(prev => ({ ...prev, [saId]: [] }));
    }
  }, []);
  // منیجر = همیشه همه گزینه‌ها فعال
  useEffect(() => {
    setVehicleOptions(ALL_KEYS);
  }, [selectedSAId, tabSA, selectedVehicle?.id]);

  useEffect(() => {
    if (selectedSAId) {
      // وقتی تب به vehicles می‌ره یا SA عوض می‌شود، لیست وسایل را بگیر
      if (!(selectedSAId in vehiclesBySA)) fetchVehiclesOfSA(selectedSAId);
    }
  }, [selectedSAId, tabSA, vehiclesBySA, fetchVehiclesOfSA]);
  // نقاط مسیر را با چند مسیر متداول امتحان می‌گیرد





  // ====== فیلتر جستجوی SA ======
  const filteredSupers = useMemo(() => {
    const s = qSA.trim().toLowerCase();
    if (!s) return supers;
    return supers.filter(sa => (sa.full_name || '').toLowerCase().includes(s) || (sa.phone || '').includes(s));
  }, [supers, qSA]);

  // داده‌ی تب جاری برای SA انتخاب‌شده
  const currentDrivers = selectedSAId ? (driversBySA[selectedSAId] || []) : [];
  const currentVehicles = selectedSAId ? (vehiclesBySA[selectedSAId] || []) : [];
  const selectedSANode = useMemo<UserNode | null>(() => {
    const sa = (selectedSAId != null
      ? supers.find(s => s.id === selectedSAId)
      : supers[0]) || null;

    if (!sa) return null;

    // سطح بعدی: راننده‌های همین SA
    const subs: UserNode[] = (driversBySA[sa.id] || []).map(d => ({
      id: d.id,
      full_name: d.full_name,
      role_level: 6,
      subordinates: [],       // اگه لایه‌های بعدی داری اینجا پر کن
    }));

    return {
      id: sa.id,
      full_name: sa.full_name,
      role_level: 2,
      subordinates: subs,
    };
  }, [supers, selectedSAId, driversBySA]);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ====== انتخاب ماشین ======
  // این کد را به جای onPickVehicle فعلی قرار دهید

  const onPickVehicle = useCallback(async (v: Vehicle) => {
    const s = socketRef.current;

    // ۱. قطع اشتراک‌های قبلی
    unsubscribeAll();

    // ۲. ریست کردن UI و State ها
    setSelectedVehicle(v);
    setPolyline([]);
    setVehicleTlm({});
    setVehicleRoute(null);
    setAddingStationsForVid(null);
    setEditingStation(null);
    setMovingStationId(null);
    setTempStation(null);
    setGfDrawing(false);
    setGfCenter(null);
    setGfPoly([]);
    setSheetOpen(true);
    setConsumables([]);
    setConsumablesStatus('loading');
    fetchVehicleViolations(v.id, violationsLimit);

    // ✅ مهم: دسترسی کامل را برای منیجر به صورت خودکار تنظیم کن
    setVehicleOptions(ALL_KEYS);

    if (v.last_location) {
      setFocusLatLng([v.last_location.lat, v.last_location.lng]);
    }

    // ۳. بارگذاری موازی داده‌های اولیه
    await Promise.allSettled([
      ensureStationsLive(v.id),
      loadVehicleGeofences(v.id),
      refreshConsumables(v.id), // لوازم مصرفی همزمان لود شود
    ]);

    // ۴. بارگذاری مسیر جاری و لیست مسیرها
    await loadCurrentRoute(v.id);
    await fetchRoutesForVehicle(v.id);

    // ۵. سابسکرایب کردن سوکت برای داده‌های زنده
    if (s) {
      // تله‌متری
      const telemKeys = TELEMETRY_KEYS;
      telemKeys.forEach(k => s.emit('subscribe', { topic: `vehicle/${v.id}/${k}` }));
      lastTelemSubRef.current = { vid: v.id, keys: telemKeys };

      // موقعیت لحظه‌ای
      s.emit('subscribe', { topic: POS_TOPIC(v.id) });
      lastPosSubRef.current = v.id;
    }
  }, [user.id, ensureStationsLive, loadVehicleGeofences, refreshConsumables]);
  // جایی نزدیک راس فایل:
  function unsubscribeAll() {
    const s = socketRef.current;
    if (!s) return;

    if (lastPosSubRef.current != null) {
      s.emit('unsubscribe', { topic: POS_TOPIC(lastPosSubRef.current) });
      lastPosSubRef.current = null;
    }
    if (lastTelemSubRef.current) {
      const { vid: prevVid, keys } = lastTelemSubRef.current;
      keys.forEach(k => s.emit('unsubscribe', { topic: `vehicle/${prevVid}/${k}` }));
      lastTelemSubRef.current = null;
    }
    if (lastStationsSubRef.current) {
      const { vid: prevVid, uid } = lastStationsSubRef.current;
      s.emit('unsubscribe', { topic: STATIONS_TOPIC(prevVid, uid) });
      s.emit('unsubscribe', { topic: STATIONS_PUBLIC_TOPIC(prevVid) });
      lastStationsSubRef.current = null;
    }
    if (lastAiSubRef.current) {
      const { vid: prevVid, uid } = lastAiSubRef.current;
      s.emit('unsubscribe', { topic: AI_TOPIC(prevVid, uid) });
      lastAiSubRef.current = null;
    }
  }
  React.useEffect(() => {
    if (selectedVehicle?.id) {
      fetchVehicleViolations(selectedVehicle.id, violationsLimit);
    }
  }, [selectedVehicle?.id, violationsLimit, fetchVehicleViolations]);

  function buildGeofenceAroundRoutePoints(
    pts: { lat: number; lng: number }[],
    bufferMeters = 50,
    toleranceM = 15
  ): { type: 'polygon'; points: { lat: number; lng: number }[]; tolerance_m: number } | null {
    const clean = pts
      .map(p => ({ lat: +p.lat, lng: +p.lng }))
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (!clean.length) return null;

    const fc = turf.featureCollection(clean.map(p => turf.point([p.lng, p.lat])));

    let geom: turf.AllGeoJSON | null = null;
    if (clean.length < 3) {
      geom = turf.center(fc);                     // ✅ fallback
    } else {
      geom = (turf.concave(fc, { maxEdge: 1, units: 'kilometers' }) as turf.AllGeoJSON) || null;
      if (!geom) geom = turf.convex(fc) as turf.AllGeoJSON;
    }
    if (!geom) return null;

    const buff = turf.buffer(geom, bufferMeters, { units: 'meters' }) as unknown as Feature<Polygon | MultiPolygon>;
    if (!buff?.geometry) return null;

    const ring = buff.geometry.type === 'Polygon'
      ? buff.geometry.coordinates[0]
      : buff.geometry.coordinates[0][0];

    // ring باید آرایه‌ای از جفت-عددها باشه
    const polyPts = ring.map(([lng, lat]: [number, number]) => ({ lat, lng }));

    return { type: 'polygon', points: polyPts, tolerance_m: toleranceM };
  }




  // ====== LatLng های مارکرها برای Fit ======
  const markerLatLngs = useMemo<[number, number][]>(() => {
    if (!selectedSAId) return [];
    if (tabSA === 'drivers') {
      return currentDrivers.filter(d => d.last_location)
        .map(d => [d.last_location!.lat, d.last_location!.lng]);
    }
    return currentVehicles.filter(v => v.last_location)
      .map(v => [v.last_location!.lat, v.last_location!.lng]);
  }, [selectedSAId, tabSA, currentDrivers, currentVehicles]);
  // --- GPS زنده ماشین ---
  // --- GPS زنده ماشین ---


  // ✅ رجیستر/آنرجیستر لیسنرها با socketRef.current (نه sِ خارج از اسکوپ)
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    s.on('vehicle:pos', onVehiclePos);
    s.on('vehicle:ignition', onIgn);
    s.on('vehicle:idle_time', onIdle);
    s.on('vehicle:odometer', onOdo);
    s.on('vehicle:engine_temp', onTemp);

    return () => {
      s.off('vehicle:pos', onVehiclePos);
      s.off('vehicle:ignition', onIgn);
      s.off('vehicle:idle_time', onIdle);
      s.off('vehicle:odometer', onOdo);
      s.off('vehicle:engine_temp', onTemp);
    };
  }, [onVehiclePos, onIgn, onIdle, onOdo, onTemp]);

  const ellipseLatLngs = (
    center: { lat: number; lng: number },
    rx = ELLIPSE_RX_M, ry = ELLIPSE_RY_M,
    rot = ELLIPSE_ROT_DEG, seg = ELLIPSE_SEGMENTS
  ) => ellipsePolygonPoints(center, rx, ry, rot, seg)
    .map(p => [p.lat, p.lng] as [number, number]);


  function FocusOn({ target }: { target?: [number, number] }) {
    const map = useMap();
    useEffect(() => { if (target) map.panTo(target, { animate: true }); }, [target, map]);
    return null;
  }
  const [aiState, setAiState] = useState<{ onRoute?: boolean; inGeofence?: boolean; distanceToRoute_m?: number; reason?: string; ts?: number } | null>(null);

  // پنل پایینی وقتی ماشین انتخاب شده باز باشه (مثل SuperAdmin)
  const TOP_HEIGHT = sheetOpen ? { xs: '50vh', md: '55vh' } : '75vh';
  const SHEET_HEIGHT = { xs: 360, md: 320 };

  // ---- Types (اختیاری ولی مفید برای TS) ----
  type LatLng = { lat: number; lng: number };
  type CircleGeofence = { type: 'circle'; center: LatLng; radius_m: number; tolerance_m?: number };
  type PolygonGeofence = { type: 'polygon'; points: LatLng[]; tolerance_m?: number };
  const isDriverMode = !!selectedDriver && !selectedVehicle;

  // ---- Geofence store (اگر قبلاً تعریف نکردی) ----
  const isEditingOrDrawing =
    !!addingStationsForVid || gfDrawing || drawingRoute || !!editingStation || defaultsOpen;
  // دیالوگ تنظیمات پیش‌فرض باز است
  const aiView = React.useMemo(() => {
    if (!aiStatus) return null;
    const reasonTextMap: Record<string, string> = {
      UNKNOWN: 'نامشخص',
      OK: 'سالم',
      OFF_ROUTE: 'خارج از مسیر',
      OUT_OF_FENCE: 'خارج ژئوفنس',
      IDLE_OFF_ROUTE: 'توقف خارج مسیر',
      LOW_CONFIDENCE: 'اطمینان کم',
    };
    return {
      onRoute: aiStatus.onRoute === true,
      inGeofence: aiStatus.inFence === true,
      distanceToRoute_m: aiStatus.routeDistM ?? undefined,
      reason: reasonTextMap[aiStatus.reason] ?? aiStatus.reason,
      ts: aiStatus.lastUpdateAt,
    };
  }, [aiStatus]);

  useEffect(() => { routeThresholdRef.current = routeThreshold; }, [routeThreshold]);
  useEffect(() => {
    const pts = (vehicleRoute?.points ?? [])
      .slice()
      .sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0));
    routePolylineRef.current = pts.map(p => [p.lat, p.lng] as [number, number]);
  }, [vehicleRoute?.id, vehicleRoute?.points?.length]);

  // ====== UI ======
  return (

    <Grid2 container spacing={2} dir="ltr">
      {/* نقشه — چپ */}
      <Grid2 xs={12} md={8}>
        <Paper sx={{ height: TOP_HEIGHT, transition: 'height .28s ease', overflow: 'hidden', position: 'relative' }} dir="rtl">
          <MapContainer
            center={INITIAL_CENTER}
            zoom={INITIAL_ZOOM}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            whenCreated={(m: RLMap) => {
              freezeProgrammaticZoom(m);       // ⬅️ این خط
              mapRef.current = m;
              setTimeout(() => m.invalidateSize(), 0);
            }}
            style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }} // ⬅️ پایین

          >
            <TileLayer url={tileUrl} {...({ attribution: '&copy; OpenStreetMap | © MapTiler' } as any)} />
            <FocusOn target={focusLatLng} />
            {/* کلیک‌گیر: افزودن ایستگاه (فقط برای همان ماشین انتخاب‌شده) */}
            {selectedVehicle &&
              addingStationsForVid === selectedVehicle.id && (
                <PickPoints enabled onPick={(lat, lng) => setTempStation({ lat, lng })} />
              )
            }

            {/* کلیک‌گیر: ترسیم ژئوفنس */}
            {selectedVehicle && gfDrawing && (
              <PickPoints
                enabled
                onPick={(lat, lng) => {
                  if (gfMode === 'circle') setGfCenter({ lat, lng });
                  else setGfPoly(prev => [...prev, { lat, lng }]);
                }}
              />
            )}

            {/* کلیک‌گیر: ترسیم مسیر */}


            <Pane name="route-layer" style={{ zIndex: 400 }}>
              {/* پیش‌نمایش مسیرِ در حال ترسیم */}
              {drawingRoute && routePoints.length > 1 && (
                <>
                  <Polyline
                    positions={routePoints.map(p => [p.lat, p.lng] as [number, number])}
                    interactive={false}
                    pathOptions={{ weight: 3, opacity: 0.9 }}
                  />
                  <Polygon
                    positions={buildRouteBufferPolygon(routePoints, Math.max(1, routeThreshold || 60))
                      .map(p => [p.lat, p.lng] as [number, number])}
                    interactive={false}
                    pathOptions={{ weight: 1, opacity: 0.2 }}
                  />
                </>
              )}
              {vehicleRoute && (vehicleRoute.points?.length ?? 0) > 1 && (() => {
                const pts = (vehicleRoute.points ?? [])
                  .slice()
                  .sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0));

                if (pts.length < 2) return null;

                const threshold = vehicleRoute.threshold_m ?? routeThreshold ?? 60;

                return (
                  <>
                    {/* خط مسیر */}
                    <Polyline
                      positions={pts.map(p => [p.lat, p.lng] as [number, number])}
                      pathOptions={{ color: MAP_COLORS.route, weight: 4 }}
                    />

                    {/* کریدور مسیر */}
                    <Polygon
                      positions={buildRouteBufferPolygon(pts, Math.max(1, threshold))}
                      pathOptions={{ color: MAP_COLORS.corridor, weight: 1, fillOpacity: 0.15 }}
                    />
                  </>
                );
              })()}
              {/* ✅ END: کد صحیح برای رندر مسیر و کریدور */}
            </Pane>

            <Pane name="vehicles-layer" style={{ zIndex: 650 }}>
              {tabSA === 'drivers'
                ? currentDrivers.map(d => d.last_location && (
                  <Marker
                    key={d.id}
                    position={[d.last_location.lat, d.last_location.lng]}
                    icon={driverMarkerIcon as any}
                    zIndexOffset={1000}
                  >
                    <Popup><strong>{d.full_name}</strong><br />{d.phone || '—'}</Popup>
                  </Marker>
                ))
                : currentVehicles.map(v => v.last_location && (
                  <Marker
                    key={v.id}
                    position={[v.last_location.lat, v.last_location.lng]}
                    icon={vehicleMarkerIcon as any}
                    zIndexOffset={1000}
                  >
                    <Popup><strong>{v.plate_no}</strong><br />{v.vehicle_type_code || ''}</Popup>
                  </Marker>
                ))
              }
            </Pane>


            {/* پیش‌نمایش ژئوفنسِ در حال ترسیم */}
            {gfDrawing && gfMode === 'circle' && gfCenter && (
              <Circle center={[gfCenter.lat, gfCenter.lng]} radius={gfRadius} />
            )}
            {gfDrawing && gfMode === 'polygon' && gfPoly.length >= 2 && (
              <Polygon
                positions={gfPoly.map(p => [p.lat, p.lng] as [number, number])}
              />
            )}

            {/* مسیر جاری از سرور */}

            {/* مارکرهای تب جاری */}
            {tabSA === 'drivers'
              ? currentDrivers.map(d => d.last_location && (
                <Marker key={d.id} position={[d.last_location.lat, d.last_location.lng]} icon={driverMarkerIcon as any}>
                  <Popup><strong>{d.full_name}</strong><br />{d.phone || '—'}</Popup>
                </Marker>
              ))
              : currentVehicles.map(v => v.last_location && (
                <Marker key={v.id} position={[v.last_location.lat, v.last_location.lng]} icon={vehicleMarkerIcon as any}>
                  <Popup><strong>{v.plate_no}</strong><br />{v.vehicle_type_code || ''}</Popup>
                </Marker>
              ))
            }

            {/* مسیر لحظه‌ای/تاریخچه */}
            {polyline.length > 1 && <Polyline positions={polyline} />}

            {/* ایستگاه‌های ماشین انتخاب‌شده (از DB) */}
            {selectedVehicle && (vehicleStationsMap[selectedVehicle.id] || []).map(st => (
              <React.Fragment key={`st-${st.id}`}>
                <Polygon positions={ellipseLatLngs({ lat: st.lat, lng: st.lng })} />
                <Marker
                  position={[st.lat, st.lng]}
                  eventHandlers={{
                    click: () => setFocusLatLng([st.lat, st.lng]),
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 200 }}>
                      <strong>{st.name || 'ایستگاه'}</strong>
                      <div style={{ fontSize: 12, opacity: .8, marginTop: 6 }}>
                        {st.lat.toFixed(5)}, {st.lng.toFixed(5)} — شعاع: {st.radius_m ?? stationRadius} m
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button type="button" onClick={() => {
                          setEditingStation({ vid: selectedVehicle.id, st: { ...st } });
                          setMovingStationId(null);
                        }}
                        >
                          ویرایش
                        </button>
                        <button type="button" onClick={() => deleteStation(selectedVehicle.id, st)} style={{ color: '#c00' }}>
                          حذف
                        </button>
                        <button type="button" onClick={() => setFocusLatLng([st.lat, st.lng])}>
                          نمایش روی نقشه
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            ))}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mt: 1 }}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="route-picker-lbl">مسیرها (از سرور)</InputLabel>
                <Select
                  labelId="route-picker-lbl"
                  label="مسیرها (از سرور)"
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(Number(e.target.value))}
                  disabled={!selectedVehicle || routesLoading}
                >
                  {routes.map(r => (
                    <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                size="small"
                variant="outlined"
                onClick={() => selectedVehicle && fetchRoutesForVehicle(selectedVehicle.id)}
                startIcon={<span>🔄</span> as any}
                disabled={!selectedVehicle || routesLoading}
              >
                تازه‌سازی
              </Button>

              <Button
                size="small"
                onClick={() => Number.isFinite(Number(selectedRouteId)) && previewRoute(Number(selectedRouteId))}
                disabled={!selectedRouteId}
              >
                نمایش روی نقشه
              </Button>

              <Button
                size="small"
                variant="contained"
                onClick={() => selectedVehicle && Number.isFinite(Number(selectedRouteId)) && setAsCurrentRoute(selectedVehicle.id, Number(selectedRouteId))}
                disabled={!selectedVehicle || !selectedRouteId}
              >
                ست‌کردن به‌عنوان مسیر جاری
              </Button>
            </Stack>

            {/* مارکر موقت ایستگاه جدید + Popup تایید */}
            {selectedVehicle && addingStationsForVid === selectedVehicle.id && tempStation && (
              <>
                <Polygon positions={ellipseLatLngs({ lat: tempStation.lat, lng: tempStation.lng })} />
                <Marker
                  position={[tempStation.lat, tempStation.lng]}
                  draggable
                  eventHandlers={{
                    add: (e: any) => e.target.openPopup(),
                    dragend: (e: any) => {
                      const ll = e.target.getLatLng();
                      setTempStation({ lat: ll.lat, lng: ll.lng });
                    },
                  }}
                >
                  <Popup autoClose={false} closeOnClick={false} autoPan>
                    <div style={{ minWidth: 220 }}>
                      <strong>ایجاد ایستگاه</strong>
                      <div style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>می‌توانید مارکر را جابجا کنید.</div>
                      <div style={{ marginTop: 8 }}>
                        <input
                          style={{ width: '100%', padding: 6 }}
                          placeholder="نام ایستگاه"
                          value={tempName}
                          onChange={e => setTempName(e.target.value)}
                        />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button type="button" onClick={confirmTempStation}>تایید</button>
                        <button type="button" onClick={() => setTempStation(null)}>لغو</button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}

            {/* جابه‌جایی ایستگاه در حالت ادیت */}
            {editingStation && movingStationId === editingStation.st.id && (
              <>
                <Polygon positions={ellipseLatLngs({ lat: editingStation.st.lat, lng: editingStation.st.lng })} />
                <Marker
                  position={[editingStation.st.lat, editingStation.st.lng]}
                  draggable
                  eventHandlers={{
                    dragend: (e: any) => {
                      const ll = e.target.getLatLng();
                      setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, lat: ll.lat, lng: ll.lng } }) : ed);
                    }
                  }}
                />
              </>
            )}

            {/* ژئوفنس‌های ذخیره‌شده */}
            {selectedVehicle && (geofencesByVid[selectedVehicle.id] || []).map((gf, idx) =>
              gf.type === 'circle'
                ? <Circle key={`gf-${gf.id ?? idx}`} center={[gf.center.lat, gf.center.lng]} radius={gf.radius_m} />
                : <Polygon key={`gf-${gf.id ?? idx}`} positions={gf.points.map(p => [p.lat, p.lng] as [number, number])} />
            )}
            {/* کلیک‌گیر: ترسیم مسیر */}
            {selectedVehicle && drawingRoute && (
              <PickPoints
                enabled
                onPick={(lat, lng) => {
                  setRoutePoints(prev => [...prev, { lat, lng, order_no: prev.length }]);
                }}
              />
            )}
            <Button
              size="small"
              variant={drawingRoute ? 'contained' : 'outlined'}
              onClick={() => {
                setDrawingRoute(v => !v);
                if (!drawingRoute) {
                  setRoutePoints([]); // شروع تازه
                }
              }}
              sx={{
                scrollSnapAlign: 'center',
                borderRadius: 999,
                px: 0.9,
                minHeight: 22,
                fontSize: 10,
                borderColor: '#00c6be66',
                ...(drawingRoute
                  ? { bgcolor: '#00c6be', '&:hover': { bgcolor: '#00b5ab' } }
                  : { '&:hover': { bgcolor: '#00c6be12' } }),
                boxShadow: drawingRoute ? '0 4px 12px #00c6be44' : 'none',
              }}
              startIcon={<span>✏️</span>}
            >
              {drawingRoute ? 'پایان ترسیم مسیر' : 'ترسیم مسیر'}
            </Button>
            {drawingRoute && (
              <>
                <Button
                  size="small"
                  onClick={() => setRoutePoints(pts => pts.slice(0, -1))}
                  disabled={routePoints.length === 0}
                  sx={{ borderRadius: 999, px: 0.9, minHeight: 22, fontSize: 10, border: '1px solid #00c6be44' }}
                  startIcon={<span>↩️</span>}
                >
                  برگشت نقطه
                </Button>
                <Button
                  size="small"
                  onClick={() => setRoutePoints([])}
                  disabled={routePoints.length === 0}
                  sx={{ borderRadius: 999, px: 0.9, minHeight: 22, fontSize: 10, border: '1px solid #00c6be44' }}
                  startIcon={<span>🗑️</span>}
                >
                  پاک‌کردن نقاط
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => selectedVehicle && saveDrawnRoute(selectedVehicle.id)}
                  disabled={!selectedVehicle || routePoints.length < 2}
                  startIcon={<span>💾</span>}
                >
                  ذخیره مسیر جدید
                </Button>
              </>
            )}

          </MapContainer>

          {/* پنل شناور روی نقشه: کارت‌های زنده + میانبرها */}
          {selectedVehicle && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 2000,          // بالاتر از لایه‌های Leaflet
                pointerEvents: 'none', // اوورلی خودش کلیک نگیره
              }}
            >
              {/* کانتینر اسکِیل‌شده */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  transform: 'scale(1.2)',        // ⬅️ ۲۰٪ اندازه
                  transformOrigin: 'top left',   // ⬅️ از بالا-چپ کوچک کن
                  width: 'max-content',          // ⬅️ فقط به اندازۀ محتوا جا بگیره
                  pointerEvents: 'auto',         // ⬅️ کلیک روی دکمه‌ها فعال
                }}
              >
                {/* === AI: وضعیت مسیر/ژئوفنس (جدید) === */}
                <Stack direction="row" spacing={0.5} sx={{ mb: 0.75, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    icon={<span>🧠</span> as any}
                    label={
                      aiView?.onRoute === false
                        ? 'خارج از مسیر'
                        : aiView?.onRoute
                          ? 'داخل مسیر'
                          : '— مسیر'
                    }
                    sx={(t) => ({
                      fontWeight: 700,
                      border: `1px solid ${aiView?.onRoute === false
                        ? t.palette.error.light
                        : aiView?.onRoute
                          ? t.palette.success.light
                          : t.palette.divider
                        }`,
                      bgcolor:
                        aiView?.onRoute === false
                          ? t.palette.error.light + '22'
                          : aiView?.onRoute
                            ? t.palette.success.light + '22'
                            : t.palette.background.paper + 'AA',
                      '& .MuiChip-label': { px: 0.75, py: 0.25, fontSize: 10 },
                    })}
                  />

                  <Chip
                    size="small"
                    icon={<span>📍</span> as any}
                    label={
                      aiView?.inGeofence === false
                        ? 'خارج ژئوفنس'
                        : aiView?.inGeofence
                          ? 'داخل ژئوفنس'
                          : '— ژئوفنس'
                    }
                    sx={(t) => ({
                      fontWeight: 700,
                      border: `1px solid ${aiView?.inGeofence === false
                        ? t.palette.warning.light
                        : aiView?.inGeofence
                          ? t.palette.info.light
                          : t.palette.divider
                        }`,
                      bgcolor:
                        aiView?.inGeofence === false
                          ? t.palette.warning.light + '22'
                          : aiView?.inGeofence
                            ? t.palette.info.light + '22'
                            : t.palette.background.paper + 'AA',
                      '& .MuiChip-label': { px: 0.75, py: 0.25, fontSize: 10 },
                    })}
                  />

                  {aiView?.onRoute === false && Number.isFinite(aiView?.distanceToRoute_m) && (
                    <Chip
                      size="small"
                      icon={<span>↔️</span> as any}
                      label={`انحراف: ${Math.round(aiView!.distanceToRoute_m!)} m`}
                      sx={(t) => ({
                        fontWeight: 700,
                        border: `1px solid ${t.palette.error.light}`,
                        bgcolor: t.palette.error.light + '14',
                        '& .MuiChip-label': { px: 0.75, py: 0.25, fontSize: 10 },
                      })}
                    />
                  )}

                  {aiView?.reason && (
                    <Chip
                      size="small"
                      icon={<span>ℹ️</span> as any}
                      label={aiView.reason}
                      sx={(t) => ({
                        border: `1px dashed ${t.palette.divider}`,
                        bgcolor: t.palette.background.paper + 'AA',
                        '& .MuiChip-label': {
                          px: 0.75,
                          py: 0.25,
                          fontSize: 10,
                          maxWidth: 220,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        },
                      })}
                    />
                  )}
                </Stack>


                {/* کارت‌های زنده (خیلی کوچک) */}
                <Stack direction="row" spacing={0.5} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                  <Paper sx={(t) => ({
                    p: 0.25, borderRadius: 1, border: `1px solid ${t.palette.divider}`,
                    bgcolor: t.palette.background.paper + 'AA', mr: 0.5,
                  })}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Box sx={{ fontSize: 12, lineHeight: 1 }}>🔌</Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 10 }} color="text.secondary">وضعیت سوئیچ</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 0.25 }}>
                          {vehicleTlm.ignition === true ? 'روشن'
                            : vehicleTlm.ignition === false ? 'خاموش' : 'نامشخص'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>

                  <Paper sx={(t) => ({
                    p: 0.25, borderRadius: 1, border: `1px solid ${t.palette.divider}`,
                    bgcolor: t.palette.background.paper + 'AA', mr: 0.5,
                  })}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Box sx={{ fontSize: 12, lineHeight: 1 }}>⏱️</Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 10 }} color="text.secondary">مدت سکون</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 0.25 }}>
                          {vehicleTlm.idle_time != null
                            ? new Date(Number(vehicleTlm.idle_time) * 1000).toISOString().substring(11, 19)
                            : '—'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>

                  <Paper sx={(t) => ({
                    p: 0.25, borderRadius: 1, border: `1px solid ${t.palette.divider}`,
                    bgcolor: t.palette.background.paper + 'AA', mr: 0.5,
                  })}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Box sx={{ fontSize: 12, lineHeight: 1 }}>🛣️</Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 10 }} color="text.secondary">کیلومترشمار</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 0.25, display: 'flex', alignItems: 'baseline', gap: .25 }}>
                          <span>{vehicleTlm.odometer != null ? vehicleTlm.odometer.toLocaleString('fa-IR') : '—'}</span>
                          <Typography component="span" sx={{ fontSize: 9 }} color="text.secondary">km</Typography>
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Stack>

                {/* میان‌برها (خیلی کوچک) */}
                <Paper
                  sx={(t) => ({
                    p: 0.25,
                    borderRadius: 1.5,
                    border: `1px solid ${t.palette.divider}`,
                    bgcolor: `${t.palette.background.paper}C6`,
                    backdropFilter: 'blur(6px)',
                    boxShadow: '0 6px 16px rgba(0,0,0,.18)',
                    overflow: 'hidden',
                  })}
                >
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        const sc = (e.currentTarget.parentElement?.querySelector('.map-ctrl-scroll') as HTMLElement | null);
                        sc?.scrollBy({ left: -260, behavior: 'smooth' });
                      }}
                      sx={{ border: '1px solid #00c6be44', bgcolor: '#00c6be12', '&:hover': { bgcolor: '#00c6be22' } }}
                    >
                      ‹
                    </IconButton>

                    <Box
                      className="map-ctrl-scroll"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        overflowX: 'auto',
                        px: 0.25,
                        scrollSnapType: 'x mandatory',
                        scrollbarWidth: 'thin',
                        '&::-webkit-scrollbar': { height: 6 },
                        '&::-webkit-scrollbar-thumb': { background: '#00c6be55', borderRadius: 8 },
                      }}
                    >
                      <Chip
                        size="small"
                        icon={<span>📍</span> as any}
                        label={`ماشین: ${selectedVehicle.plate_no}`}
                        sx={{
                          scrollSnapAlign: 'center',
                          fontWeight: 700,
                          border: '1px solid #00c6be55',
                          bgcolor: '#00c6be18',
                          color: '#009e97',
                          '& .MuiChip-label': { px: 0.75, py: 0.25, fontSize: 10 },
                        }}
                      />

                      <Button
                        size="small"
                        onClick={() =>
                          selectedVehicle?.last_location &&
                          setFocusLatLng([selectedVehicle.last_location.lat, selectedVehicle.last_location.lng])
                        }
                        sx={{
                          scrollSnapAlign: 'center',
                          border: '1px solid #00c6be44',
                          bgcolor: '#ffffff',
                          '&:hover': { bgcolor: '#f5ffff' },
                          boxShadow: '0 4px 10px rgba(0,0,0,.08)',
                          borderRadius: 999,
                          px: 0.8,
                          minHeight: 22,
                          fontSize: 10,
                        }}
                        startIcon={<span>🎯</span>}
                      >
                        مرکز روی ماشین
                      </Button>

                      <Button
                        size="small"
                        variant={addingStationsForVid === selectedVehicle.id ? 'contained' : 'outlined'}
                        onClick={() => {
                          const next = addingStationsForVid === selectedVehicle.id ? null : selectedVehicle.id;
                          setAddingStationsForVid(next);
                          setTempStation(null);
                          setTempName(`ایستگاه ${autoIndex}`);
                        }}
                        sx={{
                          scrollSnapAlign: 'center',
                          borderRadius: 999,
                          px: 0.9,
                          minHeight: 22,
                          fontSize: 10,
                          borderColor: '#00c6be66',
                          ...(addingStationsForVid === selectedVehicle.id
                            ? { bgcolor: '#00c6be', '&:hover': { bgcolor: '#00b5ab' } }
                            : { '&:hover': { bgcolor: '#00c6be12' } }),
                          boxShadow: addingStationsForVid === selectedVehicle.id ? '0 4px 12px #00c6be44' : 'none',
                        }}
                        startIcon={<span>➕</span>}
                      >
                        {addingStationsForVid === selectedVehicle.id ? 'پایان افزودن' : 'افزودن ایستگاه'}
                      </Button>

                      <Button
                        size="small"
                        variant={gfDrawing ? 'contained' : 'outlined'}
                        onClick={() => setGfDrawing(v => !v)}
                        sx={{
                          scrollSnapAlign: 'center',
                          borderRadius: 999,
                          px: 0.9,
                          minHeight: 22,
                          fontSize: 10,
                          borderColor: '#00c6be66',
                          ...(gfDrawing
                            ? { bgcolor: '#00c6be', '&:hover': { bgcolor: '#00b5ab' } }
                            : { '&:hover': { bgcolor: '#00c6be12' } }),
                          boxShadow: gfDrawing ? '0 4px 12px #00c6be44' : 'none',
                        }}
                        startIcon={<span>✏️</span>}
                      >
                        {gfDrawing ? 'پایان ژئوفنس' : 'ترسیم ژئوفنس'}
                      </Button>

                      <Button
                        size="small"
                        onClick={() => loadCurrentRoute(selectedVehicle.id)}
                        sx={{
                          scrollSnapAlign: 'center',
                          borderRadius: 999,
                          px: 0.9,
                          minHeight: 22,
                          fontSize: 10,
                          border: '1px solid #00c6be44',
                          bgcolor: '#ffffff',
                          '&:hover': { bgcolor: '#f5ffff' },
                          boxShadow: '0 4px 10px rgba(0,0,0,.08)',
                        }}
                        startIcon={<span>🔄</span>}
                      >
                        تازه‌سازی مسیر
                      </Button>
                    </Box>

                    <IconButton
                      size="small"
                      onClick={(e) => {
                        const sc = (e.currentTarget.parentElement?.querySelector('.map-ctrl-scroll') as HTMLElement | null);
                        sc?.scrollBy({ left: 260, behavior: 'smooth' });
                      }}
                      sx={{ border: '1px solid #00c6be44', bgcolor: '#00c6be12', '&:hover': { bgcolor: '#00c6be22' } }}
                    >
                      ›
                    </IconButton>
                  </Stack>
                </Paper>
              </Box>
            </Box>
          )}

        </Paper>
      </Grid2>

      {/* SAها + تب‌ها — راست */}
      <Grid2 xs={12} md={4}>
        <Paper
          sx={(t) => ({
            p: 2,
            height: TOP_HEIGHT,
            '& .leaflet-pane, & .leaflet-top, & .leaflet-bottom': { zIndex: 0 },
            display: 'flex',
            transition: 'height .28s ease',
            flexDirection: 'column',
            border: `1px solid ${t.palette.divider}`,
            borderRadius: 2,
            bgcolor: t.palette.background.paper,
          })}
          dir="rtl"
        >
          {/* هدر پنل */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: .2 }}>
              سازمان ها
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                variant="contained"
                onClick={() => { setDefaultsOpen(true); }}
                startIcon={<span>⚙️</span>}
              >
                افزودن تنظیمات پیش‌فرض
              </Button>
              <Chip
                label={supers.length}
                size="small"
                sx={(t) => ({
                  fontWeight: 700,
                  color: ACC,
                  border: `1px solid ${ACC}33`,
                  bgcolor: `${ACC}14`,
                  '& .MuiChip-label': { px: 1.25 },
                })}
              />
            </Stack>
          </Stack>
          <Dialog open={defaultsOpen} onClose={() => setDefaultsOpen(false)} fullWidth maxWidth="lg">
            <DialogTitle>مدیریت پروفایل‌های تنظیمات</DialogTitle>
            <DialogContent dividers sx={{ p: 0, minHeight: '60vh', display: 'flex', flexDirection: 'column' }}>

              {/* شرط اصلی برای تعویض نما */}
              {currentView === 'list' ? (
                // ----------------------------------------------------
                // ✅ نمای اول: لیست پروفایل‌ها
                // ----------------------------------------------------
                <Box p={3}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">پروفایل‌های ذخیره‌شده</Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateNewProfile}>
                      ایجاد پروفایل جدید
                    </Button>
                  </Stack>
                  {profilesLoading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '40vh' }}>
                      <CircularProgress />
                    </Box>
                  ) : profiles.length > 0 ? (
                    <List>
                      {profiles.map(p => (
                        <ListItem
                          key={p.id}
                          divider
                          secondaryAction={
                            <Stack direction="row" spacing={0.5}>
                              <Tooltip title="بارگذاری این پروفایل در ویرایشگر">
                                <IconButton edge="end" onClick={() => handleLoadProfile(p.id)}>
                                  <DownloadIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="حذف پروفایل">
                                <IconButton edge="end" color="error" onClick={() => handleDeleteProfile(p.id)}>
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          }
                        >
                          <ListItemText
                            primary={p.name}
                            secondary={`شامل ${p.settings.stations.length} ایستگاه و ${p.settings.geofence ? 'ژئوفنس' : 'بدون ژئوفنس'}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                      هیچ پروفایلی ذخیره نشده است. برای شروع یک پروفایل جدید ایجاد کنید.
                    </Typography>
                  )}
                </Box>

              ) : (

                // ----------------------------------------------------
                // ✅ نمای دوم: ویرایشگر پروفایل (UI قبلی شما + فرم‌ها)
                // ----------------------------------------------------
                <Grid2 container sx={{ flex: 1 }}>
                  <Grid2 xs={12} md={7} sx={{ height: { xs: 360, md: 'auto' }, minHeight: 360, position: 'relative' }}>
                    <MapContainer
                      center={INITIAL_CENTER}
                      zoom={INITIAL_ZOOM}
                      minZoom={MIN_ZOOM}
                      maxZoom={MAX_ZOOM}
                      style={{ width: '100%', height: '100%' }}
                      whenCreated={(m: RLMap) => {
                        mapDefaultsRef.current = m;
                        setTimeout(() => m.invalidateSize(), 50);
                      }}
                    >
                      <TileLayer url={tileUrl} {...({ attribution: '&copy; OpenStreetMap | © MapTiler' } as any)} />
                      <ClickToAddCircleAndEllipse />

                      {clickFences.map((p, i) => {
                        const ring = ellipsePolygonPoints(
                          { lat: p.lat, lng: p.lng },
                          ELLIPSE_RX_M,   // مثلاً 80
                          ELLIPSE_RY_M,   // مثلاً 40
                          ELLIPSE_ROT_DEG,// مثلاً 0
                          ELLIPSE_SEGMENTS // مثلاً 72
                        );
                        return (
                          <React.Fragment key={`cf-${i}`}>
                            {/* آیکون دایره‌ایِ کوچک روی نقطهٔ کلیک */}
                            <CircleMarker
                              center={[p.lat, p.lng]}
                              radius={6}
                              pathOptions={{ weight: 2, color: '#1976d2', fillOpacity: 1 }}
                            />

                            {/* ژئوفنس بیضی (Polygon) بدون خط‌چین */}
                            <Polygon
                              positions={ring.map(p => [p.lat, p.lng] as [number, number])}
                              interactive={false}
                              pathOptions={{ weight: 1, opacity: 0.25 }}
                            />
                          </React.Fragment>
                        );
                      })}

                      {/* کلیک‌گیرها */}
                      <PickPointsDF
                        enabled={dfDrawing && dfGfMode === 'circle'}
                        onPick={(lat, lng) => setDfGfCircle(s => ({ ...s, center: { lat, lng } }))}
                      />
                      <PickPointsDF
                        enabled={dfDrawing && dfGfMode === 'polygon'}
                        onPick={(lat, lng) => setDfGfPoly(prev => [...prev, { lat, lng }])}
                      />
                      <PickPointsDF
                        enabled={dfAddingStation && !dfDrawing}
                        onPick={(lat, lng) => setDfTempSt({ name: `ایستگاه ${dfAuto}`, lat, lng, radius_m: 60 })}
                      />

                      {/* پیش‌نمایش ژئوفنس */}
                      {dfGfMode === 'circle' && dfGfCircle.center && (
                        <Circle
                          center={[dfGfCircle.center.lat, dfGfCircle.center.lng]}
                          radius={dfGfCircle.radius_m}
                          pathOptions={{ color: MAP_COLORS.geofence, weight: 2, fillColor: MAP_COLORS.geofenceFill, fillOpacity: 0.15 }}
                        />
                      )}

                      {dfGfMode === 'polygon' && dfGfPoly.length >= 2 && (
                        <Polygon
                          positions={dfGfPoly.map(p => [p.lat, p.lng] as [number, number])}
                          pathOptions={{ color: MAP_COLORS.geofence, weight: 2, dashArray: '6 6', fillColor: MAP_COLORS.geofenceFill, fillOpacity: 0.12 }}
                        />
                      )}


                      {/* ایستگاه‌های انتخاب‌شده */}
                      {dfStations.map((st, i) => (
                        <React.Fragment key={`dfst-${i}`}>
                          <Circle center={[st.lat, st.lng]} radius={st.radius_m} />
                          <Marker position={[st.lat, st.lng]}>
                            <Popup><b>{st.name}</b><br />{st.lat.toFixed(5)}, {st.lng.toFixed(5)}</Popup>
                          </Marker>
                        </React.Fragment>
                      ))}

                      {/* مارکر موقت ایستگاه */}
                      {dfTempSt && (
                        <>
                          <Circle center={[dfTempSt.lat, dfTempSt.lng]} radius={dfTempSt.radius_m} />
                          <Marker position={[dfTempSt.lat, dfTempSt.lng]} draggable
                            eventHandlers={{
                              add: (e: any) => e.target.openPopup(),
                              dragend: (e: any) => {
                                const ll = e.target.getLatLng();
                                setDfTempSt(s => s ? ({ ...s, lat: ll.lat, lng: ll.lng }) : s);
                              },
                            }}>
                            <Popup autoClose={false} closeOnClick={false} autoPan>
                              <div style={{ minWidth: 220 }}>
                                <strong>ایجاد ایستگاه</strong>
                                <div style={{ marginTop: 8 }}>
                                  <input
                                    style={{ width: '100%', padding: 6 }}
                                    placeholder="نام ایستگاه"
                                    value={dfTempSt.name}
                                    onChange={(e) => setDfTempSt(s => s ? ({ ...s, name: e.target.value }) : s)}
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                  <button onClick={() => { if (dfTempSt) { setDfStations(p => [...p, dfTempSt]); setDfAuto(a => a + 1); setDfTempSt(null); } }}>تایید</button>
                                  <button onClick={() => setDfTempSt(null)}>لغو</button>
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        </>
                      )}
                    </MapContainer>
                  </Grid2>

                  <Grid2 xs={12} md={5} sx={{ p: 2, overflowY: 'auto' }}>
                    <Stack spacing={2}>
                      <TextField
                        label="نام پروفایل"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        size="small"
                        fullWidth
                        required
                        variant="filled"
                      />
                      <Divider />

                      {/* فرم انتخاب هدف (ماشین‌ها) */}
                      <FormControl size="small">
                        <InputLabel id="df-target-lbl">اعمال روی</InputLabel>
                        <Select
                          labelId="df-target-lbl"
                          label="اعمال روی"
                          value={dfTarget}
                          onChange={(e) => setDfTarget(e.target.value as any)}
                        >
                          <MenuItem value="currentSA">همه‌ی ماشین‌های SA انتخاب‌شده</MenuItem>
                          <MenuItem value="currentVehicle" disabled={!selectedVehicle}>فقط ماشین انتخاب‌شده</MenuItem>
                        </Select>
                      </FormControl>

                      {/* لیست ماشین‌ها برای انتخاب */}
                      {dfTarget === 'currentSA' && (
                        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography fontWeight={700}>ماشین‌های SA انتخاب‌شده</Typography>
                            <FormControlLabel
                              control={<Checkbox checked={selectAll} onChange={(_, ch) => handleSelectAll(ch)} />}
                              label="انتخاب همه"
                            />
                          </Stack>
                          {selectedSAId && (vehiclesBySA[selectedSAId]?.length ?? 0) ? (
                            <List dense sx={{ maxHeight: 220, overflow: 'auto', mt: 1 }}>
                              {vehiclesBySA[selectedSAId]!.map(v => (
                                <ListItem key={v.id} secondaryAction={
                                  <Checkbox edge="end" checked={selectedVehicleIds.has(v.id)} onChange={() => toggleVehiclePick(v.id)} />
                                }>
                                  <ListItemText primary={v.plate_no} secondary={v.vehicle_type_code || '—'} />
                                </ListItem>
                              ))}
                            </List>
                          ) : (
                            <Typography sx={{ mt: 1 }} color="text.secondary" variant="body2">
                              برای این SA ماشینی وجود ندارد.
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {selectedVehicleIds.size.toLocaleString('fa-IR')} ماشین انتخاب شده‌اند.
                          </Typography>
                        </Paper>
                      )}

                      {/* فرم ژئوفنس */}
                      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Typography fontWeight={700}>ژئوفنس</Typography>
                          <Button size="small" onClick={() => setDfDrawing(v => !v)} variant={dfDrawing ? 'contained' : 'outlined'}>
                            {dfDrawing ? 'پایان ترسیم' : 'ترسیم روی نقشه'}
                          </Button>
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                          <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel id="df-gf-mode">حالت</InputLabel>
                            <Select
                              labelId="df-gf-mode"
                              value={dfGfMode}
                              label="حالت"
                              onChange={(e) => { setDfGfMode(e.target.value as any); setDfGfPoly([]); setDfGfCircle(c => ({ ...c, center: undefined })); }}
                            >
                              <MenuItem value="circle">دایره‌ای</MenuItem>
                              <MenuItem value="polygon">چندضلعی</MenuItem>
                            </Select>
                          </FormControl>
                          <TextField
                            size="small" label="تلورانس (m)" type="number"
                            value={dfGfCircle.tolerance_m}
                            onChange={(e) => setDfGfCircle(c => ({ ...c, tolerance_m: Math.max(0, Number(e.target.value || 0)) }))}
                            sx={{ width: 140 }}
                          />
                          {dfGfMode === 'circle' && (
                            <TextField size="small" label="شعاع (m)" type="number"
                              value={dfGfCircle.radius_m}
                              onChange={(e) => setDfGfCircle(c => ({ ...c, radius_m: Math.max(1, Number(e.target.value || 0)) }))}
                              sx={{ width: 140 }}
                            />
                          )}
                          {dfGfMode === 'polygon' && (
                            <Stack direction="row" spacing={1}>
                              <Button size="small" onClick={() => setDfGfPoly(pts => pts.slice(0, -1))} disabled={!dfGfPoly.length}>برگشت نقطه</Button>
                              <Button size="small" onClick={() => setDfGfPoly([])} disabled={!dfGfPoly.length}>پاک‌کردن</Button>
                            </Stack>
                          )}
                        </Stack>
                      </Paper>

                      {/* فرم ایستگاه‌ها */}
                      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Typography fontWeight={700}>ایستگاه‌ها</Typography>
                          <Chip size="small" label={`${dfStations.length} مورد`} />
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5, mb: 1 }}>
                          <Button size="small" variant={dfAddingStation ? 'contained' : 'outlined'}
                            onClick={() => {
                              setDfAddingStation(prev => !prev);
                              if (dfAddingStation) setDfTempSt(null);
                            }}
                            disabled={dfDrawing}
                          >
                            {dfAddingStation ? 'پایان افزودن' : 'افزودن ایستگاه'}
                          </Button>
                          {dfAddingStation && !dfDrawing && (
                            <Typography variant="caption" color="primary">روی نقشه کلیک کنید...</Typography>
                          )}
                        </Stack>
                        {dfStations.length > 0 ? (
                          <List dense sx={{ maxHeight: 180, overflow: 'auto', mt: 1 }}>
                            {dfStations.map((s, i) => (
                              <ListItem key={i} secondaryAction={
                                <IconButton size="small" onClick={() => setDfStations(arr => arr.filter((_, idx) => idx !== i))}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              }>
                                <ListItemText primary={s.name} secondary={`${s.lat.toFixed(5)}, ${s.lng.toFixed(5)} — r=${s.radius_m}m`} />
                              </ListItem>
                            ))}
                          </List>
                        ) : (
                          <Typography sx={{ mt: 1 }} color="text.secondary" variant="body2">
                            برای شروع، روی دکمه «افزودن ایستگاه» کلیک کنید.
                          </Typography>
                        )}
                      </Paper>

                    </Stack>
                  </Grid2>
                </Grid2>
              )}
            </DialogContent>

            <DialogActions>
              <Button onClick={() => setDefaultsOpen(false)}>بستن</Button>
              {currentView === 'edit' && (
                <>
                  <Button onClick={() => setCurrentView('list')}>بازگشت به لیست</Button>
                  <Button variant="outlined" color="primary" onClick={handleSaveProfile} startIcon={<SaveIcon />}>
                    {editingProfileId ? 'ذخیره تغییرات پروفایل' : 'ذخیره پروفایل جدید'}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleApplyDefaults}
                    disabled={
                      dfApplying ||
                      (!dfStations.length && !buildDfGeofence()) ||
                      (dfTarget === 'currentSA' && selectedVehicleIds.size === 0 && (vehiclesBySA[selectedSAId || 0] || []).length > 0) ||
                      (dfTarget === 'currentVehicle' && !selectedVehicle)
                    }
                  >
                    {dfApplying ? 'در حال اعمال…' : 'اعمال روی ماشین‌ها'}
                  </Button>
                </>
              )}
            </DialogActions>
          </Dialog>

          {/* جستجو */}
          <TextField
            size="small"
            placeholder="جستجوی نام/موبایل"
            value={qSA}
            onChange={(e) => setQSA(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 1.25,
              '& .MuiOutlinedInput-root': {
                transition: 'border-color .2s ease, box-shadow .2s ease',
                '& fieldset': { borderColor: 'divider' },
                '&:hover fieldset': { borderColor: ACC },
                '&.Mui-focused': {
                  '& fieldset': { borderColor: ACC },
                  boxShadow: `0 0 0 3px ${ACC}22`,
                },
              },
            }}
          />

          {/* بدنه */}
          {loadingAll ? (
            <Box flex={1} display="flex" alignItems="center" justifyContent="center">
              <CircularProgress size={24} />
            </Box>
          ) : errorAll ? (
            <Typography color="error">{errorAll}</Typography>
          ) : filteredSupers.length === 0 ? (
            <Typography color="text.secondary">سوپر ادمینی یافت نشد.</Typography>
          ) : (
            <Box sx={{ overflow: 'auto', flex: 1, pr: .25 }}>
              {filteredSupers.map((sa, idx) => {
                const countDrivers = driversBySA[sa.id]?.length || 0;
                const countVehicles = vehiclesBySA[sa.id]?.length || 0;
                const expanded = selectedSAId === sa.id;

                const listDrivers = driversBySA[sa.id] || [];
                const listVehicles = vehiclesBySA[sa.id] || [];

                return (
                  <Box key={sa.id} sx={{ perspective: 1200 }}>
                    <Card
                      elevation={0}
                      onMouseMove={onCardPointerMove}
                      onMouseLeave={onCardPointerLeave}
                      sx={(t) => ({
                        mb: 1.15,
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: 2,
                        border: `1px solid ${t.palette.divider}`,
                        background: t.palette.background.paper,
                        transform: 'rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) translateZ(0)',
                        transition: 'transform .12s ease, box-shadow .2s ease, border-color .2s ease',
                        // نور نقطه‌ای زیر موس:
                        backgroundImage: `radial-gradient(400px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${ACC}12, transparent 40%)`,
                        willChange: 'transform',
                        animation: `${floatY} 6s ease-in-out ${idx % 2 ? '1.2s' : '0s'} infinite`,
                        '&:hover': {
                          borderColor: `${ACC}66`,
                          boxShadow: `0 16px 46px ${ACC}24`,
                        },
                        ...(expanded && {
                          borderColor: `${ACC}88`,
                          boxShadow: `0 18px 52px ${ACC}2c`,
                          animation: `${breath} 4.5s ease-in-out infinite`,
                        }),

                        // نوار اکسنت متحرک (سمت راست در RTL)
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          insetInlineEnd: 0,
                          top: 0,
                          width: 4,
                          height: '100%',
                          transform: `scaleY(${expanded ? 1 : .18})`,
                          transformOrigin: 'top',
                          transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', // ← FIXED
                          background: `linear-gradient(90deg, ${ACC}, #00e1d8, ${ACC})`,
                          backgroundSize: '200% 100%',
                          animation: `${shimmer} 3.2s linear infinite`,
                          opacity: .9,
                        },
                      })}
                    >
                      <CardActionArea
                        onClick={() => {
                          const exp = !(selectedSAId === sa.id);
                          setSelectedSAId(exp ? sa.id : null);
                          setSelectedVehicle(null);
                        }}
                        sx={{
                          p: 1.25,
                          alignItems: 'stretch',
                          display: 'block',
                        }}
                      >
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Avatar
                            sx={{
                              bgcolor: `${ACC}22`,
                              color: `${ACC}cc`,
                              fontWeight: 800,
                              border: `1px solid ${ACC}55`,
                              boxShadow: `0 6px 16px ${ACC}26`,
                            }}
                          >
                            {sa.full_name?.charAt(0) ?? 'س'}
                          </Avatar>

                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography noWrap fontWeight={800}>{sa.full_name}</Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {sa.phone || '—'}
                            </Typography>
                          </Box>

                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Chip
                              label={`راننده: ${countDrivers || '—'}`}
                              size="small"
                              sx={{
                                border: `1px solid ${ACC}44`,
                                bgcolor: `${ACC}12`,
                                color: `${ACC}cc`,
                              }}
                            />
                            <Chip
                              label={`ماشین: ${countVehicles || '—'}`}
                              size="small"
                              sx={{
                                border: `1px solid ${ACC}44`,
                                bgcolor: `${ACC}12`,
                                color: `${ACC}cc`,
                              }}
                            />
                            <ExpandMoreIcon
                              className="card-caret"
                              sx={{
                                ml: .25,
                                color: `${ACC}cc`,
                                transform: `rotate(${expanded ? 180 : 0}deg)`,
                                transition: 'transform .25s ease',
                              }}
                            />
                          </Stack>
                        </Stack>
                      </CardActionArea>

                      <Collapse in={expanded} timeout={350} unmountOnExit>
                        <CardContent sx={{ pt: .5 }}>
                          {/* تب‌ها */}
                          <Tabs
                            value={tabSA}
                            onChange={(_, v) => { setTabSA(v); setSelectedVehicle(null); }}
                            sx={{
                              mb: 1,
                              minHeight: 36,
                              '& .MuiTab-root': { minHeight: 36 },
                              '& .MuiTabs-indicator': { backgroundColor: ACC },
                              '& .MuiTab-root.Mui-selected': { color: ACC, fontWeight: 700 },
                            }}
                          >
                            <Tab value="drivers" label="راننده‌ها" />
                            <Tab value="vehicles" label="ماشین‌ها" />
                          </Tabs>

                          {tabSA === 'drivers' ? (
                            (driversBySA[sa.id]?.length ?? 0) ? (
                              <List dense>
                                {listDrivers.map((d) => (
                                  <Box key={d.id}>
                                    <ListItem
                                      sx={{
                                        borderRadius: 2,
                                        px: 1,
                                        transition: 'transform .15s ease, background .2s ease',
                                        '&:hover': { background: `${ACC}0A`, transform: 'translateX(-3px)' },
                                      }}
                                      secondaryAction={
                                        <Stack direction="row" spacing={0.5}>
                                          {d.last_location && (
                                            <Tooltip title="نمایش روی نقشه">
                                              <IconButton
                                                edge="end"
                                                onClick={() => setFocusLatLng([d.last_location!.lat, d.last_location!.lng])}
                                                size="small"
                                                sx={{ border: `1px solid ${ACC}44`, bgcolor: `${ACC}12` }}
                                              >
                                                📍
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                          <Button
                                            size="small"
                                            variant={selectedDriver?.id === d.id ? 'contained' : 'outlined'}
                                            onClick={() => onPickDriver(d)}               // 👈 باز کردن پنل راننده
                                            sx={{
                                              bgcolor: selectedDriver?.id === d.id ? ACC : undefined,
                                              borderColor: `${ACC}66`,
                                              '&:hover': { bgcolor: selectedDriver?.id === d.id ? '#00b5ab' : `${ACC}14` },
                                            }}
                                          >
                                            انتخاب
                                          </Button>
                                        </Stack>
                                      }
                                    >
                                      <ListItemAvatar>
                                        <Avatar sx={{ bgcolor: `${ACC}22`, color: `${ACC}cc`, fontWeight: 700 }}>
                                          {d.full_name?.charAt(0) ?? 'ر'}
                                        </Avatar>
                                      </ListItemAvatar>
                                      <ListItemText primary={d.full_name} secondary={d.phone || '—'} />
                                    </ListItem>


                                    <Divider component="li" sx={{ opacity: .25 }} />
                                  </Box>
                                ))}
                              </List>
                            ) : (
                              <Typography color="text.secondary">راننده‌ای برای این سوپر ادمین نیست.</Typography>
                            )
                          ) : (
                            (vehiclesBySA[sa.id]?.length ?? 0) ? (
                              <>
                                {/* فقط لیست ماشین‌ها – بدون محتوای پایین‌پنلی */}
                                <List dense sx={{ mt: .5 }}>
                                  {listVehicles.map(v => (
                                    <Box key={v.id}>
                                      <ListItem
                                        sx={{
                                          borderRadius: 2, px: 1,
                                          transition: 'transform .15s ease, background .2s ease',
                                          '&:hover': { background: `${ACC}0A`, transform: 'translateX(-3px)' },
                                        }}
                                        secondaryAction={
                                          <Stack direction="row" spacing={0.5}>
                                            {v.last_location && (
                                              <Tooltip title="نمایش روی نقشه">
                                                <IconButton
                                                  size="small"
                                                  onClick={() => setFocusLatLng([v.last_location!.lat, v.last_location!.lng])}
                                                  sx={{ border: `1px solid ${ACC}44`, bgcolor: `${ACC}12` }}
                                                >
                                                  📍
                                                </IconButton>
                                              </Tooltip>
                                            )}
                                            <Button
                                              size="small"
                                              variant={selectedVehicle?.id === v.id ? 'contained' : 'outlined'}
                                              onClick={() => onPickVehicle(v)} // ← کلیک = باز شدن پنل پایین
                                              sx={{
                                                bgcolor: selectedVehicle?.id === v.id ? ACC : undefined,
                                                borderColor: `${ACC}66`,
                                                '&:hover': { bgcolor: selectedVehicle?.id === v.id ? '#00b5ab' : `${ACC}14` },
                                              }}
                                            >
                                              انتخاب
                                            </Button>
                                          </Stack>
                                        }
                                      >
                                        <ListItemAvatar>
                                          <Avatar sx={{ bgcolor: `${ACC}22`, color: `${ACC}cc`, fontWeight: 700 }}>
                                            {v.plate_no?.charAt(0) ?? 'م'}
                                          </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText primary={v.plate_no} secondary={v.vehicle_type_code || '—'} />
                                      </ListItem>
                                      <Divider component="li" sx={{ opacity: .25 }} />
                                    </Box>
                                  ))}
                                </List>
                              </>
                            ) : (
                              <Typography color="text.secondary">ماشینی برای این سوپر ادمین نیست.</Typography>
                            )
                          )}

                        </CardContent>
                      </Collapse>
                    </Card>
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>
      </Grid2>

      {/* === ردیف سوم: پنل پایینی (مثل SuperAdmin) === */}
      <Grid2 xs={12}>
        <Collapse in={sheetOpen} timeout={320} unmountOnExit>
          <Paper
            dir="rtl"
            sx={(t) => ({
              position: 'relative',
              minHeight: SHEET_HEIGHT,
              p: 2,
              borderRadius: 3,
              overflow: 'hidden',
              border: `1px solid ${t.palette.divider}`,
              boxShadow: t.palette.mode === 'dark'
                ? '0 20px 60px rgba(0,0,0,.45)'
                : '0 20px 60px rgba(0,0,0,.15)',
              background: `linear-gradient(180deg, ${t.palette.background.paper} 0%, ${t.palette.background.default} 100%)`,
              '&:before': {
                content: '""',
                position: 'absolute',
                inset: -2,
                background: `
            radial-gradient(900px 320px at 110% -20%, ${t.palette.primary.main}22, transparent 60%),
            radial-gradient(700px 260px at -10% 120%, ${t.palette.secondary.main}1f, transparent 60%)
          `,
                filter: 'blur(40px)',
                zIndex: 0,
              },
            })}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              {/* هدر */}
              {/* هدر */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1.25} alignItems="center">

                  {isDriverMode ? (
                    // ===== حالت راننده =====
                    <>
                      <Chip
                        size="medium"
                        icon={<span>🧑‍✈️</span> as any}
                        label={
                          <Typography component="span" variant="h6" sx={{ fontWeight: 800 }}>
                            راننده: {selectedDriver?.full_name ?? '—'}
                          </Typography>
                        }
                        sx={(t) => ({
                          p: 1,
                          height: 40,
                          borderRadius: 999,
                          bgcolor: t.palette.mode === 'dark'
                            ? `${t.palette.primary.main}1a`
                            : `${t.palette.primary.main}14`,
                          '& .MuiChip-icon': { fontSize: 20 },
                        })}
                      />

                      {!!selectedDriver?.phone && (
                        <Chip
                          size="medium"
                          icon={<span>📞</span> as any}
                          label={selectedDriver.phone}
                          sx={(t) => ({
                            p: 1,
                            height: 40,
                            borderRadius: 999,
                            bgcolor: t.palette.mode === 'dark'
                              ? `${t.palette.primary.main}0f`
                              : `${t.palette.primary.main}0a`,
                            '& .MuiChip-icon': { fontSize: 18 },
                          })}
                        />
                      )}

                      <Chip
                        size="medium"
                        icon={<span>🧠</span> as any}
                        label={
                          aiView?.onRoute === false
                            ? 'AI: خارج مسیر'
                            : aiView?.onRoute
                              ? 'AI: داخل مسیر'
                              : 'AI: —'
                        }
                        sx={(t) => ({
                          p: 1,
                          height: 40,
                          borderRadius: 999,
                          fontWeight: 800,
                          bgcolor:
                            aiView?.onRoute === false
                              ? t.palette.error.light + '26'
                              : aiView?.onRoute
                                ? t.palette.success.light + '26'
                                : (t.palette.mode === 'dark'
                                  ? `${t.palette.primary.main}1a`
                                  : `${t.palette.primary.main}14`),
                          '& .MuiChip-icon': { fontSize: 20 },
                        })}
                      />

                      {/* شمار تخلفات راننده (در بازه/لیست فعلی) */}
                      <Chip
                        size="medium"
                        icon={<span>⚠️</span> as any}
                        label={`${(driverViolations?.length ?? 0).toLocaleString('fa-IR')} تخلف`}
                        sx={(t) => ({
                          p: 1,
                          height: 40,
                          borderRadius: 999,
                          bgcolor: t.palette.mode === 'dark'
                            ? `${t.palette.warning.main}1a`
                            : `${t.palette.warning.main}14`,
                          '& .MuiChip-icon': { fontSize: 18 },
                        })}
                      />
                    </>
                  ) : (
                    // ===== حالت ماشین =====
                    <>
                      <Chip
                        size="medium"
                        icon={<span>🚘</span> as any}
                        label={
                          <Typography component="span" variant="h6" sx={{ fontWeight: 800 }}>
                            ماشین: {selectedVehicle?.plate_no ?? '—'}
                          </Typography>
                        }
                        sx={(t) => ({
                          p: 1,
                          height: 40,
                          borderRadius: 999,
                          bgcolor: t.palette.mode === 'dark'
                            ? `${t.palette.primary.main}1a`
                            : `${t.palette.primary.main}14`,
                          '& .MuiChip-icon': { fontSize: 20 },
                        })}
                      />

                      <Chip
                        size="medium"
                        icon={<span>🧠</span> as any}
                        label={
                          aiView?.onRoute === false
                            ? 'AI: خارج مسیر'
                            : aiView?.onRoute
                              ? 'AI: داخل مسیر'
                              : 'AI: —'
                        }
                        sx={(t) => ({
                          p: 1,
                          height: 40,
                          borderRadius: 999,
                          fontWeight: 800,
                          bgcolor:
                            aiView?.onRoute === false
                              ? t.palette.error.light + '26'
                              : aiView?.onRoute
                                ? t.palette.success.light + '26'
                                : (t.palette.mode === 'dark'
                                  ? `${t.palette.primary.main}1a`
                                  : `${t.palette.primary.main}14`),
                          '& .MuiChip-icon': { fontSize: 20 },
                        })}
                      />

                      <Chip
                        size="medium"
                        icon={<span>📍</span> as any}
                        label={`${(
                          selectedVehicle ? (vehicleStationsMap[selectedVehicle.id] ?? []).length : 0
                        ).toLocaleString('fa-IR')} ایستگاه`}
                        sx={(t) => ({
                          p: 1,
                          height: 40,
                          borderRadius: 999,
                          bgcolor: t.palette.mode === 'dark'
                            ? `${t.palette.secondary.main}1a`
                            : `${t.palette.secondary.main}14`,
                          '& .MuiChip-icon': { fontSize: 20 },
                        })}
                      />

                      {/* شمار تخلفات ماشین (لیست فعلی) */}
                      <Chip
                        size="medium"
                        icon={<span>⚠️</span> as any}
                        label={`${(vehicleViolations?.length ?? 0).toLocaleString('fa-IR')} تخلف`}
                        sx={(t) => ({
                          p: 1,
                          height: 40,
                          borderRadius: 999,
                          bgcolor: t.palette.mode === 'dark'
                            ? `${t.palette.warning.main}1a`
                            : `${t.palette.warning.main}14`,
                          '& .MuiChip-icon': { fontSize: 18 },
                        })}
                      />
                    </>
                  )}

                </Stack>

                {/* اگه خواستی بستن دستی */}
                {/* <Button size="small" onClick={() => { setSelectedVehicle(null); setSelectedDriver(null); }}>بستن</Button> */}
              </Stack>

              {/* کارت‌های تله‌متری (بزرگ و زنده) */}
              <Grid2 container spacing={1.25} sx={{ mb: 1.5 }}>
                {[
                  { icon: '🔌', cap: 'وضعیت سوئیچ', val: (vehicleTlm.ignition === true ? 'روشن' : vehicleTlm.ignition === false ? 'خاموش' : 'نامشخص') },
                  { icon: '⏱️', cap: 'مدت سکون', val: (vehicleTlm.idle_time != null ? new Date(Number(vehicleTlm.idle_time) * 1000).toISOString().substring(11, 19) : '—') },
                  { icon: '🛣️', cap: 'کیلومترشمار', val: (vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—') },

                  // 🆕 مدت کار (بازه)
                  {
                    icon: '⏳',
                    cap: 'مدت کار (بازه)',
                    // اگر state/متغیّرهای بازه‌ای داری جایگزین کن:
                    // مثلا vehicleStats.runtime_sec و vehicleStatsLoading
                    //val: (vehicleStatsLoading ? '...' : fmtHMS(vehicleStats?.runtime_sec ?? null)),
                  },
                ].map((it, i) => (
                  <Grid2 key={i} xs={12} sm={6} md={3}>
                    <Paper
                      sx={(t) => ({
                        p: 2, borderRadius: 3, height: 120, display: 'flex', alignItems: 'center',
                        border: `1px solid ${t.palette.divider}`, backdropFilter: 'blur(6px)',
                        transition: 'transform .25s ease, box-shadow .25s ease, border-color .25s ease',
                        boxShadow: t.palette.mode === 'dark' ? '0 8px 24px rgba(0,0,0,.35)' : '0 8px 24px rgba(0,0,0,.09)',
                        '&:hover': {
                          transform: 'translateY(-4px) scale(1.01)',
                          borderColor: t.palette.mode === 'dark' ? `${t.palette.primary.main}66` : `${t.palette.primary.main}55`,
                          boxShadow: t.palette.mode === 'dark' ? '0 16px 40px rgba(0,0,0,.45)' : '0 16px 40px rgba(0,0,0,.15)'
                        },
                      })}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: '100%' }}>
                        <Box sx={{ fontSize: 28, lineHeight: 1 }}>{it.icon}</Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">{it.cap}</Typography>
                          <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 800 }}>{it.val}</Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid2>
                ))}
              </Grid2>






              <Divider sx={{ my: 1.5 }} />

              {/* ایستگاه‌ها (کارت‌های ریسپانسیو؛ بدون اسکرول) */}
              {selectedVehicle && (
                <>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>ایستگاه‌ها</Typography>
                  <Grid2 container spacing={1}>
                    {(vehicleStationsMap[selectedVehicle.id] || []).map((st) => (
                      <Grid2 key={st.id} xs={12} sm={6} md={4} lg={3}>
                        <Paper
                          variant="outlined"
                          sx={(t) => ({
                            p: 1.25, borderRadius: 2, height: 92, display: 'flex', alignItems: 'center',
                            border: `1px solid ${t.palette.divider}`,
                            transition: 'border-color .2s ease, transform .2s ease',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              borderColor: t.palette.mode === 'dark' ? `${t.palette.secondary.main}66` : `${t.palette.secondary.main}55`,
                            },
                          })}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                            <Box sx={{ fontSize: 20, lineHeight: 1 }}>📍</Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography noWrap sx={{ fontWeight: 700 }}>{st.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {st.lat.toFixed(5)}, {st.lng.toFixed(5)}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={0.5} flexShrink={0}>
                              <IconButton size="small" onClick={() => setFocusLatLng([st.lat, st.lng])} title="نمایش روی نقشه">🎯</IconButton>
                              <IconButton
                                size="small"
                                onClick={() => { setEditingStation({ vid: selectedVehicle.id, st: { ...st } }); setMovingStationId(null); }}
                                title="ویرایش"
                              >✏️</IconButton>
                              <IconButton size="small" color="error" onClick={() => deleteStation(selectedVehicle.id, st)} title="حذف">🗑️</IconButton>
                            </Stack>
                          </Stack>
                        </Paper>
                      </Grid2>
                    ))}
                  </Grid2>
                </>
              )}

              <Divider sx={{ my: 2 }} />
              {selectedVehicle && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>مسیر</Typography>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <TextField
                      size="small"
                      type="number"
                      label="آستانه انحراف (m)"
                      value={routeThreshold}
                      onChange={(e) => setRouteThreshold(Math.max(1, Number(e.target.value || 0)))}
                      sx={{ width: 170 }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => selectedVehicle && applyRouteThreshold(selectedVehicle.id, routeThreshold)}
                    >
                      ثبت آستانه
                    </Button>

                    <Button
                      size="small"
                      variant={drawingRoute ? 'contained' : 'outlined'}
                      onClick={() => setDrawingRoute(v => !v)}
                    >
                      {drawingRoute ? 'پایان ترسیم' : 'ترسیم مسیر روی نقشه'}
                    </Button>

                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => selectedVehicle && saveDrawnRoute(selectedVehicle.id)}
                      disabled={!drawingRoute || routePoints.length < 2}
                    >
                      ذخیره مسیر جدید
                    </Button>

                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => selectedVehicle && deleteCurrentRoute(selectedVehicle.id)}
                      disabled={!vehicleRoute}
                    >
                      حذف مسیر جاری
                    </Button>
                  </Stack>

                  <Typography variant="caption" color="text.secondary">
                    برای ترسیم مسیر روی نقشه کلیک کنید تا نقاط به‌ترتیب اضافه شوند (حداقل ۲ نقطه). سپس «ذخیره مسیر» را بزنید.
                  </Typography>
                </>
              )}

              {/* ژئوفنس (متصل به gf* state ها و saveGeofence/deleteGeofence) */}
              {canGeoFence && selectedVehicle && (
                <>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>ژئوفنس</Typography>
                  <Paper
                    variant="outlined"
                    sx={(t) => ({
                      p: 1.5,
                      borderRadius: 2,
                      border: `1px dashed ${t.palette.divider}`,
                      backdropFilter: 'blur(4px)',
                    })}
                  >
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel id="gf-mode-lbl">حالت</InputLabel>
                        <Select
                          labelId="gf-mode-lbl"
                          label="حالت"
                          value={gfMode}
                          onChange={(e) => { setGfMode(e.target.value as 'circle' | 'polygon'); setGfCenter(null); setGfPoly([]); }}
                        >
                          <MenuItem value="circle">دایره‌ای</MenuItem>
                          <MenuItem value="polygon">چندضلعی</MenuItem>
                        </Select>
                      </FormControl>

                      <TextField
                        size="small"
                        type="number"
                        label="تلورانس (m)"
                        value={gfTolerance}
                        onChange={(e) => setGfTolerance(Math.max(0, Number(e.target.value || 0)))}
                        sx={{ width: 130 }}
                      />

                      <Button size="small" variant={gfDrawing ? 'contained' : 'outlined'} onClick={() => setGfDrawing(v => !v)}>
                        {gfDrawing ? 'پایان ترسیم' : 'ترسیم روی نقشه'}
                      </Button>

                      {gfMode === 'polygon' && (
                        <>
                          <Button size="small" onClick={() => setGfPoly(pts => pts.slice(0, -1))} disabled={!gfPoly.length}>برگشت نقطه</Button>
                          <Button size="small" onClick={() => setGfPoly([])} disabled={!gfPoly.length}>پاک‌کردن نقاط</Button>
                        </>
                      )}

                      {gfMode === 'circle' && (
                        <TextField
                          size="small"
                          type="number"
                          label="شعاع (m)"
                          value={gfRadius}
                          onChange={(e) => setGfRadius(Math.max(1, Number(e.target.value || 0)))}
                          sx={{ width: 130 }}
                        />
                      )}

                      <Box flex={1} />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={async () => {
                          if (!selectedVehicle) { alert('ماشین انتخاب نشده'); return; }
                          const vid = selectedVehicle.id;
                          // از ایستگاه‌های خودِ ماشین فعلی به‌عنوان نقاط مرجع
                          const samplePoints =
                            (vehicleStationsMap[vid] || []).map(s => ({ lat: s.lat, lng: s.lng }));

                          if (!samplePoints.length) {
                            alert('برای این ماشین ایستگاهی تعریف نشده. چند نقطه/ایستگاه بساز.');
                            return;
                          }

                          const gf = autoFenceFromPoints(samplePoints, 'concave', 1.2, 25);
                          if (!gf) { alert('نتونستم ژئوفنس بسازم.'); return; }

                          // ذخیره ژئوفنس روی سرور
                          await api.put(`/vehicles/${vid}/geofence`, {
                            type: 'polygon',
                            polygonPoints: gf.points.map(p => ({ lat: p.lat, lng: p.lng })),
                            toleranceM: gf.tolerance_m
                          });

                          // روشن کردن پایش دائمی AI روی سرور
                          await api.put(`/vehicles/${vid}/ai/monitor`, { enabled: true });

                          await loadVehicleGeofences(vid);
                          alert('ژئوفنس خودکار ثبت و پایش AI روشن شد.');
                        }}
                      >
                        ساخت خودکار ژئوفنس از نقاط
                      </Button>

                      <Button size="small" variant="contained" color="primary" onClick={() => saveGeofence(selectedVehicle.id)}>
                        ذخیره ژئوفنس
                      </Button>

                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => deleteGeofence(selectedVehicle.id)}
                        disabled={(geofencesByVid[selectedVehicle.id]?.length ?? 0) === 0}
                      >
                        حذف ژئوفنس
                      </Button>
                    </Stack>

                    <Typography variant="caption" color="text.secondary">
                      {gfMode === 'circle'
                        ? 'روی نقشه کلیک کنید تا مرکز دایره انتخاب شود، سپس شعاع را تنظیم و ذخیره کنید.'
                        : 'روی نقشه کلیک کنید تا نقاط چندضلعی به‌ترتیب اضافه شوند (حداقل ۳ نقطه).'}
                    </Typography>
                  </Paper>
                </>
              )}

              {/* لوازم مصرفی (از consumables/consumablesStatus) */}
              {canConsumables && selectedVehicle && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>لوازم مصرفی</Typography>
                    <Tooltip title="افزودن">
                      <IconButton size="small" onClick={() => setConsumablesOpen(true)}>＋</IconButton>
                    </Tooltip>
                    <Box flex={1} />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`کیلومترشمار: ${vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}`}
                    />
                  </Stack>

                  {consumablesStatus === 'loading' ? (
                    <Box display="flex" alignItems="center" gap={1} color="text.secondary" sx={{ mt: .5 }}>
                      <CircularProgress size={16} /> در حال دریافت…
                    </Box>
                  ) : consumablesStatus === 'error' ? (
                    <Typography color="warning.main">خطا در دریافت. دوباره تلاش کنید.</Typography>
                  ) : consumables.length ? (
                    <Grid2 container spacing={1}>
                      {consumables.map((c: any, i: number) => (
                        <Grid2 key={c.id ?? i} xs={12} sm={6} md={4}>
                          <Paper
                            variant="outlined"
                            sx={(t) => ({
                              p: 1.25,
                              borderRadius: 2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: `1px solid ${t.palette.divider}`,
                              transition: 'transform .2s ease, border-color .2s ease',
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                borderColor: t.palette.mode === 'dark' ? `${t.palette.primary.main}66` : `${t.palette.primary.main}55`,
                              },
                            })}
                          >
                            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                              <Typography noWrap sx={{ fontWeight: 700 }}>{c.title ?? c.note ?? 'آیتم'}</Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {c.mode === 'km' ? 'بر اساس کیلومتر' : 'بر اساس زمان'}
                                {c.created_at && <> — {new Date(c.created_at).toLocaleDateString('fa-IR')}</>}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={0.5} flexShrink={0}>
                              <IconButton size="small" title="ویرایش" onClick={() => openEditConsumable(c)}>✏️</IconButton>
                              <IconButton size="small" color="error" title="حذف" onClick={() => deleteConsumable(c)}>🗑️</IconButton>
                            </Stack>
                          </Paper>
                        </Grid2>
                      ))}
                    </Grid2>
                  ) : (
                    <Typography color="text.secondary">آیتمی ثبت نشده.</Typography>
                  )}
                </>
              )}

              {/* دیالوگ‌های مصرفی و Snackbar رو همون بالا داری؛ از همونا استفاده کن تا دوبل نشه */}
            </Box>
          </Paper>
        </Collapse>
      </Grid2>




      {/* دیالوگ ویرایش آیتم */}
      <Dialog open={!!editingCons} onClose={closeEditConsumable} fullWidth maxWidth="sm">
        <DialogTitle>ویرایش آیتم مصرفی</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="توضیح/یادداشت"
              value={editingCons?.note ?? ''}
              onChange={(e) => setEditingCons((p: any) => ({ ...p, note: e.target.value }))}
              fullWidth
            />
            <RadioGroup
              row
              value={editingCons?.mode ?? 'km'}
              onChange={(_, v) =>
                setEditingCons((p: any) => ({
                  ...p,
                  mode: v as 'km' | 'time',
                  start_at: v === 'time' ? (p?.start_at ?? new Date().toISOString()) : null,
                  base_odometer_km: v === 'km' ? (p?.base_odometer_km ?? 0) : null,
                }))
              }
            >
              <FormControlLabel value="km" control={<Radio />} label="بر اساس کیلومتر" />
              <FormControlLabel value="time" control={<Radio />} label="بر اساس زمان" />
            </RadioGroup>

            {editingCons?.mode === 'time' ? (
              <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                <DateTimePicker<Date>
                  label="تاریخ یادآوری"
                  value={editingCons?.start_at ? new Date(editingCons.start_at) : null}
                  onChange={(val) =>
                    setEditingCons((p: any) => ({ ...p, start_at: val ? new Date(val).toISOString() : null }))
                  }
                  ampm={false}
                  slotProps={{ textField: { fullWidth: true } }}
                  format="yyyy/MM/dd HH:mm"
                />
              </LocalizationProvider>
            ) : (
              <TextField
                label="مقدار مبنا (کیلومتر)"
                type="number"
                value={editingCons?.base_odometer_km ?? ''}
                onChange={(e) =>
                  setEditingCons((p: any) => ({ ...p, base_odometer_km: e.target.value ? Number(e.target.value) : null }))
                }
                fullWidth
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditConsumable}>انصراف</Button>
          <Button variant="contained" onClick={saveEditConsumable} disabled={savingCons}>ذخیره</Button>
        </DialogActions>
      </Dialog>

      {/* دیالوگ افزودن */}
      <Dialog open={consumablesOpen} onClose={() => setConsumablesOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>لوازم مصرفی / مسافت از آخرین صفر</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField label="توضیح/یادداشت" value={tripNote} onChange={(e) => setTripNote(e.target.value)} fullWidth />
            <RadioGroup row value={consumableMode} onChange={(_, v) => setConsumableMode((v as 'time' | 'km') ?? 'km')}>
              <FormControlLabel value="km" control={<Radio />} label="بر اساس کیلومتر" />
              <FormControlLabel value="time" control={<Radio />} label="بر اساس زمان" />
            </RadioGroup>

            {consumableMode === 'time' ? (
              <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                <DateTimePicker<Date>
                  label="تاریخ یادآوری"
                  value={tripDate}
                  onChange={(val) => setTripDate(val)}
                  ampm={false}
                  slotProps={{ textField: { fullWidth: true } }}
                  format="yyyy/MM/dd HH:mm"
                />
              </LocalizationProvider>
            ) : (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">کیلومترشمار فعلی:</Typography>
                    <Typography variant="h6">
                      {vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}
                    </Typography>
                  </Stack>
                  <TextField
                    label="مقدار مبنا (از آخرین صفر)"
                    type="number"
                    value={tripBaseKm ?? ''}
                    onChange={(e) => setTripBaseKm(e.target.value ? Number(e.target.value) : null)}
                    fullWidth
                  />
                  {!vehicleOptions.includes('odometer') && (
                    <Typography sx={{ mt: 1 }} variant="caption" color="warning.main">
                      برای به‌روزرسانی زنده، «کیلومترشمار» باید فعال باشد.
                    </Typography>
                  )}
                </Stack>
              </Paper>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConsumablesOpen(false)}>بستن</Button>
          {consumableMode === 'km' && (
            <Button variant="outlined" onClick={handleTripReset} disabled={vehicleTlm.odometer == null || !selectedVehicle}>
              صفر کردن از الان
            </Button>
          )}
          <Button variant="contained" onClick={handleAddConsumable} disabled={consumableMode === 'time' && !tripDate}>
            افزودن
          </Button>
        </DialogActions>
      </Dialog>

      {/* نوتیفیکیشن‌ها */}
      {toast?.open && (
        <Snackbar
          open={toast.open}
          autoHideDuration={6000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="warning" onClose={() => setToast(null)} sx={{ width: '100%' }}>
            {toast.msg}
          </Alert>
        </Snackbar>
      )}
    </Grid2>

  );




}



// یک نقطه GPS در مسیر
type GpsPoint = {
  lat: number;
  lng: number;
  timestamp?: string;
};

// یک ماموریت (سفر) راننده که شامل آرایه‌ای از نقاط است
type DriverMission = {
  id: number;
  // ... سایر فیلدهای ماموریت
  gps_points: GpsPoint[];
};

// پاسخی که از API مسیر خودرو دریافت می‌شود
type VehicleTrackResponse = {
  vehicle_id: number;
  from: string;
  to: string;
  points_count: number;
  points: GpsPoint[];
};
function SuperAdminRoleSection({ user }: { user: User }) {
  // -------- انواع کمکی داخل همین فایل --------
  type VehicleTypeCode =
    | 'bus' | 'minibus' | 'van' | 'tanker' | 'truck' | 'khavar' | 'sedan' | 'pickup';
  type RoutePoint = { lat: number; lng: number; order_no: number };
  //type VehicleRoute = { id: number; name: string; threshold_m: number; points: RoutePoint[] };
  const [driverViolations, setDriverViolations] = useState<Violation[]>([]);
  const [driverViolationsLoading, setDriverViolationsLoading] = useState(false);

  const CONS_KEY = (vid: number) => `consumables_${vid}`;
  type TmpStation = { name: string; lat: number; lng: number; radius_m: number; order_no?: number };
  type TmpLatLng = { lat: number; lng: number };
  type TmpGeofence =
    | { type: 'circle'; center: TmpLatLng; radius_m: number; tolerance_m?: number }
    | { type: 'polygon'; points: TmpLatLng[]; tolerance_m?: number };
  function loadConsumablesFromStorage(vid: number): any[] {
    try {
      const raw = localStorage.getItem(CONS_KEY(vid));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      // از نرمالایزر خودت استفاده کن
      return normalizeConsumables(parsed);
    } catch {
      return [];
    }
  }
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  type Violation = {
    id: string;
    vehicle_id: string;
    driver_user_id?: string | null;
    type: string;                 // 'geofence_exit' | 'off_route' | ...
    meta?: any;
    created_at: string;           // ISO
  };
  const [toISO, setToISO] = useState<string>(() => new Date().toISOString());
  const handlePlayFromStart = () => {
    if (tab === 'drivers') { setShowDriverAnim(true); resetDriverAnim(); startDriverAnim(); }
    else { setShowVehAnim(true); resetVehAnim(); startVehAnim(); }
  };

  const handleStop = () => {
    if (tab === 'drivers') pauseDriverAnim();
    else pauseVehAnim();
  };


  const [violations, setViolations] = useState<Violation[]>([]);
  const [violationsLoading, setViolationsLoading] = useState(false);
  const [violationFilter, setViolationFilter] = useState<'all' | 'geofence_exit' | 'off_route' | 'speeding'>('all');
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const normalizeViolations = (payload: any): Violation[] => {
    const arr: any[] =
      Array.isArray(payload) ? payload :
        Array.isArray(payload?.items) ? payload.items :
          Array.isArray(payload?.data?.items) ? payload.data.items :
            Array.isArray(payload?.data) ? payload.data : [];
    return arr.map((v: any) => ({
      id: String(v.id ?? v._id ?? ''),
      vehicle_id: String(v.vehicle_id ?? v.vehicleId ?? ''),
      driver_user_id: v.driver_user_id != null ? String(v.driver_user_id) : null,
      type: String(v.type ?? ''),
      meta: v.meta ?? {},
      created_at: v.created_at ?? v.createdAt ?? new Date().toISOString(),
    }));
  };
  const [fromISO, setFromISO] = useState<string>(() =>
    new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  );
  const loadViolations = useCallback(async (vehicleId: number, from = fromISO, to = toISO) => {
    setViolationsLoading(true);
    try {
      const raw = await fetchVehicleViolations(api, vehicleId, 200);
      const all = normalizeViolations(raw);

      const fromT = from ? +new Date(from) : -Infinity;
      const toT = to ? +new Date(to) : Infinity;

      setViolations(all.filter(v => {
        const t = +new Date(v.created_at);
        return t >= fromT && t <= toT;
      }));
    } catch {
      setViolations([]);
    } finally {
      setViolationsLoading(false);
    }
  }, [fromISO, toISO]);
  async function fetchDriverViolationsViaAssignment(api: any, driverId: number, limit = 200) {
    try {
      const { data: cur } = await api.get(`/assignments/current/${driverId}`);
      const vid = cur?.vehicle_id ?? cur?.vehicleId;
      if (!vid) return [];  // راننده روی ماشینی نیست
      return await fetchVehicleViolations(api, Number(vid), limit);
    } catch (e) {
      // اگر اصلاً روت assignment نداری یا خطا داد، بدون قهر:
      return [];
    }
  }
  // helper
  async function fetchVehicleViolations(api: any, vehicleId: number, limit = 200) {
    const { data } = await api.get(`/vehicles/${vehicleId}/violations`, { params: { limit } });
    return data;
  }
  const [driverSpeed, setDriverSpeed] = useState<1 | 2 | 3>(1);
  const [vehSpeed, setVehSpeed] = useState<1 | 2 | 3>(1);

  function useAnimatedPath(
    points: [number, number][],
    opts: { stepMs?: number; stepInc?: number; autoStart?: boolean; key?: string } = {}
  ) {
    const { stepMs = 50, stepInc = 1, autoStart = true, key = '' } = opts;
    const [visible, setVisible] = React.useState<[number, number][]>([]);
    const timerRef = React.useRef<number | null>(null);
    const idxRef = React.useRef(0);

    // ⬅️ سرعت را در ref نگه داریم تا تغییرش ریست نکند
    const stepIncRef = React.useRef(Math.max(1, Math.trunc(stepInc || 1)));
    React.useEffect(() => {
      stepIncRef.current = Math.max(1, Math.trunc(stepInc || 1));
    }, [stepInc]);

    const pause = React.useCallback(() => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, []);

    const reset = React.useCallback(() => {
      pause();
      idxRef.current = 0;
      setVisible([]);
    }, [pause]);

    const start = React.useCallback(() => {
      if (!points?.length || timerRef.current != null) return;

      timerRef.current = window.setInterval(() => {
        // ⬅️ هر تیک از ref بخوان، نه از مقدار capture شده
        idxRef.current += stepIncRef.current;
        const i = idxRef.current;
        setVisible(points.slice(0, i));
        if (i >= points.length) {
          window.clearInterval(timerRef.current!);
          timerRef.current = null;
        }
      }, stepMs);
      // ⚠️ stepInc را عمداً در deps نیاوردیم تا تغییر سرعت باعث ساخت تایمر جدید نشود
    }, [points, stepMs]);

    React.useEffect(() => {
      // فقط وقتی مسیر/کلید/فاصله زمانی تغییر کند، ریست کن
      reset();
      if (autoStart && points?.length) start();
      return () => pause();
    }, [key, points, stepMs, autoStart, reset, start, pause]);

    return { visible, start, pause, reset, isPlaying: timerRef.current != null };
  }

  const [driverTrackPts, setDriverTrackPts] = useState<[number, number][]>([]);
  const [vehicleTrackPts, setVehicleTrackPts] = useState<[number, number][]>([]);


  function saveConsumablesToStorage(vid: number, items: any[]) {
    try {
      localStorage.setItem(CONS_KEY(vid), JSON.stringify(items));
    } catch { /* ignore */ }
  }

  type VehicleRoute = {
    id: number;
    name: string;
    threshold_m?: number;
    // سرور قدیمی: stations / سرور جدید: points
    points?: RoutePoint[];
    stations?: RoutePoint[];
  };
  type GeofenceCircle = { id?: number; type: 'circle'; center: { lat: number; lng: number }; radius_m: number; tolerance_m?: number | null };
  type GeofencePolygon = { id?: number; type: 'polygon'; points: { lat: number; lng: number }[]; tolerance_m?: number | null };
  type Geofence = GeofenceCircle | GeofencePolygon;

  // ---- state های ژئوفنس
  const [geofence, setGeofence] = useState<Geofence | null>(null);
  const [gfMode, setGfMode] = useState<'circle' | 'polygon'>('circle'); // حالت ترسیم
  const [gfDrawing, setGfDrawing] = useState(false);                     // روشن/خاموش حالت ترسیم
  const [gfCenter, setGfCenter] = useState<{ lat: number; lng: number } | null>(null); // مرکز دایره
  const [gfRadius, setGfRadius] = useState<number>(150);                 // شعاع دایره (متر)
  const [gfPoly, setGfPoly] = useState<{ lat: number; lng: number }[]>([]);            // نقاط چندضلعی
  const [gfTolerance, setGfTolerance] = useState<number>(15);            // تلورانس (متر)
  // --- فقط اضافه کن (بالای کامپوننت، کنار بقیه stateها) ---
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const [dfDrawing, setDfDrawing] = useState(false);
  const [dfTempSt, setDfTempSt] = useState<{ name: string; lat: number; lng: number; radius_m: number } | null>(null);
  const [dfAuto, setDfAuto] = useState(1);
  const [dfApplyLog, setDfApplyLog] = useState<string[]>([]);

  const loadDriverViolations = React.useCallback(
    async (driverId: number, from = fromISO, to = toISO) => {
      if (!driverId) { setViolations([]); return; }

      setViolationsLoading(true);
      try {
        const raw = await fetchDriverViolationsSmart(api, driverId, { from, to, limit: 200 });
        const all: Violation[] = (normalizeViolations(raw) || []) as Violation[];

        const fromT = Number.isFinite(+new Date(from)) ? +new Date(from) : -Infinity;
        const toT = Number.isFinite(+new Date(to)) ? +new Date(to) : Infinity;

        const list: SimpleViolation[] = all
          .filter(v => {
            const t = +new Date(v.created_at ?? (v as any).at ?? (v as any).time ?? (v as any).createdAt);
            return Number.isFinite(t) && t >= fromT && t <= toT;
          })
          .map((v, idx) => {
            const createdAtISO =
              (v.created_at ?? (v as any).at ?? (v as any).time ?? (v as any).createdAt ?? new Date().toISOString());
            const created_at = new Date(createdAtISO).toISOString();
            const stableId =
              (typeof v.id === 'number' ? v.id : undefined) ??
              Number(v.meta?.event_id) ??
              Number((v.meta as any)?.id) ??
              (Date.parse(created_at) || 0) + idx;

            return {
              id: stableId,
              type: (v.type as any) || 'speeding',
              created_at,
              driver_user_id: (v as any).driver_id ?? (v as any).driver_user_id ?? driverId,
              meta: v.meta ?? {},
            };
          });

        setViolations(list);
      } catch {
        setViolations([]);
      } finally {
        setViolationsLoading(false);
      }
    },
    [api, fromISO, toISO]
  );





  const loadProfiles = useCallback(async () => {
    try {
      setProfilesLoading(true);
      const { data } = await api.get('/vehicle-setting-profiles');
      setProfiles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch profiles from API", error);
      alert('خطا در دریافت لیست پروفایل‌ها');
      setProfiles([]);
    } finally {
      setProfilesLoading(false);
    }
  }, []);
  // بالای فایل، ref برای سابسکرایب شدن به «تخلفات» همین ماشین
  const lastViolSubRef = useRef<{ vid: number; uid: number } | null>(null);

  const resetForms = () => {
    setDfStations([]);
    setDfGfMode('circle');
    setDfGfCircle({ radius_m: 150, tolerance_m: 15, center: undefined });
    setDfGfPoly([]);
    setDfDrawing(false);
    setDfTempSt(null);
    setDfAuto(1);
    setDfAddingStation(false);
    setProfileName('');
    setEditingProfileId(null);
  };

  const handleCreateNewProfile = () => {
    resetForms();
    setCurrentView('edit');
  };

  const handleLoadProfile = (profileId: number) => {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    resetForms();
    setEditingProfileId(profile.id);
    setProfileName(profile.name);
    setDfStations(profile.settings.stations || []);

    const gf = profile.settings.geofence;
    if (gf) {
      if (gf.type === 'circle') {
        setDfGfMode('circle');
        setDfGfCircle({ center: gf.center, radius_m: gf.radius_m, tolerance_m: gf.tolerance_m ?? 15 });
      } else if (gf.type === 'polygon') {
        setDfGfMode('polygon');
        setDfGfPoly(gf.points || []);
        setDfGfCircle(c => ({ ...c, tolerance_m: gf.tolerance_m ?? 15 }));
      }
    }
    setCurrentView('edit');
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      alert('لطفاً نام پروفایل را وارد کنید.');
      return;
    }
    const settings = { stations: dfStations, geofence: buildDfGeofence() };
    try {
      if (editingProfileId) {
        await api.put(`/vehicle-setting-profiles/${editingProfileId}`, { name: profileName.trim(), settings });
      } else {
        await api.post('/vehicle-setting-profiles', { name: profileName.trim(), settings });
      }
      await loadProfiles();
      setCurrentView('list');
    } catch (error) {
      console.error("Failed to save profile via API", error);
      alert("خطا در ذخیره پروفایل. لطفاً دوباره تلاش کنید.");
    }
  };

  const handleDeleteProfile = async (profileId: number) => {
    if (window.confirm('آیا از حذف این پروفایل مطمئن هستید؟')) {
      try {
        await api.delete(`/vehicle-setting-profiles/${profileId}`);
        await loadProfiles();
      } catch (error) {
        console.error("Failed to delete profile via API", error);
        alert("خطا در حذف پروفایل.");
      }
    }
  };












  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [dfStations, setDfStations] = useState<
    { name: string; lat: number; lng: number; radius_m: number }[]
  >([]);
  const [dfGfMode, setDfGfMode] = useState<'circle' | 'polygon'>('circle');
  const [dfGfCircle, setDfGfCircle] = useState<{
    center: { lat: number; lng: number };
    radius_m: number;
    tolerance_m?: number | null;
  }>({ center: { lat: 0, lng: 0 }, radius_m: 150, tolerance_m: 15 });
  const [dfGfPoly, setDfGfPoly] = useState<{
    points: { lat: number; lng: number }[];
    tolerance_m?: number | null;
  }>({ points: [], tolerance_m: 15 });
  const [vehicleStations, setVehicleStations] = useState<
    { id: number; name: string; lat: number; lng: number; radius_m: number }[]
  >([]);


  const [profiles, setProfiles] = useState<SettingsProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'list' | 'edit'>('list');
  const [profileName, setProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null);
  const [dfAddingStation, setDfAddingStation] = useState(false);
  const [dfApplying, setDfApplying] = useState(false); // ❗️این State اضافه شد


  const vehiclesBySA = useMemo(() => {
    const map: Record<number, Vehicle[]> = {};
    vehicles.forEach(v => {
      (map[v.owner_user_id] ||= []).push(v);
    });
    return map;
  }, [vehicles]);
  const toggleVehiclePick = useCallback((vid: number) => {
    setSelectedVehicleIds(prev => {
      const next = new Set(prev);
      next.has(vid) ? next.delete(vid) : next.add(vid);
      return next;
    });
  }, []);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedSAId, setSelectedSAId] = useState<number | null>(user?.id ?? null);

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectAll(checked);
    if (!selectedSAId) {
      setSelectedVehicleIds(new Set());
      return;
    }
    const list = vehiclesBySA[selectedSAId] || [];
    setSelectedVehicleIds(checked ? new Set(list.map(v => v.id)) : new Set());
  }, [selectedSAId, vehiclesBySA]);

  const [vehicleOptions, setVehicleOptions] = useState<string[]>([]);

  function PickPointsDF({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lng: number) => void }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }










  // انتخاب هدف: همه‌ی ماشین‌های SA یا فقط ماشین فعلی
  // (تو snippet خودت "currentSA" و "currentVehicle" هست)
  const [dfTarget, setDfTarget] = useState<'currentSA' | 'currentVehicle'>('currentVehicle');


  const getVehicleOptions = React.useCallback(async (vid: number): Promise<MonitorKey[]> => {
    const v = vehiclesRef.current.find(x => x.id === vid);
    const valid = new Set<MonitorKey>(MONITOR_PARAMS.map(m => m.key));
    let raw: string[] = [];

    try {
      const { data } = await api.get(`/vehicles/${vid}/options`);
      raw = Array.isArray(data?.options) ? data.options : [];
    } catch {
      if (v) {
        const { data: policies } = await api
          .get(`/vehicle-policies/user/${v.owner_user_id}`)
          .catch(() => ({ data: [] }));
        const pol = (policies || []).find((p: any) => p?.vehicle_type_code === v.vehicle_type_code);
        raw = Array.isArray(pol?.monitor_params) ? pol.monitor_params : [];
      }
    }

    const opts = Array.from(new Set(raw.map(s => s?.toString().trim().toLowerCase())))
      .filter((k): k is MonitorKey => valid.has(k as MonitorKey));

    return opts;
  }, []);
  // اگر از قبل جایی SA انتخاب می‌کنی، همونو ست کن؛ در غیر این صورت روی کاربر فعلی
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<number>>(new Set());


  const dfShowGeofence = useMemo(() => {
    if (dfTarget === 'currentVehicle') {
      // فقط وقتی ماشین انتخاب‌شده geo_fence داشته باشد
      return !!(selectedVehicle && vehicleOptions.includes('geo_fence'));
    }
    // در حالت گروهی نشان بده؛ موقع اعمال برای هر ماشین جداگانه چک می‌کنیم
    return true;
  }, [dfTarget, selectedVehicle?.id, vehicleOptions]);

  // کلیک‌گیر روی نقشه برای ژئوفنس
  function PickPointsForGeofence({
    enabled,
    onPick,
  }: {
    enabled: boolean;
    onPick: (lat: number, lng: number) => void;
  }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }
  type Vehicle = {
    id: number;
    owner_user_id: number;
    plate_no: string;
    vehicle_type_code: VehicleTypeCode;
    last_location?: { lat: number; lng: number };
    current_driver_user_id?: number | null;
  };
  // اعلان‌ها
  // برای اینکه هر آیتم فقط یک‌بار اعلان بده
  const notifiedRef = useRef<Set<string>>(new Set());
  const DEFAULT_KM_REMINDER = 5000; // ← حدّ پیش‌فرض کیلومتر
  const [editingCons, setEditingCons] = useState<any | null>(null);
  const [savingCons, setSavingCons] = useState(false);

  const [consumablesOpen, setConsumablesOpen] = useState(false);
  const [vehicleOptionsLoading, setVehicleOptionsLoading] = useState(false);
  const LIVE_OPTION_KEY: MonitorKey = 'gps'; // هر چی اسم گزینهٔ لایوته
  const [vehicleLiveAllowed, setVehicleLiveAllowed] = useState(false);
  const lastOptsReqRef = useRef<number | null>(null);
  const lastSubRef = useRef<{ vid: number; keys: MonitorKey[] } | null>(null);
  const lastStationsSubRef = useRef<{ vid: number; uid: number } | null>(null);
  const [addingStations, setAddingStations] = useState(false);
  const [autoIndex, setAutoIndex] = useState(1);
  const selectedDriverRef = useRef<User | null>(null);
  const selectedVehicleRef = useRef<Vehicle | null>(null);
  const [editing, setEditing] = useState<null | { id: number; name: string; lat: number; lng: number; radius_m: number }>(null);
  const [movingStationId, setMovingStationId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  // --- Route drawing mode ---
  const [drawingRoute, setDrawingRoute] = useState(false);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [routeName, setRouteName] = useState<string>('');
  const [routeThreshold, setRouteThreshold] = useState<number>(100);
  // هر Ring یک آرایه از [lat, lng] است؛ ممکن است MultiPolygon باشد
  const [routeBufferRings, setRouteBufferRings] = useState<[number, number][][]>([]);
  const routePolylineRef = useRef<[number, number][]>([]);
  const routeThresholdRef = useRef<number>(60);
  const [consumables, setConsumables] = useState<any[]>([]);
  const [toast, setToast] = useState<{ open: boolean; msg: string } | null>(null);
  function buildRouteBufferRings(
    latlngs: [number, number][],
    bufferMeters: number
  ): [number, number][][] {
    if (!Array.isArray(latlngs) || latlngs.length < 2 || !Number.isFinite(bufferMeters)) return [];
    // GeoJSON: [lng, lat]
    const gj = lineString(latlngs.map(([lat, lng]) => [lng, lat]));
    const buff = turfBuffer(gj, bufferMeters, { units: 'meters' });

    const rings: [number, number][][] = [];
    if (buff?.geometry?.type === 'Polygon') {
      // فقط outer ring (index 0)
      const outer = buff.geometry.coordinates[0] || [];
      rings.push(outer.map(([lng, lat]) => [lat, lng]));
    } else if (buff?.geometry?.type === 'MultiPolygon') {
      // هر پلیگون: outer ring = index 0
      for (const poly of buff.geometry.coordinates) {
        const outer = poly[0] || [];
        rings.push(outer.map(([lng, lat]) => [lat, lng]));
      }
    }
    return rings;
  }
  const [vehicleRoute, setVehicleRoute] = useState<VehicleRoute | null>(null);
  // تبدیل برحسب متر به/از lat/lng (تقریب equirectangular، برای بازه‌های شهری عالیه)
  function unprojectMeters(x: number, y: number, lat0: number, lng0: number): { lat: number; lng: number } {
    const R = 6371000; // m
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const lat = lat0 + toDeg(y / R);
    const lng = lng0 + toDeg(x / (R * Math.cos((lat0 * Math.PI) / 180)));
    return { lat, lng };
  }

  const [routeCorridor, setRouteCorridor] = useState<LatLng[][]>([]);
  useEffect(() => {
    const pts: RoutePoint[] = (vehicleRoute?.points ?? vehicleRoute?.stations ?? [])
      .slice()
      .sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0));

    const r = Math.max(1, Number(routeThreshold || 0)); // مثلاً 100 متر
    if (pts.length < 2 || !Number.isFinite(r)) {
      setRouteCorridor([]);
      return;
    }

    const rings: LatLng[][] = [];
    for (let i = 1; i < pts.length; i++) {
      const a = { lat: pts[i - 1].lat, lng: pts[i - 1].lng };
      const b = { lat: pts[i].lat, lng: pts[i].lng };
      const rect = corridorRectForSegment(a, b, r);
      if (rect.length) rings.push(rect);
    }
    setRouteCorridor(rings);
  }, [vehicleRoute?.id, vehicleRoute?.points?.length, vehicleRoute?.stations?.length, routeThreshold]);

  // مستطیلِ «کریدور» دور یک سگمنت [A -> B] با عرض r_m
  function corridorRectForSegment(a: LatLng, b: LatLng, r_m: number): LatLng[] {
    // b را نسبت به a به متر ببریم
    const [dx, dy] = projectMeters(b.lat, b.lng, a.lat, a.lng); // ← همین رو بالاتر داری
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return [];

    // نرمال واحدِ عمود بر سگمنت
    const nx = -dy / len, ny = dx / len;
    const ox = nx * r_m, oy = ny * r_m; // آفست

    // چهار گوشه در دستگاه محلی
    const A_L = unprojectMeters(+ox, +oy, a.lat, a.lng);
    const B_L = unprojectMeters(dx + ox, dy + oy, a.lat, a.lng);
    const B_R = unprojectMeters(dx - ox, dy - oy, a.lat, a.lng);
    const A_R = unprojectMeters(-ox, -oy, a.lat, a.lng);

    // جهتِ حلقه مهمه (ساعتگرد/پادساعتگرد)؛ همین ترتیب خوبه
    return [A_L, B_L, B_R, A_R];
  }

  useEffect(() => {
    const poly = routePolylineRef.current; // [[lat,lng], ...]
    if (!poly || poly.length < 2 || !Number.isFinite(routeThreshold)) {
      setRouteBufferRings([]);
      return;
    }
    const rings = buildRouteBufferRings(poly, Math.max(1, routeThreshold));
    setRouteBufferRings(rings);
  }, [
    vehicleRoute?.id,
    vehicleRoute?.points?.length,
    vehicleRoute?.stations?.length,
    routeThreshold
  ]);


  type VehicleProfile = {
    // null => پاک کن، [] => لیست جدید خالی (عملاً پاک)، undefined => اصلاً دست نزن
    stations?: { name: string; lat: number; lng: number; radius_m: number }[] | null;
    // null => پاک کن، object => تنظیم کن، undefined => اصلاً دست نزن
    geofence?: Geofence | null;
  };
  const dfShowStations = useMemo(() => {
    // اگر هدف فقط همین ماشین است: از options همان ماشین استفاده کن
    if (dfTarget === 'currentVehicle') {
      return !!(selectedVehicle && vehicleOptions.includes('stations'));
    }
    // اگر هدف گروهی (currentSA) است: اجازه بده فرم ایستگاه نشان داده شود
    // ولی در زمان اعمال، برای ماشین‌های غیرمجاز اسکیپ می‌کنیم (مرحله 2)
    return true;
  }, [dfTarget, selectedVehicle?.id, vehicleOptions]);

  const preloadDefaultsFromCurrent = React.useCallback(() => {
    setDfStations(
      (Array.isArray(vehicleStations) ? vehicleStations : []).map(s => ({
        name: s.name, lat: s.lat, lng: s.lng, radius_m: s.radius_m,
      }))
    );
    if (geofence?.type === 'circle') {
      setDfGfMode('circle');
      setDfGfCircle({
        center: { lat: geofence.center.lat, lng: geofence.center.lng },
        radius_m: geofence.radius_m,
        tolerance_m: geofence.tolerance_m ?? 0,
      });
    } else if (geofence?.type === 'polygon') {
      setDfGfMode('polygon');
      setDfGfPoly({
        points: geofence.points.map(p => ({ lat: p.lat, lng: p.lng })),
        tolerance_m: geofence.tolerance_m ?? 0,
      });
    } else {
      setDfGfMode('circle');
      setDfGfCircle({ center: { lat: 0, lng: 0 }, radius_m: 150, tolerance_m: 15 });
      setDfGfPoly({ points: [], tolerance_m: 15 });
    }
  }, [vehicleStations, geofence?.type]);

  const [tripNote, setTripNote] = useState('');                 // متن دلخواه
  const [tripDate, setTripDate] = useState<Date | null>(new Date()); // تاریخ شروع شمارش
  const [tripBaseKm, setTripBaseKm] = useState<number | null>(null); // مقدار کیلومترشمار در لحظه صفر کردن
  const [vehicleTlm, setVehicleTlm] = useState<VehicleTelemetry>({});
  const [consumableMode, setConsumableMode] = useState<'time' | 'km'>('km');

  // فاصله زنده: بر اساس تله‌متری odometer که از سوکت می‌آید
  const liveOdoKm = vehicleTlm.odometer; // فرض: کیلومتر
  const tripDistanceKm = useMemo(
    () => (liveOdoKm != null && tripBaseKm != null) ? Math.max(0, liveOdoKm - tripBaseKm) : 0,
    [liveOdoKm, tripBaseKm]
  );
  // --- Off-route detection (N consecutive updates) ---
  const OFF_ROUTE_N = 3;                     // تعداد آپدیت متوالی
  const OFF_ROUTE_COOLDOWN_MS = 60_000;      // فاصله بین ثبت تخلف‌ها (برای جلوگیری از اسپم)
  const offRouteCountsRef = useRef<Record<number, number>>({});
  const lastViolationAtRef = useRef<number>(0);
  type RouteStation = { id?: number; name?: string; lat: number; lng: number; order_no?: number };
  const keyOf = (c: any) => String(c.id ?? `${c.mode}:${c.start_at ?? c.base_odometer_km ?? Math.random()}`);

  const notifyOnce = (c: any, msg: string) => {
    const k = keyOf(c);
    if (notifiedRef.current.has(k)) return;
    notifiedRef.current.add(k);
    setToast({ open: true, msg });
  };

  const openEditConsumable = (c: any) => {
    // نورمالایز برای فرم
    setEditingCons({
      id: c.id,
      mode: c.mode, // 'km' | 'time'
      note: c.note ?? '',
      start_at: c.start_at ?? null,
      base_odometer_km: c.base_odometer_km ?? null,
    });
  };
  const mapDefaultsRef = useRef<any>(null);

  const buildDfGeofence = (): TmpGeofence | null => {
    if (dfGfMode === 'circle') {
      if (!dfGfCircle.center || !Number.isFinite(dfGfCircle.radius_m)) return null;
      return { type: 'circle', center: dfGfCircle.center, radius_m: Math.max(1, dfGfCircle.radius_m), tolerance_m: Math.max(0, dfGfCircle.tolerance_m) };
    }
    if (dfGfPoly.length >= 3) return { type: 'polygon', points: dfGfPoly.slice(), tolerance_m: Math.max(0, dfGfCircle.tolerance_m) };
    return null;
  };



  function mergeConsumables(prev: any[], next: any[]) {
    // ادغام بر اساس id؛ اگر id نداشت، با start_at+mode+note یه کلید می‌سازیم
    const keyOf = (c: any) => c?.id ?? `${c.mode}:${c.start_at ?? c.base_odometer_km ?? c.note ?? Math.random()}`;
    const map = new Map<string | number, any>();
    prev.forEach(c => map.set(keyOf(c), c));
    next.forEach(c => map.set(keyOf(c), c)); // داده‌های جدید، قدیمی‌ها را override کنند
    return Array.from(map.values());
  }
  async function loadVehicleGeofence(vid: number) {
    try {
      const { data } = await api.get(`/vehicles/${vid}/geofence`);
      if (!data) { setGeofence(null); return; }

      const type = data.type;

      if (type === 'circle') {
        // پشتیبانی از هر دو شکل فیلدها
        const centerLat = Number(data.center?.lat ?? data.centerLat ?? data.center_lat);
        const centerLng = Number(data.center?.lng ?? data.centerLng ?? data.center_lng);
        const radius = Number(data.radius_m ?? data.radiusM ?? data.radius);
        const tolerance = Number(
          data.tolerance_m ?? data.toleranceM ?? data.tolerance ?? NaN
        );

        if (Number.isFinite(centerLat) && Number.isFinite(centerLng) && Number.isFinite(radius)) {
          setGeofence({
            id: data.id,
            type: 'circle',
            center: { lat: centerLat, lng: centerLng },
            radius_m: radius,
            tolerance_m: Number.isFinite(tolerance) ? tolerance : null,
          });
          setGfMode('circle');
          // اختیاری: فوکوس کن روی مرکز
          setFocusLatLng([centerLat, centerLng]);
          return;
        }
      }

      if (type === 'polygon') {
        // هر دو نام: points | polygonPoints
        const rawPts = data.points ?? data.polygonPoints ?? data.polygon_points ?? [];
        const pts = Array.isArray(rawPts)
          ? rawPts
            .map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
            .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          : [];

        const tolerance = Number(
          data.tolerance_m ?? data.toleranceM ?? data.tolerance ?? NaN
        );

        if (pts.length >= 3) {
          setGeofence({
            id: data.id,
            type: 'polygon',
            points: pts,
            tolerance_m: Number.isFinite(tolerance) ? tolerance : null,
          });
          setGfMode('polygon');
          // اختیاری: فوکوس کن روی اولین رأس
          setFocusLatLng([pts[0].lat, pts[0].lng]);
          return;
        }
      }

      // اگر هیچ‌کدوم نشد:
      setGeofence(null);
    } catch {
      setGeofence(null);
    }
  }


  async function saveGeofence() {
    if (!selectedVehicle) return;

    const toInt = (v: any, min: number) => Math.max(min, Math.trunc(Number(v)));
    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    let payload: any;

    if (gfMode === 'circle') {
      if (!gfCenter || toNum(gfCenter.lat) == null || toNum(gfCenter.lng) == null || toNum(gfRadius) == null || Number(gfRadius) <= 0) {
        alert('مرکز و شعاع دایره را درست وارد کنید.');
        return;
      }
      payload = {
        type: 'circle',
        centerLat: +gfCenter.lat,
        centerLng: +gfCenter.lng,
        radiusM: toInt(gfRadius, 1),
        toleranceM: toInt(gfTolerance ?? 5, 0),
      };
    } else {
      if (!Array.isArray(gfPoly) || gfPoly.length < 3) {
        alert('چندضلعی حداقل به ۳ نقطه نیاز دارد.');
        return;
      }
      payload = {
        type: 'polygon',
        polygonPoints: gfPoly.map(p => ({ lat: +p.lat, lng: +p.lng })),
        toleranceM: toInt(gfTolerance ?? 5, 0),
      };
    }

    try {
      await api
        .put(`/vehicles/${selectedVehicle.id}/geofence`, payload)
        .catch(() => api.post(`/vehicles/${selectedVehicle.id}/geofence`, payload));

      await loadVehicleGeofence(selectedVehicle.id);
      setGfDrawing(false);
      setGfCenter(null);
      setGfPoly([]);
    } catch (e: any) {
      console.error('saveGeofence error:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'ثبت ژئوفنس ناموفق بود');
    }
  }



  async function deleteGeofence() {
    if (!selectedVehicle) return;
    if (!confirm('ژئوفنس حذف شود؟')) return;
    try {
      await api.delete(`/vehicles/${selectedVehicle.id}/geofence`);
      setGeofence(null);
      setGfDrawing(false); setGfCenter(null); setGfPoly([]);
    } catch (e) {
      console.error(e);
      alert('حذف ژئوفنس ناموفق بود');
    }
  }

  const closeEditConsumable = () => setEditingCons(null);

  const saveEditConsumable = async () => {
    if (!selectedVehicle || !editingCons?.id) return;
    setSavingCons(true);
    try {
      const payload: any = { mode: editingCons.mode, note: (editingCons.note ?? '').trim() };

      if (editingCons.mode === 'time') {
        if (!editingCons.start_at) { alert('start_at لازم است'); setSavingCons(false); return; }
        payload.start_at = new Date(editingCons.start_at).toISOString();
      } else {
        const n = Number(editingCons.base_odometer_km);
        if (!Number.isFinite(n)) { alert('base_odometer_km معتبر نیست'); setSavingCons(false); return; }
        payload.base_odometer_km = n;
      }

      await updateConsumable(selectedVehicle.id, editingCons.id, payload);
      await refreshConsumables(selectedVehicle.id, true);
      closeEditConsumable();
    } catch (e: any) {
      console.error('PATCH /consumables failed:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'خطا در ویرایش آیتم روی سرور');
    } finally {
      setSavingCons(false);
    }
  };

  const deleteConsumable = async (c: any) => {
    if (!selectedVehicle || !c?.id) return;
    if (!confirm('آیتم حذف شود؟')) return;

    const vid = selectedVehicle.id;

    // ✳️ حذف خوش‌بینانه از UI + کش
    setConsumables(prev => {
      const next = prev.filter(x => x.id !== c.id);
      saveConsumablesToStorage(vid, next);
      return next;
    });

    try {
      await api.delete(`/vehicles/${vid}/consumables/${c.id}`);
      // بعد از حذف، از سرور هم همسان‌سازی کن (روی master)
      await refreshConsumables(vid, true);
      if (editingCons?.id === c.id) closeEditConsumable();
    } catch (e: any) {
      // اگر خطا خورد، از سرور برگردون تا UI درست شود (rollback)
      await refreshConsumables(vid, true);
      console.error('DELETE /consumables failed:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'حذف روی سرور ناموفق بود');
    }
  };






  const checkConsumableDue = React.useCallback(() => {
    const now = Date.now();

    consumables.forEach((c: any) => {
      // TIME: وقتی الان از start_at گذشته باشد
      if (c.mode === 'time' && c.start_at) {
        const t = new Date(c.start_at).getTime();
        if (!Number.isNaN(t) && now >= t) {
          notifyOnce(
            c,
            `یادآوری: «${c.title ?? c.note ?? 'آیتم'}» به زمان تعیین‌شده رسید.`
          );
        }
      }

      // KM: وقتی فاصله‌ی طی‌شده از مبنا به حدّ پیش‌فرض برسد
      if (c.mode === 'km' && c.base_odometer_km != null && vehicleTlm.odometer != null) {
        const dist = Number(vehicleTlm.odometer) - Number(c.base_odometer_km);
        if (dist >= DEFAULT_KM_REMINDER) {
          notifyOnce(
            c,
            `یادآوری: «${c.title ?? c.note ?? 'آیتم'}» به ${DEFAULT_KM_REMINDER.toLocaleString('fa-IR')} کیلومتر پس از صفر رسید.`
          );
        }
      }
    });
  }, [consumables, vehicleTlm.odometer]);

  // تبدیل محلی (equirectangular) برای محاسبه فاصله بر حسب متر
  function projectMeters(lat: number, lng: number, lat0: number, lng0: number): [number, number] {
    const R = 6371000; // m
    const dLat = (lat - lat0) * Math.PI / 180;
    const dLng = (lng - lng0) * Math.PI / 180;
    const x = dLng * Math.cos((lat0 * Math.PI) / 180) * R;
    const y = dLat * R;
    return [x, y];
  }

  function distancePointToSegmentMeters(
    p: [number, number],
    a: [number, number],
    b: [number, number]
  ): number {
    // مبنا: مختصات محلی حول نقطه a
    const [px, py] = projectMeters(p[0], p[1], a[0], a[1]);
    const [ax, ay] = projectMeters(a[0], a[1], a[0], a[1]); // (0,0)
    const [bx, by] = projectMeters(b[0], b[1], a[0], a[1]);
    const ABx = bx - ax, ABy = by - ay;
    const APx = px - ax, APy = py - ay;
    const ab2 = ABx * ABx + ABy * ABy || 1e-9;
    let t = (APx * ABx + APy * ABy) / ab2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * ABx, cy = ay + t * ABy;
    const dx = px - cx, dy = py - cy;
    return Math.hypot(dx, dy);
  }
  async function loadCurrentRoute(vid: number) {
    const cur = await api.get(`/vehicles/${vid}/routes/current`).catch(() => ({ data: null }));
    const rid: number | undefined = cur?.data?.route_id;
    if (!rid) {
      setVehicleRoute(null);
      return;
    }

    // اول تلاش برای /points، اگر نبود می‌رویم سراغ /stations
    let pts: RoutePoint[] = [];
    try {
      const r = await api.get(`/routes/${rid}/points`);
      pts = Array.isArray(r.data) ? r.data : [];
    } catch {
      const r = await api.get(`/routes/${rid}/stations`).catch(() => ({ data: [] }));
      pts = Array.isArray(r.data) ? r.data : [];
    }

    setVehicleRoute({
      id: rid,
      name: cur?.data?.name ?? 'مسیر',
      threshold_m: cur?.data?.threshold_m ?? 60,
      points: pts, // 👈 از این به بعد همه‌جا points می‌خوانیم
    });
    setRouteThreshold(cur?.data?.threshold_m ?? 60);
  }
  const [consumablesStatus, setConsumablesStatus] =
    useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  const [selectedDriver, setSelectedDriver] = useState<User | null>(null);
  const normalizeConsumables = (payload: any) => {
    // 1) آرایه‌ را از شکل‌های مختلف پاسخ دربیار
    let arr: any[] =
      Array.isArray(payload) ? payload :
        Array.isArray(payload?.items) ? payload.items :
          Array.isArray(payload?.data?.items) ? payload.data.items :
            Array.isArray(payload?.data) ? payload.data :
              Array.isArray(payload?.result) ? payload.result :
                Array.isArray(payload?.consumables) ? payload.consumables : // 👈 اضافه
                  Array.isArray(payload?.records) ? payload.records :         // 👈 اضافه
                    Array.isArray(payload?.list) ? payload.list :               // 👈 اضافه
                      Array.isArray(payload?.rows) ? payload.rows :               // 👈 اضافه
                        (payload && typeof payload === 'object' ? [payload] : []);

    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const toISO = (v: any) => {
      if (!v) return null;
      const t = new Date(v);
      return isNaN(+t) ? null : t.toISOString();
    };

    // 2) یکی‌سازی نام فیلدها
    const out = arr.map((c: any) => ({
      ...c,
      id: c.id ?? c._id ?? undefined,
      // mode فقط time|km؛ اگر بک‌اند type برگردونه، تبدیل می‌کنیم
      mode: (c.mode ?? c.type) === 'time' ? 'time' : 'km',
      note: c.note ?? c.description ?? '',
      title: c.title ?? c.name ?? c.note ?? undefined,

      created_at: toISO(c.created_at ?? c.createdAt),
      start_at: toISO(c.start_at ?? c.startAt ?? c.start_time ?? c.startTime),
      base_odometer_km: toNum(c.base_odometer_km ?? c.baseOdometerKm ?? c.base_odo ?? c.base_odo_km),

      vehicle_id: c.vehicle_id ?? c.vehicleId ?? null,
    }));

    // 3) dedupe بر اساس id، وگرنه کلید ترکیبی
    const keyOf = (x: any) => x.id ?? `${x.mode}:${x.start_at ?? x.base_odometer_km ?? x.note ?? ''}`;
    const map = new Map<string | number, any>();
    out.forEach(x => map.set(keyOf(x), x));

    return Array.from(map.values());
  };

  async function updateConsumable(vid: number, id: number, payload: { mode: 'km' | 'time'; note: string; start_at?: string | null; base_odometer_km?: number | null }) {
    const snake = payload.mode === 'time'
      ? { mode: 'time', note: payload.note, start_at: payload.start_at }
      : { mode: 'km', note: payload.note, base_odometer_km: payload.base_odometer_km };

    try {
      return await api.patch(`/vehicles/${vid}/consumables/${id}`, snake);
    } catch (e1) {
      const camel = payload.mode === 'time'
        ? { mode: 'time', note: payload.note, startAt: payload.start_at }
        : { mode: 'km', note: payload.note, baseOdometerKm: payload.base_odometer_km };
      return await api.patch(`/vehicles/${vid}/consumables/${id}`, camel);
    }
  }
  async function createConsumable(
    vid: number,
    payload: { mode: 'km' | 'time'; note: string; start_at?: string | null; base_odometer_km?: number | null }
  ) {
    // 1) snake_case بدون wrapper
    const snake = payload.mode === 'time'
      ? { mode: 'time', note: payload.note, start_at: payload.start_at }
      : { mode: 'km', note: payload.note, base_odometer_km: payload.base_odometer_km };

    try {
      return await api.post(`/vehicles/${vid}/consumables`, snake);
    } catch (e1) {
      // 2) camelCase بدون wrapper
      const camel = payload.mode === 'time'
        ? { mode: 'time', note: payload.note, startAt: payload.start_at }
        : { mode: 'km', note: payload.note, baseOdometerKm: payload.base_odometer_km };

      try {
        return await api.post(`/vehicles/${vid}/consumables`, camel);
      } catch (e2) {
        // 3) wrapper با snake
        try {
          return await api.post(`/vehicles/${vid}/consumables`, { consumable: snake });
        } catch (e3) {
          // 4) wrapper با camel
          return await api.post(`/vehicles/${vid}/consumables`, { consumable: camel });
        }
      }
    }
  }

  // بالای کامپوننت:
  const consReqIdRef = useRef(0);

  const refreshConsumables = React.useCallback(async (vid: number, forceServer = false) => {
    const myId = ++consReqIdRef.current; // ← شناسه این درخواست
    setConsumablesStatus('loading');

    // فقط اگر forceServer=false از کش بخوان
    if (!forceServer) {
      const cached = loadConsumablesFromStorage(vid);
      if (cached.length) {
        setConsumables(prev => mergeConsumables(prev, cached));
      }
    }

    try {
      const { data } = await api.get(`/vehicles/${vid}/consumables`, {
        params: { _: Date.now() }, // bust cache
        // اگر axios interceptor داری که کش می‌کند، این دو تا هم مطمئن‌ترند:
        headers: { 'Cache-Control': 'no-store' }
      });

      // اگر در این فاصله درخواست جدیدتری زده شد، این پاسخ را نادیده بگیر
      if (myId !== consReqIdRef.current) return;

      const serverList = normalizeConsumables(data);

      setConsumables(() => {
        saveConsumablesToStorage(vid, serverList); // کش لوکال را هم همسان کن
        return serverList;                          // منبع حقیقت = سرور
      });
      setConsumablesStatus('loaded');
    } catch (e) {
      if (myId !== consReqIdRef.current) return;
      setConsumablesStatus('error');
    }
  }, []);





  const handleAddConsumable = async () => {
    if (!selectedVehicle) return;

    try {
      const payload: any = { mode: consumableMode, note: (tripNote || '').trim() };

      if (consumableMode === 'time') {
        if (!tripDate) { alert('تاریخ لازم است'); return; }
        payload.start_at = new Date(tripDate).toISOString();
      } else {
        const base = Number(tripBaseKm ?? liveOdoKm);
        if (!Number.isFinite(base)) { alert('مقدار مبنا معتبر نیست'); return; }
        payload.base_odometer_km = base;
      }

      // 1) سرور-اول با فالبک‌ها
      const { data } = await createConsumable(selectedVehicle.id, payload);

      // 2) خوش‌بینانه: فوری در UI نشان بده
      const [created] = normalizeConsumables([data]);
      setConsumables(prev => {
        const next = created ? [created, ...prev] : prev;
        saveConsumablesToStorage(selectedVehicle.id, next);
        return next;
      });
      setConsumablesStatus('loaded');

      // 3) فورس از سرور بگیر تا مطمئن همسان شود
      await refreshConsumables(selectedVehicle.id, true);

      // 4) بستن و ریست
      setConsumablesOpen(false);
      setTripNote('');
      setTripBaseKm(null);
    } catch (err: any) {
      console.error('POST /consumables failed:', err?.response?.data || err);
      alert(err?.response?.data?.message || 'خطا در ذخیره لوازم مصرفی روی سرور');
    }
  };








  function distancePointToPolylineMeters(
    p: [number, number],
    poly: [number, number][]
  ): number {
    if (poly.length < 2) return Infinity;
    let min = Infinity;
    for (let i = 1; i < poly.length; i++) {
      const d = distancePointToSegmentMeters(p, poly[i - 1], poly[i]);
      if (d < min) min = d;
    }
    return min;
  }

  // کامپوننت کمکی برای گرفتن کلیک‌ها
  function PickPointsForStations({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lng: number) => void }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }
  function PickPointsForRoute({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lng: number) => void }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }



  // لوازم مصرفی

  // مسیر جاری

  type VehicleTelemetry = { ignition?: boolean; idle_time?: number; odometer?: number };

  type TrackPoint = { lat: number; lng: number; ts?: string | number };

  // -------- مجوزها --------
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [permsLoading, setPermsLoading] = useState(true);
  useEffect(() => {
    if (user?.role_level !== 2) {
      setAllowed(new Set<string>(['track_driver', 'view_report']));
      setPermsLoading(false);
      return;
    }
    let ok = true;

    (async () => {
      try {
        setPermsLoading(true);
        // اگر تایپ API مشخص نیست، <any[]> یا یک type تعریف کن
        const { data } = await api.get<any[]>(`/role-permissions/user/${user.id}`);

        const s = new Set<string>(
          (data ?? [])
            .filter((p) => p?.is_allowed)
            .map((p) => String(p.action))
        );

        if (ok) setAllowed(s); // <-- حالا Set<string> است
      } catch (e) {
        if (ok) setAllowed(new Set<string>()); // خالی در خطا
      } finally {
        if (ok) setPermsLoading(false);
      }
    })();

    return () => {
      ok = false;
    };
  }, [user?.id, user?.role_level]);

  const can = (k: string) => (user?.role_level === 2 ? allowed.has(k) : true);

  // -------- تب فعال: drivers | vehicles --------
  const [tab, setTab] = useState<'drivers' | 'vehicles'>('drivers');

  // -------- دیتای راننده/ماشین --------
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const vehiclesRef = useRef<Vehicle[]>([]);
  useEffect(() => { vehiclesRef.current = vehicles; }, [vehicles]);

  // فیلتر جستجو برای هر تب
  const [q, setQ] = useState('');
  const filteredDrivers = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return drivers;
    return drivers.filter(
      (d) =>
        (d.full_name || '').toLowerCase().includes(s) ||
        (d.phone || '').includes(s)
    );
  }, [drivers, q]);
  const filteredVehicles = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return vehicles;
    return vehicles.filter(
      (v) =>
        v.plate_no.toLowerCase().includes(s) ||
        (v.vehicle_type_code || '').toLowerCase().includes(s)
    );
  }, [vehicles, q]);

  // انتخاب‌ها

  // نقشه
  const [useMapTiler, setUseMapTiler] = useState(Boolean(MT_KEY));
  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const [focusLatLng, setFocusLatLng] = useState<[number, number] | undefined>(
    undefined
  );
  useEffect(() => { selectedDriverRef.current = selectedDriver; }, [selectedDriver]);
  useEffect(() => { selectedVehicleRef.current = selectedVehicle; }, [selectedVehicle]);
  // سوکت (برای لوکیشن لحظه‌ای)
  const socketRef = useRef<Socket | null>(null);
  const [driverLive, setDriverLive] = useState<
    Record<number, [number, number, number][]>
  >({});
  const [vehicleLive, setVehicleLive] = useState<
    Record<number, [number, number, number][]>
  >({});
  // کدهای زیر را اضافه کن
  const subscribedVehiclesRef = useRef<Set<number>>(new Set()); // لیست ماشین‌هایی که الان سابسکرایب شدیم
  const vehiclesIdsHash = useMemo(
    () => vehicles.map(v => v.id).sort((a, b) => a - b).join(','),
    [vehicles]
  );

  // بازه زمانی
  const [rangePreset, setRangePreset] = useState<
    'today' | 'yesterday' | '7d' | 'custom'
  >('today');

  // ۱) وقتی بازه یا انتخاب راننده عوض شد، مسیر و KPI دوباره لود شوند
  useEffect(() => {
    if (tab === 'drivers' && selectedDriver?.id) {
      loadDriverTrack(selectedDriver.id);
      fetchDriverStats(selectedDriver.id);
    }
  }, [tab, selectedDriver?.id, fromISO, toISO]);

  // ۲) وقتی بازه یا انتخاب ماشین عوض شد، مسیر و تخلفات ماشین دوباره لود شوند
  useEffect(() => {
    if (tab === 'vehicles' && selectedVehicle?.id) {
      loadVehicleTrack(selectedVehicle.id);
      loadViolations(selectedVehicle.id, fromISO, toISO);
    }
  }, [tab, selectedVehicle?.id, fromISO, toISO, loadViolations]);


  useEffect(() => {
    const now = new Date();
    if (rangePreset === 'today') {
      setFromISO(new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
      setToISO(now.toISOString());
    } else if (rangePreset === 'yesterday') {
      const s = new Date();
      s.setDate(s.getDate() - 1);
      s.setHours(0, 0, 0, 0);
      const e = new Date(s);
      e.setHours(23, 59, 59, 999);
      setFromISO(s.toISOString());
      setToISO(e.toISOString());
    } else if (rangePreset === '7d') {
      const s = new Date();
      s.setDate(s.getDate() - 7);
      setFromISO(s.toISOString());
      setToISO(now.toISOString());
    }
  }, [rangePreset]);

  // لود اولیه راننده‌ها و ماشین‌ها
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [{ data: subs }, { data: vehs }] = await Promise.all([
          api.get('/users/my-subordinates-flat'),
          api
            .get('/vehicles', { params: { owner_user_id: user.id, limit: 1000 } })
            .catch(() => ({ data: { items: [] } })),
        ]);
        setDrivers((subs || []).filter((u: User) => u.role_level === 6));
        setVehicles(((vehs?.items ?? []) as Vehicle[]) || []);
      } catch (e) {
        console.error('[superadmin] init fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  // سوکت: فقط وقتی track_driver مجاز است
  // سوکت: فقط وقتی track_driver مجاز است
  const canTrack = useMemo(() => can('track_driver'), [permsLoading, allowed, user?.role_level]);
  useEffect(() => {
    if (!canTrack) return;
    const s = socketRef.current;
    if (!s) return;

    // مجموعه‌ی جدید آی‌دی‌های ماشین‌ها
    const next = new Set(vehicles.map(v => v.id));
    // مجموعه‌ی قبلی که قبلاً سابسکرایب بودیم
    const prev = subscribedVehiclesRef.current;

    // چیزهایی که باید سابسکرایب/آن‌سابسکرایب کنیم
    const toSub: number[] = [];
    const toUnsub: number[] = [];

    next.forEach(id => { if (!prev.has(id)) toSub.push(id); });
    prev.forEach(id => { if (!next.has(id)) toUnsub.push(id); });

    // انجام عمل
    toSub.forEach(id => s.emit('subscribe', { topic: `vehicle/${id}/pos` }));     // ✅
    toUnsub.forEach(id => s.emit('unsubscribe', { topic: `vehicle/${id}/pos` })); // ✅


    // به‌روزرسانی ref
    subscribedVehiclesRef.current = next;

    // موقع خروج/غیرفعال‌شدن: همه رو آن‌سابسکرایب کن
    return () => {
      const s2 = socketRef.current;
      if (!s2) return;
      subscribedVehiclesRef.current.forEach(id => {
        s2.emit('unsubscribe', { topic: `vehicle/${id}/pos` });
      });
      subscribedVehiclesRef.current = new Set();
    };
  }, [canTrack, vehiclesIdsHash]);

  const filterByRange = (items: Violation[], fromISO?: string, toISO?: string) => {
    const fromT = fromISO ? +new Date(fromISO) : -Infinity;
    const toT = toISO ? +new Date(toISO) : Infinity;
    return items.filter(v => {
      const t = +new Date(v.created_at);
      return t >= fromT && t <= toT;
    });
  };

  useEffect(() => {
    if (!canTrack) return;

    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const s = io(url + '/vehicles', { transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => {
      const ids = vehiclesRef.current.map(v => v.id);
      if (ids.length) {
        ids.forEach(id => s.emit('subscribe', { topic: `vehicle/${id}/pos` })); // ✅ بدون userId
        subscribedVehiclesRef.current = new Set(ids);
      }
    });

    // --- driver live ---
    const onDriverPos = (v: { driver_id: number; lat: number; lng: number; ts?: string | number }) => {
      const id = v.driver_id;
      const ts = v.ts ? +new Date(v.ts) : Date.now();

      setDrivers(prev => {
        const i = prev.findIndex(d => d.id === id);
        if (i === -1) return prev;
        const cp = [...prev];
        (cp[i] as any) = { ...cp[i], last_location: { lat: v.lat, lng: v.lng } };
        return cp;
      });

      setDriverLive(prev => {
        const arr = prev[id] ? [...prev[id]] : [];
        arr.push([v.lat, v.lng, ts]);
        if (arr.length > 500) arr.shift();
        return { ...prev, [id]: arr };
      });

      if (selectedDriverRef.current?.id === id) {
        setFocusLatLng([v.lat, v.lng]);
      }
    };
    // بیرون از onVehiclePos و در سطح کامپوننت:


    // --- vehicle live ---
    const onVehiclePos = (v: { vehicle_id: number; lat: number; lng: number; ts?: string | number }) => {
      // --- نرمال‌سازی ورودی
      const id = Number(v.vehicle_id);
      const lat = Number(v.lat);
      const lng = Number(v.lng);
      const ts = v.ts ? +new Date(v.ts) : Date.now();
      if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

      // --- 0) یافتن راننده فعلی روی این ماشین (برای ثبت تخلف)
      const vehNow = vehiclesRef.current.find(x => x.id === id);
      const driverId = vehNow?.current_driver_user_id ?? null;

      // --- 1) آپدیت لیست ماشین‌ها (آخرین موقعیت)
      setVehicles(prev => {
        const i = prev.findIndex(x => x.id === id);
        if (i === -1) return prev;
        const cp = [...prev];
        cp[i] = { ...cp[i], last_location: { lat, lng } };
        return cp;
      });

      // --- 2) بافر لایو مسیر برای همین ماشین
      setVehicleLive(prev => {
        const arr = prev[id] ? [...prev[id]] : [];
        arr.push([lat, lng, ts]);
        if (arr.length > 500) arr.shift();
        return { ...prev, [id]: arr };
      });

      // --- 3) اگر همین ماشین انتخاب‌شده است، روی نقشه فوکوس کن
      if (selectedVehicleRef.current?.id === id) {
        setFocusLatLng([lat, lng]);
      }

      // --- 4) اگر راننده روی این ماشین ست است، لوکیشن راننده را هم sync کن
      setToast({ open: true, msg: 'خروج از مسیر شناسایی شد' });



      // --- 5) تشخیص خروج از مسیر (Route Corridor) با کول‌داون
      const poly = routePolylineRef.current;                 // [[lat,lng], ...]
      const threshold = Math.max(1, Number(routeThresholdRef.current || 0)); // متر
      if (Array.isArray(poly) && poly.length >= 2 && Number.isFinite(threshold)) {
        const now = Date.now();
        const dist = distancePointToPolylineMeters([lat, lng], poly); // poly = routePolylineRef.current

        if (dist > threshold) {
          // چند آپدیت متوالی خارج از محدوده
          offRouteCountsRef.current[id] = (offRouteCountsRef.current[id] || 0) + 1;

          // وقتی به N رسید و کول‌داون هم گذشته باشد، یک تخلف ثبت کن
          if (
            offRouteCountsRef.current[id] >= OFF_ROUTE_N &&
            now - (lastViolationAtRef.current || 0) >= OFF_ROUTE_COOLDOWN_MS
          ) {
            if (driverId) {
              api.post('/violations', {
                driver_user_id: driverId,       // تخلف برای راننده
                vehicle_id: id,                 // اطلاعات کمکی
                type: 'off_route',              // اگر خواستی: 'route_geofence'
                at: new Date(ts).toISOString(),
                meta: {
                  route_id: vehicleRoute?.id ?? null,
                  distance_m: Math.round(dist),
                  threshold_m: threshold,
                  point: { lat, lng },
                },
              }).catch(() => { /* بی‌سروصدا */ });
            }

            lastViolationAtRef.current = now;   // شروع کول‌داون
            offRouteCountsRef.current[id] = 0;  // ریست شمارنده
          }
        } else {
          // برگشت داخل محدوده → شمارنده صفر شود
          if (offRouteCountsRef.current[id]) offRouteCountsRef.current[id] = 0;
        }
      }
    };

    // --- stations events (پیام‌های CRUD ایستگاه) ---
    const onStations = (msg: any) => {
      setVehicleStations(prev => {
        if (msg?.type === 'created' && msg.station) return [...prev, msg.station];
        if (msg?.type === 'updated' && msg.station) {
          const i = prev.findIndex(x => x.id === msg.station.id);
          if (i === -1) return prev;
          const cp = [...prev];
          cp[i] = msg.station;
          return cp;
        }
        if (msg?.type === 'deleted' && msg.station_id) {
          return prev.filter(x => x.id !== msg.station_id);
        }
        return prev;
      });
    };
    // لیسنر
    const onViolation = (v: any) => {
      const item = normalizeViolations([v])[0];
      if (!item) return;
      setViolations(prev => [item, ...prev].slice(0, 200));
      // اگر همین ماشین انتخاب است، اعلان کوچک
      if (selectedVehicleRef.current?.id === Number(item.vehicle_id)) {
        setToast({ open: true, msg: 'تخلف جدید ثبت شد' });
      }
    };

    s.on('vehicle:violation', onViolation);

    // پاکسازی در return همان effect:

    // ثبت لیسنرها
    s.on('driver:pos', onDriverPos);
    s.on('vehicle:pos', onVehiclePos);
    s.on('vehicle:stations', onStations);

    // پاکسازی
    return () => {
      s.off('driver:pos', onDriverPos);
      s.off('vehicle:pos', onVehiclePos);
      s.off('vehicle:stations', onStations);
      s.off('vehicle:violation', onViolation);

      // آن‌سابسکرایب از همه‌ی pos ها
      subscribedVehiclesRef.current.forEach(id => {
        s.emit('unsubscribe', { topic: `vehicle/${id}/pos` });
      });
      subscribedVehiclesRef.current = new Set();

      // اگر برای ایستگاه‌ها سابسکرایب کرده بودیم (در onPickVehicle)
      if (lastStationsSubRef.current && socketRef.current) {
        const { vid, uid } = lastStationsSubRef.current;
        socketRef.current.emit('unsubscribe', { topic: `vehicle/${vid}/stations/${uid}` });
        lastStationsSubRef.current = null;
      }

      s.disconnect();
      socketRef.current = null;
    };
  }, [canTrack]);




  // مسیر از دیتابیس
  const [polyline, setPolyline] = useState<[number, number][]>([]);
  const loadDriverTrack = async (driverId: number) => {
    setDriverTrackPts([]); // پاک قبلی
    try {
      const { data } = await api.get<{ items: DriverMission[] }>(
        `/driver-routes/by-driver/${driverId}`,
        { params: { from: fromISO, to: toISO, limit: 1000 } }
      );
      const allPoints = (data.items || []).flatMap(m => m.gps_points || []);
      if (allPoints.length > 0) {
        const pts = allPoints
          // اگر ts/time داری، مرتب‌سازی بهتره:
          // .sort((a,b)=> (+new Date(a.ts||a.time||a.at||0))-(+new Date(b.ts||b.time||b.at||0)))
          .map(p => [p.lat, p.lng] as [number, number]);
        setDriverTrackPts(pts);
        setFocusLatLng([pts[0][0], pts[0][1]]);
      }
    } catch (e) {
      const liveTrack = (driverLive[driverId] || [])
        .filter(p => p[2] >= +new Date(fromISO) && p[2] <= +new Date(toISO))
        .map(p => [p[0], p[1]] as [number, number]);
      setDriverTrackPts(liveTrack);
    }
  };


  // مسیر کامل خودرو از دیتابیس
  const loadVehicleTrack = async (vehicleId: number) => {
    setVehicleTrackPts([]); // پاک قبلی
    try {
      const { data } = await api.get<VehicleTrackResponse>(
        `/vehicles/${vehicleId}/track`,
        { params: { from: fromISO, to: toISO } }
      );
      const allPoints = data.points || [];
      if (allPoints.length > 0) {
        const pts = allPoints.map(p => [p.lat, p.lng] as [number, number]);
        setVehicleTrackPts(pts);
        setFocusLatLng([pts[0][0], pts[0][1]]);
      }
    } catch (e) {
      const liveTrack = (vehicleLive[vehicleId] || [])
        .filter(p => p[2] >= +new Date(fromISO) && p[2] <= +new Date(toISO))
        .map(p => [p[0], p[1]] as [number, number]);
      setVehicleTrackPts(liveTrack);
    }
  };
  const [showDriverAnim, setShowDriverAnim] = useState(false);
  const [showVehAnim, setShowVehAnim] = useState(false);
  const { visible: animatedDriver, start: startDriverAnim, pause: pauseDriverAnim, reset: resetDriverAnim } =
    useAnimatedPath(driverTrackPts, {
      stepMs: 50,
      stepInc: driverSpeed,
      autoStart: false,
      key: `${selectedDriver?.id || ''}-${fromISO}-${toISO}`,
    });

  const { visible: animatedVehicle, start: startVehAnim, pause: pauseVehAnim, reset: resetVehAnim } =
    useAnimatedPath(vehicleTrackPts, {
      stepMs: 50,
      stepInc: vehSpeed,
      autoStart: false,
      key: `${selectedVehicle?.id || ''}-${fromISO}-${toISO}`,
    });
  useEffect(() => {
    // راننده
    setShowDriverAnim(false);
    resetDriverAnim();
    setDriverSpeed(1);
  }, [tab, selectedDriver?.id, fromISO, toISO]);

  useEffect(() => {
    // ماشین
    setShowVehAnim(false);
    resetVehAnim();
    setVehSpeed(1);
  }, [tab, selectedVehicle?.id, fromISO, toISO]);


  // KPI (برای راننده)
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState<{
    totalDistanceKm?: number;
    totalDurationMin?: number;
    jobsCount?: number;
    breakdownsCount?: number;
    startTime?: string;
    endTime?: string;
    avgSpeed?: number;
    maxSpeed?: number;
  }>({});
  const hav = (a: [number, number], b: [number, number]) => {
    const toRad = (x: number) => (x * Math.PI) / 180,
      R = 6371;
    const dLat = toRad(b[0] - a[0]),
      dLon = toRad(b[1] - a[1]),
      lat1 = toRad(a[0]),
      lat2 = toRad(b[0]);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const fetchDriverStats = async (driverId: number) => {
    setStatsLoading(true);
    try {
      const res = await api.get(`/driver-routes/stats/${driverId}`, {
        params: { from: fromISO, to: toISO },
      }).catch(() => null);

      if (res?.data) {
        const trips: any[] = Array.isArray(res.data.trips) ? res.data.trips : [];
        const finishedCount = trips.filter(t => t?.finished === true).length;

        setStats({
          totalDistanceKm: Number(res.data.total_distance_km ?? 0).toFixed(2) as any,
          totalDurationMin: Math.floor(Number(res.data.total_work_seconds ?? 0) / 60),
          jobsCount: finishedCount,
          startTime: fromISO,
          endTime: toISO,
        });
      } else {
        // فالبک: اگر API در دسترس نبود، از پلی‌لاین فعلی مسافت رو جمع بزن
        const arr = polyline;
        let d = 0;
        for (let i = 1; i < arr.length; i++) d += hav(arr[i - 1], arr[i]);
        setStats({
          totalDistanceKm: +d.toFixed(2),
          totalDurationMin: undefined,
          jobsCount: undefined,
          startTime: fromISO,
          endTime: toISO,
        });
      }
    } finally {
      setStatsLoading(false);
    }
  };


  // انتخاب‌های لیست
  // انتخاب راننده + لود تریس، KPI و تخلفات
  const onPickDriver = (d: User) => {
    setSelectedDriver(d);
    setSelectedVehicle(null);
    loadDriverViolations(d.id);

    // فوکوس نقشه
    const last = (d as any)?.last_location;
    if (last && Number.isFinite(last.lat) && Number.isFinite(last.lng)) {
      setFocusLatLng([last.lat, last.lng]);
    }

    // پاک‌سازی نمایش‌ها
    setPolyline([]);
    setSelectedViolation(null);
    setDriverViolations([]);
    setDriverViolationsLoading(true);

    // تریس + KPI
    loadDriverTrack(d.id)
      .then(() => fetchDriverStats(d.id))
      .catch(() => { /* بی‌سروصدا */ });

    // تخلفات راننده در بازه
    loadDriverViolations(d.id)
      .finally(() => setDriverViolationsLoading(false));
  };


  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const onIgn = (data: { vehicle_id: number; ignition: boolean }) => {
      if (selectedVehicle?.id !== data.vehicle_id) return;
      setVehicleTlm(prev => ({ ...prev, ignition: data.ignition }));
    };

    const onIdle = (data: { vehicle_id: number; idle_time: number }) => {
      if (selectedVehicle?.id !== data.vehicle_id) return;
      setVehicleTlm(prev => ({ ...prev, idle_time: data.idle_time }));
    };

    const onOdo = (data: { vehicle_id: number; odometer: number }) => {
      if (selectedVehicle?.id !== data.vehicle_id) return;
      setVehicleTlm(prev => ({ ...prev, odometer: data.odometer }));
    };

    s.on('vehicle:ignition', onIgn);
    s.on('vehicle:idle_time', onIdle);
    s.on('vehicle:odometer', onOdo);

    return () => {
      s.off('vehicle:ignition', onIgn);
      s.off('vehicle:idle_time', onIdle);
      s.off('vehicle:odometer', onOdo);
    };
  }, [selectedVehicle?.id]);


  const markersLatLngs = useMemo(() => {
    if (!can('track_driver')) return [];
    if (tab === 'drivers')
      return filteredDrivers
        .filter((d) => (d as any).last_location)
        .map(
          (d) =>
            [(d as any).last_location!.lat, (d as any).last_location!.lng] as [
              number,
              number
            ]
        );
    return filteredVehicles
      .filter((v) => v.last_location)
      .map((v) => [v.last_location!.lat, v.last_location!.lng] as [number, number]);
  }, [tab, filteredDrivers, filteredVehicles, allowed]);
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    const onStations = (msg: any) => {
      setVehicleStations(prev => {
        if (msg?.type === 'created' && msg.station) return [...prev, msg.station];
        if (msg?.type === 'updated' && msg.station) {
          const i = prev.findIndex(x => x.id === msg.station.id);
          if (i === -1) return prev;
          const cp = [...prev]; cp[i] = msg.station; return cp;
        }
        if (msg?.type === 'deleted' && msg.station_id) {
          return prev.filter(x => x.id !== msg.station_id);
        }
        return prev;
      });
    };
    s.on('vehicle:stations', onStations);
    return () => {
      s.off('vehicle:stations', onStations);
    };
  }, []);
  const [stationRadius, setStationRadius] = useState<number>(60);

  // فقط افرادی که مجوز دارند (هر کدوم از این دو کلید)

  const showStationActions = useMemo(
    () => vehicleOptions.includes('stations') && !!selectedVehicle,
    [vehicleOptions, selectedVehicle?.id]
  );




  // ایستگاه موقت برای تایید قبل از ذخیره
  const [tempStation, setTempStation] = useState<{ lat: number; lng: number } | null>(null);
  const [tempName, setTempName] = useState<string>('');

  // شروع/خاتمه حالت افزودن
  const startAddingStation = () => {
    setAddingStations(v => {
      const next = !v;
      if (next) {
        setTempStation(null);
        setTempName(`ایستگاه ${autoIndex}`);
      } else {
        setTempStation(null);
      }
      return next;
    });
  };

  // تایید و ذخیره در بک‌اند
  const confirmTempStation = async () => {
    if (!selectedVehicle || !tempStation) return;
    try {
      await api.post(`/vehicles/${selectedVehicle.id}/stations`, {
        name: (tempName || `ایستگاه ${autoIndex}`).trim(),
        lat: tempStation.lat,
        lng: tempStation.lng,
        radius_m: stationRadius,
      });

      // ریفرش لیست از سرور
      const { data } = await api.get(`/vehicles/${selectedVehicle.id}/stations`);
      setVehicleStations(Array.isArray(data) ? data : []);

      setAutoIndex(i => i + 1);
      setTempStation(null);
      setAddingStations(false);
    } catch (e) {
      console.error(e);
      alert('ثبت ایستگاه ناموفق بود');
    }
  };


  // انتخاب‌های کاربر برای ماشین‌ها (وقتی select_vehicles باشه)
  const [dfSelectedVehicleIds, setDfSelectedVehicleIds] = useState<number[]>([]);
  const [dfVehiclesQuery, setDfVehiclesQuery] = useState('');

  // فهرست ماشین‌ها برای نمایش داخل دیالوگ (با جستجو)
  const dfVehiclesList = useMemo(() => {
    const s = dfVehiclesQuery.trim().toLowerCase();
    const base = vehicles; // همین vehicles که بالاتر لود می‌کنی
    if (!s) return base;
    return base.filter(v =>
      v.plate_no.toLowerCase().includes(s) ||
      (v.vehicle_type_code || '').toLowerCase().includes(s)
    );
  }, [vehicles, dfVehiclesQuery]);

  // لغو
  const cancelTempStation = () => {
    setAddingStations(false);
    setTempStation(null);
  };
  const startEdit = (st: { id: number; name: string; lat: number; lng: number; radius_m: number }) => {
    setEditing({ ...st });
    setMovingStationId(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setMovingStationId(null);
  };

  const saveEdit = async () => {
    if (!selectedVehicle || !editing) return;
    setSavingEdit(true);
    try {
      await api.put(`/vehicles/${selectedVehicle.id}/stations/${editing.id}`, {
        name: editing.name,
        lat: editing.lat,
        lng: editing.lng,
        radius_m: editing.radius_m,
      });
      // خوش‌بینانه یا منتظر سوکت:
      setVehicleStations(prev => prev.map(s => s.id === editing.id ? { ...editing } : s));
      cancelEdit();
    } catch (e) {
      console.error(e);
      alert('ذخیره ویرایش ناموفق بود');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteStation = async (st: { id: number }) => {
    if (!selectedVehicle) return;
    if (!confirm('ایستگاه حذف شود؟')) return;
    try {
      await api.delete(`/vehicles/${selectedVehicle.id}/stations/${st.id}`);
      setVehicleStations(prev => prev.filter(s => s.id !== st.id));
      if (editing?.id === st.id) cancelEdit();
    } catch (e) {
      console.error(e);
      alert('حذف ناموفق بود');
    }
  };

  const allVisibleSelected = useMemo(() => {
    if (!dfVehiclesList.length) return false;
    const set = new Set(dfSelectedVehicleIds);
    return dfVehiclesList.every(v => set.has(v.id));
  }, [dfVehiclesList, dfSelectedVehicleIds]);

  const toggleAllVisible = () => {
    const visibleIds = dfVehiclesList.map(v => v.id);
    const set = new Set(dfSelectedVehicleIds);
    if (allVisibleSelected) {
      // برداشتن تیک همهٔ آیتم‌های قابل‌نمایش
      visibleIds.forEach(id => set.delete(id));
    } else {
      // اضافه‌کردن همهٔ آیتم‌های قابل‌نمایش
      visibleIds.forEach(id => set.add(id));
    }
    setDfSelectedVehicleIds(Array.from(set));
  };

  const toggleOneVehicle = (id: number) => {
    setDfSelectedVehicleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };


  // NEW: حذف مسیر فعلی
  const deleteCurrentRoute = async () => {
    if (!selectedVehicle || !vehicleRoute) return;
    if (!confirm('مسیر حذف شود؟')) return;

    await api.delete(`/routes/${vehicleRoute.id}`);

    // اگر بک‌اند association را حفظ می‌کند، current را هم خالی کن (الگوی موجودِ سرور را بگذار)
    await api.delete(`/vehicles/${selectedVehicle.id}/routes/current`).catch(() => { });
    // یا:
    // await api.put(`/vehicles/${selectedVehicle.id}/routes/current`, { route_id: null }).catch(() => {});

    setVehicleRoute(null);
    setRoutePoints([]);
    routePolylineRef.current = [];
  };

  const routePts = vehicleRoute?.points ?? [];

  // وقتی مسیر عوض شد، فرم رو پر کن

  // بخش ۲ - لیسنر برای گرفتن پیام‌ها (داخل useEffect جدا)
  const handleTripReset = async () => {
    if (!selectedVehicle) return;
    if (liveOdoKm == null) {
      alert('داده‌ی کیلومترشمار در دسترس نیست.');
      return;
    }
    const startedAt = (tripDate || new Date()).toISOString();

    // اگر API داری، این رو ذخیره کن تا پایدار بمونه:
    try {
      await api.post(`/vehicles/${selectedVehicle.id}/trip/start`, {
        base_odometer_km: Number(liveOdoKm),
        started_at: startedAt,
        note: (tripNote || '').trim(),
      }).catch(() => { }); // اختیاری
    } catch { }

    // به‌هرحال، پایه رو همینجا بروز کن (یعنی صفر از الان)
    setTripBaseKm(Number(liveOdoKm));
  };  // به‌روز کردن threshold در ref (NEW)
  const [editingRoute, setEditingRoute] = useState(false);
  const [routeForm, setRouteForm] = useState<{ name: string; threshold_m: number }>({
    name: '',
    threshold_m: 60,
  }); useEffect(() => {
    if (vehicleRoute) {
      setRouteForm({
        name: vehicleRoute.name ?? '',
        threshold_m: vehicleRoute.threshold_m ?? 60,
      });
    } else {
      setRouteForm({ name: '', threshold_m: 60 });
    }
  }, [vehicleRoute?.id]);

  useEffect(() => {
    routeThresholdRef.current = routeThreshold;
  }, [routeThreshold]);

  // به‌روز کردن پلی‌لاین مسیر فعلی در ref (NEW)

  useEffect(() => {
    const pts: RoutePoint[] = (vehicleRoute?.points ?? vehicleRoute?.stations ?? []);
    routePolylineRef.current = pts
      .slice()
      .sort((a: RoutePoint, b: RoutePoint) => (a.order_no ?? 0) - (b.order_no ?? 0))
      .map((p: RoutePoint) => [p.lat, p.lng] as [number, number]);
  }, [
    vehicleRoute?.id,
    vehicleRoute?.points?.length,
    vehicleRoute?.stations?.length,
  ]);
  // هر بار کیلومتر یا لیست عوض شد، چک کن
  useEffect(() => {
    checkConsumableDue();
  }, [checkConsumableDue]);

  // هر ۳۰ ثانیه برای حالت زمانی چک کن
  useEffect(() => {
    const id = setInterval(checkConsumableDue, 30_000);
    return () => clearInterval(id);
  }, [checkConsumableDue]);

  if (permsLoading) {
    return (
      <Box p={2} display="flex" justifyContent="center" alignItems="center">
        <CircularProgress size={24} />
      </Box>
    );
  }
  if (user.role_level === 2 && !can('track_driver') && !can('view_report')) {
    return (
      <Box p={2} color="text.secondary">
        دسترسی فعالی برای نمایش این صفحه برای شما تنظیم نشده است.
      </Box>
    );
  }

  const handleAddStation = async (lat: number, lng: number) => {
    if (!selectedVehicle) return;
    const name = `ایستگاه ${autoIndex}`;
    try {
      const { data: st } = await api.post(`/vehicles/${selectedVehicle.id}/stations`, {
        name,
        lat,
        lng,
        radius_m: stationRadius,
      });
      // یا منتظر پیام سوکت بمون؛ ولی بد نیست خوشبینانه هم اضافه کنیم:
      setVehicleStations(prev => (st ? [...prev, st] : prev));
      setAutoIndex(i => i + 1);
    } catch (e) {
      console.error('[handleAddStation] error:', e);
    }
  };


  const onPickVehicle = async (v: Vehicle) => {
    const sock = socketRef.current;         // 👈 فقط یک نام
    const sPrev = sock;

    // 0) خروج از تاپیک‌های ماشین قبلی (فقط تله‌متری‌های غیرِ GPS)
    if (sPrev && lastSubRef.current) {
      const { vid: prevVid, keys } = lastSubRef.current;
      keys.forEach((k) => {
        // این‌ها gps نیستند؛ مستقیم /{key} آنسابسکرایب می‌کنیم
        sPrev.emit('unsubscribe', { topic: `vehicle/${prevVid}/${k}` });
      });
      lastSubRef.current = null;
    }
    // 0.a) آن‌سابسکرایب stations ماشین قبلی
    if (sPrev && lastStationsSubRef.current) {
      const { vid: prevVid, uid } = lastStationsSubRef.current;
      sPrev.emit('unsubscribe', { topic: `vehicle/${prevVid}/stations/${uid}` });
      lastStationsSubRef.current = null;
    }
    // قبل از انتخاب ماشین جدید:
    if (sPrev && lastViolSubRef.current) {
      const { vid: prevVid, uid } = lastViolSubRef.current;
      sPrev.emit('unsubscribe', { topic: `vehicle/${prevVid}/violations/${uid}` });
      lastViolSubRef.current = null;
    }

    // بعد از setSelectedVehicle(v) و وقتی socketRef.current موجود است:
    if (sock) {
      sock.emit('subscribe', { topic: `vehicle/${v.id}/violations/${user.id}` });
      lastViolSubRef.current = { vid: v.id, uid: user.id };
    }

    // 1) انتخاب ماشین + ریست UI
    setSelectedVehicle(v);
    setSelectedDriver(null);
    setVehicleLiveAllowed(false);
    setVehicleOptions([]);
    setVehicleStations([]);
    setVehicleRoute(null);
    //setConsumables([]);
    setConsumablesStatus('loading');
    setVehicleTlm({});
    setAddingStations(false);  // ✅
    setTempStation(null);      // ✅
    setEditing(null);
    setMovingStationId(null);

    if (v.last_location) setFocusLatLng([v.last_location.lat, v.last_location.lng]);
    setPolyline([]);

    // 2) تاریخچه مسیر
    await loadVehicleTrack(v.id);

    // 3) ضد race + لودینگ
    const reqId = Date.now();
    lastOptsReqRef.current = reqId;
    setVehicleOptionsLoading(true);
    loadCurrentRoute(v.id);

    try {
      const vid = v.id;

      // 4) خواندن گزینه‌ها (per-vehicle → policy fallback)
      const perVehicle = await api.get(`/vehicles/${vid}/options`).catch(() => ({ data: null }));
      let optsRaw: unknown[] = Array.isArray(perVehicle?.data?.options) ? perVehicle!.data.options : [];

      if (!optsRaw.length) {
        const { data: policies } = await api
          .get(`/vehicle-policies/user/${v.owner_user_id}`)
          .catch(() => ({ data: [] }));
        const pol = (policies || []).find((p: any) => p?.vehicle_type_code === v.vehicle_type_code);
        optsRaw = Array.isArray(pol?.monitor_params) ? pol.monitor_params : [];
      }

      // 5) فیلتر به کلیدهای معتبر
      const valid = new Set<MonitorKey>(MONITOR_PARAMS.map(m => m.key));
      const raw = (optsRaw as string[]).map(s => s?.toString().trim().toLowerCase());
      const opts: MonitorKey[] = Array.from(new Set(raw))
        .filter((k): k is MonitorKey => valid.has(k as MonitorKey));

      // اگر وسط کار انتخاب ماشین عوض شد
      if (lastOptsReqRef.current !== reqId) return;

      // 6) لود منابع فقط وقتی تیک خورده
      if (opts.includes('stations')) {
        const { data } = await api.get(`/vehicles/${vid}/stations`).catch(() => ({ data: [] }));
        setVehicleStations(Array.isArray(data) ? data : []);
      } else {
        setVehicleStations([]);
      }
      if (opts.includes('geo_fence')) {
        await loadVehicleGeofence(v.id);
      } else {
        setGeofence(null);
        setGfDrawing(false); setGfCenter(null); setGfPoly([]);
      }
      if (opts.includes('routes')) {
        const cur = await api.get(`/vehicles/${vid}/routes/current`).catch(() => ({ data: null }));
        const rid = cur?.data?.route_id;
        if (rid) {
          const rs = await fetchRouteStations(rid);
          setVehicleRoute({
            id: rid,
            name: cur?.data?.name ?? 'مسیر',
            threshold_m: cur?.data?.threshold_m ?? 60,
            points: rs,
          });
          setRouteThreshold(cur?.data?.threshold_m ?? 60);
        } else {
          setVehicleRoute(null);
        }

      }

      // --- Consumables (لوازم مصرفی) ---
      // لوازم مصرفی را بگیر
      // --- Consumables (لوازم مصرفی) ---
      if (opts.includes('consumables')) {
        // اول اسنپ‌شات لوکال رو نشون بده
        const localSnap = loadConsumablesFromStorage(vid);
        if (localSnap.length) {
          setConsumables(localSnap);
          setConsumablesStatus('loaded'); // فوراً لیست رو نشون بده
        } else {
          setConsumables([]); // خالی ولی آماده
          setConsumablesStatus('loading');
        }
        // بعد از سرور رفرش و با لوکال merge می‌کنیم
        refreshConsumables(vid);
      } else {
        setConsumables([]);
        setConsumablesStatus('loaded');
      }




      // --- Telemetry اولیه (ignition / idle_time / odometer) ---
      let latestOdo: number | undefined = undefined;

      /*if (opts.some(k => k === 'ignition' || k === 'idle_time' || k === 'odometer')) {
        try {
          const { data } = await api.get(`/vehicles/${vid}/telemetry`, {
            params: { keys: ['ignition', 'idle_time', 'odometer'] },
          });

          latestOdo = (typeof data?.odometer === 'number') ? data.odometer : undefined;

          setVehicleTlm({
            ignition: typeof data?.ignition === 'boolean' ? data.ignition : undefined,
            idle_time: typeof data?.idle_time === 'number' ? data.idle_time : undefined,
            odometer: latestOdo,
          });
        } catch {
          setVehicleTlm({});
        }
      } else {
        setVehicleTlm({});
      }
*/
      // --- subscribe تله‌متری‌های غیر GPS روی سوکت (pos جداگانه مدیریت می‌شود) ---
      if (sock) {
        const telemKeys = (['ignition', 'idle_time', 'odometer'] as MonitorKey[])
          .filter(k => opts.includes(k));

        // آن‌سابسکرایب از قبلی‌ها (اگر لازم است؛ معمولاً بالاتر انجامش داده‌ای)
        // if (lastSubRef.current) {
        //   const { vid: prevVid, keys } = lastSubRef.current;
        //   keys.forEach(k => s.emit('unsubscribe', { topic: `vehicle/${prevVid}/${k}` }));
        // }

        telemKeys.forEach(k => {
          sock.emit('subscribe', { topic: `vehicle/${vid}/${k}` }); // ✅ ignition/idle_time/odometer
        });

        lastSubRef.current = { vid, keys: telemKeys };
      }


      // 6.1) تله‌متری اولیه
      if (opts.some(k => k === 'ignition' || k === 'idle_time' || k === 'odometer')) {
        try {
          const { data } = await api.get(`/vehicles/${vid}/telemetry`, {
            params: { keys: ['ignition', 'idle_time', 'odometer'] },
          });
          setVehicleTlm({
            ignition: data?.ignition ?? undefined,
            idle_time: data?.idle_time ?? undefined,
            odometer: data?.odometer ?? undefined,
          });
        } catch {
          setVehicleTlm({});
        }
      } else {
        setVehicleTlm({});
      }

      // 7) هندلرها (بدون subscribe به pos در این تابع)
      runVehicleOptionHandlers(v, opts, {
        userId: user.id,
        fromISO,
        toISO,
        api,
        socket: socketRef.current,
      });

      // 8) اعمال در state اصلی
      setVehicleOptions(opts);
      setVehicleLiveAllowed(opts.includes('gps')); // فقط برای نمایش Badge

      // 9) subscribe فقط برای تله‌متری‌های غیرِ GPS (pos برای همه در useEffect جدا سابسکرایب می‌شود)
      //const sock = socketRef.current;
      if (sock) {
        const telemKeys = (['ignition', 'idle_time', 'odometer'] as MonitorKey[])
          .filter(k => opts.includes(k));
        telemKeys.forEach(k => {
          sock.emit('subscribe', { topic: `vehicle/${vid}/${k}` });
        });
        lastSubRef.current = { vid, keys: telemKeys };
      }

      /* === 9.1) سابسکرایب ایستگاه‌ها فقط برای همین سوپرادمین === */
      if (sock && opts.includes('stations')) {
        sock.emit('subscribe', { topic: `vehicle/${vid}/stations/${user.id}` });
        lastStationsSubRef.current = { vid, uid: user.id };
      }

      // 10) هم‌سان‌سازی با راننده فعلی (اختیاری)
      if (v.current_driver_user_id && opts.length) {
        await api.post(`/drivers/${v.current_driver_user_id}/assign-options`, { options: opts }).catch(() => { });
      }

    } catch (e) {
      console.error('[onPickVehicle] error:', e);
    } finally {
      if (lastOptsReqRef.current === reqId) setVehicleOptionsLoading(false);
    }
  };
  // NEW: حالت ادیت متادیتای مسیر

  // NEW: ذخیره متادیتای مسیر (نام و threshold)
  const saveRouteMeta = async () => {
    if (!vehicleRoute) return;
    try {
      await api.put(`/routes/${vehicleRoute.id}`, {
        name: routeForm.name?.trim(),
        threshold_m: Math.max(1, Math.trunc(routeForm.threshold_m || 60)),
      });
      // آپدیت محلی
      setVehicleRoute(prev => prev ? {
        ...prev,
        name: routeForm.name?.trim(),
        threshold_m: Math.max(1, Math.trunc(routeForm.threshold_m || 60)),
      } : prev);
      setRouteThreshold(Math.max(1, Math.trunc(routeForm.threshold_m || 60)));
      setEditingRoute(false);
    } catch (e) {
      console.error(e);
      alert('ویرایش مسیر ناموفق بود');
    }
  };

  // NEW: جایگزینی نقاط مسیر فعلی با نقاط انتخاب‌شده روی نقشه
  const replaceRouteStationsUI = async () => {
    if (!selectedVehicle || !vehicleRoute) return;
    if (routePoints.length < 2) { alert('حداقل دو نقطه لازم است.'); return; }

    const points = routePoints.map((p, i) => ({ lat: p.lat, lng: p.lng, order_no: i + 1 }));

    // اگر سرورت wrapper می‌خواهد: { points }
    await api.put(`/routes/${vehicleRoute.id}/points`, points).catch(async () => {
      await api.put(`/routes/${vehicleRoute.id}/points`, { points }).catch(() => { throw new Error(); });
    });

    await loadCurrentRoute(selectedVehicle.id);
    setDrawingRoute(false);
    setRoutePoints([]);
  };
  // هدف اعمال: فقط همین ماشین، یا انتخاب دستی از لیست



  async function handleApplyDefaults() {
    if (!user?.id) return;
    const geofence = buildDfGeofence();
    if (!dfStations.length && !geofence) { alert('هیچ آیتمی برای اعمال تنظیم نشده.'); return; }

    const profile = {
      stations: dfStations.length ? dfStations : undefined,
      geofence: geofence ?? undefined,
    };

    const targetVids: number[] =
      dfTarget === 'currentVehicle'
        ? (selectedVehicle ? [selectedVehicle.id] : [])
        : (selectedSAId
          ? (selectedVehicleIds.size
            ? Array.from(selectedVehicleIds)
            : (vehiclesBySA[selectedSAId] || []).map(v => v.id)) // فالبک: همه
          : []);

    if (!targetVids.length) { alert('ماشینی برای اعمال تنظیمات پیدا نشد.'); return; }

    setDfApplying(true);
    setDfApplyLog([]);
    try {
      const logs: string[] = [];
      for (const vid of targetVids) {
        try {
          const res = await applyVehicleProfile(api, vid, profile, user.id, user.role_level as any, { stationsMode: 'replace' });
          logs.push(`✅ VID ${vid}: ${JSON.stringify(res.applied || {})}`);
        } catch (e: any) {
          logs.push(`❌ VID ${vid}: ${e?.response?.data?.message || e?.message || 'خطا'}`);
        }
        setDfApplyLog([...logs]);
      }
    } finally {
      setDfApplying(false);
    }
  }






  async function applyVehicleProfile(api: any, vid: number, profile: VehicleProfile, actorId: number, roleLevel: number) {
    const opts = await getVehicleOptions(vid);

    // --- Stations ---
    if (profile.stations !== undefined && opts.includes('stations')) {
      if (!profile.stations || profile.stations.length === 0) {
        // پاک‌کردن همهٔ ایستگاه‌ها
        const { data: cur } = await api.get(`/vehicles/${vid}/stations`).catch(() => ({ data: [] }));
        if (Array.isArray(cur)) {
          await Promise.all(cur.map((s: any) =>
            api.delete(`/vehicles/${vid}/stations/${s.id}`).catch(() => { })
          ));
        }
      } else {
        // جایگزینی کامل
        try {
          await api.put(`/vehicles/${vid}/stations`, profile.stations);
        } catch {
          const { data: cur } = await api.get(`/vehicles/${vid}/stations`).catch(() => ({ data: [] }));
          if (Array.isArray(cur)) {
            await Promise.all(cur.map((s: any) =>
              api.delete(`/vehicles/${vid}/stations/${s.id}`).catch(() => { })
            ));
          }
          for (const st of profile.stations) {
            await api.post(`/vehicles/${vid}/stations`, st).catch(() => { });
          }
        }
      }
    }

    // --- Geofence ---
    if (profile.geofence !== undefined && opts.includes('geo_fence')) {
      if (!profile.geofence) {
        // حذف ژئوفنس
        await api.delete(`/vehicles/${vid}/geofence`).catch(() => { });
      } else {
        // جایگزینی کامل: اول حذف، بعد ست
        await api.delete(`/vehicles/${vid}/geofence`).catch(() => { });
        if (profile.geofence.type === 'circle') {
          const g = profile.geofence;
          const payload = {
            type: 'circle',
            centerLat: g.center.lat,
            centerLng: g.center.lng,
            radiusM: g.radius_m,
            toleranceM: g.tolerance_m ?? 0,
          };
          await api.put(`/vehicles/${vid}/geofence`, payload).catch(() =>
            api.post(`/vehicles/${vid}/geofence`, payload)
          );
        } else {
          const g = profile.geofence;
          const payload = {
            type: 'polygon',
            polygonPoints: g.points.map(p => ({ lat: p.lat, lng: p.lng })),
            toleranceM: g.tolerance_m ?? 0,
          };
          await api.put(`/vehicles/${vid}/geofence`, payload).catch(() =>
            api.post(`/vehicles/${vid}/geofence`, payload)
          );
        }
      }
    }

    // (اختیاری) اگر می‌خواهی ویژگی‌هایی که آن ماشین ندارد بی‌صدا رد شوند،
    // کافیست branches بالا را فقط وقتی opts.includes(...) بود اجرا کنی (که همین‌طور است).
  }



  // === Helper: بیضیِ تقریبی برحسب متر دور یک نقطه‌ی lat/lng ===
  type LatLng = { lat: number; lng: number };

  function ellipsePolygonPoints(
    center: LatLng,
    rx_m: number,        // شعاع افقی بیضی بر حسب متر
    ry_m: number,        // شعاع عمودی بیضی بر حسب متر
    rot_deg = 0,         // زاویه دوران بیضی (درجه)
    segments = 36        // تعداد رئوس چندضلعی
  ): LatLng[] {
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return [];
    const R = 6378137; // شعاع زمین (WGS84) بر حسب متر
    const toRad = (d: number) => d * Math.PI / 180;
    const toDeg = (r: number) => r * 180 / Math.PI;
    const phi = toRad(rot_deg);
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const lat0 = center.lat;

    const out: LatLng[] = [];
    const n = Math.max(3, Math.floor(segments)); // حداقل مثلث
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 2 * Math.PI;
      // بیضی بدون دوران
      const x = rx_m * Math.cos(t);   // محور شرق-غرب (متر)
      const y = ry_m * Math.sin(t);   // محور شمال-جنوب (متر)
      // دوران در صفحه محلی
      const xr = x * cosPhi - y * sinPhi;
      const yr = x * sinPhi + y * cosPhi;
      // تبدیل متر ← درجه (با تقریب equirectangular)
      const dLat = yr / R;
      const dLng = xr / (R * Math.cos(toRad(lat0)));
      out.push({
        lat: center.lat + toDeg(dLat),
        lng: center.lng + toDeg(dLng),
      });
    }
    return out;
  }

  // === پیش‌فرض‌های ظاهری برای بیضی دور نقاط مسیر ===
  const ELLIPSE_RX_M = 18;   // شعاع افقی (متر)
  const ELLIPSE_RY_M = 10;   // شعاع عمودی (متر)
  const ELLIPSE_ROT_DEG = 0; // دوران (درجه)
  const ELLIPSE_SEGMENTS = 48;



  // XY ← lat/lng  (محلیِ equirectangular برحسب متر با مبدا ثابت)
  function toXY(lat: number, lng: number, lat0: number, lng0: number): [number, number] {
    const R = 6371000;
    const dLat = (lat - lat0) * Math.PI / 180;
    const dLng = (lng - lng0) * Math.PI / 180;
    const x = dLng * Math.cos((lat0 * Math.PI) / 180) * R;
    const y = dLat * R;
    return [x, y];
  }
  // lat/lng ← XY
  function toLL(x: number, y: number, lat0: number, lng0: number) {
    const R = 6371000, toDeg = (r: number) => (r * 180) / Math.PI;
    return {
      lat: lat0 + toDeg(y / R),
      lng: lng0 + toDeg(x / (R * Math.cos((lat0 * Math.PI) / 180))),
    };
  }
  // برخورد دو خط p + t*r  و  q + u*s  (در XY)
  function lineIntersect(
    p: [number, number], r: [number, number],
    q: [number, number], s: [number, number]
  ): [number, number] | null {
    const [rx, ry] = r, [sx, sy] = s;
    const det = rx * sy - ry * sx;
    if (Math.abs(det) < 1e-9) return null; // تقریباً موازی
    const [px, py] = p, [qx, qy] = q;
    const t = ((qx - px) * sy - (qy - py) * sx) / det;
    return [px + t * rx, py + t * ry];
  }

  /** یک پولیگونِ پیوسته (buffer) دور کل مسیر می‌سازد */
  function buildRouteBufferPolygon(
    pts: { lat: number; lng: number }[],
    radius_m: number
  ): { lat: number; lng: number }[] {
    if (!pts || pts.length < 2) return [];
    const lat0 = pts[0].lat, lng0 = pts[0].lng;

    // مسیر در XY
    const P = pts.map(p => toXY(p.lat, p.lng, lat0, lng0));

    const L = P.length;
    const left: [number, number][] = [];
    const right: [number, number][] = [];

    // جهت و نرمال هر سگمنت
    const dir: [number, number][] = [];
    const nor: [number, number][] = [];
    for (let i = 0; i < L - 1; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[i + 1];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1e-9;
      const ux = dx / len, uy = dy / len;
      dir.push([ux, uy]);
      nor.push([-uy, ux]); // عمود به چپ
    }

    // شروع (کَپ تخت)
    {
      const [x, y] = P[0], [nx, ny] = nor[0];
      left.push([x + nx * radius_m, y + ny * radius_m]);
      right.push([x - nx * radius_m, y - ny * radius_m]);
    }

    // گره‌های میانی: اتصال مِیتر با برخورد خطوط آفست‌شده
    for (let i = 1; i < L - 1; i++) {
      const Pi = P[i];

      const uPrev = dir[i - 1], nPrev = nor[i - 1];
      const uNext = dir[i], nNext = nor[i];

      // خطِ آفستِ سمت چپِ دو سگمنت
      const a1: [number, number] = [Pi[0] + nPrev[0] * radius_m, Pi[1] + nPrev[1] * radius_m];
      const r1: [number, number] = uPrev;
      const a2: [number, number] = [Pi[0] + nNext[0] * radius_m, Pi[1] + nNext[1] * radius_m];
      const r2: [number, number] = uNext;

      let Lp = lineIntersect(a1, r1, a2, r2);
      // موازی/خیلی تیز؟ → بیول (bevel)
      if (!Lp) Lp = a2;
      left.push(Lp);

      // سمت راست
      const b1: [number, number] = [Pi[0] - nPrev[0] * radius_m, Pi[1] - nPrev[1] * radius_m];
      const b2: [number, number] = [Pi[0] - nNext[0] * radius_m, Pi[1] - nNext[1] * radius_m];
      let Rp = lineIntersect(b1, r1, b2, r2);
      if (!Rp) Rp = b2;
      right.push(Rp);
    }

    // پایان (کَپ تخت)
    {
      const [x, y] = P[L - 1], [nx, ny] = nor[nor.length - 1];
      left.push([x + nx * radius_m, y + ny * radius_m]);
      right.push([x - nx * radius_m, y - ny * radius_m]);
    }

    // حلقه‌ی نهایی: چپ به ترتیب + راست از انتها به ابتدا
    const ringXY = [...left, ...right.reverse()];
    return ringXY.map(([x, y]) => toLL(x, y, lat0, lng0));
  }








  return (
    <Grid2 container spacing={2} dir="ltr">
      {/* نقشه */}
      {can('track_driver') && (
        <Grid2 xs={12} md={8}>
          <Paper sx={{ height: '75vh', overflow: 'hidden' }} dir="rtl">
            <MapContainer
              zoom={INITIAL_ZOOM}
              minZoom={MIN_ZOOM}
              //maxZoom={MAX_ZOOM}
              style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }} // ⬅️ پایین
            >
              <InitView center={INITIAL_CENTER} zoom={INITIAL_ZOOM} />
              <TileLayer
                url={tileUrl}
                {...({ attribution: '&copy; OpenStreetMap | © MapTiler' } as any)}
              />
              <FocusOn target={focusLatLng} />
              {tab === 'vehicles' &&
                selectedVehicle &&
                vehicleOptions.includes('geo_fence') && (
                  <PickPointsForGeofence
                    enabled={gfDrawing}
                    onPick={(lat, lng) => {
                      if (gfMode === 'circle') {
                        setGfCenter({ lat, lng });
                      } else {
                        setGfPoly((prev) => [...prev, { lat, lng }]);
                      }
                    }}
                  />
                )}
              {tab === 'vehicles' &&
                selectedVehicle &&
                vehicleOptions.includes('routes') && (
                  <PickPointsForRoute
                    enabled={drawingRoute}
                    onPick={(lat, lng) => setRoutePoints((prev) => [...prev, { lat, lng }])}
                  />
                )}
              {/* پیش‌نمایش کریدورِ مسیر هنگام ترسیم */}
              {drawingRoute && routePoints.length > 1 && (
                <Polygon
                  positions={buildRouteBufferPolygon(routePoints, Math.max(1, routeThreshold || 100))}
                  pathOptions={{ color: MAP_COLORS.corridor, weight: 1, fillOpacity: 0.15 }}
                />
              )}

              {/* پیش‌نمایش کریدورِ مسیر هنگام ترسیم */}
              {drawingRoute && routePoints.length > 1 &&
                routePoints.slice(1).map((_, idx) => {
                  const a = routePoints[idx];
                  const b = routePoints[idx + 1];
                  // عرض کریدور: از routeThreshold (مثلاً 100m) استفاده کن
                  const ring = corridorRectForSegment(a, b, Math.max(1, routeThreshold || 100));
                  return (
                    <Polygon
                      key={`route-corr-prev-${idx}`}
                      positions={ring.map(pt => [pt.lat, pt.lng] as [number, number])}
                      pathOptions={{ weight: 1, fillOpacity: 0.15 }}
                    />
                  );
                })
              }

              {/* پیش‌نمایش ژئوفنس در حال ترسیم */}
              {gfDrawing && gfMode === 'circle' && gfCenter && (
                <Circle center={[gfCenter.lat, gfCenter.lng]} radius={gfRadius}
                  pathOptions={{ color: MAP_COLORS.geofence, weight: 2, fillColor: MAP_COLORS.geofenceFill, fillOpacity: 0.2 }} />
              )}
              {gfDrawing && gfMode === 'polygon' && gfPoly.length >= 2 && (
                <Polygon positions={gfPoly.map(p => [p.lat, p.lng] as [number, number])}
                  pathOptions={{ color: MAP_COLORS.geofence, weight: 2, dashArray: '6 6', fillColor: MAP_COLORS.geofenceFill, fillOpacity: 0.15 }} />
              )}
              {/* مسیر جاری (از سرور) */}
              {(() => {
                const pts = (vehicleRoute?.points ?? vehicleRoute?.stations ?? [])
                  .slice()
                  .sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0))
                  .map(p => ({ lat: p.lat, lng: p.lng }));

                if (pts.length < 2) return null;

                const threshold = vehicleRoute?.threshold_m ?? routeThreshold ?? 60;

                return (
                  <>
                    {/* خود خط مسیر */}
                    <Polyline positions={pts.map(p => [p.lat, p.lng] as [number, number])} />
                    {/* کریدورِ پیوسته دور مسیر */}
                    <Polygon
                      positions={buildRouteBufferPolygon(pts, Math.max(1, threshold))
                        .map(p => [p.lat, p.lng] as [number, number])}
                      pathOptions={{ weight: 1, fillOpacity: 0.15 }}
                    />
                  </>
                );
              })()}




              {/* کلیک روی نقشه برای افزودن ایستگاه (فقط تب vehicles + ماشین انتخاب شده + تیک stations + مجوز) */}
              {tab === 'vehicles' &&
                selectedVehicle &&
                vehicleOptions.includes('stations') && (
                  <PickPointsForStations
                    enabled={addingStations && showStationActions}
                    onPick={(lat, lng) => setTempStation({ lat, lng })}
                  />
                )}

              {/* مارکرهای راننده/ماشین */}
              {tab === 'drivers'
                ? filteredDrivers.map(
                  (d) =>
                    (d as any).last_location && (
                      <Marker
                        key={`d-${d.id}`}
                        position={[
                          (d as any).last_location.lat,
                          (d as any).last_location.lng,
                        ]}
                        icon={driverMarkerIcon}
                      >
                        <Popup>
                          <strong>{d.full_name}</strong>
                          <br />
                          {d.phone || '—'}
                        </Popup>
                      </Marker>
                    )
                )
                : filteredVehicles.map(
                  (v) =>
                    v.last_location && (
                      <Marker
                        key={`v-${v.id}`}
                        position={[v.last_location.lat, v.last_location.lng]}
                        icon={vehicleMarkerIcon}
                      >
                        <Popup>
                          <strong>{v.plate_no}</strong>
                          <br />
                          {v.vehicle_type_code}
                        </Popup>
                      </Marker>
                    )
                )}
              {selectedViolation?.meta?.point && (
                <>
                  <Circle
                    center={[selectedViolation.meta.point.lat, selectedViolation.meta.point.lng]}
                    radius={Number(selectedViolation.meta.threshold_m ?? selectedViolation.meta.radius_m ?? selectedViolation.meta.tolerance_m ?? 30)}
                    pathOptions={{ color: MAP_COLORS.violation, weight: 1, fillOpacity: 0.1 }}
                  />

                  <Marker position={[selectedViolation.meta.point.lat, selectedViolation.meta.point.lng]}>
                    <Popup>
                      <div style={{ minWidth: 200 }}>
                        <b>تخلف: {selectedViolation.type}</b><br />
                        {new Date(selectedViolation.created_at).toLocaleString('fa-IR')}
                        {selectedViolation.meta?.distance_m != null && (
                          <>
                            <br />فاصله از حد: {Number(selectedViolation.meta.distance_m).toLocaleString('fa-IR')} m
                          </>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                </>
              )}
              {/* مسیر کامل راننده – همیشه */}
              {tab === 'drivers' && driverTrackPts.length > 1 && (
                <Polyline
                  positions={driverTrackPts}
                  pathOptions={{ weight: 3, opacity: 0.75 }}
                />
              )}

              {/* مسیر تب راننده با انیمیشن */}
              {tab === 'drivers' && animatedDriver.length > 1 && (
                <>
                  <Polyline
                    positions={animatedDriver}
                    pathOptions={{
                      color: MAP_COLORS.track,
                      weight: 4,
                      dashArray: '8 6',
                      lineCap: 'round', lineJoin: 'round',
                    }}
                  />
                  {/* سرِ مسیر (هد) */}
                </>
              )}
              {/* مسیر کامل ماشین – همیشه */}
              {tab === 'vehicles' && vehicleTrackPts.length > 1 && (
                <Polyline
                  positions={vehicleTrackPts}
                  pathOptions={{ weight: 3, opacity: 0.75 }}
                />
              )}

              {/* مسیر تب ماشین با انیمیشن */}
              {tab === 'vehicles' && animatedVehicle.length > 1 && (
                <>
                  <Polyline
                    positions={animatedVehicle}
                    pathOptions={{
                      color: MAP_COLORS.track,
                      weight: 4,
                      dashArray: '8 6',
                      lineCap: 'round', lineJoin: 'round',
                    }}
                  />
                </>
              )}


              {/* --- ویرایش ایستگاه: نمایش مارکر قابل‌جابجایی --- */}
              {editing && movingStationId === editing.id && (
                <>
                  <Circle center={[editing.lat, editing.lng]} radius={editing.radius_m} />
                  <Marker
                    position={[editing.lat, editing.lng]}
                    draggable
                    eventHandlers={{
                      dragend: (e: any) => {
                        const ll = e.target.getLatLng();
                        setEditing(ed => ed ? { ...ed, lat: ll.lat, lng: ll.lng } : ed);
                      },
                    }}
                  />
                </>
              )}

              {addingStations && showStationActions && tempStation && (
                <>
                  <Circle center={[tempStation.lat, tempStation.lng]}
                    radius={stationRadius} />
                  <Marker
                    position={[tempStation.lat, tempStation.lng]}
                    draggable
                    eventHandlers={{
                      add: (e: any) => e.target.openPopup(), // 👈 پاپ‌آپ را خودکار باز کن
                      dragend: (e: any) => {
                        const ll = e.target.getLatLng();
                        setTempStation({ lat: ll.lat, lng: ll.lng });
                      },
                    }}
                  >
                    <Popup autoClose={false} closeOnClick={false} autoPan>
                      <div style={{ minWidth: 220 }}>
                        <strong>ایجاد ایستگاه</strong>
                        <div style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>
                          می‌توانید مارکر را جابه‌جا کنید.
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <input
                            style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
                            placeholder="نام ایستگاه"
                            value={tempName}
                            onChange={e => setTempName(e.target.value)}
                          />
                        </div>
                        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                          <button onClick={confirmTempStation}>تایید</button>
                          <button onClick={cancelTempStation}>لغو</button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                </>
              )}

              {/* ایستگاه‌های ماشین انتخاب‌شده (دایره + مارکر) */}
              {tab === 'vehicles' &&
                selectedVehicle &&
                vehicleOptions.includes('stations') &&
                vehicleStations.map((st) => (
                  <React.Fragment key={st.id}>
                    <Circle center={[st.lat, st.lng]} radius={st.radius_m ?? stationRadius} />
                    <Marker position={[st.lat, st.lng]}>
                      <Popup>
                        <strong>{st.name}</strong>
                        <br />
                        {st.lat.toFixed(5)}, {st.lng.toFixed(5)}
                        <br />
                        شعاع: {st.radius_m ?? stationRadius} m
                      </Popup>
                    </Marker>
                  </React.Fragment>
                ))}
              {/* ژئوفنس ذخیره‌شده‌ی سرور */}
              {!gfDrawing && geofence?.type === 'circle' && (
                <Circle center={[geofence.center.lat, geofence.center.lng]} radius={geofence.radius_m}
                  pathOptions={{ color: MAP_COLORS.geofence, weight: 2, fillColor: MAP_COLORS.geofenceFill, fillOpacity: 0.12 }} />
              )}
              {!gfDrawing && geofence?.type === 'polygon' && (
                <Polygon
                  positions={geofence.points.map(p => [p.lat, p.lng] as [number, number])}
                  pathOptions={{
                    color: MAP_COLORS.geofence,  // رنگ خط مرز
                    weight: 2,
                    fill: true,                  // ✨ اجباری کن که پر شود
                    fillColor: MAP_COLORS.geofenceFill,
                    fillOpacity: 0.35,           // کمی پررنگ‌تر از قبل
                  }}
                />
              )}



            </MapContainer>

            {/* 🎯 کنترل‌های شناور کنار پایین نقشه */}
            {(tab === 'drivers' ? driverTrackPts.length > 1 : vehicleTrackPts.length > 1) && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,         // اگر می‌خوای راست باشه بذار right: 12
                  display: 'flex',
                  gap: 1,
                  zIndex: 1000,
                  bgcolor: 'background.paper',
                  p: 0.5,
                  borderRadius: 3,
                  boxShadow: 3,
                  border: theme => `1px solid ${theme.palette.divider}`
                }}
              >
                <Tooltip title="پخش از ابتدا">
                  <IconButton size="small" onClick={handlePlayFromStart}>
                    <ReplayIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Tooltip title="توقف">
                  <IconButton size="small" onClick={handleStop}>
                    <StopIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {/* Speed */}
                <Divider flexItem orientation="vertical" />
               <ButtonGroup size="small" variant="outlined">
  {([1, 2, 3] as const).map(sp => (
    <Button
      key={sp}
      variant={(tab === 'drivers' ? driverSpeed : vehSpeed) === sp ? 'contained' : 'outlined'}
      onClick={() => {
        if (tab === 'drivers') setDriverSpeed(sp);
        else setVehSpeed(sp);
      }}
    >
      {sp}×
    </Button>
  ))}
</ButtonGroup>


              </Box>
            )}
          </Paper>
        </Grid2>
      )}

      {/* لیست‌ها + تب‌ها */}
      {can('track_driver') && (
        <Grid2 xs={12} md={4}>
          <Paper
            sx={{ p: 2, height: '75vh', display: 'flex', flexDirection: 'column' }}
            dir="rtl"
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="h6">
                {tab === 'drivers'
                  ? `راننده‌ها (${drivers.length})`
                  : `ماشین‌ها (${vehicles.length})`}
              </Typography>

            </Stack>

            <Tabs
              value={tab}
              onChange={(_, v) => {
                setTab(v);
                setQ('');
                setSelectedDriver(null);
                setSelectedVehicle(null);
                setPolyline([]);
                setVehicleOptions([]);
                setVehicleLiveAllowed(false);
                setAddingStations(false);      // ✅
                setTempStation(null);
                setEditing(null);
                setMovingStationId(null);         // ✅
                setShowDriverAnim(false); resetDriverAnim();
                setShowVehAnim(false); resetVehAnim();
              }}
              sx={{ mb: 1 }}
            >
              <Tab value="drivers" label="راننده‌ها" />
              <Tab value="vehicles" label="ماشین‌ها" />
            </Tabs>

            <TextField
              size="small"
              placeholder={tab === 'drivers' ? 'جستجو نام/موبایل' : 'جستجو پلاک/نوع'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 1 }}
            />

            {loading ? (
              <Box flex={1} display="flex" alignItems="center" justifyContent="center">
                <CircularProgress size={24} />
              </Box>
            ) : (
              <List sx={{ overflow: 'auto', flex: 1 }}>
                {tab === 'drivers' ? (
                  filteredDrivers.length === 0 ? (
                    <Typography color="text.secondary" sx={{ p: 1 }}>
                      نتیجه‌ای یافت نشد.
                    </Typography>
                  ) : (
                    filteredDrivers.map((d) => (
                      <ListItem
                        key={d.id}
                        divider
                        button
                        onClick={() => onPickDriver(d)}
                      >
                        <Stack
                          direction="row"
                          spacing={2}
                          alignItems="center"
                          sx={{ width: '100%' }}
                        >
                          <Avatar>{d.full_name?.charAt(0) ?? 'ر'}</Avatar>
                          <Box sx={{ flex: 1 }}>
                            <ListItemText
                              primary={d.full_name}
                              secondary={
                                d.phone ||
                                ((d as any).last_location
                                  ? `${(d as any).last_location.lat.toFixed(3)}, ${(d as any).last_location.lng.toFixed(3)}`
                                  : '—')
                              }
                            />
                          </Box>
                          <Button
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPickDriver(d);
                            }}
                          >
                            مسیر
                          </Button>
                        </Stack>
                      </ListItem>
                    ))
                  )
                ) : filteredVehicles.length === 0 ? (
                  <Typography color="text.secondary" sx={{ p: 1 }}>
                    ماشینی یافت نشد.
                  </Typography>
                ) : (
                  filteredVehicles.map((v) => (
                    <ListItem
                      key={v.id}
                      divider
                      button
                      onClick={() => onPickVehicle(v)}
                    >
                      <Stack
                        direction="row"
                        spacing={2}
                        alignItems="center"
                        sx={{ width: '100%' }}
                      >
                        <Avatar>{v.plate_no?.charAt(0) ?? 'م'}</Avatar>
                        <Box sx={{ flex: 1 }}>
                          <ListItemText primary={v.plate_no} secondary={v.vehicle_type_code} />
                        </Box>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPickVehicle(v);
                          }}
                        >
                          مسیر
                        </Button>
                      </Stack>
                    </ListItem>
                  ))
                )}
              </List>
            )}
          </Paper>
        </Grid2>
      )}

      {/* فیلتر زمانی + KPI و همچنین امکانات ماشین (مشروط به تیک) */}
      {can('view_report') && (
        <Grid2 xs={12}>
          <Paper sx={{ p: 2 }} dir="rtl">
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              gap={2}
            >
              <Typography variant="h6">
                {tab === 'drivers'
                  ? selectedDriver
                    ? `راننده: ${selectedDriver.full_name}`
                    : '—'
                  : selectedVehicle
                    ? `ماشین: ${selectedVehicle.plate_no}`
                    : '—'}
              </Typography>


            </Stack>

            {/* امکانات ماشین (فقط تبِ ماشین و وقتی انتخاب شده) */}
            {tab === 'vehicles' && selectedVehicle && (
              <Box sx={{ mt: 1.5 }}>
                <FeatureCards enabled={vehicleOptions} telemetry={vehicleTlm} />




                {vehicleOptionsLoading ? (
                  <Box display="flex" alignItems="center" gap={1} color="text.secondary">
                    <CircularProgress size={16} /> در حال خواندن تنظیمات…
                  </Box>
                ) : vehicleOptions.length > 0 ? (
                  <>


                    {addingStations && showStationActions && (
                      <Typography variant="caption" color="primary" sx={{ display: 'block', mb: 1 }}>
                        روی نقشه کلیک کنید تا ایستگاه اضافه شود.
                      </Typography>
                    )}

                    {/* ایستگاه‌ها */}
                    {vehicleOptions.includes('stations') && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          ایستگاه ها
                        </Typography>

                        {showStationActions && (
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Button
                              size="small"
                              variant={addingStations ? 'contained' : 'outlined'}
                              onClick={startAddingStation}
                            >
                              {addingStations ? 'پایان افزودن' : 'ایجاد ایستگاه'}
                            </Button>
                            <TextField
                              size="small"
                              type="number"
                              label="شعاع (m)"
                              value={stationRadius}
                              onChange={(e) => setStationRadius(Math.max(1, Number(e.target.value || 0)))}
                              sx={{ width: 130 }}
                            />
                          </Stack>
                        )}

                        {addingStations && showStationActions && (
                          <Typography variant="caption" color="primary" sx={{ display: 'block', mb: 1 }}>
                            روی نقشه کلیک کنید تا مارکر موقت بیاید، بعد تایید کنید.
                          </Typography>
                        )}

                        {Array.isArray(vehicleStations) && vehicleStations.length ? (
                          <List dense sx={{ maxHeight: 180, overflow: 'auto' }}>
                            {vehicleStations.map((st: any) => {
                              const isEditing = editing?.id === st.id;
                              return (
                                <Box key={st.id} id={`st-${st.id}`} sx={{ pb: 1 }}>
                                  <ListItem
                                    disableGutters
                                    secondaryAction={
                                      <Stack direction="row" spacing={0.5} alignItems="center">
                                        {st.lat && st.lng && (
                                          <IconButton edge="end" onClick={() => setFocusLatLng([st.lat, st.lng])} size="small" title="نمایش روی نقشه">
                                            📍
                                          </IconButton>
                                        )}
                                        {showStationActions && (
                                          <>
                                            <IconButton
                                              edge="end"
                                              onClick={() => {
                                                if (editing?.id === st.id) {
                                                  setEditing(null);
                                                  setMovingStationId(null);
                                                } else {
                                                  startEdit(st);
                                                }
                                              }}
                                              size="small"
                                              title="ویرایش"
                                            >
                                              <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton edge="end" color="error" onClick={() => deleteStation(st)} size="small" title="حذف">
                                              <DeleteIcon fontSize="small" />
                                            </IconButton>
                                          </>
                                        )}
                                      </Stack>
                                    }
                                  >
                                    <ListItemText
                                      primary={st.name}
                                      secondary={st.lat && st.lng ? `${st.lat.toFixed(5)}, ${st.lng.toFixed(5)}` : '—'}
                                    />
                                  </ListItem>

                                  {/* پنل کشویی ادیت زیر آیتم */}
                                  <Collapse in={isEditing} timeout="auto" unmountOnExit>
                                    <Box sx={{
                                      mx: 1.5, mt: 0.5, p: 1.5,
                                      bgcolor: 'action.hover',
                                      borderRadius: 1,
                                      border: (theme) => `1px solid ${theme.palette.divider}`,
                                    }}>
                                      <Stack spacing={1.25}>
                                        <TextField
                                          size="small"
                                          label="نام"
                                          value={editing?.name ?? ''}
                                          onChange={(e) => setEditing(ed => ed ? { ...ed, name: e.target.value } : ed)}
                                        />
                                        <TextField
                                          size="small"
                                          type="number"
                                          label="شعاع (m)"
                                          value={editing?.radius_m ?? 0}
                                          onChange={(e) =>
                                            setEditing(ed => ed ? { ...ed, radius_m: Math.max(1, Number(e.target.value || 0)) } : ed)
                                          }
                                        />
                                        <Stack direction="row" spacing={1} alignItems="center">
                                          <Button
                                            size="small"
                                            variant={movingStationId === st.id ? 'contained' : 'outlined'}
                                            onClick={() =>
                                              setMovingStationId(movingStationId === st.id ? null : st.id)
                                            }
                                          >
                                            جابجایی روی نقشه
                                          </Button>
                                          <Box flex={1} />
                                          {!!editing && (
                                            <Typography variant="caption" color="text.secondary">
                                              {editing.lat.toFixed(5)}, {editing.lng.toFixed(5)}
                                            </Typography>
                                          )}
                                          <Button size="small" onClick={() => { setEditing(null); setMovingStationId(null); }}>
                                            انصراف
                                          </Button>
                                          <Button size="small" variant="contained" onClick={saveEdit} disabled={savingEdit}>
                                            ذخیره
                                          </Button>
                                        </Stack>
                                      </Stack>
                                    </Box>
                                  </Collapse>

                                  <Divider sx={{ mt: 1 }} />
                                </Box>
                              );
                            })}
                          </List>
                        ) : (
                          <Typography color="text.secondary">ایستگاهی تعریف نشده.</Typography>
                        )}
                      </Box>
                    )}

                    {/* مسیر */}
                    {vehicleOptions.includes('routes') && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          مسیر
                        </Typography>

                        {/* کنترل‌های ساخت مسیر جدید */}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <TextField
                            size="small"
                            label="نام مسیر"
                            value={routeName}
                            onChange={(e) => setRouteName(e.target.value)}
                            sx={{ minWidth: 160 }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label="Threshold (m)"
                            value={routeThreshold}
                            onChange={(e) => setRouteThreshold(Math.max(1, Number(e.target.value || 0)))}
                            sx={{ width: 140 }}
                          />

                          <Button
                            size="small"
                            variant={drawingRoute ? 'contained' : 'outlined'}
                            onClick={() => setDrawingRoute((p) => !p)}
                            startIcon={<RadioButtonCheckedIcon />}
                          >
                            {drawingRoute ? 'پایان انتخاب نقاط' : 'افزودن مسیر'}
                          </Button>

                          <Button
                            size="small"
                            onClick={() => setRoutePoints((pts) => pts.slice(0, -1))}
                            disabled={!routePoints.length}
                            startIcon={<UndoIcon />}
                          >
                            برگشت نقطه
                          </Button>

                          <Button
                            size="small"
                            onClick={() => setRoutePoints([])}
                            disabled={!routePoints.length}
                            startIcon={<ClearIcon />}
                          >
                            پاک‌کردن
                          </Button>

                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            onClick={async () => {
                              if (!selectedVehicle) return;
                              if (routePoints.length < 2) {
                                alert('حداقل دو نقطه لازم است.');
                                return;
                              }
                              try {
                                const payload = {
                                  name: (routeName || 'مسیر').trim(),
                                  threshold_m: routeThreshold,
                                  points: routePoints.map((p, i) => ({ lat: p.lat, lng: p.lng, order_no: i + 1 })),
                                };

                                const { data: created } = await api.post(`/vehicles/${selectedVehicle!.id}/routes`, payload);

                                // بعضی بک‌اندها خودشون همین رو current می‌کنند. اگر نکرد، یکی از این ۲ الگو را امتحان کن (بسته به API شما):
                                await api.put(`/vehicles/${selectedVehicle!.id}/routes/current`, { route_id: created.id }).catch(() => { });
                                // یا:
                                // await api.post(`/vehicles/${selectedVehicle!.id}/routes/${created.id}/set-current`).catch(() => {});

                                await loadCurrentRoute(selectedVehicle!.id);   // state را از سرور همسان کن
                                setDrawingRoute(false);
                                setRoutePoints([]);
                                if (!routeName) setRouteName('');

                              } catch (e) {
                                console.error(e);
                                alert('ثبت مسیر ناموفق بود');
                              }
                            }}
                            startIcon={<SaveIcon />}
                            disabled={!selectedVehicle || routePoints.length < 2}
                          >
                            ذخیره مسیر
                          </Button>
                        </Stack>
                        {vehicleRoute && (
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Button
                              size="small"
                              variant={editingRoute ? 'contained' : 'outlined'}
                              startIcon={<EditIcon />}
                              onClick={() => setEditingRoute(v => !v)}
                            >
                              {editingRoute ? 'بستن ویرایش' : 'ویرایش مسیر'}
                            </Button>

                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              startIcon={<DeleteIcon />}
                              onClick={deleteCurrentRoute}
                            >
                              حذف مسیر
                            </Button>

                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<SaveIcon />}
                              disabled={!drawingRoute || routePoints.length < 2}
                              onClick={replaceRouteStationsUI}
                              title="نقاط انتخاب‌شده روی نقشه، به‌عنوان مسیر فعلی ثبت می‌شوند"
                            >
                              ثبت نقاط برای مسیر فعلی
                            </Button>
                          </Stack>
                        )}

                        <Collapse in={!!vehicleRoute && editingRoute} timeout="auto" unmountOnExit>
                          <Box sx={{
                            p: 1.5, mb: 1.5, borderRadius: 1, bgcolor: 'action.hover',
                            border: theme => `1px solid ${theme.palette.divider}`
                          }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                              <TextField
                                size="small"
                                label="نام مسیر"
                                value={routeForm.name}
                                onChange={(e) => setRouteForm(f => ({ ...f, name: e.target.value }))}
                                sx={{ minWidth: 180 }}
                              />
                              <TextField
                                size="small"
                                type="number"
                                label="Threshold (m)"
                                value={routeForm.threshold_m}
                                onChange={(e) =>
                                  setRouteForm(f => ({ ...f, threshold_m: Math.max(1, Number(e.target.value || 0)) }))
                                }
                                sx={{ width: 160 }}
                              />
                              <Box flex={1} />
                              <Button size="small" onClick={() => setEditingRoute(false)}>انصراف</Button>
                              <Button size="small" variant="contained" onClick={saveRouteMeta} startIcon={<SaveIcon />}>
                                ذخیره
                              </Button>
                            </Stack>
                          </Box>
                        </Collapse>
                        {drawingRoute && (
                          <Typography variant="caption" color="primary" sx={{ display: 'block', mb: 1 }}>
                            در حالت افزودن مسیر هستید؛ روی نقشه کلیک کنید تا نقاط به‌ترتیب اضافه شوند.
                          </Typography>
                        )}

                        {/* نمایش مسیر جاری */}
                        {vehicleRoute ? (
                          <>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                              <Chip size="small" label={`#${vehicleRoute.id}`} />
                              <Typography variant="body2">{vehicleRoute.name || 'مسیر'}</Typography>
                              <Chip size="small" variant="outlined" label={`Threshold: ${vehicleRoute.threshold_m ?? 60} m`} />
                            </Stack>

                            {Array.isArray(vehicleRoute.points) && vehicleRoute?.points?.length ? (
                              <List dense sx={{ maxHeight: 180, overflow: 'auto' }}>

                              </List>
                            ) : (
                              <Typography color="text.secondary">ایستگاهی برای مسیر فعلی ثبت نشده.</Typography>
                            )}
                          </>
                        ) : (
                          <Typography color="text.secondary">مسیر فعالی تنظیم نشده.</Typography>
                        )}
                      </Box>
                    )}
                    {/* ژئوفنس */}
                    {vehicleOptions.includes('geo_fence') && selectedVehicle && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>ژئو فنس</Typography>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <FormControl size="small">
                            <InputLabel id="gf-mode-lbl">حالت</InputLabel>
                            <Select
                              labelId="gf-mode-lbl"
                              label="حالت"
                              value={gfMode}
                              onChange={(e) => { setGfMode(e.target.value as 'circle' | 'polygon'); setGfCenter(null); setGfPoly([]); }}
                              sx={{ minWidth: 140 }}
                            >
                              <MenuItem value="circle">دایره‌ای</MenuItem>
                              <MenuItem value="polygon">چندضلعی</MenuItem>
                            </Select>
                          </FormControl>

                          <TextField
                            size="small"
                            type="number"
                            label="تلورانس (m)"
                            value={gfTolerance}
                            onChange={(e) => setGfTolerance(Math.max(0, Number(e.target.value || 0)))}
                            sx={{ width: 140 }}
                          />

                          <Button
                            size="small"
                            variant={gfDrawing ? 'contained' : 'outlined'}
                            onClick={() => setGfDrawing(v => !v)}
                          >
                            {gfDrawing ? 'پایان ترسیم' : 'ترسیم روی نقشه'}
                          </Button>

                          {gfMode === 'polygon' && (
                            <>
                              <Button size="small" onClick={() => setGfPoly(pts => pts.slice(0, -1))} disabled={!gfPoly.length}>
                                برگشت نقطه
                              </Button>
                              <Button size="small" onClick={() => setGfPoly([])} disabled={!gfPoly.length}>
                                پاک‌کردن نقاط
                              </Button>
                            </>
                          )}

                          {gfMode === 'circle' && (
                            <TextField
                              size="small"
                              type="number"
                              label="شعاع (m)"
                              value={gfRadius}
                              onChange={(e) => setGfRadius(Math.max(1, Number(e.target.value || 0)))}
                              sx={{ width: 140 }}
                            />
                          )}

                          <Button size="small" variant="contained" color="primary" onClick={saveGeofence}>
                            ذخیره ژئوفنس
                          </Button>

                          <Button size="small" color="error" variant="outlined" onClick={deleteGeofence} disabled={!geofence}>
                            حذف ژئوفنس
                          </Button>
                        </Stack>

                        {gfMode === 'circle' ? (
                          <Typography variant="caption" color="text.secondary">
                            روی نقشه کلیک کنید تا مرکز دایره انتخاب شود، سپس شعاع را تنظیم و ذخیره کنید.
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            روی نقشه کلیک کنید تا نقاط چندضلعی به‌ترتیب اضافه شوند (حداقل ۳ نقطه).
                          </Typography>
                        )}
                      </Box>
                    )}


                    {/* لوازم مصرفی */}
                    {vehicleOptions.includes('consumables') && (
                      <Box sx={{ mt: 2 }}>
                        {/* تیتر + آیکون کنار هم */}
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <Typography variant="subtitle2">لوازم مصرفی</Typography>
                          <Tooltip title="افزودن">
                            <IconButton size="small" onClick={() => setConsumablesOpen(true)}>
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>

                        {/* لیست آیتم‌ها */}
                        {consumablesStatus === 'loading' ? (
                          <Box display="flex" alignItems="center" gap={1} color="text.secondary" sx={{ mt: 1 }}>
                            <CircularProgress size={16} /> در حال دریافت لوازم مصرفی…
                          </Box>
                        ) : Array.isArray(consumables) && consumables.length ? (
                          <List dense sx={{ maxHeight: 180, overflow: 'auto' }}>
                            {consumables.map((c: any, i: number) => (
                              <ListItem
                                key={c.id ?? i}
                                divider
                                secondaryAction={
                                  <Stack direction="row" spacing={0.5}>
                                    <IconButton size="small" title="ویرایش" onClick={() => openEditConsumable(c)}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" color="error" title="حذف" onClick={() => deleteConsumable(c)}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Stack>
                                }
                              >
                                <ListItemText
                                  primary={c.title ?? c.note ?? 'آیتم'}
                                  secondary={
                                    <>
                                      {c.mode === 'km' ? 'بر اساس کیلومتر' : 'بر اساس زمان'}
                                      {c.created_at && <> — {new Date(c.created_at).toLocaleDateString('fa-IR')}</>}
                                    </>
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                        ) : consumablesStatus === 'loaded' ? (
                          <Typography color="text.secondary">آیتمی ثبت نشده.</Typography>
                        ) : consumablesStatus === 'error' ? (
                          <Typography color="warning.main">خطا در دریافت لوازم مصرفی. بعداً دوباره تلاش کنید.</Typography>
                        ) : null}



                        <Dialog open={!!editingCons} onClose={closeEditConsumable} fullWidth maxWidth="sm">
                          <DialogTitle>ویرایش آیتم مصرفی</DialogTitle>
                          <DialogContent dividers>
                            <Stack spacing={2}>
                              <TextField
                                label="توضیح/یادداشت"
                                value={editingCons?.note ?? ''}
                                onChange={(e) => setEditingCons((p: any) => ({ ...p, note: e.target.value }))}
                                fullWidth
                              />

                              <RadioGroup
                                row
                                value={editingCons?.mode ?? 'km'}
                                onChange={(_, v) =>
                                  setEditingCons((p: any) => ({
                                    ...p,
                                    mode: v as 'km' | 'time',
                                    // پاک‌کردن فیلد غیرمرتبط
                                    start_at: v === 'time' ? (p?.start_at ?? new Date().toISOString()) : null,
                                    base_odometer_km: v === 'km' ? (p?.base_odometer_km ?? 0) : null,
                                  }))
                                }
                              >
                                <FormControlLabel value="km" control={<Radio />} label="بر اساس کیلومتر" />
                                <FormControlLabel value="time" control={<Radio />} label="بر اساس زمان" />
                              </RadioGroup>

                              {editingCons?.mode === 'time' ? (
                                <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                                  <DateTimePicker<Date>
                                    label="تاریخ یادآوری"
                                    value={editingCons?.start_at ? new Date(editingCons.start_at) : null}
                                    onChange={(val) =>
                                      setEditingCons((p: any) => ({ ...p, start_at: val ? new Date(val).toISOString() : null }))
                                    }
                                    ampm={false}
                                    slotProps={{ textField: { fullWidth: true } }}
                                    format="yyyy/MM/dd HH:mm"
                                  />
                                </LocalizationProvider>
                              ) : (
                                <TextField
                                  label="مقدار مبنا (کیلومتر)"
                                  type="number"
                                  value={editingCons?.base_odometer_km ?? ''}
                                  onChange={(e) =>
                                    setEditingCons((p: any) => ({ ...p, base_odometer_km: e.target.value ? Number(e.target.value) : null }))
                                  }
                                  fullWidth
                                />
                              )}
                            </Stack>
                          </DialogContent>
                          <DialogActions>
                            <Button onClick={closeEditConsumable}>انصراف</Button>
                            <Button variant="contained" onClick={saveEditConsumable} disabled={savingCons}>
                              ذخیره
                            </Button>
                          </DialogActions>
                        </Dialog>

                        {/* دیالوگ افزودن/تنظیم */}
                        <Dialog
                          open={consumablesOpen}
                          onClose={() => setConsumablesOpen(false)}
                          fullWidth
                          maxWidth="sm"
                        >
                          <DialogTitle>لوازم مصرفی / مسافت از آخرین صفر</DialogTitle>

                          <DialogContent dividers>
                            <Stack spacing={2}>
                              {/* توضیح */}
                              <TextField
                                label="توضیح/یادداشت"
                                value={tripNote}
                                onChange={(e) => setTripNote(e.target.value)}
                                fullWidth
                              />

                              {/* انتخاب حالت */}
                              <RadioGroup
                                row
                                value={consumableMode}
                                onChange={(_, v) => setConsumableMode((v as 'time' | 'km') ?? 'km')}
                              >
                                <FormControlLabel value="km" control={<Radio />} label="بر اساس کیلومتر" />
                                <FormControlLabel value="time" control={<Radio />} label="بر اساس زمان" />
                              </RadioGroup>

                              {/* حالت زمان */}
                              {consumableMode === 'time' && (
                                <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                                  <DateTimePicker<Date>
                                    label="تاریخ یادآوری شمارش"
                                    value={tripDate}
                                    onChange={(val: Date | null) => setTripDate(val)}
                                    ampm={false}
                                    slotProps={{ textField: { fullWidth: true } }}
                                    format="yyyy/MM/dd HH:mm"
                                  />
                                </LocalizationProvider>
                              )}

                              {/* حالت کیلومتر */}
                              {consumableMode === 'km' && (
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                  <Stack spacing={2}>
                                    {/* کیلومترشمار فعلی */}
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                      <Typography variant="body2" color="text.secondary">
                                        کیلومترشمار فعلی:
                                      </Typography>
                                      <Typography variant="h6">
                                        {liveOdoKm != null ? `${liveOdoKm.toLocaleString('fa-IR')} km` : '—'}
                                      </Typography>
                                    </Stack>

                                    {/* فیلد ورودی مبنا */}
                                    <TextField
                                      label="مقدار مبنا (از آخرین صفر)"
                                      type="number"
                                      value={tripBaseKm ?? ''}
                                      onChange={(e) => setTripBaseKm(e.target.value ? Number(e.target.value) : null)}
                                      fullWidth
                                    />

                                    {!vehicleOptions.includes('odometer') && (
                                      <Typography sx={{ mt: 1 }} variant="caption" color="warning.main">
                                        برای به‌روزرسانی زنده، گزینهٔ «کیلومترشمار» باید در سیاست‌های این ماشین فعال باشد.
                                      </Typography>
                                    )}
                                  </Stack>
                                </Paper>
                              )}
                            </Stack>
                          </DialogContent>

                          <DialogActions>
                            <Button onClick={() => setConsumablesOpen(false)}>بستن</Button>

                            {consumableMode === 'km' && (
                              <Button
                                variant="outlined"
                                onClick={handleTripReset}
                                disabled={liveOdoKm == null || !selectedVehicle}
                              >
                                صفر کردن از الان
                              </Button>
                            )}

                            <Button
                              variant="contained"
                              onClick={handleAddConsumable}
                              disabled={consumableMode === 'time' && !tripDate}
                            >
                              افزودن
                            </Button>
                          </DialogActions>
                        </Dialog>
                      </Box>
                    )}



                  </>
                ) : (
                  <Typography color="text.secondary">
                    برای این نوع ماشین، پارامتری فعال نشده.
                  </Typography>
                )}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="rangePreset">بازه</InputLabel>
                  <Select
                    labelId="rangePreset"
                    label="بازه"
                    value={rangePreset}
                    onChange={(e) => setRangePreset(e.target.value as any)}
                  >
                    <MenuItem value="today">امروز</MenuItem>
                    <MenuItem value="yesterday">دیروز</MenuItem>
                    <MenuItem value="7d">۷ روز اخیر</MenuItem>
                    <MenuItem value="custom">دلخواه</MenuItem>
                  </Select>
                </FormControl>

                <DateTimePicker
                  label="از (شمسی)"
                  value={fromISO ? new Date(fromISO) : null}
                  onChange={(val) => {
                    if (!val) return;
                    setRangePreset('custom');
                    setFromISO(val.toISOString());
                  }}
                  format="yyyy/MM/dd HH:mm"
                  ampm={false}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <DateTimePicker
                  label="تا (شمسی)"
                  value={toISO ? new Date(toISO) : null}
                  onChange={(val) => {
                    if (!val) return;
                    setRangePreset('custom');
                    setToISO(val.toISOString());
                  }}
                  format="yyyy/MM/dd HH:mm"
                  ampm={false}
                  slotProps={{ textField: { size: 'small' } }}
                />
              </Stack>
            </LocalizationProvider>


            {tab === 'drivers' && selectedDriver && (
              statsLoading ? (
                <Box display="flex" alignItems="center" justifyContent="center" py={3}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <Grid2 container spacing={2}>
                  <Grid2 xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">مسافت</Typography>
                      <Typography variant="h6">{stats.totalDistanceKm ?? '—'} km</Typography>
                    </Paper>
                  </Grid2>
                  <Grid2 xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">مدت کار</Typography>
                      <Typography variant="h6">{stats.totalDurationMin ?? '—'} min</Typography>
                    </Paper>
                  </Grid2>
                  <Grid2 xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">ماموریت‌ها</Typography>
                      <Typography variant="h6">{stats.jobsCount ?? '—'}</Typography>
                    </Paper>
                  </Grid2>
                  <Grid2 xs={12} sm={6} md={3}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">خرابی‌ها</Typography>
                      <Typography variant="h6">{stats.breakdownsCount ?? '—'}</Typography>

                    </Paper>
                    {/* تخلفات */}
                    {/* تخلفات راننده */}
                    <Box sx={{ mt: 2 }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Typography variant="subtitle2">تخلفات</Typography>
                        <Chip
                          size="small"
                          label={driverViolationsLoading ? 'در حال دریافت…' : `${filterByRange(
                            (violationFilter === 'all'
                              ? driverViolations
                              : driverViolations.filter(v => v.type === violationFilter)
                            ), fromISO, toISO
                          ).length} مورد`}
                          variant="outlined"
                        />
                        <Box flex={1} />
                        <FormControl size="small" sx={{ minWidth: 160 }}>
                          <InputLabel id="vio-filter-driver">فیلتر نوع</InputLabel>
                          <Select
                            labelId="vio-filter-driver"
                            label="فیلتر نوع"
                            value={violationFilter}
                            onChange={(e) => setViolationFilter(e.target.value as any)}
                          >
                            <MenuItem value="all">همه</MenuItem>
                            <MenuItem value="geofence_exit">خروج از ژئوفنس</MenuItem>
                            <MenuItem value="off_route">خروج از مسیر</MenuItem>
                            <MenuItem value="speeding">سرعت غیرمجاز</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>

                      {driverViolationsLoading ? (
                        <Box display="flex" alignItems="center" gap={1} color="text.secondary" sx={{ mt: 1 }}>
                          <CircularProgress size={16} /> در حال دریافت تخلفات…
                        </Box>
                      ) : (
                        (() => {
                          const list = filterByRange(
                            violationFilter === 'all'
                              ? driverViolations
                              : driverViolations.filter(v => v.type === violationFilter),
                            fromISO, toISO
                          );

                          if (!list.length) {
                            return <Typography color="text.secondary">موردی یافت نشد.</Typography>;
                          }

                          return (
                            <List dense sx={{ maxHeight: 220, overflow: 'auto' }}>
                              {list.map(v => (
                                <ListItem
                                  key={v.id}
                                  divider
                                  secondaryAction={(
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={new Date(v.created_at).toLocaleString('fa-IR')}
                                    />
                                  )}
                                  button
                                  onClick={() => {
                                    setSelectedViolation(v);
                                    const p = v?.meta?.point;
                                    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
                                      setFocusLatLng([p.lat, p.lng]);
                                    }
                                  }}
                                >
                                  <ListItemText
                                    primary={v.type === 'off_route' ? 'خروج از مسیر'
                                      : v.type === 'geofence_exit' ? 'خروج از ژئوفنس'
                                        : v.type === 'speeding' ? 'سرعت غیرمجاز'
                                          : v.type}
                                    secondary={
                                      v?.meta?.distance_m != null
                                        ? `فاصله از حد: ${Number(v.meta.distance_m).toLocaleString('fa-IR')} m`
                                        : (v?.meta?.radius_m != null
                                          ? `شعاع: ${Number(v.meta.radius_m).toLocaleString('fa-IR')} m` : ' ')
                                    }
                                  />
                                </ListItem>
                              ))}
                            </List>
                          );
                        })()
                      )}
                    </Box>

                    <Dialog open={!!selectedViolation} onClose={() => setSelectedViolation(null)} fullWidth maxWidth="sm">
                      <DialogTitle>جزئیات تخلف</DialogTitle>
                      <DialogContent dividers>
                        {selectedViolation && (
                          <Stack spacing={1.25}>
                            <Typography variant="body2"><b>نوع:</b> {selectedViolation.type}</Typography>
                            <Typography variant="body2"><b>زمان:</b> {new Date(selectedViolation.created_at).toLocaleString('fa-IR')}</Typography>
                            {selectedViolation.driver_user_id && (
                              <Typography variant="body2"><b>راننده:</b> #{selectedViolation.driver_user_id}</Typography>
                            )}
                            {selectedViolation.meta?.point && (
                              <Typography variant="body2">
                                <b>مکان:</b> {selectedViolation.meta.point.lat.toFixed(6)}, {selectedViolation.meta.point.lng.toFixed(6)}
                              </Typography>
                            )}
                            {selectedViolation.meta?.distance_m != null && (
                              <Typography variant="body2"><b>فاصله از حد:</b> {Number(selectedViolation.meta.distance_m).toLocaleString('fa-IR')} m</Typography>
                            )}
                            {selectedViolation.meta?.threshold_m != null && (
                              <Typography variant="body2"><b>آستانه:</b> {Number(selectedViolation.meta.threshold_m).toLocaleString('fa-IR')} m</Typography>
                            )}

                            {/* نمایش خامِ meta برای دیباگ/جزئیات */}
                            <Paper variant="outlined" sx={{ p: 1, mt: 1, bgcolor: 'action.hover' }}>
                              <Typography variant="caption" color="text.secondary">Meta</Typography>
                              <pre style={{ margin: 0, direction: 'ltr' }}>{JSON.stringify(selectedViolation.meta, null, 2)}</pre>
                            </Paper>
                          </Stack>
                        )}
                      </DialogContent>
                      <DialogActions>
                        <Button onClick={() => setSelectedViolation(null)}>بستن</Button>
                        {selectedViolation?.meta?.point && (
                          <Button
                            variant="contained"
                            onClick={() => {
                              const pt = selectedViolation.meta.point;
                              setFocusLatLng([pt.lat, pt.lng]);
                            }}
                          >
                            نمایش روی نقشه
                          </Button>
                        )}
                      </DialogActions>
                    </Dialog>

                  </Grid2>
                </Grid2>
              )
            )}
          </Paper>
          <Dialog open={defaultsOpen} onClose={() => setDefaultsOpen(false)} fullWidth maxWidth="lg">
            <DialogTitle>مدیریت پروفایل‌های تنظیمات</DialogTitle>
            <DialogContent dividers sx={{ p: 0, minHeight: '60vh', display: 'flex', flexDirection: 'column' }}>
              {currentView === 'list' ? (
                <Box p={3}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">پروفایل‌های ذخیره‌شده</Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateNewProfile}>
                      ایجاد پروفایل جدید
                    </Button>
                  </Stack>
                  {profilesLoading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '40vh' }}><CircularProgress /></Box>
                  ) : profiles.length > 0 ? (
                    <List>
                      {profiles.map(p => (
                        <ListItem
                          key={p.id}
                          divider
                          secondaryAction={
                            <Stack direction="row" spacing={0.5}>
                              <Tooltip title="بارگذاری این پروفایل در ویرایشگر">
                                <IconButton edge="end" onClick={() => handleLoadProfile(p.id)}><DownloadIcon /></IconButton>
                              </Tooltip>
                              <Tooltip title="حذف پروفایل">
                                <IconButton edge="end" color="error" onClick={() => handleDeleteProfile(p.id)}><DeleteIcon /></IconButton>
                              </Tooltip>
                            </Stack>
                          }
                        >
                          <ListItemText
                            primary={p.name}
                            secondary={`شامل ${p.settings.stations.length} ایستگاه و ${p.settings.geofence ? 'ژئوفنس' : 'بدون ژئوفنس'}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                      هیچ پروفایلی ذخیره نشده است. برای شروع یک پروفایل جدید ایجاد کنید.
                    </Typography>
                  )}
                </Box>
              ) : (
                <Grid2 container sx={{ flex: 1 }}>
                  <Grid2 xs={12} md={7} sx={{ height: { xs: 360, md: 'auto' }, minHeight: 360, position: 'relative' }}>
                    <MapContainer center={INITIAL_CENTER} zoom={INITIAL_ZOOM} style={{ width: '100%', height: '100%' }} whenCreated={(m: any) => { mapDefaultsRef.current = m; setTimeout(() => m.invalidateSize(), 50); }}>
                      <TileLayer url={tileUrl} attribution="&copy; OpenStreetMap | © MapTiler" />
                      <PickPointsDF enabled={dfDrawing && dfGfMode === 'circle'} onPick={(lat, lng) => setDfGfCircle(s => ({ ...s, center: { lat, lng } }))} />
                      <PickPointsDF enabled={dfDrawing && dfGfMode === 'polygon'} onPick={(lat, lng) => setDfGfPoly(prev => [...prev, { lat, lng }])} />
                      <PickPointsDF enabled={dfAddingStation && !dfDrawing} onPick={(lat, lng) => setDfTempSt({ name: `ایستگاه ${dfAuto}`, lat, lng, radius_m: 60 })} />
                      {dfGfMode === 'circle' && dfGfCircle.center && <Circle center={[dfGfCircle.center.lat, dfGfCircle.center.lng]} radius={dfGfCircle.radius_m} />}
                      {dfGfMode === 'polygon' && dfGfPoly.length >= 2 && <Polygon positions={dfGfPoly.map((p: { lat: number; lng: number; }) => [p.lat, p.lng] as [number, number])} pathOptions={{ dashArray: '6 6' }} />}
                      {dfStations.map((st, i) => (
                        <React.Fragment key={`dfst-${i}`}>
                          <Circle center={[st.lat, st.lng]} radius={st.radius_m} />
                          <Marker position={[st.lat, st.lng]}><Popup><b>{st.name}</b><br />{st.lat.toFixed(5)}, {st.lng.toFixed(5)}</Popup></Marker>
                        </React.Fragment>
                      ))}
                      {dfTempSt && (
                        <>
                          <Circle center={[dfTempSt.lat, dfTempSt.lng]} radius={dfTempSt.radius_m} />
                          <Marker position={[dfTempSt.lat, dfTempSt.lng]} draggable eventHandlers={{ add: (e: any) => e.target.openPopup(), dragend: (e: any) => { const ll = e.target.getLatLng(); setDfTempSt(s => s ? ({ ...s, lat: ll.lat, lng: ll.lng }) : s); } }}>
                            <Popup autoClose={false} closeOnClick={false} autoPan>
                              <div style={{ minWidth: 220 }}>
                                <strong>ایجاد ایستگاه</strong>
                                <div style={{ marginTop: 8 }}><input style={{ width: '100%', padding: 6 }} placeholder="نام ایستگاه" value={dfTempSt.name} onChange={(e) => setDfTempSt(s => s ? ({ ...s, name: e.target.value }) : s)} /></div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                  <button onClick={() => { if (dfTempSt) { setDfStations(p => [...p, dfTempSt]); setDfAuto(a => a + 1); setDfTempSt(null); } }}>تایید</button>
                                  <button onClick={() => setDfTempSt(null)}>لغو</button>
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        </>
                      )}
                    </MapContainer>

                  </Grid2>
                  <Grid2 xs={12} md={5} sx={{ p: 2, overflowY: 'auto' }}>
                    <Stack spacing={2}>
                      <TextField label="نام پروفایل" value={profileName} onChange={(e) => setProfileName(e.target.value)} size="small" fullWidth required variant="filled" />
                      <Divider />
                      <FormControl size="small">
                        <InputLabel id="df-target-lbl">اعمال روی</InputLabel>
                        <Select labelId="df-target-lbl" label="اعمال روی" value={dfTarget} onChange={(e) => setDfTarget(e.target.value as any)}>
                          <MenuItem value="currentSA">همه‌ی ماشین‌های SA انتخاب‌شده</MenuItem>
                          <MenuItem value="currentVehicle" disabled={!selectedVehicle}>فقط ماشین انتخاب‌شده</MenuItem>
                        </Select>
                      </FormControl>
                      {dfTarget === 'currentSA' && (
                        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography fontWeight={700}>ماشین‌های SA انتخاب‌شده</Typography>
                            <FormControlLabel control={<Checkbox checked={selectAll} onChange={(_, ch) => handleSelectAll(ch)} />} label="انتخاب همه" />
                          </Stack>
                          {selectedSAId && (vehiclesBySA[selectedSAId]?.length ?? 0) ? (
                            <List dense sx={{ maxHeight: 220, overflow: 'auto', mt: 1 }}>
                              {vehiclesBySA[selectedSAId]!.map(v => (<ListItem key={v.id} secondaryAction={<Checkbox edge="end" checked={selectedVehicleIds.has(v.id)} onChange={() => toggleVehiclePick(v.id)} />}><ListItemText primary={v.plate_no} secondary={v.vehicle_type_code || '—'} /></ListItem>))}
                            </List>
                          ) : (
                            <Typography sx={{ mt: 1 }} color="text.secondary" variant="body2">برای این SA ماشینی وجود ندارد.</Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">{selectedVehicleIds.size.toLocaleString('fa-IR')} ماشین انتخاب شده‌اند.</Typography>
                        </Paper>
                      )}
                      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Typography fontWeight={700}>ژئوفنس</Typography>
                          <Button size="small" onClick={() => setDfDrawing(v => !v)} variant={dfDrawing ? 'contained' : 'outlined'}>{dfDrawing ? 'پایان ترسیم' : 'ترسیم روی نقشه'}</Button>
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                          <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel id="df-gf-mode">حالت</InputLabel>
                            <Select labelId="df-gf-mode" value={dfGfMode} label="حالت" onChange={(e) => { setDfGfMode(e.target.value as any); setDfGfPoly([]); setDfGfCircle(c => ({ ...c, center: undefined })); }}>
                              <MenuItem value="circle">دایره‌ای</MenuItem>
                              <MenuItem value="polygon">چندضلعی</MenuItem>
                            </Select>
                          </FormControl>
                          <TextField size="small" label="تلورانس (m)" type="number" value={dfGfCircle.tolerance_m} onChange={(e) => setDfGfCircle(c => ({ ...c, tolerance_m: Math.max(0, Number(e.target.value || 0)) }))} sx={{ width: 140 }} />
                          {dfGfMode === 'circle' && (<TextField size="small" label="شعاع (m)" type="number" value={dfGfCircle.radius_m} onChange={(e) => setDfGfCircle(c => ({ ...c, radius_m: Math.max(1, Number(e.target.value || 0)) }))} sx={{ width: 140 }} />)}
                          {dfGfMode === 'polygon' && (<Stack direction="row" spacing={1}><Button size="small" onClick={() => setDfGfPoly(pts => pts.slice(0, -1))} disabled={!dfGfPoly.length}>برگشت نقطه</Button><Button size="small" onClick={() => setDfGfPoly([])} disabled={!dfGfPoly.length}>پاک‌کردن</Button></Stack>)}
                        </Stack>
                      </Paper>
                      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Typography fontWeight={700}>ایستگاه‌ها</Typography>
                          <Chip size="small" label={`${dfStations.length} مورد`} />
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5, mb: 1 }}>
                          <Button size="small" variant={dfAddingStation ? 'contained' : 'outlined'} onClick={() => { setDfAddingStation(prev => !prev); if (dfAddingStation) setDfTempSt(null); }} disabled={dfDrawing}>{dfAddingStation ? 'پایان افزودن' : 'افزودن ایستگاه'}</Button>
                          {dfAddingStation && !dfDrawing && (<Typography variant="caption" color="primary">روی نقشه کلیک کنید...</Typography>)}
                        </Stack>
                        {dfStations.length > 0 ? (
                          <List dense sx={{ maxHeight: 180, overflow: 'auto', mt: 1 }}>
                            {dfStations.map((s, i) => (<ListItem key={i} secondaryAction={<IconButton size="small" onClick={() => setDfStations(arr => arr.filter((_, idx) => idx !== i))}><DeleteIcon fontSize="small" /></IconButton>}><ListItemText primary={s.name} secondary={`${s.lat.toFixed(5)}, ${s.lng.toFixed(5)} — r=${s.radius_m}m`} /></ListItem>))}
                          </List>
                        ) : (
                          <Typography sx={{ mt: 1 }} color="text.secondary" variant="body2">برای شروع، روی دکمه «افزودن ایستگاه» کلیک کنید.</Typography>
                        )}
                      </Paper>
                    </Stack>
                  </Grid2>
                </Grid2>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDefaultsOpen(false)}>بستن</Button>
              {currentView === 'edit' && (
                <>
                  <Button onClick={() => setCurrentView('list')}>بازگشت به لیست</Button>
                  <Button variant="outlined" color="primary" onClick={handleSaveProfile} startIcon={<SaveIcon />}>
                    {editingProfileId ? 'ذخیره تغییرات پروفایل' : 'ذخیره پروفایل جدید'}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleApplyDefaults}
                    disabled={
                      dfApplying ||
                      (!dfStations.length && !buildDfGeofence()) ||
                      (dfTarget === 'currentSA' && selectedVehicleIds.size === 0 && (vehiclesBySA[selectedSAId || 0] || []).length > 0) ||
                      (dfTarget === 'currentVehicle' && !selectedVehicle)
                    }
                  >
                    {dfApplying ? 'در حال اعمال…' : 'اعمال روی ماشین‌ها'}
                  </Button>
                </>
              )}
            </DialogActions>
          </Dialog>


        </Grid2>
      )}
      {toast?.open && (
        <Snackbar
          open={toast.open}
          autoHideDuration={6000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="warning" onClose={() => setToast(null)} sx={{ width: '100%' }}>
            {toast.msg}
          </Alert>
        </Snackbar>
      )}
    </Grid2>

  );
}

function BranchManagerRoleSection({ user }: { user: User }) {
  // ===== Permissions: نقشه همیشه؛ ردیابی فقط با تیک سطح نقش =====
  const DEFAULT_PERMS: string[] = ['view_report'];
  const [allowed, setAllowed] = React.useState<Set<string>>(new Set(DEFAULT_PERMS));
  const [permsLoading, setPermsLoading] = React.useState(false);
  const [q, setQ] = React.useState('');
  type TabKey = 'drivers' | VehicleTypeCode;
  const [tab, setTab] = React.useState<TabKey>('drivers');
  const activeType = (tab !== 'drivers') ? (tab as VehicleTypeCode) : null;
  const [parentSA, setParentSA] = React.useState<{ id: number; name: string } | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<number | null>(null);
  const LL_DEC = 10;
  const roundLL = (v: number) => Math.round(v * 10 ** LL_DEC) / 10 ** LL_DEC;
  const fmtLL = (v: number) => Number.isFinite(v) ? v.toFixed(LL_DEC) : '';
  const [sheetOpen, setSheetOpen] = React.useState(false);
  // ===== Route types =====
  type RouteMeta = { id: number; name?: string | null; threshold_m?: number | null };
  type RoutePoint = { lat: number; lng: number; name?: string | null; radius_m?: number | null };
  const [sheetMode, setSheetMode] = React.useState<'vehicle' | 'driver' | null>(null);
  // state ها
  const [drawingRoute, setDrawingRoute] = React.useState(false);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [routeName, setRouteName] = useState('');
  const [routeThreshold, setRouteThreshold] = useState<number>(100);
  const [fromISO, setFromISO] = React.useState<string>(() => new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  const [toISO, setToISO] = React.useState<string>(() => new Date().toISOString());
  // کلیک‌گیر روی نقشه
  function PickPointsForRoute({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lng: number) => void }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }
  // پرچم برای جلوگیری از تریپل‌کلیک/اسپم
  const savingRouteRef = React.useRef(false);
  // ⬇️ اینو کنار بقیه helpers بذار
  // ✅ فقط روت‌هایی که داریم + سایلنت
  // ✅ فقط همون روت‌های موجود؛ بی‌سروصدا فالبک می‌زنیم
  // فقط از روت‌های assignment استفاده کن
  const getDriverCurrentVehicleId = async (driverId: number): Promise<number | null> => {
    try {
      const { data } = await api.get(`/assignments/current/${driverId}`);
      // ممکنه پاسخ خالی باشه (۲۰۰ بدون body) یا شکل‌های مختلف داشته باشه
      const vid =
        Number(data?.vehicle_id ?? data?.vehicleId) ||
        Number(data?.vehicle?.id) || null;

      return Number.isFinite(vid) && vid! > 0 ? vid : null;
    } catch {
      return null;
    }
  };
  async function trackByDriverId(driverId: number, from = fromISO, to = toISO) {
    if (!driverId) return;

    try {
      const params = {
        driver_id: driverId,         // ⬅️ اجباری
        from,                        // ISO string
        to,                          // ISO string
      };

      // اگر می‌خواهید URL لاگ شود:
      // const q = new URLSearchParams({ driver_id: String(driverId), from, to }).toString();
      // console.log(`[GET] /tracks?${q}`);

      const { data } = await api.get('/tracks', { params });
      const pts: { lat: number; lng: number }[] = Array.isArray(data) ? data : (data?.items || []);
      setPolyline(pts.map(p => [p.lat, p.lng] as [number, number]));
      liveTrackOnRef.current = true;
      selectedDriverRef.current = drivers.find(x => x.id === driverId) ?? null;
    } catch (e) {
      console.error('trackByDriverId error:', e);
      setPolyline([]);
      liveTrackOnRef.current = true;
      selectedDriverRef.current = drivers.find(x => x.id === driverId) ?? null;
    }
  }



  async function saveRouteAndFenceForVehicle(opts: {
    vehicleId: number;
    name: string;
    threshold_m: number;               // مثلا 1000
    points: { lat: number; lng: number }[]; // نقاط خام مسیر
    toleranceM?: number;               // مثلا 10–20
  }) {
    const { vehicleId, name, threshold_m, points, toleranceM = 15 } = opts;
    if (savingRouteRef.current) return;           // جلوگیری از تکرار
    if (!vehicleId) { alert('خودرو انتخاب نشده'); return; }
    if (!Array.isArray(points) || points.length < 2) {
      alert('حداقل دو نقطه برای مسیر لازم است.'); return;
    }

    try {
      savingRouteRef.current = true;

      // 1) ساخت مسیر روی خودِ خودرو
      // POST /vehicles/:vid/routes   { name, threshold_m, points }
      const { data: created } = await api.post(`/vehicles/${vehicleId}/routes`, {
        name,
        threshold_m,
        points, // [{lat,lng}, ...]
      });
      const routeId = Number(created?.route_id ?? created?.id);
      if (!Number.isFinite(routeId)) throw new Error('route_id از پاسخ سرور خوانده نشد');

      // 2) ست کردن همین مسیر به‌عنوان مسیر فعلی
      // PUT /vehicles/:vid/routes/current   { route_id }
      await api.put(`/vehicles/${vehicleId}/routes/current`, { route_id: routeId });

      // 3) ساخت ژئوفنس پُلیگانیِ دور مسیر (بافر)
      // از همون buildRouteBufferPolygon که تو کدت داری استفاده می‌کنیم
      const ring = buildRouteBufferPolygon(points, threshold_m) // متر
        .map(p => ({ lat: +p.lat, lng: +p.lng }));

      // نکته: برای جلوگیری از چندبار ساخت، اول PUT (آپ‌سرت) می‌زنیم؛
      // اگر سرور اجازه نداد، یکبار POST می‌زنیم.
      try {
        await api.put(`/vehicles/${vehicleId}/geofence`, {
          type: 'polygon',
          polygonPoints: ring,
          toleranceM,
        });
      } catch {
        await api.post(`/vehicles/${vehicleId}/geofence`, {
          type: 'polygon',
          polygonPoints: ring,
          toleranceM,
        });
      }

      // ریفرش UI
      await loadVehicleRoute(vehicleId);
      await loadVehicleGeofences(vehicleId);

      // ریست UI ترسیم
      setDrawingRoute(false);
      setRoutePoints([]);
      if (!routeName) setRouteName(name || `Route ${routeId}`);

      alert('مسیر و ژئوفنس با موفقیت ذخیره شد.');
    } catch (e: any) {
      console.error(e?.response?.data || e);
      alert(e?.response?.data?.message || 'ذخیره مسیر/ژئوفنس ناموفق بود.');
    } finally {
      savingRouteRef.current = false;
    }
  }
  // انتخاب راننده
  const [selectedDriverId, setSelectedDriverId] = React.useState<number | null>(null);

  // تخلفات راننده (بر اساس driverId و بازه زمانی)
  type SimpleViolation = {
    id: number;
    type: 'geofence_exit' | 'off_route' | 'speeding' | string;
    created_at: string;
    driver_user_id?: number;
    meta?: {
      point?: { lat: number; lng: number };
      distance_m?: number;
      threshold_m?: number;
      radius_m?: number;
      tolerance_m?: number;
    };
  };

  const loadViolations = useCallback(
    async (vehicleId: number, from = fromISO, to = toISO) => {
      if (!vehicleId) { setViolations([]); return; }

      setViolationsLoading(true);
      try {
        const raw = await fetchVehicleViolations(api, vehicleId, 200);
        const all: Violation[] = (normalizeViolations(raw) || []) as Violation[];

        const fromT = Number.isFinite(+new Date(from)) ? +new Date(from) : -Infinity;
        const toT = Number.isFinite(+new Date(to)) ? +new Date(to) : Infinity;

        const list: SimpleViolation[] = all
          .filter(v => {
            const t = +new Date(
              v.created_at ?? (v as any).at ?? (v as any).time ?? (v as any).createdAt
            );
            return Number.isFinite(t) && t >= fromT && t <= toT;
          })
          .map((v, idx) => {
            const createdAt =
              v.created_at ?? (v as any).at ?? (v as any).time ?? (v as any).createdAt ?? new Date().toISOString();

            // id پایدار: اگر نبود، از شناسه‌های داخل meta یا timestamp+idx بساز
            const stableId =
              (typeof v.id === 'number' ? v.id : undefined) ??
              Number((v.meta as any)?.event_id) ??
              Number((v.meta as any)?.id) ??
              (Date.parse(createdAt) || 0) + idx;

            return {
              id: stableId,
              type: (v.type as any) || 'speeding',
              created_at: createdAt,
              driver_user_id:
                (v as any).driver_user_id ??
                (v as any).driver_id ??
                undefined,
              meta: v.meta ?? {},
            } as SimpleViolation;
          });

        setViolations(list);
      } catch {
        setViolations([]);
      } finally {
        setViolationsLoading(false);
      }
    },
    [api, fromISO, toISO, fetchVehicleViolations]
  );


  // ✅ فقط از /assignments/current/:driverId استفاده کن
  async function fetchDriverViolationsViaAssignment(api: any, driverId: number, limit = 200) {
    try {
      const { data: cur } = await api.get(`/assignments/current/${driverId}`);
      const vid =
        Number(cur?.vehicle_id ?? cur?.vehicleId) ||
        Number(cur?.vehicle?.id) || null;

      if (!vid) return []; // راننده الآن روی ماشینی نیست
      const { data } = await api.get(`/vehicles/${vid}/violations`, { params: { limit } });
      return data;
    } catch {
      return [];
    }
  }




  async function fetchVehicleViolations(api: any, vehicleId: number, limit = 200) {
    const { data } = await api.get(`/vehicles/${vehicleId}/violations`, { params: { limit } });
    return data;
  }

  const [violationsByDid, setViolationsByDid] = React.useState<Record<number, SimpleViolation[]>>({});
  const [vioStatusByDid, setVioStatusByDid] = React.useState<Record<number, 'idle' | 'loading' | 'loaded' | 'error'>>({});
  const [violationFilter, setViolationFilter] = React.useState<'all' | 'geofence_exit' | 'off_route' | 'speeding'>('all');
  const [violationsLoading, setViolationsLoading] = React.useState(false);
  const [selectedViolation, setSelectedViolation] = React.useState<SimpleViolation | null>(null);
  // بالای فایل: هِلفر تبدیل تاریخ به ISO string
  // قبلی: const toISO = (v:any)=>...
  const toIsoStrict = (v: any) => {
    const d = new Date(v);
    return isNaN(+d) ? new Date().toISOString() : d.toISOString();
  };


  const loadDriverViolations = React.useCallback(
    async (driverId: number, from = fromISO, to = toISO) => {
      if (!driverId) { setViolations([]); return; }

      setViolationsLoading(true);
      try {
        const raw = await fetchDriverViolationsViaAssignment(api, driverId, 200);
        const all: Violation[] = (normalizeViolations(raw) || []) as Violation[];

        const fromT = Number.isFinite(+new Date(from)) ? +new Date(from) : -Infinity;
        const toT = Number.isFinite(+new Date(to)) ? +new Date(to) : Infinity;

        const list: SimpleViolation[] = all
          .filter(v => {
            const t = +new Date(v.created_at ?? (v as any).at ?? (v as any).time ?? (v as any).createdAt);
            return Number.isFinite(t) && t >= fromT && t <= toT;
          })
          .map((v, idx) => {
            const createdAtISO =
              (v.created_at
                ?? (v as any).at
                ?? (v as any).time
                ?? (v as any).createdAt
                ?? new Date().toISOString());

            const created_at = new Date(createdAtISO).toISOString(); // ⬅️ تضمین string

            const stableId =
              (typeof v.id === 'number' ? v.id : undefined) ??
              Number(v.meta?.event_id) ??
              Number((v.meta as any)?.id) ??
              (Date.parse(created_at) || 0) + idx;

            return {
              id: stableId,
              type: (v.type as any) || 'speeding',
              created_at, // ⬅️ string
              driver_user_id: (v as any).driver_id ?? (v as any).driver_user_id ?? driverId,
              meta: v.meta ?? {},
            };
          });

        setViolations(list);
      } catch {
        setViolations([]);
      } finally {
        setViolationsLoading(false);
      }
    },
    [api, fromISO, toISO] // ⚠️ تابع fetchDriverViolationsViaAssignment را در deps نگذار تا فچ لوپ نشود
  );



  useEffect(() => {
    if (selectedDriverId && fromISO && toISO) {
      loadDriverViolations(selectedDriverId, fromISO, toISO);
    }
  }, [selectedDriverId, fromISO, toISO, loadDriverViolations]);



  // per-vehicle caches
  const [routeMetaByVid, setRouteMetaByVid] =
    React.useState<Record<number, RouteMeta | null>>({});
  const [routePointsByRid, setRoutePointsByRid] =
    React.useState<Record<number, RoutePoint[]>>({});
  const [routePolylineByVid, setRoutePolylineByVid] =
    React.useState<Record<number, [number, number][]>>({});
  const [routeBusyByVid, setRouteBusyByVid] =
    React.useState<Record<number, 'idle' | 'loading' | 'error'>>({});
  // /routes/:rid/stations  یا  /routes/:rid/points  یا شکل‌های متفاوت
  const normalizeRoutePoints = (payload: any): RoutePoint[] => {
    const arr: any[] =
      Array.isArray(payload) ? payload :
        Array.isArray(payload?.items) ? payload.items :
          Array.isArray(payload?.data?.items) ? payload.data.items :
            Array.isArray(payload?.data) ? payload.data :
              Array.isArray(payload?.rows) ? payload.rows :
                Array.isArray(payload?.points) ? payload.points :
                  Array.isArray(payload?.stations) ? payload.stations :
                    [];

    const num = (v: any) => {
      const n = Number(v); return Number.isFinite(n) ? n : NaN;
    };

    // پشتیبانی از خروجی‌های snake/camel
    const out = arr.map((p: any) => {
      const lat = num(p.lat ?? p.latitude ?? p.y);
      const lng = num(p.lng ?? p.longitude ?? p.x);
      return ({
        lat, lng,
        name: p.name ?? p.title ?? null,
        radius_m: Number.isFinite(num(p.radius_m ?? p.radiusM ?? p.radius)) ? num(p.radius_m ?? p.radiusM ?? p.radius) : null,
      });
    }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    // مرتب‌سازی بر اساس order_no اگر وجود دارد
    out.sort((a: any, b: any) =>
      (Number(a.order_no ?? a.orderNo ?? a.order ?? 0) - Number(b.order_no ?? b.orderNo ?? b.order ?? 0))
    );

    return out;
  };
  const [violations, setViolations] = React.useState<SimpleViolation[]>([]);

  const fetchVehicleCurrentRouteMeta = async (vid: number): Promise<RouteMeta | null> => {
    const tries = [
      () => api.get(`/vehicles/${vid}/routes/current`), // 👈 خواسته‌ی شما
      () => api.get(`/vehicles/${vid}/current-route`),
      () => api.get(`/vehicles/${vid}/route`),
    ];
    for (const t of tries) {
      try {
        const { data } = await t();
        // برخی APIها خروجی را داخل route می‌گذارند
        const r = data?.route || data;
        if (r?.id) {
          return {
            id: Number(r.id),
            name: r.name ?? null,
            threshold_m: r.threshold_m ?? r.thresholdM ?? null,
          };
        }
        // بعضی‌ها هم به‌صورت扮 route_id
        if (data?.route_id) {
          return {
            id: Number(data.route_id),
            name: data.name ?? null,
            threshold_m: data.threshold_m ?? data.thresholdM ?? null,
          };
        }
      } catch { /* try next */ }
    }
    return null;
  };
  // مسیر مأموریت‌های راننده از دیتابیس
  const loadDriverTrack = async (driverId: number) => {
    setPolyline([]); // پاک کردن مسیر قبلی
    try {
      // ۱. درخواست به API جدید و صحیح برای دریافت مأموریت‌ها
      const { data } = await api.get<{ items: DriverMission[] }>(`/driver-routes/by-driver/${driverId}`, {
        params: { from: fromISO, to: toISO, limit: 1000 }, // limit بالا برای گرفتن تمام ماموریت‌ها
      });

      // ۲. پردازش پاسخ جدید: تمام آرایه‌های gps_points را به هم می‌چسبانیم
      const allMissions: DriverMission[] = data.items || [];
      const allPoints = allMissions.flatMap((mission) => mission.gps_points || []);

      // ۳. آپدیت state نقشه با تمام نقاط
      if (allPoints.length > 0) {
        setPolyline(allPoints.map((p: GpsPoint) => [p.lat, p.lng]));
      }

    } catch (e) {
      console.error("Failed to load driver track from API, falling back to live data:", e);
      // فالبک روی داده‌های زنده
      const liveTrackForDriver = driverLive[driverId] || [];
      const filteredLivePoints = liveTrackForDriver.filter(
        (point: [number, number, number]) => point[2] >= +new Date(fromISO) && point[2] <= +new Date(toISO)
      );
      setPolyline(filteredLivePoints.map((point: [number, number, number]) => [point[0], point[1]]));
    }
  };
  // فقط شیت را باز کن، هیچ فچی اینجا نزن
  const onPickDriver = (d: any) => {
    setSelectedDriverId(d.id);
    setSelectedVehicleId(null);
    setSelectedViolation(null);
    setSheetMode('driver');
    setSheetOpen(true);
  };
  // ــ بالای فایل (خارج از کامپوننت)
  const _inflightAssign = new Map<number, Promise<number | null>>();

  function getCurrentVehicleIdSafe(api: any, driverId: number): Promise<number | null> {
    if (_inflightAssign.has(driverId)) return _inflightAssign.get(driverId)!;
    const p = (async () => {
      try {
        const { data } = await api.get(`/assignments/current/${driverId}`, {
          params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }
        });
        const vid =
          Number(data?.vehicle_id ?? data?.vehicleId) ||
          Number(data?.vehicle?.id) || null;
        return Number.isFinite(vid!) && vid! > 0 ? vid! : null;
      } catch {
        return null;
      } finally {
        _inflightAssign.delete(driverId);
      }
    })();
    _inflightAssign.set(driverId, p);
    return p;
  }

  async function fetchDriverViolationsSmart(
    api: any,
    driverId: number,
    { from, to, limit = 200 }: { from: string; to: string; limit?: number }
  ) {
    const params: any = { from, to, limit };
    const vid = await getCurrentVehicleIdSafe(api, driverId);

    // 1) بر اساس vehicle اگر assignment وجود داشت
    if (vid) {
      try {
        const { data } = await api.get(`/vehicles/${vid}/violations`, { params });
        return data;
      } catch { /* فالبک به درایور */ }
    }

    // 2) فالبک‌های بر پایهٔ راننده (حتی وقتی assignment خالی است)
    try {
      const { data } = await api.get('/violations', { params: { ...params, driver_id: String(driverId) } });
      return data;
    } catch { }

    try {
      const { data } = await api.get(`/drivers/${driverId}/violations`, { params });
      return data;
    } catch { }

    try {
      const { data } = await api.get('/events', { params: { ...params, category: 'violation', driver_id: String(driverId) } });
      return data;
    } catch { }

    return [];
  }






  // نقاط مسیر بر اساس routeId
  // نقاط مسیر — اول /points بعد /stations (طبق خواسته‌ی شما)
  const fetchRoutePoints = async (routeId: number): Promise<RoutePoint[]> => {
    const tries = [
      () => api.get(`/routes/${routeId}/points`),   // 👈 اول points
      () => api.get(`/routes/${routeId}/stations`), //    بعد stations
    ];
    for (const t of tries) {
      try {
        const { data } = await t();
        return normalizeRoutePoints(data);
      } catch { /* try next */ }
    }
    return [];
  };


  // ست/آپدیت مسیر فعلی ماشین (اختیاری threshold)
  const setOrUpdateVehicleRoute = async (vid: number, body: { route_id?: number; threshold_m?: number }) => {
    // PATCH/PUT ها متنوع‌اند؛ همه را هندل می‌کنیم
    const tries = [
      () => api.patch(`/vehicles/${vid}/route`, body),
      () => api.put(`/vehicles/${vid}/route`, body),
      () => api.post(`/vehicles/${vid}/route`, body),
    ];
    for (const t of tries) {
      try { return await t(); } catch { /* next */ }
    }
  };

  // لغو مسیر فعلی ماشین
  // لغو/برداشتن مسیر فعلی ماشین — فقط DELETE
  const clearVehicleRoute = async (vid: number) => {
    const tries = [
      // رایج‌ترین‌ها
      () => api.delete(`/vehicles/${vid}/route`),
      () => api.delete(`/vehicles/${vid}/route/unassign`),

      // چند فالبک احتمالی
      () => api.delete(`/vehicles/${vid}/routes/current`),
      () => api.delete(`/vehicles/${vid}/current-route`),
    ];

    let lastErr: any;
    for (const t of tries) {
      try { return await t(); } catch (e) { lastErr = e; }
    }
    throw lastErr;
  };


  // لیست مسیرهای قابل‌انتخاب برای یک ماشین
  const listVehicleRoutes = async (vid: number): Promise<RouteMeta[]> => {
    try {
      const { data } = await api.get(`/vehicles/${vid}/routes`);
      const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      return arr
        .map((r: any) => ({ id: Number(r.id), name: r.name ?? null, threshold_m: r.threshold_m ?? r.thresholdM ?? null }))
        .filter((r: any) => Number.isFinite(r.id));
    } catch { return []; }
  };
  const loadVehicleRoute = React.useCallback(async (vid: number) => {
    setRouteBusyByVid(p => ({ ...p, [vid]: 'loading' }));
    try {
      const meta = await fetchVehicleCurrentRouteMeta(vid);
      setRouteMetaByVid(p => ({ ...p, [vid]: meta }));

      if (meta?.id) {
        // کش نقاط مسیر
        let pts = routePointsByRid[meta.id];
        if (!pts) {
          pts = await fetchRoutePoints(meta.id);
          setRoutePointsByRid(p => ({ ...p, [meta.id]: pts }));
        }
        const line: [number, number][] = (pts || []).map(p => [p.lat, p.lng]);
        setRoutePolylineByVid(prev => ({ ...prev, [vid]: line }));
      } else {
        setRoutePolylineByVid(prev => ({ ...prev, [vid]: [] }));
      }
      setRouteBusyByVid(p => ({ ...p, [vid]: 'loaded' }));
    } catch {
      setRouteBusyByVid(p => ({ ...p, [vid]: 'error' }));
    }
  }, [routePointsByRid]);


  // ===== Consumables (per vehicle) =====
  type ConsumableItem = {
    id?: number;
    mode: 'km' | 'time';
    note?: string;
    title?: string;
    start_at?: string | null;
    base_odometer_km?: number | null;
    created_at?: string | null;
    vehicle_id?: number | null;
  };

  const [consumablesByVid, setConsumablesByVid] =
    React.useState<Record<number, ConsumableItem[]>>({});
  const [consStatusByVid, setConsStatusByVid] =
    React.useState<Record<number, 'idle' | 'loading' | 'loaded' | 'error'>>({});

  // دیالوگ‌ها/فرم
  const [consumablesOpen, setConsumablesOpen] = React.useState(false);
  const [editingCons, setEditingCons] = React.useState<any | null>(null);
  const [savingCons, setSavingCons] = React.useState(false);
  const [consumableMode, setConsumableMode] = React.useState<'time' | 'km'>('km');
  const [tripNote, setTripNote] = React.useState('');
  const [tripDate, setTripDate] = React.useState<Date | null>(new Date());
  const [tripBaseKm, setTripBaseKm] = React.useState<number | null>(null);

  // تله‌متری لازم برای چکِ کیلومتر
  const [vehicleTlm, setVehicleTlm] = React.useState<{
    ignition?: boolean;
    idle_time?: number;
    odometer?: number;
  }>({});
  // نوتیف فقط-یکبار
  const notifiedRef = React.useRef<Set<string>>(new Set());
  const [toast, setToast] = React.useState<{ open: boolean; msg: string } | null>(null);

  // helpers
  const CONS_KEY = (vid: number) => `consumables_${vid}`;
  const loadConsLocal = (vid: number) => {
    try {
      const raw = localStorage.getItem(CONS_KEY(vid));
      if (!raw) return [] as ConsumableItem[];
      return normalizeConsumables(JSON.parse(raw));
    } catch { return [] as ConsumableItem[]; }
  };
  const saveConsLocal = (vid: number, items: ConsumableItem[]) => {
    try { localStorage.setItem(CONS_KEY(vid), JSON.stringify(items)); } catch { }
  };

  const normalizeConsumables = (payload: any): ConsumableItem[] => {
    let arr: any[] =
      Array.isArray(payload) ? payload :
        Array.isArray(payload?.items) ? payload.items :
          Array.isArray(payload?.data?.items) ? payload.data.items :
            Array.isArray(payload?.data) ? payload.data :
              Array.isArray(payload?.result) ? payload.result :
                Array.isArray(payload?.consumables) ? payload.consumables :
                  Array.isArray(payload?.rows) ? payload.rows :
                    (payload && typeof payload === 'object' ? [payload] : []);

    const toNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
    const toISO = (v: any) => { if (!v) return null; const t = new Date(v); return isNaN(+t) ? null : t.toISOString(); };

    const out = arr.map((c: any) => ({
      id: c.id ?? c._id ?? undefined,
      mode: (c.mode ?? c.type) === 'time' ? 'time' : 'km',
      note: c.note ?? c.description ?? '',
      title: c.title ?? c.name ?? c.note ?? undefined,
      created_at: toISO(c.created_at ?? c.createdAt),
      start_at: toISO(c.start_at ?? c.startAt ?? c.start_time ?? c.startTime),
      base_odometer_km: toNum(c.base_odometer_km ?? c.baseOdometerKm ?? c.base_odo ?? c.base_odo_km),
      vehicle_id: c.vehicle_id ?? c.vehicleId ?? null,
    }));

    const keyOf = (x: any) => x.id ?? `${x.mode}:${x.start_at ?? x.base_odometer_km ?? x.note ?? ''}`;
    const map = new Map<string | number, any>();
    out.forEach(x => map.set(keyOf(x), x));
    return Array.from(map.values());
  };

  async function createConsumable(
    vid: number,
    payload: { mode: 'km' | 'time'; note: string; start_at?: string | null; base_odometer_km?: number | null }
  ) {
    const snake = payload.mode === 'time'
      ? { mode: 'time', note: payload.note, start_at: payload.start_at }
      : { mode: 'km', note: payload.note, base_odometer_km: payload.base_odometer_km };
    try {
      return await api.post(`/vehicles/${vid}/consumables`, snake);
    } catch {
      const camel = payload.mode === 'time'
        ? { mode: 'time', note: payload.note, startAt: payload.start_at }
        : { mode: 'km', note: payload.note, baseOdometerKm: payload.base_odometer_km };
      try {
        return await api.post(`/vehicles/${vid}/consumables`, camel);
      } catch {
        try { return await api.post(`/vehicles/${vid}/consumables`, { consumable: snake }); }
        catch { return await api.post(`/vehicles/${vid}/consumables`, { consumable: camel }); }
      }
    }
  }
  async function updateConsumable(
    vid: number, id: number,
    payload: { mode: 'km' | 'time'; note: string; start_at?: string | null; base_odometer_km?: number | null }
  ) {
    const snake = payload.mode === 'time'
      ? { mode: 'time', note: payload.note, start_at: payload.start_at }
      : { mode: 'km', note: payload.note, base_odometer_km: payload.base_odometer_km };
    try {
      return await api.patch(`/vehicles/${vid}/consumables/${id}`, snake);
    } catch {
      const camel = payload.mode === 'time'
        ? { mode: 'time', note: payload.note, startAt: payload.start_at }
        : { mode: 'km', note: payload.note, baseOdometerKm: payload.base_odometer_km };
      return await api.patch(`/vehicles/${vid}/consumables/${id}`, camel);
    }
  }

  const consReqIdRef = React.useRef<Record<number, number>>({});
  const refreshConsumables = React.useCallback(async (vid: number, forceServer = false) => {
    const myId = (consReqIdRef.current[vid] || 0) + 1;
    consReqIdRef.current[vid] = myId;
    setConsStatusByVid(p => ({ ...p, [vid]: 'loading' }));

    if (!forceServer) {
      const cached = loadConsLocal(vid);
      if (cached.length) {
        setConsumablesByVid(p => ({ ...p, [vid]: cached }));
        setConsStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
      }
    }

    try {
      const { data } = await api.get(`/vehicles/${vid}/consumables`, {
        params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }
      });
      if (consReqIdRef.current[vid] !== myId) return;
      const list = normalizeConsumables(data);
      saveConsLocal(vid, list);
      setConsumablesByVid(p => ({ ...p, [vid]: list }));
      setConsStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
    } catch {
      if (consReqIdRef.current[vid] !== myId) return;
      setConsStatusByVid(p => ({ ...p, [vid]: 'error' }));
    }
  }, []);

  const resolveParentSA = React.useCallback(
    async (uid: number): Promise<{ id: number; name: string } | null> => {
      // 1) تلاش از روی پالیسی‌ها (اگه owner داخلشون بود)
      try {
        const { data } = await api.get(`/vehicle-policies/user/${uid}`, { params: { onlyAllowed: true } });
        const rows: any[] = Array.isArray(data) ? data : [];
        const pickNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
        const ownerIds = Array.from(new Set(
          rows.flatMap(r => [
            pickNum(r.owner_user_id), pickNum(r.ownerId),
            pickNum(r.super_admin_user_id), pickNum(r.superAdminUserId),
            pickNum(r.grantor_user_id), pickNum(r.grantorUserId),
          ].filter(Boolean))
        )) as number[];

        for (const oid of ownerIds) {
          try {
            const test = await api.get('/vehicles', { params: { owner_user_id: String(oid), limit: 1 } });
            const items = Array.isArray(test.data?.items) ? test.data.items : (Array.isArray(test.data) ? test.data : []);
            if (items.length) {
              const row = rows.find(rr =>
                [rr.owner_user_id, rr.ownerId, rr.super_admin_user_id, rr.superAdminUserId, rr.grantor_user_id, rr.grantorUserId]
                  .map((x: any) => Number(x)).includes(oid)
              );
              return { id: oid, name: String(row?.owner_name ?? row?.ownerName ?? 'سوپرادمین') };
            }
          } catch { }
        }
      } catch { }

      // 2) فـال‌بک مطمئن: جدِ level=2 از بک‌اند
      try {
        const { data } = await api.get('/users/my-ancestor', { params: { level: 2 } });
        if (data?.id) return { id: Number(data.id), name: String(data.full_name || 'سوپرادمین') };
      } catch { }

      return null;
    },
    []
  );
  const [vehicleStationsMap, setVehicleStationsMap] = React.useState<Record<number, Station[]>>({});
  const [routeByVid, setRouteByVid] =
    React.useState<Record<number, { id: number; threshold_m?: number }>>({});
  // قبلی را پاک کن و این را بگذار
  const fetchStations = async (vid: number) => {
    try {
      const { data } = await api.get(`/vehicles/${vid}/stations`);
      const rows: any[] = Array.isArray(data) ? data : [];

      const stations: Station[] = rows.map((p: any) => ({
        id: Number(p.id),
        name: p.name ?? p.title ?? null,
        lat: roundLL(Number(p.lat)),
        lng: roundLL(Number(p.lng)),
        radius_m: Number(p.radius_m ?? p.radiusM ?? 60),
      }));

      setVehicleStationsMap(prev => ({ ...prev, [vid]: stations }));
    } catch {
      setVehicleStationsMap(prev => ({ ...prev, [vid]: [] }));
    }
  };

  // ⬇️ این تابع قبلی‌ت رو به‌طور کامل با این نسخه جایگزین کن

  const ensureStationsLive = React.useCallback(
    async (vid: number) => {
      if (!vehicleStationsMap[vid]) {
        await fetchStations(vid).catch(() => { });
      }

      const s = socketRef.current;
      if (!s) return;

      if (lastStationsSubRef.current && lastStationsSubRef.current.vid !== vid) {
        const { vid: pvid, uid } = lastStationsSubRef.current;
        s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations/${user.id}` });
        s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations` });
        lastStationsSubRef.current = null;
      }

      s.emit('subscribe', { topic: `vehicle/${vid}/stations/${user.id}` });
      s.emit('subscribe', { topic: `vehicle/${vid}/stations` });
      lastStationsSubRef.current = { vid, uid: user.id };
    },
    [user.id, vehicleStationsMap, fetchStations]
  );



  // === استایل‌های شبیه سوپرادمین ===
  const ROUTE_STYLE = {
    outline: { color: '#0d47a1', weight: 8, opacity: 0.25 },
    main: { color: '#1e88e5', weight: 5, opacity: 0.9 },
  };
  const ROUTE_COLORS = { start: '#43a047', end: '#e53935', point: '#1565c0' };

  const numberedIcon = (n: number) =>
    L.divIcon({
      className: 'route-idx',
      html: `<div style="
      width:22px;height:22px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:12px;color:#fff;background:${ROUTE_COLORS.point};
      box-shadow:0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.3);
    ">${n}</div>`,
      iconSize: [22, 22], iconAnchor: [11, 11],
    });

  const badgeIcon = (txt: string, bg: string) =>
    L.divIcon({
      className: 'route-badge',
      html: `<div style="
      padding:3px 6px;border-radius:6px;
      font-weight:700;font-size:11px;color:#fff;background:${bg};
      box-shadow:0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.3)
    ">${txt}</div>`,
      iconSize: [1, 1], iconAnchor: [10, 10],
    });

  function FitToRoute({ line, points }: { line: [number, number][], points: { lat: number; lng: number; radius_m?: number | null }[] }) {
    const map = useMap();
    React.useEffect(() => {
      const b = L.latLngBounds([]);
      line.forEach(([lat, lng]) => b.extend([lat, lng]));
      points.forEach(p => b.extend([p.lat, p.lng]));
      if (b.isValid()) map.fitBounds(b.pad(0.2));
    }, [map, JSON.stringify(line), JSON.stringify(points)]);
    return null;
  }

  function RouteLayer({ vid }: { vid: number | null }) {
    const meta = vid ? (routeMetaByVid[vid] || null) : null;
    const rid = meta?.id ?? null;
    const line = vid ? (routePolylineByVid[vid] || []) : [];
    const pts = rid ? (routePointsByRid[rid] || []) : [];

    if (!vid || line.length < 2) return null;

    const bufferRadius = Math.max(1, Number(meta?.threshold_m ?? 60));
    const bufferPoly = React.useMemo(
      () => buildRouteBufferPolygon(pts.map(p => ({ lat: p.lat, lng: p.lng })), bufferRadius),
      [JSON.stringify(pts), bufferRadius]
    );

    return (
      <>
        <FitToRoute line={line} points={pts} />

        {/* اوت‌لاین و خط اصلی مسیر */}
        <Polyline positions={line} pathOptions={{ color: '#0d47a1', weight: 8, opacity: 0.25 }} />
        <Polyline positions={line} pathOptions={{ color: '#1e88e5', weight: 5, opacity: 0.9 }} />

        {/* بافر مسیر */}
        {bufferPoly.length >= 3 && (
          <Polygon
            positions={bufferPoly.map(p => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: '#1e88e5', weight: 1, opacity: 0.4, fillOpacity: 0.08 }}
          />
        )}

        {/* فقط دایرهٔ شعاع نقاط (بدون مارکر/عدد) */}
        {pts.map((p, i) => (
          Number.isFinite(p.radius_m as any) && (p.radius_m! > 0) && (
            <Circle
              key={`rpt-${rid}-${i}`}
              center={[p.lat, p.lng]}
              radius={p.radius_m!}
              pathOptions={{ color: '#3949ab', opacity: 0.35, fillOpacity: 0.06 }}
            />
          )
        ))}
      </>
    );
  }





  // === Geometry helpers: LL ⇄ XY + buffer polygon (exactly as requested) ===
  function toXY(lat: number, lng: number, lat0: number, lng0: number): [number, number] {
    const R = 6371000;
    const dLat = (lat - lat0) * Math.PI / 180;
    const dLng = (lng - lng0) * Math.PI / 180;
    const x = dLng * Math.cos((lat0 * Math.PI) / 180) * R;
    const y = dLat * R;
    return [x, y];
  }
  function toLL(x: number, y: number, lat0: number, lng0: number) {
    const R = 6371000, toDeg = (r: number) => (r * 180) / Math.PI;
    return {
      lat: lat0 + toDeg(y / R),
      lng: lng0 + toDeg(x / (R * Math.cos((lat0 * Math.PI) / 180))),
    };
  }
  function lineIntersect(
    p: [number, number], r: [number, number],
    q: [number, number], s: [number, number]
  ): [number, number] | null {
    const [rx, ry] = r, [sx, sy] = s;
    const det = rx * sy - ry * sx;
    if (Math.abs(det) < 1e-9) return null; // parallel-ish
    const [px, py] = p, [qx, qy] = q;
    const t = ((qx - px) * sy - (qy - py) * sx) / det;
    return [px + t * rx, py + t * ry];
  }
  /** می‌سازد یک پولیگون بافر دور کل مسیر (m) */
  function buildRouteBufferPolygon(
    pts: { lat: number; lng: number }[],
    radius_m: number
  ): { lat: number; lng: number }[] {
    if (!pts || pts.length < 2) return [];
    const lat0 = pts[0].lat, lng0 = pts[0].lng;
    const P = pts.map(p => toXY(p.lat, p.lng, lat0, lng0));
    const L = P.length;
    const left: [number, number][] = [], right: [number, number][] = [];
    const dir: [number, number][] = [], nor: [number, number][] = [];
    for (let i = 0; i < L - 1; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[i + 1];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1e-9;
      const ux = dx / len, uy = dy / len;
      dir.push([ux, uy]);
      nor.push([-uy, ux]); // left normal
    }
    { // start cap (flat)
      const [x, y] = P[0], [nx, ny] = nor[0];
      left.push([x + nx * radius_m, y + ny * radius_m]);
      right.push([x - nx * radius_m, y - ny * radius_m]);
    }
    for (let i = 1; i < L - 1; i++) {
      const Pi = P[i];
      const uPrev = dir[i - 1], nPrev = nor[i - 1];
      const uNext = dir[i], nNext = nor[i];
      const a1: [number, number] = [Pi[0] + nPrev[0] * radius_m, Pi[1] + nPrev[1] * radius_m];
      const r1: [number, number] = uPrev;
      const a2: [number, number] = [Pi[0] + nNext[0] * radius_m, Pi[1] + nNext[1] * radius_m];
      const r2: [number, number] = uNext;
      let Lp = lineIntersect(a1, r1, a2, r2);
      if (!Lp) Lp = a2; // bevel fallback
      left.push(Lp);
      const b1: [number, number] = [Pi[0] - nPrev[0] * radius_m, Pi[1] - nPrev[1] * radius_m];
      const b2: [number, number] = [Pi[0] - nNext[0] * radius_m, Pi[1] - nNext[1] * radius_m];
      let Rp = lineIntersect(b1, r1, b2, r2);
      if (!Rp) Rp = b2;
      right.push(Rp);
    }
    { // end cap (flat)
      const [x, y] = P[L - 1], [nx, ny] = nor[nor.length - 1];
      left.push([x + nx * radius_m, y + ny * radius_m]);
      right.push([x - nx * radius_m, y - ny * radius_m]);
    }
    const ringXY = [...left, ...right.reverse()];
    return ringXY.map(([x, y]) => toLL(x, y, lat0, lng0));
  }


  const can = (k: string) => allowed.has(k);
  const canTrackDrivers = React.useMemo(() => can('track_driver'), [allowed]);
  const canSeeVehicle = user?.role_level === 2 || can('view_vehicle');

  // ===== Types =====
  type MonitorKey = typeof MONITOR_PARAMS[number]['key'];
  type VehicleTypeCode = typeof VEHICLE_TYPES[number]['code'];
  type DriverStats = { totalDistanceKm?: number; totalDurationMin?: number; jobsCount?: number; breakdownsCount?: number; };
  type DriverExtra = { license_no?: string; lastSeenAt?: string | null; currentVehicle?: { id: number; plate_no: string; vehicle_type_code?: string } | null; };
  type Station = { id: number; name: string; lat: number; lng: number; radius_m: number };
  type Vehicle = { id: number; plate_no: string; vehicle_type_code: VehicleTypeCode; last_location?: { lat: number; lng: number } };

  // ===== State (راننده‌ها) =====
  const [drivers, setDrivers] = React.useState<User[]>([]);
  const [statsMap, setStatsMap] = React.useState<Record<number, DriverStats>>({});
  const [extras, setExtras] = React.useState<Record<number, DriverExtra>>({});
  const [loading, setLoading] = React.useState(true);

  // ✅ قابلیت‌های اعطاشده توسط SA به تفکیک نوع خودرو
  const [grantedPerType, setGrantedPerType] = React.useState<Record<VehicleTypeCode, MonitorKey[]>>({});
  const [parentSAName, setParentSAName] = React.useState<string | null>(null);

  // ===== تب‌ها: راننده‌ها + تب‌های خودرویی به تفکیک نوع =====


  // وقتی اولین grant رسید، تب همان نوع را خودکار باز کن (خواسته‌ی شما)
  React.useEffect(() => {
    const types = Object.keys(grantedPerType) as VehicleTypeCode[];
    const firstWithGrants = types.find(t => (grantedPerType[t] || []).length > 0);
    if (firstWithGrants) setTab(firstWithGrants);
  }, [grantedPerType]);

  // ===== بازه‌ی زمانی =====
  const [preset, setPreset] = React.useState<'today' | 'yesterday' | '7d' | 'custom'>('today');

  React.useEffect(() => {
    const now = new Date();
    if (preset === 'today') { setFromISO(new Date(new Date().setHours(0, 0, 0, 0)).toISOString()); setToISO(now.toISOString()); }
    else if (preset === 'yesterday') { const s = new Date(); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setHours(23, 59, 59, 999); setFromISO(s.toISOString()); setToISO(e.toISOString()); }
    else if (preset === '7d') { const s = new Date(); s.setDate(s.getDate() - 7); setFromISO(s.toISOString()); setToISO(now.toISOString()); }
  }, [preset]);

  // ===== helpers (fetch راننده‌ها + KPI) =====
  const normalizeUsersToDrivers = (arr: any[]): User[] =>
    (arr || []).map((u: any) => ({ id: u.id, role_level: 6, full_name: u.full_name ?? u.name ?? '—', phone: u.phone ?? '', ...(u.last_location ? { last_location: u.last_location } : {}) }));

  const fetchBranchDrivers = async (): Promise<User[]> => {
    try {
      const { data } = await api.get('/users/my-subordinates-flat');
      return normalizeUsersToDrivers((data || []).filter((u: any) => (u?.role_level ?? 6) === 6));
    } catch { }
    const tries = [
      () => api.get(`/users/branch-manager/${user.id}/subordinates`),
      () => api.get('/users', { params: { branch_manager_user_id: user.id, role_level: 6, limit: 1000 } }),
      () => api.get('/drivers', { params: { branch_manager_user_id: user.id, limit: 1000 } }),
    ];
    for (const fn of tries) {
      try {
        const { data } = await fn();
        const items = data?.items ?? data ?? [];
        const out = Array.isArray(items) ? normalizeUsersToDrivers(items) : normalizeUsersToDrivers([items]);
        if (out.length) return out;
      } catch { }
    }
    return [];
  };

  const toRad = (x: number) => x * Math.PI / 180, R = 6371;
  const hav = (a: [number, number], b: [number, number]) => {
    const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]), lat1 = toRad(a[0]), lat2 = toRad(b[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const fetchStats = React.useCallback(async (ids: number[], from: string, to: string) => {
    const settled = await Promise.allSettled(ids.map(id => api.get(`/driver-routes/stats/${id}`, { params: { from, to } })));
    const entries: [number, DriverStats][] = []; const fallbackIds: number[] = [];
    settled.forEach((r, i) => { const id = ids[i]; if (r.status === 'fulfilled') entries.push([id, r.value?.data ?? {}]); else fallbackIds.push(id); });
    if (fallbackIds.length) {
      const tr = await Promise.allSettled(fallbackIds.map(id => api.get('/tracks', { params: { driver_id: id, from, to } }).then(res => ({ id, data: res.data }))));
      tr.forEach(fr => { if (fr.status === 'fulfilled') { const { id, data } = fr.value as any; const pts: { lat: number; lng: number }[] = Array.isArray(data) ? data : data?.items || []; let d = 0; for (let i = 1; i < pts.length; i++) d += hav([pts[i - 1].lat, pts[i - 1].lng], [pts[i].lat, pts[i].lng]); entries.push([id, { totalDistanceKm: +d.toFixed(2) }]); } });
    }
    setStatsMap(Object.fromEntries(entries));
  }, []);
  const [parentSAId, setParentSAId] = React.useState<number | null>(null);

  // ===== SA parent & granted policies =====
  // کمک‌تابع‌ها
  // بالای فایل (کنار تایپ‌ها)
  // کمک‌تابع‌ها


  // 👇 از روی parentSAId فقط از /vehicles و /users/:id/vehicles می‌گیریم
  const ensureArray = (data: any) =>
    Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);

  const normType = (s?: string) => String(s || '').toLowerCase().replace(/[-_]/g, '');




  // برای جلوگیری از race-condition در fetch ها (به ازای هر نوع خودرو)
  const lastFetchReq = React.useRef<Record<VehicleTypeCode, number>>({});

  const fetchVehiclesOfType = React.useCallback(
    async (vt: VehicleTypeCode) => {
      if (!parentSAId) return;
      const rid = Date.now();
      lastFetchReq.current[vt] = rid;

      const apply = (items: any[]) => {
        if (lastFetchReq.current[vt] !== rid) return;

        const list = (items || [])
          .map((v: any) => {
            const ll = v.last_location
              ? {
                lat: roundLL(Number(v.last_location.lat)),
                lng: roundLL(Number(v.last_location.lng)),
              }
              : undefined;

            return {
              id: Number(v.id),
              plate_no: String(v.plate_no ?? v.plateNo ?? ''),
              vehicle_type_code: normType(v.vehicle_type_code ?? v.vehicleTypeCode) as VehicleTypeCode,
              ...(ll ? { last_location: ll } : {}),
              created_at: v.created_at ?? v.createdAt ?? null,
            };
          })
          .sort((a, b) => a.plate_no.localeCompare(b.plate_no, 'fa', { numeric: true }));

        setVehiclesByType(prev => ({ ...prev, [vt]: list }));
        console.log(`[BM] fetched ${list.length} vehicles for <${vt}> from SA=${parentSAId}`);
      };


      try {
        const { data } = await api.get('/vehicles', { params: { owner_user_id: String(parentSAId), limit: 1000 } });
        const all = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        const items = all.filter((v: any) => normType(v.vehicle_type_code ?? v.vehicleTypeCode) === normType(vt));
        apply(items);
      } catch (e) {
        console.warn('[fetchVehiclesOfType] failed:', e);
        apply([]);
      }
    },
    [parentSAId]
  );

  const [policyRows, setPolicyRows] = React.useState<any[]>([]);

  const availableTypes: VehicleTypeCode[] = React.useMemo(() => {
    const set = new Set<VehicleTypeCode>();
    policyRows.forEach(r => {
      const vt = normType(r?.vehicle_type_code ?? r?.vehicleTypeCode) as VehicleTypeCode;
      if (vt) set.add(vt);
    });
    return Array.from(set);
  }, [policyRows]);




  React.useEffect(() => {
    if (!activeType) return;
    fetchVehiclesOfType(activeType);
  }, [activeType, parentSAId, fetchVehiclesOfType]);


  const pick = (...vals: any[]) => vals.find(v => v !== undefined && v !== null && v !== '');
  const [vehiclesByType, setVehiclesByType] = React.useState<Record<VehicleTypeCode, Vehicle[]>>({});




  // NEW: آی‌دی سوپرادمین(های) والد Branch Manager
  // ⬅️ SA والد

  // اولین اجداد با role_level = 2 را پیدا می‌کند
  // stateهای مرتبط


  // همونی که قبلاً ساختی:
  // ✅ به‌جای getParentSAId که روی /users/:id می‌رفت




  /* React.useEffect(() => {
     if (!user?.id) return;
     let alive = true;
     (async () => {
       const sa = await getParentSAFromPolicies(user.id);
       if (!alive) return;
       setParentSA(sa);
       setParentSAId(sa?.id ?? null);
       setParentSAName(sa?.name ?? null);
     })();
     return () => { alive = false; };
   }, [user?.id, getParentSAFromPolicies]);
 */


  React.useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      const sa = await resolveParentSA(user.id);
      if (!alive) return;
      setParentSA(sa);
      setParentSAId(sa?.id ?? null);
      setParentSAName(sa?.name ?? null);
      console.log('[BM] parentSA resolved =>', sa);
    })();
    return () => { alive = false; };
  }, [user?.id, resolveParentSA]);


  const fetchGrantedPolicies = React.useCallback(async (uid: number) => {
    try {
      const { data } = await api.get(`/vehicle-policies/user/${uid}`, { params: { onlyAllowed: true } });
      const rows: any[] = Array.isArray(data) ? data : [];
      setPolicyRows(rows);

      const map: Record<VehicleTypeCode, MonitorKey[]> = {} as any;
      rows.forEach((row: any) => {
        const vt = String(row?.vehicle_type_code ?? row?.vehicleTypeCode ?? '').toLowerCase() as VehicleTypeCode;
        const arr: MonitorKey[] = Array.isArray(row?.monitor_params ?? row?.monitorParams) ? (row.monitor_params ?? row.monitorParams) : [];
        if (vt) map[vt] = arr;
      });
      setGrantedPerType(map);
    } catch {
      setPolicyRows([]);
      setGrantedPerType({});
    }
  }, []);
  const vehiclesRef = React.useRef<Record<VehicleTypeCode, Vehicle[]>>({});
  React.useEffect(() => { vehiclesRef.current = vehiclesByType; }, [vehiclesByType]);
  // همه‌ی نوع‌هایی که کاربر اجازه دارد (صرف‌نظر از monitor_params)


  // اگر می‌خواهی فقط نوع‌هایی که حداقل یک پارامتر دارند تب شوند:
  const typesWithGrants: VehicleTypeCode[] = React.useMemo(() => {
    const withParams = new Set<VehicleTypeCode>(
      (Object.keys(grantedPerType) as VehicleTypeCode[]).filter(vt => (grantedPerType[vt] || []).length > 0)
    );
    // اتحــاد: یا پارامتر دارد یا صرفاً در پالیسی آمده
    const all = new Set<VehicleTypeCode>([...availableTypes, ...withParams]);
    return Array.from(all);
  }, [availableTypes, grantedPerType]);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const ds = await fetchBranchDrivers();
        setDrivers(ds);
        await fetchStats(ds.map(d => d.id), fromISO, toISO);
      } catch (e) { console.error('[branch-manager] init error:', e); }
      finally { setLoading(false); }
    })();
  }, [user?.id, fromISO, toISO, fetchStats]);

  // ✅ فقط گرانت‌ها
  React.useEffect(() => {
    if (!user?.id) return;
    fetchGrantedPolicies(user.id);
  }, [user?.id, fetchGrantedPolicies]);



  // ===== نقشه =====
  const [useMapTiler] = React.useState(Boolean(MT_KEY));
  const tileUrl = useMapTiler && MT_KEY ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MT_KEY}` : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const [focusLatLng, setFocusLatLng] = React.useState<[number, number] | undefined>(undefined);

  // تا مجبور نشی useEffect سوکت رو به selectedVehicleId وابسته کنی:
  const selectedVehicleIdRef = React.useRef<number | null>(null);
  React.useEffect(() => { selectedVehicleIdRef.current = selectedVehicleId; }, [selectedVehicleId]);

  // ===== WebSocket =====
  const socketRef = React.useRef<Socket | null>(null);
  const [polyline, setPolyline] = React.useState<[number, number][]>([]);
  const liveTrackOnRef = React.useRef<boolean>(false);
  const selectedDriverRef = React.useRef<User | null>(null);

  const subscribedVehiclesRef = React.useRef<Set<number>>(new Set());
  const [addingStationsForVid, setAddingStationsForVid] = React.useState<number | null>(null);
  const lastStationsSubRef = React.useRef<{ vid: number; uid: number } | null>(null);

  // ایستگاه‌ها (per vehicle)
  const [stationRadius, setStationRadius] = React.useState<number>(60);
  const [tempStation, setTempStation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [tempName, setTempName] = React.useState<string>('');
  const [autoIndex, setAutoIndex] = React.useState(1);
  const [editingStation, setEditingStation] = React.useState<{ vid: number; st: Station } | null>(null);
  const [movingStationId, setMovingStationId] = React.useState<number | null>(null);

  // marker lists
  const driverMarkers = React.useMemo(() => {
    if (!canTrackDrivers) return [];
    return drivers.filter(d => (d as any).last_location).map(d => [(d as any).last_location!.lat, (d as any).last_location!.lng] as [number, number]);
  }, [drivers, canTrackDrivers]);

  const typeGrants: MonitorKey[] = activeType ? (grantedPerType[activeType] || []) : [];
  const hasGrant = (k: string) =>
    typeGrants.map(s => String(s).toLowerCase().replace(/[-_]/g, ''))
      .includes(k.toLowerCase().replace(/[-_]/g, ''));
  // ===== Violations (types + state) =====
  type ViolationType =
    | 'overspeed' | 'speeding'
    | 'route_deviation'
    | 'geofence_in' | 'geofence_out' | 'geofence'
    | 'idle_over'
    | 'harsh_brake' | 'harsh_accel' | 'harsh_turn'
    | 'ignition_on_off_hours';

  type Violation = {
    created_at: string | number | Date;
    id?: number;
    vehicle_id: number;
    driver_id?: number | null;
    at: string;                   // ISO date
    lat: number;
    lng: number;
    type: ViolationType;
    severity?: 'low' | 'med' | 'high';
    meta?: Record<string, any>;
  };

  const [violationsByVid, setViolationsByVid] =
    React.useState<Record<number, Violation[]>>({});
  const [vioStatusByVid, setVioStatusByVid] =
    React.useState<Record<number, 'idle' | 'loading' | 'loaded' | 'error'>>({});

  const [vioFilterTypes, setVioFilterTypes] = React.useState<Set<ViolationType>>(
    new Set<ViolationType>(['overspeed', 'speeding', 'route_deviation', 'geofence_out', 'idle_over'])
  );
  const [vioOnlySevere, setVioOnlySevere] = React.useState(false);
  const [selectedVioId, setSelectedVioId] = React.useState<number | null>(null);

  // دسترسی: اگر «violations» یا هرکدام از کلیدهای مرتبط گرانت شده باشد
  const canViolations =
    !!(activeType && (
      hasGrant('violations') ||
      hasGrant('overspeed') || hasGrant('speeding') ||
      hasGrant('route_deviation') ||
      hasGrant('geo_fence') || hasGrant('geofence') ||
      hasGrant('idle_time')
    ));
  function normalizeViolations(payload: any, fallbackVid?: number): Violation[] {
    const arr: any[] =
      Array.isArray(payload) ? payload
        : Array.isArray(payload?.items) ? payload.items
          : Array.isArray(payload?.data?.items) ? payload.data.items
            : Array.isArray(payload?.data) ? payload.data
              : Array.isArray(payload?.rows) ? payload.rows
                : payload ? [payload] : [];

    const num = (v: any) => (Number.isFinite(+v) ? +v : NaN);
    const toISO = (v: any) => { const d = new Date(v); return isNaN(+d) ? new Date().toISOString() : d.toISOString(); };
    const ll = (lat: any, lng: any) => ({ lat: num(lat), lng: num(lng) });

    return arr.map((r: any) => {
      const p = r?.position ?? r?.pos ?? r?.loc ?? r;
      const t = String(r?.type ?? r?.violation_type ?? r?.code ?? '').toLowerCase() as ViolationType;
      const tm = r?.at ?? r?.time ?? r?.created_at ?? r?.createdAt;
      const lat = p?.lat ?? p?.latitude ?? p?.y;
      const lng = p?.lng ?? p?.longitude ?? p?.x;

      return {
        id: Number.isFinite(+r?.id) ? +r.id : undefined,
        vehicle_id: Number.isFinite(+r?.vehicle_id ?? +r?.vehicleId) ? +(r?.vehicle_id ?? r?.vehicleId) : (fallbackVid ?? NaN),
        driver_id: Number.isFinite(+r?.driver_id ?? +r?.driverId) ? +(r?.driver_id ?? r?.driverId) : null,
        at: toISO(tm),
        ...ll(lat, lng),
        type: t || 'overspeed',
        severity: (r?.severity ?? r?.level ?? '').toLowerCase() as any || undefined,
        meta: r?.meta ?? r
      };
    }).filter(v => Number.isFinite(v.vehicle_id) && Number.isFinite(v.lat) && Number.isFinite(v.lng));
  }

  const vioReqRef = React.useRef<Record<number, number>>({});

  const refreshViolations = React.useCallback(
    async (vid: number, from: string, to: string) => {
      const stamp = Date.now();
      vioReqRef.current[vid] = stamp;
      setVioStatusByVid(p => ({ ...p, [vid]: 'loading' }));

      const params: any = { from, to };
      const types = Array.from(vioFilterTypes);
      if (types.length) params.types = types.join(',');

      try {
        // مسیر اصلی
        const { data } = await api.get(`/vehicles/${vid}/violations`, { params });
        if (vioReqRef.current[vid] !== stamp) return;
        const list = normalizeViolations(data, vid);
        setViolationsByVid(p => ({ ...p, [vid]: list }));
        setVioStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
      } catch {
        // فالبک‌های رایج
        try {
          const { data } = await api.get('/violations', { params: { ...params, vehicle_id: String(vid) } });
          if (vioReqRef.current[vid] !== stamp) return;
          const list = normalizeViolations(data, vid);
          setViolationsByVid(p => ({ ...p, [vid]: list }));
          setVioStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
        } catch {
          try {
            const { data } = await api.get('/events', { params: { ...params, category: 'violation', vehicle_id: String(vid) } });
            if (vioReqRef.current[vid] !== stamp) return;
            const list = normalizeViolations(data, vid);
            setViolationsByVid(p => ({ ...p, [vid]: list }));
            setVioStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
          } catch {
            setVioStatusByVid(p => ({ ...p, [vid]: 'error' }));
          }
        }
      }
    },
    [vioFilterTypes]
  );
  const lastVioVidRef = React.useRef<number | null>(null);

  const canTrackVehicles = !!(activeType && hasGrant('gps'));
  const canStations = !!(activeType && hasGrant('stations'));
  const canConsumables = !!(activeType && hasGrant('consumables'));
  const canIgnition = !!(activeType && hasGrant('ignition'));
  const canIdleTime = !!(activeType && hasGrant('idle_time'));
  const canOdometer = !!(activeType && hasGrant('odometer'));
  const canGeoFence = !!(activeType && (hasGrant('geo_fence') || hasGrant('geofence')));

  const canRouteEdit =
    !!(activeType && (hasGrant('route') || hasGrant('routes') || hasGrant('route_edit')));
  // آخرین سابسکرایب برای هر کلید
  const lastIgnVidRef = React.useRef<number | null>(null);
  const lastIdleVidRef = React.useRef<number | null>(null);
  const lastOdoVidRef = React.useRef<number | null>(null);
  type GeofenceCircle = {
    id?: number;
    type: 'circle';
    center: { lat: number; lng: number };
    radius_m: number;
    tolerance_m?: number | null;
  };
  type GeofencePolygon = {
    id?: number;
    type: 'polygon';
    points: { lat: number; lng: number }[];
    tolerance_m?: number | null;
  };
  type Geofence = GeofenceCircle | GeofencePolygon;

  // per-vehicle cache
  const [geofencesByVid, setGeofencesByVid] = React.useState<Record<number, Geofence[]>>({});

  // UI state برای ترسیم/ویرایش
  const [gfMode, setGfMode] = React.useState<'circle' | 'polygon'>('circle');
  const [gfDrawing, setGfDrawing] = React.useState(false);
  const [gfCenter, setGfCenter] = React.useState<{ lat: number; lng: number } | null>(null);
  const [gfRadius, setGfRadius] = React.useState<number>(150);
  const [gfPoly, setGfPoly] = React.useState<{ lat: number; lng: number }[]>([]);
  const [gfTolerance, setGfTolerance] = React.useState<number>(15);
  function PickPointsForGeofence({
    enabled,
    onPick,
  }: {
    enabled: boolean;
    onPick: (lat: number, lng: number) => void;
  }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }
  async function loadVehicleGeofenceBM(vid: number) {
    try {
      const { data } = await api.get(`/vehicles/${vid}/geofence`, {
        params: { _: Date.now() },
        headers: { 'Cache-Control': 'no-store' },
      });

      // خروجی را به آرایه‌ی استاندارد Geofence[] تبدیل کن
      const list = normalizeGeofences(data); // حتی اگر تک‌آبجکت بود، آرایه می‌شود
      setGeofencesByVid(p => ({ ...p, [vid]: list }));
      return list;
    } catch {
      setGeofencesByVid(p => ({ ...p, [vid]: [] }));
      return [];
    }
  }


  async function saveGeofenceBM() {
    if (!selectedVehicleId) return;

    const toInt = (v: any, min: number) => Math.max(min, Math.trunc(Number(v)));

    let payload: any;
    if (gfMode === 'circle') {
      if (!gfCenter || !Number.isFinite(gfCenter.lat) || !Number.isFinite(gfCenter.lng) || !Number.isFinite(gfRadius) || gfRadius <= 0) {
        alert('مرکز و شعاع دایره را درست وارد کنید.'); return;
      }
      payload = {
        type: 'circle',
        centerLat: +gfCenter.lat,
        centerLng: +gfCenter.lng,
        radiusM: toInt(gfRadius, 1),
        toleranceM: toInt(gfTolerance ?? 5, 0),
      };
    } else {
      if (!Array.isArray(gfPoly) || gfPoly.length < 3) { alert('چندضلعی حداقل به ۳ نقطه نیاز دارد.'); return; }
      payload = {
        type: 'polygon',
        polygonPoints: gfPoly.map(p => ({ lat: +p.lat, lng: +p.lng })),
        toleranceM: toInt(gfTolerance ?? 5, 0),
      };
    }

    try {
      await api.put(`/vehicles/${selectedVehicleId}/geofence`, payload)
        .catch(() => api.post(`/vehicles/${selectedVehicleId}/geofence`, payload));

      await loadVehicleGeofences(selectedVehicleId);      // reset draw UI
      setGfDrawing(false); setGfCenter(null); setGfPoly([]);
    } catch (e: any) {
      console.error('saveGeofenceBM error:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'ثبت ژئوفنس ناموفق بود');
    }
  }

  async function deleteGeofenceBM() {
    if (!selectedVehicleId) return;
    if (!confirm('ژئوفنس حذف شود؟')) return;

    try {
      await api.delete(`/vehicles/${selectedVehicleId}/geofence`)  // اگر API شما فقط تکی پاک می‌کند
        .catch(() => api.delete(`/geofences`, { params: { vehicle_id: String(selectedVehicleId) } })); // اگر جمعی دارید

      setGeofencesByVid(p => ({ ...p, [selectedVehicleId]: [] }));

      setGfDrawing(false); setGfCenter(null); setGfPoly([]);
    } catch (e) {
      console.error(e);
      alert('حذف ژئوفنس ناموفق بود');
    }
  }

  // بالاتر از تابع، یه کمک‌تابع کوچک
  /*  const ensureArray = (data: any) =>
     Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
 */


  // REPLACE: به جای نسخه‌ای که ownerId تکی می‌گرفت

  // صدا زدنش





  // این نسخه را بگذار جای fetchVehiclesOfType فعلی‌ت





  // REPLACE: قبلاً parentSA?.id تکی بود؛ الان از parentSAIds استفاده کن
  // ✅ فقط همین
  React.useEffect(() => {
    if (!activeType) return;
    fetchVehiclesOfType(activeType);
  }, [activeType, parentSAId, fetchVehiclesOfType]);




  // --- جایگزین این تابع کن ---





  // وقتی تب نوع فعال شد، ماشین‌های همان نوع را بگیر و سابسکرایب pos



  React.useEffect(() => {
    const s = socketRef.current;
    if (!s || !activeType || !canTrackVehicles) return;

    const nextIds = new Set((vehiclesByType[activeType] || []).map(v => v.id));
    const prev = subscribedVehiclesRef.current;

    const toSub: number[] = [];
    const toUnsub: number[] = [];

    nextIds.forEach(id => { if (!prev.has(id)) toSub.push(id); });
    prev.forEach(id => { if (!nextIds.has(id)) toUnsub.push(id); });

    // pos: سابسکرایب/آن‌سابِ اختلاف
    toSub.forEach(id => s.emit('subscribe', { topic: `vehicle/${id}/pos` }));
    toUnsub.forEach(id => s.emit('unsubscribe', { topic: `vehicle/${id}/pos` }));

    // چون لیست ماشین‌های تحت‌نظر عوض شده، سابسکرایب‌های تله‌متری قبلی را آزاد کن
    if (lastIgnVidRef.current) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIgnVidRef.current}/ignition` });
      lastIgnVidRef.current = null;
    }
    if (lastIdleVidRef.current) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIdleVidRef.current}/idle_time` });
      lastIdleVidRef.current = null;
    }
    if (lastTelemOdoVidRef.current) {
      s.emit('unsubscribe', { topic: `vehicle/${lastTelemOdoVidRef.current}/odometer` });
      lastTelemOdoVidRef.current = null;
    }

    subscribedVehiclesRef.current = nextIds;
  }, [activeType, canTrackVehicles, vehiclesByType]);


  // اتصال سوکت
  React.useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const s = io(url + '/vehicles', { transports: ['websocket'] });
    socketRef.current = s;

    // === هندلرها ===
    const onDriverPos = (v: { driver_id: number; lat: number; lng: number }) => {
      // اختیاری: هر کاری لازم داری
    };

    const onVehiclePos = (v: { vehicle_id: number; lat: number; lng: number }) => {
      // اختیاری: هر کاری لازم داری
    };

    const onStations = (msg: any) => {
      const vid = Number(msg?.vehicle_id ?? msg?.vehicleId);
      if (!Number.isFinite(vid)) return;

      setVehicleStationsMap(prev => {
        const list = (prev[vid] || []).slice();
        const normalize = (st: any) => ({
          ...st,
          lat: roundLL(parseFloat(String(st.lat))),
          lng: roundLL(parseFloat(String(st.lng))),
        });

        if (msg?.type === 'created' && msg.station) {
          const st = normalize(msg.station);
          if (!list.some(x => x.id === st.id)) list.push(st);
        } else if (msg?.type === 'updated' && msg.station) {
          const st = normalize(msg.station);
          const i = list.findIndex(x => x.id === st.id);
          if (i >= 0) list[i] = st;
        } else if (msg?.type === 'deleted' && msg.station_id) {
          const sid = Number(msg.station_id);
          return { ...prev, [vid]: list.filter(x => x.id !== sid) };
        }
        return { ...prev, [vid]: list };
      });
    };

    // --- NEW: هندلر کیلومترشمار ---
    const onOdo = (data: { vehicle_id: number; odometer: number }) => {
      // فقط اگر همین ماشینی‌ست که الان انتخاب شده
      if (selectedVehicleIdRef.current === data.vehicle_id) {
        setVehicleTlm(prev => ({ ...prev, odometer: data.odometer }));
      }
    };
    s.on('vehicle:ignition', (d: { vehicle_id: number; ignition: boolean }) =>
      selectedVehicleIdRef.current === d.vehicle_id && setVehicleTlm(p => ({ ...p, ignition: d.ignition })));

    s.on('vehicle:idle_time', (d: { vehicle_id: number; idle_time: number }) =>
      selectedVehicleIdRef.current === d.vehicle_id && setVehicleTlm(p => ({ ...p, idle_time: d.idle_time })));

    s.on('vehicle:odometer', (d: { vehicle_id: number; odometer: number }) =>
      selectedVehicleIdRef.current === d.vehicle_id && setVehicleTlm(p => ({ ...p, odometer: d.odometer })));

    // === ثبت لیسنرها ===
    s.on('driver:pos', onDriverPos);
    s.on('vehicle:pos', onVehiclePos);
    s.on('vehicle:stations', onStations);
    s.on('vehicle:odometer', onOdo);   // ⬅️ این خط جدید
    // --- VIOLATIONS: handler ---
    const onViolation = (msg: any) => {
      const v = normalizeViolations(msg?.violation ?? msg, msg?.vehicle_id ?? msg?.vehicleId)[0];
      if (!v) return;
      setViolationsByVid(prev => {
        const cur = prev[v.vehicle_id] || [];
        // اگر فیلتر severe فعال است، اینجا رد نکن—در UI فیلتر کن که تاریخچه حفظ بماند
        // از تکرار جلوگیری
        const exists = v.id && cur.some(x => x.id === v.id);
        const next = exists ? cur : [v, ...cur];
        return { ...prev, [v.vehicle_id]: next };
      });
    };

    // ثبت لیسنر
    s.on('vehicle:violation', onViolation);

    // پاکسازی
    // ...

    // === پاکسازی ===
    return () => {
      // آن‌سابسکرایب pos ها
      subscribedVehiclesRef.current.forEach((id) => {
        s.emit('unsubscribe', { topic: `vehicle/${id}/pos` });
      });
      subscribedVehiclesRef.current = new Set();

      // آن‌سابسکرایب stations
      if (lastStationsSubRef.current) {
        const { vid, uid } = lastStationsSubRef.current;
        s.emit('unsubscribe', { topic: `vehicle/${vid}/stations/${uid}` });
        lastStationsSubRef.current = null;
      }
      s.off('vehicle:violation', onViolation);

      // --- NEW: آن‌سابسکرایب از تاپیک odometer اگر فعال بود
      if (lastTelemOdoVidRef.current) {
        s.emit('unsubscribe', { topic: `vehicle/${lastTelemOdoVidRef.current}/odometer` });
        lastTelemOdoVidRef.current = null;
      }

      // off هندلرها
      s.off('driver:pos', onDriverPos);
      s.off('vehicle:pos', onVehiclePos);
      s.off('vehicle:stations', onStations);
      s.off('vehicle:odometer', onOdo);

      s.disconnect();
      socketRef.current = null;
    };
  }, []);



  // سابسکرایب/آن‌سابسکرایب pos برای ماشین‌های تب فعال
  React.useEffect(() => {
    const vt = activeType;
    if (!vt || !parentSAId) return;
    if (!(vt in vehiclesByType)) {
      fetchVehiclesOfType(vt);
    }
  }, [activeType, parentSAId, vehiclesByType, fetchVehiclesOfType]);



  // ===== ایستگاه‌ها =====

  const startAddingStationsFor = async (vid: number) => {
    const next = addingStationsForVid === vid ? null : vid;
    setAddingStationsForVid(next);
    setTempStation(null);
    setTempName(`ایستگاه ${autoIndex}`);

    const s = socketRef.current;
    if (!s) return;

    // پاکسازی سابسکرایب قبلی
    if (lastStationsSubRef.current) {
      const { vid: pvid, uid } = lastStationsSubRef.current;
      s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations/${uid}` });
      s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations` });
      lastStationsSubRef.current = null;
    }

    if (next != null) {
      // ساب روی هر دو تاپیک
      s.emit('subscribe', { topic: `vehicle/${next}/stations/${user.id}` });
      s.emit('subscribe', { topic: `vehicle/${next}/stations` });
      lastStationsSubRef.current = { vid: next, uid: user.id };

      if (!vehicleStationsMap[next]) fetchStations(next);
    }
  };

  const confirmTempStation = async () => {
    if (!addingStationsForVid || !tempStation) return;
    const name = (tempName || `ایستگاه ${autoIndex}`).trim();

    try {
      await api.post(`/vehicles/${addingStationsForVid}/stations`, {
        name,
        lat: roundLL(tempStation.lat),
        lng: roundLL(tempStation.lng),
        radius_m: stationRadius,
      });

      await fetchStations(addingStationsForVid); // بعد از ساخت، تازه بخوان
      setAutoIndex(i => i + 1);
      setTempStation(null);
    } catch {
      alert('ثبت ایستگاه ناموفق بود');
    }
  };

  const deleteStation = async (vid: number, st: Station) => {
    if (!confirm('ایستگاه حذف شود؟')) return;
    try {
      await api.delete(`/vehicles/${vid}/stations/${st.id}`);
      setVehicleStationsMap(prev => ({ ...prev, [vid]: (prev[vid] || []).filter(x => x.id !== st.id) }));
      if (editingStation?.st.id === st.id) setEditingStation(null);
    } catch { alert('حذف ناموفق بود'); }
  };
  const saveEditStation = async () => {
    const ed = editingStation; if (!ed) return;
    try {
      await api.put(`/vehicles/${ed.vid}/stations/${ed.st.id}`, { name: ed.st.name, lat: ed.st.lat, lng: ed.st.lng, radius_m: ed.st.radius_m });
      setVehicleStationsMap(prev => ({ ...prev, [ed.vid]: (prev[ed.vid] || []).map(x => x.id === ed.st.id ? ed.st : x) }));
      setEditingStation(null); setMovingStationId(null);
    } catch { alert('ذخیره ویرایش ناموفق بود'); }
  };

  // ===== مسیر راننده =====

  const lastTelemOdoVidRef = React.useRef<number | null>(null);

  // ===== Map click helper =====
  // بیرون از BranchManagerRoleSection.tsx (یا بالا، خارج از بدنه‌ی تابع)

  const onPickVehicleBM = React.useCallback(async (v: Vehicle) => {
    setSelectedVehicleId(v.id);
    await loadVehicleGeofences(v.id);
    setSheetOpen(true);        // ⬅️ این خط را اضافه کن
    setSheetMode('vehicle');
    await loadViolations(v.id);

    // ریست حالت‌های افزودن/ادیت ایستگاه
    setAddingStationsForVid(null);
    setEditingStation(null);
    setMovingStationId(null);
    setTempStation(null);
    await loadVehicleRoute(v.id);

    if (v.last_location) setFocusLatLng([v.last_location.lat, v.last_location.lng]);

    // ایستگاه‌ها (در صورت مجوز)
    if (canStations) {
      await ensureStationsLive(v.id);   // subscribe + fetch
    } else {
      await fetchStations(v.id);        // فقط fetch برای نمایش روی نقشه
    }
    const s = socketRef.current;
    if (s && canViolations) {
      if (lastVioVidRef.current && lastVioVidRef.current !== v.id) {
        s.emit('unsubscribe', { topic: `vehicle/${lastVioVidRef.current}/violations` });
        lastVioVidRef.current = null;
      }
      s.emit('subscribe', { topic: `vehicle/${v.id}/violations` });
      lastVioVidRef.current = v.id;

      // فچ اولیه در بازه انتخابی
      await refreshViolations(v.id, fromISO, toISO);
    }

    // --- آزاد کردن سابسکرایب‌های قبلی تله‌متری (هر کدام جدا) ---
    if (s && lastIgnVidRef.current && lastIgnVidRef.current !== v.id) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIgnVidRef.current}/ignition` });
      lastIgnVidRef.current = null;
    }
    if (s && lastIdleVidRef.current && lastIdleVidRef.current !== v.id) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIdleVidRef.current}/idle_time` });
      lastIdleVidRef.current = null;
    }


    // مقادیر قبلی تله‌متری را پاک کن (تا UI وضعیت نامشخص نشان دهد)
    setVehicleTlm({});

    // ===== فچ اولیه تله‌متری (صرفاً برای کلیدهای مجاز) =====
    try {
      const keysWanted: ('ignition' | 'idle_time' | 'odometer')[] = [];
      if (canIgnition) keysWanted.push('ignition');
      if (canIdleTime) keysWanted.push('idle_time');
      if (canOdometer) keysWanted.push('odometer');

      if (keysWanted.length) {
        const { data } = await api.get(`/vehicles/${v.id}/telemetry`, { params: { keys: keysWanted } });

        const next: { ignition?: boolean; idle_time?: number; odometer?: number } = {};
        if (typeof data?.ignition === 'boolean') next.ignition = data.ignition;
        if (typeof data?.idle_time === 'number') next.idle_time = data.idle_time;
        if (typeof data?.odometer === 'number') next.odometer = data.odometer;

        setVehicleTlm(next);
      }
    } catch {
      // مشکلی نبود؛ بعداً از سوکت آپدیت می‌گیریم
    }

    // ===== سابسکرایب تله‌متری برای ماشین انتخاب‌شده (هر کدام که مجاز است) =====
    if (s) {
      if (canIgnition) {
        s.emit('subscribe', { topic: `vehicle/${v.id}/ignition` });
        lastIgnVidRef.current = v.id;
      }
      if (canIdleTime) {
        s.emit('subscribe', { topic: `vehicle/${v.id}/idle_time` });
        lastIdleVidRef.current = v.id;  // ✅ درست
      }

      if (canOdometer) {
        s.emit('subscribe', { topic: `vehicle/${v.id}/odometer` });
        lastTelemOdoVidRef.current = v.id;
      }
    }
    // ژئوفنس (در صورت مجوز)
    setSelectedVehicleId(v.id);
    await loadVehicleGeofences(v.id); // همین یکی بماند




    // ===== لوازم مصرفی (کاملاً مستقل از تله‌متری) =====
    if (canConsumables) {
      // اسنپ‌شات لوکال
      const snap = loadConsLocal(v.id);
      if (snap.length) {
        setConsumablesByVid(p => ({ ...p, [v.id]: snap }));
        setConsStatusByVid(p => ({ ...p, [v.id]: 'loaded' }));
      } else {
        setConsumablesByVid(p => ({ ...p, [v.id]: [] }));
        setConsStatusByVid(p => ({ ...p, [v.id]: 'loading' }));
      }
      // همسان‌سازی از سرور
      refreshConsumables(v.id);
    } else {
      setConsumablesByVid(p => ({ ...p, [v.id]: [] }));
      setConsStatusByVid(p => ({ ...p, [v.id]: 'idle' }));
    }
  }, [
    canStations,
    ensureStationsLive,
    canConsumables,
    refreshConsumables,
    canIgnition,
    canIdleTime,
    canOdometer,
  ]);



  const DEFAULT_KM_REMINDER = 5000;
  const keyOfCons = (c: any) => String(c.id ?? `${c.mode}:${c.start_at ?? c.base_odometer_km ?? Math.random()}`);
  const notifyOnce = (c: any, msg: string) => {
    const k = keyOfCons(c);
    if (notifiedRef.current.has(k)) return;
    notifiedRef.current.add(k);
    setToast({ open: true, msg });
  };

  const canEditGeofence = !!(activeType && (hasGrant('geo_fence') || hasGrant('geofence')));
  React.useEffect(() => {
    if (!selectedVehicleId) return;
    loadVehicleGeofences(selectedVehicleId);
  }, [selectedVehicleId]); // ⬅️ canGeoFence از دیپندنسی حذف شد


  const checkConsumableDue = React.useCallback(() => {
    if (!selectedVehicleId) return;
    const list = consumablesByVid[selectedVehicleId] || [];
    const now = Date.now();

    list.forEach((c: any) => {
      if (c.mode === 'time' && c.start_at) {
        const t = new Date(c.start_at).getTime();
        if (!Number.isNaN(t) && now >= t) {
          notifyOnce(c, `یادآوری: «${c.title ?? c.note ?? 'آیتم'}» به زمان تعیین‌شده رسید.`);
        }
      }
      if (c.mode === 'km' && c.base_odometer_km != null && vehicleTlm.odometer != null) {
        const dist = Number(vehicleTlm.odometer) - Number(c.base_odometer_km);
        if (dist >= DEFAULT_KM_REMINDER) {
          notifyOnce(c, `یادآوری: «${c.title ?? c.note ?? 'آیتم'}» به ${DEFAULT_KM_REMINDER.toLocaleString('fa-IR')} کیلومتر پس از صفر رسید.`);
        }
      }
    });
  }, [selectedVehicleId, consumablesByVid, vehicleTlm.odometer]);

  React.useEffect(() => { checkConsumableDue(); }, [checkConsumableDue]);
  React.useEffect(() => {
    const id = setInterval(checkConsumableDue, 30_000);
    return () => clearInterval(id);
  }, [checkConsumableDue]);
  const openEditConsumable = (c: any) => {
    setEditingCons({
      id: c.id,
      mode: c.mode,
      note: c.note ?? '',
      start_at: c.start_at ?? null,
      base_odometer_km: c.base_odometer_km ?? null,
    });
  };
  const closeEditConsumable = () => setEditingCons(null);
  function normalizeGeofences(payload: any): Geofence[] {
    // به آرایه تبدیل کن
    const arr: any[] = Array.isArray(payload) ? payload
      : Array.isArray(payload?.items) ? payload.items
        : Array.isArray(payload?.data?.items) ? payload.data.items
          : Array.isArray(payload?.data) ? payload.data
            : Array.isArray(payload?.rows) ? payload.rows
              : Array.isArray(payload?.geofences) ? payload.geofences
                : payload?.rule ? [payload.rule]
                  : payload ? [payload] : [];

    const toNumStrict = (v: any) => (
      v === null || v === undefined || v === '' ? undefined :
        (Number.isFinite(+v) ? +v : undefined)
    );
    const toLL = (p: any) => {
      const lat = toNumStrict(p?.lat ?? p?.latitude ?? p?.y);
      const lng = toNumStrict(p?.lng ?? p?.longitude ?? p?.x);
      return (lat != null && lng != null) ? { lat, lng } : undefined;
    };

    const out: Geofence[] = [];

    for (const g of arr) {
      const geom = g?.geometry ?? g?.geojson ?? g?.geoJSON;
      const type = String(g?.type ?? geom?.type ?? '').toLowerCase();

      // ---- candidate: circle ----
      const centerObj = g?.center ?? {
        lat: g?.centerLat ?? g?.center_lat ?? g?.lat,
        lng: g?.centerLng ?? g?.center_lng ?? g?.lng,
      };
      const center = toLL(centerObj ?? {});
      const radius = toNumStrict(g?.radius_m ?? g?.radiusM ?? g?.radius ?? geom?.radius);
      const tol = toNumStrict(g?.tolerance_m ?? g?.toleranceM ?? g?.tolerance);

      const looksCircle = (type === 'circle') || (radius != null && radius > 0 && !!center);
      if (looksCircle && center && radius != null && radius > 0) {
        out.push({
          type: 'circle',
          id: toNumStrict(g?.id),
          center,
          radius_m: radius,
          tolerance_m: (tol ?? null),
        } as GeofenceCircle);
        continue; // فقط وقتی دایره معتبر push شد از این آیتم می‌گذریم
      }

      // ---- candidate: polygon via points/polygonPoints ----
      const rawPoints = g?.points ?? g?.polygonPoints ?? g?.polygon_points ?? geom?.points;
      if (Array.isArray(rawPoints)) {
        const pts = rawPoints.map((p: any) => toLL(p)).filter(Boolean) as { lat: number; lng: number }[];
        if (pts.length >= 3) {
          out.push({
            type: 'polygon',
            id: toNumStrict(g?.id),
            points: pts,
            tolerance_m: (tol ?? null),
          } as GeofencePolygon);
          continue;
        }
      }

      // ---- candidate: polygon via GeoJSON.coordinates ----
      const coords = geom?.coordinates;
      if (String(geom?.type ?? g?.type ?? '').toLowerCase() === 'polygon' && Array.isArray(coords)) {
        const ring = Array.isArray(coords[0]) ? coords[0] : coords; // [[lng,lat], ...]
        const pts = ring
          .map((xy: any) => Array.isArray(xy) && xy.length >= 2 ? ({ lat: toNumStrict(xy[1]), lng: toNumStrict(xy[0]) }) : undefined)
          .filter((p: any) => p?.lat != null && p?.lng != null) as { lat: number; lng: number }[];
        if (pts.length >= 3) {
          out.push({
            type: 'polygon',
            id: toNumStrict(g?.id),
            points: pts,
            tolerance_m: (tol ?? null),
          } as GeofencePolygon);
          continue;
        }
      }
    }

    // یکتاسازی بر اساس id (اگر داشت)
    const seen = new Set<number>();
    return out.filter(g => (g.id ? !seen.has(g.id) && (seen.add(g.id), true) : true));
  }
  // انتخاب نقطه برای ایستگاه‌ها (کلیک روی نقشه وقتی حالت افزودن فعال است)
  function PickPointsForStations({
    enabled,
    onPick,
  }: {
    enabled: boolean;
    onPick: (lat: number, lng: number) => void;
  }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => {
      if (enabled) onPick(e.latlng.lat, e.latlng.lng);
    });
    return null;
  }

  async function loadVehicleGeofences(vid: number) {
    try {
      const { data } = await api.get(`/vehicles/${vid}/geofence`, {
        params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }
      });
      const list = normalizeGeofences(data); // تک آبجکت را هم آرایه می‌کند
      setGeofencesByVid(p => ({ ...p, [vid]: list }));
      return list;
    } catch {
      setGeofencesByVid(p => ({ ...p, [vid]: [] }));
      return [];
    }
  }
  React.useEffect(() => {
    if (selectedVehicleId && canViolations) {
      refreshViolations(selectedVehicleId, fromISO, toISO);
    }
  }, [selectedVehicleId, canViolations, fromISO, toISO, refreshViolations]);


  const saveEditConsumable = async () => {
    if (!selectedVehicleId || !editingCons?.id) return;
    setSavingCons(true);
    try {
      const payload: any = { mode: editingCons.mode, note: (editingCons.note ?? '').trim() };
      if (editingCons.mode === 'time') {
        if (!editingCons.start_at) { alert('start_at لازم است'); setSavingCons(false); return; }
        payload.start_at = new Date(editingCons.start_at).toISOString();
      } else {
        const n = Number(editingCons.base_odometer_km);
        if (!Number.isFinite(n)) { alert('base_odometer_km معتبر نیست'); setSavingCons(false); return; }
        payload.base_odometer_km = n;
      }
      await updateConsumable(selectedVehicleId, editingCons.id, payload);
      await refreshConsumables(selectedVehicleId, true);
      closeEditConsumable();
    } catch (e: any) {
      console.error('PATCH /consumables failed:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'خطا در ویرایش آیتم روی سرور');
    } finally { setSavingCons(false); }
  };

  const deleteConsumable = async (c: any) => {
    if (!selectedVehicleId || !c?.id) return;
    if (!confirm('آیتم حذف شود؟')) return;
    try {
      await api.delete(`/vehicles/${selectedVehicleId}/consumables/${c.id}`);
      await refreshConsumables(selectedVehicleId, true);
      if (editingCons?.id === c.id) closeEditConsumable();
    } catch (e: any) {
      console.error('DELETE /consumables failed:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'حذف روی سرور ناموفق بود');
    }
  };

  const handleAddConsumable = async () => {
    if (!selectedVehicleId) return;
    try {
      const payload: any = { mode: consumableMode, note: (tripNote || '').trim() };
      if (consumableMode === 'time') {
        if (!tripDate) { alert('تاریخ لازم است'); return; }
        payload.start_at = new Date(tripDate).toISOString();
      } else {
        const base = Number(tripBaseKm ?? vehicleTlm.odometer);
        if (!Number.isFinite(base)) { alert('مقدار مبنا معتبر نیست'); return; }
        payload.base_odometer_km = base;
      }
      const { data } = await createConsumable(selectedVehicleId, payload);
      const [created] = normalizeConsumables([data]);
      setConsumablesByVid(prev => {
        const cur = prev[selectedVehicleId] || [];
        const next = created ? [created, ...cur] : cur;
        saveConsLocal(selectedVehicleId, next);
        return { ...prev, [selectedVehicleId]: next };
      });
      await refreshConsumables(selectedVehicleId, true);
      setConsumablesOpen(false);
      setTripNote(''); setTripBaseKm(null);
    } catch (err: any) {
      console.error('POST /consumables failed:', err?.response?.data || err);
      alert(err?.response?.data?.message || 'خطا در ذخیره لوازم مصرفی روی سرور');
    }
  };

  const handleTripReset = async () => {
    if (!selectedVehicleId) return;
    if (vehicleTlm.odometer == null) { alert('داده‌ی کیلومترشمار در دسترس نیست.'); return; }
    try {
      await api.post(`/vehicles/${selectedVehicleId}/trip/start`, {
        base_odometer_km: Number(vehicleTlm.odometer),
        started_at: (tripDate || new Date()).toISOString(),
        note: (tripNote || '').trim(),
      }).catch(() => { });
    } finally {
      setTripBaseKm(Number(vehicleTlm.odometer));
    }
  };


  const filteredDrivers = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return drivers;
    return drivers.filter(d =>
      (d.full_name || '').toLowerCase().includes(s) ||
      (d.phone || '').includes(s)
    );
  }, [drivers, q]);
  const filteredVehicles = React.useMemo(() => {
    if (!activeType) return [];
    const list = vehiclesByType[activeType] || [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(v => v.plate_no.toLowerCase().includes(s));
  }, [q, activeType, vehiclesByType]);
  const availableTypesKey = React.useMemo(
    () => (availableTypes.length ? [...availableTypes].sort().join(',') : ''),
    [availableTypes]
  );
  React.useEffect(() => {
    if (!parentSAId) return;
    const types = availableTypes.length
      ? availableTypes
      : (VEHICLE_TYPES.map((t) => t.code) as VehicleTypeCode[]); // fallback
    types.forEach((vt) => fetchVehiclesOfType(vt));
  }, [parentSAId, availableTypesKey, fetchVehiclesOfType]);

  // ===== Guards =====
  if (permsLoading || loading) {
    return <Box p={2} display="flex" alignItems="center" justifyContent="center">
      <CircularProgress size={24} />
    </Box>;
  }
  if (!can('view_report')) {
    return <Box p={2} color="text.secondary">دسترسی فعالی برای نمایش این صفحه برای شما تنظیم نشده است.</Box>;
  }

  const VIO_LABEL: Record<ViolationType, string> = {
    overspeed: 'سرعت غیرمجاز',
    speeding: 'سرعت غیرمجاز',
    route_deviation: 'انحراف از مسیر',
    geofence_in: 'ورود ژئوفنس',
    geofence_out: 'خروج ژئوفنس',
    geofence: 'ژئوفنس',
    idle_over: 'توقف طولانی',
    harsh_brake: 'ترمز شدید',
    harsh_accel: 'گاز شدید',
    harsh_turn: 'پیچ تند',
    ignition_on_off_hours: 'روشن/خاموش خارج از ساعات',
  };



  // ===== UI =====
  const typeLabel = (code: VehicleTypeCode) => VEHICLE_TYPES.find(t => t.code === code)?.label || code;
  // اطمینان از سابسکرایب شدن به ایستگاه‌های یک ماشین + اولین fetch
  const TOP_HEIGHT = '75vh';         // ارتفاع پنل‌های بالا (نقشه و سایدبار)
  const SHEET_HEIGHT = 420;          // ارتفاع Bottom Sheet
  const freezeProgrammaticZoom = (m?: any) => { }; // برای ساکت‌کردن TS در این فایل

  const gfKey = (gf: Geofence, idx: number) =>
    gf.id != null ? `gf-${gf.id}` : `gf-${gf.type}-${idx}`;
  return (
    <Grid2 container spacing={2} dir="ltr">


      {/* نقشه — چپ */}
      <Grid2 xs={12} md={8}>
        <Paper
          sx={{
            height: TOP_HEIGHT,                // همان الگوی بالا
            transition: 'height .28s ease',
            overflow: 'hidden',
            position: 'relative',
          }}
          dir="rtl"
        >
          <MapContainer
            zoom={INITIAL_ZOOM}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            whenCreated={(m: RLMap) => {
              // مطابق کد بالا: فیکس زوم برنامه‌ای + invalidate
              freezeProgrammaticZoom?.(m);
              setTimeout(() => m.invalidateSize(), 0);
            }}
            style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }}
          >
            {/* مرکز/زوم اولیه (حفظ منطق خودت) */}
            <InitView center={INITIAL_CENTER} zoom={INITIAL_ZOOM} />

            {/* کاشی‌ها */}
            <TileLayer url={tileUrl} {...({ attribution: '&copy; OpenStreetMap | © MapTiler' } as any)} />

            {/* فوکوس روی نقطه */}
            <FocusOn target={focusLatLng} />
            {/* کلیک‌گیرِ انتخاب نقاط مسیر */}
            <PickPointsForRoute enabled={canRouteEdit && drawingRoute} onPick={(lat, lng) => setRoutePoints(p => [...p, { lat, lng }])} />


            {/* پیش‌نمایش مسیر در حال ترسیم */}
            {drawingRoute && routePoints.length >= 1 && (
              <>
                <Polyline positions={routePoints.map(p => [p.lat, p.lng] as [number, number])}
                  pathOptions={{ color: '#00897b', weight: 4, opacity: 0.9 }} />
                {routePoints.map((p, i) => (
                  <Marker key={`draft-${i}`} position={[p.lat, p.lng]} icon={numberedIcon(i + 1) as any} />
                ))}
              </>
            )}

            {/* کلیک‌گیر ژئوفنس (بدون تغییر منطق) */}
            {activeType && canGeoFence && selectedVehicleId && (
              <PickPointsForGeofence
                enabled={canGeoFence && gfDrawing}
                onPick={(lat, lng) => {
                  if (gfMode === 'circle') setGfCenter({ lat, lng });
                  else setGfPoly(prev => [...prev, { lat, lng }]);
                }}
              />
            )}

            {/* لایه مسیر (نمایش بدون وابستگی به تیک ادیت؛ ادیت را تیک کنترل کند) */}
            <Pane name="route-layer" style={{ zIndex: 400 }}>
              {selectedVehicleId && <RouteLayer vid={selectedVehicleId} />}
            </Pane>

            {/* پیش‌نمایش ترسیم ژئوفنس (ظاهر همسان) */}
            {gfDrawing && gfMode === 'circle' && gfCenter && (
              <Circle center={[gfCenter.lat, gfCenter.lng]} radius={gfRadius} />
            )}
            {gfDrawing && gfMode === 'polygon' && gfPoly.length >= 2 && (
              <Polygon positions={gfPoly.map(p => [p.lat, p.lng] as [number, number])} />
            )}

            {/* ژئوفنس ذخیره‌شده از سرور */}
            {selectedVehicleId && (geofencesByVid[selectedVehicleId] || []).map((gf, idx) =>
              gf.type === 'circle'
                ? <Circle key={gfKey(gf, idx)} center={[gf.center.lat, gf.center.lng]} radius={gf.radius_m} />
                : <Polygon key={gfKey(gf, idx)} positions={gf.points.map(p => [p.lat, p.lng] as [number, number])} />
            )}

            {/* لایه راننده‌ها/ماشین‌ها با z-index بالاتر مثل بالا */}
            <Pane name="vehicles-layer" style={{ zIndex: 650 }}>
              {/* راننده‌ها + مسیر لحظه‌ای راننده (حفظ منطق) */}
              {tab === 'drivers' && canTrackDrivers && filteredDrivers.map(d => (d as any).last_location && (
                <Marker
                  key={`d-${d.id}`}
                  position={[(d as any).last_location.lat, (d as any).last_location.lng]}
                  icon={driverMarkerIcon as any}
                  zIndexOffset={1000}
                >
                  <Popup><strong>{d.full_name}</strong><br />{d.phone || '—'}</Popup>
                </Marker>
              ))}
              {tab === 'drivers' && canTrackDrivers && polyline.length > 1 && <Polyline positions={polyline} />}

              {/* ماشین‌ها */}
              {activeType && canTrackVehicles && filteredVehicles.map(v => v.last_location && (
                <Marker
                  key={`v-${v.id}`}
                  position={[v.last_location.lat, v.last_location.lng]}
                  icon={vehicleMarkerIcon as any}
                  zIndexOffset={1000}
                >
                  <Popup><strong>{v.plate_no}</strong><br />{v.vehicle_type_code}</Popup>
                </Marker>
              ))}
            </Pane>

            {/* کلیک‌گیر: ایجاد ایستگاه (همان منطق) */}
            <PickPointsForStations
              enabled={!!canStations && !!addingStationsForVid}
              onPick={(lat, lng) => setTempStation({ lat, lng })}
            />
            {/* ایستگاه‌های در حالت افزودن/ویرایش */}
            {!!addingStationsForVid && canStations && (vehicleStationsMap[addingStationsForVid] || []).map(st => (
              <React.Fragment key={`add-${st.id}`}>
                <Circle center={[st.lat, st.lng]} radius={st.radius_m ?? stationRadius}
                  pathOptions={{ color: MAP_COLORS.station, weight: 2, fillColor: MAP_COLORS.stationFill, fillOpacity: 0.2 }} />
                <Marker position={[st.lat, st.lng]} />
              </React.Fragment>
            ))}

            {/* ایستگاه‌های ماشین انتخاب‌شده */}
            {selectedVehicleId && (vehicleStationsMap[selectedVehicleId] || []).map(st => (
              <React.Fragment key={`sel-${st.id}`}>
                <Circle center={[st.lat, st.lng]} radius={st.radius_m ?? stationRadius} />
                <Marker position={[st.lat, st.lng]} />
              </React.Fragment>
            ))}

            {/* مارکر موقت ایستگاه جدید */}
            {addingStationsForVid && tempStation && (
              <>
                <Circle center={[tempStation.lat, tempStation.lng]} radius={stationRadius} />
                <Marker
                  position={[tempStation.lat, tempStation.lng]}
                  draggable
                  eventHandlers={{
                    add: (e: any) => e.target.openPopup(),
                    dragend: (e: any) => {
                      const ll = e.target.getLatLng();
                      setTempStation({ lat: ll.lat, lng: ll.lng });
                    },
                  }}
                >
                  <Popup autoClose={false} closeOnClick={false} autoPan>
                    <div style={{ minWidth: 220 }}>
                      <strong>ایجاد ایستگاه</strong>
                      <div style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>می‌توانید مارکر را جابجا کنید.</div>
                      <div style={{ marginTop: 8 }}>
                        <input
                          style={{ width: '100%', padding: 6 }}
                          placeholder="نام ایستگاه"
                          value={tempName}
                          onChange={e => setTempName(e.target.value)}
                        />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button onClick={confirmTempStation}>تایید</button>
                        <button onClick={() => setTempStation(null)}>لغو</button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}

            {/* جابه‌جایی ایستگاه در حالت ادیت */}
            {editingStation && movingStationId === editingStation.st.id && (
              <>
                <Circle center={[editingStation.st.lat, editingStation.st.lng]} radius={editingStation.st.radius_m} />
                <Marker
                  position={[editingStation.st.lat, editingStation.st.lng]}
                  draggable
                  eventHandlers={{
                    dragend: (e: any) => {
                      const ll = e.target.getLatLng();
                      setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, lat: ll.lat, lng: ll.lng } }) : ed);
                    }
                  }}
                />
              </>
            )}

            {/* اوورلی شناور استایل‌شده (فقط UI؛ بدون دست‌کاری منطق فعلی) */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 2000,
                pointerEvents: 'none',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  transform: 'scale(1.2)',
                  transformOrigin: 'top left',
                  width: 'max-content',
                  pointerEvents: 'auto',
                }}
              >
                {/* نوار کوچک وضعیت/میانبرها (سادۀ امن؛ به stateهای موجود وصل) */}
                <Paper
                  sx={(t) => ({
                    p: 0.25,
                    borderRadius: 1.5,
                    border: `1px solid ${t.palette.divider}`,
                    bgcolor: `${t.palette.background.paper}C6`,
                    backdropFilter: 'blur(6px)',
                    boxShadow: '0 6px 16px rgba(0,0,0,.18)',
                    overflow: 'hidden',
                  })}
                >
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Chip
                      size="small"
                      icon={<span>🗂️</span> as any}
                      label={tab === 'drivers' ? 'راننده‌ها' : (activeType ? typeLabel(activeType) : '—')}
                      sx={{
                        fontWeight: 700,
                        '& .MuiChip-label': { px: 0.75, py: 0.25, fontSize: 10 },
                      }}
                    />
                    <Chip
                      size="small"
                      icon={<span>📍</span> as any}
                      label={selectedVehicleId ? `VID: ${selectedVehicleId}` : 'ماشین: —'}
                      sx={{
                        border: '1px solid #00c6be55',
                        bgcolor: '#00c6be18',
                        color: '#009e97',
                        '& .MuiChip-label': { px: 0.75, py: 0.25, fontSize: 10 },
                      }}
                    />
                    {/* فقط سوییچ‌های موجود در همین کد؛ بدون اضافه‌کردن هندلر جدید */}
                    <Button
                      size="small"
                      variant={gfDrawing ? 'contained' : 'outlined'}
                      onClick={() => setGfDrawing(v => !v)}
                      disabled={!canGeoFence}
                      sx={{
                        borderRadius: 999,
                        px: 0.9,
                        minHeight: 22,
                        fontSize: 10,
                        borderColor: '#00c6be66',
                        ...(gfDrawing
                          ? { bgcolor: '#00c6be', '&:hover': { bgcolor: '#00b5ab' } }
                          : { '&:hover': { bgcolor: '#00c6be12' } }),
                        boxShadow: gfDrawing ? '0 4px 12px #00c6be44' : 'none',
                      }}
                      startIcon={<span>✏️</span>}
                    >
                      {gfDrawing ? 'پایان ژئوفنس' : 'ترسیم ژئوفنس'}
                    </Button>
                  </Stack>
                </Paper>
              </Box>
            </Box>

            {/* دیالوگ ویرایش مصرفی (همان مکان/منطق خودت) */}
            <Dialog open={!!editingCons} onClose={() => setEditingCons(null)} fullWidth maxWidth="sm">
              <DialogTitle>ویرایش آیتم مصرفی</DialogTitle>
              <DialogContent dividers>
                <Stack spacing={2}>
                  <TextField
                    label="توضیح/یادداشت"
                    value={editingCons?.note ?? ''}
                    onChange={(e) => setEditingCons((p: any) => ({ ...p, note: e.target.value }))}
                    fullWidth
                  />
                  <RadioGroup
                    row
                    value={editingCons?.mode ?? 'km'}
                    onChange={(_, v) =>
                      setEditingCons((p: any) => ({
                        ...p,
                        mode: v as 'km' | 'time',
                        start_at: v === 'time' ? (p?.start_at ?? new Date().toISOString()) : null,
                        base_odometer_km: v === 'km' ? (p?.base_odometer_km ?? 0) : null,
                      }))
                    }
                  >
                    <FormControlLabel value="km" control={<Radio />} label="بر اساس کیلومتر" />
                    <FormControlLabel value="time" control={<Radio />} label="بر اساس زمان" />
                  </RadioGroup>
                  {editingCons?.mode === 'time' ? (
                    <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                      <DateTimePicker<Date>
                        label="تاریخ یادآوری"
                        value={editingCons?.start_at ? new Date(editingCons.start_at) : null}
                        onChange={(val) => setEditingCons((p: any) => ({ ...p, start_at: val ? new Date(val).toISOString() : null }))}
                        ampm={false}
                        slotProps={{ textField: { fullWidth: true } }}
                        format="yyyy/MM/dd HH:mm"
                      />
                    </LocalizationProvider>
                  ) : (
                    <TextField
                      label="مقدار مبنا (کیلومتر)"
                      type="number"
                      value={editingCons?.base_odometer_km ?? ''}
                      onChange={(e) => setEditingCons((p: any) => ({ ...p, base_odometer_km: e.target.value ? Number(e.target.value) : null }))}
                      fullWidth
                    />
                  )}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditingCons(null)}>انصراف</Button>
                <Button variant="contained" onClick={saveEditConsumable} disabled={!canConsumables || savingCons}>ذخیره</Button>
              </DialogActions>
            </Dialog>

            {/* Snackbar (بدون تغییر منطق) */}
            {toast?.open && (
              <Snackbar
                open={toast.open}
                autoHideDuration={6000}
                onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              >
                <Alert severity="warning" onClose={() => setToast(null)} sx={{ width: '100%' }}>
                  {toast.msg}
                </Alert>
              </Snackbar>
            )}

          </MapContainer>
        </Paper>
      </Grid2>

      {/* سایدبار — راست (فقط ظاهر همسان با کارت/باکس‌ها و فاصله‌ها) */}
      <Grid2 xs={12} md={4}>
        <Paper
          sx={(t) => ({
            p: 2,
            height: TOP_HEIGHT,
            '& .leaflet-pane, & .leaflet-top, & .leaflet-bottom': { zIndex: 0 },
            display: 'flex',
            transition: 'height .28s ease',
            flexDirection: 'column',
            border: `1px solid ${t.palette.divider}`,
            borderRadius: 2,
            bgcolor: t.palette.background.paper,
          })}
          dir="rtl"
        >
          {/* بازه زمانی */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="preset-lbl">بازه</InputLabel>
              <Select labelId="preset-lbl" value={preset} label="بازه" onChange={(e) => setPreset(e.target.value as any)}>
                <MenuItem value="today">امروز</MenuItem>
                <MenuItem value="yesterday">دیروز</MenuItem>
                <MenuItem value="7d">۷ روز اخیر</MenuItem>
                <MenuItem value="custom">دلخواه</MenuItem>
              </Select>
            </FormControl>
            {preset === 'custom' && (
              <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                <DateTimePicker
                  label="از"
                  value={new Date(fromISO)}
                  onChange={(v) => v && setFromISO(new Date(v).toISOString())}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <DateTimePicker
                  label="تا"
                  value={new Date(toISO)}
                  onChange={(v) => v && setToISO(new Date(v).toISOString())}
                  slotProps={{ textField: { size: 'small' } }}
                />
              </LocalizationProvider>
            )}
          </Stack>

          {/* تب‌ها با استایل مشابه */}
          <Tabs
            value={tab}
            onChange={(_, v) => { setTab(v); setQ(''); setPolyline([]); setAddingStationsForVid(null); setTempStation(null); setEditingStation(null); setMovingStationId(null); }}
            sx={{
              mb: 1,
              minHeight: 36,
              '& .MuiTab-root': { minHeight: 36 },
              '& .MuiTabs-indicator': { backgroundColor: ACC },
              '& .MuiTab-root.Mui-selected': { color: ACC, fontWeight: 700 },
            }}
          >
            <Tab value="drivers" label="راننده‌ها" />
            {typesWithGrants.map(vt => (
              <Tab key={vt} value={vt} label={typeLabel(vt)} />
            ))}
          </Tabs>

          {/* قابلیت‌های تب فعال */}
          {activeType && (
            <Box sx={{ mb: 1.5, p: 1, border: (t) => `1px dashed ${t.palette.divider}`, borderRadius: 1 }}>
              {(grantedPerType[activeType] || []).length ? (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip size="small" color="primary" label={typeLabel(activeType)} />
                  {(grantedPerType[activeType] || []).map(k => (
                    <Chip key={`${activeType}-${k}`} size="small" variant="outlined"
                      label={MONITOR_PARAMS.find(m => m.key === k)?.label || k} />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  برای این نوع خودرو قابلیتی فعال نشده.
                </Typography>
              )}
            </Box>
          )}

          {/* تله‌متری لحظه‌ای (فقط استایل کارت‌ها) */}


          {/* جستجو با افکت فوکوس شبیه بالا */}
          <TextField
            size="small"
            placeholder={tab === 'drivers' ? 'جستجو نام/موبایل' : 'جستجو پلاک'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 1.25,
              '& .MuiOutlinedInput-root': {
                transition: 'border-color .2s ease, box-shadow .2s ease',
                '& fieldset': { borderColor: 'divider' },
                '&:hover fieldset': { borderColor: ACC },
                '&.Mui-focused': {
                  '& fieldset': { borderColor: ACC },
                  boxShadow: `0 0 0 3px ${ACC}22`,
                },
              },
            }}
          />

          {/* بادی لیست (همان منطق قبلی؛ فقط محیط کنتینر) */}
          <List sx={{ overflow: 'auto', flex: 1 }}>
            {/* ... کل بلوک لیست راننده/ماشینِ خودت بدون تغییر منطق ... */}
            {/* منطق موجودت از همینجا ادامه دارد */}
            {/* === راننده‌ها === */}
            {tab === 'drivers' ? (
              filteredDrivers.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 1 }}>نتیجه‌ای یافت نشد.</Typography>
              ) : filteredDrivers.map(d => {
                const s = statsMap[d.id] || {};
                return (
                  <ListItem
                    key={d.id}
                    divider
                    onClick={() => onPickDriver(d)}   // 👈 قبلاً فقط فوکوس می‌داد

                    secondaryAction={
                      <Stack direction="row" spacing={1}>
                        <Tooltip title={canTrackDrivers ? '' : 'دسترسی ردیابی ندارید'}>
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={async (ev) => {
                                ev.stopPropagation();
                                onPickDriver(d);                 // بازشدن شیت + انتخاب راننده
                                await trackByDriverId(d.id, fromISO, toISO);   // ⬅️ این خط مهم است
                                // اگر دوست دارید ماشین فعلی راننده هم در سایدبار انتخاب شود (اختیاری):
                                const vid = await getDriverCurrentVehicleId(d.id).catch(() => null);
                                if (vid) setSelectedVehicleId(vid);
                              }}
                            >
                              ردیابی
                            </Button>

                          </span>
                        </Tooltip>
                      </Stack>
                    }
                  >
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                      <Avatar>{d.full_name?.charAt(0) ?? 'ر'}</Avatar>
                      <Box sx={{ flex: 1 }}>
                        <ListItemText primary={d.full_name} secondary={d.phone || '—'} />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .25 }}>
                          مسافت: {s.totalDistanceKm ?? '—'} km | مدت: {s.totalDurationMin ?? '—'} min | ماموریت: {s.jobsCount ?? '—'} | خرابی: {s.breakdownsCount ?? '—'}
                        </Typography>
                      </Box>
                    </Stack>
                  </ListItem>
                );
              })
            ) : (
              // === ماشین‌ها ===
              // === ماشین‌ها ===
              (filteredVehicles.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 1 }}>ماشینی یافت نشد.</Typography>
              ) : filteredVehicles.map(v => {
                const stations = vehicleStationsMap[v.id] || [];
                const isEditingBlock = editingStation?.vid === v.id;

                return (
                  <Box key={v.id} sx={{ pb: 1 }}>
                    <ListItem
                      key={v.id}
                      divider
                      onClick={() => onPickVehicleBM(v)}
                      secondaryAction={
                        <Stack direction="row" spacing={0.5}>
                          {v.last_location && (
                            <IconButton
                              size="small"
                              title="نمایش روی نقشه"
                              onClick={(e) => { e.stopPropagation(); setFocusLatLng([v.last_location!.lat, v.last_location!.lng]); }}
                            >📍</IconButton>
                          )}







                        </Stack>
                      }
                    >
                      {routeBusyByVid[v.id] === 'loading' && (
                        <Typography variant="caption" color="text.secondary">در حال بارگذاری مسیر…</Typography>
                      )}
                      {routeMetaByVid[v.id] && (
                        <Typography variant="caption" color="text.secondary">
                          مسیر فعلی: {routeMetaByVid[v.id]?.name ?? `#${routeMetaByVid[v.id]?.id}`}
                          {routeMetaByVid[v.id]?.threshold_m ? ` — آستانه: ${routeMetaByVid[v.id]?.threshold_m} m` : ''}
                        </Typography>
                      )}

                      <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                        <Avatar>{v.plate_no?.charAt(0) ?? 'م'}</Avatar>
                        <Box sx={{ flex: 1 }}>
                          <ListItemText primary={v.plate_no} secondary={typeLabel(v.vehicle_type_code)} />
                        </Box>
                      </Stack>
                    </ListItem>





                  </Box>
                );
              }))

            )}
          </List>

          {/* دیالوگ افزودن/تنظیم مصرفی (همان منطق) */}
          <Dialog open={consumablesOpen} onClose={() => setConsumablesOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>لوازم مصرفی / مسافت از آخرین صفر</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <TextField label="توضیح/یادداشت" value={tripNote} onChange={(e) => setTripNote(e.target.value)} fullWidth />
                <RadioGroup row value={consumableMode} onChange={(_, v) => setConsumableMode((v as 'time' | 'km') ?? 'km')}>
                  <FormControlLabel value="km" control={<Radio />} label="بر اساس کیلومتر" />
                  <FormControlLabel value="time" control={<Radio />} label="بر اساس زمان" />
                </RadioGroup>
                {consumableMode === 'time' ? (
                  <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                    <DateTimePicker<Date>
                      label="تاریخ یادآوری"
                      value={tripDate}
                      onChange={(val) => setTripDate(val)}
                      ampm={false}
                      slotProps={{ textField: { fullWidth: true } }}
                      format="yyyy/MM/dd HH:mm"
                    />
                  </LocalizationProvider>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">کیلومترشمار فعلی:</Typography>
                        <Typography variant="h6">
                          {vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}
                        </Typography>
                      </Stack>
                      <TextField
                        label="مقدار مبنا (از آخرین صفر)"
                        type="number"
                        value={tripBaseKm ?? ''}
                        onChange={(e) => setTripBaseKm(e.target.value ? Number(e.target.value) : null)}
                        fullWidth
                      />
                      {!canOdometer && (
                        <Typography sx={{ mt: 1 }} variant="caption" color="warning.main">
                          برای به‌روزرسانی زنده، «کیلومترشمار» باید در سیاست‌های این نوع فعال باشد.
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConsumablesOpen(false)}>بستن</Button>
              {consumableMode === 'km' && (
                <Button variant="outlined" onClick={handleTripReset} disabled={vehicleTlm.odometer == null || !selectedVehicleId}>
                  صفر کردن از الان
                </Button>
              )}
              <Button variant="contained" onClick={handleAddConsumable} disabled={consumableMode === 'time' && !tripDate}>
                افزودن
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      </Grid2>
      {/* === ردیف سوم: پنل پایینی (Bottom Sheet) === */}
      <Grid2 xs={12}>
        <Collapse in={sheetOpen} timeout={320} unmountOnExit>
          <Paper
            dir="rtl"
            sx={(t) => ({
              position: 'relative',
              minHeight: SHEET_HEIGHT,
              p: 2,
              borderRadius: 3,
              overflow: 'hidden',
              border: `1px solid ${t.palette.divider}`,
              boxShadow: t.palette.mode === 'dark'
                ? '0 20px 60px rgba(0,0,0,.45)'
                : '0 20px 60px rgba(0,0,0,.15)',
              background: `linear-gradient(180deg, ${t.palette.background.paper} 0%, ${t.palette.background.default} 100%)`,
            })}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              {/* هدر شیت */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip
                    size="medium"
                    icon={<span>{sheetMode === 'driver' ? '🧑‍✈️' : '🚘'}</span> as any}
                    label={
                      <Typography component="span" sx={{ fontWeight: 800 }}>
                        {sheetMode === 'driver'
                          ? `راننده: ${selectedDriverId
                            ? (filteredDrivers.find(x => x.id === selectedDriverId)?.full_name ?? `#${selectedDriverId}`)
                            : '—'}`
                          : `ماشین: ${selectedVehicleId
                            ? (filteredVehicles.find(v => v.id === selectedVehicleId)?.plate_no ?? `#${selectedVehicleId}`)
                            : '—'}`}
                      </Typography>
                    }
                  />

                  {/* اگر دادهٔ تله‌متری داری، مثل بالا چند چیپ دیگر هم می‌تونی نشان بدهی */}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" onClick={() => setSheetOpen(false)}>بستن</Button>
                </Stack>
              </Stack>

              {/* اکشن‌های سریع (اختیاری) */}
              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                {selectedVehicleId && (
                  <>
                    {filteredVehicles.find(v => v.id === selectedVehicleId)?.last_location && (
                      <Button
                        size="small"
                        onClick={() => {
                          const ll = filteredVehicles.find(v => v.id === selectedVehicleId)!.last_location!;
                          setFocusLatLng([ll.lat, ll.lng]);
                        }}
                        startIcon={<span>🎯</span>}
                      >
                        مرکز روی ماشین
                      </Button>
                    )}

                  </>
                )}
              </Stack>
              {/* === تعریف مسیر جدید === */}
              {sheetMode !== 'driver' && (

                <Paper sx={{ p: 1, mt: 1, border: (t) => `1px dashed ${t.palette.divider}` }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>تعریف مسیر جدید</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <TextField
                      size="small"
                      label="نام مسیر"
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      sx={{ minWidth: 180 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Threshold (m)"
                      value={routeThreshold}
                      onChange={(e) => setRouteThreshold(Math.max(1, Number(e.target.value || 0)))}
                      sx={{ width: 150 }}
                    />
                    <Button size="small" variant={drawingRoute ? 'contained' : 'outlined'} onClick={() => setDrawingRoute(v => !v)} disabled={!canRouteEdit}>
                      {drawingRoute ? 'پایان ترسیم' : 'شروع ترسیم روی نقشه'}
                    </Button>
                    <Button size="small" onClick={() => setRoutePoints(pts => pts.slice(0, -1))} disabled={!canRouteEdit || !routePoints.length}>برگشت نقطه</Button>
                    <Button size="small" onClick={() => setRoutePoints([])} disabled={!canRouteEdit || !routePoints.length}>پاک‌کردن</Button>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!canRouteEdit || routePoints.length < 2 || !selectedVehicleId}
                      onClick={() => saveRouteAndFenceForVehicle({ vehicleId: selectedVehicleId!, name: (routeName || '').trim() || `مسیر ${new Date().toLocaleDateString('fa-IR')}`, threshold_m: Math.max(1, Number(routeThreshold || 0)), points: routePoints, toleranceM: 15 })}
                    >
                      ذخیره مسیر
                    </Button>




                  </Stack>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    روی نقشه کلیک کن تا نقاط مسیر به‌ترتیب اضافه شوند. برای ذخیره حداقل ۲ نقطه لازم است.
                  </Typography>
                </Paper>
              )}

              {/* === سکشن‌ها: از منطق خودت استفاده می‌کنیم ولی بر اساس selectedVehicleId === */}
              {sheetMode !== 'driver' && selectedVehicleId && (

                <Grid2 container spacing={1.25}>
                  {/* مسیر */}


                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>
                      مسیر
                    </Typography>

                    {/* وضعیت مسیر فعلی */}
                    {routeBusyByVid[selectedVehicleId] === 'loading' && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        در حال بارگذاری مسیر…
                      </Typography>
                    )}
                    {routeMetaByVid[selectedVehicleId] && (
                      <Paper sx={{ p: 1, mb: 1, border: (t) => `1px solid ${t.palette.divider}` }}>
                        <Typography variant="body2" color="text.secondary">مسیر فعلی</Typography>
                        <Typography variant="body1">
                          {routeMetaByVid[selectedVehicleId]?.name ?? `#${routeMetaByVid[selectedVehicleId]?.id}`}
                          {routeMetaByVid[selectedVehicleId]?.threshold_m
                            ? ` — آستانه: ${routeMetaByVid[selectedVehicleId]?.threshold_m} m`
                            : ''}
                        </Typography>
                      </Paper>
                    )}

                    {/* اکشن‌ها */}
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={async () => {
                          await loadVehicleRoute(selectedVehicleId);
                        }}
                      >
                        نمایش/تازه‌سازی مسیر
                      </Button>

                      <Tooltip title={canRouteEdit ? '' : 'اجازهٔ ویرایش مسیر ندارید'}>
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={!canRouteEdit}
                            onClick={async () => {
                              const routes = await listVehicleRoutes(selectedVehicleId);
                              if (!routes.length) { alert('مسیری برای این خودرو پیدا نشد.'); return; }
                              const nameList = routes.map(r => `${r.id} — ${r.name ?? 'بدون نام'}`).join('\n');
                              const pick = prompt(`Route ID را وارد کنید:\n${nameList}`, String(routes[0].id));
                              const rid = Number(pick);
                              if (!Number.isFinite(rid)) return;

                              try {
                                await setOrUpdateVehicleRoute(selectedVehicleId, { route_id: rid });
                                await loadVehicleRoute(selectedVehicleId);
                              } catch (err: any) {
                                console.error(err?.response?.data || err);
                                alert(err?.response?.data?.message || 'ثبت مسیر ناموفق بود');
                              }
                            }}
                          >
                            انتخاب مسیر
                          </Button>
                        </span>
                      </Tooltip>

                      <Tooltip title={canRouteEdit ? '' : 'اجازهٔ ویرایش مسیر ندارید'}>
                        <span>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={!canRouteEdit}
                            onClick={async () => {
                              if (!confirm('مسیر فعلی از این خودرو برداشته شود؟')) return;
                              try {
                                await clearVehicleRoute(selectedVehicleId);
                              } catch { }
                              setRouteMetaByVid(p => ({ ...p, [selectedVehicleId]: null }));
                              setRoutePolylineByVid(p => ({ ...p, [selectedVehicleId]: [] }));
                            }}
                          >
                            حذف مسیر
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Grid2>


                  {/* ایستگاه‌ها */}
                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>ایستگاه‌ها</Typography>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <TextField
                        size="small" type="number" label="شعاع (m)" value={stationRadius}
                        onChange={(e) => setStationRadius(Math.max(1, Number(e.target.value || 0)))} sx={{ width: 130 }}
                      />
                      {canStations && (
                        <Button
                          size="small"
                          variant={addingStationsForVid === selectedVehicleId ? 'contained' : 'outlined'}
                          onClick={() => startAddingStationsFor(selectedVehicleId)}
                          disabled={!canStations}
                        >
                          {addingStationsForVid === selectedVehicleId ? 'پایان افزودن' : 'ایجاد ایستگاه'}
                        </Button>
                      )}
                    </Stack>

                    {(() => {
                      const stations = vehicleStationsMap[selectedVehicleId] || [];
                      const isEditingBlock = editingStation?.vid === selectedVehicleId;

                      return stations.length ? (
                        <List dense sx={{ maxHeight: 240, overflow: 'auto' }}>
                          {stations.map(st => {
                            const isEditing = isEditingBlock && editingStation?.st.id === st.id;
                            return (
                              <Box key={st.id}>
                                <ListItem
                                  disableGutters
                                  secondaryAction={
                                    <Stack direction="row" spacing={0.5}>
                                      <IconButton size="small" title="نمایش روی نقشه" disabled={!canStations} onClick={() => setFocusLatLng([st.lat, st.lng])}>📍</IconButton>
                                      <IconButton
                                        size="small"
                                        title="ویرایش"
                                        onClick={() => {
                                          if (isEditing) { setEditingStation(null); setMovingStationId(null); }
                                          else { setEditingStation({ vid: selectedVehicleId, st: { ...st } }); setMovingStationId(null); }
                                        }}
                                        disabled={!canStations}
                                      >✏️</IconButton>
                                      <IconButton size="small" color="error" title="حذف" disabled={!canStations} onClick={() => deleteStation(selectedVehicleId, st)}>🗑️</IconButton>
                                    </Stack>
                                  }
                                >
                                  <ListItemText primary={st.name} secondary={`${st.lat.toFixed(5)}, ${st.lng.toFixed(5)}`} />
                                </ListItem>

                                <Collapse in={isEditing} timeout="auto" unmountOnExit>
                                  <Box sx={{ mx: 1.5, mt: .5, p: 1.25, bgcolor: 'action.hover', borderRadius: 1, border: (t) => `1px solid ${t.palette.divider}` }}>
                                    <Stack spacing={1.25}>
                                      <TextField
                                        size="small" label="نام" value={editingStation?.st.name ?? ''}
                                        onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, name: e.target.value } }) : ed)}
                                      />
                                      <TextField
                                        size="small" type="number" label="شعاع (m)" value={editingStation?.st.radius_m ?? 0}
                                        onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, radius_m: Math.max(1, Number(e.target.value || 0)) } }) : ed)}
                                      />
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <Button size="small" variant={movingStationId === st.id ? 'contained' : 'outlined'} onClick={() => setMovingStationId(movingStationId === st.id ? null : st.id)}>جابجایی روی نقشه</Button>
                                        <Box flex={1} />
                                        <Button size="small" onClick={() => { setEditingStation(null); setMovingStationId(null); }}>انصراف</Button>
                                        <Button size="small" variant="contained" onClick={saveEditStation}>ذخیره</Button>
                                      </Stack>
                                    </Stack>
                                  </Box>
                                </Collapse>

                                <Divider sx={{ mt: 1 }} />
                              </Box>
                            );
                          })}
                        </List>
                      ) : (
                        <Typography color="text.secondary">ایستگاهی تعریف نشده.</Typography>
                      );
                    })()}
                  </Grid2>

                  {/* ژئوفنس */}
                  {canGeoFence && (
                    <Grid2 xs={12} md={6} lg={4}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>ژئوفنس</Typography>

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <InputLabel id="gf-mode-lbl">حالت</InputLabel>
                          <Select
                            labelId="gf-mode-lbl"
                            label="حالت"
                            value={gfMode}
                            onChange={(e) => { setGfMode(e.target.value as 'circle' | 'polygon'); setGfCenter(null); setGfPoly([]); }}
                          >
                            <MenuItem value="circle">دایره‌ای</MenuItem>
                            <MenuItem value="polygon">چندضلعی</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          size="small" type="number" label="تلورانس (m)" value={gfTolerance}
                          onChange={(e) => setGfTolerance(Math.max(0, Number(e.target.value || 0)))}
                          sx={{ width: 130 }}
                        />

                        <Button
                          size="small"
                          variant={gfDrawing ? 'contained' : 'outlined'}
                          onClick={() => setGfDrawing(v => !v)}
                          disabled={!canGeoFence}
                        >
                          {gfDrawing ? 'پایان ترسیم' : 'ترسیم روی نقشه'}
                        </Button>

                        {gfMode === 'polygon' && (
                          <>
                            <Button size="small" onClick={() => setGfPoly(pts => pts.slice(0, -1))}
                              disabled={!canGeoFence || !gfPoly.length}>
                              برگشت نقطه
                            </Button>
                            <Button size="small" onClick={() => setGfPoly([])}
                              disabled={!canGeoFence || !gfPoly.length}>
                              پاک‌کردن نقاط
                            </Button>
                          </>
                        )}

                        {gfMode === 'circle' && (
                          <TextField
                            size="small" type="number" label="شعاع (m)" value={gfRadius}
                            onChange={(e) => setGfRadius(Math.max(1, Number(e.target.value || 0)))}
                            sx={{ width: 130 }}
                            disabled={!canGeoFence}
                          />
                        )}

                        <Button
                          size="small"
                          variant="contained"
                          onClick={saveGeofenceBM}
                          disabled={!canGeoFence}
                        >
                          ذخیره ژئوفنس
                        </Button>

                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={deleteGeofenceBM}
                          disabled={!canGeoFence || !selectedVehicleId || (geofencesByVid[selectedVehicleId]?.length ?? 0) === 0}
                        >
                          حذف ژئوفنس
                        </Button>



                      </Stack>

                      <Typography variant="caption" color="text.secondary">
                        {gfMode === 'circle'
                          ? 'روی نقشه کلیک کنید تا مرکز دایره انتخاب شود، سپس شعاع را تنظیم و ذخیره کنید.'
                          : 'روی نقشه کلیک کنید تا نقاط چندضلعی به‌ترتیب اضافه شوند (حداقل ۳ نقطه).'}
                      </Typography>
                    </Grid2>
                  )}


                  {/* تله‌متری زنده */}
                  {activeType && (canIgnition || canIdleTime || canOdometer) && (
                    <Grid2 xs={12} md={6} lg={4}>
                      <Stack spacing={1} sx={{ mb: 1.5 }}>
                        {canIgnition && (
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">وضعیت سوئیچ</Typography>
                            <Typography variant="h6">
                              {vehicleTlm.ignition === true ? 'موتور روشن است'
                                : vehicleTlm.ignition === false ? 'موتور خاموش است' : 'نامشخص'}
                            </Typography>
                          </Paper>
                        )}
                        {canIdleTime && (
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">مدت توقف/سکون</Typography>
                            <Typography variant="h6">
                              {vehicleTlm.idle_time != null
                                ? `${vehicleTlm.idle_time.toLocaleString('fa-IR')} ثانیه`
                                : '—'}
                            </Typography>
                          </Paper>
                        )}
                        {canOdometer && (
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">کیلومترشمار</Typography>
                            <Typography variant="h6">
                              {vehicleTlm.odometer != null
                                ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km`
                                : 'نامشخص'}
                            </Typography>
                          </Paper>
                        )}
                      </Stack>
                    </Grid2>
                  )}

                  {/* لوازم مصرفی */}
                  {canConsumables && (
                    <Grid2 xs={12} lg={4}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>لوازم مصرفی</Typography>
                        <Tooltip title={canConsumables ? 'افزودن' : 'دسترسی ندارید'}>
                          <span>
                            <IconButton size="small" onClick={() => setConsumablesOpen(true)} disabled={!canConsumables}>＋</IconButton>
                          </span>
                        </Tooltip>
                        <Box flex={1} />
                        <Typography variant="caption" color="text.secondary">
                          کیلومترشمار: {vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}
                        </Typography>
                      </Stack>

                      {(() => {
                        const consStatus = consStatusByVid[selectedVehicleId];
                        const consList = consumablesByVid[selectedVehicleId] || [];
                        if (consStatus === 'loading') {
                          return (
                            <Box display="flex" alignItems="center" gap={1} color="text.secondary" sx={{ mt: .5 }}>
                              <CircularProgress size={16} /> در حال دریافت…
                            </Box>
                          );
                        }
                        if (consStatus === 'error') return <Typography color="warning.main">خطا در دریافت. دوباره تلاش کنید.</Typography>;
                        if (!consList.length) return <Typography color="text.secondary">آیتمی ثبت نشده.</Typography>;
                        return (
                          <List dense sx={{ maxHeight: 240, overflow: 'auto' }}>
                            {consList.map((c: any, i: number) => (
                              <ListItem
                                key={c.id ?? i}
                                divider
                                secondaryAction={
                                  <Stack direction="row" spacing={0.5}>
                                    <span>
                                      <IconButton
                                        size="small"
                                        title="ویرایش"
                                        onClick={() => openEditConsumable(c)}
                                        disabled={!canConsumables}
                                      >✏️</IconButton>
                                    </span>
                                    <span>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        title="حذف"
                                        onClick={() => deleteConsumable(c)}
                                        disabled={!canConsumables}
                                      >🗑️</IconButton>
                                    </span>
                                  </Stack>
                                }
                              >
                                <ListItemText
                                  primary={c.title ?? c.note ?? 'آیتم'}
                                  secondary={
                                    <>
                                      {c.mode === 'km' ? 'بر اساس کیلومتر' : 'بر اساس زمان'}
                                      {c.created_at && <> — {new Date(c.created_at).toLocaleDateString('fa-IR')}</>}
                                    </>
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                        );
                      })()}
                    </Grid2>
                  )}
                </Grid2>
              )}



              {!selectedVehicleId && (
                <Typography color="text.secondary">برای مشاهده تنظیمات، یک ماشین را از لیست انتخاب کنید.</Typography>
              )}
              {sheetMode === 'driver' && selectedDriverId && (
                <Grid2 container spacing={1.25}>
                  {/* اکشن‌های راننده */}
                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>اکشن‌های راننده</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          const d = filteredDrivers.find(x => x.id === selectedDriverId);
                          const ll = (d as any)?.last_location;
                          if (ll) setFocusLatLng([ll.lat, ll.lng]);
                        }}
                        startIcon={<span>🎯</span>}
                      >
                        مرکز روی راننده
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => loadDriverTrack(selectedDriverId)}
                      >
                        نمایش مسیر/ردیابی
                      </Button>
                    </Stack>
                  </Grid2>

                  {/* تله‌متری و آمار راننده */}
                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>وضعیت لحظه‌ای و آمار</Typography>
                    {(() => {
                      const d = filteredDrivers.find(x => x.id === selectedDriverId);
                      const stats = statsMap[selectedDriverId] || {};
                      const ll = (d as any)?.last_location;
                      const tlm = (d as any)?.telemetry || (d as any)?.tlm || {};
                      const ignition = tlm.ignition === true ? 'موتور روشن است'
                        : tlm.ignition === false ? 'موتور خاموش است'
                          : 'نامشخص';
                      const idleTime =
                        tlm.idle_time != null ? `${Number(tlm.idle_time).toLocaleString('fa-IR')} ثانیه` : '—';

                      return (
                        <Stack spacing={1.25} sx={{ mb: 1.5 }}>
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Box>
                                <Typography variant="body2" color="text.secondary">موقعیت فعلی</Typography>
                                <Typography variant="h6">
                                  {ll ? `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}` : 'نامشخص'}
                                </Typography>
                              </Box>
                              <Button
                                size="small"
                                disabled={!ll}
                                onClick={() => ll && setFocusLatLng([ll.lat, ll.lng])}
                                startIcon={<span>🎯</span>}
                              >
                                مرکز
                              </Button>
                            </Stack>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">وضعیت سوئیچ</Typography>
                            <Typography variant="h6">{ignition}</Typography>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">مدت توقف/سکون</Typography>
                            <Typography variant="h6">{idleTime}</Typography>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">مسافت پیموده‌شده (بازه)</Typography>
                            <Typography variant="h6">
                              {stats.totalDistanceKm != null
                                ? `${Number(stats.totalDistanceKm).toLocaleString('fa-IR')} km`
                                : '—'}
                            </Typography>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">مدت کار (بازه)</Typography>
                            <Typography variant="h6">
                              {stats.totalDurationMin != null
                                ? `${Number(stats.totalDurationMin).toLocaleString('fa-IR')} دقیقه`
                                : '—'}
                            </Typography>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">تعداد مأموریت</Typography>
                            <Typography variant="h6">
                              {stats.jobsCount != null ? Number(stats.jobsCount).toLocaleString('fa-IR') : '—'}
                            </Typography>
                          </Paper>
                        </Stack>
                      );
                    })()}
                  </Grid2>

                  {/* تخلفات راننده در بازه انتخابی */}
                  <Grid2 xs={12} md={12} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>تخلفات راننده در بازه انتخابی</Typography>
                    {vioStatusByDid[selectedDriverId] === 'loading' && (
                      <Box display="flex" alignItems="center" gap={1} color="text.secondary" sx={{ mt: .5 }}>
                        <CircularProgress size={16} /> در حال دریافت…
                      </Box>
                    )}
                    {vioStatusByDid[selectedDriverId] === 'error' && (
                      <Typography color="warning.main">خطا در دریافت تخلفات راننده.</Typography>
                    )}
                    {(() => {
                      const list = (violationsByDid[selectedDriverId] || [])
                        .filter(v => violationFilter === 'all' || v.type === violationFilter);
                      if (!list.length && vioStatusByDid[selectedDriverId] === 'loaded') {
                        return <Typography color="text.secondary">موردی یافت نشد.</Typography>;
                      }
                      return (
                        <List dense sx={{ maxHeight: 260, overflow: 'auto' }}>
                          {list.map((v, i) => (
                            <ListItem
                              key={v.id ?? i}
                              divider
                              onClick={() => v.meta?.point && setFocusLatLng([v.meta.point.lat, v.meta.point.lng])}
                              secondaryAction={
                                v.meta?.point && (
                                  <IconButton
                                    size="small"
                                    title="نمایش روی نقشه"
                                    onClick={(e) => { e.stopPropagation(); setFocusLatLng([v.meta!.point!.lat, v.meta!.point!.lng]); }}
                                  >📍</IconButton>
                                )
                              }
                            >
                              <ListItemText
                                primary={`${new Date(v.created_at).toLocaleString('fa-IR')} — ${v.type}`}
                                secondary={
                                  <>
                                    {v.meta?.distance_m && `فاصله: ${v.meta.distance_m} m `}
                                    {v.meta?.threshold_m && `— آستانه: ${v.meta.threshold_m} m`}
                                  </>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      );
                    })()}
                  </Grid2>
                </Grid2>
              )}

            </Box>
          </Paper>
        </Collapse>
      </Grid2>
    </Grid2>
  );




  function FitToGeofences({ items }: { items: Geofence[] }) {
    const map = useMap();
    React.useEffect(() => {
      if (!items || !items.length) return;
      const bounds = L.latLngBounds([]);
      items.forEach(g => {
        if (g.type === 'circle') {
          const b = L.circle([g.center.lat, g.center.lng], { radius: g.radius_m }).getBounds();
          bounds.extend(b);
        } else {
          g.points.forEach(p => bounds.extend([p.lat, p.lng]));
        }
      });
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
    }, [items, map]);
    return null;
  }
}

function OwnerRoleSection({ user }: { user: User }) {
  // ===== Permissions: نقشه همیشه؛ ردیابی فقط با تیک سطح نقش =====
  const DEFAULT_PERMS: string[] = ['view_report'];
  const [allowed, setAllowed] = React.useState<Set<string>>(new Set(DEFAULT_PERMS));
  const [permsLoading, setPermsLoading] = React.useState(false);
  const [q, setQ] = React.useState('');
  type TabKey = 'drivers' | VehicleTypeCode;
  const [tab, setTab] = React.useState<TabKey>('drivers');
  const activeType = (tab !== 'drivers') ? (tab as VehicleTypeCode) : null;
  const [parentSA, setParentSA] = React.useState<{ id: number; name: string } | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<number | null>(null);
  const LL_DEC = 10;
  const roundLL = (v: number) => Math.round(v * 10 ** LL_DEC) / 10 ** LL_DEC;
  const fmtLL = (v: number) => Number.isFinite(v) ? v.toFixed(LL_DEC) : '';
  const [sheetOpen, setSheetOpen] = React.useState(false);
  // ===== Route types =====
  type RouteMeta = { id: number; name?: string | null; threshold_m?: number | null };
  type RoutePoint = { lat: number; lng: number; name?: string | null; radius_m?: number | null };
  const [sheetMode, setSheetMode] = React.useState<'vehicle' | 'driver' | null>(null);
  // state ها
  const [drawingRoute, setDrawingRoute] = React.useState(false);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [routeName, setRouteName] = useState('');
  const [routeThreshold, setRouteThreshold] = useState<number>(100);
  const [fromISO, setFromISO] = React.useState<string>(() => new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  const [toISO, setToISO] = React.useState<string>(() => new Date().toISOString());
  // کلیک‌گیر روی نقشه
  function PickPointsForRoute({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lng: number) => void }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }
  // پرچم برای جلوگیری از تریپل‌کلیک/اسپم
  const savingRouteRef = React.useRef(false);
  // ⬇️ اینو کنار بقیه helpers بذار
  // ✅ فقط روت‌هایی که داریم + سایلنت
  // ✅ فقط همون روت‌های موجود؛ بی‌سروصدا فالبک می‌زنیم
  // فقط از روت‌های assignment استفاده کن
  const getDriverCurrentVehicleId = async (driverId: number): Promise<number | null> => {
    try {
      const { data } = await api.get(`/assignments/current/${driverId}`);
      // ممکنه پاسخ خالی باشه (۲۰۰ بدون body) یا شکل‌های مختلف داشته باشه
      const vid =
        Number(data?.vehicle_id ?? data?.vehicleId) ||
        Number(data?.vehicle?.id) || null;

      return Number.isFinite(vid) && vid! > 0 ? vid : null;
    } catch {
      return null;
    }
  };
  async function trackByDriverId(driverId: number, from = fromISO, to = toISO) {
    if (!driverId) return;

    try {
      const params = {
        driver_id: driverId,         // ⬅️ اجباری
        from,                        // ISO string
        to,                          // ISO string
      };

      // اگر می‌خواهید URL لاگ شود:
      // const q = new URLSearchParams({ driver_id: String(driverId), from, to }).toString();
      // console.log(`[GET] /tracks?${q}`);

      const { data } = await api.get('/tracks', { params });
      const pts: { lat: number; lng: number }[] = Array.isArray(data) ? data : (data?.items || []);
      setPolyline(pts.map(p => [p.lat, p.lng] as [number, number]));
      liveTrackOnRef.current = true;
      selectedDriverRef.current = drivers.find(x => x.id === driverId) ?? null;
    } catch (e) {
      console.error('trackByDriverId error:', e);
      setPolyline([]);
      liveTrackOnRef.current = true;
      selectedDriverRef.current = drivers.find(x => x.id === driverId) ?? null;
    }
  }



  async function saveRouteAndFenceForVehicle(opts: {
    vehicleId: number;
    name: string;
    threshold_m: number;               // مثلا 1000
    points: { lat: number; lng: number }[]; // نقاط خام مسیر
    toleranceM?: number;               // مثلا 10–20
  }) {
    const { vehicleId, name, threshold_m, points, toleranceM = 15 } = opts;
    if (savingRouteRef.current) return;           // جلوگیری از تکرار
    if (!vehicleId) { alert('خودرو انتخاب نشده'); return; }
    if (!Array.isArray(points) || points.length < 2) {
      alert('حداقل دو نقطه برای مسیر لازم است.'); return;
    }

    try {
      savingRouteRef.current = true;

      // 1) ساخت مسیر روی خودِ خودرو
      // POST /vehicles/:vid/routes   { name, threshold_m, points }
      const { data: created } = await api.post(`/vehicles/${vehicleId}/routes`, {
        name,
        threshold_m,
        points, // [{lat,lng}, ...]
      });
      const routeId = Number(created?.route_id ?? created?.id);
      if (!Number.isFinite(routeId)) throw new Error('route_id از پاسخ سرور خوانده نشد');

      // 2) ست کردن همین مسیر به‌عنوان مسیر فعلی
      // PUT /vehicles/:vid/routes/current   { route_id }
      await api.put(`/vehicles/${vehicleId}/routes/current`, { route_id: routeId });

      // 3) ساخت ژئوفنس پُلیگانیِ دور مسیر (بافر)
      // از همون buildRouteBufferPolygon که تو کدت داری استفاده می‌کنیم
      const ring = buildRouteBufferPolygon(points, threshold_m) // متر
        .map(p => ({ lat: +p.lat, lng: +p.lng }));

      // نکته: برای جلوگیری از چندبار ساخت، اول PUT (آپ‌سرت) می‌زنیم؛
      // اگر سرور اجازه نداد، یکبار POST می‌زنیم.
      try {
        await api.put(`/vehicles/${vehicleId}/geofence`, {
          type: 'polygon',
          polygonPoints: ring,
          toleranceM,
        });
      } catch {
        await api.post(`/vehicles/${vehicleId}/geofence`, {
          type: 'polygon',
          polygonPoints: ring,
          toleranceM,
        });
      }

      // ریفرش UI
      await loadVehicleRoute(vehicleId);
      await loadVehicleGeofences(vehicleId);

      // ریست UI ترسیم
      setDrawingRoute(false);
      setRoutePoints([]);
      if (!routeName) setRouteName(name || `Route ${routeId}`);

      alert('مسیر و ژئوفنس با موفقیت ذخیره شد.');
    } catch (e: any) {
      console.error(e?.response?.data || e);
      alert(e?.response?.data?.message || 'ذخیره مسیر/ژئوفنس ناموفق بود.');
    } finally {
      savingRouteRef.current = false;
    }
  }
  // انتخاب راننده
  const [selectedDriverId, setSelectedDriverId] = React.useState<number | null>(null);

  // تخلفات راننده (بر اساس driverId و بازه زمانی)
  type SimpleViolation = {
    id: number;
    type: 'geofence_exit' | 'off_route' | 'speeding' | string;
    created_at: string;
    driver_user_id?: number;
    meta?: {
      point?: { lat: number; lng: number };
      distance_m?: number;
      threshold_m?: number;
      radius_m?: number;
      tolerance_m?: number;
    };
  };

  const loadViolations = useCallback(
    async (vehicleId: number, from = fromISO, to = toISO) => {
      if (!vehicleId) { setViolations([]); return; }

      setViolationsLoading(true);
      try {
        const raw = await fetchVehicleViolations(api, vehicleId, 200);
        const all: Violation[] = (normalizeViolations(raw) || []) as Violation[];

        const fromT = Number.isFinite(+new Date(from)) ? +new Date(from) : -Infinity;
        const toT = Number.isFinite(+new Date(to)) ? +new Date(to) : Infinity;

        const list: SimpleViolation[] = all
          .filter(v => {
            const t = +new Date(
              v.created_at ?? (v as any).at ?? (v as any).time ?? (v as any).createdAt
            );
            return Number.isFinite(t) && t >= fromT && t <= toT;
          })
          .map((v, idx) => {
            const createdAt =
              v.created_at ?? (v as any).at ?? (v as any).time ?? (v as any).createdAt ?? new Date().toISOString();

            // id پایدار: اگر نبود، از شناسه‌های داخل meta یا timestamp+idx بساز
            const stableId =
              (typeof v.id === 'number' ? v.id : undefined) ??
              Number((v.meta as any)?.event_id) ??
              Number((v.meta as any)?.id) ??
              (Date.parse(createdAt) || 0) + idx;

            return {
              id: stableId,
              type: (v.type as any) || 'speeding',
              created_at: createdAt,
              driver_user_id:
                (v as any).driver_user_id ??
                (v as any).driver_id ??
                undefined,
              meta: v.meta ?? {},
            } as SimpleViolation;
          });

        setViolations(list);
      } catch {
        setViolations([]);
      } finally {
        setViolationsLoading(false);
      }
    },
    [api, fromISO, toISO, fetchVehicleViolations]
  );


  // ✅ فقط از /assignments/current/:driverId استفاده کن
  async function fetchDriverViolationsViaAssignment(api: any, driverId: number, limit = 200) {
    try {
      const { data: cur } = await api.get(`/assignments/current/${driverId}`);
      const vid =
        Number(cur?.vehicle_id ?? cur?.vehicleId) ||
        Number(cur?.vehicle?.id) || null;

      if (!vid) return []; // راننده الآن روی ماشینی نیست
      const { data } = await api.get(`/vehicles/${vid}/violations`, { params: { limit } });
      return data;
    } catch {
      return [];
    }
  }




  async function fetchVehicleViolations(api: any, vehicleId: number, limit = 200) {
    const { data } = await api.get(`/vehicles/${vehicleId}/violations`, { params: { limit } });
    return data;
  }

  const [violationsByDid, setViolationsByDid] = React.useState<Record<number, SimpleViolation[]>>({});
  const [vioStatusByDid, setVioStatusByDid] = React.useState<Record<number, 'idle' | 'loading' | 'loaded' | 'error'>>({});
  const [violationFilter, setViolationFilter] = React.useState<'all' | 'geofence_exit' | 'off_route' | 'speeding'>('all');
  const [violationsLoading, setViolationsLoading] = React.useState(false);
  const [selectedViolation, setSelectedViolation] = React.useState<SimpleViolation | null>(null);
  // بالای فایل: هِلفر تبدیل تاریخ به ISO string
  // قبلی: const toISO = (v:any)=>...
  const toIsoStrict = (v: any) => {
    const d = new Date(v);
    return isNaN(+d) ? new Date().toISOString() : d.toISOString();
  };


  const loadDriverViolations = React.useCallback(
    async (driverId: number, from = fromISO, to = toISO) => {
      if (!driverId) { setViolations([]); return; }

      setViolationsLoading(true);
      try {
        const raw = await fetchDriverViolationsViaAssignment(api, driverId, 200);
        const all: Violation[] = (normalizeViolations(raw) || []) as Violation[];

        const fromT = Number.isFinite(+new Date(from)) ? +new Date(from) : -Infinity;
        const toT = Number.isFinite(+new Date(to)) ? +new Date(to) : Infinity;

        const list: SimpleViolation[] = all
          .filter(v => {
            const t = +new Date(v.created_at ?? (v as any).at ?? (v as any).time ?? (v as any).createdAt);
            return Number.isFinite(t) && t >= fromT && t <= toT;
          })
          .map((v, idx) => {
            const createdAtISO =
              (v.created_at
                ?? (v as any).at
                ?? (v as any).time
                ?? (v as any).createdAt
                ?? new Date().toISOString());

            const created_at = new Date(createdAtISO).toISOString(); // ⬅️ تضمین string

            const stableId =
              (typeof v.id === 'number' ? v.id : undefined) ??
              Number(v.meta?.event_id) ??
              Number((v.meta as any)?.id) ??
              (Date.parse(created_at) || 0) + idx;

            return {
              id: stableId,
              type: (v.type as any) || 'speeding',
              created_at, // ⬅️ string
              driver_user_id: (v as any).driver_id ?? (v as any).driver_user_id ?? driverId,
              meta: v.meta ?? {},
            };
          });

        setViolations(list);
      } catch {
        setViolations([]);
      } finally {
        setViolationsLoading(false);
      }
    },
    [api, fromISO, toISO] // ⚠️ تابع fetchDriverViolationsViaAssignment را در deps نگذار تا فچ لوپ نشود
  );



  useEffect(() => {
    if (selectedDriverId && fromISO && toISO) {
      loadDriverViolations(selectedDriverId, fromISO, toISO);
    }
  }, [selectedDriverId, fromISO, toISO, loadDriverViolations]);



  // per-vehicle caches
  const [routeMetaByVid, setRouteMetaByVid] =
    React.useState<Record<number, RouteMeta | null>>({});
  const [routePointsByRid, setRoutePointsByRid] =
    React.useState<Record<number, RoutePoint[]>>({});
  const [routePolylineByVid, setRoutePolylineByVid] =
    React.useState<Record<number, [number, number][]>>({});
  const [routeBusyByVid, setRouteBusyByVid] =
    React.useState<Record<number, 'idle' | 'loading' | 'error'>>({});
  // /routes/:rid/stations  یا  /routes/:rid/points  یا شکل‌های متفاوت
  const normalizeRoutePoints = (payload: any): RoutePoint[] => {
    const arr: any[] =
      Array.isArray(payload) ? payload :
        Array.isArray(payload?.items) ? payload.items :
          Array.isArray(payload?.data?.items) ? payload.data.items :
            Array.isArray(payload?.data) ? payload.data :
              Array.isArray(payload?.rows) ? payload.rows :
                Array.isArray(payload?.points) ? payload.points :
                  Array.isArray(payload?.stations) ? payload.stations :
                    [];

    const num = (v: any) => {
      const n = Number(v); return Number.isFinite(n) ? n : NaN;
    };

    // پشتیبانی از خروجی‌های snake/camel
    const out = arr.map((p: any) => {
      const lat = num(p.lat ?? p.latitude ?? p.y);
      const lng = num(p.lng ?? p.longitude ?? p.x);
      return ({
        lat, lng,
        name: p.name ?? p.title ?? null,
        radius_m: Number.isFinite(num(p.radius_m ?? p.radiusM ?? p.radius)) ? num(p.radius_m ?? p.radiusM ?? p.radius) : null,
      });
    }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    // مرتب‌سازی بر اساس order_no اگر وجود دارد
    out.sort((a: any, b: any) =>
      (Number(a.order_no ?? a.orderNo ?? a.order ?? 0) - Number(b.order_no ?? b.orderNo ?? b.order ?? 0))
    );

    return out;
  };
  const [violations, setViolations] = React.useState<SimpleViolation[]>([]);

  const fetchVehicleCurrentRouteMeta = async (vid: number): Promise<RouteMeta | null> => {
    const tries = [
      () => api.get(`/vehicles/${vid}/routes/current`), // 👈 خواسته‌ی شما
      () => api.get(`/vehicles/${vid}/current-route`),
      () => api.get(`/vehicles/${vid}/route`),
    ];
    for (const t of tries) {
      try {
        const { data } = await t();
        // برخی APIها خروجی را داخل route می‌گذارند
        const r = data?.route || data;
        if (r?.id) {
          return {
            id: Number(r.id),
            name: r.name ?? null,
            threshold_m: r.threshold_m ?? r.thresholdM ?? null,
          };
        }
        // بعضی‌ها هم به‌صورت扮 route_id
        if (data?.route_id) {
          return {
            id: Number(data.route_id),
            name: data.name ?? null,
            threshold_m: data.threshold_m ?? data.thresholdM ?? null,
          };
        }
      } catch { /* try next */ }
    }
    return null;
  };
  const loadDriverTrack = async (driverId: number) => {
    if (!canTrackDrivers) return;
    try {
      // 👇 بک‌اند می‌خواهد vehicle_id
      const vid = await getDriverCurrentVehicleId(driverId);
      const params: any = { from: fromISO, to: toISO };
      if (vid) params.vehicle_id = vid; else params.driver_id = driverId; // فالبک

      const { data } = await api.get('/tracks', { params });
      const pts: { lat: number; lng: number }[] = Array.isArray(data) ? data : data?.items || [];
      setPolyline(pts.map(p => [p.lat, p.lng] as [number, number]));
      liveTrackOnRef.current = true;
      selectedDriverRef.current = drivers.find(x => x.id === driverId) ?? null;
    } catch {
      setPolyline([]); liveTrackOnRef.current = true;
      selectedDriverRef.current = drivers.find(x => x.id === driverId) ?? null;
    }
  };
  // فقط شیت را باز کن، هیچ فچی اینجا نزن
  const onPickDriver = (d: any) => {
    setSelectedDriverId(d.id);
    setSelectedVehicleId(null);
    setSelectedViolation(null);
    setSheetMode('driver');
    setSheetOpen(true);
  };
  // ــ بالای فایل (خارج از کامپوننت)
  const _inflightAssign = new Map<number, Promise<number | null>>();

  function getCurrentVehicleIdSafe(api: any, driverId: number): Promise<number | null> {
    if (_inflightAssign.has(driverId)) return _inflightAssign.get(driverId)!;
    const p = (async () => {
      try {
        const { data } = await api.get(`/assignments/current/${driverId}`, {
          params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }
        });
        const vid =
          Number(data?.vehicle_id ?? data?.vehicleId) ||
          Number(data?.vehicle?.id) || null;
        return Number.isFinite(vid!) && vid! > 0 ? vid! : null;
      } catch {
        return null;
      } finally {
        _inflightAssign.delete(driverId);
      }
    })();
    _inflightAssign.set(driverId, p);
    return p;
  }

  async function fetchDriverViolationsSmart(
    api: any,
    driverId: number,
    { from, to, limit = 200 }: { from: string; to: string; limit?: number }
  ) {
    const params: any = { from, to, limit };
    const vid = await getCurrentVehicleIdSafe(api, driverId);

    // 1) بر اساس vehicle اگر assignment وجود داشت
    if (vid) {
      try {
        const { data } = await api.get(`/vehicles/${vid}/violations`, { params });
        return data;
      } catch { /* فالبک به درایور */ }
    }

    // 2) فالبک‌های بر پایهٔ راننده (حتی وقتی assignment خالی است)
    try {
      const { data } = await api.get('/violations', { params: { ...params, driver_id: String(driverId) } });
      return data;
    } catch { }

    try {
      const { data } = await api.get(`/drivers/${driverId}/violations`, { params });
      return data;
    } catch { }

    try {
      const { data } = await api.get('/events', { params: { ...params, category: 'violation', driver_id: String(driverId) } });
      return data;
    } catch { }

    return [];
  }






  // نقاط مسیر بر اساس routeId
  // نقاط مسیر — اول /points بعد /stations (طبق خواسته‌ی شما)
  const fetchRoutePoints = async (routeId: number): Promise<RoutePoint[]> => {
    const tries = [
      () => api.get(`/routes/${routeId}/points`),   // 👈 اول points
      () => api.get(`/routes/${routeId}/stations`), //    بعد stations
    ];
    for (const t of tries) {
      try {
        const { data } = await t();
        return normalizeRoutePoints(data);
      } catch { /* try next */ }
    }
    return [];
  };


  // ست/آپدیت مسیر فعلی ماشین (اختیاری threshold)
  const setOrUpdateVehicleRoute = async (vid: number, body: { route_id?: number; threshold_m?: number }) => {
    // PATCH/PUT ها متنوع‌اند؛ همه را هندل می‌کنیم
    const tries = [
      () => api.patch(`/vehicles/${vid}/route`, body),
      () => api.put(`/vehicles/${vid}/route`, body),
      () => api.post(`/vehicles/${vid}/route`, body),
    ];
    for (const t of tries) {
      try { return await t(); } catch { /* next */ }
    }
  };

  // لغو مسیر فعلی ماشین
  // لغو/برداشتن مسیر فعلی ماشین — فقط DELETE
  const clearVehicleRoute = async (vid: number) => {
    const tries = [
      // رایج‌ترین‌ها
      () => api.delete(`/vehicles/${vid}/route`),
      () => api.delete(`/vehicles/${vid}/route/unassign`),

      // چند فالبک احتمالی
      () => api.delete(`/vehicles/${vid}/routes/current`),
      () => api.delete(`/vehicles/${vid}/current-route`),
    ];

    let lastErr: any;
    for (const t of tries) {
      try { return await t(); } catch (e) { lastErr = e; }
    }
    throw lastErr;
  };


  // لیست مسیرهای قابل‌انتخاب برای یک ماشین
  const listVehicleRoutes = async (vid: number): Promise<RouteMeta[]> => {
    try {
      const { data } = await api.get(`/vehicles/${vid}/routes`);
      const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      return arr
        .map((r: any) => ({ id: Number(r.id), name: r.name ?? null, threshold_m: r.threshold_m ?? r.thresholdM ?? null }))
        .filter((r: any) => Number.isFinite(r.id));
    } catch { return []; }
  };
  const loadVehicleRoute = React.useCallback(async (vid: number) => {
    setRouteBusyByVid(p => ({ ...p, [vid]: 'loading' }));
    try {
      const meta = await fetchVehicleCurrentRouteMeta(vid);
      setRouteMetaByVid(p => ({ ...p, [vid]: meta }));

      if (meta?.id) {
        // کش نقاط مسیر
        let pts = routePointsByRid[meta.id];
        if (!pts) {
          pts = await fetchRoutePoints(meta.id);
          setRoutePointsByRid(p => ({ ...p, [meta.id]: pts }));
        }
        const line: [number, number][] = (pts || []).map(p => [p.lat, p.lng]);
        setRoutePolylineByVid(prev => ({ ...prev, [vid]: line }));
      } else {
        setRoutePolylineByVid(prev => ({ ...prev, [vid]: [] }));
      }
      setRouteBusyByVid(p => ({ ...p, [vid]: 'loaded' }));
    } catch {
      setRouteBusyByVid(p => ({ ...p, [vid]: 'error' }));
    }
  }, [routePointsByRid]);


  // ===== Consumables (per vehicle) =====
  type ConsumableItem = {
    id?: number;
    mode: 'km' | 'time';
    note?: string;
    title?: string;
    start_at?: string | null;
    base_odometer_km?: number | null;
    created_at?: string | null;
    vehicle_id?: number | null;
  };

  const [consumablesByVid, setConsumablesByVid] =
    React.useState<Record<number, ConsumableItem[]>>({});
  const [consStatusByVid, setConsStatusByVid] =
    React.useState<Record<number, 'idle' | 'loading' | 'loaded' | 'error'>>({});

  // دیالوگ‌ها/فرم
  const [consumablesOpen, setConsumablesOpen] = React.useState(false);
  const [editingCons, setEditingCons] = React.useState<any | null>(null);
  const [savingCons, setSavingCons] = React.useState(false);
  const [consumableMode, setConsumableMode] = React.useState<'time' | 'km'>('km');
  const [tripNote, setTripNote] = React.useState('');
  const [tripDate, setTripDate] = React.useState<Date | null>(new Date());
  const [tripBaseKm, setTripBaseKm] = React.useState<number | null>(null);

  // تله‌متری لازم برای چکِ کیلومتر
  const [vehicleTlm, setVehicleTlm] = React.useState<{
    ignition?: boolean;
    idle_time?: number;
    odometer?: number;
  }>({});
  // نوتیف فقط-یکبار
  const notifiedRef = React.useRef<Set<string>>(new Set());
  const [toast, setToast] = React.useState<{ open: boolean; msg: string } | null>(null);

  // helpers
  const CONS_KEY = (vid: number) => `consumables_${vid}`;
  const loadConsLocal = (vid: number) => {
    try {
      const raw = localStorage.getItem(CONS_KEY(vid));
      if (!raw) return [] as ConsumableItem[];
      return normalizeConsumables(JSON.parse(raw));
    } catch { return [] as ConsumableItem[]; }
  };
  const saveConsLocal = (vid: number, items: ConsumableItem[]) => {
    try { localStorage.setItem(CONS_KEY(vid), JSON.stringify(items)); } catch { }
  };

  const normalizeConsumables = (payload: any): ConsumableItem[] => {
    let arr: any[] =
      Array.isArray(payload) ? payload :
        Array.isArray(payload?.items) ? payload.items :
          Array.isArray(payload?.data?.items) ? payload.data.items :
            Array.isArray(payload?.data) ? payload.data :
              Array.isArray(payload?.result) ? payload.result :
                Array.isArray(payload?.consumables) ? payload.consumables :
                  Array.isArray(payload?.rows) ? payload.rows :
                    (payload && typeof payload === 'object' ? [payload] : []);

    const toNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
    const toISO = (v: any) => { if (!v) return null; const t = new Date(v); return isNaN(+t) ? null : t.toISOString(); };

    const out = arr.map((c: any) => ({
      id: c.id ?? c._id ?? undefined,
      mode: (c.mode ?? c.type) === 'time' ? 'time' : 'km',
      note: c.note ?? c.description ?? '',
      title: c.title ?? c.name ?? c.note ?? undefined,
      created_at: toISO(c.created_at ?? c.createdAt),
      start_at: toISO(c.start_at ?? c.startAt ?? c.start_time ?? c.startTime),
      base_odometer_km: toNum(c.base_odometer_km ?? c.baseOdometerKm ?? c.base_odo ?? c.base_odo_km),
      vehicle_id: c.vehicle_id ?? c.vehicleId ?? null,
    }));

    const keyOf = (x: any) => x.id ?? `${x.mode}:${x.start_at ?? x.base_odometer_km ?? x.note ?? ''}`;
    const map = new Map<string | number, any>();
    out.forEach(x => map.set(keyOf(x), x));
    return Array.from(map.values());
  };

  async function createConsumable(
    vid: number,
    payload: { mode: 'km' | 'time'; note: string; start_at?: string | null; base_odometer_km?: number | null }
  ) {
    const snake = payload.mode === 'time'
      ? { mode: 'time', note: payload.note, start_at: payload.start_at }
      : { mode: 'km', note: payload.note, base_odometer_km: payload.base_odometer_km };
    try {
      return await api.post(`/vehicles/${vid}/consumables`, snake);
    } catch {
      const camel = payload.mode === 'time'
        ? { mode: 'time', note: payload.note, startAt: payload.start_at }
        : { mode: 'km', note: payload.note, baseOdometerKm: payload.base_odometer_km };
      try {
        return await api.post(`/vehicles/${vid}/consumables`, camel);
      } catch {
        try { return await api.post(`/vehicles/${vid}/consumables`, { consumable: snake }); }
        catch { return await api.post(`/vehicles/${vid}/consumables`, { consumable: camel }); }
      }
    }
  }
  async function updateConsumable(
    vid: number, id: number,
    payload: { mode: 'km' | 'time'; note: string; start_at?: string | null; base_odometer_km?: number | null }
  ) {
    const snake = payload.mode === 'time'
      ? { mode: 'time', note: payload.note, start_at: payload.start_at }
      : { mode: 'km', note: payload.note, base_odometer_km: payload.base_odometer_km };
    try {
      return await api.patch(`/vehicles/${vid}/consumables/${id}`, snake);
    } catch {
      const camel = payload.mode === 'time'
        ? { mode: 'time', note: payload.note, startAt: payload.start_at }
        : { mode: 'km', note: payload.note, baseOdometerKm: payload.base_odometer_km };
      return await api.patch(`/vehicles/${vid}/consumables/${id}`, camel);
    }
  }

  const consReqIdRef = React.useRef<Record<number, number>>({});
  const refreshConsumables = React.useCallback(async (vid: number, forceServer = false) => {
    const myId = (consReqIdRef.current[vid] || 0) + 1;
    consReqIdRef.current[vid] = myId;
    setConsStatusByVid(p => ({ ...p, [vid]: 'loading' }));

    if (!forceServer) {
      const cached = loadConsLocal(vid);
      if (cached.length) {
        setConsumablesByVid(p => ({ ...p, [vid]: cached }));
        setConsStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
      }
    }

    try {
      const { data } = await api.get(`/vehicles/${vid}/consumables`, {
        params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }
      });
      if (consReqIdRef.current[vid] !== myId) return;
      const list = normalizeConsumables(data);
      saveConsLocal(vid, list);
      setConsumablesByVid(p => ({ ...p, [vid]: list }));
      setConsStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
    } catch {
      if (consReqIdRef.current[vid] !== myId) return;
      setConsStatusByVid(p => ({ ...p, [vid]: 'error' }));
    }
  }, []);

  const resolveParentSA = React.useCallback(
    async (uid: number): Promise<{ id: number; name: string } | null> => {
      // 1) تلاش از روی پالیسی‌ها (اگه owner داخلشون بود)
      try {
        const { data } = await api.get(`/vehicle-policies/user/${uid}`, { params: { onlyAllowed: true } });
        const rows: any[] = Array.isArray(data) ? data : [];
        const pickNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
        const ownerIds = Array.from(new Set(
          rows.flatMap(r => [
            pickNum(r.owner_user_id), pickNum(r.ownerId),
            pickNum(r.super_admin_user_id), pickNum(r.superAdminUserId),
            pickNum(r.grantor_user_id), pickNum(r.grantorUserId),
          ].filter(Boolean))
        )) as number[];

        for (const oid of ownerIds) {
          try {
            const test = await api.get('/vehicles', { params: { owner_user_id: String(oid), limit: 1 } });
            const items = Array.isArray(test.data?.items) ? test.data.items : (Array.isArray(test.data) ? test.data : []);
            if (items.length) {
              const row = rows.find(rr =>
                [rr.owner_user_id, rr.ownerId, rr.super_admin_user_id, rr.superAdminUserId, rr.grantor_user_id, rr.grantorUserId]
                  .map((x: any) => Number(x)).includes(oid)
              );
              return { id: oid, name: String(row?.owner_name ?? row?.ownerName ?? 'سوپرادمین') };
            }
          } catch { }
        }
      } catch { }

      // 2) فـال‌بک مطمئن: جدِ level=2 از بک‌اند
      try {
        const { data } = await api.get('/users/my-ancestor', { params: { level: 2 } });
        if (data?.id) return { id: Number(data.id), name: String(data.full_name || 'سوپرادمین') };
      } catch { }

      return null;
    },
    []
  );
  const [vehicleStationsMap, setVehicleStationsMap] = React.useState<Record<number, Station[]>>({});
  const [routeByVid, setRouteByVid] =
    React.useState<Record<number, { id: number; threshold_m?: number }>>({});
  // قبلی را پاک کن و این را بگذار
  const fetchStations = async (vid: number) => {
    try {
      const { data } = await api.get(`/vehicles/${vid}/stations`);
      const rows: any[] = Array.isArray(data) ? data : [];

      const stations: Station[] = rows.map((p: any) => ({
        id: Number(p.id),
        name: p.name ?? p.title ?? null,
        lat: roundLL(Number(p.lat)),
        lng: roundLL(Number(p.lng)),
        radius_m: Number(p.radius_m ?? p.radiusM ?? 60),
      }));

      setVehicleStationsMap(prev => ({ ...prev, [vid]: stations }));
    } catch {
      setVehicleStationsMap(prev => ({ ...prev, [vid]: [] }));
    }
  };

  // ⬇️ این تابع قبلی‌ت رو به‌طور کامل با این نسخه جایگزین کن

  const ensureStationsLive = React.useCallback(
    async (vid: number) => {
      if (!vehicleStationsMap[vid]) {
        await fetchStations(vid).catch(() => { });
      }

      const s = socketRef.current;
      if (!s) return;

      if (lastStationsSubRef.current && lastStationsSubRef.current.vid !== vid) {
        const { vid: pvid, uid } = lastStationsSubRef.current;
        s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations/${user.id}` });
        s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations` });
        lastStationsSubRef.current = null;
      }

      s.emit('subscribe', { topic: `vehicle/${vid}/stations/${user.id}` });
      s.emit('subscribe', { topic: `vehicle/${vid}/stations` });
      lastStationsSubRef.current = { vid, uid: user.id };
    },
    [user.id, vehicleStationsMap, fetchStations]
  );



  // === استایل‌های شبیه سوپرادمین ===
  const ROUTE_STYLE = {
    outline: { color: '#0d47a1', weight: 8, opacity: 0.25 },
    main: { color: '#1e88e5', weight: 5, opacity: 0.9 },
  };
  const ROUTE_COLORS = { start: '#43a047', end: '#e53935', point: '#1565c0' };

  const numberedIcon = (n: number) =>
    L.divIcon({
      className: 'route-idx',
      html: `<div style="
      width:22px;height:22px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:12px;color:#fff;background:${ROUTE_COLORS.point};
      box-shadow:0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.3);
    ">${n}</div>`,
      iconSize: [22, 22], iconAnchor: [11, 11],
    });

  const badgeIcon = (txt: string, bg: string) =>
    L.divIcon({
      className: 'route-badge',
      html: `<div style="
      padding:3px 6px;border-radius:6px;
      font-weight:700;font-size:11px;color:#fff;background:${bg};
      box-shadow:0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.3)
    ">${txt}</div>`,
      iconSize: [1, 1], iconAnchor: [10, 10],
    });

  function FitToRoute({ line, points }: { line: [number, number][], points: { lat: number; lng: number; radius_m?: number | null }[] }) {
    const map = useMap();
    React.useEffect(() => {
      const b = L.latLngBounds([]);
      line.forEach(([lat, lng]) => b.extend([lat, lng]));
      points.forEach(p => b.extend([p.lat, p.lng]));
      if (b.isValid()) map.fitBounds(b.pad(0.2));
    }, [map, JSON.stringify(line), JSON.stringify(points)]);
    return null;
  }

  function RouteLayer({ vid }: { vid: number | null }) {
    const meta = vid ? (routeMetaByVid[vid] || null) : null;
    const rid = meta?.id ?? null;
    const line = vid ? (routePolylineByVid[vid] || []) : [];
    const pts = rid ? (routePointsByRid[rid] || []) : [];

    if (!vid || line.length < 2) return null;

    const bufferRadius = Math.max(1, Number(meta?.threshold_m ?? 60));
    const bufferPoly = React.useMemo(
      () => buildRouteBufferPolygon(pts.map(p => ({ lat: p.lat, lng: p.lng })), bufferRadius),
      [JSON.stringify(pts), bufferRadius]
    );

    return (
      <>
        <FitToRoute line={line} points={pts} />

        {/* اوت‌لاین و خط اصلی مسیر */}
        <Polyline positions={line} pathOptions={{ color: '#0d47a1', weight: 8, opacity: 0.25 }} />
        <Polyline positions={line} pathOptions={{ color: '#1e88e5', weight: 5, opacity: 0.9 }} />

        {/* بافر مسیر */}
        {bufferPoly.length >= 3 && (
          <Polygon
            positions={bufferPoly.map(p => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: '#1e88e5', weight: 1, opacity: 0.4, fillOpacity: 0.08 }}
          />
        )}

        {/* فقط دایرهٔ شعاع نقاط (بدون مارکر/عدد) */}
        {pts.map((p, i) => (
          Number.isFinite(p.radius_m as any) && (p.radius_m! > 0) && (
            <Circle
              key={`rpt-${rid}-${i}`}
              center={[p.lat, p.lng]}
              radius={p.radius_m!}
              pathOptions={{ color: '#3949ab', opacity: 0.35, fillOpacity: 0.06 }}
            />
          )
        ))}
      </>
    );
  }





  // === Geometry helpers: LL ⇄ XY + buffer polygon (exactly as requested) ===
  function toXY(lat: number, lng: number, lat0: number, lng0: number): [number, number] {
    const R = 6371000;
    const dLat = (lat - lat0) * Math.PI / 180;
    const dLng = (lng - lng0) * Math.PI / 180;
    const x = dLng * Math.cos((lat0 * Math.PI) / 180) * R;
    const y = dLat * R;
    return [x, y];
  }
  function toLL(x: number, y: number, lat0: number, lng0: number) {
    const R = 6371000, toDeg = (r: number) => (r * 180) / Math.PI;
    return {
      lat: lat0 + toDeg(y / R),
      lng: lng0 + toDeg(x / (R * Math.cos((lat0 * Math.PI) / 180))),
    };
  }
  function lineIntersect(
    p: [number, number], r: [number, number],
    q: [number, number], s: [number, number]
  ): [number, number] | null {
    const [rx, ry] = r, [sx, sy] = s;
    const det = rx * sy - ry * sx;
    if (Math.abs(det) < 1e-9) return null; // parallel-ish
    const [px, py] = p, [qx, qy] = q;
    const t = ((qx - px) * sy - (qy - py) * sx) / det;
    return [px + t * rx, py + t * ry];
  }
  /** می‌سازد یک پولیگون بافر دور کل مسیر (m) */
  function buildRouteBufferPolygon(
    pts: { lat: number; lng: number }[],
    radius_m: number
  ): { lat: number; lng: number }[] {
    if (!pts || pts.length < 2) return [];
    const lat0 = pts[0].lat, lng0 = pts[0].lng;
    const P = pts.map(p => toXY(p.lat, p.lng, lat0, lng0));
    const L = P.length;
    const left: [number, number][] = [], right: [number, number][] = [];
    const dir: [number, number][] = [], nor: [number, number][] = [];
    for (let i = 0; i < L - 1; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[i + 1];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1e-9;
      const ux = dx / len, uy = dy / len;
      dir.push([ux, uy]);
      nor.push([-uy, ux]); // left normal
    }
    { // start cap (flat)
      const [x, y] = P[0], [nx, ny] = nor[0];
      left.push([x + nx * radius_m, y + ny * radius_m]);
      right.push([x - nx * radius_m, y - ny * radius_m]);
    }
    for (let i = 1; i < L - 1; i++) {
      const Pi = P[i];
      const uPrev = dir[i - 1], nPrev = nor[i - 1];
      const uNext = dir[i], nNext = nor[i];
      const a1: [number, number] = [Pi[0] + nPrev[0] * radius_m, Pi[1] + nPrev[1] * radius_m];
      const r1: [number, number] = uPrev;
      const a2: [number, number] = [Pi[0] + nNext[0] * radius_m, Pi[1] + nNext[1] * radius_m];
      const r2: [number, number] = uNext;
      let Lp = lineIntersect(a1, r1, a2, r2);
      if (!Lp) Lp = a2; // bevel fallback
      left.push(Lp);
      const b1: [number, number] = [Pi[0] - nPrev[0] * radius_m, Pi[1] - nPrev[1] * radius_m];
      const b2: [number, number] = [Pi[0] - nNext[0] * radius_m, Pi[1] - nNext[1] * radius_m];
      let Rp = lineIntersect(b1, r1, b2, r2);
      if (!Rp) Rp = b2;
      right.push(Rp);
    }
    { // end cap (flat)
      const [x, y] = P[L - 1], [nx, ny] = nor[nor.length - 1];
      left.push([x + nx * radius_m, y + ny * radius_m]);
      right.push([x - nx * radius_m, y - ny * radius_m]);
    }
    const ringXY = [...left, ...right.reverse()];
    return ringXY.map(([x, y]) => toLL(x, y, lat0, lng0));
  }


  const can = (k: string) => allowed.has(k);
  const canTrackDrivers = React.useMemo(() => can('track_driver'), [allowed]);
  const canSeeVehicle = user?.role_level === 2 || can('view_vehicle');

  // ===== Types =====
  type MonitorKey = typeof MONITOR_PARAMS[number]['key'];
  type VehicleTypeCode = typeof VEHICLE_TYPES[number]['code'];
  type DriverStats = { totalDistanceKm?: number; totalDurationMin?: number; jobsCount?: number; breakdownsCount?: number; };
  type DriverExtra = { license_no?: string; lastSeenAt?: string | null; currentVehicle?: { id: number; plate_no: string; vehicle_type_code?: string } | null; };
  type Station = { id: number; name: string; lat: number; lng: number; radius_m: number };
  type Vehicle = { id: number; plate_no: string; vehicle_type_code: VehicleTypeCode; last_location?: { lat: number; lng: number } };

  // ===== State (راننده‌ها) =====
  const [drivers, setDrivers] = React.useState<User[]>([]);
  const [statsMap, setStatsMap] = React.useState<Record<number, DriverStats>>({});
  const [extras, setExtras] = React.useState<Record<number, DriverExtra>>({});
  const [loading, setLoading] = React.useState(true);

  // ✅ قابلیت‌های اعطاشده توسط SA به تفکیک نوع خودرو
  const [grantedPerType, setGrantedPerType] = React.useState<Record<VehicleTypeCode, MonitorKey[]>>({});
  const [parentSAName, setParentSAName] = React.useState<string | null>(null);

  // ===== تب‌ها: راننده‌ها + تب‌های خودرویی به تفکیک نوع =====


  // وقتی اولین grant رسید، تب همان نوع را خودکار باز کن (خواسته‌ی شما)
  React.useEffect(() => {
    const types = Object.keys(grantedPerType) as VehicleTypeCode[];
    const firstWithGrants = types.find(t => (grantedPerType[t] || []).length > 0);
    if (firstWithGrants) setTab(firstWithGrants);
  }, [grantedPerType]);

  // ===== بازه‌ی زمانی =====
  const [preset, setPreset] = React.useState<'today' | 'yesterday' | '7d' | 'custom'>('today');

  React.useEffect(() => {
    const now = new Date();
    if (preset === 'today') { setFromISO(new Date(new Date().setHours(0, 0, 0, 0)).toISOString()); setToISO(now.toISOString()); }
    else if (preset === 'yesterday') { const s = new Date(); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setHours(23, 59, 59, 999); setFromISO(s.toISOString()); setToISO(e.toISOString()); }
    else if (preset === '7d') { const s = new Date(); s.setDate(s.getDate() - 7); setFromISO(s.toISOString()); setToISO(now.toISOString()); }
  }, [preset]);

  // ===== helpers (fetch راننده‌ها + KPI) =====
  const normalizeUsersToDrivers = (arr: any[]): User[] =>
    (arr || []).map((u: any) => ({ id: u.id, role_level: 6, full_name: u.full_name ?? u.name ?? '—', phone: u.phone ?? '', ...(u.last_location ? { last_location: u.last_location } : {}) }));

  const fetchBranchDrivers = async (): Promise<User[]> => {
    try {
      const { data } = await api.get('/users/my-subordinates-flat');
      return normalizeUsersToDrivers((data || []).filter((u: any) => (u?.role_level ?? 6) === 6));
    } catch { }
    const tries = [
      () => api.get(`/users/branch-manager/${user.id}/subordinates`),
      () => api.get('/users', { params: { branch_manager_user_id: user.id, role_level: 6, limit: 1000 } }),
      () => api.get('/drivers', { params: { branch_manager_user_id: user.id, limit: 1000 } }),
    ];
    for (const fn of tries) {
      try {
        const { data } = await fn();
        const items = data?.items ?? data ?? [];
        const out = Array.isArray(items) ? normalizeUsersToDrivers(items) : normalizeUsersToDrivers([items]);
        if (out.length) return out;
      } catch { }
    }
    return [];
  };

  const toRad = (x: number) => x * Math.PI / 180, R = 6371;
  const hav = (a: [number, number], b: [number, number]) => {
    const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]), lat1 = toRad(a[0]), lat2 = toRad(b[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const fetchStats = React.useCallback(async (ids: number[], from: string, to: string) => {
    const settled = await Promise.allSettled(ids.map(id => api.get(`/driver-routes/stats/${id}`, { params: { from, to } })));
    const entries: [number, DriverStats][] = []; const fallbackIds: number[] = [];
    settled.forEach((r, i) => { const id = ids[i]; if (r.status === 'fulfilled') entries.push([id, r.value?.data ?? {}]); else fallbackIds.push(id); });
    if (fallbackIds.length) {
      const tr = await Promise.allSettled(fallbackIds.map(id => api.get('/tracks', { params: { driver_id: id, from, to } }).then(res => ({ id, data: res.data }))));
      tr.forEach(fr => { if (fr.status === 'fulfilled') { const { id, data } = fr.value as any; const pts: { lat: number; lng: number }[] = Array.isArray(data) ? data : data?.items || []; let d = 0; for (let i = 1; i < pts.length; i++) d += hav([pts[i - 1].lat, pts[i - 1].lng], [pts[i].lat, pts[i].lng]); entries.push([id, { totalDistanceKm: +d.toFixed(2) }]); } });
    }
    setStatsMap(Object.fromEntries(entries));
  }, []);
  const [parentSAId, setParentSAId] = React.useState<number | null>(null);

  // ===== SA parent & granted policies =====
  // کمک‌تابع‌ها
  // بالای فایل (کنار تایپ‌ها)
  // کمک‌تابع‌ها


  // 👇 از روی parentSAId فقط از /vehicles و /users/:id/vehicles می‌گیریم
  const ensureArray = (data: any) =>
    Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);

  const normType = (s?: string) => String(s || '').toLowerCase().replace(/[-_]/g, '');




  // برای جلوگیری از race-condition در fetch ها (به ازای هر نوع خودرو)
  const lastFetchReq = React.useRef<Record<VehicleTypeCode, number>>({});

  const fetchVehiclesOfType = React.useCallback(
    async (vt: VehicleTypeCode) => {
      if (!parentSAId) return;
      const rid = Date.now();
      lastFetchReq.current[vt] = rid;

      const apply = (items: any[]) => {
        if (lastFetchReq.current[vt] !== rid) return;

        const list = (items || [])
          .map((v: any) => {
            const ll = v.last_location
              ? {
                lat: roundLL(Number(v.last_location.lat)),
                lng: roundLL(Number(v.last_location.lng)),
              }
              : undefined;

            return {
              id: Number(v.id),
              plate_no: String(v.plate_no ?? v.plateNo ?? ''),
              vehicle_type_code: normType(v.vehicle_type_code ?? v.vehicleTypeCode) as VehicleTypeCode,
              ...(ll ? { last_location: ll } : {}),
              created_at: v.created_at ?? v.createdAt ?? null,
            };
          })
          .sort((a, b) => a.plate_no.localeCompare(b.plate_no, 'fa', { numeric: true }));

        setVehiclesByType(prev => ({ ...prev, [vt]: list }));
        console.log(`[BM] fetched ${list.length} vehicles for <${vt}> from SA=${parentSAId}`);
      };


      try {
        const { data } = await api.get('/vehicles', { params: { owner_user_id: String(parentSAId), limit: 1000 } });
        const all = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        const items = all.filter((v: any) => normType(v.vehicle_type_code ?? v.vehicleTypeCode) === normType(vt));
        apply(items);
      } catch (e) {
        console.warn('[fetchVehiclesOfType] failed:', e);
        apply([]);
      }
    },
    [parentSAId]
  );

  const [policyRows, setPolicyRows] = React.useState<any[]>([]);

  const availableTypes: VehicleTypeCode[] = React.useMemo(() => {
    const set = new Set<VehicleTypeCode>();
    policyRows.forEach(r => {
      const vt = normType(r?.vehicle_type_code ?? r?.vehicleTypeCode) as VehicleTypeCode;
      if (vt) set.add(vt);
    });
    return Array.from(set);
  }, [policyRows]);




  React.useEffect(() => {
    if (!activeType) return;
    fetchVehiclesOfType(activeType);
  }, [activeType, parentSAId, fetchVehiclesOfType]);


  const pick = (...vals: any[]) => vals.find(v => v !== undefined && v !== null && v !== '');
  const [vehiclesByType, setVehiclesByType] = React.useState<Record<VehicleTypeCode, Vehicle[]>>({});




  // NEW: آی‌دی سوپرادمین(های) والد Branch Manager
  // ⬅️ SA والد

  // اولین اجداد با role_level = 2 را پیدا می‌کند
  // stateهای مرتبط


  // همونی که قبلاً ساختی:
  // ✅ به‌جای getParentSAId که روی /users/:id می‌رفت




  /* React.useEffect(() => {
     if (!user?.id) return;
     let alive = true;
     (async () => {
       const sa = await getParentSAFromPolicies(user.id);
       if (!alive) return;
       setParentSA(sa);
       setParentSAId(sa?.id ?? null);
       setParentSAName(sa?.name ?? null);
     })();
     return () => { alive = false; };
   }, [user?.id, getParentSAFromPolicies]);
 */


  React.useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      const sa = await resolveParentSA(user.id);
      if (!alive) return;
      setParentSA(sa);
      setParentSAId(sa?.id ?? null);
      setParentSAName(sa?.name ?? null);
      console.log('[BM] parentSA resolved =>', sa);
    })();
    return () => { alive = false; };
  }, [user?.id, resolveParentSA]);


  const fetchGrantedPolicies = React.useCallback(async (uid: number) => {
    try {
      const { data } = await api.get(`/vehicle-policies/user/${uid}`, { params: { onlyAllowed: true } });
      const rows: any[] = Array.isArray(data) ? data : [];
      setPolicyRows(rows);

      const map: Record<VehicleTypeCode, MonitorKey[]> = {} as any;
      rows.forEach((row: any) => {
        const vt = String(row?.vehicle_type_code ?? row?.vehicleTypeCode ?? '').toLowerCase() as VehicleTypeCode;
        const arr: MonitorKey[] = Array.isArray(row?.monitor_params ?? row?.monitorParams) ? (row.monitor_params ?? row.monitorParams) : [];
        if (vt) map[vt] = arr;
      });
      setGrantedPerType(map);
    } catch {
      setPolicyRows([]);
      setGrantedPerType({});
    }
  }, []);
  const vehiclesRef = React.useRef<Record<VehicleTypeCode, Vehicle[]>>({});
  React.useEffect(() => { vehiclesRef.current = vehiclesByType; }, [vehiclesByType]);
  // همه‌ی نوع‌هایی که کاربر اجازه دارد (صرف‌نظر از monitor_params)


  // اگر می‌خواهی فقط نوع‌هایی که حداقل یک پارامتر دارند تب شوند:
  const typesWithGrants: VehicleTypeCode[] = React.useMemo(() => {
    const withParams = new Set<VehicleTypeCode>(
      (Object.keys(grantedPerType) as VehicleTypeCode[]).filter(vt => (grantedPerType[vt] || []).length > 0)
    );
    // اتحــاد: یا پارامتر دارد یا صرفاً در پالیسی آمده
    const all = new Set<VehicleTypeCode>([...availableTypes, ...withParams]);
    return Array.from(all);
  }, [availableTypes, grantedPerType]);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const ds = await fetchBranchDrivers();
        setDrivers(ds);
        await fetchStats(ds.map(d => d.id), fromISO, toISO);
      } catch (e) { console.error('[branch-manager] init error:', e); }
      finally { setLoading(false); }
    })();
  }, [user?.id, fromISO, toISO, fetchStats]);

  // ✅ فقط گرانت‌ها
  React.useEffect(() => {
    if (!user?.id) return;
    fetchGrantedPolicies(user.id);
  }, [user?.id, fetchGrantedPolicies]);



  // ===== نقشه =====
  const [useMapTiler] = React.useState(Boolean(MT_KEY));
  const tileUrl = useMapTiler && MT_KEY ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MT_KEY}` : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const [focusLatLng, setFocusLatLng] = React.useState<[number, number] | undefined>(undefined);

  // تا مجبور نشی useEffect سوکت رو به selectedVehicleId وابسته کنی:
  const selectedVehicleIdRef = React.useRef<number | null>(null);
  React.useEffect(() => { selectedVehicleIdRef.current = selectedVehicleId; }, [selectedVehicleId]);

  // ===== WebSocket =====
  const socketRef = React.useRef<Socket | null>(null);
  const [polyline, setPolyline] = React.useState<[number, number][]>([]);
  const liveTrackOnRef = React.useRef<boolean>(false);
  const selectedDriverRef = React.useRef<User | null>(null);

  const subscribedVehiclesRef = React.useRef<Set<number>>(new Set());
  const [addingStationsForVid, setAddingStationsForVid] = React.useState<number | null>(null);
  const lastStationsSubRef = React.useRef<{ vid: number; uid: number } | null>(null);

  // ایستگاه‌ها (per vehicle)
  const [stationRadius, setStationRadius] = React.useState<number>(60);
  const [tempStation, setTempStation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [tempName, setTempName] = React.useState<string>('');
  const [autoIndex, setAutoIndex] = React.useState(1);
  const [editingStation, setEditingStation] = React.useState<{ vid: number; st: Station } | null>(null);
  const [movingStationId, setMovingStationId] = React.useState<number | null>(null);

  // marker lists
  const driverMarkers = React.useMemo(() => {
    if (!canTrackDrivers) return [];
    return drivers.filter(d => (d as any).last_location).map(d => [(d as any).last_location!.lat, (d as any).last_location!.lng] as [number, number]);
  }, [drivers, canTrackDrivers]);

  const typeGrants: MonitorKey[] = activeType ? (grantedPerType[activeType] || []) : [];
  const hasGrant = (k: string) =>
    typeGrants.map(s => String(s).toLowerCase().replace(/[-_]/g, ''))
      .includes(k.toLowerCase().replace(/[-_]/g, ''));
  // ===== Violations (types + state) =====
  type ViolationType =
    | 'overspeed' | 'speeding'
    | 'route_deviation'
    | 'geofence_in' | 'geofence_out' | 'geofence'
    | 'idle_over'
    | 'harsh_brake' | 'harsh_accel' | 'harsh_turn'
    | 'ignition_on_off_hours';

  type Violation = {
    created_at: string | number | Date;
    id?: number;
    vehicle_id: number;
    driver_id?: number | null;
    at: string;                   // ISO date
    lat: number;
    lng: number;
    type: ViolationType;
    severity?: 'low' | 'med' | 'high';
    meta?: Record<string, any>;
  };

  const [violationsByVid, setViolationsByVid] =
    React.useState<Record<number, Violation[]>>({});
  const [vioStatusByVid, setVioStatusByVid] =
    React.useState<Record<number, 'idle' | 'loading' | 'loaded' | 'error'>>({});

  const [vioFilterTypes, setVioFilterTypes] = React.useState<Set<ViolationType>>(
    new Set<ViolationType>(['overspeed', 'speeding', 'route_deviation', 'geofence_out', 'idle_over'])
  );
  const [vioOnlySevere, setVioOnlySevere] = React.useState(false);
  const [selectedVioId, setSelectedVioId] = React.useState<number | null>(null);

  // دسترسی: اگر «violations» یا هرکدام از کلیدهای مرتبط گرانت شده باشد
  const canViolations =
    !!(activeType && (
      hasGrant('violations') ||
      hasGrant('overspeed') || hasGrant('speeding') ||
      hasGrant('route_deviation') ||
      hasGrant('geo_fence') || hasGrant('geofence') ||
      hasGrant('idle_time')
    ));
  function normalizeViolations(payload: any, fallbackVid?: number): Violation[] {
    const arr: any[] =
      Array.isArray(payload) ? payload
        : Array.isArray(payload?.items) ? payload.items
          : Array.isArray(payload?.data?.items) ? payload.data.items
            : Array.isArray(payload?.data) ? payload.data
              : Array.isArray(payload?.rows) ? payload.rows
                : payload ? [payload] : [];

    const num = (v: any) => (Number.isFinite(+v) ? +v : NaN);
    const toISO = (v: any) => { const d = new Date(v); return isNaN(+d) ? new Date().toISOString() : d.toISOString(); };
    const ll = (lat: any, lng: any) => ({ lat: num(lat), lng: num(lng) });

    return arr.map((r: any) => {
      const p = r?.position ?? r?.pos ?? r?.loc ?? r;
      const t = String(r?.type ?? r?.violation_type ?? r?.code ?? '').toLowerCase() as ViolationType;
      const tm = r?.at ?? r?.time ?? r?.created_at ?? r?.createdAt;
      const lat = p?.lat ?? p?.latitude ?? p?.y;
      const lng = p?.lng ?? p?.longitude ?? p?.x;

      return {
        id: Number.isFinite(+r?.id) ? +r.id : undefined,
        vehicle_id: Number.isFinite(+r?.vehicle_id ?? +r?.vehicleId) ? +(r?.vehicle_id ?? r?.vehicleId) : (fallbackVid ?? NaN),
        driver_id: Number.isFinite(+r?.driver_id ?? +r?.driverId) ? +(r?.driver_id ?? r?.driverId) : null,
        at: toISO(tm),
        ...ll(lat, lng),
        type: t || 'overspeed',
        severity: (r?.severity ?? r?.level ?? '').toLowerCase() as any || undefined,
        meta: r?.meta ?? r
      };
    }).filter(v => Number.isFinite(v.vehicle_id) && Number.isFinite(v.lat) && Number.isFinite(v.lng));
  }

  const vioReqRef = React.useRef<Record<number, number>>({});

  const refreshViolations = React.useCallback(
    async (vid: number, from: string, to: string) => {
      const stamp = Date.now();
      vioReqRef.current[vid] = stamp;
      setVioStatusByVid(p => ({ ...p, [vid]: 'loading' }));

      const params: any = { from, to };
      const types = Array.from(vioFilterTypes);
      if (types.length) params.types = types.join(',');

      try {
        // مسیر اصلی
        const { data } = await api.get(`/vehicles/${vid}/violations`, { params });
        if (vioReqRef.current[vid] !== stamp) return;
        const list = normalizeViolations(data, vid);
        setViolationsByVid(p => ({ ...p, [vid]: list }));
        setVioStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
      } catch {
        // فالبک‌های رایج
        try {
          const { data } = await api.get('/violations', { params: { ...params, vehicle_id: String(vid) } });
          if (vioReqRef.current[vid] !== stamp) return;
          const list = normalizeViolations(data, vid);
          setViolationsByVid(p => ({ ...p, [vid]: list }));
          setVioStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
        } catch {
          try {
            const { data } = await api.get('/events', { params: { ...params, category: 'violation', vehicle_id: String(vid) } });
            if (vioReqRef.current[vid] !== stamp) return;
            const list = normalizeViolations(data, vid);
            setViolationsByVid(p => ({ ...p, [vid]: list }));
            setVioStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
          } catch {
            setVioStatusByVid(p => ({ ...p, [vid]: 'error' }));
          }
        }
      }
    },
    [vioFilterTypes]
  );
  const lastVioVidRef = React.useRef<number | null>(null);

  const canTrackVehicles = !!(activeType && hasGrant('gps'));
  const canStations = !!(activeType && hasGrant('stations'));
  const canConsumables = !!(activeType && hasGrant('consumables'));
  const canIgnition = !!(activeType && hasGrant('ignition'));
  const canIdleTime = !!(activeType && hasGrant('idle_time'));
  const canOdometer = !!(activeType && hasGrant('odometer'));
  const canGeoFence = !!(activeType && (hasGrant('geo_fence') || hasGrant('geofence')));

  const canRouteEdit =
    !!(activeType && (hasGrant('route') || hasGrant('routes') || hasGrant('route_edit')));
  // آخرین سابسکرایب برای هر کلید
  const lastIgnVidRef = React.useRef<number | null>(null);
  const lastIdleVidRef = React.useRef<number | null>(null);
  const lastOdoVidRef = React.useRef<number | null>(null);
  type GeofenceCircle = {
    id?: number;
    type: 'circle';
    center: { lat: number; lng: number };
    radius_m: number;
    tolerance_m?: number | null;
  };
  type GeofencePolygon = {
    id?: number;
    type: 'polygon';
    points: { lat: number; lng: number }[];
    tolerance_m?: number | null;
  };
  type Geofence = GeofenceCircle | GeofencePolygon;

  // per-vehicle cache
  const [geofencesByVid, setGeofencesByVid] = React.useState<Record<number, Geofence[]>>({});

  // UI state برای ترسیم/ویرایش
  const [gfMode, setGfMode] = React.useState<'circle' | 'polygon'>('circle');
  const [gfDrawing, setGfDrawing] = React.useState(false);
  const [gfCenter, setGfCenter] = React.useState<{ lat: number; lng: number } | null>(null);
  const [gfRadius, setGfRadius] = React.useState<number>(150);
  const [gfPoly, setGfPoly] = React.useState<{ lat: number; lng: number }[]>([]);
  const [gfTolerance, setGfTolerance] = React.useState<number>(15);
  function PickPointsForGeofence({
    enabled,
    onPick,
  }: {
    enabled: boolean;
    onPick: (lat: number, lng: number) => void;
  }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }
  async function loadVehicleGeofenceBM(vid: number) {
    try {
      const { data } = await api.get(`/vehicles/${vid}/geofence`, {
        params: { _: Date.now() },
        headers: { 'Cache-Control': 'no-store' },
      });

      // خروجی را به آرایه‌ی استاندارد Geofence[] تبدیل کن
      const list = normalizeGeofences(data); // حتی اگر تک‌آبجکت بود، آرایه می‌شود
      setGeofencesByVid(p => ({ ...p, [vid]: list }));
      return list;
    } catch {
      setGeofencesByVid(p => ({ ...p, [vid]: [] }));
      return [];
    }
  }


  async function saveGeofenceBM() {
    if (!selectedVehicleId) return;

    const toInt = (v: any, min: number) => Math.max(min, Math.trunc(Number(v)));

    let payload: any;
    if (gfMode === 'circle') {
      if (!gfCenter || !Number.isFinite(gfCenter.lat) || !Number.isFinite(gfCenter.lng) || !Number.isFinite(gfRadius) || gfRadius <= 0) {
        alert('مرکز و شعاع دایره را درست وارد کنید.'); return;
      }
      payload = {
        type: 'circle',
        centerLat: +gfCenter.lat,
        centerLng: +gfCenter.lng,
        radiusM: toInt(gfRadius, 1),
        toleranceM: toInt(gfTolerance ?? 5, 0),
      };
    } else {
      if (!Array.isArray(gfPoly) || gfPoly.length < 3) { alert('چندضلعی حداقل به ۳ نقطه نیاز دارد.'); return; }
      payload = {
        type: 'polygon',
        polygonPoints: gfPoly.map(p => ({ lat: +p.lat, lng: +p.lng })),
        toleranceM: toInt(gfTolerance ?? 5, 0),
      };
    }

    try {
      await api.put(`/vehicles/${selectedVehicleId}/geofence`, payload)
        .catch(() => api.post(`/vehicles/${selectedVehicleId}/geofence`, payload));

      await loadVehicleGeofences(selectedVehicleId);      // reset draw UI
      setGfDrawing(false); setGfCenter(null); setGfPoly([]);
    } catch (e: any) {
      console.error('saveGeofenceBM error:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'ثبت ژئوفنس ناموفق بود');
    }
  }

  async function deleteGeofenceBM() {
    if (!selectedVehicleId) return;
    if (!confirm('ژئوفنس حذف شود؟')) return;

    try {
      await api.delete(`/vehicles/${selectedVehicleId}/geofence`)  // اگر API شما فقط تکی پاک می‌کند
        .catch(() => api.delete(`/geofences`, { params: { vehicle_id: String(selectedVehicleId) } })); // اگر جمعی دارید

      setGeofencesByVid(p => ({ ...p, [selectedVehicleId]: [] }));

      setGfDrawing(false); setGfCenter(null); setGfPoly([]);
    } catch (e) {
      console.error(e);
      alert('حذف ژئوفنس ناموفق بود');
    }
  }

  // بالاتر از تابع، یه کمک‌تابع کوچک
  /*  const ensureArray = (data: any) =>
     Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
 */


  // REPLACE: به جای نسخه‌ای که ownerId تکی می‌گرفت

  // صدا زدنش





  // این نسخه را بگذار جای fetchVehiclesOfType فعلی‌ت





  // REPLACE: قبلاً parentSA?.id تکی بود؛ الان از parentSAIds استفاده کن
  // ✅ فقط همین
  React.useEffect(() => {
    if (!activeType) return;
    fetchVehiclesOfType(activeType);
  }, [activeType, parentSAId, fetchVehiclesOfType]);




  // --- جایگزین این تابع کن ---





  // وقتی تب نوع فعال شد، ماشین‌های همان نوع را بگیر و سابسکرایب pos



  React.useEffect(() => {
    const s = socketRef.current;
    if (!s || !activeType || !canTrackVehicles) return;

    const nextIds = new Set((vehiclesByType[activeType] || []).map(v => v.id));
    const prev = subscribedVehiclesRef.current;

    const toSub: number[] = [];
    const toUnsub: number[] = [];

    nextIds.forEach(id => { if (!prev.has(id)) toSub.push(id); });
    prev.forEach(id => { if (!nextIds.has(id)) toUnsub.push(id); });

    // pos: سابسکرایب/آن‌سابِ اختلاف
    toSub.forEach(id => s.emit('subscribe', { topic: `vehicle/${id}/pos` }));
    toUnsub.forEach(id => s.emit('unsubscribe', { topic: `vehicle/${id}/pos` }));

    // چون لیست ماشین‌های تحت‌نظر عوض شده، سابسکرایب‌های تله‌متری قبلی را آزاد کن
    if (lastIgnVidRef.current) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIgnVidRef.current}/ignition` });
      lastIgnVidRef.current = null;
    }
    if (lastIdleVidRef.current) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIdleVidRef.current}/idle_time` });
      lastIdleVidRef.current = null;
    }
    if (lastTelemOdoVidRef.current) {
      s.emit('unsubscribe', { topic: `vehicle/${lastTelemOdoVidRef.current}/odometer` });
      lastTelemOdoVidRef.current = null;
    }

    subscribedVehiclesRef.current = nextIds;
  }, [activeType, canTrackVehicles, vehiclesByType]);


  // اتصال سوکت
  React.useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const s = io(url + '/vehicles', { transports: ['websocket'] });
    socketRef.current = s;

    // === هندلرها ===
    const onDriverPos = (v: { driver_id: number; lat: number; lng: number }) => {
      // اختیاری: هر کاری لازم داری
    };

    const onVehiclePos = (v: { vehicle_id: number; lat: number; lng: number }) => {
      // اختیاری: هر کاری لازم داری
    };

    const onStations = (msg: any) => {
      const vid = Number(msg?.vehicle_id ?? msg?.vehicleId);
      if (!Number.isFinite(vid)) return;

      setVehicleStationsMap(prev => {
        const list = (prev[vid] || []).slice();
        const normalize = (st: any) => ({
          ...st,
          lat: roundLL(parseFloat(String(st.lat))),
          lng: roundLL(parseFloat(String(st.lng))),
        });

        if (msg?.type === 'created' && msg.station) {
          const st = normalize(msg.station);
          if (!list.some(x => x.id === st.id)) list.push(st);
        } else if (msg?.type === 'updated' && msg.station) {
          const st = normalize(msg.station);
          const i = list.findIndex(x => x.id === st.id);
          if (i >= 0) list[i] = st;
        } else if (msg?.type === 'deleted' && msg.station_id) {
          const sid = Number(msg.station_id);
          return { ...prev, [vid]: list.filter(x => x.id !== sid) };
        }
        return { ...prev, [vid]: list };
      });
    };

    // --- NEW: هندلر کیلومترشمار ---
    const onOdo = (data: { vehicle_id: number; odometer: number }) => {
      // فقط اگر همین ماشینی‌ست که الان انتخاب شده
      if (selectedVehicleIdRef.current === data.vehicle_id) {
        setVehicleTlm(prev => ({ ...prev, odometer: data.odometer }));
      }
    };
    s.on('vehicle:ignition', (d: { vehicle_id: number; ignition: boolean }) =>
      selectedVehicleIdRef.current === d.vehicle_id && setVehicleTlm(p => ({ ...p, ignition: d.ignition })));

    s.on('vehicle:idle_time', (d: { vehicle_id: number; idle_time: number }) =>
      selectedVehicleIdRef.current === d.vehicle_id && setVehicleTlm(p => ({ ...p, idle_time: d.idle_time })));

    s.on('vehicle:odometer', (d: { vehicle_id: number; odometer: number }) =>
      selectedVehicleIdRef.current === d.vehicle_id && setVehicleTlm(p => ({ ...p, odometer: d.odometer })));

    // === ثبت لیسنرها ===
    s.on('driver:pos', onDriverPos);
    s.on('vehicle:pos', onVehiclePos);
    s.on('vehicle:stations', onStations);
    s.on('vehicle:odometer', onOdo);   // ⬅️ این خط جدید
    // --- VIOLATIONS: handler ---
    const onViolation = (msg: any) => {
      const v = normalizeViolations(msg?.violation ?? msg, msg?.vehicle_id ?? msg?.vehicleId)[0];
      if (!v) return;
      setViolationsByVid(prev => {
        const cur = prev[v.vehicle_id] || [];
        // اگر فیلتر severe فعال است، اینجا رد نکن—در UI فیلتر کن که تاریخچه حفظ بماند
        // از تکرار جلوگیری
        const exists = v.id && cur.some(x => x.id === v.id);
        const next = exists ? cur : [v, ...cur];
        return { ...prev, [v.vehicle_id]: next };
      });
    };

    // ثبت لیسنر
    s.on('vehicle:violation', onViolation);

    // پاکسازی
    // ...

    // === پاکسازی ===
    return () => {
      // آن‌سابسکرایب pos ها
      subscribedVehiclesRef.current.forEach((id) => {
        s.emit('unsubscribe', { topic: `vehicle/${id}/pos` });
      });
      subscribedVehiclesRef.current = new Set();

      // آن‌سابسکرایب stations
      if (lastStationsSubRef.current) {
        const { vid, uid } = lastStationsSubRef.current;
        s.emit('unsubscribe', { topic: `vehicle/${vid}/stations/${uid}` });
        lastStationsSubRef.current = null;
      }
      s.off('vehicle:violation', onViolation);

      // --- NEW: آن‌سابسکرایب از تاپیک odometer اگر فعال بود
      if (lastTelemOdoVidRef.current) {
        s.emit('unsubscribe', { topic: `vehicle/${lastTelemOdoVidRef.current}/odometer` });
        lastTelemOdoVidRef.current = null;
      }

      // off هندلرها
      s.off('driver:pos', onDriverPos);
      s.off('vehicle:pos', onVehiclePos);
      s.off('vehicle:stations', onStations);
      s.off('vehicle:odometer', onOdo);

      s.disconnect();
      socketRef.current = null;
    };
  }, []);



  // سابسکرایب/آن‌سابسکرایب pos برای ماشین‌های تب فعال
  React.useEffect(() => {
    const vt = activeType;
    if (!vt || !parentSAId) return;
    if (!(vt in vehiclesByType)) {
      fetchVehiclesOfType(vt);
    }
  }, [activeType, parentSAId, vehiclesByType, fetchVehiclesOfType]);



  // ===== ایستگاه‌ها =====

  const startAddingStationsFor = async (vid: number) => {
    const next = addingStationsForVid === vid ? null : vid;
    setAddingStationsForVid(next);
    setTempStation(null);
    setTempName(`ایستگاه ${autoIndex}`);

    const s = socketRef.current;
    if (!s) return;

    // پاکسازی سابسکرایب قبلی
    if (lastStationsSubRef.current) {
      const { vid: pvid, uid } = lastStationsSubRef.current;
      s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations/${uid}` });
      s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations` });
      lastStationsSubRef.current = null;
    }

    if (next != null) {
      // ساب روی هر دو تاپیک
      s.emit('subscribe', { topic: `vehicle/${next}/stations/${user.id}` });
      s.emit('subscribe', { topic: `vehicle/${next}/stations` });
      lastStationsSubRef.current = { vid: next, uid: user.id };

      if (!vehicleStationsMap[next]) fetchStations(next);
    }
  };

  const confirmTempStation = async () => {
    if (!addingStationsForVid || !tempStation) return;
    const name = (tempName || `ایستگاه ${autoIndex}`).trim();

    try {
      await api.post(`/vehicles/${addingStationsForVid}/stations`, {
        name,
        lat: roundLL(tempStation.lat),
        lng: roundLL(tempStation.lng),
        radius_m: stationRadius,
      });

      await fetchStations(addingStationsForVid); // بعد از ساخت، تازه بخوان
      setAutoIndex(i => i + 1);
      setTempStation(null);
    } catch {
      alert('ثبت ایستگاه ناموفق بود');
    }
  };

  const deleteStation = async (vid: number, st: Station) => {
    if (!confirm('ایستگاه حذف شود؟')) return;
    try {
      await api.delete(`/vehicles/${vid}/stations/${st.id}`);
      setVehicleStationsMap(prev => ({ ...prev, [vid]: (prev[vid] || []).filter(x => x.id !== st.id) }));
      if (editingStation?.st.id === st.id) setEditingStation(null);
    } catch { alert('حذف ناموفق بود'); }
  };
  const saveEditStation = async () => {
    const ed = editingStation; if (!ed) return;
    try {
      await api.put(`/vehicles/${ed.vid}/stations/${ed.st.id}`, { name: ed.st.name, lat: ed.st.lat, lng: ed.st.lng, radius_m: ed.st.radius_m });
      setVehicleStationsMap(prev => ({ ...prev, [ed.vid]: (prev[ed.vid] || []).map(x => x.id === ed.st.id ? ed.st : x) }));
      setEditingStation(null); setMovingStationId(null);
    } catch { alert('ذخیره ویرایش ناموفق بود'); }
  };

  // ===== مسیر راننده =====

  const lastTelemOdoVidRef = React.useRef<number | null>(null);

  // ===== Map click helper =====
  // بیرون از BranchManagerRoleSection.tsx (یا بالا، خارج از بدنه‌ی تابع)

  const onPickVehicleBM = React.useCallback(async (v: Vehicle) => {
    setSelectedVehicleId(v.id);
    await loadVehicleGeofences(v.id);
    setSheetOpen(true);        // ⬅️ این خط را اضافه کن
    setSheetMode('vehicle');
    await loadViolations(v.id);

    // ریست حالت‌های افزودن/ادیت ایستگاه
    setAddingStationsForVid(null);
    setEditingStation(null);
    setMovingStationId(null);
    setTempStation(null);
    await loadVehicleRoute(v.id);

    if (v.last_location) setFocusLatLng([v.last_location.lat, v.last_location.lng]);

    // ایستگاه‌ها (در صورت مجوز)
    if (canStations) {
      await ensureStationsLive(v.id);   // subscribe + fetch
    } else {
      await fetchStations(v.id);        // فقط fetch برای نمایش روی نقشه
    }
    const s = socketRef.current;
    if (s && canViolations) {
      if (lastVioVidRef.current && lastVioVidRef.current !== v.id) {
        s.emit('unsubscribe', { topic: `vehicle/${lastVioVidRef.current}/violations` });
        lastVioVidRef.current = null;
      }
      s.emit('subscribe', { topic: `vehicle/${v.id}/violations` });
      lastVioVidRef.current = v.id;

      // فچ اولیه در بازه انتخابی
      await refreshViolations(v.id, fromISO, toISO);
    }

    // --- آزاد کردن سابسکرایب‌های قبلی تله‌متری (هر کدام جدا) ---
    if (s && lastIgnVidRef.current && lastIgnVidRef.current !== v.id) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIgnVidRef.current}/ignition` });
      lastIgnVidRef.current = null;
    }
    if (s && lastIdleVidRef.current && lastIdleVidRef.current !== v.id) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIdleVidRef.current}/idle_time` });
      lastIdleVidRef.current = null;
    }


    // مقادیر قبلی تله‌متری را پاک کن (تا UI وضعیت نامشخص نشان دهد)
    setVehicleTlm({});

    // ===== فچ اولیه تله‌متری (صرفاً برای کلیدهای مجاز) =====
    try {
      const keysWanted: ('ignition' | 'idle_time' | 'odometer')[] = [];
      if (canIgnition) keysWanted.push('ignition');
      if (canIdleTime) keysWanted.push('idle_time');
      if (canOdometer) keysWanted.push('odometer');

      if (keysWanted.length) {
        const { data } = await api.get(`/vehicles/${v.id}/telemetry`, { params: { keys: keysWanted } });

        const next: { ignition?: boolean; idle_time?: number; odometer?: number } = {};
        if (typeof data?.ignition === 'boolean') next.ignition = data.ignition;
        if (typeof data?.idle_time === 'number') next.idle_time = data.idle_time;
        if (typeof data?.odometer === 'number') next.odometer = data.odometer;

        setVehicleTlm(next);
      }
    } catch {
      // مشکلی نبود؛ بعداً از سوکت آپدیت می‌گیریم
    }

    // ===== سابسکرایب تله‌متری برای ماشین انتخاب‌شده (هر کدام که مجاز است) =====
    if (s) {
      if (canIgnition) {
        s.emit('subscribe', { topic: `vehicle/${v.id}/ignition` });
        lastIgnVidRef.current = v.id;
      }
      if (canIdleTime) {
        s.emit('subscribe', { topic: `vehicle/${v.id}/idle_time` });
        lastIdleVidRef.current = v.id;  // ✅ درست
      }

      if (canOdometer) {
        s.emit('subscribe', { topic: `vehicle/${v.id}/odometer` });
        lastTelemOdoVidRef.current = v.id;
      }
    }
    // ژئوفنس (در صورت مجوز)
    setSelectedVehicleId(v.id);
    await loadVehicleGeofences(v.id); // همین یکی بماند




    // ===== لوازم مصرفی (کاملاً مستقل از تله‌متری) =====
    if (canConsumables) {
      // اسنپ‌شات لوکال
      const snap = loadConsLocal(v.id);
      if (snap.length) {
        setConsumablesByVid(p => ({ ...p, [v.id]: snap }));
        setConsStatusByVid(p => ({ ...p, [v.id]: 'loaded' }));
      } else {
        setConsumablesByVid(p => ({ ...p, [v.id]: [] }));
        setConsStatusByVid(p => ({ ...p, [v.id]: 'loading' }));
      }
      // همسان‌سازی از سرور
      refreshConsumables(v.id);
    } else {
      setConsumablesByVid(p => ({ ...p, [v.id]: [] }));
      setConsStatusByVid(p => ({ ...p, [v.id]: 'idle' }));
    }
  }, [
    canStations,
    ensureStationsLive,
    canConsumables,
    refreshConsumables,
    canIgnition,
    canIdleTime,
    canOdometer,
  ]);



  const DEFAULT_KM_REMINDER = 5000;
  const keyOfCons = (c: any) => String(c.id ?? `${c.mode}:${c.start_at ?? c.base_odometer_km ?? Math.random()}`);
  const notifyOnce = (c: any, msg: string) => {
    const k = keyOfCons(c);
    if (notifiedRef.current.has(k)) return;
    notifiedRef.current.add(k);
    setToast({ open: true, msg });
  };

  const canEditGeofence = !!(activeType && (hasGrant('geo_fence') || hasGrant('geofence')));
  React.useEffect(() => {
    if (!selectedVehicleId) return;
    loadVehicleGeofences(selectedVehicleId);
  }, [selectedVehicleId]); // ⬅️ canGeoFence از دیپندنسی حذف شد


  const checkConsumableDue = React.useCallback(() => {
    if (!selectedVehicleId) return;
    const list = consumablesByVid[selectedVehicleId] || [];
    const now = Date.now();

    list.forEach((c: any) => {
      if (c.mode === 'time' && c.start_at) {
        const t = new Date(c.start_at).getTime();
        if (!Number.isNaN(t) && now >= t) {
          notifyOnce(c, `یادآوری: «${c.title ?? c.note ?? 'آیتم'}» به زمان تعیین‌شده رسید.`);
        }
      }
      if (c.mode === 'km' && c.base_odometer_km != null && vehicleTlm.odometer != null) {
        const dist = Number(vehicleTlm.odometer) - Number(c.base_odometer_km);
        if (dist >= DEFAULT_KM_REMINDER) {
          notifyOnce(c, `یادآوری: «${c.title ?? c.note ?? 'آیتم'}» به ${DEFAULT_KM_REMINDER.toLocaleString('fa-IR')} کیلومتر پس از صفر رسید.`);
        }
      }
    });
  }, [selectedVehicleId, consumablesByVid, vehicleTlm.odometer]);

  React.useEffect(() => { checkConsumableDue(); }, [checkConsumableDue]);
  React.useEffect(() => {
    const id = setInterval(checkConsumableDue, 30_000);
    return () => clearInterval(id);
  }, [checkConsumableDue]);
  const openEditConsumable = (c: any) => {
    setEditingCons({
      id: c.id,
      mode: c.mode,
      note: c.note ?? '',
      start_at: c.start_at ?? null,
      base_odometer_km: c.base_odometer_km ?? null,
    });
  };
  const closeEditConsumable = () => setEditingCons(null);
  function normalizeGeofences(payload: any): Geofence[] {
    // به آرایه تبدیل کن
    const arr: any[] = Array.isArray(payload) ? payload
      : Array.isArray(payload?.items) ? payload.items
        : Array.isArray(payload?.data?.items) ? payload.data.items
          : Array.isArray(payload?.data) ? payload.data
            : Array.isArray(payload?.rows) ? payload.rows
              : Array.isArray(payload?.geofences) ? payload.geofences
                : payload?.rule ? [payload.rule]
                  : payload ? [payload] : [];

    const toNumStrict = (v: any) => (
      v === null || v === undefined || v === '' ? undefined :
        (Number.isFinite(+v) ? +v : undefined)
    );
    const toLL = (p: any) => {
      const lat = toNumStrict(p?.lat ?? p?.latitude ?? p?.y);
      const lng = toNumStrict(p?.lng ?? p?.longitude ?? p?.x);
      return (lat != null && lng != null) ? { lat, lng } : undefined;
    };

    const out: Geofence[] = [];

    for (const g of arr) {
      const geom = g?.geometry ?? g?.geojson ?? g?.geoJSON;
      const type = String(g?.type ?? geom?.type ?? '').toLowerCase();

      // ---- candidate: circle ----
      const centerObj = g?.center ?? {
        lat: g?.centerLat ?? g?.center_lat ?? g?.lat,
        lng: g?.centerLng ?? g?.center_lng ?? g?.lng,
      };
      const center = toLL(centerObj ?? {});
      const radius = toNumStrict(g?.radius_m ?? g?.radiusM ?? g?.radius ?? geom?.radius);
      const tol = toNumStrict(g?.tolerance_m ?? g?.toleranceM ?? g?.tolerance);

      const looksCircle = (type === 'circle') || (radius != null && radius > 0 && !!center);
      if (looksCircle && center && radius != null && radius > 0) {
        out.push({
          type: 'circle',
          id: toNumStrict(g?.id),
          center,
          radius_m: radius,
          tolerance_m: (tol ?? null),
        } as GeofenceCircle);
        continue; // فقط وقتی دایره معتبر push شد از این آیتم می‌گذریم
      }

      // ---- candidate: polygon via points/polygonPoints ----
      const rawPoints = g?.points ?? g?.polygonPoints ?? g?.polygon_points ?? geom?.points;
      if (Array.isArray(rawPoints)) {
        const pts = rawPoints.map((p: any) => toLL(p)).filter(Boolean) as { lat: number; lng: number }[];
        if (pts.length >= 3) {
          out.push({
            type: 'polygon',
            id: toNumStrict(g?.id),
            points: pts,
            tolerance_m: (tol ?? null),
          } as GeofencePolygon);
          continue;
        }
      }

      // ---- candidate: polygon via GeoJSON.coordinates ----
      const coords = geom?.coordinates;
      if (String(geom?.type ?? g?.type ?? '').toLowerCase() === 'polygon' && Array.isArray(coords)) {
        const ring = Array.isArray(coords[0]) ? coords[0] : coords; // [[lng,lat], ...]
        const pts = ring
          .map((xy: any) => Array.isArray(xy) && xy.length >= 2 ? ({ lat: toNumStrict(xy[1]), lng: toNumStrict(xy[0]) }) : undefined)
          .filter((p: any) => p?.lat != null && p?.lng != null) as { lat: number; lng: number }[];
        if (pts.length >= 3) {
          out.push({
            type: 'polygon',
            id: toNumStrict(g?.id),
            points: pts,
            tolerance_m: (tol ?? null),
          } as GeofencePolygon);
          continue;
        }
      }
    }

    // یکتاسازی بر اساس id (اگر داشت)
    const seen = new Set<number>();
    return out.filter(g => (g.id ? !seen.has(g.id) && (seen.add(g.id), true) : true));
  }
  // انتخاب نقطه برای ایستگاه‌ها (کلیک روی نقشه وقتی حالت افزودن فعال است)
  function PickPointsForStations({
    enabled,
    onPick,
  }: {
    enabled: boolean;
    onPick: (lat: number, lng: number) => void;
  }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => {
      if (enabled) onPick(e.latlng.lat, e.latlng.lng);
    });
    return null;
  }

  async function loadVehicleGeofences(vid: number) {
    try {
      const { data } = await api.get(`/vehicles/${vid}/geofence`, {
        params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }
      });
      const list = normalizeGeofences(data); // تک آبجکت را هم آرایه می‌کند
      setGeofencesByVid(p => ({ ...p, [vid]: list }));
      return list;
    } catch {
      setGeofencesByVid(p => ({ ...p, [vid]: [] }));
      return [];
    }
  }
  React.useEffect(() => {
    if (selectedVehicleId && canViolations) {
      refreshViolations(selectedVehicleId, fromISO, toISO);
    }
  }, [selectedVehicleId, canViolations, fromISO, toISO, refreshViolations]);


  const saveEditConsumable = async () => {
    if (!selectedVehicleId || !editingCons?.id) return;
    setSavingCons(true);
    try {
      const payload: any = { mode: editingCons.mode, note: (editingCons.note ?? '').trim() };
      if (editingCons.mode === 'time') {
        if (!editingCons.start_at) { alert('start_at لازم است'); setSavingCons(false); return; }
        payload.start_at = new Date(editingCons.start_at).toISOString();
      } else {
        const n = Number(editingCons.base_odometer_km);
        if (!Number.isFinite(n)) { alert('base_odometer_km معتبر نیست'); setSavingCons(false); return; }
        payload.base_odometer_km = n;
      }
      await updateConsumable(selectedVehicleId, editingCons.id, payload);
      await refreshConsumables(selectedVehicleId, true);
      closeEditConsumable();
    } catch (e: any) {
      console.error('PATCH /consumables failed:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'خطا در ویرایش آیتم روی سرور');
    } finally { setSavingCons(false); }
  };

  const deleteConsumable = async (c: any) => {
    if (!selectedVehicleId || !c?.id) return;
    if (!confirm('آیتم حذف شود؟')) return;
    try {
      await api.delete(`/vehicles/${selectedVehicleId}/consumables/${c.id}`);
      await refreshConsumables(selectedVehicleId, true);
      if (editingCons?.id === c.id) closeEditConsumable();
    } catch (e: any) {
      console.error('DELETE /consumables failed:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'حذف روی سرور ناموفق بود');
    }
  };

  const handleAddConsumable = async () => {
    if (!selectedVehicleId) return;
    try {
      const payload: any = { mode: consumableMode, note: (tripNote || '').trim() };
      if (consumableMode === 'time') {
        if (!tripDate) { alert('تاریخ لازم است'); return; }
        payload.start_at = new Date(tripDate).toISOString();
      } else {
        const base = Number(tripBaseKm ?? vehicleTlm.odometer);
        if (!Number.isFinite(base)) { alert('مقدار مبنا معتبر نیست'); return; }
        payload.base_odometer_km = base;
      }
      const { data } = await createConsumable(selectedVehicleId, payload);
      const [created] = normalizeConsumables([data]);
      setConsumablesByVid(prev => {
        const cur = prev[selectedVehicleId] || [];
        const next = created ? [created, ...cur] : cur;
        saveConsLocal(selectedVehicleId, next);
        return { ...prev, [selectedVehicleId]: next };
      });
      await refreshConsumables(selectedVehicleId, true);
      setConsumablesOpen(false);
      setTripNote(''); setTripBaseKm(null);
    } catch (err: any) {
      console.error('POST /consumables failed:', err?.response?.data || err);
      alert(err?.response?.data?.message || 'خطا در ذخیره لوازم مصرفی روی سرور');
    }
  };

  const handleTripReset = async () => {
    if (!selectedVehicleId) return;
    if (vehicleTlm.odometer == null) { alert('داده‌ی کیلومترشمار در دسترس نیست.'); return; }
    try {
      await api.post(`/vehicles/${selectedVehicleId}/trip/start`, {
        base_odometer_km: Number(vehicleTlm.odometer),
        started_at: (tripDate || new Date()).toISOString(),
        note: (tripNote || '').trim(),
      }).catch(() => { });
    } finally {
      setTripBaseKm(Number(vehicleTlm.odometer));
    }
  };


  const filteredDrivers = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return drivers;
    return drivers.filter(d =>
      (d.full_name || '').toLowerCase().includes(s) ||
      (d.phone || '').includes(s)
    );
  }, [drivers, q]);
  const filteredVehicles = React.useMemo(() => {
    if (!activeType) return [];
    const list = vehiclesByType[activeType] || [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(v => v.plate_no.toLowerCase().includes(s));
  }, [q, activeType, vehiclesByType]);
  const availableTypesKey = React.useMemo(
    () => (availableTypes.length ? [...availableTypes].sort().join(',') : ''),
    [availableTypes]
  );
  React.useEffect(() => {
    if (!parentSAId) return;
    const types = availableTypes.length
      ? availableTypes
      : (VEHICLE_TYPES.map((t) => t.code) as VehicleTypeCode[]); // fallback
    types.forEach((vt) => fetchVehiclesOfType(vt));
  }, [parentSAId, availableTypesKey, fetchVehiclesOfType]);

  // ===== Guards =====
  if (permsLoading || loading) {
    return <Box p={2} display="flex" alignItems="center" justifyContent="center">
      <CircularProgress size={24} />
    </Box>;
  }
  if (!can('view_report')) {
    return <Box p={2} color="text.secondary">دسترسی فعالی برای نمایش این صفحه برای شما تنظیم نشده است.</Box>;
  }

  const VIO_LABEL: Record<ViolationType, string> = {
    overspeed: 'سرعت غیرمجاز',
    speeding: 'سرعت غیرمجاز',
    route_deviation: 'انحراف از مسیر',
    geofence_in: 'ورود ژئوفنس',
    geofence_out: 'خروج ژئوفنس',
    geofence: 'ژئوفنس',
    idle_over: 'توقف طولانی',
    harsh_brake: 'ترمز شدید',
    harsh_accel: 'گاز شدید',
    harsh_turn: 'پیچ تند',
    ignition_on_off_hours: 'روشن/خاموش خارج از ساعات',
  };



  // ===== UI =====
  const typeLabel = (code: VehicleTypeCode) => VEHICLE_TYPES.find(t => t.code === code)?.label || code;
  // اطمینان از سابسکرایب شدن به ایستگاه‌های یک ماشین + اولین fetch
  const TOP_HEIGHT = '75vh';         // ارتفاع پنل‌های بالا (نقشه و سایدبار)
  const SHEET_HEIGHT = 420;          // ارتفاع Bottom Sheet
  const freezeProgrammaticZoom = (m?: any) => { }; // برای ساکت‌کردن TS در این فایل

  const gfKey = (gf: Geofence, idx: number) =>
    gf.id != null ? `gf-${gf.id}` : `gf-${gf.type}-${idx}`;
  return (
    <Grid2 container spacing={2} dir="ltr">


      {/* نقشه — چپ */}
      <Grid2 xs={12} md={8}>
        <Paper
          sx={{
            height: TOP_HEIGHT,                // همان الگوی بالا
            transition: 'height .28s ease',
            overflow: 'hidden',
            position: 'relative',
          }}
          dir="rtl"
        >
          <MapContainer
            zoom={INITIAL_ZOOM}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            whenCreated={(m: RLMap) => {
              // مطابق کد بالا: فیکس زوم برنامه‌ای + invalidate
              freezeProgrammaticZoom?.(m);
              setTimeout(() => m.invalidateSize(), 0);
            }}
            style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }}
          >
            {/* مرکز/زوم اولیه (حفظ منطق خودت) */}
            <InitView center={INITIAL_CENTER} zoom={INITIAL_ZOOM} />

            {/* کاشی‌ها */}
            <TileLayer url={tileUrl} {...({ attribution: '&copy; OpenStreetMap | © MapTiler' } as any)} />

            {/* فوکوس روی نقطه */}
            <FocusOn target={focusLatLng} />
            {/* کلیک‌گیرِ انتخاب نقاط مسیر */}
            <PickPointsForRoute enabled={canRouteEdit && drawingRoute} onPick={(lat, lng) => setRoutePoints(p => [...p, { lat, lng }])} />


            {/* پیش‌نمایش مسیر در حال ترسیم */}
            {drawingRoute && routePoints.length >= 1 && (
              <>
                <Polyline positions={routePoints.map(p => [p.lat, p.lng] as [number, number])}
                  pathOptions={{ color: '#00897b', weight: 4, opacity: 0.9 }} />
                {routePoints.map((p, i) => (
                  <Marker key={`draft-${i}`} position={[p.lat, p.lng]} icon={numberedIcon(i + 1) as any} />
                ))}
              </>
            )}

            {/* کلیک‌گیر ژئوفنس (بدون تغییر منطق) */}
            {activeType && canGeoFence && selectedVehicleId && (
              <PickPointsForGeofence
                enabled={canGeoFence && gfDrawing}
                onPick={(lat, lng) => {
                  if (gfMode === 'circle') setGfCenter({ lat, lng });
                  else setGfPoly(prev => [...prev, { lat, lng }]);
                }}
              />
            )}

            {/* لایه مسیر (نمایش بدون وابستگی به تیک ادیت؛ ادیت را تیک کنترل کند) */}
            <Pane name="route-layer" style={{ zIndex: 400 }}>
              {selectedVehicleId && <RouteLayer vid={selectedVehicleId} />}
            </Pane>

            {/* پیش‌نمایش ترسیم ژئوفنس (ظاهر همسان) */}
            {gfDrawing && gfMode === 'circle' && gfCenter && (
              <Circle center={[gfCenter.lat, gfCenter.lng]} radius={gfRadius} />
            )}
            {gfDrawing && gfMode === 'polygon' && gfPoly.length >= 2 && (
              <Polygon positions={gfPoly.map(p => [p.lat, p.lng] as [number, number])} />
            )}

            {/* ژئوفنس ذخیره‌شده از سرور */}
            {selectedVehicleId && (geofencesByVid[selectedVehicleId] || []).map((gf, idx) =>
              gf.type === 'circle'
                ? <Circle key={gfKey(gf, idx)} center={[gf.center.lat, gf.center.lng]} radius={gf.radius_m} />
                : <Polygon key={gfKey(gf, idx)} positions={gf.points.map(p => [p.lat, p.lng] as [number, number])} />
            )}

            {/* لایه راننده‌ها/ماشین‌ها با z-index بالاتر مثل بالا */}
            <Pane name="vehicles-layer" style={{ zIndex: 650 }}>
              {/* راننده‌ها + مسیر لحظه‌ای راننده (حفظ منطق) */}
              {tab === 'drivers' && canTrackDrivers && filteredDrivers.map(d => (d as any).last_location && (
                <Marker
                  key={`d-${d.id}`}
                  position={[(d as any).last_location.lat, (d as any).last_location.lng]}
                  icon={driverMarkerIcon as any}
                  zIndexOffset={1000}
                >
                  <Popup><strong>{d.full_name}</strong><br />{d.phone || '—'}</Popup>
                </Marker>
              ))}
              {tab === 'drivers' && canTrackDrivers && polyline.length > 1 && <Polyline positions={polyline} />}

              {/* ماشین‌ها */}
              {activeType && canTrackVehicles && filteredVehicles.map(v => v.last_location && (
                <Marker
                  key={`v-${v.id}`}
                  position={[v.last_location.lat, v.last_location.lng]}
                  icon={vehicleMarkerIcon as any}
                  zIndexOffset={1000}
                >
                  <Popup><strong>{v.plate_no}</strong><br />{v.vehicle_type_code}</Popup>
                </Marker>
              ))}
            </Pane>

            {/* کلیک‌گیر: ایجاد ایستگاه (همان منطق) */}
            <PickPointsForStations
              enabled={!!canStations && !!addingStationsForVid}
              onPick={(lat, lng) => setTempStation({ lat, lng })}
            />
            {/* ایستگاه‌های در حالت افزودن/ویرایش */}
            {!!addingStationsForVid && canStations && (vehicleStationsMap[addingStationsForVid] || []).map(st => (
              <React.Fragment key={`add-${st.id}`}>
                <Circle center={[st.lat, st.lng]} radius={st.radius_m ?? stationRadius} />
                <Marker position={[st.lat, st.lng]} />
              </React.Fragment>
            ))}

            {/* ایستگاه‌های ماشین انتخاب‌شده */}
            {selectedVehicleId && (vehicleStationsMap[selectedVehicleId] || []).map(st => (
              <React.Fragment key={`sel-${st.id}`}>
                <Circle center={[st.lat, st.lng]} radius={st.radius_m ?? stationRadius} />
                <Marker position={[st.lat, st.lng]} />
              </React.Fragment>
            ))}

            {/* مارکر موقت ایستگاه جدید */}
            {addingStationsForVid && tempStation && (
              <>
                <Circle center={[tempStation.lat, tempStation.lng]} radius={stationRadius} />
                <Marker
                  position={[tempStation.lat, tempStation.lng]}
                  draggable
                  eventHandlers={{
                    add: (e: any) => e.target.openPopup(),
                    dragend: (e: any) => {
                      const ll = e.target.getLatLng();
                      setTempStation({ lat: ll.lat, lng: ll.lng });
                    },
                  }}
                >
                  <Popup autoClose={false} closeOnClick={false} autoPan>
                    <div style={{ minWidth: 220 }}>
                      <strong>ایجاد ایستگاه</strong>
                      <div style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>می‌توانید مارکر را جابجا کنید.</div>
                      <div style={{ marginTop: 8 }}>
                        <input
                          style={{ width: '100%', padding: 6 }}
                          placeholder="نام ایستگاه"
                          value={tempName}
                          onChange={e => setTempName(e.target.value)}
                        />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button onClick={confirmTempStation}>تایید</button>
                        <button onClick={() => setTempStation(null)}>لغو</button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}

            {/* جابه‌جایی ایستگاه در حالت ادیت */}
            {editingStation && movingStationId === editingStation.st.id && (
              <>
                <Circle center={[editingStation.st.lat, editingStation.st.lng]} radius={editingStation.st.radius_m} />
                <Marker
                  position={[editingStation.st.lat, editingStation.st.lng]}
                  draggable
                  eventHandlers={{
                    dragend: (e: any) => {
                      const ll = e.target.getLatLng();
                      setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, lat: ll.lat, lng: ll.lng } }) : ed);
                    }
                  }}
                />
              </>
            )}

            {/* اوورلی شناور استایل‌شده (فقط UI؛ بدون دست‌کاری منطق فعلی) */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 2000,
                pointerEvents: 'none',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  transform: 'scale(1.2)',
                  transformOrigin: 'top left',
                  width: 'max-content',
                  pointerEvents: 'auto',
                }}
              >
                {/* نوار کوچک وضعیت/میانبرها (سادۀ امن؛ به stateهای موجود وصل) */}
                <Paper
                  sx={(t) => ({
                    p: 0.25,
                    borderRadius: 1.5,
                    border: `1px solid ${t.palette.divider}`,
                    bgcolor: `${t.palette.background.paper}C6`,
                    backdropFilter: 'blur(6px)',
                    boxShadow: '0 6px 16px rgba(0,0,0,.18)',
                    overflow: 'hidden',
                  })}
                >
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Chip
                      size="small"
                      icon={<span>🗂️</span> as any}
                      label={tab === 'drivers' ? 'راننده‌ها' : (activeType ? typeLabel(activeType) : '—')}
                      sx={{
                        fontWeight: 700,
                        '& .MuiChip-label': { px: 0.75, py: 0.25, fontSize: 10 },
                      }}
                    />
                    <Chip
                      size="small"
                      icon={<span>📍</span> as any}
                      label={selectedVehicleId ? `VID: ${selectedVehicleId}` : 'ماشین: —'}
                      sx={{
                        border: '1px solid #00c6be55',
                        bgcolor: '#00c6be18',
                        color: '#009e97',
                        '& .MuiChip-label': { px: 0.75, py: 0.25, fontSize: 10 },
                      }}
                    />
                    {/* فقط سوییچ‌های موجود در همین کد؛ بدون اضافه‌کردن هندلر جدید */}
                    <Button
                      size="small"
                      variant={gfDrawing ? 'contained' : 'outlined'}
                      onClick={() => setGfDrawing(v => !v)}
                      disabled={!canGeoFence}
                      sx={{
                        borderRadius: 999,
                        px: 0.9,
                        minHeight: 22,
                        fontSize: 10,
                        borderColor: '#00c6be66',
                        ...(gfDrawing
                          ? { bgcolor: '#00c6be', '&:hover': { bgcolor: '#00b5ab' } }
                          : { '&:hover': { bgcolor: '#00c6be12' } }),
                        boxShadow: gfDrawing ? '0 4px 12px #00c6be44' : 'none',
                      }}
                      startIcon={<span>✏️</span>}
                    >
                      {gfDrawing ? 'پایان ژئوفنس' : 'ترسیم ژئوفنس'}
                    </Button>
                  </Stack>
                </Paper>
              </Box>
            </Box>

            {/* دیالوگ ویرایش مصرفی (همان مکان/منطق خودت) */}
            <Dialog open={!!editingCons} onClose={() => setEditingCons(null)} fullWidth maxWidth="sm">
              <DialogTitle>ویرایش آیتم مصرفی</DialogTitle>
              <DialogContent dividers>
                <Stack spacing={2}>
                  <TextField
                    label="توضیح/یادداشت"
                    value={editingCons?.note ?? ''}
                    onChange={(e) => setEditingCons((p: any) => ({ ...p, note: e.target.value }))}
                    fullWidth
                  />
                  <RadioGroup
                    row
                    value={editingCons?.mode ?? 'km'}
                    onChange={(_, v) =>
                      setEditingCons((p: any) => ({
                        ...p,
                        mode: v as 'km' | 'time',
                        start_at: v === 'time' ? (p?.start_at ?? new Date().toISOString()) : null,
                        base_odometer_km: v === 'km' ? (p?.base_odometer_km ?? 0) : null,
                      }))
                    }
                  >
                    <FormControlLabel value="km" control={<Radio />} label="بر اساس کیلومتر" />
                    <FormControlLabel value="time" control={<Radio />} label="بر اساس زمان" />
                  </RadioGroup>
                  {editingCons?.mode === 'time' ? (
                    <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                      <DateTimePicker<Date>
                        label="تاریخ یادآوری"
                        value={editingCons?.start_at ? new Date(editingCons.start_at) : null}
                        onChange={(val) => setEditingCons((p: any) => ({ ...p, start_at: val ? new Date(val).toISOString() : null }))}
                        ampm={false}
                        slotProps={{ textField: { fullWidth: true } }}
                        format="yyyy/MM/dd HH:mm"
                      />
                    </LocalizationProvider>
                  ) : (
                    <TextField
                      label="مقدار مبنا (کیلومتر)"
                      type="number"
                      value={editingCons?.base_odometer_km ?? ''}
                      onChange={(e) => setEditingCons((p: any) => ({ ...p, base_odometer_km: e.target.value ? Number(e.target.value) : null }))}
                      fullWidth
                    />
                  )}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditingCons(null)}>انصراف</Button>
                <Button variant="contained" onClick={saveEditConsumable} disabled={!canConsumables || savingCons}>ذخیره</Button>
              </DialogActions>
            </Dialog>

            {/* Snackbar (بدون تغییر منطق) */}
            {toast?.open && (
              <Snackbar
                open={toast.open}
                autoHideDuration={6000}
                onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              >
                <Alert severity="warning" onClose={() => setToast(null)} sx={{ width: '100%' }}>
                  {toast.msg}
                </Alert>
              </Snackbar>
            )}

          </MapContainer>
        </Paper>
      </Grid2>

      {/* سایدبار — راست (فقط ظاهر همسان با کارت/باکس‌ها و فاصله‌ها) */}
      <Grid2 xs={12} md={4}>
        <Paper
          sx={(t) => ({
            p: 2,
            height: TOP_HEIGHT,
            '& .leaflet-pane, & .leaflet-top, & .leaflet-bottom': { zIndex: 0 },
            display: 'flex',
            transition: 'height .28s ease',
            flexDirection: 'column',
            border: `1px solid ${t.palette.divider}`,
            borderRadius: 2,
            bgcolor: t.palette.background.paper,
          })}
          dir="rtl"
        >
          {/* بازه زمانی */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="preset-lbl">بازه</InputLabel>
              <Select labelId="preset-lbl" value={preset} label="بازه" onChange={(e) => setPreset(e.target.value as any)}>
                <MenuItem value="today">امروز</MenuItem>
                <MenuItem value="yesterday">دیروز</MenuItem>
                <MenuItem value="7d">۷ روز اخیر</MenuItem>
                <MenuItem value="custom">دلخواه</MenuItem>
              </Select>
            </FormControl>
            {preset === 'custom' && (
              <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                <DateTimePicker
                  label="از"
                  value={new Date(fromISO)}
                  onChange={(v) => v && setFromISO(new Date(v).toISOString())}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <DateTimePicker
                  label="تا"
                  value={new Date(toISO)}
                  onChange={(v) => v && setToISO(new Date(v).toISOString())}
                  slotProps={{ textField: { size: 'small' } }}
                />
              </LocalizationProvider>
            )}
          </Stack>

          {/* تب‌ها با استایل مشابه */}
          <Tabs
            value={tab}
            onChange={(_, v) => { setTab(v); setQ(''); setPolyline([]); setAddingStationsForVid(null); setTempStation(null); setEditingStation(null); setMovingStationId(null); }}
            sx={{
              mb: 1,
              minHeight: 36,
              '& .MuiTab-root': { minHeight: 36 },
              '& .MuiTabs-indicator': { backgroundColor: ACC },
              '& .MuiTab-root.Mui-selected': { color: ACC, fontWeight: 700 },
            }}
          >
            <Tab value="drivers" label="راننده‌ها" />
            {typesWithGrants.map(vt => (
              <Tab key={vt} value={vt} label={typeLabel(vt)} />
            ))}
          </Tabs>

          {/* قابلیت‌های تب فعال */}
          {activeType && (
            <Box sx={{ mb: 1.5, p: 1, border: (t) => `1px dashed ${t.palette.divider}`, borderRadius: 1 }}>
              {(grantedPerType[activeType] || []).length ? (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip size="small" color="primary" label={typeLabel(activeType)} />
                  {(grantedPerType[activeType] || []).map(k => (
                    <Chip key={`${activeType}-${k}`} size="small" variant="outlined"
                      label={MONITOR_PARAMS.find(m => m.key === k)?.label || k} />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  برای این نوع خودرو قابلیتی فعال نشده.
                </Typography>
              )}
            </Box>
          )}

          {/* تله‌متری لحظه‌ای (فقط استایل کارت‌ها) */}


          {/* جستجو با افکت فوکوس شبیه بالا */}
          <TextField
            size="small"
            placeholder={tab === 'drivers' ? 'جستجو نام/موبایل' : 'جستجو پلاک'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 1.25,
              '& .MuiOutlinedInput-root': {
                transition: 'border-color .2s ease, box-shadow .2s ease',
                '& fieldset': { borderColor: 'divider' },
                '&:hover fieldset': { borderColor: ACC },
                '&.Mui-focused': {
                  '& fieldset': { borderColor: ACC },
                  boxShadow: `0 0 0 3px ${ACC}22`,
                },
              },
            }}
          />

          {/* بادی لیست (همان منطق قبلی؛ فقط محیط کنتینر) */}
          <List sx={{ overflow: 'auto', flex: 1 }}>
            {/* ... کل بلوک لیست راننده/ماشینِ خودت بدون تغییر منطق ... */}
            {/* منطق موجودت از همینجا ادامه دارد */}
            {/* === راننده‌ها === */}
            {tab === 'drivers' ? (
              filteredDrivers.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 1 }}>نتیجه‌ای یافت نشد.</Typography>
              ) : filteredDrivers.map(d => {
                const s = statsMap[d.id] || {};
                return (
                  <ListItem
                    key={d.id}
                    divider
                    onClick={() => onPickDriver(d)}   // 👈 قبلاً فقط فوکوس می‌داد

                    secondaryAction={
                      <Stack direction="row" spacing={1}>
                        <Tooltip title={canTrackDrivers ? '' : 'دسترسی ردیابی ندارید'}>
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={async (ev) => {
                                ev.stopPropagation();
                                onPickDriver(d);                 // بازشدن شیت + انتخاب راننده
                                await trackByDriverId(d.id, fromISO, toISO);   // ⬅️ این خط مهم است
                                // اگر دوست دارید ماشین فعلی راننده هم در سایدبار انتخاب شود (اختیاری):
                                const vid = await getDriverCurrentVehicleId(d.id).catch(() => null);
                                if (vid) setSelectedVehicleId(vid);
                              }}
                            >
                              ردیابی
                            </Button>

                          </span>
                        </Tooltip>
                      </Stack>
                    }
                  >
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                      <Avatar>{d.full_name?.charAt(0) ?? 'ر'}</Avatar>
                      <Box sx={{ flex: 1 }}>
                        <ListItemText primary={d.full_name} secondary={d.phone || '—'} />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .25 }}>
                          مسافت: {s.totalDistanceKm ?? '—'} km | مدت: {s.totalDurationMin ?? '—'} min | ماموریت: {s.jobsCount ?? '—'} | خرابی: {s.breakdownsCount ?? '—'}
                        </Typography>
                      </Box>
                    </Stack>
                  </ListItem>
                );
              })
            ) : (
              // === ماشین‌ها ===
              // === ماشین‌ها ===
              (filteredVehicles.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 1 }}>ماشینی یافت نشد.</Typography>
              ) : filteredVehicles.map(v => {
                const stations = vehicleStationsMap[v.id] || [];
                const isEditingBlock = editingStation?.vid === v.id;

                return (
                  <Box key={v.id} sx={{ pb: 1 }}>
                    <ListItem
                      key={v.id}
                      divider
                      onClick={() => onPickVehicleBM(v)}
                      secondaryAction={
                        <Stack direction="row" spacing={0.5}>
                          {v.last_location && (
                            <IconButton
                              size="small"
                              title="نمایش روی نقشه"
                              onClick={(e) => { e.stopPropagation(); setFocusLatLng([v.last_location!.lat, v.last_location!.lng]); }}
                            >📍</IconButton>
                          )}







                        </Stack>
                      }
                    >
                      {routeBusyByVid[v.id] === 'loading' && (
                        <Typography variant="caption" color="text.secondary">در حال بارگذاری مسیر…</Typography>
                      )}
                      {routeMetaByVid[v.id] && (
                        <Typography variant="caption" color="text.secondary">
                          مسیر فعلی: {routeMetaByVid[v.id]?.name ?? `#${routeMetaByVid[v.id]?.id}`}
                          {routeMetaByVid[v.id]?.threshold_m ? ` — آستانه: ${routeMetaByVid[v.id]?.threshold_m} m` : ''}
                        </Typography>
                      )}

                      <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                        <Avatar>{v.plate_no?.charAt(0) ?? 'م'}</Avatar>
                        <Box sx={{ flex: 1 }}>
                          <ListItemText primary={v.plate_no} secondary={typeLabel(v.vehicle_type_code)} />
                        </Box>
                      </Stack>
                    </ListItem>





                  </Box>
                );
              }))

            )}
          </List>

          {/* دیالوگ افزودن/تنظیم مصرفی (همان منطق) */}
          <Dialog open={consumablesOpen} onClose={() => setConsumablesOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>لوازم مصرفی / مسافت از آخرین صفر</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <TextField label="توضیح/یادداشت" value={tripNote} onChange={(e) => setTripNote(e.target.value)} fullWidth />
                <RadioGroup row value={consumableMode} onChange={(_, v) => setConsumableMode((v as 'time' | 'km') ?? 'km')}>
                  <FormControlLabel value="km" control={<Radio />} label="بر اساس کیلومتر" />
                  <FormControlLabel value="time" control={<Radio />} label="بر اساس زمان" />
                </RadioGroup>
                {consumableMode === 'time' ? (
                  <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                    <DateTimePicker<Date>
                      label="تاریخ یادآوری"
                      value={tripDate}
                      onChange={(val) => setTripDate(val)}
                      ampm={false}
                      slotProps={{ textField: { fullWidth: true } }}
                      format="yyyy/MM/dd HH:mm"
                    />
                  </LocalizationProvider>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">کیلومترشمار فعلی:</Typography>
                        <Typography variant="h6">
                          {vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}
                        </Typography>
                      </Stack>
                      <TextField
                        label="مقدار مبنا (از آخرین صفر)"
                        type="number"
                        value={tripBaseKm ?? ''}
                        onChange={(e) => setTripBaseKm(e.target.value ? Number(e.target.value) : null)}
                        fullWidth
                      />
                      {!canOdometer && (
                        <Typography sx={{ mt: 1 }} variant="caption" color="warning.main">
                          برای به‌روزرسانی زنده، «کیلومترشمار» باید در سیاست‌های این نوع فعال باشد.
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConsumablesOpen(false)}>بستن</Button>
              {consumableMode === 'km' && (
                <Button variant="outlined" onClick={handleTripReset} disabled={vehicleTlm.odometer == null || !selectedVehicleId}>
                  صفر کردن از الان
                </Button>
              )}
              <Button variant="contained" onClick={handleAddConsumable} disabled={consumableMode === 'time' && !tripDate}>
                افزودن
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      </Grid2>
      {/* === ردیف سوم: پنل پایینی (Bottom Sheet) === */}
      <Grid2 xs={12}>
        <Collapse in={sheetOpen} timeout={320} unmountOnExit>
          <Paper
            dir="rtl"
            sx={(t) => ({
              position: 'relative',
              minHeight: SHEET_HEIGHT,
              p: 2,
              borderRadius: 3,
              overflow: 'hidden',
              border: `1px solid ${t.palette.divider}`,
              boxShadow: t.palette.mode === 'dark'
                ? '0 20px 60px rgba(0,0,0,.45)'
                : '0 20px 60px rgba(0,0,0,.15)',
              background: `linear-gradient(180deg, ${t.palette.background.paper} 0%, ${t.palette.background.default} 100%)`,
            })}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              {/* هدر شیت */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip
                    size="medium"
                    icon={<span>{sheetMode === 'driver' ? '🧑‍✈️' : '🚘'}</span> as any}
                    label={
                      <Typography component="span" sx={{ fontWeight: 800 }}>
                        {sheetMode === 'driver'
                          ? `راننده: ${selectedDriverId
                            ? (filteredDrivers.find(x => x.id === selectedDriverId)?.full_name ?? `#${selectedDriverId}`)
                            : '—'}`
                          : `ماشین: ${selectedVehicleId
                            ? (filteredVehicles.find(v => v.id === selectedVehicleId)?.plate_no ?? `#${selectedVehicleId}`)
                            : '—'}`}
                      </Typography>
                    }
                  />

                  {/* اگر دادهٔ تله‌متری داری، مثل بالا چند چیپ دیگر هم می‌تونی نشان بدهی */}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" onClick={() => setSheetOpen(false)}>بستن</Button>
                </Stack>
              </Stack>

              {/* اکشن‌های سریع (اختیاری) */}
              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                {selectedVehicleId && (
                  <>
                    {filteredVehicles.find(v => v.id === selectedVehicleId)?.last_location && (
                      <Button
                        size="small"
                        onClick={() => {
                          const ll = filteredVehicles.find(v => v.id === selectedVehicleId)!.last_location!;
                          setFocusLatLng([ll.lat, ll.lng]);
                        }}
                        startIcon={<span>🎯</span>}
                      >
                        مرکز روی ماشین
                      </Button>
                    )}

                  </>
                )}
              </Stack>
              {/* === تعریف مسیر جدید === */}
              {sheetMode !== 'driver' && (

                <Paper sx={{ p: 1, mt: 1, border: (t) => `1px dashed ${t.palette.divider}` }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>تعریف مسیر جدید</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <TextField
                      size="small"
                      label="نام مسیر"
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      sx={{ minWidth: 180 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Threshold (m)"
                      value={routeThreshold}
                      onChange={(e) => setRouteThreshold(Math.max(1, Number(e.target.value || 0)))}
                      sx={{ width: 150 }}
                    />
                    <Button size="small" variant={drawingRoute ? 'contained' : 'outlined'} onClick={() => setDrawingRoute(v => !v)} disabled={!canRouteEdit}>
                      {drawingRoute ? 'پایان ترسیم' : 'شروع ترسیم روی نقشه'}
                    </Button>
                    <Button size="small" onClick={() => setRoutePoints(pts => pts.slice(0, -1))} disabled={!canRouteEdit || !routePoints.length}>برگشت نقطه</Button>
                    <Button size="small" onClick={() => setRoutePoints([])} disabled={!canRouteEdit || !routePoints.length}>پاک‌کردن</Button>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!canRouteEdit || routePoints.length < 2 || !selectedVehicleId}
                      onClick={() => saveRouteAndFenceForVehicle({ vehicleId: selectedVehicleId!, name: (routeName || '').trim() || `مسیر ${new Date().toLocaleDateString('fa-IR')}`, threshold_m: Math.max(1, Number(routeThreshold || 0)), points: routePoints, toleranceM: 15 })}
                    >
                      ذخیره مسیر
                    </Button>




                  </Stack>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    روی نقشه کلیک کن تا نقاط مسیر به‌ترتیب اضافه شوند. برای ذخیره حداقل ۲ نقطه لازم است.
                  </Typography>
                </Paper>
              )}

              {/* === سکشن‌ها: از منطق خودت استفاده می‌کنیم ولی بر اساس selectedVehicleId === */}
              {sheetMode !== 'driver' && selectedVehicleId && (

                <Grid2 container spacing={1.25}>
                  {/* مسیر */}


                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>
                      مسیر
                    </Typography>

                    {/* وضعیت مسیر فعلی */}
                    {routeBusyByVid[selectedVehicleId] === 'loading' && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        در حال بارگذاری مسیر…
                      </Typography>
                    )}
                    {routeMetaByVid[selectedVehicleId] && (
                      <Paper sx={{ p: 1, mb: 1, border: (t) => `1px solid ${t.palette.divider}` }}>
                        <Typography variant="body2" color="text.secondary">مسیر فعلی</Typography>
                        <Typography variant="body1">
                          {routeMetaByVid[selectedVehicleId]?.name ?? `#${routeMetaByVid[selectedVehicleId]?.id}`}
                          {routeMetaByVid[selectedVehicleId]?.threshold_m
                            ? ` — آستانه: ${routeMetaByVid[selectedVehicleId]?.threshold_m} m`
                            : ''}
                        </Typography>
                      </Paper>
                    )}

                    {/* اکشن‌ها */}
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={async () => {
                          await loadVehicleRoute(selectedVehicleId);
                        }}
                      >
                        نمایش/تازه‌سازی مسیر
                      </Button>

                      <Tooltip title={canRouteEdit ? '' : 'اجازهٔ ویرایش مسیر ندارید'}>
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={!canRouteEdit}
                            onClick={async () => {
                              const routes = await listVehicleRoutes(selectedVehicleId);
                              if (!routes.length) { alert('مسیری برای این خودرو پیدا نشد.'); return; }
                              const nameList = routes.map(r => `${r.id} — ${r.name ?? 'بدون نام'}`).join('\n');
                              const pick = prompt(`Route ID را وارد کنید:\n${nameList}`, String(routes[0].id));
                              const rid = Number(pick);
                              if (!Number.isFinite(rid)) return;

                              try {
                                await setOrUpdateVehicleRoute(selectedVehicleId, { route_id: rid });
                                await loadVehicleRoute(selectedVehicleId);
                              } catch (err: any) {
                                console.error(err?.response?.data || err);
                                alert(err?.response?.data?.message || 'ثبت مسیر ناموفق بود');
                              }
                            }}
                          >
                            انتخاب مسیر
                          </Button>
                        </span>
                      </Tooltip>

                      <Tooltip title={canRouteEdit ? '' : 'اجازهٔ ویرایش مسیر ندارید'}>
                        <span>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={!canRouteEdit}
                            onClick={async () => {
                              if (!confirm('مسیر فعلی از این خودرو برداشته شود؟')) return;
                              try {
                                await clearVehicleRoute(selectedVehicleId);
                              } catch { }
                              setRouteMetaByVid(p => ({ ...p, [selectedVehicleId]: null }));
                              setRoutePolylineByVid(p => ({ ...p, [selectedVehicleId]: [] }));
                            }}
                          >
                            حذف مسیر
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Grid2>


                  {/* ایستگاه‌ها */}
                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>ایستگاه‌ها</Typography>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <TextField
                        size="small" type="number" label="شعاع (m)" value={stationRadius}
                        onChange={(e) => setStationRadius(Math.max(1, Number(e.target.value || 0)))} sx={{ width: 130 }}
                      />
                      {canStations && (
                        <Button
                          size="small"
                          variant={addingStationsForVid === selectedVehicleId ? 'contained' : 'outlined'}
                          onClick={() => startAddingStationsFor(selectedVehicleId)}
                          disabled={!canStations}
                        >
                          {addingStationsForVid === selectedVehicleId ? 'پایان افزودن' : 'ایجاد ایستگاه'}
                        </Button>
                      )}
                    </Stack>

                    {(() => {
                      const stations = vehicleStationsMap[selectedVehicleId] || [];
                      const isEditingBlock = editingStation?.vid === selectedVehicleId;

                      return stations.length ? (
                        <List dense sx={{ maxHeight: 240, overflow: 'auto' }}>
                          {stations.map(st => {
                            const isEditing = isEditingBlock && editingStation?.st.id === st.id;
                            return (
                              <Box key={st.id}>
                                <ListItem
                                  disableGutters
                                  secondaryAction={
                                    <Stack direction="row" spacing={0.5}>
                                      <IconButton size="small" title="نمایش روی نقشه" disabled={!canStations} onClick={() => setFocusLatLng([st.lat, st.lng])}>📍</IconButton>
                                      <IconButton
                                        size="small"
                                        title="ویرایش"
                                        onClick={() => {
                                          if (isEditing) { setEditingStation(null); setMovingStationId(null); }
                                          else { setEditingStation({ vid: selectedVehicleId, st: { ...st } }); setMovingStationId(null); }
                                        }}
                                        disabled={!canStations}
                                      >✏️</IconButton>
                                      <IconButton size="small" color="error" title="حذف" disabled={!canStations} onClick={() => deleteStation(selectedVehicleId, st)}>🗑️</IconButton>
                                    </Stack>
                                  }
                                >
                                  <ListItemText primary={st.name} secondary={`${st.lat.toFixed(5)}, ${st.lng.toFixed(5)}`} />
                                </ListItem>

                                <Collapse in={isEditing} timeout="auto" unmountOnExit>
                                  <Box sx={{ mx: 1.5, mt: .5, p: 1.25, bgcolor: 'action.hover', borderRadius: 1, border: (t) => `1px solid ${t.palette.divider}` }}>
                                    <Stack spacing={1.25}>
                                      <TextField
                                        size="small" label="نام" value={editingStation?.st.name ?? ''}
                                        onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, name: e.target.value } }) : ed)}
                                      />
                                      <TextField
                                        size="small" type="number" label="شعاع (m)" value={editingStation?.st.radius_m ?? 0}
                                        onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, radius_m: Math.max(1, Number(e.target.value || 0)) } }) : ed)}
                                      />
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <Button size="small" variant={movingStationId === st.id ? 'contained' : 'outlined'} onClick={() => setMovingStationId(movingStationId === st.id ? null : st.id)}>جابجایی روی نقشه</Button>
                                        <Box flex={1} />
                                        <Button size="small" onClick={() => { setEditingStation(null); setMovingStationId(null); }}>انصراف</Button>
                                        <Button size="small" variant="contained" onClick={saveEditStation}>ذخیره</Button>
                                      </Stack>
                                    </Stack>
                                  </Box>
                                </Collapse>

                                <Divider sx={{ mt: 1 }} />
                              </Box>
                            );
                          })}
                        </List>
                      ) : (
                        <Typography color="text.secondary">ایستگاهی تعریف نشده.</Typography>
                      );
                    })()}
                  </Grid2>

                  {/* ژئوفنس */}
                  {canGeoFence && (
                    <Grid2 xs={12} md={6} lg={4}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>ژئوفنس</Typography>

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <InputLabel id="gf-mode-lbl">حالت</InputLabel>
                          <Select
                            labelId="gf-mode-lbl"
                            label="حالت"
                            value={gfMode}
                            onChange={(e) => { setGfMode(e.target.value as 'circle' | 'polygon'); setGfCenter(null); setGfPoly([]); }}
                          >
                            <MenuItem value="circle">دایره‌ای</MenuItem>
                            <MenuItem value="polygon">چندضلعی</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          size="small" type="number" label="تلورانس (m)" value={gfTolerance}
                          onChange={(e) => setGfTolerance(Math.max(0, Number(e.target.value || 0)))}
                          sx={{ width: 130 }}
                        />

                        <Button
                          size="small"
                          variant={gfDrawing ? 'contained' : 'outlined'}
                          onClick={() => setGfDrawing(v => !v)}
                          disabled={!canGeoFence}
                        >
                          {gfDrawing ? 'پایان ترسیم' : 'ترسیم روی نقشه'}
                        </Button>

                        {gfMode === 'polygon' && (
                          <>
                            <Button size="small" onClick={() => setGfPoly(pts => pts.slice(0, -1))}
                              disabled={!canGeoFence || !gfPoly.length}>
                              برگشت نقطه
                            </Button>
                            <Button size="small" onClick={() => setGfPoly([])}
                              disabled={!canGeoFence || !gfPoly.length}>
                              پاک‌کردن نقاط
                            </Button>
                          </>
                        )}

                        {gfMode === 'circle' && (
                          <TextField
                            size="small" type="number" label="شعاع (m)" value={gfRadius}
                            onChange={(e) => setGfRadius(Math.max(1, Number(e.target.value || 0)))}
                            sx={{ width: 130 }}
                            disabled={!canGeoFence}
                          />
                        )}

                        <Button
                          size="small"
                          variant="contained"
                          onClick={saveGeofenceBM}
                          disabled={!canGeoFence}
                        >
                          ذخیره ژئوفنس
                        </Button>

                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={deleteGeofenceBM}
                          disabled={!canGeoFence || !selectedVehicleId || (geofencesByVid[selectedVehicleId]?.length ?? 0) === 0}
                        >
                          حذف ژئوفنس
                        </Button>



                      </Stack>

                      <Typography variant="caption" color="text.secondary">
                        {gfMode === 'circle'
                          ? 'روی نقشه کلیک کنید تا مرکز دایره انتخاب شود، سپس شعاع را تنظیم و ذخیره کنید.'
                          : 'روی نقشه کلیک کنید تا نقاط چندضلعی به‌ترتیب اضافه شوند (حداقل ۳ نقطه).'}
                      </Typography>
                    </Grid2>
                  )}


                  {/* تله‌متری زنده */}
                  {activeType && (canIgnition || canIdleTime || canOdometer) && (
                    <Grid2 xs={12} md={6} lg={4}>
                      <Stack spacing={1} sx={{ mb: 1.5 }}>
                        {canIgnition && (
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">وضعیت سوئیچ</Typography>
                            <Typography variant="h6">
                              {vehicleTlm.ignition === true ? 'موتور روشن است'
                                : vehicleTlm.ignition === false ? 'موتور خاموش است' : 'نامشخص'}
                            </Typography>
                          </Paper>
                        )}
                        {canIdleTime && (
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">مدت توقف/سکون</Typography>
                            <Typography variant="h6">
                              {vehicleTlm.idle_time != null
                                ? `${vehicleTlm.idle_time.toLocaleString('fa-IR')} ثانیه`
                                : '—'}
                            </Typography>
                          </Paper>
                        )}
                        {canOdometer && (
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">کیلومترشمار</Typography>
                            <Typography variant="h6">
                              {vehicleTlm.odometer != null
                                ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km`
                                : 'نامشخص'}
                            </Typography>
                          </Paper>
                        )}
                      </Stack>
                    </Grid2>
                  )}

                  {/* لوازم مصرفی */}
                  {canConsumables && (
                    <Grid2 xs={12} lg={4}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>لوازم مصرفی</Typography>
                        <Tooltip title={canConsumables ? 'افزودن' : 'دسترسی ندارید'}>
                          <span>
                            <IconButton size="small" onClick={() => setConsumablesOpen(true)} disabled={!canConsumables}>＋</IconButton>
                          </span>
                        </Tooltip>
                        <Box flex={1} />
                        <Typography variant="caption" color="text.secondary">
                          کیلومترشمار: {vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}
                        </Typography>
                      </Stack>

                      {(() => {
                        const consStatus = consStatusByVid[selectedVehicleId];
                        const consList = consumablesByVid[selectedVehicleId] || [];
                        if (consStatus === 'loading') {
                          return (
                            <Box display="flex" alignItems="center" gap={1} color="text.secondary" sx={{ mt: .5 }}>
                              <CircularProgress size={16} /> در حال دریافت…
                            </Box>
                          );
                        }
                        if (consStatus === 'error') return <Typography color="warning.main">خطا در دریافت. دوباره تلاش کنید.</Typography>;
                        if (!consList.length) return <Typography color="text.secondary">آیتمی ثبت نشده.</Typography>;
                        return (
                          <List dense sx={{ maxHeight: 240, overflow: 'auto' }}>
                            {consList.map((c: any, i: number) => (
                              <ListItem
                                key={c.id ?? i}
                                divider
                                secondaryAction={
                                  <Stack direction="row" spacing={0.5}>
                                    <span>
                                      <IconButton
                                        size="small"
                                        title="ویرایش"
                                        onClick={() => openEditConsumable(c)}
                                        disabled={!canConsumables}
                                      >✏️</IconButton>
                                    </span>
                                    <span>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        title="حذف"
                                        onClick={() => deleteConsumable(c)}
                                        disabled={!canConsumables}
                                      >🗑️</IconButton>
                                    </span>
                                  </Stack>
                                }
                              >
                                <ListItemText
                                  primary={c.title ?? c.note ?? 'آیتم'}
                                  secondary={
                                    <>
                                      {c.mode === 'km' ? 'بر اساس کیلومتر' : 'بر اساس زمان'}
                                      {c.created_at && <> — {new Date(c.created_at).toLocaleDateString('fa-IR')}</>}
                                    </>
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                        );
                      })()}
                    </Grid2>
                  )}
                </Grid2>
              )}



              {!selectedVehicleId && (
                <Typography color="text.secondary">برای مشاهده تنظیمات، یک ماشین را از لیست انتخاب کنید.</Typography>
              )}
              {sheetMode === 'driver' && selectedDriverId && (
                <Grid2 container spacing={1.25}>
                  {/* اکشن‌های راننده */}
                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>اکشن‌های راننده</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          const d = filteredDrivers.find(x => x.id === selectedDriverId);
                          const ll = (d as any)?.last_location;
                          if (ll) setFocusLatLng([ll.lat, ll.lng]);
                        }}
                        startIcon={<span>🎯</span>}
                      >
                        مرکز روی راننده
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => loadDriverTrack(selectedDriverId)}
                      >
                        نمایش مسیر/ردیابی
                      </Button>
                    </Stack>
                  </Grid2>

                  {/* تله‌متری و آمار راننده */}
                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>وضعیت لحظه‌ای و آمار</Typography>
                    {(() => {
                      const d = filteredDrivers.find(x => x.id === selectedDriverId);
                      const stats = statsMap[selectedDriverId] || {};
                      const ll = (d as any)?.last_location;
                      const tlm = (d as any)?.telemetry || (d as any)?.tlm || {};
                      const ignition = tlm.ignition === true ? 'موتور روشن است'
                        : tlm.ignition === false ? 'موتور خاموش است'
                          : 'نامشخص';
                      const idleTime =
                        tlm.idle_time != null ? `${Number(tlm.idle_time).toLocaleString('fa-IR')} ثانیه` : '—';

                      return (
                        <Stack spacing={1.25} sx={{ mb: 1.5 }}>
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Box>
                                <Typography variant="body2" color="text.secondary">موقعیت فعلی</Typography>
                                <Typography variant="h6">
                                  {ll ? `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}` : 'نامشخص'}
                                </Typography>
                              </Box>
                              <Button
                                size="small"
                                disabled={!ll}
                                onClick={() => ll && setFocusLatLng([ll.lat, ll.lng])}
                                startIcon={<span>🎯</span>}
                              >
                                مرکز
                              </Button>
                            </Stack>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">وضعیت سوئیچ</Typography>
                            <Typography variant="h6">{ignition}</Typography>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">مدت توقف/سکون</Typography>
                            <Typography variant="h6">{idleTime}</Typography>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">مسافت پیموده‌شده (بازه)</Typography>
                            <Typography variant="h6">
                              {stats.totalDistanceKm != null
                                ? `${Number(stats.totalDistanceKm).toLocaleString('fa-IR')} km`
                                : '—'}
                            </Typography>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">مدت کار (بازه)</Typography>
                            <Typography variant="h6">
                              {stats.totalDurationMin != null
                                ? `${Number(stats.totalDurationMin).toLocaleString('fa-IR')} دقیقه`
                                : '—'}
                            </Typography>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">تعداد مأموریت</Typography>
                            <Typography variant="h6">
                              {stats.jobsCount != null ? Number(stats.jobsCount).toLocaleString('fa-IR') : '—'}
                            </Typography>
                          </Paper>
                        </Stack>
                      );
                    })()}
                  </Grid2>

                  {/* تخلفات راننده در بازه انتخابی */}
                  <Grid2 xs={12} md={12} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>تخلفات راننده در بازه انتخابی</Typography>
                    {vioStatusByDid[selectedDriverId] === 'loading' && (
                      <Box display="flex" alignItems="center" gap={1} color="text.secondary" sx={{ mt: .5 }}>
                        <CircularProgress size={16} /> در حال دریافت…
                      </Box>
                    )}
                    {vioStatusByDid[selectedDriverId] === 'error' && (
                      <Typography color="warning.main">خطا در دریافت تخلفات راننده.</Typography>
                    )}
                    {(() => {
                      const list = (violationsByDid[selectedDriverId] || [])
                        .filter(v => violationFilter === 'all' || v.type === violationFilter);
                      if (!list.length && vioStatusByDid[selectedDriverId] === 'loaded') {
                        return <Typography color="text.secondary">موردی یافت نشد.</Typography>;
                      }
                      return (
                        <List dense sx={{ maxHeight: 260, overflow: 'auto' }}>
                          {list.map((v, i) => (
                            <ListItem
                              key={v.id ?? i}
                              divider
                              onClick={() => v.meta?.point && setFocusLatLng([v.meta.point.lat, v.meta.point.lng])}
                              secondaryAction={
                                v.meta?.point && (
                                  <IconButton
                                    size="small"
                                    title="نمایش روی نقشه"
                                    onClick={(e) => { e.stopPropagation(); setFocusLatLng([v.meta!.point!.lat, v.meta!.point!.lng]); }}
                                  >📍</IconButton>
                                )
                              }
                            >
                              <ListItemText
                                primary={`${new Date(v.created_at).toLocaleString('fa-IR')} — ${v.type}`}
                                secondary={
                                  <>
                                    {v.meta?.distance_m && `فاصله: ${v.meta.distance_m} m `}
                                    {v.meta?.threshold_m && `— آستانه: ${v.meta.threshold_m} m`}
                                  </>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      );
                    })()}
                  </Grid2>
                </Grid2>
              )}

            </Box>
          </Paper>
        </Collapse>
      </Grid2>
    </Grid2>
  );




  function FitToGeofences({ items }: { items: Geofence[] }) {
    const map = useMap();
    React.useEffect(() => {
      if (!items || !items.length) return;
      const bounds = L.latLngBounds([]);
      items.forEach(g => {
        if (g.type === 'circle') {
          const b = L.circle([g.center.lat, g.center.lng], { radius: g.radius_m }).getBounds();
          bounds.extend(b);
        } else {
          g.points.forEach(p => bounds.extend([p.lat, p.lng]));
        }
      });
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
    }, [items, map]);
    return null;
  }
}
function TechnicianRoleSection({ user }: { user: User }) {
  // ===== Permissions: نقشه همیشه؛ ردیابی فقط با تیک سطح نقش =====
  const DEFAULT_PERMS: string[] = ['view_report'];
  const [allowed, setAllowed] = React.useState<Set<string>>(new Set(DEFAULT_PERMS));
  const [permsLoading, setPermsLoading] = React.useState(false);
  const [q, setQ] = React.useState('');
  type TabKey = 'drivers' | VehicleTypeCode;
  const [tab, setTab] = React.useState<TabKey>('drivers');
  const activeType = (tab !== 'drivers') ? (tab as VehicleTypeCode) : null;
  const [parentSA, setParentSA] = React.useState<{ id: number; name: string } | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<number | null>(null);
  const LL_DEC = 10;
  const roundLL = (v: number) => Math.round(v * 10 ** LL_DEC) / 10 ** LL_DEC;
  const fmtLL = (v: number) => Number.isFinite(v) ? v.toFixed(LL_DEC) : '';
  const [sheetOpen, setSheetOpen] = React.useState(false);
  // ===== Route types =====
  type RouteMeta = { id: number; name?: string | null; threshold_m?: number | null };
  type RoutePoint = { lat: number; lng: number; name?: string | null; radius_m?: number | null };
  const [sheetMode, setSheetMode] = React.useState<'vehicle' | 'driver' | null>(null);
  // state ها
  const [drawingRoute, setDrawingRoute] = React.useState(false);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [routeName, setRouteName] = useState('');
  const [routeThreshold, setRouteThreshold] = useState<number>(100);
  const [fromISO, setFromISO] = React.useState<string>(() => new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  const [toISO, setToISO] = React.useState<string>(() => new Date().toISOString());
  // کلیک‌گیر روی نقشه
  function PickPointsForRoute({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lng: number) => void }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }
  // پرچم برای جلوگیری از تریپل‌کلیک/اسپم
  const savingRouteRef = React.useRef(false);
  // ⬇️ اینو کنار بقیه helpers بذار
  // ✅ فقط روت‌هایی که داریم + سایلنت
  // ✅ فقط همون روت‌های موجود؛ بی‌سروصدا فالبک می‌زنیم
  // فقط از روت‌های assignment استفاده کن
  const getDriverCurrentVehicleId = async (driverId: number): Promise<number | null> => {
    try {
      const { data } = await api.get(`/assignments/current/${driverId}`);
      // ممکنه پاسخ خالی باشه (۲۰۰ بدون body) یا شکل‌های مختلف داشته باشه
      const vid =
        Number(data?.vehicle_id ?? data?.vehicleId) ||
        Number(data?.vehicle?.id) || null;

      return Number.isFinite(vid) && vid! > 0 ? vid : null;
    } catch {
      return null;
    }
  };
  async function trackByDriverId(driverId: number, from = fromISO, to = toISO) {
    if (!driverId) return;

    try {
      const params = {
        driver_id: driverId,         // ⬅️ اجباری
        from,                        // ISO string
        to,                          // ISO string
      };

      // اگر می‌خواهید URL لاگ شود:
      // const q = new URLSearchParams({ driver_id: String(driverId), from, to }).toString();
      // console.log(`[GET] /tracks?${q}`);

      const { data } = await api.get('/tracks', { params });
      const pts: { lat: number; lng: number }[] = Array.isArray(data) ? data : (data?.items || []);
      setPolyline(pts.map(p => [p.lat, p.lng] as [number, number]));
      liveTrackOnRef.current = true;
      selectedDriverRef.current = drivers.find(x => x.id === driverId) ?? null;
    } catch (e) {
      console.error('trackByDriverId error:', e);
      setPolyline([]);
      liveTrackOnRef.current = true;
      selectedDriverRef.current = drivers.find(x => x.id === driverId) ?? null;
    }
  }



  async function saveRouteAndFenceForVehicle(opts: {
    vehicleId: number;
    name: string;
    threshold_m: number;               // مثلا 1000
    points: { lat: number; lng: number }[]; // نقاط خام مسیر
    toleranceM?: number;               // مثلا 10–20
  }) {
    const { vehicleId, name, threshold_m, points, toleranceM = 15 } = opts;
    if (savingRouteRef.current) return;           // جلوگیری از تکرار
    if (!vehicleId) { alert('خودرو انتخاب نشده'); return; }
    if (!Array.isArray(points) || points.length < 2) {
      alert('حداقل دو نقطه برای مسیر لازم است.'); return;
    }

    try {
      savingRouteRef.current = true;

      // 1) ساخت مسیر روی خودِ خودرو
      // POST /vehicles/:vid/routes   { name, threshold_m, points }
      const { data: created } = await api.post(`/vehicles/${vehicleId}/routes`, {
        name,
        threshold_m,
        points, // [{lat,lng}, ...]
      });
      const routeId = Number(created?.route_id ?? created?.id);
      if (!Number.isFinite(routeId)) throw new Error('route_id از پاسخ سرور خوانده نشد');

      // 2) ست کردن همین مسیر به‌عنوان مسیر فعلی
      // PUT /vehicles/:vid/routes/current   { route_id }
      await api.put(`/vehicles/${vehicleId}/routes/current`, { route_id: routeId });

      // 3) ساخت ژئوفنس پُلیگانیِ دور مسیر (بافر)
      // از همون buildRouteBufferPolygon که تو کدت داری استفاده می‌کنیم
      const ring = buildRouteBufferPolygon(points, threshold_m) // متر
        .map(p => ({ lat: +p.lat, lng: +p.lng }));

      // نکته: برای جلوگیری از چندبار ساخت، اول PUT (آپ‌سرت) می‌زنیم؛
      // اگر سرور اجازه نداد، یکبار POST می‌زنیم.
      try {
        await api.put(`/vehicles/${vehicleId}/geofence`, {
          type: 'polygon',
          polygonPoints: ring,
          toleranceM,
        });
      } catch {
        await api.post(`/vehicles/${vehicleId}/geofence`, {
          type: 'polygon',
          polygonPoints: ring,
          toleranceM,
        });
      }

      // ریفرش UI
      await loadVehicleRoute(vehicleId);
      await loadVehicleGeofences(vehicleId);

      // ریست UI ترسیم
      setDrawingRoute(false);
      setRoutePoints([]);
      if (!routeName) setRouteName(name || `Route ${routeId}`);

      alert('مسیر و ژئوفنس با موفقیت ذخیره شد.');
    } catch (e: any) {
      console.error(e?.response?.data || e);
      alert(e?.response?.data?.message || 'ذخیره مسیر/ژئوفنس ناموفق بود.');
    } finally {
      savingRouteRef.current = false;
    }
  }
  // انتخاب راننده
  const [selectedDriverId, setSelectedDriverId] = React.useState<number | null>(null);

  // تخلفات راننده (بر اساس driverId و بازه زمانی)
  type SimpleViolation = {
    id: number;
    type: 'geofence_exit' | 'off_route' | 'speeding' | string;
    created_at: string;
    driver_user_id?: number;
    meta?: {
      point?: { lat: number; lng: number };
      distance_m?: number;
      threshold_m?: number;
      radius_m?: number;
      tolerance_m?: number;
    };
  };

  const loadViolations = useCallback(
    async (vehicleId: number, from = fromISO, to = toISO) => {
      if (!vehicleId) { setViolations([]); return; }

      setViolationsLoading(true);
      try {
        const raw = await fetchVehicleViolations(api, vehicleId, 200);
        const all: Violation[] = (normalizeViolations(raw) || []) as Violation[];

        const fromT = Number.isFinite(+new Date(from)) ? +new Date(from) : -Infinity;
        const toT = Number.isFinite(+new Date(to)) ? +new Date(to) : Infinity;

        const list: SimpleViolation[] = all
          .filter(v => {
            const t = +new Date(
              v.created_at ?? (v as any).at ?? (v as any).time ?? (v as any).createdAt
            );
            return Number.isFinite(t) && t >= fromT && t <= toT;
          })
          .map((v, idx) => {
            const createdAt =
              v.created_at ?? (v as any).at ?? (v as any).time ?? (v as any).createdAt ?? new Date().toISOString();

            // id پایدار: اگر نبود، از شناسه‌های داخل meta یا timestamp+idx بساز
            const stableId =
              (typeof v.id === 'number' ? v.id : undefined) ??
              Number((v.meta as any)?.event_id) ??
              Number((v.meta as any)?.id) ??
              (Date.parse(createdAt) || 0) + idx;

            return {
              id: stableId,
              type: (v.type as any) || 'speeding',
              created_at: createdAt,
              driver_user_id:
                (v as any).driver_user_id ??
                (v as any).driver_id ??
                undefined,
              meta: v.meta ?? {},
            } as SimpleViolation;
          });

        setViolations(list);
      } catch {
        setViolations([]);
      } finally {
        setViolationsLoading(false);
      }
    },
    [api, fromISO, toISO, fetchVehicleViolations]
  );


  // ✅ فقط از /assignments/current/:driverId استفاده کن
  async function fetchDriverViolationsViaAssignment(api: any, driverId: number, limit = 200) {
    try {
      const { data: cur } = await api.get(`/assignments/current/${driverId}`);
      const vid =
        Number(cur?.vehicle_id ?? cur?.vehicleId) ||
        Number(cur?.vehicle?.id) || null;

      if (!vid) return []; // راننده الآن روی ماشینی نیست
      const { data } = await api.get(`/vehicles/${vid}/violations`, { params: { limit } });
      return data;
    } catch {
      return [];
    }
  }




  async function fetchVehicleViolations(api: any, vehicleId: number, limit = 200) {
    const { data } = await api.get(`/vehicles/${vehicleId}/violations`, { params: { limit } });
    return data;
  }

  const [violationsByDid, setViolationsByDid] = React.useState<Record<number, SimpleViolation[]>>({});
  const [vioStatusByDid, setVioStatusByDid] = React.useState<Record<number, 'idle' | 'loading' | 'loaded' | 'error'>>({});
  const [violationFilter, setViolationFilter] = React.useState<'all' | 'geofence_exit' | 'off_route' | 'speeding'>('all');
  const [violationsLoading, setViolationsLoading] = React.useState(false);
  const [selectedViolation, setSelectedViolation] = React.useState<SimpleViolation | null>(null);
  // بالای فایل: هِلفر تبدیل تاریخ به ISO string
  // قبلی: const toISO = (v:any)=>...
  const toIsoStrict = (v: any) => {
    const d = new Date(v);
    return isNaN(+d) ? new Date().toISOString() : d.toISOString();
  };


  const loadDriverViolations = React.useCallback(
    async (driverId: number, from = fromISO, to = toISO) => {
      if (!driverId) { setViolations([]); return; }

      setViolationsLoading(true);
      try {
        const raw = await fetchDriverViolationsViaAssignment(api, driverId, 200);
        const all: Violation[] = (normalizeViolations(raw) || []) as Violation[];

        const fromT = Number.isFinite(+new Date(from)) ? +new Date(from) : -Infinity;
        const toT = Number.isFinite(+new Date(to)) ? +new Date(to) : Infinity;

        const list: SimpleViolation[] = all
          .filter(v => {
            const t = +new Date(v.created_at ?? (v as any).at ?? (v as any).time ?? (v as any).createdAt);
            return Number.isFinite(t) && t >= fromT && t <= toT;
          })
          .map((v, idx) => {
            const createdAtISO =
              (v.created_at
                ?? (v as any).at
                ?? (v as any).time
                ?? (v as any).createdAt
                ?? new Date().toISOString());

            const created_at = new Date(createdAtISO).toISOString(); // ⬅️ تضمین string

            const stableId =
              (typeof v.id === 'number' ? v.id : undefined) ??
              Number(v.meta?.event_id) ??
              Number((v.meta as any)?.id) ??
              (Date.parse(created_at) || 0) + idx;

            return {
              id: stableId,
              type: (v.type as any) || 'speeding',
              created_at, // ⬅️ string
              driver_user_id: (v as any).driver_id ?? (v as any).driver_user_id ?? driverId,
              meta: v.meta ?? {},
            };
          });

        setViolations(list);
      } catch {
        setViolations([]);
      } finally {
        setViolationsLoading(false);
      }
    },
    [api, fromISO, toISO] // ⚠️ تابع fetchDriverViolationsViaAssignment را در deps نگذار تا فچ لوپ نشود
  );



  useEffect(() => {
    if (selectedDriverId && fromISO && toISO) {
      loadDriverViolations(selectedDriverId, fromISO, toISO);
    }
  }, [selectedDriverId, fromISO, toISO, loadDriverViolations]);



  // per-vehicle caches
  const [routeMetaByVid, setRouteMetaByVid] =
    React.useState<Record<number, RouteMeta | null>>({});
  const [routePointsByRid, setRoutePointsByRid] =
    React.useState<Record<number, RoutePoint[]>>({});
  const [routePolylineByVid, setRoutePolylineByVid] =
    React.useState<Record<number, [number, number][]>>({});
  const [routeBusyByVid, setRouteBusyByVid] =
    React.useState<Record<number, 'idle' | 'loading' | 'error'>>({});
  // /routes/:rid/stations  یا  /routes/:rid/points  یا شکل‌های متفاوت
  const normalizeRoutePoints = (payload: any): RoutePoint[] => {
    const arr: any[] =
      Array.isArray(payload) ? payload :
        Array.isArray(payload?.items) ? payload.items :
          Array.isArray(payload?.data?.items) ? payload.data.items :
            Array.isArray(payload?.data) ? payload.data :
              Array.isArray(payload?.rows) ? payload.rows :
                Array.isArray(payload?.points) ? payload.points :
                  Array.isArray(payload?.stations) ? payload.stations :
                    [];

    const num = (v: any) => {
      const n = Number(v); return Number.isFinite(n) ? n : NaN;
    };

    // پشتیبانی از خروجی‌های snake/camel
    const out = arr.map((p: any) => {
      const lat = num(p.lat ?? p.latitude ?? p.y);
      const lng = num(p.lng ?? p.longitude ?? p.x);
      return ({
        lat, lng,
        name: p.name ?? p.title ?? null,
        radius_m: Number.isFinite(num(p.radius_m ?? p.radiusM ?? p.radius)) ? num(p.radius_m ?? p.radiusM ?? p.radius) : null,
      });
    }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    // مرتب‌سازی بر اساس order_no اگر وجود دارد
    out.sort((a: any, b: any) =>
      (Number(a.order_no ?? a.orderNo ?? a.order ?? 0) - Number(b.order_no ?? b.orderNo ?? b.order ?? 0))
    );

    return out;
  };
  const [violations, setViolations] = React.useState<SimpleViolation[]>([]);

  const fetchVehicleCurrentRouteMeta = async (vid: number): Promise<RouteMeta | null> => {
    const tries = [
      () => api.get(`/vehicles/${vid}/routes/current`), // 👈 خواسته‌ی شما
      () => api.get(`/vehicles/${vid}/current-route`),
      () => api.get(`/vehicles/${vid}/route`),
    ];
    for (const t of tries) {
      try {
        const { data } = await t();
        // برخی APIها خروجی را داخل route می‌گذارند
        const r = data?.route || data;
        if (r?.id) {
          return {
            id: Number(r.id),
            name: r.name ?? null,
            threshold_m: r.threshold_m ?? r.thresholdM ?? null,
          };
        }
        // بعضی‌ها هم به‌صورت扮 route_id
        if (data?.route_id) {
          return {
            id: Number(data.route_id),
            name: data.name ?? null,
            threshold_m: data.threshold_m ?? data.thresholdM ?? null,
          };
        }
      } catch { /* try next */ }
    }
    return null;
  };
  const loadDriverTrack = async (driverId: number) => {
    if (!canTrackDrivers) return;
    try {
      // 👇 بک‌اند می‌خواهد vehicle_id
      const vid = await getDriverCurrentVehicleId(driverId);
      const params: any = { from: fromISO, to: toISO };
      if (vid) params.vehicle_id = vid; else params.driver_id = driverId; // فالبک

      const { data } = await api.get('/tracks', { params });
      const pts: { lat: number; lng: number }[] = Array.isArray(data) ? data : data?.items || [];
      setPolyline(pts.map(p => [p.lat, p.lng] as [number, number]));
      liveTrackOnRef.current = true;
      selectedDriverRef.current = drivers.find(x => x.id === driverId) ?? null;
    } catch {
      setPolyline([]); liveTrackOnRef.current = true;
      selectedDriverRef.current = drivers.find(x => x.id === driverId) ?? null;
    }
  };
  // فقط شیت را باز کن، هیچ فچی اینجا نزن
  const onPickDriver = (d: any) => {
    setSelectedDriverId(d.id);
    setSelectedVehicleId(null);
    setSelectedViolation(null);
    setSheetMode('driver');
    setSheetOpen(true);
  };
  // ــ بالای فایل (خارج از کامپوننت)
  const _inflightAssign = new Map<number, Promise<number | null>>();

  function getCurrentVehicleIdSafe(api: any, driverId: number): Promise<number | null> {
    if (_inflightAssign.has(driverId)) return _inflightAssign.get(driverId)!;
    const p = (async () => {
      try {
        const { data } = await api.get(`/assignments/current/${driverId}`, {
          params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }
        });
        const vid =
          Number(data?.vehicle_id ?? data?.vehicleId) ||
          Number(data?.vehicle?.id) || null;
        return Number.isFinite(vid!) && vid! > 0 ? vid! : null;
      } catch {
        return null;
      } finally {
        _inflightAssign.delete(driverId);
      }
    })();
    _inflightAssign.set(driverId, p);
    return p;
  }

  async function fetchDriverViolationsSmart(
    api: any,
    driverId: number,
    { from, to, limit = 200 }: { from: string; to: string; limit?: number }
  ) {
    const params: any = { from, to, limit };
    const vid = await getCurrentVehicleIdSafe(api, driverId);

    // 1) بر اساس vehicle اگر assignment وجود داشت
    if (vid) {
      try {
        const { data } = await api.get(`/vehicles/${vid}/violations`, { params });
        return data;
      } catch { /* فالبک به درایور */ }
    }

    // 2) فالبک‌های بر پایهٔ راننده (حتی وقتی assignment خالی است)
    try {
      const { data } = await api.get('/violations', { params: { ...params, driver_id: String(driverId) } });
      return data;
    } catch { }

    try {
      const { data } = await api.get(`/drivers/${driverId}/violations`, { params });
      return data;
    } catch { }

    try {
      const { data } = await api.get('/events', { params: { ...params, category: 'violation', driver_id: String(driverId) } });
      return data;
    } catch { }

    return [];
  }






  // نقاط مسیر بر اساس routeId
  // نقاط مسیر — اول /points بعد /stations (طبق خواسته‌ی شما)
  const fetchRoutePoints = async (routeId: number): Promise<RoutePoint[]> => {
    const tries = [
      () => api.get(`/routes/${routeId}/points`),   // 👈 اول points
      () => api.get(`/routes/${routeId}/stations`), //    بعد stations
    ];
    for (const t of tries) {
      try {
        const { data } = await t();
        return normalizeRoutePoints(data);
      } catch { /* try next */ }
    }
    return [];
  };


  // ست/آپدیت مسیر فعلی ماشین (اختیاری threshold)
  const setOrUpdateVehicleRoute = async (vid: number, body: { route_id?: number; threshold_m?: number }) => {
    // PATCH/PUT ها متنوع‌اند؛ همه را هندل می‌کنیم
    const tries = [
      () => api.patch(`/vehicles/${vid}/route`, body),
      () => api.put(`/vehicles/${vid}/route`, body),
      () => api.post(`/vehicles/${vid}/route`, body),
    ];
    for (const t of tries) {
      try { return await t(); } catch { /* next */ }
    }
  };

  // لغو مسیر فعلی ماشین
  // لغو/برداشتن مسیر فعلی ماشین — فقط DELETE
  const clearVehicleRoute = async (vid: number) => {
    const tries = [
      // رایج‌ترین‌ها
      () => api.delete(`/vehicles/${vid}/route`),
      () => api.delete(`/vehicles/${vid}/route/unassign`),

      // چند فالبک احتمالی
      () => api.delete(`/vehicles/${vid}/routes/current`),
      () => api.delete(`/vehicles/${vid}/current-route`),
    ];

    let lastErr: any;
    for (const t of tries) {
      try { return await t(); } catch (e) { lastErr = e; }
    }
    throw lastErr;
  };


  // لیست مسیرهای قابل‌انتخاب برای یک ماشین
  const listVehicleRoutes = async (vid: number): Promise<RouteMeta[]> => {
    try {
      const { data } = await api.get(`/vehicles/${vid}/routes`);
      const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      return arr
        .map((r: any) => ({ id: Number(r.id), name: r.name ?? null, threshold_m: r.threshold_m ?? r.thresholdM ?? null }))
        .filter((r: any) => Number.isFinite(r.id));
    } catch { return []; }
  };
  const loadVehicleRoute = React.useCallback(async (vid: number) => {
    setRouteBusyByVid(p => ({ ...p, [vid]: 'loading' }));
    try {
      const meta = await fetchVehicleCurrentRouteMeta(vid);
      setRouteMetaByVid(p => ({ ...p, [vid]: meta }));

      if (meta?.id) {
        // کش نقاط مسیر
        let pts = routePointsByRid[meta.id];
        if (!pts) {
          pts = await fetchRoutePoints(meta.id);
          setRoutePointsByRid(p => ({ ...p, [meta.id]: pts }));
        }
        const line: [number, number][] = (pts || []).map(p => [p.lat, p.lng]);
        setRoutePolylineByVid(prev => ({ ...prev, [vid]: line }));
      } else {
        setRoutePolylineByVid(prev => ({ ...prev, [vid]: [] }));
      }
      setRouteBusyByVid(p => ({ ...p, [vid]: 'loaded' }));
    } catch {
      setRouteBusyByVid(p => ({ ...p, [vid]: 'error' }));
    }
  }, [routePointsByRid]);


  // ===== Consumables (per vehicle) =====
  type ConsumableItem = {
    id?: number;
    mode: 'km' | 'time';
    note?: string;
    title?: string;
    start_at?: string | null;
    base_odometer_km?: number | null;
    created_at?: string | null;
    vehicle_id?: number | null;
  };

  const [consumablesByVid, setConsumablesByVid] =
    React.useState<Record<number, ConsumableItem[]>>({});
  const [consStatusByVid, setConsStatusByVid] =
    React.useState<Record<number, 'idle' | 'loading' | 'loaded' | 'error'>>({});

  // دیالوگ‌ها/فرم
  const [consumablesOpen, setConsumablesOpen] = React.useState(false);
  const [editingCons, setEditingCons] = React.useState<any | null>(null);
  const [savingCons, setSavingCons] = React.useState(false);
  const [consumableMode, setConsumableMode] = React.useState<'time' | 'km'>('km');
  const [tripNote, setTripNote] = React.useState('');
  const [tripDate, setTripDate] = React.useState<Date | null>(new Date());
  const [tripBaseKm, setTripBaseKm] = React.useState<number | null>(null);

  // تله‌متری لازم برای چکِ کیلومتر
  const [vehicleTlm, setVehicleTlm] = React.useState<{
    ignition?: boolean;
    idle_time?: number;
    odometer?: number;
  }>({});
  // نوتیف فقط-یکبار
  const notifiedRef = React.useRef<Set<string>>(new Set());
  const [toast, setToast] = React.useState<{ open: boolean; msg: string } | null>(null);

  // helpers
  const CONS_KEY = (vid: number) => `consumables_${vid}`;
  const loadConsLocal = (vid: number) => {
    try {
      const raw = localStorage.getItem(CONS_KEY(vid));
      if (!raw) return [] as ConsumableItem[];
      return normalizeConsumables(JSON.parse(raw));
    } catch { return [] as ConsumableItem[]; }
  };
  const saveConsLocal = (vid: number, items: ConsumableItem[]) => {
    try { localStorage.setItem(CONS_KEY(vid), JSON.stringify(items)); } catch { }
  };

  const normalizeConsumables = (payload: any): ConsumableItem[] => {
    let arr: any[] =
      Array.isArray(payload) ? payload :
        Array.isArray(payload?.items) ? payload.items :
          Array.isArray(payload?.data?.items) ? payload.data.items :
            Array.isArray(payload?.data) ? payload.data :
              Array.isArray(payload?.result) ? payload.result :
                Array.isArray(payload?.consumables) ? payload.consumables :
                  Array.isArray(payload?.rows) ? payload.rows :
                    (payload && typeof payload === 'object' ? [payload] : []);

    const toNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
    const toISO = (v: any) => { if (!v) return null; const t = new Date(v); return isNaN(+t) ? null : t.toISOString(); };

    const out = arr.map((c: any) => ({
      id: c.id ?? c._id ?? undefined,
      mode: (c.mode ?? c.type) === 'time' ? 'time' : 'km',
      note: c.note ?? c.description ?? '',
      title: c.title ?? c.name ?? c.note ?? undefined,
      created_at: toISO(c.created_at ?? c.createdAt),
      start_at: toISO(c.start_at ?? c.startAt ?? c.start_time ?? c.startTime),
      base_odometer_km: toNum(c.base_odometer_km ?? c.baseOdometerKm ?? c.base_odo ?? c.base_odo_km),
      vehicle_id: c.vehicle_id ?? c.vehicleId ?? null,
    }));

    const keyOf = (x: any) => x.id ?? `${x.mode}:${x.start_at ?? x.base_odometer_km ?? x.note ?? ''}`;
    const map = new Map<string | number, any>();
    out.forEach(x => map.set(keyOf(x), x));
    return Array.from(map.values());
  };

  async function createConsumable(
    vid: number,
    payload: { mode: 'km' | 'time'; note: string; start_at?: string | null; base_odometer_km?: number | null }
  ) {
    const snake = payload.mode === 'time'
      ? { mode: 'time', note: payload.note, start_at: payload.start_at }
      : { mode: 'km', note: payload.note, base_odometer_km: payload.base_odometer_km };
    try {
      return await api.post(`/vehicles/${vid}/consumables`, snake);
    } catch {
      const camel = payload.mode === 'time'
        ? { mode: 'time', note: payload.note, startAt: payload.start_at }
        : { mode: 'km', note: payload.note, baseOdometerKm: payload.base_odometer_km };
      try {
        return await api.post(`/vehicles/${vid}/consumables`, camel);
      } catch {
        try { return await api.post(`/vehicles/${vid}/consumables`, { consumable: snake }); }
        catch { return await api.post(`/vehicles/${vid}/consumables`, { consumable: camel }); }
      }
    }
  }
  async function updateConsumable(
    vid: number, id: number,
    payload: { mode: 'km' | 'time'; note: string; start_at?: string | null; base_odometer_km?: number | null }
  ) {
    const snake = payload.mode === 'time'
      ? { mode: 'time', note: payload.note, start_at: payload.start_at }
      : { mode: 'km', note: payload.note, base_odometer_km: payload.base_odometer_km };
    try {
      return await api.patch(`/vehicles/${vid}/consumables/${id}`, snake);
    } catch {
      const camel = payload.mode === 'time'
        ? { mode: 'time', note: payload.note, startAt: payload.start_at }
        : { mode: 'km', note: payload.note, baseOdometerKm: payload.base_odometer_km };
      return await api.patch(`/vehicles/${vid}/consumables/${id}`, camel);
    }
  }

  const consReqIdRef = React.useRef<Record<number, number>>({});
  const refreshConsumables = React.useCallback(async (vid: number, forceServer = false) => {
    const myId = (consReqIdRef.current[vid] || 0) + 1;
    consReqIdRef.current[vid] = myId;
    setConsStatusByVid(p => ({ ...p, [vid]: 'loading' }));

    if (!forceServer) {
      const cached = loadConsLocal(vid);
      if (cached.length) {
        setConsumablesByVid(p => ({ ...p, [vid]: cached }));
        setConsStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
      }
    }

    try {
      const { data } = await api.get(`/vehicles/${vid}/consumables`, {
        params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }
      });
      if (consReqIdRef.current[vid] !== myId) return;
      const list = normalizeConsumables(data);
      saveConsLocal(vid, list);
      setConsumablesByVid(p => ({ ...p, [vid]: list }));
      setConsStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
    } catch {
      if (consReqIdRef.current[vid] !== myId) return;
      setConsStatusByVid(p => ({ ...p, [vid]: 'error' }));
    }
  }, []);

  const resolveParentSA = React.useCallback(
    async (uid: number): Promise<{ id: number; name: string } | null> => {
      // 1) تلاش از روی پالیسی‌ها (اگه owner داخلشون بود)
      try {
        const { data } = await api.get(`/vehicle-policies/user/${uid}`, { params: { onlyAllowed: true } });
        const rows: any[] = Array.isArray(data) ? data : [];
        const pickNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
        const ownerIds = Array.from(new Set(
          rows.flatMap(r => [
            pickNum(r.owner_user_id), pickNum(r.ownerId),
            pickNum(r.super_admin_user_id), pickNum(r.superAdminUserId),
            pickNum(r.grantor_user_id), pickNum(r.grantorUserId),
          ].filter(Boolean))
        )) as number[];

        for (const oid of ownerIds) {
          try {
            const test = await api.get('/vehicles', { params: { owner_user_id: String(oid), limit: 1 } });
            const items = Array.isArray(test.data?.items) ? test.data.items : (Array.isArray(test.data) ? test.data : []);
            if (items.length) {
              const row = rows.find(rr =>
                [rr.owner_user_id, rr.ownerId, rr.super_admin_user_id, rr.superAdminUserId, rr.grantor_user_id, rr.grantorUserId]
                  .map((x: any) => Number(x)).includes(oid)
              );
              return { id: oid, name: String(row?.owner_name ?? row?.ownerName ?? 'سوپرادمین') };
            }
          } catch { }
        }
      } catch { }

      // 2) فـال‌بک مطمئن: جدِ level=2 از بک‌اند
      try {
        const { data } = await api.get('/users/my-ancestor', { params: { level: 2 } });
        if (data?.id) return { id: Number(data.id), name: String(data.full_name || 'سوپرادمین') };
      } catch { }

      return null;
    },
    []
  );
  const [vehicleStationsMap, setVehicleStationsMap] = React.useState<Record<number, Station[]>>({});
  const [routeByVid, setRouteByVid] =
    React.useState<Record<number, { id: number; threshold_m?: number }>>({});
  // قبلی را پاک کن و این را بگذار
  const fetchStations = async (vid: number) => {
    try {
      const { data } = await api.get(`/vehicles/${vid}/stations`);
      const rows: any[] = Array.isArray(data) ? data : [];

      const stations: Station[] = rows.map((p: any) => ({
        id: Number(p.id),
        name: p.name ?? p.title ?? null,
        lat: roundLL(Number(p.lat)),
        lng: roundLL(Number(p.lng)),
        radius_m: Number(p.radius_m ?? p.radiusM ?? 60),
      }));

      setVehicleStationsMap(prev => ({ ...prev, [vid]: stations }));
    } catch {
      setVehicleStationsMap(prev => ({ ...prev, [vid]: [] }));
    }
  };

  // ⬇️ این تابع قبلی‌ت رو به‌طور کامل با این نسخه جایگزین کن

  const ensureStationsLive = React.useCallback(
    async (vid: number) => {
      if (!vehicleStationsMap[vid]) {
        await fetchStations(vid).catch(() => { });
      }

      const s = socketRef.current;
      if (!s) return;

      if (lastStationsSubRef.current && lastStationsSubRef.current.vid !== vid) {
        const { vid: pvid, uid } = lastStationsSubRef.current;
        s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations/${user.id}` });
        s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations` });
        lastStationsSubRef.current = null;
      }

      s.emit('subscribe', { topic: `vehicle/${vid}/stations/${user.id}` });
      s.emit('subscribe', { topic: `vehicle/${vid}/stations` });
      lastStationsSubRef.current = { vid, uid: user.id };
    },
    [user.id, vehicleStationsMap, fetchStations]
  );



  // === استایل‌های شبیه سوپرادمین ===
  const ROUTE_STYLE = {
    outline: { color: '#0d47a1', weight: 8, opacity: 0.25 },
    main: { color: '#1e88e5', weight: 5, opacity: 0.9 },
  };
  const ROUTE_COLORS = { start: '#43a047', end: '#e53935', point: '#1565c0' };

  const numberedIcon = (n: number) =>
    L.divIcon({
      className: 'route-idx',
      html: `<div style="
      width:22px;height:22px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:12px;color:#fff;background:${ROUTE_COLORS.point};
      box-shadow:0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.3);
    ">${n}</div>`,
      iconSize: [22, 22], iconAnchor: [11, 11],
    });

  const badgeIcon = (txt: string, bg: string) =>
    L.divIcon({
      className: 'route-badge',
      html: `<div style="
      padding:3px 6px;border-radius:6px;
      font-weight:700;font-size:11px;color:#fff;background:${bg};
      box-shadow:0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.3)
    ">${txt}</div>`,
      iconSize: [1, 1], iconAnchor: [10, 10],
    });

  function FitToRoute({ line, points }: { line: [number, number][], points: { lat: number; lng: number; radius_m?: number | null }[] }) {
    const map = useMap();
    React.useEffect(() => {
      const b = L.latLngBounds([]);
      line.forEach(([lat, lng]) => b.extend([lat, lng]));
      points.forEach(p => b.extend([p.lat, p.lng]));
      if (b.isValid()) map.fitBounds(b.pad(0.2));
    }, [map, JSON.stringify(line), JSON.stringify(points)]);
    return null;
  }

  function RouteLayer({ vid }: { vid: number | null }) {
    const meta = vid ? (routeMetaByVid[vid] || null) : null;
    const rid = meta?.id ?? null;
    const line = vid ? (routePolylineByVid[vid] || []) : [];
    const pts = rid ? (routePointsByRid[rid] || []) : [];

    if (!vid || line.length < 2) return null;

    const bufferRadius = Math.max(1, Number(meta?.threshold_m ?? 60));
    const bufferPoly = React.useMemo(
      () => buildRouteBufferPolygon(pts.map(p => ({ lat: p.lat, lng: p.lng })), bufferRadius),
      [JSON.stringify(pts), bufferRadius]
    );

    return (
      <>
        <FitToRoute line={line} points={pts} />

        {/* اوت‌لاین و خط اصلی مسیر */}
        <Polyline positions={line} pathOptions={{ color: '#0d47a1', weight: 8, opacity: 0.25 }} />
        <Polyline positions={line} pathOptions={{ color: '#1e88e5', weight: 5, opacity: 0.9 }} />

        {/* بافر مسیر */}
        {bufferPoly.length >= 3 && (
          <Polygon
            positions={bufferPoly.map(p => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: '#1e88e5', weight: 1, opacity: 0.4, fillOpacity: 0.08 }}
          />
        )}

        {/* فقط دایرهٔ شعاع نقاط (بدون مارکر/عدد) */}
        {pts.map((p, i) => (
          Number.isFinite(p.radius_m as any) && (p.radius_m! > 0) && (
            <Circle
              key={`rpt-${rid}-${i}`}
              center={[p.lat, p.lng]}
              radius={p.radius_m!}
              pathOptions={{ color: '#3949ab', opacity: 0.35, fillOpacity: 0.06 }}
            />
          )
        ))}
      </>
    );
  }





  // === Geometry helpers: LL ⇄ XY + buffer polygon (exactly as requested) ===
  function toXY(lat: number, lng: number, lat0: number, lng0: number): [number, number] {
    const R = 6371000;
    const dLat = (lat - lat0) * Math.PI / 180;
    const dLng = (lng - lng0) * Math.PI / 180;
    const x = dLng * Math.cos((lat0 * Math.PI) / 180) * R;
    const y = dLat * R;
    return [x, y];
  }
  function toLL(x: number, y: number, lat0: number, lng0: number) {
    const R = 6371000, toDeg = (r: number) => (r * 180) / Math.PI;
    return {
      lat: lat0 + toDeg(y / R),
      lng: lng0 + toDeg(x / (R * Math.cos((lat0 * Math.PI) / 180))),
    };
  }
  function lineIntersect(
    p: [number, number], r: [number, number],
    q: [number, number], s: [number, number]
  ): [number, number] | null {
    const [rx, ry] = r, [sx, sy] = s;
    const det = rx * sy - ry * sx;
    if (Math.abs(det) < 1e-9) return null; // parallel-ish
    const [px, py] = p, [qx, qy] = q;
    const t = ((qx - px) * sy - (qy - py) * sx) / det;
    return [px + t * rx, py + t * ry];
  }
  /** می‌سازد یک پولیگون بافر دور کل مسیر (m) */
  function buildRouteBufferPolygon(
    pts: { lat: number; lng: number }[],
    radius_m: number
  ): { lat: number; lng: number }[] {
    if (!pts || pts.length < 2) return [];
    const lat0 = pts[0].lat, lng0 = pts[0].lng;
    const P = pts.map(p => toXY(p.lat, p.lng, lat0, lng0));
    const L = P.length;
    const left: [number, number][] = [], right: [number, number][] = [];
    const dir: [number, number][] = [], nor: [number, number][] = [];
    for (let i = 0; i < L - 1; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[i + 1];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1e-9;
      const ux = dx / len, uy = dy / len;
      dir.push([ux, uy]);
      nor.push([-uy, ux]); // left normal
    }
    { // start cap (flat)
      const [x, y] = P[0], [nx, ny] = nor[0];
      left.push([x + nx * radius_m, y + ny * radius_m]);
      right.push([x - nx * radius_m, y - ny * radius_m]);
    }
    for (let i = 1; i < L - 1; i++) {
      const Pi = P[i];
      const uPrev = dir[i - 1], nPrev = nor[i - 1];
      const uNext = dir[i], nNext = nor[i];
      const a1: [number, number] = [Pi[0] + nPrev[0] * radius_m, Pi[1] + nPrev[1] * radius_m];
      const r1: [number, number] = uPrev;
      const a2: [number, number] = [Pi[0] + nNext[0] * radius_m, Pi[1] + nNext[1] * radius_m];
      const r2: [number, number] = uNext;
      let Lp = lineIntersect(a1, r1, a2, r2);
      if (!Lp) Lp = a2; // bevel fallback
      left.push(Lp);
      const b1: [number, number] = [Pi[0] - nPrev[0] * radius_m, Pi[1] - nPrev[1] * radius_m];
      const b2: [number, number] = [Pi[0] - nNext[0] * radius_m, Pi[1] - nNext[1] * radius_m];
      let Rp = lineIntersect(b1, r1, b2, r2);
      if (!Rp) Rp = b2;
      right.push(Rp);
    }
    { // end cap (flat)
      const [x, y] = P[L - 1], [nx, ny] = nor[nor.length - 1];
      left.push([x + nx * radius_m, y + ny * radius_m]);
      right.push([x - nx * radius_m, y - ny * radius_m]);
    }
    const ringXY = [...left, ...right.reverse()];
    return ringXY.map(([x, y]) => toLL(x, y, lat0, lng0));
  }


  const can = (k: string) => allowed.has(k);
  const canTrackDrivers = React.useMemo(() => can('track_driver'), [allowed]);
  const canSeeVehicle = user?.role_level === 2 || can('view_vehicle');

  // ===== Types =====
  type MonitorKey = typeof MONITOR_PARAMS[number]['key'];
  type VehicleTypeCode = typeof VEHICLE_TYPES[number]['code'];
  type DriverStats = { totalDistanceKm?: number; totalDurationMin?: number; jobsCount?: number; breakdownsCount?: number; };
  type DriverExtra = { license_no?: string; lastSeenAt?: string | null; currentVehicle?: { id: number; plate_no: string; vehicle_type_code?: string } | null; };
  type Station = { id: number; name: string; lat: number; lng: number; radius_m: number };
  type Vehicle = { id: number; plate_no: string; vehicle_type_code: VehicleTypeCode; last_location?: { lat: number; lng: number } };

  // ===== State (راننده‌ها) =====
  const [drivers, setDrivers] = React.useState<User[]>([]);
  const [statsMap, setStatsMap] = React.useState<Record<number, DriverStats>>({});
  const [extras, setExtras] = React.useState<Record<number, DriverExtra>>({});
  const [loading, setLoading] = React.useState(true);

  // ✅ قابلیت‌های اعطاشده توسط SA به تفکیک نوع خودرو
  const [grantedPerType, setGrantedPerType] = React.useState<Record<VehicleTypeCode, MonitorKey[]>>({});
  const [parentSAName, setParentSAName] = React.useState<string | null>(null);

  // ===== تب‌ها: راننده‌ها + تب‌های خودرویی به تفکیک نوع =====


  // وقتی اولین grant رسید، تب همان نوع را خودکار باز کن (خواسته‌ی شما)
  React.useEffect(() => {
    const types = Object.keys(grantedPerType) as VehicleTypeCode[];
    const firstWithGrants = types.find(t => (grantedPerType[t] || []).length > 0);
    if (firstWithGrants) setTab(firstWithGrants);
  }, [grantedPerType]);

  // ===== بازه‌ی زمانی =====
  const [preset, setPreset] = React.useState<'today' | 'yesterday' | '7d' | 'custom'>('today');

  React.useEffect(() => {
    const now = new Date();
    if (preset === 'today') { setFromISO(new Date(new Date().setHours(0, 0, 0, 0)).toISOString()); setToISO(now.toISOString()); }
    else if (preset === 'yesterday') { const s = new Date(); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setHours(23, 59, 59, 999); setFromISO(s.toISOString()); setToISO(e.toISOString()); }
    else if (preset === '7d') { const s = new Date(); s.setDate(s.getDate() - 7); setFromISO(s.toISOString()); setToISO(now.toISOString()); }
  }, [preset]);

  // ===== helpers (fetch راننده‌ها + KPI) =====
  const normalizeUsersToDrivers = (arr: any[]): User[] =>
    (arr || []).map((u: any) => ({ id: u.id, role_level: 6, full_name: u.full_name ?? u.name ?? '—', phone: u.phone ?? '', ...(u.last_location ? { last_location: u.last_location } : {}) }));

  const fetchBranchDrivers = async (): Promise<User[]> => {
    try {
      const { data } = await api.get('/users/my-subordinates-flat');
      return normalizeUsersToDrivers((data || []).filter((u: any) => (u?.role_level ?? 6) === 6));
    } catch { }
    const tries = [
      () => api.get(`/users/branch-manager/${user.id}/subordinates`),
      () => api.get('/users', { params: { branch_manager_user_id: user.id, role_level: 6, limit: 1000 } }),
      () => api.get('/drivers', { params: { branch_manager_user_id: user.id, limit: 1000 } }),
    ];
    for (const fn of tries) {
      try {
        const { data } = await fn();
        const items = data?.items ?? data ?? [];
        const out = Array.isArray(items) ? normalizeUsersToDrivers(items) : normalizeUsersToDrivers([items]);
        if (out.length) return out;
      } catch { }
    }
    return [];
  };

  const toRad = (x: number) => x * Math.PI / 180, R = 6371;
  const hav = (a: [number, number], b: [number, number]) => {
    const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]), lat1 = toRad(a[0]), lat2 = toRad(b[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const fetchStats = React.useCallback(async (ids: number[], from: string, to: string) => {
    const settled = await Promise.allSettled(ids.map(id => api.get(`/driver-routes/stats/${id}`, { params: { from, to } })));
    const entries: [number, DriverStats][] = []; const fallbackIds: number[] = [];
    settled.forEach((r, i) => { const id = ids[i]; if (r.status === 'fulfilled') entries.push([id, r.value?.data ?? {}]); else fallbackIds.push(id); });
    if (fallbackIds.length) {
      const tr = await Promise.allSettled(fallbackIds.map(id => api.get('/tracks', { params: { driver_id: id, from, to } }).then(res => ({ id, data: res.data }))));
      tr.forEach(fr => { if (fr.status === 'fulfilled') { const { id, data } = fr.value as any; const pts: { lat: number; lng: number }[] = Array.isArray(data) ? data : data?.items || []; let d = 0; for (let i = 1; i < pts.length; i++) d += hav([pts[i - 1].lat, pts[i - 1].lng], [pts[i].lat, pts[i].lng]); entries.push([id, { totalDistanceKm: +d.toFixed(2) }]); } });
    }
    setStatsMap(Object.fromEntries(entries));
  }, []);
  const [parentSAId, setParentSAId] = React.useState<number | null>(null);

  // ===== SA parent & granted policies =====
  // کمک‌تابع‌ها
  // بالای فایل (کنار تایپ‌ها)
  // کمک‌تابع‌ها


  // 👇 از روی parentSAId فقط از /vehicles و /users/:id/vehicles می‌گیریم
  const ensureArray = (data: any) =>
    Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);

  const normType = (s?: string) => String(s || '').toLowerCase().replace(/[-_]/g, '');




  // برای جلوگیری از race-condition در fetch ها (به ازای هر نوع خودرو)
  const lastFetchReq = React.useRef<Record<VehicleTypeCode, number>>({});

  const fetchVehiclesOfType = React.useCallback(
    async (vt: VehicleTypeCode) => {
      if (!parentSAId) return;
      const rid = Date.now();
      lastFetchReq.current[vt] = rid;

      const apply = (items: any[]) => {
        if (lastFetchReq.current[vt] !== rid) return;

        const list = (items || [])
          .map((v: any) => {
            const ll = v.last_location
              ? {
                lat: roundLL(Number(v.last_location.lat)),
                lng: roundLL(Number(v.last_location.lng)),
              }
              : undefined;

            return {
              id: Number(v.id),
              plate_no: String(v.plate_no ?? v.plateNo ?? ''),
              vehicle_type_code: normType(v.vehicle_type_code ?? v.vehicleTypeCode) as VehicleTypeCode,
              ...(ll ? { last_location: ll } : {}),
              created_at: v.created_at ?? v.createdAt ?? null,
            };
          })
          .sort((a, b) => a.plate_no.localeCompare(b.plate_no, 'fa', { numeric: true }));

        setVehiclesByType(prev => ({ ...prev, [vt]: list }));
        console.log(`[BM] fetched ${list.length} vehicles for <${vt}> from SA=${parentSAId}`);
      };


      try {
        const { data } = await api.get('/vehicles', { params: { owner_user_id: String(parentSAId), limit: 1000 } });
        const all = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        const items = all.filter((v: any) => normType(v.vehicle_type_code ?? v.vehicleTypeCode) === normType(vt));
        apply(items);
      } catch (e) {
        console.warn('[fetchVehiclesOfType] failed:', e);
        apply([]);
      }
    },
    [parentSAId]
  );

  const [policyRows, setPolicyRows] = React.useState<any[]>([]);

  const availableTypes: VehicleTypeCode[] = React.useMemo(() => {
    const set = new Set<VehicleTypeCode>();
    policyRows.forEach(r => {
      const vt = normType(r?.vehicle_type_code ?? r?.vehicleTypeCode) as VehicleTypeCode;
      if (vt) set.add(vt);
    });
    return Array.from(set);
  }, [policyRows]);




  React.useEffect(() => {
    if (!activeType) return;
    fetchVehiclesOfType(activeType);
  }, [activeType, parentSAId, fetchVehiclesOfType]);


  const pick = (...vals: any[]) => vals.find(v => v !== undefined && v !== null && v !== '');
  const [vehiclesByType, setVehiclesByType] = React.useState<Record<VehicleTypeCode, Vehicle[]>>({});




  // NEW: آی‌دی سوپرادمین(های) والد Branch Manager
  // ⬅️ SA والد

  // اولین اجداد با role_level = 2 را پیدا می‌کند
  // stateهای مرتبط


  // همونی که قبلاً ساختی:
  // ✅ به‌جای getParentSAId که روی /users/:id می‌رفت




  /* React.useEffect(() => {
     if (!user?.id) return;
     let alive = true;
     (async () => {
       const sa = await getParentSAFromPolicies(user.id);
       if (!alive) return;
       setParentSA(sa);
       setParentSAId(sa?.id ?? null);
       setParentSAName(sa?.name ?? null);
     })();
     return () => { alive = false; };
   }, [user?.id, getParentSAFromPolicies]);
 */


  React.useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      const sa = await resolveParentSA(user.id);
      if (!alive) return;
      setParentSA(sa);
      setParentSAId(sa?.id ?? null);
      setParentSAName(sa?.name ?? null);
      console.log('[BM] parentSA resolved =>', sa);
    })();
    return () => { alive = false; };
  }, [user?.id, resolveParentSA]);


  const fetchGrantedPolicies = React.useCallback(async (uid: number) => {
    try {
      const { data } = await api.get(`/vehicle-policies/user/${uid}`, { params: { onlyAllowed: true } });
      const rows: any[] = Array.isArray(data) ? data : [];
      setPolicyRows(rows);

      const map: Record<VehicleTypeCode, MonitorKey[]> = {} as any;
      rows.forEach((row: any) => {
        const vt = String(row?.vehicle_type_code ?? row?.vehicleTypeCode ?? '').toLowerCase() as VehicleTypeCode;
        const arr: MonitorKey[] = Array.isArray(row?.monitor_params ?? row?.monitorParams) ? (row.monitor_params ?? row.monitorParams) : [];
        if (vt) map[vt] = arr;
      });
      setGrantedPerType(map);
    } catch {
      setPolicyRows([]);
      setGrantedPerType({});
    }
  }, []);
  const vehiclesRef = React.useRef<Record<VehicleTypeCode, Vehicle[]>>({});
  React.useEffect(() => { vehiclesRef.current = vehiclesByType; }, [vehiclesByType]);
  // همه‌ی نوع‌هایی که کاربر اجازه دارد (صرف‌نظر از monitor_params)


  // اگر می‌خواهی فقط نوع‌هایی که حداقل یک پارامتر دارند تب شوند:
  const typesWithGrants: VehicleTypeCode[] = React.useMemo(() => {
    const withParams = new Set<VehicleTypeCode>(
      (Object.keys(grantedPerType) as VehicleTypeCode[]).filter(vt => (grantedPerType[vt] || []).length > 0)
    );
    // اتحــاد: یا پارامتر دارد یا صرفاً در پالیسی آمده
    const all = new Set<VehicleTypeCode>([...availableTypes, ...withParams]);
    return Array.from(all);
  }, [availableTypes, grantedPerType]);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const ds = await fetchBranchDrivers();
        setDrivers(ds);
        await fetchStats(ds.map(d => d.id), fromISO, toISO);
      } catch (e) { console.error('[branch-manager] init error:', e); }
      finally { setLoading(false); }
    })();
  }, [user?.id, fromISO, toISO, fetchStats]);

  // ✅ فقط گرانت‌ها
  React.useEffect(() => {
    if (!user?.id) return;
    fetchGrantedPolicies(user.id);
  }, [user?.id, fetchGrantedPolicies]);



  // ===== نقشه =====
  const [useMapTiler] = React.useState(Boolean(MT_KEY));
  const tileUrl = useMapTiler && MT_KEY ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MT_KEY}` : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const [focusLatLng, setFocusLatLng] = React.useState<[number, number] | undefined>(undefined);

  // تا مجبور نشی useEffect سوکت رو به selectedVehicleId وابسته کنی:
  const selectedVehicleIdRef = React.useRef<number | null>(null);
  React.useEffect(() => { selectedVehicleIdRef.current = selectedVehicleId; }, [selectedVehicleId]);

  // ===== WebSocket =====
  const socketRef = React.useRef<Socket | null>(null);
  const [polyline, setPolyline] = React.useState<[number, number][]>([]);
  const liveTrackOnRef = React.useRef<boolean>(false);
  const selectedDriverRef = React.useRef<User | null>(null);

  const subscribedVehiclesRef = React.useRef<Set<number>>(new Set());
  const [addingStationsForVid, setAddingStationsForVid] = React.useState<number | null>(null);
  const lastStationsSubRef = React.useRef<{ vid: number; uid: number } | null>(null);

  // ایستگاه‌ها (per vehicle)
  const [stationRadius, setStationRadius] = React.useState<number>(60);
  const [tempStation, setTempStation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [tempName, setTempName] = React.useState<string>('');
  const [autoIndex, setAutoIndex] = React.useState(1);
  const [editingStation, setEditingStation] = React.useState<{ vid: number; st: Station } | null>(null);
  const [movingStationId, setMovingStationId] = React.useState<number | null>(null);

  // marker lists
  const driverMarkers = React.useMemo(() => {
    if (!canTrackDrivers) return [];
    return drivers.filter(d => (d as any).last_location).map(d => [(d as any).last_location!.lat, (d as any).last_location!.lng] as [number, number]);
  }, [drivers, canTrackDrivers]);

  const typeGrants: MonitorKey[] = activeType ? (grantedPerType[activeType] || []) : [];
  const hasGrant = (k: string) =>
    typeGrants.map(s => String(s).toLowerCase().replace(/[-_]/g, ''))
      .includes(k.toLowerCase().replace(/[-_]/g, ''));
  // ===== Violations (types + state) =====
  type ViolationType =
    | 'overspeed' | 'speeding'
    | 'route_deviation'
    | 'geofence_in' | 'geofence_out' | 'geofence'
    | 'idle_over'
    | 'harsh_brake' | 'harsh_accel' | 'harsh_turn'
    | 'ignition_on_off_hours';

  type Violation = {
    created_at: string | number | Date;
    id?: number;
    vehicle_id: number;
    driver_id?: number | null;
    at: string;                   // ISO date
    lat: number;
    lng: number;
    type: ViolationType;
    severity?: 'low' | 'med' | 'high';
    meta?: Record<string, any>;
  };

  const [violationsByVid, setViolationsByVid] =
    React.useState<Record<number, Violation[]>>({});
  const [vioStatusByVid, setVioStatusByVid] =
    React.useState<Record<number, 'idle' | 'loading' | 'loaded' | 'error'>>({});

  const [vioFilterTypes, setVioFilterTypes] = React.useState<Set<ViolationType>>(
    new Set<ViolationType>(['overspeed', 'speeding', 'route_deviation', 'geofence_out', 'idle_over'])
  );
  const [vioOnlySevere, setVioOnlySevere] = React.useState(false);
  const [selectedVioId, setSelectedVioId] = React.useState<number | null>(null);

  // دسترسی: اگر «violations» یا هرکدام از کلیدهای مرتبط گرانت شده باشد
  const canViolations =
    !!(activeType && (
      hasGrant('violations') ||
      hasGrant('overspeed') || hasGrant('speeding') ||
      hasGrant('route_deviation') ||
      hasGrant('geo_fence') || hasGrant('geofence') ||
      hasGrant('idle_time')
    ));
  function normalizeViolations(payload: any, fallbackVid?: number): Violation[] {
    const arr: any[] =
      Array.isArray(payload) ? payload
        : Array.isArray(payload?.items) ? payload.items
          : Array.isArray(payload?.data?.items) ? payload.data.items
            : Array.isArray(payload?.data) ? payload.data
              : Array.isArray(payload?.rows) ? payload.rows
                : payload ? [payload] : [];

    const num = (v: any) => (Number.isFinite(+v) ? +v : NaN);
    const toISO = (v: any) => { const d = new Date(v); return isNaN(+d) ? new Date().toISOString() : d.toISOString(); };
    const ll = (lat: any, lng: any) => ({ lat: num(lat), lng: num(lng) });

    return arr.map((r: any) => {
      const p = r?.position ?? r?.pos ?? r?.loc ?? r;
      const t = String(r?.type ?? r?.violation_type ?? r?.code ?? '').toLowerCase() as ViolationType;
      const tm = r?.at ?? r?.time ?? r?.created_at ?? r?.createdAt;
      const lat = p?.lat ?? p?.latitude ?? p?.y;
      const lng = p?.lng ?? p?.longitude ?? p?.x;

      return {
        id: Number.isFinite(+r?.id) ? +r.id : undefined,
        vehicle_id: Number.isFinite(+r?.vehicle_id ?? +r?.vehicleId) ? +(r?.vehicle_id ?? r?.vehicleId) : (fallbackVid ?? NaN),
        driver_id: Number.isFinite(+r?.driver_id ?? +r?.driverId) ? +(r?.driver_id ?? r?.driverId) : null,
        at: toISO(tm),
        ...ll(lat, lng),
        type: t || 'overspeed',
        severity: (r?.severity ?? r?.level ?? '').toLowerCase() as any || undefined,
        meta: r?.meta ?? r
      };
    }).filter(v => Number.isFinite(v.vehicle_id) && Number.isFinite(v.lat) && Number.isFinite(v.lng));
  }

  const vioReqRef = React.useRef<Record<number, number>>({});

  const refreshViolations = React.useCallback(
    async (vid: number, from: string, to: string) => {
      const stamp = Date.now();
      vioReqRef.current[vid] = stamp;
      setVioStatusByVid(p => ({ ...p, [vid]: 'loading' }));

      const params: any = { from, to };
      const types = Array.from(vioFilterTypes);
      if (types.length) params.types = types.join(',');

      try {
        // مسیر اصلی
        const { data } = await api.get(`/vehicles/${vid}/violations`, { params });
        if (vioReqRef.current[vid] !== stamp) return;
        const list = normalizeViolations(data, vid);
        setViolationsByVid(p => ({ ...p, [vid]: list }));
        setVioStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
      } catch {
        // فالبک‌های رایج
        try {
          const { data } = await api.get('/violations', { params: { ...params, vehicle_id: String(vid) } });
          if (vioReqRef.current[vid] !== stamp) return;
          const list = normalizeViolations(data, vid);
          setViolationsByVid(p => ({ ...p, [vid]: list }));
          setVioStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
        } catch {
          try {
            const { data } = await api.get('/events', { params: { ...params, category: 'violation', vehicle_id: String(vid) } });
            if (vioReqRef.current[vid] !== stamp) return;
            const list = normalizeViolations(data, vid);
            setViolationsByVid(p => ({ ...p, [vid]: list }));
            setVioStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
          } catch {
            setVioStatusByVid(p => ({ ...p, [vid]: 'error' }));
          }
        }
      }
    },
    [vioFilterTypes]
  );
  const lastVioVidRef = React.useRef<number | null>(null);

  const canTrackVehicles = !!(activeType && hasGrant('gps'));
  const canStations = !!(activeType && hasGrant('stations'));
  const canConsumables = !!(activeType && hasGrant('consumables'));
  const canIgnition = !!(activeType && hasGrant('ignition'));
  const canIdleTime = !!(activeType && hasGrant('idle_time'));
  const canOdometer = !!(activeType && hasGrant('odometer'));
  const canGeoFence = !!(activeType && (hasGrant('geo_fence') || hasGrant('geofence')));

  const canRouteEdit =
    !!(activeType && (hasGrant('route') || hasGrant('routes') || hasGrant('route_edit')));
  // آخرین سابسکرایب برای هر کلید
  const lastIgnVidRef = React.useRef<number | null>(null);
  const lastIdleVidRef = React.useRef<number | null>(null);
  const lastOdoVidRef = React.useRef<number | null>(null);
  type GeofenceCircle = {
    id?: number;
    type: 'circle';
    center: { lat: number; lng: number };
    radius_m: number;
    tolerance_m?: number | null;
  };
  type GeofencePolygon = {
    id?: number;
    type: 'polygon';
    points: { lat: number; lng: number }[];
    tolerance_m?: number | null;
  };
  type Geofence = GeofenceCircle | GeofencePolygon;

  // per-vehicle cache
  const [geofencesByVid, setGeofencesByVid] = React.useState<Record<number, Geofence[]>>({});

  // UI state برای ترسیم/ویرایش
  const [gfMode, setGfMode] = React.useState<'circle' | 'polygon'>('circle');
  const [gfDrawing, setGfDrawing] = React.useState(false);
  const [gfCenter, setGfCenter] = React.useState<{ lat: number; lng: number } | null>(null);
  const [gfRadius, setGfRadius] = React.useState<number>(150);
  const [gfPoly, setGfPoly] = React.useState<{ lat: number; lng: number }[]>([]);
  const [gfTolerance, setGfTolerance] = React.useState<number>(15);
  function PickPointsForGeofence({
    enabled,
    onPick,
  }: {
    enabled: boolean;
    onPick: (lat: number, lng: number) => void;
  }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }
  async function loadVehicleGeofenceBM(vid: number) {
    try {
      const { data } = await api.get(`/vehicles/${vid}/geofence`, {
        params: { _: Date.now() },
        headers: { 'Cache-Control': 'no-store' },
      });

      // خروجی را به آرایه‌ی استاندارد Geofence[] تبدیل کن
      const list = normalizeGeofences(data); // حتی اگر تک‌آبجکت بود، آرایه می‌شود
      setGeofencesByVid(p => ({ ...p, [vid]: list }));
      return list;
    } catch {
      setGeofencesByVid(p => ({ ...p, [vid]: [] }));
      return [];
    }
  }


  async function saveGeofenceBM() {
    if (!selectedVehicleId) return;

    const toInt = (v: any, min: number) => Math.max(min, Math.trunc(Number(v)));

    let payload: any;
    if (gfMode === 'circle') {
      if (!gfCenter || !Number.isFinite(gfCenter.lat) || !Number.isFinite(gfCenter.lng) || !Number.isFinite(gfRadius) || gfRadius <= 0) {
        alert('مرکز و شعاع دایره را درست وارد کنید.'); return;
      }
      payload = {
        type: 'circle',
        centerLat: +gfCenter.lat,
        centerLng: +gfCenter.lng,
        radiusM: toInt(gfRadius, 1),
        toleranceM: toInt(gfTolerance ?? 5, 0),
      };
    } else {
      if (!Array.isArray(gfPoly) || gfPoly.length < 3) { alert('چندضلعی حداقل به ۳ نقطه نیاز دارد.'); return; }
      payload = {
        type: 'polygon',
        polygonPoints: gfPoly.map(p => ({ lat: +p.lat, lng: +p.lng })),
        toleranceM: toInt(gfTolerance ?? 5, 0),
      };
    }

    try {
      await api.put(`/vehicles/${selectedVehicleId}/geofence`, payload)
        .catch(() => api.post(`/vehicles/${selectedVehicleId}/geofence`, payload));

      await loadVehicleGeofences(selectedVehicleId);      // reset draw UI
      setGfDrawing(false); setGfCenter(null); setGfPoly([]);
    } catch (e: any) {
      console.error('saveGeofenceBM error:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'ثبت ژئوفنس ناموفق بود');
    }
  }

  async function deleteGeofenceBM() {
    if (!selectedVehicleId) return;
    if (!confirm('ژئوفنس حذف شود؟')) return;

    try {
      await api.delete(`/vehicles/${selectedVehicleId}/geofence`)  // اگر API شما فقط تکی پاک می‌کند
        .catch(() => api.delete(`/geofences`, { params: { vehicle_id: String(selectedVehicleId) } })); // اگر جمعی دارید

      setGeofencesByVid(p => ({ ...p, [selectedVehicleId]: [] }));

      setGfDrawing(false); setGfCenter(null); setGfPoly([]);
    } catch (e) {
      console.error(e);
      alert('حذف ژئوفنس ناموفق بود');
    }
  }

  // بالاتر از تابع، یه کمک‌تابع کوچک
  /*  const ensureArray = (data: any) =>
     Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
 */


  // REPLACE: به جای نسخه‌ای که ownerId تکی می‌گرفت

  // صدا زدنش





  // این نسخه را بگذار جای fetchVehiclesOfType فعلی‌ت





  // REPLACE: قبلاً parentSA?.id تکی بود؛ الان از parentSAIds استفاده کن
  // ✅ فقط همین
  React.useEffect(() => {
    if (!activeType) return;
    fetchVehiclesOfType(activeType);
  }, [activeType, parentSAId, fetchVehiclesOfType]);




  // --- جایگزین این تابع کن ---





  // وقتی تب نوع فعال شد، ماشین‌های همان نوع را بگیر و سابسکرایب pos



  React.useEffect(() => {
    const s = socketRef.current;
    if (!s || !activeType || !canTrackVehicles) return;

    const nextIds = new Set((vehiclesByType[activeType] || []).map(v => v.id));
    const prev = subscribedVehiclesRef.current;

    const toSub: number[] = [];
    const toUnsub: number[] = [];

    nextIds.forEach(id => { if (!prev.has(id)) toSub.push(id); });
    prev.forEach(id => { if (!nextIds.has(id)) toUnsub.push(id); });

    // pos: سابسکرایب/آن‌سابِ اختلاف
    toSub.forEach(id => s.emit('subscribe', { topic: `vehicle/${id}/pos` }));
    toUnsub.forEach(id => s.emit('unsubscribe', { topic: `vehicle/${id}/pos` }));

    // چون لیست ماشین‌های تحت‌نظر عوض شده، سابسکرایب‌های تله‌متری قبلی را آزاد کن
    if (lastIgnVidRef.current) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIgnVidRef.current}/ignition` });
      lastIgnVidRef.current = null;
    }
    if (lastIdleVidRef.current) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIdleVidRef.current}/idle_time` });
      lastIdleVidRef.current = null;
    }
    if (lastTelemOdoVidRef.current) {
      s.emit('unsubscribe', { topic: `vehicle/${lastTelemOdoVidRef.current}/odometer` });
      lastTelemOdoVidRef.current = null;
    }

    subscribedVehiclesRef.current = nextIds;
  }, [activeType, canTrackVehicles, vehiclesByType]);


  // اتصال سوکت
  React.useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const s = io(url + '/vehicles', { transports: ['websocket'] });
    socketRef.current = s;

    // === هندلرها ===
    const onDriverPos = (v: { driver_id: number; lat: number; lng: number }) => {
      // اختیاری: هر کاری لازم داری
    };

    const onVehiclePos = (v: { vehicle_id: number; lat: number; lng: number }) => {
      // اختیاری: هر کاری لازم داری
    };

    const onStations = (msg: any) => {
      const vid = Number(msg?.vehicle_id ?? msg?.vehicleId);
      if (!Number.isFinite(vid)) return;

      setVehicleStationsMap(prev => {
        const list = (prev[vid] || []).slice();
        const normalize = (st: any) => ({
          ...st,
          lat: roundLL(parseFloat(String(st.lat))),
          lng: roundLL(parseFloat(String(st.lng))),
        });

        if (msg?.type === 'created' && msg.station) {
          const st = normalize(msg.station);
          if (!list.some(x => x.id === st.id)) list.push(st);
        } else if (msg?.type === 'updated' && msg.station) {
          const st = normalize(msg.station);
          const i = list.findIndex(x => x.id === st.id);
          if (i >= 0) list[i] = st;
        } else if (msg?.type === 'deleted' && msg.station_id) {
          const sid = Number(msg.station_id);
          return { ...prev, [vid]: list.filter(x => x.id !== sid) };
        }
        return { ...prev, [vid]: list };
      });
    };

    // --- NEW: هندلر کیلومترشمار ---
    const onOdo = (data: { vehicle_id: number; odometer: number }) => {
      // فقط اگر همین ماشینی‌ست که الان انتخاب شده
      if (selectedVehicleIdRef.current === data.vehicle_id) {
        setVehicleTlm(prev => ({ ...prev, odometer: data.odometer }));
      }
    };
    s.on('vehicle:ignition', (d: { vehicle_id: number; ignition: boolean }) =>
      selectedVehicleIdRef.current === d.vehicle_id && setVehicleTlm(p => ({ ...p, ignition: d.ignition })));

    s.on('vehicle:idle_time', (d: { vehicle_id: number; idle_time: number }) =>
      selectedVehicleIdRef.current === d.vehicle_id && setVehicleTlm(p => ({ ...p, idle_time: d.idle_time })));

    s.on('vehicle:odometer', (d: { vehicle_id: number; odometer: number }) =>
      selectedVehicleIdRef.current === d.vehicle_id && setVehicleTlm(p => ({ ...p, odometer: d.odometer })));

    // === ثبت لیسنرها ===
    s.on('driver:pos', onDriverPos);
    s.on('vehicle:pos', onVehiclePos);
    s.on('vehicle:stations', onStations);
    s.on('vehicle:odometer', onOdo);   // ⬅️ این خط جدید
    // --- VIOLATIONS: handler ---
    const onViolation = (msg: any) => {
      const v = normalizeViolations(msg?.violation ?? msg, msg?.vehicle_id ?? msg?.vehicleId)[0];
      if (!v) return;
      setViolationsByVid(prev => {
        const cur = prev[v.vehicle_id] || [];
        // اگر فیلتر severe فعال است، اینجا رد نکن—در UI فیلتر کن که تاریخچه حفظ بماند
        // از تکرار جلوگیری
        const exists = v.id && cur.some(x => x.id === v.id);
        const next = exists ? cur : [v, ...cur];
        return { ...prev, [v.vehicle_id]: next };
      });
    };

    // ثبت لیسنر
    s.on('vehicle:violation', onViolation);

    // پاکسازی
    // ...

    // === پاکسازی ===
    return () => {
      // آن‌سابسکرایب pos ها
      subscribedVehiclesRef.current.forEach((id) => {
        s.emit('unsubscribe', { topic: `vehicle/${id}/pos` });
      });
      subscribedVehiclesRef.current = new Set();

      // آن‌سابسکرایب stations
      if (lastStationsSubRef.current) {
        const { vid, uid } = lastStationsSubRef.current;
        s.emit('unsubscribe', { topic: `vehicle/${vid}/stations/${uid}` });
        lastStationsSubRef.current = null;
      }
      s.off('vehicle:violation', onViolation);

      // --- NEW: آن‌سابسکرایب از تاپیک odometer اگر فعال بود
      if (lastTelemOdoVidRef.current) {
        s.emit('unsubscribe', { topic: `vehicle/${lastTelemOdoVidRef.current}/odometer` });
        lastTelemOdoVidRef.current = null;
      }

      // off هندلرها
      s.off('driver:pos', onDriverPos);
      s.off('vehicle:pos', onVehiclePos);
      s.off('vehicle:stations', onStations);
      s.off('vehicle:odometer', onOdo);

      s.disconnect();
      socketRef.current = null;
    };
  }, []);



  // سابسکرایب/آن‌سابسکرایب pos برای ماشین‌های تب فعال
  React.useEffect(() => {
    const vt = activeType;
    if (!vt || !parentSAId) return;
    if (!(vt in vehiclesByType)) {
      fetchVehiclesOfType(vt);
    }
  }, [activeType, parentSAId, vehiclesByType, fetchVehiclesOfType]);



  // ===== ایستگاه‌ها =====

  const startAddingStationsFor = async (vid: number) => {
    const next = addingStationsForVid === vid ? null : vid;
    setAddingStationsForVid(next);
    setTempStation(null);
    setTempName(`ایستگاه ${autoIndex}`);

    const s = socketRef.current;
    if (!s) return;

    // پاکسازی سابسکرایب قبلی
    if (lastStationsSubRef.current) {
      const { vid: pvid, uid } = lastStationsSubRef.current;
      s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations/${uid}` });
      s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations` });
      lastStationsSubRef.current = null;
    }

    if (next != null) {
      // ساب روی هر دو تاپیک
      s.emit('subscribe', { topic: `vehicle/${next}/stations/${user.id}` });
      s.emit('subscribe', { topic: `vehicle/${next}/stations` });
      lastStationsSubRef.current = { vid: next, uid: user.id };

      if (!vehicleStationsMap[next]) fetchStations(next);
    }
  };

  const confirmTempStation = async () => {
    if (!addingStationsForVid || !tempStation) return;
    const name = (tempName || `ایستگاه ${autoIndex}`).trim();

    try {
      await api.post(`/vehicles/${addingStationsForVid}/stations`, {
        name,
        lat: roundLL(tempStation.lat),
        lng: roundLL(tempStation.lng),
        radius_m: stationRadius,
      });

      await fetchStations(addingStationsForVid); // بعد از ساخت، تازه بخوان
      setAutoIndex(i => i + 1);
      setTempStation(null);
    } catch {
      alert('ثبت ایستگاه ناموفق بود');
    }
  };

  const deleteStation = async (vid: number, st: Station) => {
    if (!confirm('ایستگاه حذف شود؟')) return;
    try {
      await api.delete(`/vehicles/${vid}/stations/${st.id}`);
      setVehicleStationsMap(prev => ({ ...prev, [vid]: (prev[vid] || []).filter(x => x.id !== st.id) }));
      if (editingStation?.st.id === st.id) setEditingStation(null);
    } catch { alert('حذف ناموفق بود'); }
  };
  const saveEditStation = async () => {
    const ed = editingStation; if (!ed) return;
    try {
      await api.put(`/vehicles/${ed.vid}/stations/${ed.st.id}`, { name: ed.st.name, lat: ed.st.lat, lng: ed.st.lng, radius_m: ed.st.radius_m });
      setVehicleStationsMap(prev => ({ ...prev, [ed.vid]: (prev[ed.vid] || []).map(x => x.id === ed.st.id ? ed.st : x) }));
      setEditingStation(null); setMovingStationId(null);
    } catch { alert('ذخیره ویرایش ناموفق بود'); }
  };

  // ===== مسیر راننده =====

  const lastTelemOdoVidRef = React.useRef<number | null>(null);

  // ===== Map click helper =====
  // بیرون از BranchManagerRoleSection.tsx (یا بالا، خارج از بدنه‌ی تابع)

  const onPickVehicleBM = React.useCallback(async (v: Vehicle) => {
    setSelectedVehicleId(v.id);
    await loadVehicleGeofences(v.id);
    setSheetOpen(true);        // ⬅️ این خط را اضافه کن
    setSheetMode('vehicle');
    await loadViolations(v.id);

    // ریست حالت‌های افزودن/ادیت ایستگاه
    setAddingStationsForVid(null);
    setEditingStation(null);
    setMovingStationId(null);
    setTempStation(null);
    await loadVehicleRoute(v.id);

    if (v.last_location) setFocusLatLng([v.last_location.lat, v.last_location.lng]);

    // ایستگاه‌ها (در صورت مجوز)
    if (canStations) {
      await ensureStationsLive(v.id);   // subscribe + fetch
    } else {
      await fetchStations(v.id);        // فقط fetch برای نمایش روی نقشه
    }
    const s = socketRef.current;
    if (s && canViolations) {
      if (lastVioVidRef.current && lastVioVidRef.current !== v.id) {
        s.emit('unsubscribe', { topic: `vehicle/${lastVioVidRef.current}/violations` });
        lastVioVidRef.current = null;
      }
      s.emit('subscribe', { topic: `vehicle/${v.id}/violations` });
      lastVioVidRef.current = v.id;

      // فچ اولیه در بازه انتخابی
      await refreshViolations(v.id, fromISO, toISO);
    }

    // --- آزاد کردن سابسکرایب‌های قبلی تله‌متری (هر کدام جدا) ---
    if (s && lastIgnVidRef.current && lastIgnVidRef.current !== v.id) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIgnVidRef.current}/ignition` });
      lastIgnVidRef.current = null;
    }
    if (s && lastIdleVidRef.current && lastIdleVidRef.current !== v.id) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIdleVidRef.current}/idle_time` });
      lastIdleVidRef.current = null;
    }


    // مقادیر قبلی تله‌متری را پاک کن (تا UI وضعیت نامشخص نشان دهد)
    setVehicleTlm({});

    // ===== فچ اولیه تله‌متری (صرفاً برای کلیدهای مجاز) =====
    try {
      const keysWanted: ('ignition' | 'idle_time' | 'odometer')[] = [];
      if (canIgnition) keysWanted.push('ignition');
      if (canIdleTime) keysWanted.push('idle_time');
      if (canOdometer) keysWanted.push('odometer');

      if (keysWanted.length) {
        const { data } = await api.get(`/vehicles/${v.id}/telemetry`, { params: { keys: keysWanted } });

        const next: { ignition?: boolean; idle_time?: number; odometer?: number } = {};
        if (typeof data?.ignition === 'boolean') next.ignition = data.ignition;
        if (typeof data?.idle_time === 'number') next.idle_time = data.idle_time;
        if (typeof data?.odometer === 'number') next.odometer = data.odometer;

        setVehicleTlm(next);
      }
    } catch {
      // مشکلی نبود؛ بعداً از سوکت آپدیت می‌گیریم
    }

    // ===== سابسکرایب تله‌متری برای ماشین انتخاب‌شده (هر کدام که مجاز است) =====
    if (s) {
      if (canIgnition) {
        s.emit('subscribe', { topic: `vehicle/${v.id}/ignition` });
        lastIgnVidRef.current = v.id;
      }
      if (canIdleTime) {
        s.emit('subscribe', { topic: `vehicle/${v.id}/idle_time` });
        lastIdleVidRef.current = v.id;  // ✅ درست
      }

      if (canOdometer) {
        s.emit('subscribe', { topic: `vehicle/${v.id}/odometer` });
        lastTelemOdoVidRef.current = v.id;
      }
    }
    // ژئوفنس (در صورت مجوز)
    setSelectedVehicleId(v.id);
    await loadVehicleGeofences(v.id); // همین یکی بماند




    // ===== لوازم مصرفی (کاملاً مستقل از تله‌متری) =====
    if (canConsumables) {
      // اسنپ‌شات لوکال
      const snap = loadConsLocal(v.id);
      if (snap.length) {
        setConsumablesByVid(p => ({ ...p, [v.id]: snap }));
        setConsStatusByVid(p => ({ ...p, [v.id]: 'loaded' }));
      } else {
        setConsumablesByVid(p => ({ ...p, [v.id]: [] }));
        setConsStatusByVid(p => ({ ...p, [v.id]: 'loading' }));
      }
      // همسان‌سازی از سرور
      refreshConsumables(v.id);
    } else {
      setConsumablesByVid(p => ({ ...p, [v.id]: [] }));
      setConsStatusByVid(p => ({ ...p, [v.id]: 'idle' }));
    }
  }, [
    canStations,
    ensureStationsLive,
    canConsumables,
    refreshConsumables,
    canIgnition,
    canIdleTime,
    canOdometer,
  ]);



  const DEFAULT_KM_REMINDER = 5000;
  const keyOfCons = (c: any) => String(c.id ?? `${c.mode}:${c.start_at ?? c.base_odometer_km ?? Math.random()}`);
  const notifyOnce = (c: any, msg: string) => {
    const k = keyOfCons(c);
    if (notifiedRef.current.has(k)) return;
    notifiedRef.current.add(k);
    setToast({ open: true, msg });
  };

  const canEditGeofence = !!(activeType && (hasGrant('geo_fence') || hasGrant('geofence')));
  React.useEffect(() => {
    if (!selectedVehicleId) return;
    loadVehicleGeofences(selectedVehicleId);
  }, [selectedVehicleId]); // ⬅️ canGeoFence از دیپندنسی حذف شد


  const checkConsumableDue = React.useCallback(() => {
    if (!selectedVehicleId) return;
    const list = consumablesByVid[selectedVehicleId] || [];
    const now = Date.now();

    list.forEach((c: any) => {
      if (c.mode === 'time' && c.start_at) {
        const t = new Date(c.start_at).getTime();
        if (!Number.isNaN(t) && now >= t) {
          notifyOnce(c, `یادآوری: «${c.title ?? c.note ?? 'آیتم'}» به زمان تعیین‌شده رسید.`);
        }
      }
      if (c.mode === 'km' && c.base_odometer_km != null && vehicleTlm.odometer != null) {
        const dist = Number(vehicleTlm.odometer) - Number(c.base_odometer_km);
        if (dist >= DEFAULT_KM_REMINDER) {
          notifyOnce(c, `یادآوری: «${c.title ?? c.note ?? 'آیتم'}» به ${DEFAULT_KM_REMINDER.toLocaleString('fa-IR')} کیلومتر پس از صفر رسید.`);
        }
      }
    });
  }, [selectedVehicleId, consumablesByVid, vehicleTlm.odometer]);

  React.useEffect(() => { checkConsumableDue(); }, [checkConsumableDue]);
  React.useEffect(() => {
    const id = setInterval(checkConsumableDue, 30_000);
    return () => clearInterval(id);
  }, [checkConsumableDue]);
  const openEditConsumable = (c: any) => {
    setEditingCons({
      id: c.id,
      mode: c.mode,
      note: c.note ?? '',
      start_at: c.start_at ?? null,
      base_odometer_km: c.base_odometer_km ?? null,
    });
  };
  const closeEditConsumable = () => setEditingCons(null);
  function normalizeGeofences(payload: any): Geofence[] {
    // به آرایه تبدیل کن
    const arr: any[] = Array.isArray(payload) ? payload
      : Array.isArray(payload?.items) ? payload.items
        : Array.isArray(payload?.data?.items) ? payload.data.items
          : Array.isArray(payload?.data) ? payload.data
            : Array.isArray(payload?.rows) ? payload.rows
              : Array.isArray(payload?.geofences) ? payload.geofences
                : payload?.rule ? [payload.rule]
                  : payload ? [payload] : [];

    const toNumStrict = (v: any) => (
      v === null || v === undefined || v === '' ? undefined :
        (Number.isFinite(+v) ? +v : undefined)
    );
    const toLL = (p: any) => {
      const lat = toNumStrict(p?.lat ?? p?.latitude ?? p?.y);
      const lng = toNumStrict(p?.lng ?? p?.longitude ?? p?.x);
      return (lat != null && lng != null) ? { lat, lng } : undefined;
    };

    const out: Geofence[] = [];

    for (const g of arr) {
      const geom = g?.geometry ?? g?.geojson ?? g?.geoJSON;
      const type = String(g?.type ?? geom?.type ?? '').toLowerCase();

      // ---- candidate: circle ----
      const centerObj = g?.center ?? {
        lat: g?.centerLat ?? g?.center_lat ?? g?.lat,
        lng: g?.centerLng ?? g?.center_lng ?? g?.lng,
      };
      const center = toLL(centerObj ?? {});
      const radius = toNumStrict(g?.radius_m ?? g?.radiusM ?? g?.radius ?? geom?.radius);
      const tol = toNumStrict(g?.tolerance_m ?? g?.toleranceM ?? g?.tolerance);

      const looksCircle = (type === 'circle') || (radius != null && radius > 0 && !!center);
      if (looksCircle && center && radius != null && radius > 0) {
        out.push({
          type: 'circle',
          id: toNumStrict(g?.id),
          center,
          radius_m: radius,
          tolerance_m: (tol ?? null),
        } as GeofenceCircle);
        continue; // فقط وقتی دایره معتبر push شد از این آیتم می‌گذریم
      }

      // ---- candidate: polygon via points/polygonPoints ----
      const rawPoints = g?.points ?? g?.polygonPoints ?? g?.polygon_points ?? geom?.points;
      if (Array.isArray(rawPoints)) {
        const pts = rawPoints.map((p: any) => toLL(p)).filter(Boolean) as { lat: number; lng: number }[];
        if (pts.length >= 3) {
          out.push({
            type: 'polygon',
            id: toNumStrict(g?.id),
            points: pts,
            tolerance_m: (tol ?? null),
          } as GeofencePolygon);
          continue;
        }
      }

      // ---- candidate: polygon via GeoJSON.coordinates ----
      const coords = geom?.coordinates;
      if (String(geom?.type ?? g?.type ?? '').toLowerCase() === 'polygon' && Array.isArray(coords)) {
        const ring = Array.isArray(coords[0]) ? coords[0] : coords; // [[lng,lat], ...]
        const pts = ring
          .map((xy: any) => Array.isArray(xy) && xy.length >= 2 ? ({ lat: toNumStrict(xy[1]), lng: toNumStrict(xy[0]) }) : undefined)
          .filter((p: any) => p?.lat != null && p?.lng != null) as { lat: number; lng: number }[];
        if (pts.length >= 3) {
          out.push({
            type: 'polygon',
            id: toNumStrict(g?.id),
            points: pts,
            tolerance_m: (tol ?? null),
          } as GeofencePolygon);
          continue;
        }
      }
    }

    // یکتاسازی بر اساس id (اگر داشت)
    const seen = new Set<number>();
    return out.filter(g => (g.id ? !seen.has(g.id) && (seen.add(g.id), true) : true));
  }
  // انتخاب نقطه برای ایستگاه‌ها (کلیک روی نقشه وقتی حالت افزودن فعال است)
  function PickPointsForStations({
    enabled,
    onPick,
  }: {
    enabled: boolean;
    onPick: (lat: number, lng: number) => void;
  }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => {
      if (enabled) onPick(e.latlng.lat, e.latlng.lng);
    });
    return null;
  }

  async function loadVehicleGeofences(vid: number) {
    try {
      const { data } = await api.get(`/vehicles/${vid}/geofence`, {
        params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }
      });
      const list = normalizeGeofences(data); // تک آبجکت را هم آرایه می‌کند
      setGeofencesByVid(p => ({ ...p, [vid]: list }));
      return list;
    } catch {
      setGeofencesByVid(p => ({ ...p, [vid]: [] }));
      return [];
    }
  }
  React.useEffect(() => {
    if (selectedVehicleId && canViolations) {
      refreshViolations(selectedVehicleId, fromISO, toISO);
    }
  }, [selectedVehicleId, canViolations, fromISO, toISO, refreshViolations]);


  const saveEditConsumable = async () => {
    if (!selectedVehicleId || !editingCons?.id) return;
    setSavingCons(true);
    try {
      const payload: any = { mode: editingCons.mode, note: (editingCons.note ?? '').trim() };
      if (editingCons.mode === 'time') {
        if (!editingCons.start_at) { alert('start_at لازم است'); setSavingCons(false); return; }
        payload.start_at = new Date(editingCons.start_at).toISOString();
      } else {
        const n = Number(editingCons.base_odometer_km);
        if (!Number.isFinite(n)) { alert('base_odometer_km معتبر نیست'); setSavingCons(false); return; }
        payload.base_odometer_km = n;
      }
      await updateConsumable(selectedVehicleId, editingCons.id, payload);
      await refreshConsumables(selectedVehicleId, true);
      closeEditConsumable();
    } catch (e: any) {
      console.error('PATCH /consumables failed:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'خطا در ویرایش آیتم روی سرور');
    } finally { setSavingCons(false); }
  };

  const deleteConsumable = async (c: any) => {
    if (!selectedVehicleId || !c?.id) return;
    if (!confirm('آیتم حذف شود؟')) return;
    try {
      await api.delete(`/vehicles/${selectedVehicleId}/consumables/${c.id}`);
      await refreshConsumables(selectedVehicleId, true);
      if (editingCons?.id === c.id) closeEditConsumable();
    } catch (e: any) {
      console.error('DELETE /consumables failed:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'حذف روی سرور ناموفق بود');
    }
  };

  const handleAddConsumable = async () => {
    if (!selectedVehicleId) return;
    try {
      const payload: any = { mode: consumableMode, note: (tripNote || '').trim() };
      if (consumableMode === 'time') {
        if (!tripDate) { alert('تاریخ لازم است'); return; }
        payload.start_at = new Date(tripDate).toISOString();
      } else {
        const base = Number(tripBaseKm ?? vehicleTlm.odometer);
        if (!Number.isFinite(base)) { alert('مقدار مبنا معتبر نیست'); return; }
        payload.base_odometer_km = base;
      }
      const { data } = await createConsumable(selectedVehicleId, payload);
      const [created] = normalizeConsumables([data]);
      setConsumablesByVid(prev => {
        const cur = prev[selectedVehicleId] || [];
        const next = created ? [created, ...cur] : cur;
        saveConsLocal(selectedVehicleId, next);
        return { ...prev, [selectedVehicleId]: next };
      });
      await refreshConsumables(selectedVehicleId, true);
      setConsumablesOpen(false);
      setTripNote(''); setTripBaseKm(null);
    } catch (err: any) {
      console.error('POST /consumables failed:', err?.response?.data || err);
      alert(err?.response?.data?.message || 'خطا در ذخیره لوازم مصرفی روی سرور');
    }
  };

  const handleTripReset = async () => {
    if (!selectedVehicleId) return;
    if (vehicleTlm.odometer == null) { alert('داده‌ی کیلومترشمار در دسترس نیست.'); return; }
    try {
      await api.post(`/vehicles/${selectedVehicleId}/trip/start`, {
        base_odometer_km: Number(vehicleTlm.odometer),
        started_at: (tripDate || new Date()).toISOString(),
        note: (tripNote || '').trim(),
      }).catch(() => { });
    } finally {
      setTripBaseKm(Number(vehicleTlm.odometer));
    }
  };


  const filteredDrivers = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return drivers;
    return drivers.filter(d =>
      (d.full_name || '').toLowerCase().includes(s) ||
      (d.phone || '').includes(s)
    );
  }, [drivers, q]);
  const filteredVehicles = React.useMemo(() => {
    if (!activeType) return [];
    const list = vehiclesByType[activeType] || [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(v => v.plate_no.toLowerCase().includes(s));
  }, [q, activeType, vehiclesByType]);
  const availableTypesKey = React.useMemo(
    () => (availableTypes.length ? [...availableTypes].sort().join(',') : ''),
    [availableTypes]
  );
  React.useEffect(() => {
    if (!parentSAId) return;
    const types = availableTypes.length
      ? availableTypes
      : (VEHICLE_TYPES.map((t) => t.code) as VehicleTypeCode[]); // fallback
    types.forEach((vt) => fetchVehiclesOfType(vt));
  }, [parentSAId, availableTypesKey, fetchVehiclesOfType]);

  // ===== Guards =====
  if (permsLoading || loading) {
    return <Box p={2} display="flex" alignItems="center" justifyContent="center">
      <CircularProgress size={24} />
    </Box>;
  }
  if (!can('view_report')) {
    return <Box p={2} color="text.secondary">دسترسی فعالی برای نمایش این صفحه برای شما تنظیم نشده است.</Box>;
  }

  const VIO_LABEL: Record<ViolationType, string> = {
    overspeed: 'سرعت غیرمجاز',
    speeding: 'سرعت غیرمجاز',
    route_deviation: 'انحراف از مسیر',
    geofence_in: 'ورود ژئوفنس',
    geofence_out: 'خروج ژئوفنس',
    geofence: 'ژئوفنس',
    idle_over: 'توقف طولانی',
    harsh_brake: 'ترمز شدید',
    harsh_accel: 'گاز شدید',
    harsh_turn: 'پیچ تند',
    ignition_on_off_hours: 'روشن/خاموش خارج از ساعات',
  };



  // ===== UI =====
  const typeLabel = (code: VehicleTypeCode) => VEHICLE_TYPES.find(t => t.code === code)?.label || code;
  // اطمینان از سابسکرایب شدن به ایستگاه‌های یک ماشین + اولین fetch
  const TOP_HEIGHT = '75vh';         // ارتفاع پنل‌های بالا (نقشه و سایدبار)
  const SHEET_HEIGHT = 420;          // ارتفاع Bottom Sheet
  const freezeProgrammaticZoom = (m?: any) => { }; // برای ساکت‌کردن TS در این فایل

  const gfKey = (gf: Geofence, idx: number) =>
    gf.id != null ? `gf-${gf.id}` : `gf-${gf.type}-${idx}`;
  return (
    <Grid2 container spacing={2} dir="ltr">


      {/* نقشه — چپ */}
      <Grid2 xs={12} md={8}>
        <Paper
          sx={{
            height: TOP_HEIGHT,                // همان الگوی بالا
            transition: 'height .28s ease',
            overflow: 'hidden',
            position: 'relative',
          }}
          dir="rtl"
        >
          <MapContainer
            zoom={INITIAL_ZOOM}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            whenCreated={(m: RLMap) => {
              // مطابق کد بالا: فیکس زوم برنامه‌ای + invalidate
              freezeProgrammaticZoom?.(m);
              setTimeout(() => m.invalidateSize(), 0);
            }}
            style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }}
          >
            {/* مرکز/زوم اولیه (حفظ منطق خودت) */}
            <InitView center={INITIAL_CENTER} zoom={INITIAL_ZOOM} />

            {/* کاشی‌ها */}
            <TileLayer url={tileUrl} {...({ attribution: '&copy; OpenStreetMap | © MapTiler' } as any)} />

            {/* فوکوس روی نقطه */}
            <FocusOn target={focusLatLng} />
            {/* کلیک‌گیرِ انتخاب نقاط مسیر */}
            <PickPointsForRoute enabled={canRouteEdit && drawingRoute} onPick={(lat, lng) => setRoutePoints(p => [...p, { lat, lng }])} />


            {/* پیش‌نمایش مسیر در حال ترسیم */}
            {drawingRoute && routePoints.length >= 1 && (
              <>
                <Polyline positions={routePoints.map(p => [p.lat, p.lng] as [number, number])}
                  pathOptions={{ color: '#00897b', weight: 4, opacity: 0.9 }} />
                {routePoints.map((p, i) => (
                  <Marker key={`draft-${i}`} position={[p.lat, p.lng]} icon={numberedIcon(i + 1) as any} />
                ))}
              </>
            )}

            {/* کلیک‌گیر ژئوفنس (بدون تغییر منطق) */}
            {activeType && canGeoFence && selectedVehicleId && (
              <PickPointsForGeofence
                enabled={canGeoFence && gfDrawing}
                onPick={(lat, lng) => {
                  if (gfMode === 'circle') setGfCenter({ lat, lng });
                  else setGfPoly(prev => [...prev, { lat, lng }]);
                }}
              />
            )}

            {/* لایه مسیر (نمایش بدون وابستگی به تیک ادیت؛ ادیت را تیک کنترل کند) */}
            <Pane name="route-layer" style={{ zIndex: 400 }}>
              {selectedVehicleId && <RouteLayer vid={selectedVehicleId} />}
            </Pane>

            {/* پیش‌نمایش ترسیم ژئوفنس (ظاهر همسان) */}
            {gfDrawing && gfMode === 'circle' && gfCenter && (
              <Circle center={[gfCenter.lat, gfCenter.lng]} radius={gfRadius} />
            )}
            {gfDrawing && gfMode === 'polygon' && gfPoly.length >= 2 && (
              <Polygon positions={gfPoly.map(p => [p.lat, p.lng] as [number, number])} />
            )}

            {/* ژئوفنس ذخیره‌شده از سرور */}
            {selectedVehicleId && (geofencesByVid[selectedVehicleId] || []).map((gf, idx) =>
              gf.type === 'circle'
                ? <Circle key={gfKey(gf, idx)} center={[gf.center.lat, gf.center.lng]} radius={gf.radius_m} />
                : <Polygon key={gfKey(gf, idx)} positions={gf.points.map(p => [p.lat, p.lng] as [number, number])} />
            )}

            {/* لایه راننده‌ها/ماشین‌ها با z-index بالاتر مثل بالا */}
            <Pane name="vehicles-layer" style={{ zIndex: 650 }}>
              {/* راننده‌ها + مسیر لحظه‌ای راننده (حفظ منطق) */}
              {tab === 'drivers' && canTrackDrivers && filteredDrivers.map(d => (d as any).last_location && (
                <Marker
                  key={`d-${d.id}`}
                  position={[(d as any).last_location.lat, (d as any).last_location.lng]}
                  icon={driverMarkerIcon as any}
                  zIndexOffset={1000}
                >
                  <Popup><strong>{d.full_name}</strong><br />{d.phone || '—'}</Popup>
                </Marker>
              ))}
              {tab === 'drivers' && canTrackDrivers && polyline.length > 1 && <Polyline positions={polyline} />}

              {/* ماشین‌ها */}
              {activeType && canTrackVehicles && filteredVehicles.map(v => v.last_location && (
                <Marker
                  key={`v-${v.id}`}
                  position={[v.last_location.lat, v.last_location.lng]}
                  icon={vehicleMarkerIcon as any}
                  zIndexOffset={1000}
                >
                  <Popup><strong>{v.plate_no}</strong><br />{v.vehicle_type_code}</Popup>
                </Marker>
              ))}
            </Pane>

            {/* کلیک‌گیر: ایجاد ایستگاه (همان منطق) */}
            <PickPointsForStations
              enabled={!!canStations && !!addingStationsForVid}
              onPick={(lat, lng) => setTempStation({ lat, lng })}
            />
            {/* ایستگاه‌های در حالت افزودن/ویرایش */}
            {!!addingStationsForVid && canStations && (vehicleStationsMap[addingStationsForVid] || []).map(st => (
              <React.Fragment key={`add-${st.id}`}>
                <Circle center={[st.lat, st.lng]} radius={st.radius_m ?? stationRadius} />
                <Marker position={[st.lat, st.lng]} />
              </React.Fragment>
            ))}

            {/* ایستگاه‌های ماشین انتخاب‌شده */}
            {selectedVehicleId && (vehicleStationsMap[selectedVehicleId] || []).map(st => (
              <React.Fragment key={`sel-${st.id}`}>
                <Circle center={[st.lat, st.lng]} radius={st.radius_m ?? stationRadius} />
                <Marker position={[st.lat, st.lng]} />
              </React.Fragment>
            ))}

            {/* مارکر موقت ایستگاه جدید */}
            {addingStationsForVid && tempStation && (
              <>
                <Circle center={[tempStation.lat, tempStation.lng]} radius={stationRadius} />
                <Marker
                  position={[tempStation.lat, tempStation.lng]}
                  draggable
                  eventHandlers={{
                    add: (e: any) => e.target.openPopup(),
                    dragend: (e: any) => {
                      const ll = e.target.getLatLng();
                      setTempStation({ lat: ll.lat, lng: ll.lng });
                    },
                  }}
                >
                  <Popup autoClose={false} closeOnClick={false} autoPan>
                    <div style={{ minWidth: 220 }}>
                      <strong>ایجاد ایستگاه</strong>
                      <div style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>می‌توانید مارکر را جابجا کنید.</div>
                      <div style={{ marginTop: 8 }}>
                        <input
                          style={{ width: '100%', padding: 6 }}
                          placeholder="نام ایستگاه"
                          value={tempName}
                          onChange={e => setTempName(e.target.value)}
                        />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button onClick={confirmTempStation}>تایید</button>
                        <button onClick={() => setTempStation(null)}>لغو</button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}

            {/* جابه‌جایی ایستگاه در حالت ادیت */}
            {editingStation && movingStationId === editingStation.st.id && (
              <>
                <Circle center={[editingStation.st.lat, editingStation.st.lng]} radius={editingStation.st.radius_m} />
                <Marker
                  position={[editingStation.st.lat, editingStation.st.lng]}
                  draggable
                  eventHandlers={{
                    dragend: (e: any) => {
                      const ll = e.target.getLatLng();
                      setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, lat: ll.lat, lng: ll.lng } }) : ed);
                    }
                  }}
                />
              </>
            )}

            {/* اوورلی شناور استایل‌شده (فقط UI؛ بدون دست‌کاری منطق فعلی) */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 2000,
                pointerEvents: 'none',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  transform: 'scale(1.2)',
                  transformOrigin: 'top left',
                  width: 'max-content',
                  pointerEvents: 'auto',
                }}
              >
                {/* نوار کوچک وضعیت/میانبرها (سادۀ امن؛ به stateهای موجود وصل) */}
                <Paper
                  sx={(t) => ({
                    p: 0.25,
                    borderRadius: 1.5,
                    border: `1px solid ${t.palette.divider}`,
                    bgcolor: `${t.palette.background.paper}C6`,
                    backdropFilter: 'blur(6px)',
                    boxShadow: '0 6px 16px rgba(0,0,0,.18)',
                    overflow: 'hidden',
                  })}
                >
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Chip
                      size="small"
                      icon={<span>🗂️</span> as any}
                      label={tab === 'drivers' ? 'راننده‌ها' : (activeType ? typeLabel(activeType) : '—')}
                      sx={{
                        fontWeight: 700,
                        '& .MuiChip-label': { px: 0.75, py: 0.25, fontSize: 10 },
                      }}
                    />
                    <Chip
                      size="small"
                      icon={<span>📍</span> as any}
                      label={selectedVehicleId ? `VID: ${selectedVehicleId}` : 'ماشین: —'}
                      sx={{
                        border: '1px solid #00c6be55',
                        bgcolor: '#00c6be18',
                        color: '#009e97',
                        '& .MuiChip-label': { px: 0.75, py: 0.25, fontSize: 10 },
                      }}
                    />
                    {/* فقط سوییچ‌های موجود در همین کد؛ بدون اضافه‌کردن هندلر جدید */}
                    <Button
                      size="small"
                      variant={gfDrawing ? 'contained' : 'outlined'}
                      onClick={() => setGfDrawing(v => !v)}
                      disabled={!canGeoFence}
                      sx={{
                        borderRadius: 999,
                        px: 0.9,
                        minHeight: 22,
                        fontSize: 10,
                        borderColor: '#00c6be66',
                        ...(gfDrawing
                          ? { bgcolor: '#00c6be', '&:hover': { bgcolor: '#00b5ab' } }
                          : { '&:hover': { bgcolor: '#00c6be12' } }),
                        boxShadow: gfDrawing ? '0 4px 12px #00c6be44' : 'none',
                      }}
                      startIcon={<span>✏️</span>}
                    >
                      {gfDrawing ? 'پایان ژئوفنس' : 'ترسیم ژئوفنس'}
                    </Button>
                  </Stack>
                </Paper>
              </Box>
            </Box>

            {/* دیالوگ ویرایش مصرفی (همان مکان/منطق خودت) */}
            <Dialog open={!!editingCons} onClose={() => setEditingCons(null)} fullWidth maxWidth="sm">
              <DialogTitle>ویرایش آیتم مصرفی</DialogTitle>
              <DialogContent dividers>
                <Stack spacing={2}>
                  <TextField
                    label="توضیح/یادداشت"
                    value={editingCons?.note ?? ''}
                    onChange={(e) => setEditingCons((p: any) => ({ ...p, note: e.target.value }))}
                    fullWidth
                  />
                  <RadioGroup
                    row
                    value={editingCons?.mode ?? 'km'}
                    onChange={(_, v) =>
                      setEditingCons((p: any) => ({
                        ...p,
                        mode: v as 'km' | 'time',
                        start_at: v === 'time' ? (p?.start_at ?? new Date().toISOString()) : null,
                        base_odometer_km: v === 'km' ? (p?.base_odometer_km ?? 0) : null,
                      }))
                    }
                  >
                    <FormControlLabel value="km" control={<Radio />} label="بر اساس کیلومتر" />
                    <FormControlLabel value="time" control={<Radio />} label="بر اساس زمان" />
                  </RadioGroup>
                  {editingCons?.mode === 'time' ? (
                    <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                      <DateTimePicker<Date>
                        label="تاریخ یادآوری"
                        value={editingCons?.start_at ? new Date(editingCons.start_at) : null}
                        onChange={(val) => setEditingCons((p: any) => ({ ...p, start_at: val ? new Date(val).toISOString() : null }))}
                        ampm={false}
                        slotProps={{ textField: { fullWidth: true } }}
                        format="yyyy/MM/dd HH:mm"
                      />
                    </LocalizationProvider>
                  ) : (
                    <TextField
                      label="مقدار مبنا (کیلومتر)"
                      type="number"
                      value={editingCons?.base_odometer_km ?? ''}
                      onChange={(e) => setEditingCons((p: any) => ({ ...p, base_odometer_km: e.target.value ? Number(e.target.value) : null }))}
                      fullWidth
                    />
                  )}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditingCons(null)}>انصراف</Button>
                <Button variant="contained" onClick={saveEditConsumable} disabled={!canConsumables || savingCons}>ذخیره</Button>
              </DialogActions>
            </Dialog>

            {/* Snackbar (بدون تغییر منطق) */}
            {toast?.open && (
              <Snackbar
                open={toast.open}
                autoHideDuration={6000}
                onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              >
                <Alert severity="warning" onClose={() => setToast(null)} sx={{ width: '100%' }}>
                  {toast.msg}
                </Alert>
              </Snackbar>
            )}

          </MapContainer>
        </Paper>
      </Grid2>

      {/* سایدبار — راست (فقط ظاهر همسان با کارت/باکس‌ها و فاصله‌ها) */}
      <Grid2 xs={12} md={4}>
        <Paper
          sx={(t) => ({
            p: 2,
            height: TOP_HEIGHT,
            '& .leaflet-pane, & .leaflet-top, & .leaflet-bottom': { zIndex: 0 },
            display: 'flex',
            transition: 'height .28s ease',
            flexDirection: 'column',
            border: `1px solid ${t.palette.divider}`,
            borderRadius: 2,
            bgcolor: t.palette.background.paper,
          })}
          dir="rtl"
        >
          {/* بازه زمانی */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="preset-lbl">بازه</InputLabel>
              <Select labelId="preset-lbl" value={preset} label="بازه" onChange={(e) => setPreset(e.target.value as any)}>
                <MenuItem value="today">امروز</MenuItem>
                <MenuItem value="yesterday">دیروز</MenuItem>
                <MenuItem value="7d">۷ روز اخیر</MenuItem>
                <MenuItem value="custom">دلخواه</MenuItem>
              </Select>
            </FormControl>
            {preset === 'custom' && (
              <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                <DateTimePicker
                  label="از"
                  value={new Date(fromISO)}
                  onChange={(v) => v && setFromISO(new Date(v).toISOString())}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <DateTimePicker
                  label="تا"
                  value={new Date(toISO)}
                  onChange={(v) => v && setToISO(new Date(v).toISOString())}
                  slotProps={{ textField: { size: 'small' } }}
                />
              </LocalizationProvider>
            )}
          </Stack>

          {/* تب‌ها با استایل مشابه */}
          <Tabs
            value={tab}
            onChange={(_, v) => { setTab(v); setQ(''); setPolyline([]); setAddingStationsForVid(null); setTempStation(null); setEditingStation(null); setMovingStationId(null); }}
            sx={{
              mb: 1,
              minHeight: 36,
              '& .MuiTab-root': { minHeight: 36 },
              '& .MuiTabs-indicator': { backgroundColor: ACC },
              '& .MuiTab-root.Mui-selected': { color: ACC, fontWeight: 700 },
            }}
          >
            <Tab value="drivers" label="راننده‌ها" />
            {typesWithGrants.map(vt => (
              <Tab key={vt} value={vt} label={typeLabel(vt)} />
            ))}
          </Tabs>

          {/* قابلیت‌های تب فعال */}
          {activeType && (
            <Box sx={{ mb: 1.5, p: 1, border: (t) => `1px dashed ${t.palette.divider}`, borderRadius: 1 }}>
              {(grantedPerType[activeType] || []).length ? (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip size="small" color="primary" label={typeLabel(activeType)} />
                  {(grantedPerType[activeType] || []).map(k => (
                    <Chip key={`${activeType}-${k}`} size="small" variant="outlined"
                      label={MONITOR_PARAMS.find(m => m.key === k)?.label || k} />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  برای این نوع خودرو قابلیتی فعال نشده.
                </Typography>
              )}
            </Box>
          )}

          {/* تله‌متری لحظه‌ای (فقط استایل کارت‌ها) */}


          {/* جستجو با افکت فوکوس شبیه بالا */}
          <TextField
            size="small"
            placeholder={tab === 'drivers' ? 'جستجو نام/موبایل' : 'جستجو پلاک'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 1.25,
              '& .MuiOutlinedInput-root': {
                transition: 'border-color .2s ease, box-shadow .2s ease',
                '& fieldset': { borderColor: 'divider' },
                '&:hover fieldset': { borderColor: ACC },
                '&.Mui-focused': {
                  '& fieldset': { borderColor: ACC },
                  boxShadow: `0 0 0 3px ${ACC}22`,
                },
              },
            }}
          />

          {/* بادی لیست (همان منطق قبلی؛ فقط محیط کنتینر) */}
          <List sx={{ overflow: 'auto', flex: 1 }}>
            {/* ... کل بلوک لیست راننده/ماشینِ خودت بدون تغییر منطق ... */}
            {/* منطق موجودت از همینجا ادامه دارد */}
            {/* === راننده‌ها === */}
            {tab === 'drivers' ? (
              filteredDrivers.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 1 }}>نتیجه‌ای یافت نشد.</Typography>
              ) : filteredDrivers.map(d => {
                const s = statsMap[d.id] || {};
                return (
                  <ListItem
                    key={d.id}
                    divider
                    onClick={() => onPickDriver(d)}   // 👈 قبلاً فقط فوکوس می‌داد

                    secondaryAction={
                      <Stack direction="row" spacing={1}>
                        <Tooltip title={canTrackDrivers ? '' : 'دسترسی ردیابی ندارید'}>
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={async (ev) => {
                                ev.stopPropagation();
                                onPickDriver(d);                 // بازشدن شیت + انتخاب راننده
                                await trackByDriverId(d.id, fromISO, toISO);   // ⬅️ این خط مهم است
                                // اگر دوست دارید ماشین فعلی راننده هم در سایدبار انتخاب شود (اختیاری):
                                const vid = await getDriverCurrentVehicleId(d.id).catch(() => null);
                                if (vid) setSelectedVehicleId(vid);
                              }}
                            >
                              ردیابی
                            </Button>

                          </span>
                        </Tooltip>
                      </Stack>
                    }
                  >
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                      <Avatar>{d.full_name?.charAt(0) ?? 'ر'}</Avatar>
                      <Box sx={{ flex: 1 }}>
                        <ListItemText primary={d.full_name} secondary={d.phone || '—'} />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .25 }}>
                          مسافت: {s.totalDistanceKm ?? '—'} km | مدت: {s.totalDurationMin ?? '—'} min | ماموریت: {s.jobsCount ?? '—'} | خرابی: {s.breakdownsCount ?? '—'}
                        </Typography>
                      </Box>
                    </Stack>
                  </ListItem>
                );
              })
            ) : (
              // === ماشین‌ها ===
              // === ماشین‌ها ===
              (filteredVehicles.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 1 }}>ماشینی یافت نشد.</Typography>
              ) : filteredVehicles.map(v => {
                const stations = vehicleStationsMap[v.id] || [];
                const isEditingBlock = editingStation?.vid === v.id;

                return (
                  <Box key={v.id} sx={{ pb: 1 }}>
                    <ListItem
                      key={v.id}
                      divider
                      onClick={() => onPickVehicleBM(v)}
                      secondaryAction={
                        <Stack direction="row" spacing={0.5}>
                          {v.last_location && (
                            <IconButton
                              size="small"
                              title="نمایش روی نقشه"
                              onClick={(e) => { e.stopPropagation(); setFocusLatLng([v.last_location!.lat, v.last_location!.lng]); }}
                            >📍</IconButton>
                          )}







                        </Stack>
                      }
                    >
                      {routeBusyByVid[v.id] === 'loading' && (
                        <Typography variant="caption" color="text.secondary">در حال بارگذاری مسیر…</Typography>
                      )}
                      {routeMetaByVid[v.id] && (
                        <Typography variant="caption" color="text.secondary">
                          مسیر فعلی: {routeMetaByVid[v.id]?.name ?? `#${routeMetaByVid[v.id]?.id}`}
                          {routeMetaByVid[v.id]?.threshold_m ? ` — آستانه: ${routeMetaByVid[v.id]?.threshold_m} m` : ''}
                        </Typography>
                      )}

                      <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                        <Avatar>{v.plate_no?.charAt(0) ?? 'م'}</Avatar>
                        <Box sx={{ flex: 1 }}>
                          <ListItemText primary={v.plate_no} secondary={typeLabel(v.vehicle_type_code)} />
                        </Box>
                      </Stack>
                    </ListItem>





                  </Box>
                );
              }))

            )}
          </List>

          {/* دیالوگ افزودن/تنظیم مصرفی (همان منطق) */}
          <Dialog open={consumablesOpen} onClose={() => setConsumablesOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>لوازم مصرفی / مسافت از آخرین صفر</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <TextField label="توضیح/یادداشت" value={tripNote} onChange={(e) => setTripNote(e.target.value)} fullWidth />
                <RadioGroup row value={consumableMode} onChange={(_, v) => setConsumableMode((v as 'time' | 'km') ?? 'km')}>
                  <FormControlLabel value="km" control={<Radio />} label="بر اساس کیلومتر" />
                  <FormControlLabel value="time" control={<Radio />} label="بر اساس زمان" />
                </RadioGroup>
                {consumableMode === 'time' ? (
                  <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                    <DateTimePicker<Date>
                      label="تاریخ یادآوری"
                      value={tripDate}
                      onChange={(val) => setTripDate(val)}
                      ampm={false}
                      slotProps={{ textField: { fullWidth: true } }}
                      format="yyyy/MM/dd HH:mm"
                    />
                  </LocalizationProvider>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">کیلومترشمار فعلی:</Typography>
                        <Typography variant="h6">
                          {vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}
                        </Typography>
                      </Stack>
                      <TextField
                        label="مقدار مبنا (از آخرین صفر)"
                        type="number"
                        value={tripBaseKm ?? ''}
                        onChange={(e) => setTripBaseKm(e.target.value ? Number(e.target.value) : null)}
                        fullWidth
                      />
                      {!canOdometer && (
                        <Typography sx={{ mt: 1 }} variant="caption" color="warning.main">
                          برای به‌روزرسانی زنده، «کیلومترشمار» باید در سیاست‌های این نوع فعال باشد.
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConsumablesOpen(false)}>بستن</Button>
              {consumableMode === 'km' && (
                <Button variant="outlined" onClick={handleTripReset} disabled={vehicleTlm.odometer == null || !selectedVehicleId}>
                  صفر کردن از الان
                </Button>
              )}
              <Button variant="contained" onClick={handleAddConsumable} disabled={consumableMode === 'time' && !tripDate}>
                افزودن
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      </Grid2>
      {/* === ردیف سوم: پنل پایینی (Bottom Sheet) === */}
      <Grid2 xs={12}>
        <Collapse in={sheetOpen} timeout={320} unmountOnExit>
          <Paper
            dir="rtl"
            sx={(t) => ({
              position: 'relative',
              minHeight: SHEET_HEIGHT,
              p: 2,
              borderRadius: 3,
              overflow: 'hidden',
              border: `1px solid ${t.palette.divider}`,
              boxShadow: t.palette.mode === 'dark'
                ? '0 20px 60px rgba(0,0,0,.45)'
                : '0 20px 60px rgba(0,0,0,.15)',
              background: `linear-gradient(180deg, ${t.palette.background.paper} 0%, ${t.palette.background.default} 100%)`,
            })}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              {/* هدر شیت */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip
                    size="medium"
                    icon={<span>{sheetMode === 'driver' ? '🧑‍✈️' : '🚘'}</span> as any}
                    label={
                      <Typography component="span" sx={{ fontWeight: 800 }}>
                        {sheetMode === 'driver'
                          ? `راننده: ${selectedDriverId
                            ? (filteredDrivers.find(x => x.id === selectedDriverId)?.full_name ?? `#${selectedDriverId}`)
                            : '—'}`
                          : `ماشین: ${selectedVehicleId
                            ? (filteredVehicles.find(v => v.id === selectedVehicleId)?.plate_no ?? `#${selectedVehicleId}`)
                            : '—'}`}
                      </Typography>
                    }
                  />

                  {/* اگر دادهٔ تله‌متری داری، مثل بالا چند چیپ دیگر هم می‌تونی نشان بدهی */}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" onClick={() => setSheetOpen(false)}>بستن</Button>
                </Stack>
              </Stack>

              {/* اکشن‌های سریع (اختیاری) */}
              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                {selectedVehicleId && (
                  <>
                    {filteredVehicles.find(v => v.id === selectedVehicleId)?.last_location && (
                      <Button
                        size="small"
                        onClick={() => {
                          const ll = filteredVehicles.find(v => v.id === selectedVehicleId)!.last_location!;
                          setFocusLatLng([ll.lat, ll.lng]);
                        }}
                        startIcon={<span>🎯</span>}
                      >
                        مرکز روی ماشین
                      </Button>
                    )}

                  </>
                )}
              </Stack>
              {/* === تعریف مسیر جدید === */}
              {sheetMode !== 'driver' && (

                <Paper sx={{ p: 1, mt: 1, border: (t) => `1px dashed ${t.palette.divider}` }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>تعریف مسیر جدید</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <TextField
                      size="small"
                      label="نام مسیر"
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      sx={{ minWidth: 180 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Threshold (m)"
                      value={routeThreshold}
                      onChange={(e) => setRouteThreshold(Math.max(1, Number(e.target.value || 0)))}
                      sx={{ width: 150 }}
                    />
                    <Button size="small" variant={drawingRoute ? 'contained' : 'outlined'} onClick={() => setDrawingRoute(v => !v)} disabled={!canRouteEdit}>
                      {drawingRoute ? 'پایان ترسیم' : 'شروع ترسیم روی نقشه'}
                    </Button>
                    <Button size="small" onClick={() => setRoutePoints(pts => pts.slice(0, -1))} disabled={!canRouteEdit || !routePoints.length}>برگشت نقطه</Button>
                    <Button size="small" onClick={() => setRoutePoints([])} disabled={!canRouteEdit || !routePoints.length}>پاک‌کردن</Button>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!canRouteEdit || routePoints.length < 2 || !selectedVehicleId}
                      onClick={() => saveRouteAndFenceForVehicle({ vehicleId: selectedVehicleId!, name: (routeName || '').trim() || `مسیر ${new Date().toLocaleDateString('fa-IR')}`, threshold_m: Math.max(1, Number(routeThreshold || 0)), points: routePoints, toleranceM: 15 })}
                    >
                      ذخیره مسیر
                    </Button>




                  </Stack>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    روی نقشه کلیک کن تا نقاط مسیر به‌ترتیب اضافه شوند. برای ذخیره حداقل ۲ نقطه لازم است.
                  </Typography>
                </Paper>
              )}

              {/* === سکشن‌ها: از منطق خودت استفاده می‌کنیم ولی بر اساس selectedVehicleId === */}
              {sheetMode !== 'driver' && selectedVehicleId && (

                <Grid2 container spacing={1.25}>
                  {/* مسیر */}


                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>
                      مسیر
                    </Typography>

                    {/* وضعیت مسیر فعلی */}
                    {routeBusyByVid[selectedVehicleId] === 'loading' && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        در حال بارگذاری مسیر…
                      </Typography>
                    )}
                    {routeMetaByVid[selectedVehicleId] && (
                      <Paper sx={{ p: 1, mb: 1, border: (t) => `1px solid ${t.palette.divider}` }}>
                        <Typography variant="body2" color="text.secondary">مسیر فعلی</Typography>
                        <Typography variant="body1">
                          {routeMetaByVid[selectedVehicleId]?.name ?? `#${routeMetaByVid[selectedVehicleId]?.id}`}
                          {routeMetaByVid[selectedVehicleId]?.threshold_m
                            ? ` — آستانه: ${routeMetaByVid[selectedVehicleId]?.threshold_m} m`
                            : ''}
                        </Typography>
                      </Paper>
                    )}

                    {/* اکشن‌ها */}
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={async () => {
                          await loadVehicleRoute(selectedVehicleId);
                        }}
                      >
                        نمایش/تازه‌سازی مسیر
                      </Button>

                      <Tooltip title={canRouteEdit ? '' : 'اجازهٔ ویرایش مسیر ندارید'}>
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={!canRouteEdit}
                            onClick={async () => {
                              const routes = await listVehicleRoutes(selectedVehicleId);
                              if (!routes.length) { alert('مسیری برای این خودرو پیدا نشد.'); return; }
                              const nameList = routes.map(r => `${r.id} — ${r.name ?? 'بدون نام'}`).join('\n');
                              const pick = prompt(`Route ID را وارد کنید:\n${nameList}`, String(routes[0].id));
                              const rid = Number(pick);
                              if (!Number.isFinite(rid)) return;

                              try {
                                await setOrUpdateVehicleRoute(selectedVehicleId, { route_id: rid });
                                await loadVehicleRoute(selectedVehicleId);
                              } catch (err: any) {
                                console.error(err?.response?.data || err);
                                alert(err?.response?.data?.message || 'ثبت مسیر ناموفق بود');
                              }
                            }}
                          >
                            انتخاب مسیر
                          </Button>
                        </span>
                      </Tooltip>

                      <Tooltip title={canRouteEdit ? '' : 'اجازهٔ ویرایش مسیر ندارید'}>
                        <span>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={!canRouteEdit}
                            onClick={async () => {
                              if (!confirm('مسیر فعلی از این خودرو برداشته شود؟')) return;
                              try {
                                await clearVehicleRoute(selectedVehicleId);
                              } catch { }
                              setRouteMetaByVid(p => ({ ...p, [selectedVehicleId]: null }));
                              setRoutePolylineByVid(p => ({ ...p, [selectedVehicleId]: [] }));
                            }}
                          >
                            حذف مسیر
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Grid2>


                  {/* ایستگاه‌ها */}
                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>ایستگاه‌ها</Typography>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <TextField
                        size="small" type="number" label="شعاع (m)" value={stationRadius}
                        onChange={(e) => setStationRadius(Math.max(1, Number(e.target.value || 0)))} sx={{ width: 130 }}
                      />
                      {canStations && (
                        <Button
                          size="small"
                          variant={addingStationsForVid === selectedVehicleId ? 'contained' : 'outlined'}
                          onClick={() => startAddingStationsFor(selectedVehicleId)}
                          disabled={!canStations}
                        >
                          {addingStationsForVid === selectedVehicleId ? 'پایان افزودن' : 'ایجاد ایستگاه'}
                        </Button>
                      )}
                    </Stack>

                    {(() => {
                      const stations = vehicleStationsMap[selectedVehicleId] || [];
                      const isEditingBlock = editingStation?.vid === selectedVehicleId;

                      return stations.length ? (
                        <List dense sx={{ maxHeight: 240, overflow: 'auto' }}>
                          {stations.map(st => {
                            const isEditing = isEditingBlock && editingStation?.st.id === st.id;
                            return (
                              <Box key={st.id}>
                                <ListItem
                                  disableGutters
                                  secondaryAction={
                                    <Stack direction="row" spacing={0.5}>
                                      <IconButton size="small" title="نمایش روی نقشه" disabled={!canStations} onClick={() => setFocusLatLng([st.lat, st.lng])}>📍</IconButton>
                                      <IconButton
                                        size="small"
                                        title="ویرایش"
                                        onClick={() => {
                                          if (isEditing) { setEditingStation(null); setMovingStationId(null); }
                                          else { setEditingStation({ vid: selectedVehicleId, st: { ...st } }); setMovingStationId(null); }
                                        }}
                                        disabled={!canStations}
                                      >✏️</IconButton>
                                      <IconButton size="small" color="error" title="حذف" disabled={!canStations} onClick={() => deleteStation(selectedVehicleId, st)}>🗑️</IconButton>
                                    </Stack>
                                  }
                                >
                                  <ListItemText primary={st.name} secondary={`${st.lat.toFixed(5)}, ${st.lng.toFixed(5)}`} />
                                </ListItem>

                                <Collapse in={isEditing} timeout="auto" unmountOnExit>
                                  <Box sx={{ mx: 1.5, mt: .5, p: 1.25, bgcolor: 'action.hover', borderRadius: 1, border: (t) => `1px solid ${t.palette.divider}` }}>
                                    <Stack spacing={1.25}>
                                      <TextField
                                        size="small" label="نام" value={editingStation?.st.name ?? ''}
                                        onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, name: e.target.value } }) : ed)}
                                      />
                                      <TextField
                                        size="small" type="number" label="شعاع (m)" value={editingStation?.st.radius_m ?? 0}
                                        onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, radius_m: Math.max(1, Number(e.target.value || 0)) } }) : ed)}
                                      />
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <Button size="small" variant={movingStationId === st.id ? 'contained' : 'outlined'} onClick={() => setMovingStationId(movingStationId === st.id ? null : st.id)}>جابجایی روی نقشه</Button>
                                        <Box flex={1} />
                                        <Button size="small" onClick={() => { setEditingStation(null); setMovingStationId(null); }}>انصراف</Button>
                                        <Button size="small" variant="contained" onClick={saveEditStation}>ذخیره</Button>
                                      </Stack>
                                    </Stack>
                                  </Box>
                                </Collapse>

                                <Divider sx={{ mt: 1 }} />
                              </Box>
                            );
                          })}
                        </List>
                      ) : (
                        <Typography color="text.secondary">ایستگاهی تعریف نشده.</Typography>
                      );
                    })()}
                  </Grid2>

                  {/* ژئوفنس */}
                  {canGeoFence && (
                    <Grid2 xs={12} md={6} lg={4}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>ژئوفنس</Typography>

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <InputLabel id="gf-mode-lbl">حالت</InputLabel>
                          <Select
                            labelId="gf-mode-lbl"
                            label="حالت"
                            value={gfMode}
                            onChange={(e) => { setGfMode(e.target.value as 'circle' | 'polygon'); setGfCenter(null); setGfPoly([]); }}
                          >
                            <MenuItem value="circle">دایره‌ای</MenuItem>
                            <MenuItem value="polygon">چندضلعی</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          size="small" type="number" label="تلورانس (m)" value={gfTolerance}
                          onChange={(e) => setGfTolerance(Math.max(0, Number(e.target.value || 0)))}
                          sx={{ width: 130 }}
                        />

                        <Button
                          size="small"
                          variant={gfDrawing ? 'contained' : 'outlined'}
                          onClick={() => setGfDrawing(v => !v)}
                          disabled={!canGeoFence}
                        >
                          {gfDrawing ? 'پایان ترسیم' : 'ترسیم روی نقشه'}
                        </Button>

                        {gfMode === 'polygon' && (
                          <>
                            <Button size="small" onClick={() => setGfPoly(pts => pts.slice(0, -1))}
                              disabled={!canGeoFence || !gfPoly.length}>
                              برگشت نقطه
                            </Button>
                            <Button size="small" onClick={() => setGfPoly([])}
                              disabled={!canGeoFence || !gfPoly.length}>
                              پاک‌کردن نقاط
                            </Button>
                          </>
                        )}

                        {gfMode === 'circle' && (
                          <TextField
                            size="small" type="number" label="شعاع (m)" value={gfRadius}
                            onChange={(e) => setGfRadius(Math.max(1, Number(e.target.value || 0)))}
                            sx={{ width: 130 }}
                            disabled={!canGeoFence}
                          />
                        )}

                        <Button
                          size="small"
                          variant="contained"
                          onClick={saveGeofenceBM}
                          disabled={!canGeoFence}
                        >
                          ذخیره ژئوفنس
                        </Button>

                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={deleteGeofenceBM}
                          disabled={!canGeoFence || !selectedVehicleId || (geofencesByVid[selectedVehicleId]?.length ?? 0) === 0}
                        >
                          حذف ژئوفنس
                        </Button>



                      </Stack>

                      <Typography variant="caption" color="text.secondary">
                        {gfMode === 'circle'
                          ? 'روی نقشه کلیک کنید تا مرکز دایره انتخاب شود، سپس شعاع را تنظیم و ذخیره کنید.'
                          : 'روی نقشه کلیک کنید تا نقاط چندضلعی به‌ترتیب اضافه شوند (حداقل ۳ نقطه).'}
                      </Typography>
                    </Grid2>
                  )}


                  {/* تله‌متری زنده */}
                  {activeType && (canIgnition || canIdleTime || canOdometer) && (
                    <Grid2 xs={12} md={6} lg={4}>
                      <Stack spacing={1} sx={{ mb: 1.5 }}>
                        {canIgnition && (
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">وضعیت سوئیچ</Typography>
                            <Typography variant="h6">
                              {vehicleTlm.ignition === true ? 'موتور روشن است'
                                : vehicleTlm.ignition === false ? 'موتور خاموش است' : 'نامشخص'}
                            </Typography>
                          </Paper>
                        )}
                        {canIdleTime && (
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">مدت توقف/سکون</Typography>
                            <Typography variant="h6">
                              {vehicleTlm.idle_time != null
                                ? `${vehicleTlm.idle_time.toLocaleString('fa-IR')} ثانیه`
                                : '—'}
                            </Typography>
                          </Paper>
                        )}
                        {canOdometer && (
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">کیلومترشمار</Typography>
                            <Typography variant="h6">
                              {vehicleTlm.odometer != null
                                ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km`
                                : 'نامشخص'}
                            </Typography>
                          </Paper>
                        )}
                      </Stack>
                    </Grid2>
                  )}

                  {/* لوازم مصرفی */}
                  {canConsumables && (
                    <Grid2 xs={12} lg={4}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>لوازم مصرفی</Typography>
                        <Tooltip title={canConsumables ? 'افزودن' : 'دسترسی ندارید'}>
                          <span>
                            <IconButton size="small" onClick={() => setConsumablesOpen(true)} disabled={!canConsumables}>＋</IconButton>
                          </span>
                        </Tooltip>
                        <Box flex={1} />
                        <Typography variant="caption" color="text.secondary">
                          کیلومترشمار: {vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}
                        </Typography>
                      </Stack>

                      {(() => {
                        const consStatus = consStatusByVid[selectedVehicleId];
                        const consList = consumablesByVid[selectedVehicleId] || [];
                        if (consStatus === 'loading') {
                          return (
                            <Box display="flex" alignItems="center" gap={1} color="text.secondary" sx={{ mt: .5 }}>
                              <CircularProgress size={16} /> در حال دریافت…
                            </Box>
                          );
                        }
                        if (consStatus === 'error') return <Typography color="warning.main">خطا در دریافت. دوباره تلاش کنید.</Typography>;
                        if (!consList.length) return <Typography color="text.secondary">آیتمی ثبت نشده.</Typography>;
                        return (
                          <List dense sx={{ maxHeight: 240, overflow: 'auto' }}>
                            {consList.map((c: any, i: number) => (
                              <ListItem
                                key={c.id ?? i}
                                divider
                                secondaryAction={
                                  <Stack direction="row" spacing={0.5}>
                                    <span>
                                      <IconButton
                                        size="small"
                                        title="ویرایش"
                                        onClick={() => openEditConsumable(c)}
                                        disabled={!canConsumables}
                                      >✏️</IconButton>
                                    </span>
                                    <span>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        title="حذف"
                                        onClick={() => deleteConsumable(c)}
                                        disabled={!canConsumables}
                                      >🗑️</IconButton>
                                    </span>
                                  </Stack>
                                }
                              >
                                <ListItemText
                                  primary={c.title ?? c.note ?? 'آیتم'}
                                  secondary={
                                    <>
                                      {c.mode === 'km' ? 'بر اساس کیلومتر' : 'بر اساس زمان'}
                                      {c.created_at && <> — {new Date(c.created_at).toLocaleDateString('fa-IR')}</>}
                                    </>
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                        );
                      })()}
                    </Grid2>
                  )}
                </Grid2>
              )}



              {!selectedVehicleId && (
                <Typography color="text.secondary">برای مشاهده تنظیمات، یک ماشین را از لیست انتخاب کنید.</Typography>
              )}
              {sheetMode === 'driver' && selectedDriverId && (
                <Grid2 container spacing={1.25}>
                  {/* اکشن‌های راننده */}
                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>اکشن‌های راننده</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          const d = filteredDrivers.find(x => x.id === selectedDriverId);
                          const ll = (d as any)?.last_location;
                          if (ll) setFocusLatLng([ll.lat, ll.lng]);
                        }}
                        startIcon={<span>🎯</span>}
                      >
                        مرکز روی راننده
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => loadDriverTrack(selectedDriverId)}
                      >
                        نمایش مسیر/ردیابی
                      </Button>
                    </Stack>
                  </Grid2>

                  {/* تله‌متری و آمار راننده */}
                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>وضعیت لحظه‌ای و آمار</Typography>
                    {(() => {
                      const d = filteredDrivers.find(x => x.id === selectedDriverId);
                      const stats = statsMap[selectedDriverId] || {};
                      const ll = (d as any)?.last_location;
                      const tlm = (d as any)?.telemetry || (d as any)?.tlm || {};
                      const ignition = tlm.ignition === true ? 'موتور روشن است'
                        : tlm.ignition === false ? 'موتور خاموش است'
                          : 'نامشخص';
                      const idleTime =
                        tlm.idle_time != null ? `${Number(tlm.idle_time).toLocaleString('fa-IR')} ثانیه` : '—';

                      return (
                        <Stack spacing={1.25} sx={{ mb: 1.5 }}>
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Box>
                                <Typography variant="body2" color="text.secondary">موقعیت فعلی</Typography>
                                <Typography variant="h6">
                                  {ll ? `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}` : 'نامشخص'}
                                </Typography>
                              </Box>
                              <Button
                                size="small"
                                disabled={!ll}
                                onClick={() => ll && setFocusLatLng([ll.lat, ll.lng])}
                                startIcon={<span>🎯</span>}
                              >
                                مرکز
                              </Button>
                            </Stack>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">وضعیت سوئیچ</Typography>
                            <Typography variant="h6">{ignition}</Typography>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">مدت توقف/سکون</Typography>
                            <Typography variant="h6">{idleTime}</Typography>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">مسافت پیموده‌شده (بازه)</Typography>
                            <Typography variant="h6">
                              {stats.totalDistanceKm != null
                                ? `${Number(stats.totalDistanceKm).toLocaleString('fa-IR')} km`
                                : '—'}
                            </Typography>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">مدت کار (بازه)</Typography>
                            <Typography variant="h6">
                              {stats.totalDurationMin != null
                                ? `${Number(stats.totalDurationMin).toLocaleString('fa-IR')} دقیقه`
                                : '—'}
                            </Typography>
                          </Paper>

                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">تعداد مأموریت</Typography>
                            <Typography variant="h6">
                              {stats.jobsCount != null ? Number(stats.jobsCount).toLocaleString('fa-IR') : '—'}
                            </Typography>
                          </Paper>
                        </Stack>
                      );
                    })()}
                  </Grid2>

                  {/* تخلفات راننده در بازه انتخابی */}
                  <Grid2 xs={12} md={12} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>تخلفات راننده در بازه انتخابی</Typography>
                    {vioStatusByDid[selectedDriverId] === 'loading' && (
                      <Box display="flex" alignItems="center" gap={1} color="text.secondary" sx={{ mt: .5 }}>
                        <CircularProgress size={16} /> در حال دریافت…
                      </Box>
                    )}
                    {vioStatusByDid[selectedDriverId] === 'error' && (
                      <Typography color="warning.main">خطا در دریافت تخلفات راننده.</Typography>
                    )}
                    {(() => {
                      const list = (violationsByDid[selectedDriverId] || [])
                        .filter(v => violationFilter === 'all' || v.type === violationFilter);
                      if (!list.length && vioStatusByDid[selectedDriverId] === 'loaded') {
                        return <Typography color="text.secondary">موردی یافت نشد.</Typography>;
                      }
                      return (
                        <List dense sx={{ maxHeight: 260, overflow: 'auto' }}>
                          {list.map((v, i) => (
                            <ListItem
                              key={v.id ?? i}
                              divider
                              onClick={() => v.meta?.point && setFocusLatLng([v.meta.point.lat, v.meta.point.lng])}
                              secondaryAction={
                                v.meta?.point && (
                                  <IconButton
                                    size="small"
                                    title="نمایش روی نقشه"
                                    onClick={(e) => { e.stopPropagation(); setFocusLatLng([v.meta!.point!.lat, v.meta!.point!.lng]); }}
                                  >📍</IconButton>
                                )
                              }
                            >
                              <ListItemText
                                primary={`${new Date(v.created_at).toLocaleString('fa-IR')} — ${v.type}`}
                                secondary={
                                  <>
                                    {v.meta?.distance_m && `فاصله: ${v.meta.distance_m} m `}
                                    {v.meta?.threshold_m && `— آستانه: ${v.meta.threshold_m} m`}
                                  </>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      );
                    })()}
                  </Grid2>
                </Grid2>
              )}

            </Box>
          </Paper>
        </Collapse>
      </Grid2>
    </Grid2>
  );




  function FitToGeofences({ items }: { items: Geofence[] }) {
    const map = useMap();
    React.useEffect(() => {
      if (!items || !items.length) return;
      const bounds = L.latLngBounds([]);
      items.forEach(g => {
        if (g.type === 'circle') {
          const b = L.circle([g.center.lat, g.center.lng], { radius: g.radius_m }).getBounds();
          bounds.extend(b);
        } else {
          g.points.forEach(p => bounds.extend([p.lat, p.lng]));
        }
      });
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
    }, [items, map]);
    return null;
  }
}
function DriverRoleSection({ user }: { user: User }) {
  // ===== Permissions: نقشه همیشه؛ ردیابی فقط با تیک سطح نقش =====
  const DEFAULT_PERMS: string[] = ['view_report'];
  const [allowed, setAllowed] = React.useState<Set<string>>(new Set(DEFAULT_PERMS));
  const [permsLoading, setPermsLoading] = React.useState(false);
  const [q, setQ] = React.useState('');
  type TabKey = 'drivers' | VehicleTypeCode;
  const [tab, setTab] = React.useState<TabKey>('drivers');
  const activeType = (tab !== 'drivers') ? (tab as VehicleTypeCode) : null;
  const [parentSA, setParentSA] = React.useState<{ id: number; name: string } | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<number | null>(null);
  const LL_DEC = 10;
  const roundLL = (v: number) => Math.round(v * 10 ** LL_DEC) / 10 ** LL_DEC;
  const fmtLL = (v: number) => Number.isFinite(v) ? v.toFixed(LL_DEC) : '';
  const [sheetOpen, setSheetOpen] = React.useState(false);
  // ===== Route types =====
  type RouteMeta = { id: number; name?: string | null; threshold_m?: number | null };
  type RoutePoint = { lat: number; lng: number; name?: string | null; radius_m?: number | null };
  // کنار بقیه‌ی can*
  // state ها
  const [drawingRoute, setDrawingRoute] = useState(false);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [routeName, setRouteName] = useState('');
  const [routeThreshold, setRouteThreshold] = useState<number>(100);

  // کلیک‌گیر روی نقشه
  function PickPointsForRoute({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lng: number) => void }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }
  // پرچم برای جلوگیری از تریپل‌کلیک/اسپم
  const savingRouteRef = React.useRef(false);

  async function saveRouteAndFenceForVehicle(opts: {
    vehicleId: number;
    name: string;
    threshold_m: number;               // مثلا 1000
    points: { lat: number; lng: number }[]; // نقاط خام مسیر
    toleranceM?: number;               // مثلا 10–20
  }) {
    const { vehicleId, name, threshold_m, points, toleranceM = 15 } = opts;
    if (savingRouteRef.current) return;           // جلوگیری از تکرار
    if (!vehicleId) { alert('خودرو انتخاب نشده'); return; }
    if (!Array.isArray(points) || points.length < 2) {
      alert('حداقل دو نقطه برای مسیر لازم است.'); return;
    }

    try {
      savingRouteRef.current = true;

      // 1) ساخت مسیر روی خودِ خودرو
      // POST /vehicles/:vid/routes   { name, threshold_m, points }
      const { data: created } = await api.post(`/vehicles/${vehicleId}/routes`, {
        name,
        threshold_m,
        points, // [{lat,lng}, ...]
      });
      const routeId = Number(created?.route_id ?? created?.id);
      if (!Number.isFinite(routeId)) throw new Error('route_id از پاسخ سرور خوانده نشد');

      // 2) ست کردن همین مسیر به‌عنوان مسیر فعلی
      // PUT /vehicles/:vid/routes/current   { route_id }
      await api.put(`/vehicles/${vehicleId}/routes/current`, { route_id: routeId });

      // 3) ساخت ژئوفنس پُلیگانیِ دور مسیر (بافر)
      // از همون buildRouteBufferPolygon که تو کدت داری استفاده می‌کنیم
      const ring = buildRouteBufferPolygon(points, threshold_m) // متر
        .map(p => ({ lat: +p.lat, lng: +p.lng }));

      // نکته: برای جلوگیری از چندبار ساخت، اول PUT (آپ‌سرت) می‌زنیم؛
      // اگر سرور اجازه نداد، یکبار POST می‌زنیم.
      try {
        await api.put(`/vehicles/${vehicleId}/geofence`, {
          type: 'polygon',
          polygonPoints: ring,
          toleranceM,
        });
      } catch {
        await api.post(`/vehicles/${vehicleId}/geofence`, {
          type: 'polygon',
          polygonPoints: ring,
          toleranceM,
        });
      }

      // ریفرش UI
      await loadVehicleRoute(vehicleId);
      await loadVehicleGeofences(vehicleId);

      // ریست UI ترسیم
      setDrawingRoute(false);
      setRoutePoints([]);
      if (!routeName) setRouteName(name || `Route ${routeId}`);

      alert('مسیر و ژئوفنس با موفقیت ذخیره شد.');
    } catch (e: any) {
      console.error(e?.response?.data || e);
      alert(e?.response?.data?.message || 'ذخیره مسیر/ژئوفنس ناموفق بود.');
    } finally {
      savingRouteRef.current = false;
    }
  }



  // per-vehicle caches
  const [routeMetaByVid, setRouteMetaByVid] =
    React.useState<Record<number, RouteMeta | null>>({});
  const [routePointsByRid, setRoutePointsByRid] =
    React.useState<Record<number, RoutePoint[]>>({});
  const [routePolylineByVid, setRoutePolylineByVid] =
    React.useState<Record<number, [number, number][]>>({});
  const [routeBusyByVid, setRouteBusyByVid] =
    React.useState<Record<number, 'idle' | 'loading' | 'error'>>({});
  // /routes/:rid/stations  یا  /routes/:rid/points  یا شکل‌های متفاوت
  const normalizeRoutePoints = (payload: any): RoutePoint[] => {
    const arr: any[] =
      Array.isArray(payload) ? payload :
        Array.isArray(payload?.items) ? payload.items :
          Array.isArray(payload?.data?.items) ? payload.data.items :
            Array.isArray(payload?.data) ? payload.data :
              Array.isArray(payload?.rows) ? payload.rows :
                Array.isArray(payload?.points) ? payload.points :
                  Array.isArray(payload?.stations) ? payload.stations :
                    [];

    const num = (v: any) => {
      const n = Number(v); return Number.isFinite(n) ? n : NaN;
    };

    // پشتیبانی از خروجی‌های snake/camel
    const out = arr.map((p: any) => {
      const lat = num(p.lat ?? p.latitude ?? p.y);
      const lng = num(p.lng ?? p.longitude ?? p.x);
      return ({
        lat, lng,
        name: p.name ?? p.title ?? null,
        radius_m: Number.isFinite(num(p.radius_m ?? p.radiusM ?? p.radius)) ? num(p.radius_m ?? p.radiusM ?? p.radius) : null,
      });
    }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    // مرتب‌سازی بر اساس order_no اگر وجود دارد
    out.sort((a: any, b: any) =>
      (Number(a.order_no ?? a.orderNo ?? a.order ?? 0) - Number(b.order_no ?? b.orderNo ?? b.order ?? 0))
    );

    return out;
  };
  // مسیر فعلی ماشین (meta)
  // مسیر فعلی ماشین (meta) — اول /routes/current بعد بقیه
  const fetchVehicleCurrentRouteMeta = async (vid: number): Promise<RouteMeta | null> => {
    const tries = [
      () => api.get(`/vehicles/${vid}/routes/current`), // 👈 خواسته‌ی شما
      () => api.get(`/vehicles/${vid}/current-route`),
      () => api.get(`/vehicles/${vid}/route`),
    ];
    for (const t of tries) {
      try {
        const { data } = await t();
        // برخی APIها خروجی را داخل route می‌گذارند
        const r = data?.route || data;
        if (r?.id) {
          return {
            id: Number(r.id),
            name: r.name ?? null,
            threshold_m: r.threshold_m ?? r.thresholdM ?? null,
          };
        }
        // بعضی‌ها هم به‌صورت扮 route_id
        if (data?.route_id) {
          return {
            id: Number(data.route_id),
            name: data.name ?? null,
            threshold_m: data.threshold_m ?? data.thresholdM ?? null,
          };
        }
      } catch { /* try next */ }
    }
    return null;
  };


  // نقاط مسیر بر اساس routeId
  // نقاط مسیر — اول /points بعد /stations (طبق خواسته‌ی شما)
  const fetchRoutePoints = async (routeId: number): Promise<RoutePoint[]> => {
    const tries = [
      () => api.get(`/routes/${routeId}/points`),   // 👈 اول points
      () => api.get(`/routes/${routeId}/stations`), //    بعد stations
    ];
    for (const t of tries) {
      try {
        const { data } = await t();
        return normalizeRoutePoints(data);
      } catch { /* try next */ }
    }
    return [];
  };


  // ست/آپدیت مسیر فعلی ماشین (اختیاری threshold)
  const setOrUpdateVehicleRoute = async (vid: number, body: { route_id?: number; threshold_m?: number }) => {
    // PATCH/PUT ها متنوع‌اند؛ همه را هندل می‌کنیم
    const tries = [
      () => api.patch(`/vehicles/${vid}/route`, body),
      () => api.put(`/vehicles/${vid}/route`, body),
      () => api.post(`/vehicles/${vid}/route`, body),
    ];
    for (const t of tries) {
      try { return await t(); } catch { /* next */ }
    }
  };

  // لغو مسیر فعلی ماشین
  // لغو/برداشتن مسیر فعلی ماشین — فقط DELETE
  const clearVehicleRoute = async (vid: number) => {
    const tries = [
      // رایج‌ترین‌ها
      () => api.delete(`/vehicles/${vid}/route`),
      () => api.delete(`/vehicles/${vid}/route/unassign`),

      // چند فالبک احتمالی
      () => api.delete(`/vehicles/${vid}/routes/current`),
      () => api.delete(`/vehicles/${vid}/current-route`),
    ];

    let lastErr: any;
    for (const t of tries) {
      try { return await t(); } catch (e) { lastErr = e; }
    }
    throw lastErr;
  };


  // لیست مسیرهای قابل‌انتخاب برای یک ماشین
  const listVehicleRoutes = async (vid: number): Promise<RouteMeta[]> => {
    try {
      const { data } = await api.get(`/vehicles/${vid}/routes`);
      const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      return arr
        .map((r: any) => ({ id: Number(r.id), name: r.name ?? null, threshold_m: r.threshold_m ?? r.thresholdM ?? null }))
        .filter((r: any) => Number.isFinite(r.id));
    } catch { return []; }
  };
  const loadVehicleRoute = React.useCallback(async (vid: number) => {
    setRouteBusyByVid(p => ({ ...p, [vid]: 'loading' }));
    try {
      const meta = await fetchVehicleCurrentRouteMeta(vid);
      setRouteMetaByVid(p => ({ ...p, [vid]: meta }));

      if (meta?.id) {
        // کش نقاط مسیر
        let pts = routePointsByRid[meta.id];
        if (!pts) {
          pts = await fetchRoutePoints(meta.id);
          setRoutePointsByRid(p => ({ ...p, [meta.id]: pts }));
        }
        const line: [number, number][] = (pts || []).map(p => [p.lat, p.lng]);
        setRoutePolylineByVid(prev => ({ ...prev, [vid]: line }));
      } else {
        setRoutePolylineByVid(prev => ({ ...prev, [vid]: [] }));
      }
      setRouteBusyByVid(p => ({ ...p, [vid]: 'loaded' }));
    } catch {
      setRouteBusyByVid(p => ({ ...p, [vid]: 'error' }));
    }
  }, [routePointsByRid]);

  // ===== Consumables (per vehicle) =====
  type ConsumableItem = {
    id?: number;
    mode: 'km' | 'time';
    note?: string;
    title?: string;
    start_at?: string | null;
    base_odometer_km?: number | null;
    created_at?: string | null;
    vehicle_id?: number | null;
  };

  const [consumablesByVid, setConsumablesByVid] =
    React.useState<Record<number, ConsumableItem[]>>({});
  const [consStatusByVid, setConsStatusByVid] =
    React.useState<Record<number, 'idle' | 'loading' | 'loaded' | 'error'>>({});

  // دیالوگ‌ها/فرم
  const [consumablesOpen, setConsumablesOpen] = React.useState(false);
  const [editingCons, setEditingCons] = React.useState<any | null>(null);
  const [savingCons, setSavingCons] = React.useState(false);
  const [consumableMode, setConsumableMode] = React.useState<'time' | 'km'>('km');
  const [tripNote, setTripNote] = React.useState('');
  const [tripDate, setTripDate] = React.useState<Date | null>(new Date());
  const [tripBaseKm, setTripBaseKm] = React.useState<number | null>(null);

  // تله‌متری لازم برای چکِ کیلومتر
  const [vehicleTlm, setVehicleTlm] = React.useState<{
    ignition?: boolean;
    idle_time?: number;
    odometer?: number;
  }>({});
  // نوتیف فقط-یکبار
  const notifiedRef = React.useRef<Set<string>>(new Set());
  const [toast, setToast] = React.useState<{ open: boolean; msg: string } | null>(null);

  // helpers
  const CONS_KEY = (vid: number) => `consumables_${vid}`;
  const loadConsLocal = (vid: number) => {
    try {
      const raw = localStorage.getItem(CONS_KEY(vid));
      if (!raw) return [] as ConsumableItem[];
      return normalizeConsumables(JSON.parse(raw));
    } catch { return [] as ConsumableItem[]; }
  };
  const saveConsLocal = (vid: number, items: ConsumableItem[]) => {
    try { localStorage.setItem(CONS_KEY(vid), JSON.stringify(items)); } catch { }
  };

  const normalizeConsumables = (payload: any): ConsumableItem[] => {
    let arr: any[] =
      Array.isArray(payload) ? payload :
        Array.isArray(payload?.items) ? payload.items :
          Array.isArray(payload?.data?.items) ? payload.data.items :
            Array.isArray(payload?.data) ? payload.data :
              Array.isArray(payload?.result) ? payload.result :
                Array.isArray(payload?.consumables) ? payload.consumables :
                  Array.isArray(payload?.rows) ? payload.rows :
                    (payload && typeof payload === 'object' ? [payload] : []);

    const toNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
    const toISO = (v: any) => { if (!v) return null; const t = new Date(v); return isNaN(+t) ? null : t.toISOString(); };

    const out = arr.map((c: any) => ({
      id: c.id ?? c._id ?? undefined,
      mode: (c.mode ?? c.type) === 'time' ? 'time' : 'km',
      note: c.note ?? c.description ?? '',
      title: c.title ?? c.name ?? c.note ?? undefined,
      created_at: toISO(c.created_at ?? c.createdAt),
      start_at: toISO(c.start_at ?? c.startAt ?? c.start_time ?? c.startTime),
      base_odometer_km: toNum(c.base_odometer_km ?? c.baseOdometerKm ?? c.base_odo ?? c.base_odo_km),
      vehicle_id: c.vehicle_id ?? c.vehicleId ?? null,
    }));

    const keyOf = (x: any) => x.id ?? `${x.mode}:${x.start_at ?? x.base_odometer_km ?? x.note ?? ''}`;
    const map = new Map<string | number, any>();
    out.forEach(x => map.set(keyOf(x), x));
    return Array.from(map.values());
  };

  async function createConsumable(
    vid: number,
    payload: { mode: 'km' | 'time'; note: string; start_at?: string | null; base_odometer_km?: number | null }
  ) {
    const snake = payload.mode === 'time'
      ? { mode: 'time', note: payload.note, start_at: payload.start_at }
      : { mode: 'km', note: payload.note, base_odometer_km: payload.base_odometer_km };
    try {
      return await api.post(`/vehicles/${vid}/consumables`, snake);
    } catch {
      const camel = payload.mode === 'time'
        ? { mode: 'time', note: payload.note, startAt: payload.start_at }
        : { mode: 'km', note: payload.note, baseOdometerKm: payload.base_odometer_km };
      try {
        return await api.post(`/vehicles/${vid}/consumables`, camel);
      } catch {
        try { return await api.post(`/vehicles/${vid}/consumables`, { consumable: snake }); }
        catch { return await api.post(`/vehicles/${vid}/consumables`, { consumable: camel }); }
      }
    }
  }
  async function updateConsumable(
    vid: number, id: number,
    payload: { mode: 'km' | 'time'; note: string; start_at?: string | null; base_odometer_km?: number | null }
  ) {
    const snake = payload.mode === 'time'
      ? { mode: 'time', note: payload.note, start_at: payload.start_at }
      : { mode: 'km', note: payload.note, base_odometer_km: payload.base_odometer_km };
    try {
      return await api.patch(`/vehicles/${vid}/consumables/${id}`, snake);
    } catch {
      const camel = payload.mode === 'time'
        ? { mode: 'time', note: payload.note, startAt: payload.start_at }
        : { mode: 'km', note: payload.note, baseOdometerKm: payload.base_odometer_km };
      return await api.patch(`/vehicles/${vid}/consumables/${id}`, camel);
    }
  }

  const consReqIdRef = React.useRef<Record<number, number>>({});
  const refreshConsumables = React.useCallback(async (vid: number, forceServer = false) => {
    const myId = (consReqIdRef.current[vid] || 0) + 1;
    consReqIdRef.current[vid] = myId;
    setConsStatusByVid(p => ({ ...p, [vid]: 'loading' }));

    if (!forceServer) {
      const cached = loadConsLocal(vid);
      if (cached.length) {
        setConsumablesByVid(p => ({ ...p, [vid]: cached }));
        setConsStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
      }
    }

    try {
      const { data } = await api.get(`/vehicles/${vid}/consumables`, {
        params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }
      });
      if (consReqIdRef.current[vid] !== myId) return;
      const list = normalizeConsumables(data);
      saveConsLocal(vid, list);
      setConsumablesByVid(p => ({ ...p, [vid]: list }));
      setConsStatusByVid(p => ({ ...p, [vid]: 'loaded' }));
    } catch {
      if (consReqIdRef.current[vid] !== myId) return;
      setConsStatusByVid(p => ({ ...p, [vid]: 'error' }));
    }
  }, []);

  const resolveParentSA = React.useCallback(
    async (uid: number): Promise<{ id: number; name: string } | null> => {
      // 1) تلاش از روی پالیسی‌ها (اگه owner داخلشون بود)
      try {
        const { data } = await api.get(`/vehicle-policies/user/${uid}`, { params: { onlyAllowed: true } });
        const rows: any[] = Array.isArray(data) ? data : [];
        const pickNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
        const ownerIds = Array.from(new Set(
          rows.flatMap(r => [
            pickNum(r.owner_user_id), pickNum(r.ownerId),
            pickNum(r.super_admin_user_id), pickNum(r.superAdminUserId),
            pickNum(r.grantor_user_id), pickNum(r.grantorUserId),
          ].filter(Boolean))
        )) as number[];

        for (const oid of ownerIds) {
          try {
            const test = await api.get('/vehicles', { params: { owner_user_id: String(oid), limit: 1 } });
            const items = Array.isArray(test.data?.items) ? test.data.items : (Array.isArray(test.data) ? test.data : []);
            if (items.length) {
              const row = rows.find(rr =>
                [rr.owner_user_id, rr.ownerId, rr.super_admin_user_id, rr.superAdminUserId, rr.grantor_user_id, rr.grantorUserId]
                  .map((x: any) => Number(x)).includes(oid)
              );
              return { id: oid, name: String(row?.owner_name ?? row?.ownerName ?? 'سوپرادمین') };
            }
          } catch { }
        }
      } catch { }

      // 2) فـال‌بک مطمئن: جدِ level=2 از بک‌اند
      try {
        const { data } = await api.get('/users/my-ancestor', { params: { level: 2 } });
        if (data?.id) return { id: Number(data.id), name: String(data.full_name || 'سوپرادمین') };
      } catch { }

      return null;
    },
    []
  );
  const [vehicleStationsMap, setVehicleStationsMap] = React.useState<Record<number, Station[]>>({});
  const [routeByVid, setRouteByVid] =
    React.useState<Record<number, { id: number; threshold_m?: number }>>({});
  // قبلی را پاک کن و این را بگذار
  const fetchStations = async (vid: number) => {
    try {
      const { data } = await api.get(`/vehicles/${vid}/stations`);
      const rows: any[] = Array.isArray(data) ? data : [];

      const stations: Station[] = rows.map((p: any) => ({
        id: Number(p.id),
        name: p.name ?? p.title ?? null,
        lat: roundLL(Number(p.lat)),
        lng: roundLL(Number(p.lng)),
        radius_m: Number(p.radius_m ?? p.radiusM ?? 60),
      }));

      setVehicleStationsMap(prev => ({ ...prev, [vid]: stations }));
    } catch {
      setVehicleStationsMap(prev => ({ ...prev, [vid]: [] }));
    }
  };

  // ⬇️ این تابع قبلی‌ت رو به‌طور کامل با این نسخه جایگزین کن

  const ensureStationsLive = React.useCallback(
    async (vid: number) => {
      if (!vehicleStationsMap[vid]) {
        await fetchStations(vid).catch(() => { });
      }

      const s = socketRef.current;
      if (!s) return;

      if (lastStationsSubRef.current && lastStationsSubRef.current.vid !== vid) {
        const { vid: pvid, uid } = lastStationsSubRef.current;
        s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations/${user.id}` });
        s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations` });
        lastStationsSubRef.current = null;
      }

      s.emit('subscribe', { topic: `vehicle/${vid}/stations/${user.id}` });
      s.emit('subscribe', { topic: `vehicle/${vid}/stations` });
      lastStationsSubRef.current = { vid, uid: user.id };
    },
    [user.id, vehicleStationsMap, fetchStations]
  );



  // === استایل‌های شبیه سوپرادمین ===
  const ROUTE_STYLE = {
    outline: { color: '#0d47a1', weight: 8, opacity: 0.25 },
    main: { color: '#1e88e5', weight: 5, opacity: 0.9 },
  };
  const ROUTE_COLORS = { start: '#43a047', end: '#e53935', point: '#1565c0' };

  const numberedIcon = (n: number) =>
    L.divIcon({
      className: 'route-idx',
      html: `<div style="
      width:22px;height:22px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:12px;color:#fff;background:${ROUTE_COLORS.point};
      box-shadow:0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.3);
    ">${n}</div>`,
      iconSize: [22, 22], iconAnchor: [11, 11],
    });

  const badgeIcon = (txt: string, bg: string) =>
    L.divIcon({
      className: 'route-badge',
      html: `<div style="
      padding:3px 6px;border-radius:6px;
      font-weight:700;font-size:11px;color:#fff;background:${bg};
      box-shadow:0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.3)
    ">${txt}</div>`,
      iconSize: [1, 1], iconAnchor: [10, 10],
    });

  function FitToRoute({ line, points }: { line: [number, number][], points: { lat: number; lng: number; radius_m?: number | null }[] }) {
    const map = useMap();
    React.useEffect(() => {
      const b = L.latLngBounds([]);
      line.forEach(([lat, lng]) => b.extend([lat, lng]));
      points.forEach(p => b.extend([p.lat, p.lng]));
      if (b.isValid()) map.fitBounds(b.pad(0.2));
    }, [map, JSON.stringify(line), JSON.stringify(points)]);
    return null;
  }

  function RouteLayer({ vid }: { vid: number | null }) {
    const meta = vid ? (routeMetaByVid[vid] || null) : null;
    const rid = meta?.id ?? null;
    const line = vid ? (routePolylineByVid[vid] || []) : [];
    const pts = rid ? (routePointsByRid[rid] || []) : [];

    if (!vid || line.length < 2) return null;

    const bufferRadius = Math.max(1, Number(meta?.threshold_m ?? 60));
    const bufferPoly = React.useMemo(
      () => buildRouteBufferPolygon(pts.map(p => ({ lat: p.lat, lng: p.lng })), bufferRadius),
      [JSON.stringify(pts), bufferRadius]
    );

    return (
      <>
        <FitToRoute line={line} points={pts} />

        {/* اوت‌لاین و خط اصلی مسیر */}
        <Polyline positions={line} pathOptions={{ color: '#0d47a1', weight: 8, opacity: 0.25 }} />
        <Polyline positions={line} pathOptions={{ color: '#1e88e5', weight: 5, opacity: 0.9 }} />

        {/* بافر مسیر */}
        {bufferPoly.length >= 3 && (
          <Polygon
            positions={bufferPoly.map(p => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: '#1e88e5', weight: 1, opacity: 0.4, fillOpacity: 0.08 }}
          />
        )}

        {/* فقط دایرهٔ شعاع نقاط (بدون مارکر/عدد) */}
        {pts.map((p, i) => (
          Number.isFinite(p.radius_m as any) && (p.radius_m! > 0) && (
            <Circle
              key={`rpt-${rid}-${i}`}
              center={[p.lat, p.lng]}
              radius={p.radius_m!}
              pathOptions={{ color: '#3949ab', opacity: 0.35, fillOpacity: 0.06 }}
            />
          )
        ))}
      </>
    );
  }





  // === Geometry helpers: LL ⇄ XY + buffer polygon (exactly as requested) ===
  function toXY(lat: number, lng: number, lat0: number, lng0: number): [number, number] {
    const R = 6371000;
    const dLat = (lat - lat0) * Math.PI / 180;
    const dLng = (lng - lng0) * Math.PI / 180;
    const x = dLng * Math.cos((lat0 * Math.PI) / 180) * R;
    const y = dLat * R;
    return [x, y];
  }
  function toLL(x: number, y: number, lat0: number, lng0: number) {
    const R = 6371000, toDeg = (r: number) => (r * 180) / Math.PI;
    return {
      lat: lat0 + toDeg(y / R),
      lng: lng0 + toDeg(x / (R * Math.cos((lat0 * Math.PI) / 180))),
    };
  }
  function lineIntersect(
    p: [number, number], r: [number, number],
    q: [number, number], s: [number, number]
  ): [number, number] | null {
    const [rx, ry] = r, [sx, sy] = s;
    const det = rx * sy - ry * sx;
    if (Math.abs(det) < 1e-9) return null; // parallel-ish
    const [px, py] = p, [qx, qy] = q;
    const t = ((qx - px) * sy - (qy - py) * sx) / det;
    return [px + t * rx, py + t * ry];
  }
  /** می‌سازد یک پولیگون بافر دور کل مسیر (m) */
  function buildRouteBufferPolygon(
    pts: { lat: number; lng: number }[],
    radius_m: number
  ): { lat: number; lng: number }[] {
    if (!pts || pts.length < 2) return [];
    const lat0 = pts[0].lat, lng0 = pts[0].lng;
    const P = pts.map(p => toXY(p.lat, p.lng, lat0, lng0));
    const L = P.length;
    const left: [number, number][] = [], right: [number, number][] = [];
    const dir: [number, number][] = [], nor: [number, number][] = [];
    for (let i = 0; i < L - 1; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[i + 1];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1e-9;
      const ux = dx / len, uy = dy / len;
      dir.push([ux, uy]);
      nor.push([-uy, ux]); // left normal
    }
    { // start cap (flat)
      const [x, y] = P[0], [nx, ny] = nor[0];
      left.push([x + nx * radius_m, y + ny * radius_m]);
      right.push([x - nx * radius_m, y - ny * radius_m]);
    }
    for (let i = 1; i < L - 1; i++) {
      const Pi = P[i];
      const uPrev = dir[i - 1], nPrev = nor[i - 1];
      const uNext = dir[i], nNext = nor[i];
      const a1: [number, number] = [Pi[0] + nPrev[0] * radius_m, Pi[1] + nPrev[1] * radius_m];
      const r1: [number, number] = uPrev;
      const a2: [number, number] = [Pi[0] + nNext[0] * radius_m, Pi[1] + nNext[1] * radius_m];
      const r2: [number, number] = uNext;
      let Lp = lineIntersect(a1, r1, a2, r2);
      if (!Lp) Lp = a2; // bevel fallback
      left.push(Lp);
      const b1: [number, number] = [Pi[0] - nPrev[0] * radius_m, Pi[1] - nPrev[1] * radius_m];
      const b2: [number, number] = [Pi[0] - nNext[0] * radius_m, Pi[1] - nNext[1] * radius_m];
      let Rp = lineIntersect(b1, r1, b2, r2);
      if (!Rp) Rp = b2;
      right.push(Rp);
    }
    { // end cap (flat)
      const [x, y] = P[L - 1], [nx, ny] = nor[nor.length - 1];
      left.push([x + nx * radius_m, y + ny * radius_m]);
      right.push([x - nx * radius_m, y - ny * radius_m]);
    }
    const ringXY = [...left, ...right.reverse()];
    return ringXY.map(([x, y]) => toLL(x, y, lat0, lng0));
  }


  const can = (k: string) => allowed.has(k);
  const canTrackDrivers = React.useMemo(() => can('track_driver'), [allowed]);
  const canSeeVehicle = user?.role_level === 2 || can('view_vehicle');

  // ===== Types =====
  type MonitorKey = typeof MONITOR_PARAMS[number]['key'];
  type VehicleTypeCode = typeof VEHICLE_TYPES[number]['code'];
  type DriverStats = { totalDistanceKm?: number; totalDurationMin?: number; jobsCount?: number; breakdownsCount?: number; };
  type DriverExtra = { license_no?: string; lastSeenAt?: string | null; currentVehicle?: { id: number; plate_no: string; vehicle_type_code?: string } | null; };
  type Station = { id: number; name: string; lat: number; lng: number; radius_m: number };
  type Vehicle = { id: number; plate_no: string; vehicle_type_code: VehicleTypeCode; last_location?: { lat: number; lng: number } };

  // ===== State (راننده‌ها) =====
  const [drivers, setDrivers] = React.useState<User[]>([]);
  const [statsMap, setStatsMap] = React.useState<Record<number, DriverStats>>({});
  const [extras, setExtras] = React.useState<Record<number, DriverExtra>>({});
  const [loading, setLoading] = React.useState(true);

  // ✅ قابلیت‌های اعطاشده توسط SA به تفکیک نوع خودرو
  const [grantedPerType, setGrantedPerType] = React.useState<Record<VehicleTypeCode, MonitorKey[]>>({});
  const [parentSAName, setParentSAName] = React.useState<string | null>(null);

  // ===== تب‌ها: راننده‌ها + تب‌های خودرویی به تفکیک نوع =====


  // وقتی اولین grant رسید، تب همان نوع را خودکار باز کن (خواسته‌ی شما)
  React.useEffect(() => {
    const types = Object.keys(grantedPerType) as VehicleTypeCode[];
    const firstWithGrants = types.find(t => (grantedPerType[t] || []).length > 0);
    if (firstWithGrants) setTab(firstWithGrants);
  }, [grantedPerType]);

  // ===== بازه‌ی زمانی =====
  const [preset, setPreset] = React.useState<'today' | 'yesterday' | '7d' | 'custom'>('today');
  const [fromISO, setFromISO] = React.useState<string>(() => new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  const [toISO, setToISO] = React.useState<string>(() => new Date().toISOString());
  React.useEffect(() => {
    const now = new Date();
    if (preset === 'today') { setFromISO(new Date(new Date().setHours(0, 0, 0, 0)).toISOString()); setToISO(now.toISOString()); }
    else if (preset === 'yesterday') { const s = new Date(); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setHours(23, 59, 59, 999); setFromISO(s.toISOString()); setToISO(e.toISOString()); }
    else if (preset === '7d') { const s = new Date(); s.setDate(s.getDate() - 7); setFromISO(s.toISOString()); setToISO(now.toISOString()); }
  }, [preset]);

  // ===== helpers (fetch راننده‌ها + KPI) =====
  const normalizeUsersToDrivers = (arr: any[]): User[] =>
    (arr || []).map((u: any) => ({ id: u.id, role_level: 6, full_name: u.full_name ?? u.name ?? '—', phone: u.phone ?? '', ...(u.last_location ? { last_location: u.last_location } : {}) }));

  const fetchBranchDrivers = async (): Promise<User[]> => {
    try {
      const { data } = await api.get('/users/my-subordinates-flat');
      return normalizeUsersToDrivers((data || []).filter((u: any) => (u?.role_level ?? 6) === 6));
    } catch { }
    const tries = [
      () => api.get(`/users/branch-manager/${user.id}/subordinates`),
      () => api.get('/users', { params: { branch_manager_user_id: user.id, role_level: 6, limit: 1000 } }),
      () => api.get('/drivers', { params: { branch_manager_user_id: user.id, limit: 1000 } }),
    ];
    for (const fn of tries) {
      try {
        const { data } = await fn();
        const items = data?.items ?? data ?? [];
        const out = Array.isArray(items) ? normalizeUsersToDrivers(items) : normalizeUsersToDrivers([items]);
        if (out.length) return out;
      } catch { }
    }
    return [];
  };

  const toRad = (x: number) => x * Math.PI / 180, R = 6371;
  const hav = (a: [number, number], b: [number, number]) => {
    const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]), lat1 = toRad(a[0]), lat2 = toRad(b[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const fetchStats = React.useCallback(async (ids: number[], from: string, to: string) => {
    const settled = await Promise.allSettled(ids.map(id => api.get(`/driver-routes/stats/${id}`, { params: { from, to } })));
    const entries: [number, DriverStats][] = []; const fallbackIds: number[] = [];
    settled.forEach((r, i) => { const id = ids[i]; if (r.status === 'fulfilled') entries.push([id, r.value?.data ?? {}]); else fallbackIds.push(id); });
    if (fallbackIds.length) {
      const tr = await Promise.allSettled(fallbackIds.map(id => api.get('/tracks', { params: { driver_id: id, from, to } }).then(res => ({ id, data: res.data }))));
      tr.forEach(fr => { if (fr.status === 'fulfilled') { const { id, data } = fr.value as any; const pts: { lat: number; lng: number }[] = Array.isArray(data) ? data : data?.items || []; let d = 0; for (let i = 1; i < pts.length; i++) d += hav([pts[i - 1].lat, pts[i - 1].lng], [pts[i].lat, pts[i].lng]); entries.push([id, { totalDistanceKm: +d.toFixed(2) }]); } });
    }
    setStatsMap(Object.fromEntries(entries));
  }, []);
  const [parentSAId, setParentSAId] = React.useState<number | null>(null);

  // ===== SA parent & granted policies =====
  // کمک‌تابع‌ها
  // بالای فایل (کنار تایپ‌ها)
  // کمک‌تابع‌ها


  // 👇 از روی parentSAId فقط از /vehicles و /users/:id/vehicles می‌گیریم
  const ensureArray = (data: any) =>
    Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);

  const normType = (s?: string) => String(s || '').toLowerCase().replace(/[-_]/g, '');




  // برای جلوگیری از race-condition در fetch ها (به ازای هر نوع خودرو)
  const lastFetchReq = React.useRef<Record<VehicleTypeCode, number>>({});

  const fetchVehiclesOfType = React.useCallback(
    async (vt: VehicleTypeCode) => {
      if (!parentSAId) return;
      const rid = Date.now();
      lastFetchReq.current[vt] = rid;

      const apply = (items: any[]) => {
        if (lastFetchReq.current[vt] !== rid) return;

        const list = (items || [])
          .map((v: any) => {
            const ll = v.last_location
              ? {
                lat: roundLL(Number(v.last_location.lat)),
                lng: roundLL(Number(v.last_location.lng)),
              }
              : undefined;

            return {
              id: Number(v.id),
              plate_no: String(v.plate_no ?? v.plateNo ?? ''),
              vehicle_type_code: normType(v.vehicle_type_code ?? v.vehicleTypeCode) as VehicleTypeCode,
              ...(ll ? { last_location: ll } : {}),
              created_at: v.created_at ?? v.createdAt ?? null,
            };
          })
          .sort((a, b) => a.plate_no.localeCompare(b.plate_no, 'fa', { numeric: true }));

        setVehiclesByType(prev => ({ ...prev, [vt]: list }));
        console.log(`[BM] fetched ${list.length} vehicles for <${vt}> from SA=${parentSAId}`);
      };


      try {
        const { data } = await api.get('/vehicles', { params: { owner_user_id: String(parentSAId), limit: 1000 } });
        const all = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        const items = all.filter((v: any) => normType(v.vehicle_type_code ?? v.vehicleTypeCode) === normType(vt));
        apply(items);
      } catch (e) {
        console.warn('[fetchVehiclesOfType] failed:', e);
        apply([]);
      }
    },
    [parentSAId]
  );

  const [policyRows, setPolicyRows] = React.useState<any[]>([]);

  const availableTypes: VehicleTypeCode[] = React.useMemo(() => {
    const set = new Set<VehicleTypeCode>();
    policyRows.forEach(r => {
      const vt = normType(r?.vehicle_type_code ?? r?.vehicleTypeCode) as VehicleTypeCode;
      if (vt) set.add(vt);
    });
    return Array.from(set);
  }, [policyRows]);




  React.useEffect(() => {
    if (!activeType) return;
    fetchVehiclesOfType(activeType);
  }, [activeType, parentSAId, fetchVehiclesOfType]);


  const pick = (...vals: any[]) => vals.find(v => v !== undefined && v !== null && v !== '');
  const [vehiclesByType, setVehiclesByType] = React.useState<Record<VehicleTypeCode, Vehicle[]>>({});




  // NEW: آی‌دی سوپرادمین(های) والد Branch Manager
  // ⬅️ SA والد

  // اولین اجداد با role_level = 2 را پیدا می‌کند
  // stateهای مرتبط


  // همونی که قبلاً ساختی:
  // ✅ به‌جای getParentSAId که روی /users/:id می‌رفت




  /* React.useEffect(() => {
     if (!user?.id) return;
     let alive = true;
     (async () => {
       const sa = await getParentSAFromPolicies(user.id);
       if (!alive) return;
       setParentSA(sa);
       setParentSAId(sa?.id ?? null);
       setParentSAName(sa?.name ?? null);
     })();
     return () => { alive = false; };
   }, [user?.id, getParentSAFromPolicies]);
 */


  React.useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      const sa = await resolveParentSA(user.id);
      if (!alive) return;
      setParentSA(sa);
      setParentSAId(sa?.id ?? null);
      setParentSAName(sa?.name ?? null);
      console.log('[BM] parentSA resolved =>', sa);
    })();
    return () => { alive = false; };
  }, [user?.id, resolveParentSA]);


  const fetchGrantedPolicies = React.useCallback(async (uid: number) => {
    try {
      const { data } = await api.get(`/vehicle-policies/user/${uid}`, { params: { onlyAllowed: true } });
      const rows: any[] = Array.isArray(data) ? data : [];
      setPolicyRows(rows);

      const map: Record<VehicleTypeCode, MonitorKey[]> = {} as any;
      rows.forEach((row: any) => {
        const vt = String(row?.vehicle_type_code ?? row?.vehicleTypeCode ?? '').toLowerCase() as VehicleTypeCode;
        const arr: MonitorKey[] = Array.isArray(row?.monitor_params ?? row?.monitorParams) ? (row.monitor_params ?? row.monitorParams) : [];
        if (vt) map[vt] = arr;
      });
      setGrantedPerType(map);
    } catch {
      setPolicyRows([]);
      setGrantedPerType({});
    }
  }, []);
  const vehiclesRef = React.useRef<Record<VehicleTypeCode, Vehicle[]>>({});
  React.useEffect(() => { vehiclesRef.current = vehiclesByType; }, [vehiclesByType]);
  // همه‌ی نوع‌هایی که کاربر اجازه دارد (صرف‌نظر از monitor_params)


  // اگر می‌خواهی فقط نوع‌هایی که حداقل یک پارامتر دارند تب شوند:
  const typesWithGrants: VehicleTypeCode[] = React.useMemo(() => {
    const withParams = new Set<VehicleTypeCode>(
      (Object.keys(grantedPerType) as VehicleTypeCode[]).filter(vt => (grantedPerType[vt] || []).length > 0)
    );
    // اتحــاد: یا پارامتر دارد یا صرفاً در پالیسی آمده
    const all = new Set<VehicleTypeCode>([...availableTypes, ...withParams]);
    return Array.from(all);
  }, [availableTypes, grantedPerType]);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const ds = await fetchBranchDrivers();
        setDrivers(ds);
        await fetchStats(ds.map(d => d.id), fromISO, toISO);
      } catch (e) { console.error('[branch-manager] init error:', e); }
      finally { setLoading(false); }
    })();
  }, [user?.id, fromISO, toISO, fetchStats]);

  // ✅ فقط گرانت‌ها
  React.useEffect(() => {
    if (!user?.id) return;
    fetchGrantedPolicies(user.id);
  }, [user?.id, fetchGrantedPolicies]);



  // ===== نقشه =====
  const [useMapTiler] = React.useState(Boolean(MT_KEY));
  const tileUrl = useMapTiler && MT_KEY ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MT_KEY}` : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const [focusLatLng, setFocusLatLng] = React.useState<[number, number] | undefined>(undefined);

  // تا مجبور نشی useEffect سوکت رو به selectedVehicleId وابسته کنی:
  const selectedVehicleIdRef = React.useRef<number | null>(null);
  React.useEffect(() => { selectedVehicleIdRef.current = selectedVehicleId; }, [selectedVehicleId]);

  // ===== WebSocket =====
  const socketRef = React.useRef<Socket | null>(null);
  const [polyline, setPolyline] = React.useState<[number, number][]>([]);
  const liveTrackOnRef = React.useRef<boolean>(false);
  const selectedDriverRef = React.useRef<User | null>(null);

  const subscribedVehiclesRef = React.useRef<Set<number>>(new Set());
  const [addingStationsForVid, setAddingStationsForVid] = React.useState<number | null>(null);
  const lastStationsSubRef = React.useRef<{ vid: number; uid: number } | null>(null);

  // ایستگاه‌ها (per vehicle)
  const [stationRadius, setStationRadius] = React.useState<number>(60);
  const [tempStation, setTempStation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [tempName, setTempName] = React.useState<string>('');
  const [autoIndex, setAutoIndex] = React.useState(1);
  const [editingStation, setEditingStation] = React.useState<{ vid: number; st: Station } | null>(null);
  const [movingStationId, setMovingStationId] = React.useState<number | null>(null);

  // marker lists
  const driverMarkers = React.useMemo(() => {
    if (!canTrackDrivers) return [];
    return drivers.filter(d => (d as any).last_location).map(d => [(d as any).last_location!.lat, (d as any).last_location!.lng] as [number, number]);
  }, [drivers, canTrackDrivers]);

  const typeGrants: MonitorKey[] = activeType ? (grantedPerType[activeType] || []) : [];
  const hasGrant = (k: string) =>
    typeGrants.map(s => String(s).toLowerCase().replace(/[-_]/g, ''))
      .includes(k.toLowerCase().replace(/[-_]/g, ''));

  const canTrackVehicles = !!(activeType && hasGrant('gps'));
  const canStations = !!(activeType && hasGrant('stations'));
  const canConsumables = !!(activeType && hasGrant('consumables'));
  const canIgnition = !!(activeType && hasGrant('ignition'));
  const canIdleTime = !!(activeType && hasGrant('idle_time'));
  const canOdometer = !!(activeType && hasGrant('odometer'));
  const canGeoFence = !!(activeType && (hasGrant('geo_fence') || hasGrant('geofence')));

  const canRouteEdit =
    !!(activeType && (hasGrant('route') || hasGrant('routes') || hasGrant('route_edit')));
  // آخرین سابسکرایب برای هر کلید
  const lastIgnVidRef = React.useRef<number | null>(null);
  const lastIdleVidRef = React.useRef<number | null>(null);
  const lastOdoVidRef = React.useRef<number | null>(null);
  type GeofenceCircle = {
    id?: number;
    type: 'circle';
    center: { lat: number; lng: number };
    radius_m: number;
    tolerance_m?: number | null;
  };
  type GeofencePolygon = {
    id?: number;
    type: 'polygon';
    points: { lat: number; lng: number }[];
    tolerance_m?: number | null;
  };
  type Geofence = GeofenceCircle | GeofencePolygon;

  // per-vehicle cache
  const [geofencesByVid, setGeofencesByVid] = React.useState<Record<number, Geofence[]>>({});

  // UI state برای ترسیم/ویرایش
  const [gfMode, setGfMode] = React.useState<'circle' | 'polygon'>('circle');
  const [gfDrawing, setGfDrawing] = React.useState(false);
  const [gfCenter, setGfCenter] = React.useState<{ lat: number; lng: number } | null>(null);
  const [gfRadius, setGfRadius] = React.useState<number>(150);
  const [gfPoly, setGfPoly] = React.useState<{ lat: number; lng: number }[]>([]);
  const [gfTolerance, setGfTolerance] = React.useState<number>(15);
  function PickPointsForGeofence({
    enabled,
    onPick,
  }: {
    enabled: boolean;
    onPick: (lat: number, lng: number) => void;
  }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }
  async function loadVehicleGeofenceBM(vid: number) {
    try {
      const { data } = await api.get(`/vehicles/${vid}/geofence`, {
        params: { _: Date.now() },
        headers: { 'Cache-Control': 'no-store' },
      });

      // خروجی را به آرایه‌ی استاندارد Geofence[] تبدیل کن
      const list = normalizeGeofences(data); // حتی اگر تک‌آبجکت بود، آرایه می‌شود
      setGeofencesByVid(p => ({ ...p, [vid]: list }));
      return list;
    } catch {
      setGeofencesByVid(p => ({ ...p, [vid]: [] }));
      return [];
    }
  }


  async function saveGeofenceBM() {
    if (!selectedVehicleId) return;

    const toInt = (v: any, min: number) => Math.max(min, Math.trunc(Number(v)));

    let payload: any;
    if (gfMode === 'circle') {
      if (!gfCenter || !Number.isFinite(gfCenter.lat) || !Number.isFinite(gfCenter.lng) || !Number.isFinite(gfRadius) || gfRadius <= 0) {
        alert('مرکز و شعاع دایره را درست وارد کنید.'); return;
      }
      payload = {
        type: 'circle',
        centerLat: +gfCenter.lat,
        centerLng: +gfCenter.lng,
        radiusM: toInt(gfRadius, 1),
        toleranceM: toInt(gfTolerance ?? 5, 0),
      };
    } else {
      if (!Array.isArray(gfPoly) || gfPoly.length < 3) { alert('چندضلعی حداقل به ۳ نقطه نیاز دارد.'); return; }
      payload = {
        type: 'polygon',
        polygonPoints: gfPoly.map(p => ({ lat: +p.lat, lng: +p.lng })),
        toleranceM: toInt(gfTolerance ?? 5, 0),
      };
    }

    try {
      await api.put(`/vehicles/${selectedVehicleId}/geofence`, payload)
        .catch(() => api.post(`/vehicles/${selectedVehicleId}/geofence`, payload));

      await loadVehicleGeofences(selectedVehicleId);      // reset draw UI
      setGfDrawing(false); setGfCenter(null); setGfPoly([]);
    } catch (e: any) {
      console.error('saveGeofenceBM error:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'ثبت ژئوفنس ناموفق بود');
    }
  }

  async function deleteGeofenceBM() {
    if (!selectedVehicleId) return;
    if (!confirm('ژئوفنس حذف شود؟')) return;

    try {
      await api.delete(`/vehicles/${selectedVehicleId}/geofence`)  // اگر API شما فقط تکی پاک می‌کند
        .catch(() => api.delete(`/geofences`, { params: { vehicle_id: String(selectedVehicleId) } })); // اگر جمعی دارید

      setGeofencesByVid(p => ({ ...p, [selectedVehicleId]: [] }));

      setGfDrawing(false); setGfCenter(null); setGfPoly([]);
    } catch (e) {
      console.error(e);
      alert('حذف ژئوفنس ناموفق بود');
    }
  }

  // بالاتر از تابع، یه کمک‌تابع کوچک
  /*  const ensureArray = (data: any) =>
     Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
 */


  // REPLACE: به جای نسخه‌ای که ownerId تکی می‌گرفت

  // صدا زدنش





  // این نسخه را بگذار جای fetchVehiclesOfType فعلی‌ت





  // REPLACE: قبلاً parentSA?.id تکی بود؛ الان از parentSAIds استفاده کن
  // ✅ فقط همین
  React.useEffect(() => {
    if (!activeType) return;
    fetchVehiclesOfType(activeType);
  }, [activeType, parentSAId, fetchVehiclesOfType]);




  // --- جایگزین این تابع کن ---





  // وقتی تب نوع فعال شد، ماشین‌های همان نوع را بگیر و سابسکرایب pos



  React.useEffect(() => {
    const s = socketRef.current;
    if (!s || !activeType || !canTrackVehicles) return;

    const nextIds = new Set((vehiclesByType[activeType] || []).map(v => v.id));
    const prev = subscribedVehiclesRef.current;

    const toSub: number[] = [];
    const toUnsub: number[] = [];

    nextIds.forEach(id => { if (!prev.has(id)) toSub.push(id); });
    prev.forEach(id => { if (!nextIds.has(id)) toUnsub.push(id); });

    // pos: سابسکرایب/آن‌سابِ اختلاف
    toSub.forEach(id => s.emit('subscribe', { topic: `vehicle/${id}/pos` }));
    toUnsub.forEach(id => s.emit('unsubscribe', { topic: `vehicle/${id}/pos` }));

    // چون لیست ماشین‌های تحت‌نظر عوض شده، سابسکرایب‌های تله‌متری قبلی را آزاد کن
    if (lastIgnVidRef.current) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIgnVidRef.current}/ignition` });
      lastIgnVidRef.current = null;
    }
    if (lastIdleVidRef.current) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIdleVidRef.current}/idle_time` });
      lastIdleVidRef.current = null;
    }
    if (lastTelemOdoVidRef.current) {
      s.emit('unsubscribe', { topic: `vehicle/${lastTelemOdoVidRef.current}/odometer` });
      lastTelemOdoVidRef.current = null;
    }

    subscribedVehiclesRef.current = nextIds;
  }, [activeType, canTrackVehicles, vehiclesByType]);


  // اتصال سوکت
  React.useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const s = io(url + '/vehicles', { transports: ['websocket'] });
    socketRef.current = s;

    // === هندلرها ===
    const onDriverPos = (v: { driver_id: number; lat: number; lng: number }) => {
      // اختیاری: هر کاری لازم داری
    };

    const onVehiclePos = (v: { vehicle_id: number; lat: number; lng: number }) => {
      // اختیاری: هر کاری لازم داری
    };

    const onStations = (msg: any) => {
      const vid = Number(msg?.vehicle_id ?? msg?.vehicleId);
      if (!Number.isFinite(vid)) return;

      setVehicleStationsMap(prev => {
        const list = (prev[vid] || []).slice();
        const normalize = (st: any) => ({
          ...st,
          lat: roundLL(parseFloat(String(st.lat))),
          lng: roundLL(parseFloat(String(st.lng))),
        });

        if (msg?.type === 'created' && msg.station) {
          const st = normalize(msg.station);
          if (!list.some(x => x.id === st.id)) list.push(st);
        } else if (msg?.type === 'updated' && msg.station) {
          const st = normalize(msg.station);
          const i = list.findIndex(x => x.id === st.id);
          if (i >= 0) list[i] = st;
        } else if (msg?.type === 'deleted' && msg.station_id) {
          const sid = Number(msg.station_id);
          return { ...prev, [vid]: list.filter(x => x.id !== sid) };
        }
        return { ...prev, [vid]: list };
      });
    };

    // --- NEW: هندلر کیلومترشمار ---
    const onOdo = (data: { vehicle_id: number; odometer: number }) => {
      // فقط اگر همین ماشینی‌ست که الان انتخاب شده
      if (selectedVehicleIdRef.current === data.vehicle_id) {
        setVehicleTlm(prev => ({ ...prev, odometer: data.odometer }));
      }
    };
    s.on('vehicle:ignition', (d: { vehicle_id: number; ignition: boolean }) =>
      selectedVehicleIdRef.current === d.vehicle_id && setVehicleTlm(p => ({ ...p, ignition: d.ignition })));

    s.on('vehicle:idle_time', (d: { vehicle_id: number; idle_time: number }) =>
      selectedVehicleIdRef.current === d.vehicle_id && setVehicleTlm(p => ({ ...p, idle_time: d.idle_time })));

    s.on('vehicle:odometer', (d: { vehicle_id: number; odometer: number }) =>
      selectedVehicleIdRef.current === d.vehicle_id && setVehicleTlm(p => ({ ...p, odometer: d.odometer })));

    // === ثبت لیسنرها ===
    s.on('driver:pos', onDriverPos);
    s.on('vehicle:pos', onVehiclePos);
    s.on('vehicle:stations', onStations);
    s.on('vehicle:odometer', onOdo);   // ⬅️ این خط جدید

    // === پاکسازی ===
    return () => {
      // آن‌سابسکرایب pos ها
      subscribedVehiclesRef.current.forEach((id) => {
        s.emit('unsubscribe', { topic: `vehicle/${id}/pos` });
      });
      subscribedVehiclesRef.current = new Set();

      // آن‌سابسکرایب stations
      if (lastStationsSubRef.current) {
        const { vid, uid } = lastStationsSubRef.current;
        s.emit('unsubscribe', { topic: `vehicle/${vid}/stations/${uid}` });
        lastStationsSubRef.current = null;
      }

      // --- NEW: آن‌سابسکرایب از تاپیک odometer اگر فعال بود
      if (lastTelemOdoVidRef.current) {
        s.emit('unsubscribe', { topic: `vehicle/${lastTelemOdoVidRef.current}/odometer` });
        lastTelemOdoVidRef.current = null;
      }

      // off هندلرها
      s.off('driver:pos', onDriverPos);
      s.off('vehicle:pos', onVehiclePos);
      s.off('vehicle:stations', onStations);
      s.off('vehicle:odometer', onOdo);

      s.disconnect();
      socketRef.current = null;
    };
  }, []);



  // سابسکرایب/آن‌سابسکرایب pos برای ماشین‌های تب فعال
  React.useEffect(() => {
    const vt = activeType;
    if (!vt || !parentSAId) return;
    if (!(vt in vehiclesByType)) {
      fetchVehiclesOfType(vt);
    }
  }, [activeType, parentSAId, vehiclesByType, fetchVehiclesOfType]);



  // ===== ایستگاه‌ها =====

  const startAddingStationsFor = async (vid: number) => {
    const next = addingStationsForVid === vid ? null : vid;
    setAddingStationsForVid(next);
    setTempStation(null);
    setTempName(`ایستگاه ${autoIndex}`);

    const s = socketRef.current;
    if (!s) return;

    // پاکسازی سابسکرایب قبلی
    if (lastStationsSubRef.current) {
      const { vid: pvid, uid } = lastStationsSubRef.current;
      s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations/${uid}` });
      s.emit('unsubscribe', { topic: `vehicle/${pvid}/stations` });
      lastStationsSubRef.current = null;
    }

    if (next != null) {
      // ساب روی هر دو تاپیک
      s.emit('subscribe', { topic: `vehicle/${next}/stations/${user.id}` });
      s.emit('subscribe', { topic: `vehicle/${next}/stations` });
      lastStationsSubRef.current = { vid: next, uid: user.id };

      if (!vehicleStationsMap[next]) fetchStations(next);
    }
  };

  const confirmTempStation = async () => {
    if (!addingStationsForVid || !tempStation) return;
    const name = (tempName || `ایستگاه ${autoIndex}`).trim();

    try {
      await api.post(`/vehicles/${addingStationsForVid}/stations`, {
        name,
        lat: roundLL(tempStation.lat),
        lng: roundLL(tempStation.lng),
        radius_m: stationRadius,
      });

      await fetchStations(addingStationsForVid); // بعد از ساخت، تازه بخوان
      setAutoIndex(i => i + 1);
      setTempStation(null);
    } catch {
      alert('ثبت ایستگاه ناموفق بود');
    }
  };

  const deleteStation = async (vid: number, st: Station) => {
    if (!confirm('ایستگاه حذف شود؟')) return;
    try {
      await api.delete(`/vehicles/${vid}/stations/${st.id}`);
      setVehicleStationsMap(prev => ({ ...prev, [vid]: (prev[vid] || []).filter(x => x.id !== st.id) }));
      if (editingStation?.st.id === st.id) setEditingStation(null);
    } catch { alert('حذف ناموفق بود'); }
  };
  const saveEditStation = async () => {
    const ed = editingStation; if (!ed) return;
    try {
      await api.put(`/vehicles/${ed.vid}/stations/${ed.st.id}`, { name: ed.st.name, lat: ed.st.lat, lng: ed.st.lng, radius_m: ed.st.radius_m });
      setVehicleStationsMap(prev => ({ ...prev, [ed.vid]: (prev[ed.vid] || []).map(x => x.id === ed.st.id ? ed.st : x) }));
      setEditingStation(null); setMovingStationId(null);
    } catch { alert('ذخیره ویرایش ناموفق بود'); }
  };

  // ===== مسیر راننده =====
  const loadDriverTrack = async (driverId: number) => {
    if (!canTrackDrivers) return;
    try {
      const { data } = await api.get('/tracks', { params: { driver_id: driverId, from: fromISO, to: toISO } });
      const pts: { lat: number; lng: number }[] = Array.isArray(data) ? data : data?.items || [];
      setPolyline(pts.map(p => [p.lat, p.lng] as [number, number]));
      liveTrackOnRef.current = true;
      selectedDriverRef.current = drivers.find(x => x.id === driverId) ?? null;
    } catch {
      setPolyline([]); liveTrackOnRef.current = true;
      selectedDriverRef.current = drivers.find(x => x.id === driverId) ?? null;
    }
  };
  const lastTelemOdoVidRef = React.useRef<number | null>(null);

  // ===== Map click helper =====
  // بیرون از BranchManagerRoleSection.tsx (یا بالا، خارج از بدنه‌ی تابع)

  const onPickVehicleBM = React.useCallback(async (v: Vehicle) => {
    setSelectedVehicleId(v.id);
    await loadVehicleGeofences(v.id);
    setSheetOpen(true);        // ⬅️ این خط را اضافه کن

    // ریست حالت‌های افزودن/ادیت ایستگاه
    setAddingStationsForVid(null);
    setEditingStation(null);
    setMovingStationId(null);
    setTempStation(null);
    await loadVehicleRoute(v.id);

    if (v.last_location) setFocusLatLng([v.last_location.lat, v.last_location.lng]);

    // ایستگاه‌ها (در صورت مجوز)
    if (canStations) {
      await ensureStationsLive(v.id);   // subscribe + fetch
    } else {
      await fetchStations(v.id);        // فقط fetch برای نمایش روی نقشه
    }
    const s = socketRef.current;

    // --- آزاد کردن سابسکرایب‌های قبلی تله‌متری (هر کدام جدا) ---
    if (s && lastIgnVidRef.current && lastIgnVidRef.current !== v.id) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIgnVidRef.current}/ignition` });
      lastIgnVidRef.current = null;
    }
    if (s && lastIdleVidRef.current && lastIdleVidRef.current !== v.id) {
      s.emit('unsubscribe', { topic: `vehicle/${lastIdleVidRef.current}/idle_time` });
      lastIdleVidRef.current = null;
    }

    // مقادیر قبلی تله‌متری را پاک کن (تا UI وضعیت نامشخص نشان دهد)
    setVehicleTlm({});

    // ===== فچ اولیه تله‌متری (صرفاً برای کلیدهای مجاز) =====
    try {
      const keysWanted: ('ignition' | 'idle_time' | 'odometer')[] = [];
      if (canIgnition) keysWanted.push('ignition');
      if (canIdleTime) keysWanted.push('idle_time');
      if (canOdometer) keysWanted.push('odometer');

      if (keysWanted.length) {
        const { data } = await api.get(`/vehicles/${v.id}/telemetry`, { params: { keys: keysWanted } });

        const next: { ignition?: boolean; idle_time?: number; odometer?: number } = {};
        if (typeof data?.ignition === 'boolean') next.ignition = data.ignition;
        if (typeof data?.idle_time === 'number') next.idle_time = data.idle_time;
        if (typeof data?.odometer === 'number') next.odometer = data.odometer;

        setVehicleTlm(next);
      }
    } catch {
      // مشکلی نبود؛ بعداً از سوکت آپدیت می‌گیریم
    }

    // ===== سابسکرایب تله‌متری برای ماشین انتخاب‌شده (هر کدام که مجاز است) =====
    if (s) {
      if (canIgnition) {
        s.emit('subscribe', { topic: `vehicle/${v.id}/ignition` });
        lastIgnVidRef.current = v.id;
      }
      if (canIdleTime) {
        s.emit('subscribe', { topic: `vehicle/${v.id}/idle_time` });
        lastIdleVidRef.current = v.id;  // ✅ درست
      }

      if (canOdometer) {
        s.emit('subscribe', { topic: `vehicle/${v.id}/odometer` });
        lastTelemOdoVidRef.current = v.id;
      }
    }
    // ژئوفنس (در صورت مجوز)
    setSelectedVehicleId(v.id);
    await loadVehicleGeofences(v.id); // همین یکی بماند




    // ===== لوازم مصرفی (کاملاً مستقل از تله‌متری) =====
    if (canConsumables) {
      // اسنپ‌شات لوکال
      const snap = loadConsLocal(v.id);
      if (snap.length) {
        setConsumablesByVid(p => ({ ...p, [v.id]: snap }));
        setConsStatusByVid(p => ({ ...p, [v.id]: 'loaded' }));
      } else {
        setConsumablesByVid(p => ({ ...p, [v.id]: [] }));
        setConsStatusByVid(p => ({ ...p, [v.id]: 'loading' }));
      }
      // همسان‌سازی از سرور
      refreshConsumables(v.id);
    } else {
      setConsumablesByVid(p => ({ ...p, [v.id]: [] }));
      setConsStatusByVid(p => ({ ...p, [v.id]: 'idle' }));
    }
  }, [
    canStations,
    ensureStationsLive,
    canConsumables,
    refreshConsumables,
    canIgnition,
    canIdleTime,
    canOdometer,
  ]);


  const DEFAULT_KM_REMINDER = 5000;
  const keyOfCons = (c: any) => String(c.id ?? `${c.mode}:${c.start_at ?? c.base_odometer_km ?? Math.random()}`);
  const notifyOnce = (c: any, msg: string) => {
    const k = keyOfCons(c);
    if (notifiedRef.current.has(k)) return;
    notifiedRef.current.add(k);
    setToast({ open: true, msg });
  };

  const canEditGeofence = !!(activeType && (hasGrant('geo_fence') || hasGrant('geofence')));
  React.useEffect(() => {
    if (!selectedVehicleId) return;
    loadVehicleGeofences(selectedVehicleId);
  }, [selectedVehicleId]); // ⬅️ canGeoFence از دیپندنسی حذف شد


  const checkConsumableDue = React.useCallback(() => {
    if (!selectedVehicleId) return;
    const list = consumablesByVid[selectedVehicleId] || [];
    const now = Date.now();

    list.forEach((c: any) => {
      if (c.mode === 'time' && c.start_at) {
        const t = new Date(c.start_at).getTime();
        if (!Number.isNaN(t) && now >= t) {
          notifyOnce(c, `یادآوری: «${c.title ?? c.note ?? 'آیتم'}» به زمان تعیین‌شده رسید.`);
        }
      }
      if (c.mode === 'km' && c.base_odometer_km != null && vehicleTlm.odometer != null) {
        const dist = Number(vehicleTlm.odometer) - Number(c.base_odometer_km);
        if (dist >= DEFAULT_KM_REMINDER) {
          notifyOnce(c, `یادآوری: «${c.title ?? c.note ?? 'آیتم'}» به ${DEFAULT_KM_REMINDER.toLocaleString('fa-IR')} کیلومتر پس از صفر رسید.`);
        }
      }
    });
  }, [selectedVehicleId, consumablesByVid, vehicleTlm.odometer]);

  React.useEffect(() => { checkConsumableDue(); }, [checkConsumableDue]);
  React.useEffect(() => {
    const id = setInterval(checkConsumableDue, 30_000);
    return () => clearInterval(id);
  }, [checkConsumableDue]);
  const openEditConsumable = (c: any) => {
    setEditingCons({
      id: c.id,
      mode: c.mode,
      note: c.note ?? '',
      start_at: c.start_at ?? null,
      base_odometer_km: c.base_odometer_km ?? null,
    });
  };
  const closeEditConsumable = () => setEditingCons(null);
  function normalizeGeofences(payload: any): Geofence[] {
    // به آرایه تبدیل کن
    const arr: any[] = Array.isArray(payload) ? payload
      : Array.isArray(payload?.items) ? payload.items
        : Array.isArray(payload?.data?.items) ? payload.data.items
          : Array.isArray(payload?.data) ? payload.data
            : Array.isArray(payload?.rows) ? payload.rows
              : Array.isArray(payload?.geofences) ? payload.geofences
                : payload?.rule ? [payload.rule]
                  : payload ? [payload] : [];

    const toNumStrict = (v: any) => (
      v === null || v === undefined || v === '' ? undefined :
        (Number.isFinite(+v) ? +v : undefined)
    );
    const toLL = (p: any) => {
      const lat = toNumStrict(p?.lat ?? p?.latitude ?? p?.y);
      const lng = toNumStrict(p?.lng ?? p?.longitude ?? p?.x);
      return (lat != null && lng != null) ? { lat, lng } : undefined;
    };

    const out: Geofence[] = [];

    for (const g of arr) {
      const geom = g?.geometry ?? g?.geojson ?? g?.geoJSON;
      const type = String(g?.type ?? geom?.type ?? '').toLowerCase();

      // ---- candidate: circle ----
      const centerObj = g?.center ?? {
        lat: g?.centerLat ?? g?.center_lat ?? g?.lat,
        lng: g?.centerLng ?? g?.center_lng ?? g?.lng,
      };
      const center = toLL(centerObj ?? {});
      const radius = toNumStrict(g?.radius_m ?? g?.radiusM ?? g?.radius ?? geom?.radius);
      const tol = toNumStrict(g?.tolerance_m ?? g?.toleranceM ?? g?.tolerance);

      const looksCircle = (type === 'circle') || (radius != null && radius > 0 && !!center);
      if (looksCircle && center && radius != null && radius > 0) {
        out.push({
          type: 'circle',
          id: toNumStrict(g?.id),
          center,
          radius_m: radius,
          tolerance_m: (tol ?? null),
        } as GeofenceCircle);
        continue; // فقط وقتی دایره معتبر push شد از این آیتم می‌گذریم
      }

      // ---- candidate: polygon via points/polygonPoints ----
      const rawPoints = g?.points ?? g?.polygonPoints ?? g?.polygon_points ?? geom?.points;
      if (Array.isArray(rawPoints)) {
        const pts = rawPoints.map((p: any) => toLL(p)).filter(Boolean) as { lat: number; lng: number }[];
        if (pts.length >= 3) {
          out.push({
            type: 'polygon',
            id: toNumStrict(g?.id),
            points: pts,
            tolerance_m: (tol ?? null),
          } as GeofencePolygon);
          continue;
        }
      }

      // ---- candidate: polygon via GeoJSON.coordinates ----
      const coords = geom?.coordinates;
      if (String(geom?.type ?? g?.type ?? '').toLowerCase() === 'polygon' && Array.isArray(coords)) {
        const ring = Array.isArray(coords[0]) ? coords[0] : coords; // [[lng,lat], ...]
        const pts = ring
          .map((xy: any) => Array.isArray(xy) && xy.length >= 2 ? ({ lat: toNumStrict(xy[1]), lng: toNumStrict(xy[0]) }) : undefined)
          .filter((p: any) => p?.lat != null && p?.lng != null) as { lat: number; lng: number }[];
        if (pts.length >= 3) {
          out.push({
            type: 'polygon',
            id: toNumStrict(g?.id),
            points: pts,
            tolerance_m: (tol ?? null),
          } as GeofencePolygon);
          continue;
        }
      }
    }

    // یکتاسازی بر اساس id (اگر داشت)
    const seen = new Set<number>();
    return out.filter(g => (g.id ? !seen.has(g.id) && (seen.add(g.id), true) : true));
  }
  // انتخاب نقطه برای ایستگاه‌ها (کلیک روی نقشه وقتی حالت افزودن فعال است)
  function PickPointsForStations({
    enabled,
    onPick,
  }: {
    enabled: boolean;
    onPick: (lat: number, lng: number) => void;
  }) {
    useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => {
      if (enabled) onPick(e.latlng.lat, e.latlng.lng);
    });
    return null;
  }

  async function loadVehicleGeofences(vid: number) {
    try {
      const { data } = await api.get(`/vehicles/${vid}/geofence`, {
        params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }
      });
      const list = normalizeGeofences(data); // تک آبجکت را هم آرایه می‌کند
      setGeofencesByVid(p => ({ ...p, [vid]: list }));
      return list;
    } catch {
      setGeofencesByVid(p => ({ ...p, [vid]: [] }));
      return [];
    }
  }



  const saveEditConsumable = async () => {
    if (!selectedVehicleId || !editingCons?.id) return;
    setSavingCons(true);
    try {
      const payload: any = { mode: editingCons.mode, note: (editingCons.note ?? '').trim() };
      if (editingCons.mode === 'time') {
        if (!editingCons.start_at) { alert('start_at لازم است'); setSavingCons(false); return; }
        payload.start_at = new Date(editingCons.start_at).toISOString();
      } else {
        const n = Number(editingCons.base_odometer_km);
        if (!Number.isFinite(n)) { alert('base_odometer_km معتبر نیست'); setSavingCons(false); return; }
        payload.base_odometer_km = n;
      }
      await updateConsumable(selectedVehicleId, editingCons.id, payload);
      await refreshConsumables(selectedVehicleId, true);
      closeEditConsumable();
    } catch (e: any) {
      console.error('PATCH /consumables failed:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'خطا در ویرایش آیتم روی سرور');
    } finally { setSavingCons(false); }
  };

  const deleteConsumable = async (c: any) => {
    if (!selectedVehicleId || !c?.id) return;
    if (!confirm('آیتم حذف شود؟')) return;
    try {
      await api.delete(`/vehicles/${selectedVehicleId}/consumables/${c.id}`);
      await refreshConsumables(selectedVehicleId, true);
      if (editingCons?.id === c.id) closeEditConsumable();
    } catch (e: any) {
      console.error('DELETE /consumables failed:', e?.response?.data || e);
      alert(e?.response?.data?.message || 'حذف روی سرور ناموفق بود');
    }
  };

  const handleAddConsumable = async () => {
    if (!selectedVehicleId) return;
    try {
      const payload: any = { mode: consumableMode, note: (tripNote || '').trim() };
      if (consumableMode === 'time') {
        if (!tripDate) { alert('تاریخ لازم است'); return; }
        payload.start_at = new Date(tripDate).toISOString();
      } else {
        const base = Number(tripBaseKm ?? vehicleTlm.odometer);
        if (!Number.isFinite(base)) { alert('مقدار مبنا معتبر نیست'); return; }
        payload.base_odometer_km = base;
      }
      const { data } = await createConsumable(selectedVehicleId, payload);
      const [created] = normalizeConsumables([data]);
      setConsumablesByVid(prev => {
        const cur = prev[selectedVehicleId] || [];
        const next = created ? [created, ...cur] : cur;
        saveConsLocal(selectedVehicleId, next);
        return { ...prev, [selectedVehicleId]: next };
      });
      await refreshConsumables(selectedVehicleId, true);
      setConsumablesOpen(false);
      setTripNote(''); setTripBaseKm(null);
    } catch (err: any) {
      console.error('POST /consumables failed:', err?.response?.data || err);
      alert(err?.response?.data?.message || 'خطا در ذخیره لوازم مصرفی روی سرور');
    }
  };

  const handleTripReset = async () => {
    if (!selectedVehicleId) return;
    if (vehicleTlm.odometer == null) { alert('داده‌ی کیلومترشمار در دسترس نیست.'); return; }
    try {
      await api.post(`/vehicles/${selectedVehicleId}/trip/start`, {
        base_odometer_km: Number(vehicleTlm.odometer),
        started_at: (tripDate || new Date()).toISOString(),
        note: (tripNote || '').trim(),
      }).catch(() => { });
    } finally {
      setTripBaseKm(Number(vehicleTlm.odometer));
    }
  };


  const filteredDrivers = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return drivers;
    return drivers.filter(d =>
      (d.full_name || '').toLowerCase().includes(s) ||
      (d.phone || '').includes(s)
    );
  }, [drivers, q]);
  const filteredVehicles = React.useMemo(() => {
    if (!activeType) return [];
    const list = vehiclesByType[activeType] || [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(v => v.plate_no.toLowerCase().includes(s));
  }, [q, activeType, vehiclesByType]);
  const availableTypesKey = React.useMemo(
    () => (availableTypes.length ? [...availableTypes].sort().join(',') : ''),
    [availableTypes]
  );
  React.useEffect(() => {
    if (!parentSAId) return;
    const types = availableTypes.length
      ? availableTypes
      : (VEHICLE_TYPES.map((t) => t.code) as VehicleTypeCode[]); // fallback
    types.forEach((vt) => fetchVehiclesOfType(vt));
  }, [parentSAId, availableTypesKey, fetchVehiclesOfType]);

  // ===== Guards =====
  if (permsLoading || loading) {
    return <Box p={2} display="flex" alignItems="center" justifyContent="center">
      <CircularProgress size={24} />
    </Box>;
  }
  if (!can('view_report')) {
    return <Box p={2} color="text.secondary">دسترسی فعالی برای نمایش این صفحه برای شما تنظیم نشده است.</Box>;
  }



  // ===== UI =====
  const typeLabel = (code: VehicleTypeCode) => VEHICLE_TYPES.find(t => t.code === code)?.label || code;
  // اطمینان از سابسکرایب شدن به ایستگاه‌های یک ماشین + اولین fetch
  const TOP_HEIGHT = '75vh';         // ارتفاع پنل‌های بالا (نقشه و سایدبار)
  const SHEET_HEIGHT = 420;          // ارتفاع Bottom Sheet
  const freezeProgrammaticZoom = (m?: any) => { }; // برای ساکت‌کردن TS در این فایل

  const gfKey = (gf: Geofence, idx: number) =>
    gf.id != null ? `gf-${gf.id}` : `gf-${gf.type}-${idx}`;
  return (
    <Grid2 container spacing={2} dir="ltr">
      {/* نقشه — چپ */}
      <Grid2 xs={12} md={8}>
        <Paper
          sx={{
            height: TOP_HEIGHT,                // همان الگوی بالا
            transition: 'height .28s ease',
            overflow: 'hidden',
            position: 'relative',
          }}
          dir="rtl"
        >
          <MapContainer
            zoom={INITIAL_ZOOM}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            whenCreated={(m: RLMap) => {
              // مطابق کد بالا: فیکس زوم برنامه‌ای + invalidate
              freezeProgrammaticZoom?.(m);
              setTimeout(() => m.invalidateSize(), 0);
            }}
            style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }}
          >
            {/* مرکز/زوم اولیه (حفظ منطق خودت) */}
            <InitView center={INITIAL_CENTER} zoom={INITIAL_ZOOM} />

            {/* کاشی‌ها */}
            <TileLayer url={tileUrl} {...({ attribution: '&copy; OpenStreetMap | © MapTiler' } as any)} />

            {/* فوکوس روی نقطه */}
            <FocusOn target={focusLatLng} />
            {/* کلیک‌گیرِ انتخاب نقاط مسیر */}
            <PickPointsForRoute enabled={canRouteEdit && drawingRoute} onPick={(lat, lng) => setRoutePoints(p => [...p, { lat, lng }])} />


            {/* پیش‌نمایش مسیر در حال ترسیم */}
            {drawingRoute && routePoints.length >= 1 && (
              <>
                <Polyline positions={routePoints.map(p => [p.lat, p.lng] as [number, number])}
                  pathOptions={{ color: '#00897b', weight: 4, opacity: 0.9 }} />
                {routePoints.map((p, i) => (
                  <Marker key={`draft-${i}`} position={[p.lat, p.lng]} icon={numberedIcon(i + 1) as any} />
                ))}
              </>
            )}

            {/* کلیک‌گیر ژئوفنس (بدون تغییر منطق) */}
            {activeType && canGeoFence && selectedVehicleId && (
              <PickPointsForGeofence
                enabled={canGeoFence && gfDrawing}
                onPick={(lat, lng) => {
                  if (gfMode === 'circle') setGfCenter({ lat, lng });
                  else setGfPoly(prev => [...prev, { lat, lng }]);
                }}
              />
            )}

            {/* لایه مسیر (نمایش بدون وابستگی به تیک ادیت؛ ادیت را تیک کنترل کند) */}
            <Pane name="route-layer" style={{ zIndex: 400 }}>
              {selectedVehicleId && <RouteLayer vid={selectedVehicleId} />}
            </Pane>

            {/* پیش‌نمایش ترسیم ژئوفنس (ظاهر همسان) */}
            {gfDrawing && gfMode === 'circle' && gfCenter && (
              <Circle center={[gfCenter.lat, gfCenter.lng]} radius={gfRadius} />
            )}
            {gfDrawing && gfMode === 'polygon' && gfPoly.length >= 2 && (
              <Polygon positions={gfPoly.map(p => [p.lat, p.lng] as [number, number])} />
            )}

            {/* ژئوفنس ذخیره‌شده از سرور */}
            {selectedVehicleId && (geofencesByVid[selectedVehicleId] || []).map((gf, idx) =>
              gf.type === 'circle'
                ? <Circle key={gfKey(gf, idx)} center={[gf.center.lat, gf.center.lng]} radius={gf.radius_m} />
                : <Polygon key={gfKey(gf, idx)} positions={gf.points.map(p => [p.lat, p.lng] as [number, number])} />
            )}

            {/* لایه راننده‌ها/ماشین‌ها با z-index بالاتر مثل بالا */}
            <Pane name="vehicles-layer" style={{ zIndex: 650 }}>
              {/* راننده‌ها + مسیر لحظه‌ای راننده (حفظ منطق) */}
              {tab === 'drivers' && canTrackDrivers && filteredDrivers.map(d => (d as any).last_location && (
                <Marker
                  key={`d-${d.id}`}
                  position={[(d as any).last_location.lat, (d as any).last_location.lng]}
                  icon={driverMarkerIcon as any}
                  zIndexOffset={1000}
                >
                  <Popup><strong>{d.full_name}</strong><br />{d.phone || '—'}</Popup>
                </Marker>
              ))}
              {tab === 'drivers' && canTrackDrivers && polyline.length > 1 && <Polyline positions={polyline} />}

              {/* ماشین‌ها */}
              {activeType && canTrackVehicles && filteredVehicles.map(v => v.last_location && (
                <Marker
                  key={`v-${v.id}`}
                  position={[v.last_location.lat, v.last_location.lng]}
                  icon={vehicleMarkerIcon as any}
                  zIndexOffset={1000}
                >
                  <Popup><strong>{v.plate_no}</strong><br />{v.vehicle_type_code}</Popup>
                </Marker>
              ))}
            </Pane>

            {/* کلیک‌گیر: ایجاد ایستگاه (همان منطق) */}
            <PickPointsForStations
              enabled={!!canStations && !!addingStationsForVid}
              onPick={(lat, lng) => setTempStation({ lat, lng })}
            />
            {/* ایستگاه‌های در حالت افزودن/ویرایش */}
            {!!addingStationsForVid && canStations && (vehicleStationsMap[addingStationsForVid] || []).map(st => (
              <React.Fragment key={`add-${st.id}`}>
                <Circle center={[st.lat, st.lng]} radius={st.radius_m ?? stationRadius} />
                <Marker position={[st.lat, st.lng]} />
              </React.Fragment>
            ))}

            {/* ایستگاه‌های ماشین انتخاب‌شده */}
            {selectedVehicleId && (vehicleStationsMap[selectedVehicleId] || []).map(st => (
              <React.Fragment key={`sel-${st.id}`}>
                <Circle center={[st.lat, st.lng]} radius={st.radius_m ?? stationRadius} />
                <Marker position={[st.lat, st.lng]} />
              </React.Fragment>
            ))}

            {/* مارکر موقت ایستگاه جدید */}
            {addingStationsForVid && tempStation && (
              <>
                <Circle center={[tempStation.lat, tempStation.lng]} radius={stationRadius} />
                <Marker
                  position={[tempStation.lat, tempStation.lng]}
                  draggable
                  eventHandlers={{
                    add: (e: any) => e.target.openPopup(),
                    dragend: (e: any) => {
                      const ll = e.target.getLatLng();
                      setTempStation({ lat: ll.lat, lng: ll.lng });
                    },
                  }}
                >
                  <Popup autoClose={false} closeOnClick={false} autoPan>
                    <div style={{ minWidth: 220 }}>
                      <strong>ایجاد ایستگاه</strong>
                      <div style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>می‌توانید مارکر را جابجا کنید.</div>
                      <div style={{ marginTop: 8 }}>
                        <input
                          style={{ width: '100%', padding: 6 }}
                          placeholder="نام ایستگاه"
                          value={tempName}
                          onChange={e => setTempName(e.target.value)}
                        />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button onClick={confirmTempStation}>تایید</button>
                        <button onClick={() => setTempStation(null)}>لغو</button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}

            {/* جابه‌جایی ایستگاه در حالت ادیت */}
            {editingStation && movingStationId === editingStation.st.id && (
              <>
                <Circle center={[editingStation.st.lat, editingStation.st.lng]} radius={editingStation.st.radius_m} />
                <Marker
                  position={[editingStation.st.lat, editingStation.st.lng]}
                  draggable
                  eventHandlers={{
                    dragend: (e: any) => {
                      const ll = e.target.getLatLng();
                      setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, lat: ll.lat, lng: ll.lng } }) : ed);
                    }
                  }}
                />
              </>
            )}

            {/* اوورلی شناور استایل‌شده (فقط UI؛ بدون دست‌کاری منطق فعلی) */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 2000,
                pointerEvents: 'none',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  transform: 'scale(1.2)',
                  transformOrigin: 'top left',
                  width: 'max-content',
                  pointerEvents: 'auto',
                }}
              >
                {/* نوار کوچک وضعیت/میانبرها (سادۀ امن؛ به stateهای موجود وصل) */}
                <Paper
                  sx={(t) => ({
                    p: 0.25,
                    borderRadius: 1.5,
                    border: `1px solid ${t.palette.divider}`,
                    bgcolor: `${t.palette.background.paper}C6`,
                    backdropFilter: 'blur(6px)',
                    boxShadow: '0 6px 16px rgba(0,0,0,.18)',
                    overflow: 'hidden',
                  })}
                >
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Chip
                      size="small"
                      icon={<span>🗂️</span> as any}
                      label={tab === 'drivers' ? 'راننده‌ها' : (activeType ? typeLabel(activeType) : '—')}
                      sx={{
                        fontWeight: 700,
                        '& .MuiChip-label': { px: 0.75, py: 0.25, fontSize: 10 },
                      }}
                    />
                    <Chip
                      size="small"
                      icon={<span>📍</span> as any}
                      label={selectedVehicleId ? `VID: ${selectedVehicleId}` : 'ماشین: —'}
                      sx={{
                        border: '1px solid #00c6be55',
                        bgcolor: '#00c6be18',
                        color: '#009e97',
                        '& .MuiChip-label': { px: 0.75, py: 0.25, fontSize: 10 },
                      }}
                    />
                    {/* فقط سوییچ‌های موجود در همین کد؛ بدون اضافه‌کردن هندلر جدید */}
                    <Button
                      size="small"
                      variant={gfDrawing ? 'contained' : 'outlined'}
                      onClick={() => setGfDrawing(v => !v)}
                      disabled={!canGeoFence}
                      sx={{
                        borderRadius: 999,
                        px: 0.9,
                        minHeight: 22,
                        fontSize: 10,
                        borderColor: '#00c6be66',
                        ...(gfDrawing
                          ? { bgcolor: '#00c6be', '&:hover': { bgcolor: '#00b5ab' } }
                          : { '&:hover': { bgcolor: '#00c6be12' } }),
                        boxShadow: gfDrawing ? '0 4px 12px #00c6be44' : 'none',
                      }}
                      startIcon={<span>✏️</span>}
                    >
                      {gfDrawing ? 'پایان ژئوفنس' : 'ترسیم ژئوفنس'}
                    </Button>
                  </Stack>
                </Paper>
              </Box>
            </Box>

            {/* دیالوگ ویرایش مصرفی (همان مکان/منطق خودت) */}
            <Dialog open={!!editingCons} onClose={() => setEditingCons(null)} fullWidth maxWidth="sm">
              <DialogTitle>ویرایش آیتم مصرفی</DialogTitle>
              <DialogContent dividers>
                <Stack spacing={2}>
                  <TextField
                    label="توضیح/یادداشت"
                    value={editingCons?.note ?? ''}
                    onChange={(e) => setEditingCons((p: any) => ({ ...p, note: e.target.value }))}
                    fullWidth
                  />
                  <RadioGroup
                    row
                    value={editingCons?.mode ?? 'km'}
                    onChange={(_, v) =>
                      setEditingCons((p: any) => ({
                        ...p,
                        mode: v as 'km' | 'time',
                        start_at: v === 'time' ? (p?.start_at ?? new Date().toISOString()) : null,
                        base_odometer_km: v === 'km' ? (p?.base_odometer_km ?? 0) : null,
                      }))
                    }
                  >
                    <FormControlLabel value="km" control={<Radio />} label="بر اساس کیلومتر" />
                    <FormControlLabel value="time" control={<Radio />} label="بر اساس زمان" />
                  </RadioGroup>
                  {editingCons?.mode === 'time' ? (
                    <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                      <DateTimePicker<Date>
                        label="تاریخ یادآوری"
                        value={editingCons?.start_at ? new Date(editingCons.start_at) : null}
                        onChange={(val) => setEditingCons((p: any) => ({ ...p, start_at: val ? new Date(val).toISOString() : null }))}
                        ampm={false}
                        slotProps={{ textField: { fullWidth: true } }}
                        format="yyyy/MM/dd HH:mm"
                      />
                    </LocalizationProvider>
                  ) : (
                    <TextField
                      label="مقدار مبنا (کیلومتر)"
                      type="number"
                      value={editingCons?.base_odometer_km ?? ''}
                      onChange={(e) => setEditingCons((p: any) => ({ ...p, base_odometer_km: e.target.value ? Number(e.target.value) : null }))}
                      fullWidth
                    />
                  )}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditingCons(null)}>انصراف</Button>
                <Button variant="contained" onClick={saveEditConsumable} disabled={!canConsumables || savingCons}>ذخیره</Button>
              </DialogActions>
            </Dialog>

            {/* Snackbar (بدون تغییر منطق) */}
            {toast?.open && (
              <Snackbar
                open={toast.open}
                autoHideDuration={6000}
                onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              >
                <Alert severity="warning" onClose={() => setToast(null)} sx={{ width: '100%' }}>
                  {toast.msg}
                </Alert>
              </Snackbar>
            )}

          </MapContainer>
        </Paper>
      </Grid2>

      {/* سایدبار — راست (فقط ظاهر همسان با کارت/باکس‌ها و فاصله‌ها) */}
      <Grid2 xs={12} md={4}>
        <Paper
          sx={(t) => ({
            p: 2,
            height: TOP_HEIGHT,
            '& .leaflet-pane, & .leaflet-top, & .leaflet-bottom': { zIndex: 0 },
            display: 'flex',
            transition: 'height .28s ease',
            flexDirection: 'column',
            border: `1px solid ${t.palette.divider}`,
            borderRadius: 2,
            bgcolor: t.palette.background.paper,
          })}
          dir="rtl"
        >
          {/* بازه زمانی */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="preset-lbl">بازه</InputLabel>
              <Select labelId="preset-lbl" value={preset} label="بازه" onChange={(e) => setPreset(e.target.value as any)}>
                <MenuItem value="today">امروز</MenuItem>
                <MenuItem value="yesterday">دیروز</MenuItem>
                <MenuItem value="7d">۷ روز اخیر</MenuItem>
                <MenuItem value="custom">دلخواه</MenuItem>
              </Select>
            </FormControl>
            {preset === 'custom' && (
              <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                <DateTimePicker
                  label="از"
                  value={new Date(fromISO)}
                  onChange={(v) => v && setFromISO(new Date(v).toISOString())}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <DateTimePicker
                  label="تا"
                  value={new Date(toISO)}
                  onChange={(v) => v && setToISO(new Date(v).toISOString())}
                  slotProps={{ textField: { size: 'small' } }}
                />
              </LocalizationProvider>
            )}
          </Stack>

          {/* تب‌ها با استایل مشابه */}
          <Tabs
            value={tab}
            onChange={(_, v) => { setTab(v); setQ(''); setPolyline([]); setAddingStationsForVid(null); setTempStation(null); setEditingStation(null); setMovingStationId(null); }}
            sx={{
              mb: 1,
              minHeight: 36,
              '& .MuiTab-root': { minHeight: 36 },
              '& .MuiTabs-indicator': { backgroundColor: ACC },
              '& .MuiTab-root.Mui-selected': { color: ACC, fontWeight: 700 },
            }}
          >
            <Tab value="drivers" label="راننده‌ها" />
            {typesWithGrants.map(vt => (
              <Tab key={vt} value={vt} label={typeLabel(vt)} />
            ))}
          </Tabs>

          {/* قابلیت‌های تب فعال */}
          {activeType && (
            <Box sx={{ mb: 1.5, p: 1, border: (t) => `1px dashed ${t.palette.divider}`, borderRadius: 1 }}>
              {(grantedPerType[activeType] || []).length ? (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip size="small" color="primary" label={typeLabel(activeType)} />
                  {(grantedPerType[activeType] || []).map(k => (
                    <Chip key={`${activeType}-${k}`} size="small" variant="outlined"
                      label={MONITOR_PARAMS.find(m => m.key === k)?.label || k} />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  برای این نوع خودرو قابلیتی فعال نشده.
                </Typography>
              )}
            </Box>
          )}

          {/* تله‌متری لحظه‌ای (فقط استایل کارت‌ها) */}


          {/* جستجو با افکت فوکوس شبیه بالا */}
          <TextField
            size="small"
            placeholder={tab === 'drivers' ? 'جستجو نام/موبایل' : 'جستجو پلاک'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 1.25,
              '& .MuiOutlinedInput-root': {
                transition: 'border-color .2s ease, box-shadow .2s ease',
                '& fieldset': { borderColor: 'divider' },
                '&:hover fieldset': { borderColor: ACC },
                '&.Mui-focused': {
                  '& fieldset': { borderColor: ACC },
                  boxShadow: `0 0 0 3px ${ACC}22`,
                },
              },
            }}
          />

          {/* بادی لیست (همان منطق قبلی؛ فقط محیط کنتینر) */}
          <List sx={{ overflow: 'auto', flex: 1 }}>
            {/* ... کل بلوک لیست راننده/ماشینِ خودت بدون تغییر منطق ... */}
            {/* منطق موجودت از همینجا ادامه دارد */}
            {/* === راننده‌ها === */}
            {tab === 'drivers' ? (
              filteredDrivers.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 1 }}>نتیجه‌ای یافت نشد.</Typography>
              ) : filteredDrivers.map(d => {
                const s = statsMap[d.id] || {};
                return (
                  <ListItem
                    key={d.id}
                    divider
                    onClick={() => {
                      const ll = (d as any).last_location;
                      if (ll) setFocusLatLng([ll.lat, ll.lng]);
                    }}
                    secondaryAction={
                      <Stack direction="row" spacing={1}>
                        <Tooltip title={canTrackDrivers ? '' : 'دسترسی ردیابی ندارید'}>
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={async (ev) => {
                                ev.stopPropagation();
                                await loadVehicleRoute(d.id);
                                setSelectedVehicleId(d.id);
                              }}
                            >
                              مسیر
                            </Button>
                          </span>
                        </Tooltip>
                      </Stack>
                    }
                  >
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                      <Avatar>{d.full_name?.charAt(0) ?? 'ر'}</Avatar>
                      <Box sx={{ flex: 1 }}>
                        <ListItemText primary={d.full_name} secondary={d.phone || '—'} />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .25 }}>
                          مسافت: {s.totalDistanceKm ?? '—'} km | مدت: {s.totalDurationMin ?? '—'} min | ماموریت: {s.jobsCount ?? '—'} | خرابی: {s.breakdownsCount ?? '—'}
                        </Typography>
                      </Box>
                    </Stack>
                  </ListItem>
                );
              })
            ) : (
              // === ماشین‌ها ===
              // === ماشین‌ها ===
              (filteredVehicles.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 1 }}>ماشینی یافت نشد.</Typography>
              ) : filteredVehicles.map(v => {
                const stations = vehicleStationsMap[v.id] || [];
                const isEditingBlock = editingStation?.vid === v.id;

                return (
                  <Box key={v.id} sx={{ pb: 1 }}>
                    <ListItem
                      key={v.id}
                      divider
                      onClick={() => onPickVehicleBM(v)}
                      secondaryAction={
                        <Stack direction="row" spacing={0.5}>
                          {v.last_location && (
                            <IconButton
                              size="small"
                              title="نمایش روی نقشه"
                              onClick={(e) => { e.stopPropagation(); setFocusLatLng([v.last_location!.lat, v.last_location!.lng]); }}
                            >📍</IconButton>
                          )}







                        </Stack>
                      }
                    >
                      {routeBusyByVid[v.id] === 'loading' && (
                        <Typography variant="caption" color="text.secondary">در حال بارگذاری مسیر…</Typography>
                      )}
                      {routeMetaByVid[v.id] && (
                        <Typography variant="caption" color="text.secondary">
                          مسیر فعلی: {routeMetaByVid[v.id]?.name ?? `#${routeMetaByVid[v.id]?.id}`}
                          {routeMetaByVid[v.id]?.threshold_m ? ` — آستانه: ${routeMetaByVid[v.id]?.threshold_m} m` : ''}
                        </Typography>
                      )}

                      <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                        <Avatar>{v.plate_no?.charAt(0) ?? 'م'}</Avatar>
                        <Box sx={{ flex: 1 }}>
                          <ListItemText primary={v.plate_no} secondary={typeLabel(v.vehicle_type_code)} />
                        </Box>
                      </Stack>
                    </ListItem>





                  </Box>
                );
              }))

            )}
          </List>

          {/* دیالوگ افزودن/تنظیم مصرفی (همان منطق) */}
          <Dialog open={consumablesOpen} onClose={() => setConsumablesOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>لوازم مصرفی / مسافت از آخرین صفر</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <TextField label="توضیح/یادداشت" value={tripNote} onChange={(e) => setTripNote(e.target.value)} fullWidth />
                <RadioGroup row value={consumableMode} onChange={(_, v) => setConsumableMode((v as 'time' | 'km') ?? 'km')}>
                  <FormControlLabel value="km" control={<Radio />} label="بر اساس کیلومتر" />
                  <FormControlLabel value="time" control={<Radio />} label="بر اساس زمان" />
                </RadioGroup>
                {consumableMode === 'time' ? (
                  <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                    <DateTimePicker<Date>
                      label="تاریخ یادآوری"
                      value={tripDate}
                      onChange={(val) => setTripDate(val)}
                      ampm={false}
                      slotProps={{ textField: { fullWidth: true } }}
                      format="yyyy/MM/dd HH:mm"
                    />
                  </LocalizationProvider>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">کیلومترشمار فعلی:</Typography>
                        <Typography variant="h6">
                          {vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}
                        </Typography>
                      </Stack>
                      <TextField
                        label="مقدار مبنا (از آخرین صفر)"
                        type="number"
                        value={tripBaseKm ?? ''}
                        onChange={(e) => setTripBaseKm(e.target.value ? Number(e.target.value) : null)}
                        fullWidth
                      />
                      {!canOdometer && (
                        <Typography sx={{ mt: 1 }} variant="caption" color="warning.main">
                          برای به‌روزرسانی زنده، «کیلومترشمار» باید در سیاست‌های این نوع فعال باشد.
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConsumablesOpen(false)}>بستن</Button>
              {consumableMode === 'km' && (
                <Button variant="outlined" onClick={handleTripReset} disabled={vehicleTlm.odometer == null || !selectedVehicleId}>
                  صفر کردن از الان
                </Button>
              )}
              <Button variant="contained" onClick={handleAddConsumable} disabled={consumableMode === 'time' && !tripDate}>
                افزودن
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      </Grid2>
      {/* === ردیف سوم: پنل پایینی (Bottom Sheet) === */}
      <Grid2 xs={12}>
        <Collapse in={sheetOpen} timeout={320} unmountOnExit>
          <Paper
            dir="rtl"
            sx={(t) => ({
              position: 'relative',
              minHeight: SHEET_HEIGHT,
              p: 2,
              borderRadius: 3,
              overflow: 'hidden',
              border: `1px solid ${t.palette.divider}`,
              boxShadow: t.palette.mode === 'dark'
                ? '0 20px 60px rgba(0,0,0,.45)'
                : '0 20px 60px rgba(0,0,0,.15)',
              background: `linear-gradient(180deg, ${t.palette.background.paper} 0%, ${t.palette.background.default} 100%)`,
            })}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              {/* هدر شیت */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip
                    size="medium"
                    icon={<span>🚘</span> as any}
                    label={<Typography component="span" sx={{ fontWeight: 800 }}>
                      ماشین: {selectedVehicleId
                        ? (filteredVehicles.find(v => v.id === selectedVehicleId)?.plate_no ?? `#${selectedVehicleId}`)
                        : '—'}
                    </Typography>}
                  />
                  {/* اگر دادهٔ تله‌متری داری، مثل بالا چند چیپ دیگر هم می‌تونی نشان بدهی */}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" onClick={() => setSheetOpen(false)}>بستن</Button>
                </Stack>
              </Stack>

              {/* اکشن‌های سریع (اختیاری) */}
              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                {selectedVehicleId && (
                  <>
                    {filteredVehicles.find(v => v.id === selectedVehicleId)?.last_location && (
                      <Button
                        size="small"
                        onClick={() => {
                          const ll = filteredVehicles.find(v => v.id === selectedVehicleId)!.last_location!;
                          FocusOn?.({ target: [ll.lat, ll.lng] } as any);
                        }}
                        startIcon={<span>🎯</span>}
                      >
                        مرکز روی ماشین
                      </Button>
                    )}

                  </>
                )}
              </Stack>
              {/* === تعریف مسیر جدید === */}
              <Paper sx={{ p: 1, mt: 1, border: (t) => `1px dashed ${t.palette.divider}` }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>تعریف مسیر جدید</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <TextField
                    size="small"
                    label="نام مسیر"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    sx={{ minWidth: 180 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Threshold (m)"
                    value={routeThreshold}
                    onChange={(e) => setRouteThreshold(Math.max(1, Number(e.target.value || 0)))}
                    sx={{ width: 150 }}
                  />
                  <Button size="small" variant={drawingRoute ? 'contained' : 'outlined'} onClick={() => setDrawingRoute(v => !v)} disabled={!canRouteEdit}>
                    {drawingRoute ? 'پایان ترسیم' : 'شروع ترسیم روی نقشه'}
                  </Button>
                  <Button size="small" onClick={() => setRoutePoints(pts => pts.slice(0, -1))} disabled={!canRouteEdit || !routePoints.length}>برگشت نقطه</Button>
                  <Button size="small" onClick={() => setRoutePoints([])} disabled={!canRouteEdit || !routePoints.length}>پاک‌کردن</Button>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={!canRouteEdit || routePoints.length < 2 || !selectedVehicleId}
                    onClick={() => saveRouteAndFenceForVehicle({ vehicleId: selectedVehicleId!, name: (routeName || '').trim() || `مسیر ${new Date().toLocaleDateString('fa-IR')}`, threshold_m: Math.max(1, Number(routeThreshold || 0)), points: routePoints, toleranceM: 15 })}
                  >
                    ذخیره مسیر
                  </Button>




                </Stack>

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  روی نقشه کلیک کن تا نقاط مسیر به‌ترتیب اضافه شوند. برای ذخیره حداقل ۲ نقطه لازم است.
                </Typography>
              </Paper>

              {/* === سکشن‌ها: از منطق خودت استفاده می‌کنیم ولی بر اساس selectedVehicleId === */}
              {selectedVehicleId && (
                <Grid2 container spacing={1.25}>
                  {/* مسیر */}
                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>
                      مسیر
                    </Typography>

                    {/* وضعیت مسیر فعلی */}
                    {routeBusyByVid[selectedVehicleId] === 'loading' && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        در حال بارگذاری مسیر…
                      </Typography>
                    )}
                    {routeMetaByVid[selectedVehicleId] && (
                      <Paper sx={{ p: 1, mb: 1, border: (t) => `1px solid ${t.palette.divider}` }}>
                        <Typography variant="body2" color="text.secondary">مسیر فعلی</Typography>
                        <Typography variant="body1">
                          {routeMetaByVid[selectedVehicleId]?.name ?? `#${routeMetaByVid[selectedVehicleId]?.id}`}
                          {routeMetaByVid[selectedVehicleId]?.threshold_m
                            ? ` — آستانه: ${routeMetaByVid[selectedVehicleId]?.threshold_m} m`
                            : ''}
                        </Typography>
                      </Paper>
                    )}

                    {/* اکشن‌ها */}
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={async () => {
                          await loadVehicleRoute(selectedVehicleId);
                        }}
                      >
                        نمایش/تازه‌سازی مسیر
                      </Button>

                      <Tooltip title={canRouteEdit ? '' : 'اجازهٔ ویرایش مسیر ندارید'}>
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={!canRouteEdit}
                            onClick={async () => {
                              const routes = await listVehicleRoutes(selectedVehicleId);
                              if (!routes.length) { alert('مسیری برای این خودرو پیدا نشد.'); return; }
                              const nameList = routes.map(r => `${r.id} — ${r.name ?? 'بدون نام'}`).join('\n');
                              const pick = prompt(`Route ID را وارد کنید:\n${nameList}`, String(routes[0].id));
                              const rid = Number(pick);
                              if (!Number.isFinite(rid)) return;

                              try {
                                await setOrUpdateVehicleRoute(selectedVehicleId, { route_id: rid });
                                await loadVehicleRoute(selectedVehicleId);
                              } catch (err: any) {
                                console.error(err?.response?.data || err);
                                alert(err?.response?.data?.message || 'ثبت مسیر ناموفق بود');
                              }
                            }}
                          >
                            انتخاب مسیر
                          </Button>
                        </span>
                      </Tooltip>

                      <Tooltip title={canRouteEdit ? '' : 'اجازهٔ ویرایش مسیر ندارید'}>
                        <span>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={!canRouteEdit}
                            onClick={async () => {
                              if (!confirm('مسیر فعلی از این خودرو برداشته شود؟')) return;
                              try {
                                await clearVehicleRoute(selectedVehicleId);
                              } catch { }
                              setRouteMetaByVid(p => ({ ...p, [selectedVehicleId]: null }));
                              setRoutePolylineByVid(p => ({ ...p, [selectedVehicleId]: [] }));
                            }}
                          >
                            حذف مسیر
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Grid2>

                  {/* ایستگاه‌ها */}
                  <Grid2 xs={12} md={6} lg={4}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>ایستگاه‌ها</Typography>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <TextField
                        size="small" type="number" label="شعاع (m)" value={stationRadius}
                        onChange={(e) => setStationRadius(Math.max(1, Number(e.target.value || 0)))} sx={{ width: 130 }}
                      />
                      {canStations && (
                        <Button
                          size="small"
                          variant={addingStationsForVid === selectedVehicleId ? 'contained' : 'outlined'}
                          onClick={() => startAddingStationsFor(selectedVehicleId)}
                          disabled={!canStations}
                        >
                          {addingStationsForVid === selectedVehicleId ? 'پایان افزودن' : 'ایجاد ایستگاه'}
                        </Button>
                      )}
                    </Stack>

                    {(() => {
                      const stations = vehicleStationsMap[selectedVehicleId] || [];
                      const isEditingBlock = editingStation?.vid === selectedVehicleId;

                      return stations.length ? (
                        <List dense sx={{ maxHeight: 240, overflow: 'auto' }}>
                          {stations.map(st => {
                            const isEditing = isEditingBlock && editingStation?.st.id === st.id;
                            return (
                              <Box key={st.id}>
                                <ListItem
                                  disableGutters
                                  secondaryAction={
                                    <Stack direction="row" spacing={0.5}>
                                      <IconButton size="small" title="نمایش روی نقشه" disabled={!canStations} onClick={() => setFocusLatLng([st.lat, st.lng])}>📍</IconButton>
                                      <IconButton
                                        size="small"
                                        title="ویرایش"
                                        onClick={() => {
                                          if (isEditing) { setEditingStation(null); setMovingStationId(null); }
                                          else { setEditingStation({ vid: selectedVehicleId, st: { ...st } }); setMovingStationId(null); }
                                        }}
                                        disabled={!canStations}
                                      >✏️</IconButton>
                                      <IconButton size="small" color="error" title="حذف" disabled={!canStations} onClick={() => deleteStation(selectedVehicleId, st)}>🗑️</IconButton>
                                    </Stack>
                                  }
                                >
                                  <ListItemText primary={st.name} secondary={`${st.lat.toFixed(5)}, ${st.lng.toFixed(5)}`} />
                                </ListItem>

                                <Collapse in={isEditing} timeout="auto" unmountOnExit>
                                  <Box sx={{ mx: 1.5, mt: .5, p: 1.25, bgcolor: 'action.hover', borderRadius: 1, border: (t) => `1px solid ${t.palette.divider}` }}>
                                    <Stack spacing={1.25}>
                                      <TextField
                                        size="small" label="نام" value={editingStation?.st.name ?? ''}
                                        onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, name: e.target.value } }) : ed)}
                                      />
                                      <TextField
                                        size="small" type="number" label="شعاع (m)" value={editingStation?.st.radius_m ?? 0}
                                        onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, radius_m: Math.max(1, Number(e.target.value || 0)) } }) : ed)}
                                      />
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <Button size="small" variant={movingStationId === st.id ? 'contained' : 'outlined'} onClick={() => setMovingStationId(movingStationId === st.id ? null : st.id)}>جابجایی روی نقشه</Button>
                                        <Box flex={1} />
                                        <Button size="small" onClick={() => { setEditingStation(null); setMovingStationId(null); }}>انصراف</Button>
                                        <Button size="small" variant="contained" onClick={saveEditStation}>ذخیره</Button>
                                      </Stack>
                                    </Stack>
                                  </Box>
                                </Collapse>

                                <Divider sx={{ mt: 1 }} />
                              </Box>
                            );
                          })}
                        </List>
                      ) : (
                        <Typography color="text.secondary">ایستگاهی تعریف نشده.</Typography>
                      );
                    })()}
                  </Grid2>

                  {/* ژئوفنس */}
                  {canGeoFence && (
                    <Grid2 xs={12} md={6} lg={4}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>ژئوفنس</Typography>

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <InputLabel id="gf-mode-lbl">حالت</InputLabel>
                          <Select
                            labelId="gf-mode-lbl"
                            label="حالت"
                            value={gfMode}
                            onChange={(e) => { setGfMode(e.target.value as 'circle' | 'polygon'); setGfCenter(null); setGfPoly([]); }}
                          >
                            <MenuItem value="circle">دایره‌ای</MenuItem>
                            <MenuItem value="polygon">چندضلعی</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          size="small" type="number" label="تلورانس (m)" value={gfTolerance}
                          onChange={(e) => setGfTolerance(Math.max(0, Number(e.target.value || 0)))}
                          sx={{ width: 130 }}
                        />

                        <Button
                          size="small"
                          variant={gfDrawing ? 'contained' : 'outlined'}
                          onClick={() => setGfDrawing(v => !v)}
                          disabled={!canGeoFence}
                        >
                          {gfDrawing ? 'پایان ترسیم' : 'ترسیم روی نقشه'}
                        </Button>

                        {gfMode === 'polygon' && (
                          <>
                            <Button size="small" onClick={() => setGfPoly(pts => pts.slice(0, -1))}
                              disabled={!canGeoFence || !gfPoly.length}>
                              برگشت نقطه
                            </Button>
                            <Button size="small" onClick={() => setGfPoly([])}
                              disabled={!canGeoFence || !gfPoly.length}>
                              پاک‌کردن نقاط
                            </Button>
                          </>
                        )}

                        {gfMode === 'circle' && (
                          <TextField
                            size="small" type="number" label="شعاع (m)" value={gfRadius}
                            onChange={(e) => setGfRadius(Math.max(1, Number(e.target.value || 0)))}
                            sx={{ width: 130 }}
                            disabled={!canGeoFence}
                          />
                        )}

                        <Button
                          size="small"
                          variant="contained"
                          onClick={saveGeofenceBM}
                          disabled={!canGeoFence}
                        >
                          ذخیره ژئوفنس
                        </Button>

                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={deleteGeofenceBM}
                          disabled={!canGeoFence || !selectedVehicleId || (geofencesByVid[selectedVehicleId]?.length ?? 0) === 0}
                        >
                          حذف ژئوفنس
                        </Button>



                      </Stack>

                      <Typography variant="caption" color="text.secondary">
                        {gfMode === 'circle'
                          ? 'روی نقشه کلیک کنید تا مرکز دایره انتخاب شود، سپس شعاع را تنظیم و ذخیره کنید.'
                          : 'روی نقشه کلیک کنید تا نقاط چندضلعی به‌ترتیب اضافه شوند (حداقل ۳ نقطه).'}
                      </Typography>
                    </Grid2>
                  )}

                  {/* تله‌متری زنده */}
                  {activeType && (canIgnition || canIdleTime || canOdometer) && (
                    <Grid2 xs={12} md={6} lg={4}>
                      <Stack spacing={1} sx={{ mb: 1.5 }}>
                        {canIgnition && (
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">وضعیت سوئیچ</Typography>
                            <Typography variant="h6">
                              {vehicleTlm.ignition === true ? 'موتور روشن است'
                                : vehicleTlm.ignition === false ? 'موتور خاموش است' : 'نامشخص'}
                            </Typography>
                          </Paper>
                        )}
                        {canIdleTime && (
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">مدت توقف/سکون</Typography>
                            <Typography variant="h6">
                              {vehicleTlm.idle_time != null
                                ? `${vehicleTlm.idle_time.toLocaleString('fa-IR')} ثانیه`
                                : '—'}
                            </Typography>
                          </Paper>
                        )}
                        {canOdometer && (
                          <Paper sx={{ p: 1.25, border: (t) => `1px solid ${t.palette.divider}` }}>
                            <Typography variant="body2" color="text.secondary">کیلومترشمار</Typography>
                            <Typography variant="h6">
                              {vehicleTlm.odometer != null
                                ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km`
                                : 'نامشخص'}
                            </Typography>
                          </Paper>
                        )}
                      </Stack>
                    </Grid2>
                  )}

                  {/* لوازم مصرفی */}
                  {canConsumables && (
                    <Grid2 xs={12} lg={4}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>لوازم مصرفی</Typography>
                        <Tooltip title={canConsumables ? 'افزودن' : 'دسترسی ندارید'}>
                          <span>
                            <IconButton size="small" onClick={() => setConsumablesOpen(true)} disabled={!canConsumables}>＋</IconButton>
                          </span>
                        </Tooltip>
                        <Box flex={1} />
                        <Typography variant="caption" color="text.secondary">
                          کیلومترشمار: {vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}
                        </Typography>
                      </Stack>

                      {(() => {
                        const consStatus = consStatusByVid[selectedVehicleId];
                        const consList = consumablesByVid[selectedVehicleId] || [];
                        if (consStatus === 'loading') {
                          return (
                            <Box display="flex" alignItems="center" gap={1} color="text.secondary" sx={{ mt: .5 }}>
                              <CircularProgress size={16} /> در حال دریافت…
                            </Box>
                          );
                        }
                        if (consStatus === 'error') return <Typography color="warning.main">خطا در دریافت. دوباره تلاش کنید.</Typography>;
                        if (!consList.length) return <Typography color="text.secondary">آیتمی ثبت نشده.</Typography>;
                        return (
                          <List dense sx={{ maxHeight: 240, overflow: 'auto' }}>
                            {consList.map((c: any, i: number) => (
                              <ListItem
                                key={c.id ?? i}
                                divider
                                secondaryAction={
                                  <Stack direction="row" spacing={0.5}>
                                    <span>
                                      <IconButton
                                        size="small"
                                        title="ویرایش"
                                        onClick={() => openEditConsumable(c)}
                                        disabled={!canConsumables}
                                      >✏️</IconButton>
                                    </span>
                                    <span>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        title="حذف"
                                        onClick={() => deleteConsumable(c)}
                                        disabled={!canConsumables}
                                      >🗑️</IconButton>
                                    </span>
                                  </Stack>
                                }
                              >
                                <ListItemText
                                  primary={c.title ?? c.note ?? 'آیتم'}
                                  secondary={
                                    <>
                                      {c.mode === 'km' ? 'بر اساس کیلومتر' : 'بر اساس زمان'}
                                      {c.created_at && <> — {new Date(c.created_at).toLocaleDateString('fa-IR')}</>}
                                    </>
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                        );
                      })()}
                    </Grid2>
                  )}
                </Grid2>
              )}


              {!selectedVehicleId && (
                <Typography color="text.secondary">برای مشاهده تنظیمات، یک ماشین را از لیست انتخاب کنید.</Typography>
              )}
            </Box>
          </Paper>
        </Collapse>
      </Grid2>
    </Grid2>
  );




  function FitToGeofences({ items }: { items: Geofence[] }) {
    const map = useMap();
    React.useEffect(() => {
      if (!items || !items.length) return;
      const bounds = L.latLngBounds([]);
      items.forEach(g => {
        if (g.type === 'circle') {
          const b = L.circle([g.center.lat, g.center.lng], { radius: g.radius_m }).getBounds();
          bounds.extend(b);
        } else {
          g.points.forEach(p => bounds.extend([p.lat, p.lng]));
        }
      });
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
    }, [items, map]);
    return null;
  }
}

// ---- Vehicle option handlers ----
type VehicleOptionHandlerCtx = {
  vehicle: Vehicle;
  userId: number;
  fromISO: string;
  toISO: string;
  api: typeof api;
  socket: Socket | null;
};

const vehicleOptionHandlers: Partial<Record<MonitorKey, (ctx: VehicleOptionHandlerCtx) => void | Promise<void>>
> = {
  gps: async ({ vehicle, api, fromISO, toISO }: VehicleOptionHandlerCtx) => {
    await api
      .get('/tracks', { params: { vehicle_id: vehicle.id, from: fromISO, to: toISO } })
      .catch(() => null);
    console.log('[handler:gps] preloaded track for vehicle', vehicle.id);
  },

  ignition: ({ vehicle, socket }: VehicleOptionHandlerCtx) => {
    socket?.emit?.('subscribe', { topic: `vehicle/${vehicle.id}/ignition` });
    console.log('[handler:ignition] subscribed for vehicle', vehicle.id);
  },

  idle_time: ({ vehicle }: VehicleOptionHandlerCtx) => {
    console.log('[handler:idle_time] will compute idling for vehicle', vehicle.id);
  },

  odometer: ({ vehicle }: VehicleOptionHandlerCtx) => {
    console.log('[handler:odometer] fetch/compute odometer for vehicle', vehicle.id);
  },

  engine_temp: ({ vehicle }: VehicleOptionHandlerCtx) => {
    console.log('[handler:engine_temp] watching engine temp for vehicle', vehicle.id);
  },

  geo_fence: ({ vehicle }: VehicleOptionHandlerCtx) => {
    console.log('[handler:geo_fence] geofence checks for vehicle', vehicle.id);
  },

  stations: (ctx: VehicleOptionHandlerCtx) => {
    const { vehicle, socket, userId } = ctx;
    socket?.emit?.('subscribe', { topic: `vehicle/${vehicle.id}/stations/${userId}` });
    console.log('[handler:stations] subscribed', vehicle.id, userId);
  },

  routes: ({ vehicle, socket }: VehicleOptionHandlerCtx) => {
    socket?.emit?.('subscribe', { topic: `vehicle/${vehicle.id}:route` });
    console.log('[handler:routes] subscribed for vehicle', vehicle.id);
  },

  consumables: async ({ vehicle, api }: VehicleOptionHandlerCtx) => {
    await api.get(`/vehicles/${vehicle.id}/consumables`).catch(() => null);
    console.log('[handler:consumables] prefetch for vehicle', vehicle.id);
  },
};

// ✅ ساده و درست
async function fetchRouteStations(rid: number) {
  try {
    const { data } = await api.get(`/routes/${rid}/stations`);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('fetchRouteStations error:', e);
    return [];
  }
}


function runVehicleOptionHandlers(
  vehicle: Vehicle,
  options: string[],
  ctxBase: Omit<VehicleOptionHandlerCtx, 'vehicle'>
) {
  const ctx = { ...ctxBase, vehicle };
  options.forEach((k) => {
    const fn = vehicleOptionHandlers[k as MonitorKey];
    if (fn) fn(ctx);
  });
}

export default function DriversManagementPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[DriversManagementPage] fetching /auth/me...');
    (async () => {
      try {
        const { data: me } = await api.get('/auth/me');
        console.log('[DriversManagementPage] current user:', me);
        setUser(me);
      } catch (err) {
        console.error('[DriversManagementPage] /auth/me error:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    console.log('[DriversManagementPage] loading...');
    return (
      <Box p={2} display="flex" justifyContent="center" alignItems="center" height="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    console.warn('[DriversManagementPage] no user found');
    return <Typography color="error">کاربر یافت نشد</Typography>;
  }

  let content: React.ReactNode;
  switch (user.role_level) {
    case 1: content = <ManagerRoleSection user={user} />; break;
    case 2: content = <SuperAdminRoleSection user={user} />; break;
    case 3: content = <BranchManagerRoleSection user={user} />; break;
    case 4: content = <OwnerRoleSection user={user} />; break;
    case 5: content = <TechnicianRoleSection user={user} />; break;
    case 6: content = <DriverRoleSection user={user} />; break;
    default: content = <Typography>نقش پشتیبانی نمی‌شود</Typography>;
  }

  return (
    <Box p={2}>
      <Typography variant="h6" gutterBottom>مدیریت رانندگان</Typography>
      <Paper sx={{ p: 2 }}>{content}</Paper>
    </Box>
  );
}
function FeatureCards({
  enabled,
  telemetry,
}: {
  enabled: string[];
  telemetry: { ignition?: boolean; idle_time?: number; odometer?: number };
}) {
  const showIgnition = enabled.includes('ignition');
  const showIdle = enabled.includes('idle_time');
  const showOdo = enabled.includes('odometer');

  if (!showIgnition && !showIdle && !showOdo) return null;

  const fmtDur = (s?: number) => {
    if (s == null) return 'نامشخص';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h ? `${h}ساعت` : '', m ? `${m}دقیقه` : '', `${sec}ثانیه`].filter(Boolean).join(' ');
  };
  const fmtKm = (km?: number) => (km == null ? 'نامشخص' : `${km.toLocaleString('fa-IR')} km`);

  return (
    <Grid2 container spacing={2} sx={{ mb: 2 }}>
      {showIgnition && (
        <Grid2 xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">وضعیت سوئیچ</Typography>
            <Typography variant="h6" sx={{ mt: 1 }}>
              {telemetry.ignition ? 'موتور روشن است' : 'موتور خاموش است'}
            </Typography>
          </Paper>
        </Grid2>
      )}
      {showIdle && (
        <Grid2 xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">مدت توقف/سکون</Typography>
            <Typography variant="h6" sx={{ mt: 1 }}>{fmtDur(telemetry.idle_time)}</Typography>
          </Paper>
        </Grid2>
      )}
      {showOdo && (
        <Grid2 xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">کیلومترشمار</Typography>
            <Typography variant="h6" sx={{ mt: 1 }}>{fmtKm(telemetry.odometer)}</Typography>
          </Paper>
        </Grid2>
      )}

    </Grid2>
  );
}
export const VEHICLE_TYPES = [
  { code: "bus", label: "اتوبوس" },
  { code: "minibus", label: "مینی‌بوس" },
  { code: "van", label: "ون" },
  { code: "tanker", label: "تانکر" },
  { code: "truck", label: "کامیون" },
  { code: "khavar", label: "خاور" },
  { code: "sedan", label: "سواری" },
  { code: "pickup", label: "وانت" }
] as const;







type RoleLevel = 1 | 2 | 3 | 4 | 5 | 6;

type Station = { name: string; lat: number; lng: number; radius_m: number; order_no?: number };
type LatLng = { lat: number; lng: number };
type Geofence =
  | { type: 'circle'; center: LatLng; radius_m: number; tolerance_m?: number }
  | { type: 'polygon'; points: LatLng[]; tolerance_m?: number };
type ConsumableItem =
  | { mode: 'time'; note?: string; start_at: string }
  | { mode: 'km'; note?: string; base_odometer_km: number };

type VehicleSettingsProfile = {
  stations?: Station[];
  geofence?: Geofence | null;
  consumables?: ConsumableItem[];
};

// اینو هرجا خواستی از بک‌اند بگیری
async function getUserPermissions(api: typeof import('../services/api').default, userId: number): Promise<string[]> {
  const { data } = await api.get(`/role-permissions/user/${userId}`);
  return (data || []).filter((p: any) => p.is_allowed).map((p: any) => p.action);
}

export async function applyVehicleProfile(
  api: typeof import('../services/api').default,
  vehicleId: number,
  profile: VehicleSettingsProfile,
  userId: number,
  roleLevel: RoleLevel,
  _opts?: { stationsMode?: 'replace' | 'append' } // عملاً نادیده می‌گیریم: همیشه replace
) {
  const result: any = { ok: true, applied: {}, errors: [] };

  // رول 1 = همه مجاز؛ بقیه = دریافت پرمیشن‌ها
  let permissions: string[] = [];
  if (roleLevel !== 1) {
    try {
      permissions = await getUserPermissions(api, userId);
    } catch {
      return { ok: false, applied: {}, errors: ['خطا در دریافت پرمیشن‌ها'] };
    }
  }

  // کمکی‌ها
  const getList = (data: any): any[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data?.items)) return data.data.items;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.list)) return data.list;
    if (Array.isArray(data?.result)) return data.result;
    return [];
  };

  const deleteAllStations = async () => {
    // 404 را خطا حساب نکن
    const res = await api.get(`/vehicles/${vehicleId}/stations`, {
      validateStatus: s => s < 500,
      params: { _: Date.now() },
      headers: { 'Cache-Control': 'no-store' },
    });
    if (res.status === 404) return 0;

    const items = getList(res.data).filter((s: any) => s?.id != null);
    await Promise.allSettled(
      items.map((s: any) => api.delete(`/vehicles/${vehicleId}/stations/${s.id}`))
    );
    return items.length;
  };

  const createStations = async (stations: any[]) => {
    let created = 0;
    for (const s of stations) {
      try {
        await api.post(`/vehicles/${vehicleId}/stations`, {
          id: undefined, // اگر بک‌اند حساس است
          name: s.name,
          lat: Number(s.lat ?? s.latitude ?? s.location?.lat ?? (Array.isArray(s) ? s[1] : NaN)),
          lng: Number(s.lng ?? s.lon ?? s.longitude ?? s.location?.lng ?? (Array.isArray(s) ? s[0] : NaN)),
          radius_m: Number(s.radius_m ?? s.radiusM ?? s.radius ?? 60),
          order_no: s.order_no ?? s.orderNo ?? s.order,
        });
        created++;
      } catch (e) {
        result.errors.push(`ثبت ایستگاه ناموفق: ${s?.name ?? ''}`);
      }
    }
    return created;
  };

  const clearGeofence = async () => {
    await api
      .delete(`/vehicles/${vehicleId}/geofence`, { validateStatus: s => s < 500 })
      .catch(() => { });
  };

  try {
    // ---------- ژئوفنس: همیشه اول پاک ----------
    if (roleLevel === 1 || permissions.includes('geo_fence')) {
      await clearGeofence();
      if (profile.geofence) {
        // پذیرش هر دو شکل circle / polygon
        const gf = profile.geofence as any;
        if (gf.type === 'circle') {
          await api.post(`/vehicles/${vehicleId}/geofence`, {
            type: 'circle',
            centerLat: Number(gf.center?.lat),
            centerLng: Number(gf.center?.lng),
            radiusM: Math.max(1, Number(gf.radius_m)),
            toleranceM: Math.max(0, Number(gf.tolerance_m ?? gf.toleranceM ?? 0)),
          });
        } else if (gf.type === 'polygon') {
          const pts = (gf.points || []).map((p: any) => ({
            lat: Number(p.lat ?? p[1]),
            lng: Number(p.lng ?? p[0]),
          }));
          if (pts.length >= 3) {
            await api.post(`/vehicles/${vehicleId}/geofence`, {
              type: 'polygon',
              polygonPoints: pts,
              toleranceM: Math.max(0, Number(gf.tolerance_m ?? gf.toleranceM ?? 0)),
            });
          } else {
            result.errors.push('ژئوفنس چندضلعی کمتر از ۳ نقطه دارد.');
          }
        } else {
          result.errors.push('نوع ژئوفنس نامعتبر است.');
        }
        result.applied.geofence = true;
      } else {
        // فقط پاک شد و چیزی نساختیم
        result.applied.geofence = 'cleared';
      }
    }

    // ---------- ایستگاه‌ها: همیشه replace ----------
    if (roleLevel === 1 || permissions.includes('stations')) {
      const removed = await deleteAllStations();
      if (profile.stations?.length) {
        const created = await createStations(profile.stations);
        result.applied.stations = { removed, created };
      } else {
        result.applied.stations = { removed, created: 0 };
      }
    }

    // ---------- مصرفی‌ها: (اگر می‌خواهی این هم replace باشد) ----------
    if (profile.consumables && (roleLevel === 1 || permissions.includes('consumables'))) {
      // پاک‌کردن همه
      const res = await api.get(`/vehicles/${vehicleId}/consumables`, {
        validateStatus: s => s < 500,
        params: { _: Date.now() },
        headers: { 'Cache-Control': 'no-store' },
      });
      const exist = res.status === 404 ? [] : getList(res.data);
      await Promise.allSettled(
        exist.filter((c: any) => c?.id != null).map((c: any) => api.delete(`/vehicles/${vehicleId}/consumables/${c.id}`))
      );

      // ساختن جدیدها
      let created = 0;
      for (const c of profile.consumables) {
        try {
          await api.post(`/vehicles/${vehicleId}/consumables`, c);
          created++;
        } catch {
          result.errors.push('ثبت آیتم مصرفی ناموفق بود');
        }
      }
      result.applied.consumables = { removed: exist.length, created };
    }
  } catch (e: any) {
    result.ok = false;
    result.errors.push(e?.response?.data?.message ?? e?.message ?? 'خطای نامشخص هنگام اعمال پروفایل');
  }

  return result;
}

type SettingsProfile = {
  id: number; // شناسه یکتا از دیتابیس
  name: string;
  settings: {
    stations: TmpStation[];
    geofence: TmpGeofence | null;
  };
};












