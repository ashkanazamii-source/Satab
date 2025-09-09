'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Collapse } from '@mui/material';
import {
  Box, Typography, CircularProgress, Paper, IconButton, Chip, ListItemAvatar, Accordion, AccordionSummary, AccordionDetails, Divider,
  List, ListItem, ListItemText, Avatar, Stack, TextField, InputAdornment, Tabs, Tab, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import * as L from 'leaflet';
import SearchIcon from '@mui/icons-material/Search';
import api from '../services/api';
import './mapStyles.css';
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

// ✅ تایپ نقشه از خود useMap

type RLMap = ReturnType<typeof useMap>;
const ACC = '#00c6be'; // فیروزه‌ای اکسنت، نه رو کل UI
const royal = '#00c6be'; // فیروزه‌ای اکسنت، نه رو کل UI



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

function FitToLatLngs({ latlngs }: { latlngs: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!latlngs.length) return;
    const b = L.latLngBounds(latlngs);
    if (!b.isValid()) return;
    if (b.getNorthEast().equals(b.getSouthWest())) {
      map.setView(b.getNorthEast(), Math.min(Math.max(map.getZoom(), 16), MAX_ZOOM));
    } else {
      map.fitBounds(b, { padding: [60, 60] });
      if (map.getZoom() > MAX_ZOOM) map.setZoom(MAX_ZOOM);
      if (map.getZoom() < MIN_ZOOM) map.setZoom(MIN_ZOOM);
    }
  }, [latlngs, map]);
  return null;
}

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
  useMapEvent('click', (e) => {
    if (enabled) onPick(e.latlng.lat, e.latlng.lng);
  });
  return null;
}

/* ------------ Sections ------------ */

function ManagerRoleSection({ user }: { user: User }) {
  const ALL_KEYS: MonitorKey[] = MONITOR_PARAMS.map(m => m.key);
  const TELEMETRY_KEYS: MonitorKey[] = ['ignition', 'idle_time', 'odometer', 'engine_temp'];
  const POS_TOPIC = (vid: number, uid: number) => `vehicle/${vid}/pos/${uid}`;
  const STATIONS_TOPIC = (vid: number, uid: number) => `vehicle/${vid}/stations/${uid}`;
  const [useMapTiler, setUseMapTiler] = useState(Boolean(MT_KEY));
  const STATIONS_PUBLIC_TOPIC = (vid: number) => `vehicle/${vid}/stations`;
  const mapRef = React.useRef<RLMap | null>(null);
  const focusMaxZoom = React.useCallback((lat: number, lng: number) => {
    const m = mapRef.current;
    if (!m) return;
    const maxZ = m.getMaxZoom?.() ?? 19;
    m.setView([lat, lng], maxZ, { animate: true });
  }, []);
  const tileUrl = useMapTiler && MT_KEY
    ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MT_KEY}`
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

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

  const [supers, setSupers] = useState<FlatUser[]>([]);
  const [driversBySA, setDriversBySA] = useState<Record<number, FlatUser[]>>({});
  const [vehiclesBySA, setVehiclesBySA] = useState<Record<number, Vehicle[]>>({});

  const [qSA, setQSA] = useState('');
  const [selectedSAId, setSelectedSAId] = useState<number | null>(null);
  const [tabSA, setTabSA] = useState<'drivers' | 'vehicles'>('drivers');

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
  const [polyline, setPolyline] = useState<[number, number][]>([]);

  // سابسکرایب‌های فعال برای POS و تله‌متری
  const lastPosSubRef = useRef<number | null>(null);
  const lastTelemSubRef = useRef<{ vid: number; keys: MonitorKey[] } | null>(null);

  // مسیر فعلی
  type VehicleRoute = { id: number; name: string; threshold_m?: number; points?: RoutePoint[] };
  const [vehicleRoute, setVehicleRoute] = useState<VehicleRoute | null>(null);
  const [drawingRoute, setDrawingRoute] = useState(false);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [routeThreshold, setRouteThreshold] = useState<number>(60);
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
  // بالای فایل، کنار تایپ Station:
  // جایگزین همین الان در ManagerRoleSection
  const normalizeStations = (payload: any): Station[] => {
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

    const list = src.map((s: any) => ({
      id: s.id ?? s._id ?? s.station_id ?? s.stationId,          // ← انواع id
      name: String(s.name ?? s.title ?? 'ایستگاه').trim(),
      lat: toNum(s.lat ?? s.latitude ?? s.location?.lat ?? (Array.isArray(s) ? s[1] : undefined)),
      lng: toNum(s.lng ?? s.lon ?? s.longitude ?? s.location?.lng ?? (Array.isArray(s) ? s[0] : undefined)),
      radius_m: toNum(s.radius_m ?? s.radiusM ?? s.radius ?? 60),
      order_no: s.order_no ?? s.orderNo ?? s.order,
    }))
      .filter(s => s.id != null && Number.isFinite(s.lat) && Number.isFinite(s.lng));

    // dedupe + sort
    const map = new Map<string, Station>();
    list.forEach(s => map.set(String(s.id), s as any));
    return [...map.values()].sort((a: any, b: any) => (a.order_no ?? 0) - (b.order_no ?? 0));
  };


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

  // اگر نداری:


  // ====== Normalizer (قالب‌های مختلف API را می‌بلعد) ======
  /*const normalizeStations = React.useCallback((payload: any): Station[] => {
    const src: any[] =
      Array.isArray(payload) ? payload :
        Array.isArray(payload?.items) ? payload.items :
          Array.isArray(payload?.data?.items) ? payload.data.items :
            Array.isArray(payload?.data) ? payload.data :
              Array.isArray(payload?.rows) ? payload.rows :
                Array.isArray(payload?.list) ? payload.list :
                  [];

    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    };

    const list = src
      .map((s) => ({
        id: s.id ?? s._id,
        name: s.name ?? s.title ?? 'ایستگاه',
        lat: toNum(s.lat ?? s.latitude ?? s.location?.lat),
        lng: toNum(s.lng ?? s.longitude ?? s.location?.lng),
        radius_m: toNum(s.radius_m ?? s.radiusM ?? s.radius ?? 60),
        order_no: s.order_no ?? s.orderNo ?? s.order ?? undefined,
      }))
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && s.id != null);

    // dedupe + sort
    const map = new Map<number, Station>();
    list.forEach((s) => map.set(Number(s.id), s));
    return Array.from(map.values()).sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0));
  }, []);
*/
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
    useMapEvent('click', (e) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }
  function FitToLatLngs({ latlngs }: { latlngs: [number, number][] }) {
    const map = useMap();
    useEffect(() => {
      if (!latlngs.length) return;
      // @ts-ignore
      const bounds = (window as any).L?.latLngBounds ? (window as any).L.latLngBounds(latlngs) : null;
      if (bounds && bounds.isValid()) map.fitBounds(bounds.pad(0.2));
    }, [latlngs, map]);
    return null;
  }

  // ====== Helpers ======
  const normNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

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

  /*  useEffect(() => {
      const s = socketRef.current;
      if (!s) return;
  
      const onStations = (msg: any) => {
        // تشخیص vid از پیام، یا آخرین سابسکرایب، یا ماشین انتخاب‌شده
        const vid = Number(
          msg?.vehicle_id ?? msg?.vehicleId ??
          lastStationsSubRef.current?.vid ?? selectedVehicle?.id
        );
        if (!Number.isFinite(vid)) return;
  
        setVehicleStationsMap(prev => {
          const cur = (prev[vid] || []).slice();
  
          // اگر بک‌اند لیست کامل فرستاد
          if (Array.isArray(msg?.stations)) {
            const list = normalizeStations(msg.stations);
            return { ...prev, [vid]: list };
          }
  
          // created/updated با یک station
          if ((msg?.type === 'created' || msg?.type === 'updated') && msg?.station) {
            const sNorm = normalizeStations([msg.station])[0];
            if (!sNorm) return prev;
            const i = cur.findIndex(x => x.id === sNorm.id);
            if (i === -1) cur.push(sNorm); else cur[i] = sNorm;
            return { ...prev, [vid]: cur };
          }
  
          // deleted با station_id
          const delId = Number(msg?.station_id ?? msg?.stationId);
          if (msg?.type === 'deleted' && Number.isFinite(delId)) {
            const next = cur.filter(x => x.id !== delId);
            return { ...prev, [vid]: next };
          }
  
          return prev;
        });
      };
  
      s.on('vehicle:stations', onStations);
      return () => { s.off('vehicle:stations', onStations); };
    }, []); // ← وابستگی به selectedVehicle لازم نیست
  */



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
      // اگر ماشین انتخاب شده همین است، فوکوس و پلی‌لاین را آپدیت کن
      if (selectedVehicle?.id === id) {
        setFocusLatLng([v.lat, v.lng]);
        setPolyline(prev => {
          const arr = [...prev, [v.lat, v.lng] as [number, number]];
          if (arr.length > 2000) arr.shift();
          return arr;
        });
      }
      // در لیست currentVehicles هم آخرین لوکیشن را تازه کن (برای SA انتخاب‌شده)
      if (selectedSAId) {
        setVehiclesBySA(prev => {
          const list = (prev[selectedSAId] || []).slice();
          const i = list.findIndex(x => x.id === id);
          if (i >= 0) list[i] = { ...list[i], last_location: { lat: v.lat, lng: v.lng } };
          return { ...prev, [selectedSAId]: list };
        });
      }
    },
    [selectedVehicle?.id, selectedSAId]
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

    return () => {
      // Unsubscribeهای باز مانده
      if (lastPosSubRef.current != null) {
        s.emit('unsubscribe', { topic: POS_TOPIC(lastPosSubRef.current, user.id) });
        lastPosSubRef.current = null;
      }
      if (lastTelemSubRef.current) {
        const { vid, keys } = lastTelemSubRef.current;
        keys.forEach(k => s.emit('unsubscribe', { topic: `vehicle/${vid}/${k}` }));
        lastTelemSubRef.current = null;
      }
      if (lastStationsSubRef.current) {
        const { vid, uid } = lastStationsSubRef.current;
        s.emit('unsubscribe', { topic: STATIONS_TOPIC(vid, uid) });
        s.emit('unsubscribe', { topic: STATIONS_PUBLIC_TOPIC(vid) }); // اگه جایی سابسکرایبش کردی
        lastStationsSubRef.current = null;
      }

      s.disconnect();
      socketRef.current = null;
    };
  }, []); // ← نه به onVehiclePos وابسته‌اش کن، نه به بقیه


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
        const withDrivers = superAdmins.find(sa => (grouped[sa.id]?.length || 0) > 0);
        setSelectedSAId(withDrivers?.id ?? superAdmins[0]?.id ?? null);
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


  type RoutePoint = { lat: number; lng: number;[k: string]: any };

  async function loadCurrentRoute(vid: number) {
    try {
      // اگر ایستگاه‌ها را از قبل داریم، همان‌ها را به‌عنوان نقاط مسیر استفاده کن
      const cached = vehicleStationsMap[vid];
      const th0 = routeThresholdRef.current ?? 60;

      if (Array.isArray(cached) && cached.length) {
        setVehicleRoute({
          id: -1,
          name: 'مسیر',
          threshold_m: th0,
          points: cached, // lat/lng حاضر و آماده
        });
        setRouteThreshold(th0);
        return;
      }

      // 404 را به‌عنوان نتیجه‌ی عادی بپذیر (reject نشود)
      const getMaybe = (url: string) =>
        api.get(url, {
          validateStatus: (s) => s < 500,         // 404 => resolve می‌شود
          params: { _: Date.now() },
          headers: { 'Cache-Control': 'no-store' },
        }).then(res => (res.status === 404 ? null : res.data));

      // فقط اندپوینت‌های موجود روی بک‌اند خودت
      const candidates = [
        `/vehicles/${vid}/stations`,
        // اگر واقعاً اندپوینت‌های routes دارید، بعداً این دو تا را اضافه کن:
        // `/routes/${rid}/stations`,
        // `/routes/${rid}/points`,
      ];

      let raw: any[] = [];
      for (const u of candidates) {
        const d = await getMaybe(u);
        const arr = Array.isArray(d) ? d : (Array.isArray(d?.items) ? d.items : null);
        if (Array.isArray(arr) && arr.length) { raw = arr; break; }
      }

      const pts = (raw || [])
        .map((p: any) => ({
          lat: Number(p.lat ?? p.latitude ?? p[1]),
          lng: Number(p.lng ?? p.lon ?? p.longitude ?? p[0]),
          ...p,
        }))
        .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

      setVehicleRoute({
        id: -1,
        name: 'مسیر',
        threshold_m: th0,
        points: pts,
      });
      setRouteThreshold(th0);
    } catch {
      setVehicleRoute(null);
    }
  }

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
  const onPickVehicle = useCallback(async (v: Vehicle) => {
    const s = socketRef.current;

    // 0) آن‌سابسکرایب‌های قبلی
    if (s && lastPosSubRef.current != null) {
      s.emit('unsubscribe', { topic: POS_TOPIC(lastPosSubRef.current, user.id) });
      lastPosSubRef.current = null;
    }
    if (s && lastTelemSubRef.current) {
      const { vid, keys } = lastTelemSubRef.current;
      keys.forEach(k => s.emit('unsubscribe', { topic: `vehicle/${vid}/${k}` }));
      lastTelemSubRef.current = null;
    }
    if (s && lastStationsSubRef.current) {
      const { vid, uid } = lastStationsSubRef.current;
      s.emit('unsubscribe', { topic: STATIONS_TOPIC(vid, uid) });
      s.emit('unsubscribe', { topic: STATIONS_PUBLIC_TOPIC(vid) });
      lastStationsSubRef.current = null;
    }

    // 1) انتخاب و ریست UI
    setSelectedVehicle(v);
    if (v.last_location) setFocusLatLng([v.last_location.lat, v.last_location.lng]);
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
    setSelectedVehicle(v);
    // Consumables: ریست + اسنپ‌شات محلی
    setConsumables([]); setConsumablesStatus('loading');
    const localSnap = loadConsumablesFromStorage(v.id);
    if (localSnap.length) { setConsumables(localSnap); setConsumablesStatus('loaded'); }

    // 2) منیجر = همه امکانات
    setVehicleOptions(ALL_KEYS);

    // 3) داده‌های هم‌زمان (ایستگاه‌ها + ژئوفنس)
    await Promise.allSettled([
      ensureStationsLive(v.id),   // ← ساب + فچ (تاپیک scoped + public)
      loadVehicleGeofences(v.id),
    ]);

    // 4) مسیر فعلی (نسخه‌ی درست و منعطف)
    await loadCurrentRoute(v.id);

    // 5) تله‌متری اولیه
    try {
      const { data } = await api.get(`/vehicles/${v.id}/telemetry`, { params: { keys: TELEMETRY_KEYS } });
      setVehicleTlm({
        ignition: data?.ignition ?? undefined,
        idle_time: data?.idle_time ?? undefined,
        odometer: data?.odometer ?? undefined,
        engine_temp: data?.engine_temp ?? undefined,
      });
    } catch { setVehicleTlm({}); }

    // 6) سابسکرایب POS و تله‌متری‌ها (ایستگاه‌ها قبلاً سابسکرایب شده‌اند)
    if (s) {
      s.emit('subscribe', { topic: POS_TOPIC(v.id, user.id) });
      lastPosSubRef.current = v.id;

      const telemKeys = TELEMETRY_KEYS;
      telemKeys.forEach(k => s.emit('subscribe', { topic: `vehicle/${v.id}/${k}` }));
      lastTelemSubRef.current = { vid: v.id, keys: telemKeys };
    }

    // 7) سینک لوازم مصرفی از سرور
    refreshConsumables(v.id);
  }, [ensureStationsLive, loadVehicleGeofences, refreshConsumables, user.id]);



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

  function InitView({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();
    useEffect(() => {
      map.setView(center, zoom);
      // فقط بار اول
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }

  function FocusOn({ target }: { target?: [number, number] }) {
    const map = useMap();
    useEffect(() => {
      if (target) map.setView(target);
    }, [target, map]);
    return null;
  }
  // پنل پایینی وقتی ماشین انتخاب شده باز باشه (مثل SuperAdmin)
  const TOP_HEIGHT = sheetOpen ? { xs: '50vh', md: '55vh' } : '75vh';
  const SHEET_HEIGHT = { xs: 360, md: 320 };

  // ---- Types (اختیاری ولی مفید برای TS) ----
  type LatLng = { lat: number; lng: number };
  type CircleGeofence = { type: 'circle'; center: LatLng; radius_m: number; tolerance_m?: number };
  type PolygonGeofence = { type: 'polygon'; points: LatLng[]; tolerance_m?: number };

  // ---- Geofence store (اگر قبلاً تعریف نکردی) ----


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
            style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }} // ⬅️ پایین
            whenCreated={(m: RLMap) => {
              mapRef.current = m;
              setTimeout(() => m.invalidateSize(), 0);
            }}
          >
            <InitView center={INITIAL_CENTER} zoom={INITIAL_ZOOM} />
            <TileLayer url={tileUrl} {...({ attribution: '&copy; OpenStreetMap | © MapTiler' } as any)} />
            <FocusOn target={focusLatLng} />
            <FitToLatLngs latlngs={markerLatLngs} />

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
            {drawingRoute && (
              <PickPoints enabled onPick={(lat, lng) => setRoutePoints(prev => [...prev, { lat, lng }])} />
            )}

            {/* پیش‌نمایش مسیرِ در حال ترسیم */}
            {drawingRoute && routePoints.length > 1 && (
              <Polyline
                positions={routePoints.map(p => [p.lat, p.lng] as [number, number])}
                pathOptions={{ dashArray: '6 6' }}
              />
            )}

            {/* پیش‌نمایش ژئوفنسِ در حال ترسیم */}
            {gfDrawing && gfMode === 'circle' && gfCenter && (
              <Circle center={[gfCenter.lat, gfCenter.lng]} radius={gfRadius} />
            )}
            {gfDrawing && gfMode === 'polygon' && gfPoly.length >= 2 && (
              <Polygon
                positions={gfPoly.map(p => [p.lat, p.lng] as [number, number])}
                pathOptions={{ dashArray: '6 6' }}
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
                <Circle center={[st.lat, st.lng]} radius={st.radius_m ?? stationRadius} />
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
                        <button
                          onClick={() => {
                            setEditingStation({ vid: selectedVehicle.id, st: { ...st } });
                            setMovingStationId(null);
                          }}
                        >
                          ویرایش
                        </button>
                        <button onClick={() => deleteStation(selectedVehicle.id, st)} style={{ color: '#c00' }}>
                          حذف
                        </button>
                        <button onClick={() => setFocusLatLng([st.lat, st.lng])}>
                          نمایش روی نقشه
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            ))}

            {/* مارکر موقت ایستگاه جدید + Popup تایید */}
            {selectedVehicle && addingStationsForVid === selectedVehicle.id && tempStation && (
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

            {/* ژئوفنس‌های ذخیره‌شده */}
            {selectedVehicle && (geofencesByVid[selectedVehicle.id] || []).map((gf, idx) =>
              gf.type === 'circle'
                ? <Circle key={`gf-${gf.id ?? idx}`} center={[gf.center.lat, gf.center.lng]} radius={gf.radius_m} />
                : <Polygon key={`gf-${gf.id ?? idx}`} positions={gf.points.map(p => [p.lat, p.lng] as [number, number])} />
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

                  <Paper sx={(t) => ({
                    p: 0.25, borderRadius: 1, border: `1px solid ${t.palette.divider}`,
                    bgcolor:
                      (vehicleTlm.engine_temp != null && Number(vehicleTlm.engine_temp) >= 95)
                        ? (t.palette.error.light + '22')
                        : (t.palette.background.paper + 'AA'),
                  })}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Box sx={{ fontSize: 12, lineHeight: 1 }}>🌡️</Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 10 }} color="text.secondary">دمای موتور</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 0.25, display: 'flex', alignItems: 'baseline', gap: .25 }}>
                          <span>{vehicleTlm.engine_temp != null ? vehicleTlm.engine_temp.toLocaleString('fa-IR') : '—'}</span>
                          <Typography component="span" sx={{ fontSize: 9 }} color="text.secondary">°C</Typography>
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
              سوپر ادمین‌ها
            </Typography>
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
                                      secondaryAction={d.last_location ? (
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
                                      ) : undefined}
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
                                          '&:hover': { background: `${ACC}0A`, transform: 'translateX(-3px)`' }, // NOTE: keep style consistent
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
                                              onClick={() => onPickVehicle(v)} // ← کلیک = باز شدن پنل پایین در منطق جای دیگه
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
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Chip
                    size="medium"
                    icon={<span>🚘</span> as any}
                    label={<Typography component="span" variant="h6" sx={{ fontWeight: 800 }}>
                      ماشین: {selectedVehicle?.plate_no ?? '—'}
                    </Typography>}
                    sx={(t) => ({
                      p: 1, height: 40, borderRadius: 999,
                      bgcolor: t.palette.mode === 'dark' ? `${t.palette.primary.main}1a` : `${t.palette.primary.main}14`,
                      '& .MuiChip-icon': { fontSize: 20 },
                    })}
                  />
                  <Chip
                    size="medium"
                    icon={<span>📍</span> as any}
                    label={`${(selectedVehicle && (vehicleStationsMap[selectedVehicle.id] || []).length) ?? 0} ایستگاه`}
                    sx={(t) => ({
                      p: 1, height: 40, borderRadius: 999,
                      bgcolor: t.palette.mode === 'dark' ? `${t.palette.secondary.main}1a` : `${t.palette.secondary.main}14`,
                      '& .MuiChip-icon': { fontSize: 20 },
                    })}
                  />
                </Stack>
                {/* اگه خواستی دستی ببندی */}
                {/* <Button size="small" onClick={() => setSelectedVehicle(null)}>بستن</Button> */}
              </Stack>

              {/* کارت‌های تله‌متری (بزرگ و زنده) */}
              <Grid2 container spacing={1.25} sx={{ mb: 1.5 }}>
                {[
                  { icon: '🔌', cap: 'وضعیت سوئیچ', val: (vehicleTlm.ignition === true ? 'روشن' : vehicleTlm.ignition === false ? 'خاموش' : 'نامشخص') },
                  { icon: '⏱️', cap: 'مدت سکون', val: (vehicleTlm.idle_time != null ? new Date(Number(vehicleTlm.idle_time) * 1000).toISOString().substring(11, 19) : '—') },
                  { icon: '🛣️', cap: 'کیلومترشمار', val: (vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—') },
                  { icon: '🌡️', cap: 'دمای موتور', val: (vehicleTlm.engine_temp != null ? `${vehicleTlm.engine_temp.toLocaleString('fa-IR')} °C` : '—') },
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

              {/* اکشن‌ها */}
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                <Button
                  size="medium"
                  variant="contained"
                  onClick={() => selectedVehicle?.last_location && setFocusLatLng([selectedVehicle.last_location.lat, selectedVehicle.last_location.lng])}
                  startIcon={<span>🎯</span>}
                >
                  مرکز روی ماشین
                </Button>
                <Button
                  size="medium"
                  variant="outlined"
                  onClick={() => selectedVehicle && loadCurrentRoute(selectedVehicle.id)}
                  startIcon={<span>🔄</span>}
                >
                  تازه‌سازی مسیر
                </Button>
              </Stack>

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


function SuperAdminRoleSection({ user }: { user: User }) {
  // -------- انواع کمکی داخل همین فایل --------
  type VehicleTypeCode =
    | 'bus' | 'minibus' | 'van' | 'tanker' | 'truck' | 'khavar' | 'sedan' | 'pickup';
  type RoutePoint = { lat: number; lng: number; order_no: number };
  //type VehicleRoute = { id: number; name: string; threshold_m: number; points: RoutePoint[] };

  // === Storage helpers for consumables (مثل بقیه آیتم‌ها) ===
  const CONS_KEY = (vid: number) => `consumables_${vid}`;

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

  // کلیک‌گیر روی نقشه برای ژئوفنس
  function PickPointsForGeofence({
    enabled,
    onPick,
  }: {
    enabled: boolean;
    onPick: (lat: number, lng: number) => void;
  }) {
    useMapEvent('click', (e) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
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
  const [vehicleOptions, setVehicleOptions] = useState<string[]>([]);
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
  const [routeThreshold, setRouteThreshold] = useState<number>(60);
  // --- refs for off-route checking (NEW) ---
  const routePolylineRef = useRef<[number, number][]>([]);
  const routeThresholdRef = useRef<number>(60);
  const [consumables, setConsumables] = useState<any[]>([]);
  const [toast, setToast] = useState<{ open: boolean; msg: string } | null>(null);

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
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
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
    useMapEvent('click', (e) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }
  function PickPointsForRoute({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lng: number) => void }) {
    useMapEvent('click', (e) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
    return null;
  }

  const [vehicleStations, setVehicleStations] = useState<
    { id: number; name: string; lat: number; lng: number; radius_m: number }[]
  >([]);
  const [vehicleRoute, setVehicleRoute] = useState<VehicleRoute | null>(null);

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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
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
  const tileUrl =
    useMapTiler && MT_KEY
      ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MT_KEY}`
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
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
  const [fromISO, setFromISO] = useState<string>(() =>
    new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  );
  const [toISO, setToISO] = useState<string>(() => new Date().toISOString());

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
    toSub.forEach(id => s.emit('subscribe', { topic: `vehicle/${id}/pos/${user.id}` }));
    toUnsub.forEach(id => s.emit('unsubscribe', { topic: `vehicle/${id}/pos/${user.id}` }));


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

  useEffect(() => {
    if (!canTrack) return;

    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const s = io(url + '/vehicles', { transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => {
      const ids = vehiclesRef.current.map(v => v.id);
      if (ids.length) {
        ids.forEach(id => s.emit('subscribe', { topic: `vehicle/${id}/pos` }));
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

    // --- vehicle live ---
    const onVehiclePos = (v: { vehicle_id: number; lat: number; lng: number; ts?: string | number }) => {
      const id = v.vehicle_id;
      const ts = v.ts ? +new Date(v.ts) : Date.now();
      const { lat, lng } = v;

      const vehNow = vehiclesRef.current.find(x => x.id === id);
      const driverId = vehNow?.current_driver_user_id ?? null;

      // 1) آپدیت لیست ماشین‌ها
      setVehicles(prev => {
        const i = prev.findIndex(x => x.id === id);
        if (i === -1) return prev;
        const cp = [...prev];
        cp[i] = { ...cp[i], last_location: { lat, lng } };
        return cp;
      });

      // 2) بافر لایو برای مسیر
      setVehicleLive(prev => {
        const arr = prev[id] ? [...prev[id]] : [];
        arr.push([lat, lng, ts]);
        if (arr.length > 500) arr.shift();
        return { ...prev, [id]: arr };
      });

      // 3) فوکوس اگر انتخاب فعلی همین ماشینه
      if (selectedVehicleRef.current?.id === id) {
        setFocusLatLng([lat, lng]);
      }

      // 4) اگر راننده روی این ماشین ست است، لوکیشن راننده را هم sync کن
      if (driverId) {
        setDrivers(prev => {
          const j = prev.findIndex(d => d.id === driverId);
          if (j === -1) return prev;
          const cp = [...prev];
          (cp[j] as any) = { ...cp[j], last_location: { lat, lng } };
          return cp;
        });
      }

      // ===== 5) چک خروج از مسیر (اگر مسیر فعالی داریم) =====
      const poly = routePolylineRef.current;
      const threshold = routeThresholdRef.current; // متر
      if (poly.length >= 2 && Number.isFinite(threshold) && threshold > 0) {
        const dist = distancePointToPolylineMeters([lat, lng], poly);

        if (dist > threshold) {
          // یک آپدیت خارج از حد
          offRouteCountsRef.current[id] = (offRouteCountsRef.current[id] || 0) + 1;

          if (offRouteCountsRef.current[id] >= OFF_ROUTE_N) {
            // ✅ تخلف: برای راننده‌ی فعلی این ماشین
            if (driverId) {
              api.post('/violations', {
                driver_user_id: driverId,     // تاکید: برای راننده
                vehicle_id: id,               // اطلاعات کمکی
                type: 'off_route',
                at: new Date(ts).toISOString(),
                meta: {
                  route_id: vehicleRoute?.id ?? null,
                  distance_m: Math.round(dist),
                  threshold_m: threshold,
                  point: { lat, lng },
                },
              }).catch(() => { /* نذار UI بترکه */ });
            }
            // reset شمارنده (تا دفعه بعد 3‌تایی جدید لازم باشه)
            offRouteCountsRef.current[id] = 0;
          }
        } else {
          // برگشته داخل مسیر → شمارنده صفر شود
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

    // ثبت لیسنرها
    s.on('driver:pos', onDriverPos);
    s.on('vehicle:pos', onVehiclePos);
    s.on('vehicle:stations', onStations);

    // پاکسازی
    return () => {
      s.off('driver:pos', onDriverPos);
      s.off('vehicle:pos', onVehiclePos);
      s.off('vehicle:stations', onStations);

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
    try {
      const { data } = await api.get('/tracks', {
        params: { driver_id: driverId, from: fromISO, to: toISO },
      });
      const pts: TrackPoint[] = Array.isArray(data) ? data : data?.items || [];
      if (pts.length) {
        setPolyline(pts.map((p) => [p.lat, p.lng]));
      } else {
        const arr = (driverLive[driverId] || []).filter(
          (p) => p[2] >= +new Date(fromISO) && p[2] <= +new Date(toISO)
        );
        setPolyline(arr.map((p) => [p[0], p[1]]));
      }
    } catch {
      const arr = (driverLive[driverId] || []).filter(
        (p) => p[2] >= +new Date(fromISO) && p[2] <= +new Date(toISO)
      );
      setPolyline(arr.map((p) => [p[0], p[1]]));
    }
  };
  const loadVehicleTrack = async (vehicleId: number) => {
    try {
      const { data } = await api.get('/tracks', {
        params: { vehicle_id: vehicleId, from: fromISO, to: toISO },
      });
      const pts: TrackPoint[] = Array.isArray(data) ? data : data?.items || [];
      if (pts.length) {
        setPolyline(pts.map((p) => [p.lat, p.lng]));
      } else {
        const arr = (vehicleLive[vehicleId] || []).filter(
          (p) => p[2] >= +new Date(fromISO) && p[2] <= +new Date(toISO)
        );
        setPolyline(arr.map((p) => [p[0], p[1]]));
      }
    } catch {
      const arr = (vehicleLive[vehicleId] || []).filter(
        (p) => p[2] >= +new Date(fromISO) && p[2] <= +new Date(toISO)
      );
      setPolyline(arr.map((p) => [p[0], p[1]]));
    }
  };

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
      const res = await api
        .get(`/driver-routes/stats/${driverId}`, {
          params: { from: fromISO, to: toISO },
        })
        .catch(() => null);
      if (res?.data) {
        setStats(res.data);
      } else {
        const arr = polyline;
        let d = 0;
        for (let i = 1; i < arr.length; i++) d += hav(arr[i - 1], arr[i]);
        setStats({ totalDistanceKm: +d.toFixed(2) });
      }
    } finally {
      setStatsLoading(false);
    }
  };

  // انتخاب‌های لیست
  const onPickDriver = (d: User) => {
    setSelectedDriver(d);
    setSelectedVehicle(null);
    if ((d as any).last_location)
      setFocusLatLng([(d as any).last_location.lat, (d as any).last_location.lng]);
    setPolyline([]);
    loadDriverTrack(d.id).then(() => fetchDriverStats(d.id));
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

  // ===== UI =====
  // به‌روز کردن threshold در ref (NEW)
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
          sock.emit('subscribe', { topic: `vehicle/${vid}/${k}` });
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
  };

  return (
    <Grid2 container spacing={2} dir="ltr">
      {/* نقشه */}
      {can('track_driver') && (
        <Grid2 xs={12} md={8}>
          <Paper sx={{ height: '75vh', overflow: 'hidden' }} dir="rtl">
            <MapContainer
              zoom={INITIAL_ZOOM}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }} // ⬅️ پایین
            >
              <InitView center={INITIAL_CENTER} zoom={INITIAL_ZOOM} />
              <TileLayer
                url={tileUrl}
                {...({ attribution: '&copy; OpenStreetMap | © MapTiler' } as any)}
              />
              <FocusOn target={focusLatLng} />
              <FitToLatLngs latlngs={markersLatLngs} />
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
              {/* پیش‌نمایش مسیر در حال ترسیم */}
              {drawingRoute && routePoints.length > 1 && (
                <Polyline
                  positions={routePoints.map(p => [p.lat, p.lng] as [number, number])}
                  pathOptions={{ dashArray: '6 6' }}
                />
              )}
              {/* پیش‌نمایش ژئوفنس در حال ترسیم */}
              {gfDrawing && gfMode === 'circle' && gfCenter && (
                <Circle center={[gfCenter.lat, gfCenter.lng]} radius={gfRadius} />
              )}
              {gfDrawing && gfMode === 'polygon' && gfPoly.length >= 2 && (
                <Polygon positions={gfPoly.map(p => [p.lat, p.lng] as [number, number])} pathOptions={{ dashArray: '6 6' }} />
              )}
              {/* مسیر جاری (از سرور) */}
              {(() => {
                const routePts: RoutePoint[] = (vehicleRoute?.points ?? vehicleRoute?.stations ?? []);
                return routePts.length > 1 ? (
                  <Polyline
                    positions={routePts
                      .slice()
                      .sort((a: RoutePoint, b: RoutePoint) => (a.order_no ?? 0) - (b.order_no ?? 0))
                      .map((p: RoutePoint) => [p.lat, p.lng] as [number, number])}
                  />
                ) : null;
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

              {/* مسیر (پلی‌لاین) */}
              {polyline.length > 1 && <Polyline positions={polyline} />}
              {/* ایستگاه موقت برای تایید */}
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
                <Circle center={[geofence.center.lat, geofence.center.lng]} radius={geofence.radius_m} />
              )}
              {!gfDrawing && geofence?.type === 'polygon' && (
                <Polygon positions={geofence.points.map(p => [p.lat, p.lng] as [number, number])} />
              )}

              {/* (اختیاری) نمایش ایستگاه‌های مسیر جاری اگر خواستی: 
  {tab === 'vehicles' && vehicleRoute?.stations?.map((st, idx) => (
    <Marker key={`rt-${st.id ?? idx}`} position={[st.lat, st.lng]}>
      <Popup>
        <strong>{idx + 1}. {st.name ?? 'ایستگاه مسیر'}</strong>
        <br />
        {st.lat.toFixed(5)}, {st.lng.toFixed(5)}
      </Popup>
    </Marker>
  ))} 
  */}
            </MapContainer>

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

              {/* اگر GPS فعال باشد، وضعیت لایو را نشان بده */}
              {tab === 'vehicles' && selectedVehicle && vehicleOptions.includes('gps') && (
                <Chip
                  label={vehicleLiveAllowed ? 'GPS لایو' : 'GPS'}
                  size="small"
                  variant={vehicleLiveAllowed ? 'filled' : 'outlined'}
                />
              )}
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

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={tab === 'drivers' ? !selectedDriver : !selectedVehicle}
                  onClick={() => {
                    if (tab === 'drivers' && selectedDriver) {
                      loadDriverTrack(selectedDriver.id);
                      fetchDriverStats(selectedDriver.id);
                    }
                    if (tab === 'vehicles' && selectedVehicle) {
                      loadVehicleTrack(selectedVehicle.id);
                    }
                  }}
                >
                  بروزرسانی
                </Button>
              </Stack>
            </Stack>

            {/* امکانات ماشین (فقط تبِ ماشین و وقتی انتخاب شده) */}
            {tab === 'vehicles' && selectedVehicle && (
              <Box sx={{ mt: 1.5 }}>
                <FeatureCards enabled={vehicleOptions} telemetry={vehicleTlm} />

                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  امکانات فعال این ماشین
                </Typography>

                {vehicleOptionsLoading ? (
                  <Box display="flex" alignItems="center" gap={1} color="text.secondary">
                    <CircularProgress size={16} /> در حال خواندن تنظیمات…
                  </Box>
                ) : vehicleOptions.length > 0 ? (
                  <>
                    {/* لیست امکانات فعال */}
                    <List dense sx={{ py: 0 }}>
                      {vehicleOptions.map((k) => (
                        <ListItem key={k} disableGutters sx={{ py: 0.25 }}>
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <CheckCircleIcon color="success" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={MONITOR_PARAMS.find(m => m.key === (k as any))?.label || k}
                          />
                        </ListItem>
                      ))}
                    </List>

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
                          مسیز
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
                  </Grid2>
                </Grid2>
              )
            )}
          </Paper>


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
  // بعد از typeGrants:

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
    useMapEvent('click', (e) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
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

    // ریست حالت‌های افزودن/ادیت ایستگاه
    setAddingStationsForVid(null);
    setEditingStation(null);
    setMovingStationId(null);
    setTempStation(null);

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

  // ===== فیلتر/جستجو =====


  // ===== UI =====
  const typeLabel = (code: VehicleTypeCode) => VEHICLE_TYPES.find(t => t.code === code)?.label || code;
  // اطمینان از سابسکرایب شدن به ایستگاه‌های یک ماشین + اولین fetch


  // هندل کلیک روی یک ماشین در لیست (مثل SA)



  // به‌روزرسانی Map ایستگاه‌ها با پیام‌های سوکت
  /*React.useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const onStations = (msg: any) => {
      // انتظار: msg = { vehicle_id, type: 'created'|'updated'|'deleted', station?, station_id? }
      const vid = Number(msg?.vehicle_id ?? msg?.vehicleId);
      if (!Number.isFinite(vid)) return;

      setVehicleStationsMap(prev => {
        const list = (prev[vid] || []).slice();

        if (msg?.type === 'created' && msg.station) {
          // اگر تکراری نبود، اضافه کن
          if (!list.some(x => x.id === msg.station.id)) list.push(msg.station);
        } else if (msg?.type === 'updated' && msg.station) {
          const i = list.findIndex(x => x.id === msg.station.id);
          if (i >= 0) list[i] = msg.station;
        } else if (msg?.type === 'deleted' && msg.station_id) {
          const sid = Number(msg.station_id);
          return { ...prev, [vid]: list.filter(x => x.id !== sid) };
        }

        return { ...prev, [vid]: list };
      });
    };

    s.on('vehicle:stations', onStations);
    return () => { s.off('vehicle:stations', onStations); };
  }, []);*/

  const gfKey = (gf: Geofence, idx: number) =>
    gf.id != null ? `gf-${gf.id}` : `gf-${gf.type}-${idx}`;
  return (
    <Grid2 container spacing={2} dir="ltr">
      {/* Map */}
      <Grid2 xs={12} md={8}>
        <Paper sx={{ height: '75vh', overflow: 'hidden' }} dir="rtl">
          <MapContainer zoom={INITIAL_ZOOM} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} style={{ width: '100%', height: '100%' }}>
            <InitView center={INITIAL_CENTER} zoom={INITIAL_ZOOM} />
            <TileLayer url={tileUrl} {...({ attribution: '&copy; OpenStreetMap | © MapTiler' } as any)} />
            <FocusOn target={focusLatLng} />
            {activeType && canGeoFence && selectedVehicleId && (
              <PickPointsForGeofence
                enabled={gfDrawing}
                onPick={(lat, lng) => {
                  if (gfMode === 'circle') setGfCenter({ lat, lng });
                  else setGfPoly(prev => [...prev, { lat, lng }]);
                }}
              />
            )}

            {/* پیش‌نمایش ترسیم */}
            {gfDrawing && gfMode === 'circle' && gfCenter && (
              <Circle center={[gfCenter.lat, gfCenter.lng]} radius={gfRadius} />
            )}
            {gfDrawing && gfMode === 'polygon' && gfPoly.length >= 2 && (
              <Polygon positions={gfPoly.map(p => [p.lat, p.lng] as [number, number])} pathOptions={{ dashArray: '6 6' }} />
            )}

            {/* ژئوفنس ذخیره‌شده سرور برای ماشین انتخاب‌شده */}
            {selectedVehicleId && (geofencesByVid[selectedVehicleId] || []).map((gf, idx) =>
              gf.type === 'circle'
                ? <Circle key={gfKey(gf, idx)} center={[gf.center.lat, gf.center.lng]} radius={gf.radius_m} />
                : <Polygon key={gfKey(gf, idx)} positions={gf.points.map(p => [p.lat, p.lng] as [number, number])} />
            )}

            {/* دیالوگ ویرایش مصرفی */}
            <Dialog open={!!editingCons} onClose={() => setEditingCons(null)} fullWidth maxWidth="sm">
              <DialogTitle>ویرایش آیتم مصرفی</DialogTitle>
              <DialogContent dividers>
                <Stack spacing={2}>
                  <TextField label="توضیح/یادداشت" value={editingCons?.note ?? ''} onChange={(e) => setEditingCons((p: any) => ({ ...p, note: e.target.value }))} fullWidth />
                  <RadioGroup row value={editingCons?.mode ?? 'km'}
                    onChange={(_, v) => setEditingCons((p: any) => ({
                      ...p, mode: v as 'km' | 'time',
                      start_at: v === 'time' ? (p?.start_at ?? new Date().toISOString()) : null,
                      base_odometer_km: v === 'km' ? (p?.base_odometer_km ?? 0) : null,
                    }))}
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
                        ampm={false} slotProps={{ textField: { fullWidth: true } }} format="yyyy/MM/dd HH:mm"
                      />
                    </LocalizationProvider>
                  ) : (
                    <TextField label="مقدار مبنا (کیلومتر)" type="number"
                      value={editingCons?.base_odometer_km ?? ''}
                      onChange={(e) => setEditingCons((p: any) => ({ ...p, base_odometer_km: e.target.value ? Number(e.target.value) : null }))}
                      fullWidth />
                  )}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditingCons(null)}>انصراف</Button>
                <Button variant="contained" onClick={saveEditConsumable} disabled={savingCons}>ذخیره</Button>
              </DialogActions>
            </Dialog>

            {/* Snackbar */}
            {toast?.open && (
              <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="warning" onClose={() => setToast(null)} sx={{ width: '100%' }}>
                  {toast.msg}
                </Alert>
              </Snackbar>
            )}

            {/* مارکر راننده‌ها */}
            {tab === 'drivers' && canTrackDrivers && filteredDrivers.map(d => (d as any).last_location && (
              <Marker key={`d-${d.id}`} position={[(d as any).last_location.lat, (d as any).last_location.lng]} icon={driverMarkerIcon}>
                <Popup><strong>{d.full_name}</strong><br />{d.phone || '—'}</Popup>
              </Marker>
            ))}
            {tab === 'drivers' && canTrackDrivers && polyline.length > 1 && <Polyline positions={polyline} />}

            {/* مارکر ماشین‌ها برای تب فعال */}
            {activeType && canTrackVehicles && filteredVehicles.map(v => v.last_location && (
              <Marker key={`v-${v.id}`} position={[v.last_location.lat, v.last_location.lng]} icon={vehicleMarkerIcon}>
                <Popup><strong>{v.plate_no}</strong><br />{v.vehicle_type_code}</Popup>
              </Marker>
            ))}

            {/* کلیک برای ایجاد ایستگاه */}
            <PickPointsForStations enabled={!!addingStationsForVid} onPick={(lat, lng) => setTempStation({ lat, lng })} />

            {/* ایستگاه‌های ماشین در حالت افزودن/ویرایش */}
            {!!addingStationsForVid && (vehicleStationsMap[addingStationsForVid] || []).map(st => (
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


            {/* مارکر موقت ایجاد ایستگاه */}
            {addingStationsForVid && tempStation && (
              <>
                <Circle center={[tempStation.lat, tempStation.lng]} radius={stationRadius} />
                <Marker
                  position={[tempStation.lat, tempStation.lng]}
                  draggable
                  eventHandlers={{
                    add: (e: any) => e.target.openPopup(),
                    dragend: (e: any) => { const ll = e.target.getLatLng(); setTempStation({ lat: ll.lat, lng: ll.lng }); },
                  }}
                >
                  <Popup autoClose={false} closeOnClick={false} autoPan>
                    <div style={{ minWidth: 220 }}>
                      <strong>ایجاد ایستگاه</strong>
                      <div style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>می‌توانید مارکر را جابجا کنید.</div>
                      <div style={{ marginTop: 8 }}>
                        <input style={{ width: '100%', padding: 6 }} placeholder="نام ایستگاه" value={tempName} onChange={e => setTempName(e.target.value)} />
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

            {/* جابه‌جایی ایستگاه در حالت ویرایش */}
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
          </MapContainer>
        </Paper>
      </Grid2>

      {/* سایدبار */}
      <Grid2 xs={12} md={4}>
        <Paper sx={{ p: 2, height: '75vh', display: 'flex', flexDirection: 'column' }} dir="rtl">
          {/* بازه */}
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
                <DateTimePicker label="از" value={new Date(fromISO)} onChange={(v) => v && setFromISO(new Date(v).toISOString())} slotProps={{ textField: { size: 'small' } }} />
                <DateTimePicker label="تا" value={new Date(toISO)} onChange={(v) => v && setToISO(new Date(v).toISOString())} slotProps={{ textField: { size: 'small' } }} />
              </LocalizationProvider>
            )}
          </Stack>

          {/* تب‌ها */}
          <Tabs
            value={tab}
            onChange={(_, v) => { setTab(v); setQ(''); setPolyline([]); setAddingStationsForVid(null); setTempStation(null); setEditingStation(null); setMovingStationId(null); }}
            sx={{ mb: 1 }}
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

          {/* === تله‌متری لحظه‌ای ماشین انتخاب‌شده (در صورت داشتن تیک‌ها) === */}
          {activeType && selectedVehicleId && (canIgnition || canIdleTime || canOdometer) && (
            <Stack spacing={1} sx={{ mb: 1.5 }}>
              {canIgnition && (
                <Paper sx={{ p: 1.25 }}>
                  <Typography variant="body2" color="text.secondary">وضعیت سوئیچ</Typography>
                  <Typography variant="h6">
                    {vehicleTlm.ignition === true ? 'موتور روشن است'
                      : vehicleTlm.ignition === false ? 'موتور خاموش است' : 'نامشخص'}
                  </Typography>
                </Paper>
              )}
              {canIdleTime && (
                <Paper sx={{ p: 1.25 }}>
                  <Typography variant="body2" color="text.secondary">مدت توقف/سکون</Typography>
                  <Typography variant="h6">
                    {vehicleTlm.idle_time != null
                      ? `${vehicleTlm.idle_time.toLocaleString('fa-IR')} ثانیه`
                      : '—'}
                  </Typography>
                </Paper>
              )}
              {canOdometer && (
                <Paper sx={{ p: 1.25 }}>
                  <Typography variant="body2" color="text.secondary">کیلومترشمار</Typography>
                  <Typography variant="h6">
                    {vehicleTlm.odometer != null
                      ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km`
                      : 'نامشخص'}
                  </Typography>
                </Paper>
              )}
            </Stack>
          )}

          {/* جستجو */}
          <TextField
            size="small"
            placeholder={tab === 'drivers' ? 'جستجو نام/موبایل' : 'جستجو پلاک'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
            sx={{ mb: 1 }}
          />

          {/* لیست */}
          <List sx={{ overflow: 'auto', flex: 1 }}>
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
                              disabled={!canTrackDrivers}
                              onClick={(e) => { e.stopPropagation(); loadDriverTrack(d.id); }}
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
              // تب نوع خودرو
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
                          {canStations && (
                            <Button
                              size="small"
                              variant={addingStationsForVid === v.id ? 'contained' : 'outlined'}
                              onClick={(e) => { e.stopPropagation(); startAddingStationsFor(v.id); }}
                            >
                              {addingStationsForVid === v.id ? 'پایان افزودن' : 'ایجاد ایستگاه'}
                            </Button>
                          )}
                        </Stack>
                      }
                    >
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                        <Avatar>{v.plate_no?.charAt(0) ?? 'م'}</Avatar>
                        <Box sx={{ flex: 1 }}>
                          <ListItemText primary={v.plate_no} secondary={typeLabel(v.vehicle_type_code)} />
                        </Box>
                      </Stack>
                    </ListItem>

                    {/* لیست ایستگاه‌های این ماشین */}
                    {canStations && (
                      <Box sx={{ mx: 1.5, mt: .5 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <TextField
                            size="small" type="number" label="شعاع (m)" value={stationRadius}
                            onChange={(e) => setStationRadius(Math.max(1, Number(e.target.value || 0)))} sx={{ width: 130 }}
                          />
                        </Stack>

                        {Array.isArray(stations) && stations.length ? (
                          <List dense sx={{ maxHeight: 180, overflow: 'auto' }}>
                            {stations.map(st => {
                              const isEditing = isEditingBlock && editingStation?.st.id === st.id;
                              return (
                                <Box key={st.id}>
                                  <ListItem
                                    disableGutters
                                    secondaryAction={
                                      <Stack direction="row" spacing={0.5}>
                                        <IconButton size="small" onClick={() => setFocusLatLng([st.lat, st.lng])} title="نمایش روی نقشه">📍</IconButton>
                                        <IconButton
                                          size="small"
                                          onClick={() => {
                                            if (isEditing) { setEditingStation(null); setMovingStationId(null); }
                                            else { setEditingStation({ vid: v.id, st: { ...st } }); setMovingStationId(null); }
                                          }}
                                          title="ویرایش"
                                        >✏️</IconButton>
                                        <IconButton size="small" color="error" onClick={() => deleteStation(v.id, st)} title="حذف">🗑️</IconButton>
                                      </Stack>
                                    }
                                  >
                                    <ListItemText primary={st.name} secondary={`${fmtLL(st.lat)}, ${fmtLL(st.lng)}`} />
                                  </ListItem>

                                  <Collapse in={isEditing} timeout="auto" unmountOnExit>
                                    <Box sx={{ mx: 1.5, mt: .5, p: 1.25, bgcolor: 'action.hover', borderRadius: 1, border: (t) => `1px solid ${t.palette.divider}` }}>
                                      <Stack spacing={1.25}>
                                        <TextField size="small" label="نام" value={editingStation?.st.name ?? ''} onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, name: e.target.value } }) : ed)} />
                                        <TextField size="small" type="number" label="شعاع (m)" value={editingStation?.st.radius_m ?? 0}
                                          onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, radius_m: Math.max(1, Number(e.target.value || 0)) } }) : ed)} />
                                        <Stack direction="row" spacing={1} alignItems="center">
                                          <Button size="small" variant={movingStationId === st.id ? 'contained' : 'outlined'} onClick={() => setMovingStationId(movingStationId === st.id ? null : st.id)}>جابجایی روی نقشه</Button>
                                          <Box flex={1} />
                                          <Typography variant="caption" color="text.secondary">
                                            {fmtLL(editingStation?.st.lat as number)}, {fmtLL(editingStation?.st.lng as number)}
                                          </Typography>
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
                        )}
                      </Box>
                    )}
                    {canGeoFence && selectedVehicleId === v.id && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>ژئوفنس</Typography>

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

                          <Button size="small" variant="contained" color="primary" onClick={saveGeofenceBM}>
                            ذخیره ژئوفنس
                          </Button>

                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={deleteGeofenceBM}
                            disabled={!selectedVehicleId || (geofencesByVid[selectedVehicleId]?.length ?? 0) === 0}
                          >
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

                    {/* === لوازم مصرفی برای همین ماشین (داخل map) === */}
                    {canConsumables && selectedVehicleId === v.id && (
                      <Box sx={{ mx: 1.5, mt: 1.5 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <Typography variant="subtitle2">لوازم مصرفی</Typography>
                          <Tooltip title="افزودن">
                            <IconButton size="small" onClick={() => setConsumablesOpen(true)}>＋</IconButton>
                          </Tooltip>
                          <Box flex={1} />
                          <Typography variant="caption" color="text.secondary">
                            کیلومترشمار: {vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}
                          </Typography>
                        </Stack>

                        {consStatusByVid[v.id] === 'loading' ? (
                          <Box display="flex" alignItems="center" gap={1} color="text.secondary" sx={{ mt: .5 }}>
                            <CircularProgress size={16} /> در حال دریافت…
                          </Box>
                        ) : (consumablesByVid[v.id] || []).length ? (
                          <List dense sx={{ maxHeight: 180, overflow: 'auto' }}>
                            {(consumablesByVid[v.id] || []).map((c: any, i: number) => (
                              <ListItem
                                key={c.id ?? i}
                                divider
                                secondaryAction={
                                  <Stack direction="row" spacing={0.5}>
                                    <IconButton size="small" title="ویرایش" onClick={() => openEditConsumable(c)}>✏️</IconButton>
                                    <IconButton size="small" color="error" title="حذف" onClick={() => deleteConsumable(c)}>🗑️</IconButton>
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
                        ) : consStatusByVid[v.id] === 'error' ? (
                          <Typography color="warning.main">خطا در دریافت. دوباره تلاش کنید.</Typography>
                        ) : (
                          <Typography color="text.secondary">آیتمی ثبت نشده.</Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                );
              }))
            )}
          </List>

          {/* دیالوگ افزودن/تنظیم مصرفی (یک‌بار) */}
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
                    <DateTimePicker<Date> label="تاریخ یادآوری" value={tripDate}
                      onChange={(val) => setTripDate(val)} ampm={false}
                      slotProps={{ textField: { fullWidth: true } }} format="yyyy/MM/dd HH:mm" />
                  </LocalizationProvider>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">کیلومترشمار فعلی:</Typography>
                        <Typography variant="h6">{vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}</Typography>
                      </Stack>
                      <TextField label="مقدار مبنا (از آخرین صفر)" type="number"
                        value={tripBaseKm ?? ''} onChange={(e) => setTripBaseKm(e.target.value ? Number(e.target.value) : null)} fullWidth />
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
  // بعد از typeGrants:

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
    useMapEvent('click', (e) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
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

    // ریست حالت‌های افزودن/ادیت ایستگاه
    setAddingStationsForVid(null);
    setEditingStation(null);
    setMovingStationId(null);
    setTempStation(null);

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

  // ===== فیلتر/جستجو =====


  // ===== UI =====
  const typeLabel = (code: VehicleTypeCode) => VEHICLE_TYPES.find(t => t.code === code)?.label || code;
  // اطمینان از سابسکرایب شدن به ایستگاه‌های یک ماشین + اولین fetch


  // هندل کلیک روی یک ماشین در لیست (مثل SA)



  // به‌روزرسانی Map ایستگاه‌ها با پیام‌های سوکت
  /*React.useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const onStations = (msg: any) => {
      // انتظار: msg = { vehicle_id, type: 'created'|'updated'|'deleted', station?, station_id? }
      const vid = Number(msg?.vehicle_id ?? msg?.vehicleId);
      if (!Number.isFinite(vid)) return;

      setVehicleStationsMap(prev => {
        const list = (prev[vid] || []).slice();

        if (msg?.type === 'created' && msg.station) {
          // اگر تکراری نبود، اضافه کن
          if (!list.some(x => x.id === msg.station.id)) list.push(msg.station);
        } else if (msg?.type === 'updated' && msg.station) {
          const i = list.findIndex(x => x.id === msg.station.id);
          if (i >= 0) list[i] = msg.station;
        } else if (msg?.type === 'deleted' && msg.station_id) {
          const sid = Number(msg.station_id);
          return { ...prev, [vid]: list.filter(x => x.id !== sid) };
        }

        return { ...prev, [vid]: list };
      });
    };

    s.on('vehicle:stations', onStations);
    return () => { s.off('vehicle:stations', onStations); };
  }, []);*/

  const gfKey = (gf: Geofence, idx: number) =>
    gf.id != null ? `gf-${gf.id}` : `gf-${gf.type}-${idx}`;
  return (
    <Grid2 container spacing={2} dir="ltr">
      {/* Map */}
      <Grid2 xs={12} md={8}>
        <Paper sx={{ height: '75vh', overflow: 'hidden' }} dir="rtl">
          <MapContainer zoom={INITIAL_ZOOM} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} style={{ width: '100%', height: '100%' }}>
            <InitView center={INITIAL_CENTER} zoom={INITIAL_ZOOM} />
            <TileLayer url={tileUrl} {...({ attribution: '&copy; OpenStreetMap | © MapTiler' } as any)} />
            <FocusOn target={focusLatLng} />
            {activeType && canGeoFence && selectedVehicleId && (
              <PickPointsForGeofence
                enabled={gfDrawing}
                onPick={(lat, lng) => {
                  if (gfMode === 'circle') setGfCenter({ lat, lng });
                  else setGfPoly(prev => [...prev, { lat, lng }]);
                }}
              />
            )}

            {/* پیش‌نمایش ترسیم */}
            {gfDrawing && gfMode === 'circle' && gfCenter && (
              <Circle center={[gfCenter.lat, gfCenter.lng]} radius={gfRadius} />
            )}
            {gfDrawing && gfMode === 'polygon' && gfPoly.length >= 2 && (
              <Polygon positions={gfPoly.map(p => [p.lat, p.lng] as [number, number])} pathOptions={{ dashArray: '6 6' }} />
            )}

            {/* ژئوفنس ذخیره‌شده سرور برای ماشین انتخاب‌شده */}
            {selectedVehicleId && (geofencesByVid[selectedVehicleId] || []).map((gf, idx) =>
              gf.type === 'circle'
                ? <Circle key={gfKey(gf, idx)} center={[gf.center.lat, gf.center.lng]} radius={gf.radius_m} />
                : <Polygon key={gfKey(gf, idx)} positions={gf.points.map(p => [p.lat, p.lng] as [number, number])} />
            )}

            {/* دیالوگ ویرایش مصرفی */}
            <Dialog open={!!editingCons} onClose={() => setEditingCons(null)} fullWidth maxWidth="sm">
              <DialogTitle>ویرایش آیتم مصرفی</DialogTitle>
              <DialogContent dividers>
                <Stack spacing={2}>
                  <TextField label="توضیح/یادداشت" value={editingCons?.note ?? ''} onChange={(e) => setEditingCons((p: any) => ({ ...p, note: e.target.value }))} fullWidth />
                  <RadioGroup row value={editingCons?.mode ?? 'km'}
                    onChange={(_, v) => setEditingCons((p: any) => ({
                      ...p, mode: v as 'km' | 'time',
                      start_at: v === 'time' ? (p?.start_at ?? new Date().toISOString()) : null,
                      base_odometer_km: v === 'km' ? (p?.base_odometer_km ?? 0) : null,
                    }))}
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
                        ampm={false} slotProps={{ textField: { fullWidth: true } }} format="yyyy/MM/dd HH:mm"
                      />
                    </LocalizationProvider>
                  ) : (
                    <TextField label="مقدار مبنا (کیلومتر)" type="number"
                      value={editingCons?.base_odometer_km ?? ''}
                      onChange={(e) => setEditingCons((p: any) => ({ ...p, base_odometer_km: e.target.value ? Number(e.target.value) : null }))}
                      fullWidth />
                  )}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditingCons(null)}>انصراف</Button>
                <Button variant="contained" onClick={saveEditConsumable} disabled={savingCons}>ذخیره</Button>
              </DialogActions>
            </Dialog>

            {/* Snackbar */}
            {toast?.open && (
              <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="warning" onClose={() => setToast(null)} sx={{ width: '100%' }}>
                  {toast.msg}
                </Alert>
              </Snackbar>
            )}

            {/* مارکر راننده‌ها */}
            {tab === 'drivers' && canTrackDrivers && filteredDrivers.map(d => (d as any).last_location && (
              <Marker key={`d-${d.id}`} position={[(d as any).last_location.lat, (d as any).last_location.lng]} icon={driverMarkerIcon}>
                <Popup><strong>{d.full_name}</strong><br />{d.phone || '—'}</Popup>
              </Marker>
            ))}
            {tab === 'drivers' && canTrackDrivers && polyline.length > 1 && <Polyline positions={polyline} />}

            {/* مارکر ماشین‌ها برای تب فعال */}
            {activeType && canTrackVehicles && filteredVehicles.map(v => v.last_location && (
              <Marker key={`v-${v.id}`} position={[v.last_location.lat, v.last_location.lng]} icon={vehicleMarkerIcon}>
                <Popup><strong>{v.plate_no}</strong><br />{v.vehicle_type_code}</Popup>
              </Marker>
            ))}

            {/* کلیک برای ایجاد ایستگاه */}
            <PickPointsForStations enabled={!!addingStationsForVid} onPick={(lat, lng) => setTempStation({ lat, lng })} />

            {/* ایستگاه‌های ماشین در حالت افزودن/ویرایش */}
            {!!addingStationsForVid && (vehicleStationsMap[addingStationsForVid] || []).map(st => (
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


            {/* مارکر موقت ایجاد ایستگاه */}
            {addingStationsForVid && tempStation && (
              <>
                <Circle center={[tempStation.lat, tempStation.lng]} radius={stationRadius} />
                <Marker
                  position={[tempStation.lat, tempStation.lng]}
                  draggable
                  eventHandlers={{
                    add: (e: any) => e.target.openPopup(),
                    dragend: (e: any) => { const ll = e.target.getLatLng(); setTempStation({ lat: ll.lat, lng: ll.lng }); },
                  }}
                >
                  <Popup autoClose={false} closeOnClick={false} autoPan>
                    <div style={{ minWidth: 220 }}>
                      <strong>ایجاد ایستگاه</strong>
                      <div style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>می‌توانید مارکر را جابجا کنید.</div>
                      <div style={{ marginTop: 8 }}>
                        <input style={{ width: '100%', padding: 6 }} placeholder="نام ایستگاه" value={tempName} onChange={e => setTempName(e.target.value)} />
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

            {/* جابه‌جایی ایستگاه در حالت ویرایش */}
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
          </MapContainer>
        </Paper>
      </Grid2>

      {/* سایدبار */}
      <Grid2 xs={12} md={4}>
        <Paper sx={{ p: 2, height: '75vh', display: 'flex', flexDirection: 'column' }} dir="rtl">
          {/* بازه */}
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
                <DateTimePicker label="از" value={new Date(fromISO)} onChange={(v) => v && setFromISO(new Date(v).toISOString())} slotProps={{ textField: { size: 'small' } }} />
                <DateTimePicker label="تا" value={new Date(toISO)} onChange={(v) => v && setToISO(new Date(v).toISOString())} slotProps={{ textField: { size: 'small' } }} />
              </LocalizationProvider>
            )}
          </Stack>

          {/* تب‌ها */}
          <Tabs
            value={tab}
            onChange={(_, v) => { setTab(v); setQ(''); setPolyline([]); setAddingStationsForVid(null); setTempStation(null); setEditingStation(null); setMovingStationId(null); }}
            sx={{ mb: 1 }}
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

          {/* === تله‌متری لحظه‌ای ماشین انتخاب‌شده (در صورت داشتن تیک‌ها) === */}
          {activeType && selectedVehicleId && (canIgnition || canIdleTime || canOdometer) && (
            <Stack spacing={1} sx={{ mb: 1.5 }}>
              {canIgnition && (
                <Paper sx={{ p: 1.25 }}>
                  <Typography variant="body2" color="text.secondary">وضعیت سوئیچ</Typography>
                  <Typography variant="h6">
                    {vehicleTlm.ignition === true ? 'موتور روشن است'
                      : vehicleTlm.ignition === false ? 'موتور خاموش است' : 'نامشخص'}
                  </Typography>
                </Paper>
              )}
              {canIdleTime && (
                <Paper sx={{ p: 1.25 }}>
                  <Typography variant="body2" color="text.secondary">مدت توقف/سکون</Typography>
                  <Typography variant="h6">
                    {vehicleTlm.idle_time != null
                      ? `${vehicleTlm.idle_time.toLocaleString('fa-IR')} ثانیه`
                      : '—'}
                  </Typography>
                </Paper>
              )}
              {canOdometer && (
                <Paper sx={{ p: 1.25 }}>
                  <Typography variant="body2" color="text.secondary">کیلومترشمار</Typography>
                  <Typography variant="h6">
                    {vehicleTlm.odometer != null
                      ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km`
                      : 'نامشخص'}
                  </Typography>
                </Paper>
              )}
            </Stack>
          )}

          {/* جستجو */}
          <TextField
            size="small"
            placeholder={tab === 'drivers' ? 'جستجو نام/موبایل' : 'جستجو پلاک'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
            sx={{ mb: 1 }}
          />

          {/* لیست */}
          <List sx={{ overflow: 'auto', flex: 1 }}>
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
                              disabled={!canTrackDrivers}
                              onClick={(e) => { e.stopPropagation(); loadDriverTrack(d.id); }}
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
              // تب نوع خودرو
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
                          {canStations && (
                            <Button
                              size="small"
                              variant={addingStationsForVid === v.id ? 'contained' : 'outlined'}
                              onClick={(e) => { e.stopPropagation(); startAddingStationsFor(v.id); }}
                            >
                              {addingStationsForVid === v.id ? 'پایان افزودن' : 'ایجاد ایستگاه'}
                            </Button>
                          )}
                        </Stack>
                      }
                    >
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                        <Avatar>{v.plate_no?.charAt(0) ?? 'م'}</Avatar>
                        <Box sx={{ flex: 1 }}>
                          <ListItemText primary={v.plate_no} secondary={typeLabel(v.vehicle_type_code)} />
                        </Box>
                      </Stack>
                    </ListItem>

                    {/* لیست ایستگاه‌های این ماشین */}
                    {canStations && (
                      <Box sx={{ mx: 1.5, mt: .5 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <TextField
                            size="small" type="number" label="شعاع (m)" value={stationRadius}
                            onChange={(e) => setStationRadius(Math.max(1, Number(e.target.value || 0)))} sx={{ width: 130 }}
                          />
                        </Stack>

                        {Array.isArray(stations) && stations.length ? (
                          <List dense sx={{ maxHeight: 180, overflow: 'auto' }}>
                            {stations.map(st => {
                              const isEditing = isEditingBlock && editingStation?.st.id === st.id;
                              return (
                                <Box key={st.id}>
                                  <ListItem
                                    disableGutters
                                    secondaryAction={
                                      <Stack direction="row" spacing={0.5}>
                                        <IconButton size="small" onClick={() => setFocusLatLng([st.lat, st.lng])} title="نمایش روی نقشه">📍</IconButton>
                                        <IconButton
                                          size="small"
                                          onClick={() => {
                                            if (isEditing) { setEditingStation(null); setMovingStationId(null); }
                                            else { setEditingStation({ vid: v.id, st: { ...st } }); setMovingStationId(null); }
                                          }}
                                          title="ویرایش"
                                        >✏️</IconButton>
                                        <IconButton size="small" color="error" onClick={() => deleteStation(v.id, st)} title="حذف">🗑️</IconButton>
                                      </Stack>
                                    }
                                  >
                                    <ListItemText primary={st.name} secondary={`${fmtLL(st.lat)}, ${fmtLL(st.lng)}`} />
                                  </ListItem>

                                  <Collapse in={isEditing} timeout="auto" unmountOnExit>
                                    <Box sx={{ mx: 1.5, mt: .5, p: 1.25, bgcolor: 'action.hover', borderRadius: 1, border: (t) => `1px solid ${t.palette.divider}` }}>
                                      <Stack spacing={1.25}>
                                        <TextField size="small" label="نام" value={editingStation?.st.name ?? ''} onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, name: e.target.value } }) : ed)} />
                                        <TextField size="small" type="number" label="شعاع (m)" value={editingStation?.st.radius_m ?? 0}
                                          onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, radius_m: Math.max(1, Number(e.target.value || 0)) } }) : ed)} />
                                        <Stack direction="row" spacing={1} alignItems="center">
                                          <Button size="small" variant={movingStationId === st.id ? 'contained' : 'outlined'} onClick={() => setMovingStationId(movingStationId === st.id ? null : st.id)}>جابجایی روی نقشه</Button>
                                          <Box flex={1} />
                                          <Typography variant="caption" color="text.secondary">
                                            {fmtLL(editingStation?.st.lat as number)}, {fmtLL(editingStation?.st.lng as number)}
                                          </Typography>
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
                        )}
                      </Box>
                    )}
                    {canGeoFence && selectedVehicleId === v.id && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>ژئوفنس</Typography>

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

                          <Button size="small" variant="contained" color="primary" onClick={saveGeofenceBM}>
                            ذخیره ژئوفنس
                          </Button>

                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={deleteGeofenceBM}
                            disabled={!selectedVehicleId || (geofencesByVid[selectedVehicleId]?.length ?? 0) === 0}
                          >
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

                    {/* === لوازم مصرفی برای همین ماشین (داخل map) === */}
                    {canConsumables && selectedVehicleId === v.id && (
                      <Box sx={{ mx: 1.5, mt: 1.5 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <Typography variant="subtitle2">لوازم مصرفی</Typography>
                          <Tooltip title="افزودن">
                            <IconButton size="small" onClick={() => setConsumablesOpen(true)}>＋</IconButton>
                          </Tooltip>
                          <Box flex={1} />
                          <Typography variant="caption" color="text.secondary">
                            کیلومترشمار: {vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}
                          </Typography>
                        </Stack>

                        {consStatusByVid[v.id] === 'loading' ? (
                          <Box display="flex" alignItems="center" gap={1} color="text.secondary" sx={{ mt: .5 }}>
                            <CircularProgress size={16} /> در حال دریافت…
                          </Box>
                        ) : (consumablesByVid[v.id] || []).length ? (
                          <List dense sx={{ maxHeight: 180, overflow: 'auto' }}>
                            {(consumablesByVid[v.id] || []).map((c: any, i: number) => (
                              <ListItem
                                key={c.id ?? i}
                                divider
                                secondaryAction={
                                  <Stack direction="row" spacing={0.5}>
                                    <IconButton size="small" title="ویرایش" onClick={() => openEditConsumable(c)}>✏️</IconButton>
                                    <IconButton size="small" color="error" title="حذف" onClick={() => deleteConsumable(c)}>🗑️</IconButton>
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
                        ) : consStatusByVid[v.id] === 'error' ? (
                          <Typography color="warning.main">خطا در دریافت. دوباره تلاش کنید.</Typography>
                        ) : (
                          <Typography color="text.secondary">آیتمی ثبت نشده.</Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                );
              }))
            )}
          </List>

          {/* دیالوگ افزودن/تنظیم مصرفی (یک‌بار) */}
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
                    <DateTimePicker<Date> label="تاریخ یادآوری" value={tripDate}
                      onChange={(val) => setTripDate(val)} ampm={false}
                      slotProps={{ textField: { fullWidth: true } }} format="yyyy/MM/dd HH:mm" />
                  </LocalizationProvider>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">کیلومترشمار فعلی:</Typography>
                        <Typography variant="h6">{vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}</Typography>
                      </Stack>
                      <TextField label="مقدار مبنا (از آخرین صفر)" type="number"
                        value={tripBaseKm ?? ''} onChange={(e) => setTripBaseKm(e.target.value ? Number(e.target.value) : null)} fullWidth />
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
  // بعد از typeGrants:

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
    useMapEvent('click', (e) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
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

    // ریست حالت‌های افزودن/ادیت ایستگاه
    setAddingStationsForVid(null);
    setEditingStation(null);
    setMovingStationId(null);
    setTempStation(null);

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

  // ===== فیلتر/جستجو =====


  // ===== UI =====
  const typeLabel = (code: VehicleTypeCode) => VEHICLE_TYPES.find(t => t.code === code)?.label || code;
  // اطمینان از سابسکرایب شدن به ایستگاه‌های یک ماشین + اولین fetch


  // هندل کلیک روی یک ماشین در لیست (مثل SA)



  // به‌روزرسانی Map ایستگاه‌ها با پیام‌های سوکت
  /*React.useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const onStations = (msg: any) => {
      // انتظار: msg = { vehicle_id, type: 'created'|'updated'|'deleted', station?, station_id? }
      const vid = Number(msg?.vehicle_id ?? msg?.vehicleId);
      if (!Number.isFinite(vid)) return;

      setVehicleStationsMap(prev => {
        const list = (prev[vid] || []).slice();

        if (msg?.type === 'created' && msg.station) {
          // اگر تکراری نبود، اضافه کن
          if (!list.some(x => x.id === msg.station.id)) list.push(msg.station);
        } else if (msg?.type === 'updated' && msg.station) {
          const i = list.findIndex(x => x.id === msg.station.id);
          if (i >= 0) list[i] = msg.station;
        } else if (msg?.type === 'deleted' && msg.station_id) {
          const sid = Number(msg.station_id);
          return { ...prev, [vid]: list.filter(x => x.id !== sid) };
        }

        return { ...prev, [vid]: list };
      });
    };

    s.on('vehicle:stations', onStations);
    return () => { s.off('vehicle:stations', onStations); };
  }, []);*/

  const gfKey = (gf: Geofence, idx: number) =>
    gf.id != null ? `gf-${gf.id}` : `gf-${gf.type}-${idx}`;
  return (
    <Grid2 container spacing={2} dir="ltr">
      {/* Map */}
      <Grid2 xs={12} md={8}>
        <Paper sx={{ height: '75vh', overflow: 'hidden' }} dir="rtl">
          <MapContainer zoom={INITIAL_ZOOM} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} style={{ width: '100%', height: '100%' }}>
            <InitView center={INITIAL_CENTER} zoom={INITIAL_ZOOM} />
            <TileLayer url={tileUrl} {...({ attribution: '&copy; OpenStreetMap | © MapTiler' } as any)} />
            <FocusOn target={focusLatLng} />
            {activeType && canGeoFence && selectedVehicleId && (
              <PickPointsForGeofence
                enabled={gfDrawing}
                onPick={(lat, lng) => {
                  if (gfMode === 'circle') setGfCenter({ lat, lng });
                  else setGfPoly(prev => [...prev, { lat, lng }]);
                }}
              />
            )}

            {/* پیش‌نمایش ترسیم */}
            {gfDrawing && gfMode === 'circle' && gfCenter && (
              <Circle center={[gfCenter.lat, gfCenter.lng]} radius={gfRadius} />
            )}
            {gfDrawing && gfMode === 'polygon' && gfPoly.length >= 2 && (
              <Polygon positions={gfPoly.map(p => [p.lat, p.lng] as [number, number])} pathOptions={{ dashArray: '6 6' }} />
            )}

            {/* ژئوفنس ذخیره‌شده سرور برای ماشین انتخاب‌شده */}
            {selectedVehicleId && (geofencesByVid[selectedVehicleId] || []).map((gf, idx) =>
              gf.type === 'circle'
                ? <Circle key={gfKey(gf, idx)} center={[gf.center.lat, gf.center.lng]} radius={gf.radius_m} />
                : <Polygon key={gfKey(gf, idx)} positions={gf.points.map(p => [p.lat, p.lng] as [number, number])} />
            )}

            {/* دیالوگ ویرایش مصرفی */}
            <Dialog open={!!editingCons} onClose={() => setEditingCons(null)} fullWidth maxWidth="sm">
              <DialogTitle>ویرایش آیتم مصرفی</DialogTitle>
              <DialogContent dividers>
                <Stack spacing={2}>
                  <TextField label="توضیح/یادداشت" value={editingCons?.note ?? ''} onChange={(e) => setEditingCons((p: any) => ({ ...p, note: e.target.value }))} fullWidth />
                  <RadioGroup row value={editingCons?.mode ?? 'km'}
                    onChange={(_, v) => setEditingCons((p: any) => ({
                      ...p, mode: v as 'km' | 'time',
                      start_at: v === 'time' ? (p?.start_at ?? new Date().toISOString()) : null,
                      base_odometer_km: v === 'km' ? (p?.base_odometer_km ?? 0) : null,
                    }))}
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
                        ampm={false} slotProps={{ textField: { fullWidth: true } }} format="yyyy/MM/dd HH:mm"
                      />
                    </LocalizationProvider>
                  ) : (
                    <TextField label="مقدار مبنا (کیلومتر)" type="number"
                      value={editingCons?.base_odometer_km ?? ''}
                      onChange={(e) => setEditingCons((p: any) => ({ ...p, base_odometer_km: e.target.value ? Number(e.target.value) : null }))}
                      fullWidth />
                  )}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditingCons(null)}>انصراف</Button>
                <Button variant="contained" onClick={saveEditConsumable} disabled={savingCons}>ذخیره</Button>
              </DialogActions>
            </Dialog>

            {/* Snackbar */}
            {toast?.open && (
              <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="warning" onClose={() => setToast(null)} sx={{ width: '100%' }}>
                  {toast.msg}
                </Alert>
              </Snackbar>
            )}

            {/* مارکر راننده‌ها */}
            {tab === 'drivers' && canTrackDrivers && filteredDrivers.map(d => (d as any).last_location && (
              <Marker key={`d-${d.id}`} position={[(d as any).last_location.lat, (d as any).last_location.lng]} icon={driverMarkerIcon}>
                <Popup><strong>{d.full_name}</strong><br />{d.phone || '—'}</Popup>
              </Marker>
            ))}
            {tab === 'drivers' && canTrackDrivers && polyline.length > 1 && <Polyline positions={polyline} />}

            {/* مارکر ماشین‌ها برای تب فعال */}
            {activeType && canTrackVehicles && filteredVehicles.map(v => v.last_location && (
              <Marker key={`v-${v.id}`} position={[v.last_location.lat, v.last_location.lng]} icon={vehicleMarkerIcon}>
                <Popup><strong>{v.plate_no}</strong><br />{v.vehicle_type_code}</Popup>
              </Marker>
            ))}

            {/* کلیک برای ایجاد ایستگاه */}
            <PickPointsForStations enabled={!!addingStationsForVid} onPick={(lat, lng) => setTempStation({ lat, lng })} />

            {/* ایستگاه‌های ماشین در حالت افزودن/ویرایش */}
            {!!addingStationsForVid && (vehicleStationsMap[addingStationsForVid] || []).map(st => (
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


            {/* مارکر موقت ایجاد ایستگاه */}
            {addingStationsForVid && tempStation && (
              <>
                <Circle center={[tempStation.lat, tempStation.lng]} radius={stationRadius} />
                <Marker
                  position={[tempStation.lat, tempStation.lng]}
                  draggable
                  eventHandlers={{
                    add: (e: any) => e.target.openPopup(),
                    dragend: (e: any) => { const ll = e.target.getLatLng(); setTempStation({ lat: ll.lat, lng: ll.lng }); },
                  }}
                >
                  <Popup autoClose={false} closeOnClick={false} autoPan>
                    <div style={{ minWidth: 220 }}>
                      <strong>ایجاد ایستگاه</strong>
                      <div style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>می‌توانید مارکر را جابجا کنید.</div>
                      <div style={{ marginTop: 8 }}>
                        <input style={{ width: '100%', padding: 6 }} placeholder="نام ایستگاه" value={tempName} onChange={e => setTempName(e.target.value)} />
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

            {/* جابه‌جایی ایستگاه در حالت ویرایش */}
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
          </MapContainer>
        </Paper>
      </Grid2>

      {/* سایدبار */}
      <Grid2 xs={12} md={4}>
        <Paper sx={{ p: 2, height: '75vh', display: 'flex', flexDirection: 'column' }} dir="rtl">
          {/* بازه */}
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
                <DateTimePicker label="از" value={new Date(fromISO)} onChange={(v) => v && setFromISO(new Date(v).toISOString())} slotProps={{ textField: { size: 'small' } }} />
                <DateTimePicker label="تا" value={new Date(toISO)} onChange={(v) => v && setToISO(new Date(v).toISOString())} slotProps={{ textField: { size: 'small' } }} />
              </LocalizationProvider>
            )}
          </Stack>

          {/* تب‌ها */}
          <Tabs
            value={tab}
            onChange={(_, v) => { setTab(v); setQ(''); setPolyline([]); setAddingStationsForVid(null); setTempStation(null); setEditingStation(null); setMovingStationId(null); }}
            sx={{ mb: 1 }}
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

          {/* === تله‌متری لحظه‌ای ماشین انتخاب‌شده (در صورت داشتن تیک‌ها) === */}
          {activeType && selectedVehicleId && (canIgnition || canIdleTime || canOdometer) && (
            <Stack spacing={1} sx={{ mb: 1.5 }}>
              {canIgnition && (
                <Paper sx={{ p: 1.25 }}>
                  <Typography variant="body2" color="text.secondary">وضعیت سوئیچ</Typography>
                  <Typography variant="h6">
                    {vehicleTlm.ignition === true ? 'موتور روشن است'
                      : vehicleTlm.ignition === false ? 'موتور خاموش است' : 'نامشخص'}
                  </Typography>
                </Paper>
              )}
              {canIdleTime && (
                <Paper sx={{ p: 1.25 }}>
                  <Typography variant="body2" color="text.secondary">مدت توقف/سکون</Typography>
                  <Typography variant="h6">
                    {vehicleTlm.idle_time != null
                      ? `${vehicleTlm.idle_time.toLocaleString('fa-IR')} ثانیه`
                      : '—'}
                  </Typography>
                </Paper>
              )}
              {canOdometer && (
                <Paper sx={{ p: 1.25 }}>
                  <Typography variant="body2" color="text.secondary">کیلومترشمار</Typography>
                  <Typography variant="h6">
                    {vehicleTlm.odometer != null
                      ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km`
                      : 'نامشخص'}
                  </Typography>
                </Paper>
              )}
            </Stack>
          )}

          {/* جستجو */}
          <TextField
            size="small"
            placeholder={tab === 'drivers' ? 'جستجو نام/موبایل' : 'جستجو پلاک'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
            sx={{ mb: 1 }}
          />

          {/* لیست */}
          <List sx={{ overflow: 'auto', flex: 1 }}>
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
                              disabled={!canTrackDrivers}
                              onClick={(e) => { e.stopPropagation(); loadDriverTrack(d.id); }}
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
              // تب نوع خودرو
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
                          {canStations && (
                            <Button
                              size="small"
                              variant={addingStationsForVid === v.id ? 'contained' : 'outlined'}
                              onClick={(e) => { e.stopPropagation(); startAddingStationsFor(v.id); }}
                            >
                              {addingStationsForVid === v.id ? 'پایان افزودن' : 'ایجاد ایستگاه'}
                            </Button>
                          )}
                        </Stack>
                      }
                    >
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                        <Avatar>{v.plate_no?.charAt(0) ?? 'م'}</Avatar>
                        <Box sx={{ flex: 1 }}>
                          <ListItemText primary={v.plate_no} secondary={typeLabel(v.vehicle_type_code)} />
                        </Box>
                      </Stack>
                    </ListItem>

                    {/* لیست ایستگاه‌های این ماشین */}
                    {canStations && (
                      <Box sx={{ mx: 1.5, mt: .5 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <TextField
                            size="small" type="number" label="شعاع (m)" value={stationRadius}
                            onChange={(e) => setStationRadius(Math.max(1, Number(e.target.value || 0)))} sx={{ width: 130 }}
                          />
                        </Stack>

                        {Array.isArray(stations) && stations.length ? (
                          <List dense sx={{ maxHeight: 180, overflow: 'auto' }}>
                            {stations.map(st => {
                              const isEditing = isEditingBlock && editingStation?.st.id === st.id;
                              return (
                                <Box key={st.id}>
                                  <ListItem
                                    disableGutters
                                    secondaryAction={
                                      <Stack direction="row" spacing={0.5}>
                                        <IconButton size="small" onClick={() => setFocusLatLng([st.lat, st.lng])} title="نمایش روی نقشه">📍</IconButton>
                                        <IconButton
                                          size="small"
                                          onClick={() => {
                                            if (isEditing) { setEditingStation(null); setMovingStationId(null); }
                                            else { setEditingStation({ vid: v.id, st: { ...st } }); setMovingStationId(null); }
                                          }}
                                          title="ویرایش"
                                        >✏️</IconButton>
                                        <IconButton size="small" color="error" onClick={() => deleteStation(v.id, st)} title="حذف">🗑️</IconButton>
                                      </Stack>
                                    }
                                  >
                                    <ListItemText primary={st.name} secondary={`${fmtLL(st.lat)}, ${fmtLL(st.lng)}`} />
                                  </ListItem>

                                  <Collapse in={isEditing} timeout="auto" unmountOnExit>
                                    <Box sx={{ mx: 1.5, mt: .5, p: 1.25, bgcolor: 'action.hover', borderRadius: 1, border: (t) => `1px solid ${t.palette.divider}` }}>
                                      <Stack spacing={1.25}>
                                        <TextField size="small" label="نام" value={editingStation?.st.name ?? ''} onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, name: e.target.value } }) : ed)} />
                                        <TextField size="small" type="number" label="شعاع (m)" value={editingStation?.st.radius_m ?? 0}
                                          onChange={(e) => setEditingStation(ed => ed ? ({ ...ed, st: { ...ed.st, radius_m: Math.max(1, Number(e.target.value || 0)) } }) : ed)} />
                                        <Stack direction="row" spacing={1} alignItems="center">
                                          <Button size="small" variant={movingStationId === st.id ? 'contained' : 'outlined'} onClick={() => setMovingStationId(movingStationId === st.id ? null : st.id)}>جابجایی روی نقشه</Button>
                                          <Box flex={1} />
                                          <Typography variant="caption" color="text.secondary">
                                            {fmtLL(editingStation?.st.lat as number)}, {fmtLL(editingStation?.st.lng as number)}
                                          </Typography>
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
                        )}
                      </Box>
                    )}
                    {canGeoFence && selectedVehicleId === v.id && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>ژئوفنس</Typography>

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

                          <Button size="small" variant="contained" color="primary" onClick={saveGeofenceBM}>
                            ذخیره ژئوفنس
                          </Button>

                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={deleteGeofenceBM}
                            disabled={!selectedVehicleId || (geofencesByVid[selectedVehicleId]?.length ?? 0) === 0}
                          >
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

                    {/* === لوازم مصرفی برای همین ماشین (داخل map) === */}
                    {canConsumables && selectedVehicleId === v.id && (
                      <Box sx={{ mx: 1.5, mt: 1.5 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <Typography variant="subtitle2">لوازم مصرفی</Typography>
                          <Tooltip title="افزودن">
                            <IconButton size="small" onClick={() => setConsumablesOpen(true)}>＋</IconButton>
                          </Tooltip>
                          <Box flex={1} />
                          <Typography variant="caption" color="text.secondary">
                            کیلومترشمار: {vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}
                          </Typography>
                        </Stack>

                        {consStatusByVid[v.id] === 'loading' ? (
                          <Box display="flex" alignItems="center" gap={1} color="text.secondary" sx={{ mt: .5 }}>
                            <CircularProgress size={16} /> در حال دریافت…
                          </Box>
                        ) : (consumablesByVid[v.id] || []).length ? (
                          <List dense sx={{ maxHeight: 180, overflow: 'auto' }}>
                            {(consumablesByVid[v.id] || []).map((c: any, i: number) => (
                              <ListItem
                                key={c.id ?? i}
                                divider
                                secondaryAction={
                                  <Stack direction="row" spacing={0.5}>
                                    <IconButton size="small" title="ویرایش" onClick={() => openEditConsumable(c)}>✏️</IconButton>
                                    <IconButton size="small" color="error" title="حذف" onClick={() => deleteConsumable(c)}>🗑️</IconButton>
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
                        ) : consStatusByVid[v.id] === 'error' ? (
                          <Typography color="warning.main">خطا در دریافت. دوباره تلاش کنید.</Typography>
                        ) : (
                          <Typography color="text.secondary">آیتمی ثبت نشده.</Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                );
              }))
            )}
          </List>

          {/* دیالوگ افزودن/تنظیم مصرفی (یک‌بار) */}
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
                    <DateTimePicker<Date> label="تاریخ یادآوری" value={tripDate}
                      onChange={(val) => setTripDate(val)} ampm={false}
                      slotProps={{ textField: { fullWidth: true } }} format="yyyy/MM/dd HH:mm" />
                  </LocalizationProvider>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">کیلومترشمار فعلی:</Typography>
                        <Typography variant="h6">{vehicleTlm.odometer != null ? `${vehicleTlm.odometer.toLocaleString('fa-IR')} km` : '—'}</Typography>
                      </Stack>
                      <TextField label="مقدار مبنا (از آخرین صفر)" type="number"
                        value={tripBaseKm ?? ''} onChange={(e) => setTripBaseKm(e.target.value ? Number(e.target.value) : null)} fullWidth />
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
  type VehicleTelemetry = { ignition?: boolean; idle_time?: number; odometer?: number };
  type Assignment = {
    id: number; vehicle_id: number; started_at: string; ended_at?: string | null; vehicle?: Vehicle
  };
  type TrackPoint = { lat: number; lng: number; ts?: string | number };

  // --- state ---
  const [useMapTiler, setUseMapTiler] = useState(Boolean(MT_KEY));
  const tileUrl = useMapTiler && MT_KEY
    ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MT_KEY}`
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const [enabledOptions, setEnabledOptions] = useState<string[]>([]);           // از SA
  const [loading, setLoading] = useState(true);

  const [currentAssign, setCurrentAssign] = useState<Assignment | null>(null); // انتساب فعال
  const [assignHistory, setAssignHistory] = useState<Assignment[]>([]);        // لیست خودروهای من در گذشته
  const myVehicles = useMemo(() => {
    const list = assignHistory
      .map(a => a.vehicle)
      .filter(Boolean) as Vehicle[];
    // یکتا
    const seen = new Set<number>();
    return list.filter(v => (seen.has(v.id) ? false : (seen.add(v.id), true)));
  }, [assignHistory]);

  // فیلتر وسیله: 'all' یا id خودرو
  const [vehicleFilter, setVehicleFilter] = useState<'all' | number>('all');

  // بازه‌ی تاریخ
  const [rangePreset, setRangePreset] = useState<'today' | 'yesterday' | '7d' | 'custom'>('today');
  const [fromISO, setFromISO] = useState<string>(() => new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  const [toISO, setToISO] = useState<string>(() => new Date().toISOString());

  useEffect(() => {
    const now = new Date();
    if (rangePreset === 'today') {
      setFromISO(new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
      setToISO(now.toISOString());
    } else if (rangePreset === 'yesterday') {
      const s = new Date(); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0);
      const e = new Date(s); e.setHours(23, 59, 59, 999);
      setFromISO(s.toISOString()); setToISO(e.toISOString());
    } else if (rangePreset === '7d') {
      const s = new Date(); s.setDate(s.getDate() - 7);
      setFromISO(s.toISOString()); setToISO(now.toISOString());
    }
  }, [rangePreset]);

  // نقشه/لایو
  const [polyline, setPolyline] = useState<[number, number][]>([]);
  const [focusLatLng, setFocusLatLng] = useState<[number, number] | undefined>(undefined);
  const [telemetry, setTelemetry] = useState<VehicleTelemetry>({});
  const socketRef = useRef<Socket | null>(null);

  // آمار بازه
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState<{ total_trips?: number; total_distance_km?: number; total_work_seconds?: number }>({});

  // ————— helpers —————
  const INITIAL_CENTER: [number, number] = [32.4279, 53.688];
  const INITIAL_ZOOM = 15; const MIN_ZOOM = 7; const MAX_ZOOM = 22;

  const fmtDurHM = (secs?: number) => {
    if (!secs || secs <= 0) return '—';
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
    return `${h}ساعت ${m}دقیقه`;
  };
  const havKm = (a: [number, number], b: [number, number]) => {
    const toRad = (x: number) => x * Math.PI / 180, R = 6371;
    const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]);
    const la1 = toRad(a[0]), la2 = toRad(b[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  // مجموع نقاط برای fit
  const latlngs = useMemo<[number, number][]>(() => polyline, [polyline]);

  // ————— data init —————
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);

        // قابلیت‌هایی که SA برای این راننده فعال کرده
        const optsRes = await api.get(`/driver-routes/options/${user.id}`).catch(() => null);
        const raw: string[] = Array.isArray(optsRes?.data) ? optsRes!.data :
          (Array.isArray(optsRes?.data?.options) ? optsRes!.data.options : []);
        const opts = Array.from(new Set((raw || []).map(s => s?.toString().trim().toLowerCase()).filter(Boolean)));
        if (alive) setEnabledOptions(opts);

        // انتساب فعلی و تاریخچه
        const [cur, hist] = await Promise.all([
          api.get(`/assignments/current/${user.id}`).catch(() => ({ data: null })),
          api.get(`/assignments/history/${user.id}`).catch(() => ({ data: [] })),
        ]);
        const current: Assignment | null = cur?.data ?? null;
        const history: Assignment[] = Array.isArray(hist?.data) ? hist!.data : [];

        if (!alive) return;
        setCurrentAssign(current);
        setAssignHistory(history);

        // اگر امروز و GPS فعاله، مسیر فعال/امروز رو بیار
        if (opts.includes('gps')) {
          await loadTrack({ driverId: user.id, vehicleId: (vehicleFilter === 'all' ? undefined : vehicleFilter), from: fromISO, to: toISO });
        }

        // آمار بازه
        await refreshStats();

      } finally { if (alive) setLoading(false); }
    })();

    async function refreshStats() {
      setStatsLoading(true);
      try {
        // آمار سمت سرور برای راننده (فیلتر ماشین را سمت سرور اگر داری بفرست؛ اگر نداری client-side جمع می‌زنیم)
        // تلاش ۱: با vehicle_id
        let res = null;
        if (vehicleFilter !== 'all') {
          res = await api.get(`/driver-routes/stats/${user.id}`, { params: { from: fromISO, to: toISO, vehicle_id: vehicleFilter } }).catch(() => null);
        }
        // تلاش ۲: بدون فیلتر ماشین
        if (!res) res = await api.get(`/driver-routes/stats/${user.id}`, { params: { from: fromISO, to: toISO } }).catch(() => null);

        if (res?.data) setStats(res.data);
        else {
          // fallback: از polyline محلی مسافت را تخمین بزن
          let d = 0; for (let i = 1; i < polyline.length; i++) d += havKm(polyline[i - 1], polyline[i]);
          setStats({ total_distance_km: +d.toFixed(2) });
        }
      } finally { setStatsLoading(false); }
    }

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // ————— load track by filters —————
  const loadTrack = async ({ driverId, vehicleId, from, to }: {
    driverId: number; vehicleId?: number; from: string; to: string;
  }) => {
    try {
      const params: any = { driver_id: driverId, from, to };
      if (vehicleId) params.vehicle_id = vehicleId;
      const { data } = await api.get('/tracks', { params }).catch(() => ({ data: [] }));
      const pts: TrackPoint[] = Array.isArray(data) ? data : (data?.items ?? []);
      setPolyline(pts.map(p => [p.lat, p.lng]));
      if (pts.length) setFocusLatLng([pts[pts.length - 1].lat, pts[pts.length - 1].lng]);
    } catch {
      setPolyline([]);
    }
  };

  // ————— socket live (فقط وقتی today و gps روشن) —————
  useEffect(() => {
    const isTodayRange = (() => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date();   // حالا
      const f = +new Date(fromISO), t = +new Date(toISO);
      return f >= +start && t <= +end && t >= f;
    })();

    if (!enabledOptions.includes('gps') || !isTodayRange) return;

    const s = io((import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000') + '/driver-routes', {
      transports: ['websocket'],
      query: { userId: String(user.id), roleLevel: '6' }
    });
    socketRef.current = s;

    s.on('connect', () => s.emit('watch_driver', { driverId: user.id }));

    const onHistory = (msg: { routeId: number; driverId: number; points: any[] }) => {
      if (msg?.driverId !== user.id) return;
      const pts = Array.isArray(msg.points) ? msg.points : [];
      // اگر فیلتر خودرو داریم، اجازه بده فقط وقتی همین خودرو هست مسیر را آپدیت کنیم (در بک‌اند route.vehicle_id موجود باشد)
      setPolyline(pts.map((p: any) => [p.lat, p.lng]));
      if (pts.length) setFocusLatLng([pts[pts.length - 1].lat, pts[pts.length - 1].lng]);
    };

    const onSelf = (p: { routeId: number; driverId: number; lat: number; lng: number }) => {
      if (p.driverId !== user.id) return;
      setPolyline(prev => {
        const next = [...prev, [p.lat, p.lng] as [number, number]];
        if (next.length > 800) next.shift();
        return next;
      });
      setFocusLatLng([p.lat, p.lng]);
    };

    s.on('route_history', onHistory);
    s.on('driver_location_update_self', onSelf);

    // تله‌متریِ خودرو جاری (اگر داریم و گزینه‌اش مجاز است)
    if (currentAssign?.vehicle_id) {
      const vid = currentAssign.vehicle_id;
      (['ignition', 'idle_time', 'odometer'] as const).forEach(k => {
        if (enabledOptions.includes(k)) s.emit('subscribe', { topic: `vehicle/${vid}/${k}` });
      });

      const onIgn = (d: { vehicle_id: number; ignition: boolean }) => { if (d.vehicle_id === vid) setTelemetry(p => ({ ...p, ignition: d.ignition })); };
      const onIdle = (d: { vehicle_id: number; idle_time: number }) => { if (d.vehicle_id === vid) setTelemetry(p => ({ ...p, idle_time: d.idle_time })); };
      const onOdo = (d: { vehicle_id: number; odometer: number }) => { if (d.vehicle_id === vid) setTelemetry(p => ({ ...p, odometer: d.odometer })); };

      s.on('vehicle:ignition', onIgn);
      s.on('vehicle:idle_time', onIdle);
      s.on('vehicle:odometer', onOdo);

      // مقدار اولیه‌ی تله‌متری
      (async () => {
        try {
          const { data } = await api.get(`/vehicles/${vid}/telemetry`, { params: { keys: ['ignition', 'idle_time', 'odometer'] } });
          setTelemetry({
            ignition: data?.ignition ?? undefined,
            idle_time: data?.idle_time ?? undefined,
            odometer: data?.odometer ?? undefined,
          });
        } catch { }
      })();

      return () => {
        (['ignition', 'idle_time', 'odometer'] as const).forEach(k => {
          if (enabledOptions.includes(k)) s.emit('unsubscribe', { topic: `vehicle/${vid}/${k}` });
        });
        s.off('route_history', onHistory);
        s.off('driver_location_update_self', onSelf);
        s.off('vehicle:ignition'); s.off('vehicle:idle_time'); s.off('vehicle:odometer');
        s.disconnect(); socketRef.current = null;
      };
    }

    return () => {
      s.off('route_history', onHistory);
      s.off('driver_location_update_self', onSelf);
      s.disconnect(); socketRef.current = null;
    };
  }, [user.id, enabledOptions.join(','), currentAssign?.vehicle_id, fromISO, toISO]);

  // ===== UI =====
  return (
    <Grid2 container spacing={2} dir="ltr">
      {/* نقشه */}
      <Grid2 xs={12} md={8}>
        <Paper sx={{ height: '70vh', overflow: 'hidden' }} dir="rtl">
          <MapContainer zoom={INITIAL_ZOOM} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} style={{ width: '100%', height: '100%' }}>
            <InitView center={INITIAL_CENTER} zoom={INITIAL_ZOOM} />
            <TileLayer url={tileUrl} {...({ attribution: '&copy; OpenStreetMap | © MapTiler' } as any)} />
            {useMapTiler && <TileErrorLogger onMapTilerFail={() => setUseMapTiler(false)} />}
            <FocusOn target={focusLatLng} />
            <FitToLatLngs latlngs={latlngs} />
            {polyline.length > 1 && <Polyline positions={polyline} />}
          </MapContainer>
        </Paper>
      </Grid2>

      {/* کنترل‌ها + آمار + لیست خودروها/انتساب‌ها */}
      <Grid2 xs={12} md={4}>
        <Paper sx={{ p: 2, height: '70vh', display: 'flex', flexDirection: 'column' }} dir="rtl">
          <Typography variant="h6" gutterBottom>مسیرها و آمار من</Typography>

          {/* فیلترها */}
          <Stack spacing={1.2} sx={{ mb: 1.5 }}>
            {/* انتخاب خودرو */}
            <FormControl size="small">
              <InputLabel id="veh-filter">خودرو</InputLabel>
              <Select
                labelId="veh-filter" label="خودرو"
                value={vehicleFilter}
                onChange={(e) => setVehicleFilter((e.target.value as 'all' | number))}
              >
                <MenuItem value="all">همهٔ خودروها</MenuItem>
                {myVehicles.map(v => (
                  <MenuItem key={v.id} value={v.id}>{v.plate_no} — {v.vehicle_type_code}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* بازه تاریخی */}
            <Stack direction="row" spacing={1}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel id="dr-range">بازه</InputLabel>
                <Select
                  labelId="dr-range" label="بازه"
                  value={rangePreset}
                  onChange={(e) => setRangePreset(e.target.value as any)}
                >
                  <MenuItem value="today">امروز</MenuItem>
                  <MenuItem value="yesterday">دیروز</MenuItem>
                  <MenuItem value="7d">۷ روز اخیر</MenuItem>
                  <MenuItem value="custom">دلخواه</MenuItem>
                </Select>
              </FormControl>

              <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                <DateTimePicker
                  label="از"
                  value={new Date(fromISO)}
                  onChange={(val) => { if (val) { setRangePreset('custom'); setFromISO(val.toISOString()); } }}
                  format="yyyy/MM/dd HH:mm"
                  ampm={false}
                  slotProps={{ textField: { size: 'small' } }}
                />
              </LocalizationProvider>
              <LocalizationProvider dateAdapter={AdapterDateFnsJalali} adapterLocale={faIR}>
                <DateTimePicker
                  label="تا"
                  value={new Date(toISO)}
                  onChange={(val) => { if (val) { setRangePreset('custom'); setToISO(val.toISOString()); } }}
                  format="yyyy/MM/dd HH:mm"
                  ampm={false}
                  slotProps={{ textField: { size: 'small' } }}
                />
              </LocalizationProvider>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                size="small" variant="contained"
                onClick={() => loadTrack({
                  driverId: user.id,
                  vehicleId: vehicleFilter === 'all' ? undefined : vehicleFilter,
                  from: fromISO, to: toISO
                })}
              >
                نمایش مسیرها
              </Button>
              <Button
                size="small"
                onClick={async () => {
                  // آمار بازه با فیلتر خودرو
                  try {
                    setStatsLoading(true);
                    let res = null;
                    if (vehicleFilter !== 'all') {
                      res = await api.get(`/driver-routes/stats/${user.id}`, { params: { from: fromISO, to: toISO, vehicle_id: vehicleFilter } }).catch(() => null);
                    }
                    if (!res) res = await api.get(`/driver-routes/stats/${user.id}`, { params: { from: fromISO, to: toISO } }).catch(() => null);
                    if (res?.data) setStats(res.data);
                    else {
                      // fallback از پلی‌لاین فعلی
                      let d = 0; for (let i = 1; i < polyline.length; i++) d += havKm(polyline[i - 1], polyline[i]);
                      setStats({ total_distance_km: +d.toFixed(2) });
                    }
                  } finally { setStatsLoading(false); }
                }}
              >
                بروزرسانی آمار
              </Button>
            </Stack>
          </Stack>

          {/* کارت‌های تله‌متری (در صورت مجاز بودن) */}
          <FeatureCards enabled={enabledOptions} telemetry={telemetry} />

          <Divider sx={{ my: 1.5 }} />

          {/* آمار بازه */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            آمار بازهٔ انتخابی {vehicleFilter !== 'all' && `— ${myVehicles.find(v => v.id === vehicleFilter)?.plate_no ?? ''}`}
          </Typography>
          {statsLoading ? (
            <Box display="flex" alignItems="center" justifyContent="center" py={1}><CircularProgress size={18} /></Box>
          ) : (
            <Grid2 container spacing={1}>
              <Grid2 xs={12} sm={4}>
                <Paper sx={{ p: 1.25 }}>
                  <Typography variant="body2" color="text.secondary">تعداد سفر</Typography>
                  <Typography variant="h6">{stats.total_trips ?? '—'}</Typography>
                </Paper>
              </Grid2>
              <Grid2 xs={12} sm={4}>
                <Paper sx={{ p: 1.25 }}>
                  <Typography variant="body2" color="text.secondary">مسافت</Typography>
                  <Typography variant="h6">
                    {(stats.total_distance_km ?? 0).toLocaleString('fa-IR')} km
                  </Typography>
                </Paper>
              </Grid2>
              <Grid2 xs={12} sm={4}>
                <Paper sx={{ p: 1.25 }}>
                  <Typography variant="body2" color="text.secondary">مدت کار</Typography>
                  <Typography variant="h6">{fmtDurHM(stats.total_work_seconds)}</Typography>
                </Paper>
              </Grid2>
            </Grid2>
          )}

          <Divider sx={{ my: 1.5 }} />

          {/* لیست خودروهای من (انتساب‌ها) */}
          <Typography variant="subtitle2" sx={{ mb: .5 }}>خودروهای من</Typography>
          <List dense sx={{ flex: 1, overflow: 'auto' }}>
            {assignHistory.length ? assignHistory.map(a => (
              <React.Fragment key={a.id}>
                <ListItem
                  secondaryAction={
                    a.vehicle?.last_location && (
                      <IconButton edge="end" onClick={() => setFocusLatLng([a.vehicle!.last_location!.lat, a.vehicle!.last_location!.lng])}>
                        📍
                      </IconButton>
                    )
                  }
                >
                  <ListItemAvatar>
                    <Avatar>{a.vehicle?.plate_no?.charAt(0) ?? 'م'}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={a.vehicle?.plate_no ?? `Vehicle #${a.vehicle_id}`}
                    secondary={
                      <>
                        {a.vehicle?.vehicle_type_code ?? '—'}
                        {' — از '}
                        {new Date(a.started_at).toLocaleString('fa-IR')}
                        {a.ended_at ? ` تا ${new Date(a.ended_at).toLocaleString('fa-IR')}` : ' (جاری)'}
                      </>
                    }
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            )) : (
              <Typography color="text.secondary" sx={{ px: 1 }}>سابقه‌ای ثبت نشده.</Typography>
            )}
          </List>
        </Paper>
      </Grid2>
    </Grid2>
  );
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
