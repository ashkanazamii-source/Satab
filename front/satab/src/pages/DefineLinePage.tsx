// src/pages/DefineLinePage.tsx
import React from 'react';
import { useEffect, useMemo, useCallback } from 'react';
import {
    Box, Paper, Stack, Typography, IconButton, TextField, InputAdornment,
    Tabs, Tab, List, ListItem, ListItemAvatar, Avatar, ListItemText, Button,
    Divider, Tooltip, MenuItem, Select, Chip, Dialog, DialogTitle, DialogContent,
    DialogActions, FormControl, InputLabel, Checkbox, FormControlLabel, ListItemSecondaryAction,
    CircularProgress
} from '@mui/material';
import Drawer from '@mui/material/Drawer';
import {
    ListItemButton, ListItemIcon,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import AltRouteOutlined from '@mui/icons-material/AltRouteOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import DirectionsWalkRoundedIcon from '@mui/icons-material/DirectionsWalkRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import DirectionsBusFilledRoundedIcon from '@mui/icons-material/DirectionsBusFilledRounded';
import { Circle, Polygon, Polyline, useMapEvent } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
// Date pickers (در صورت نداشتن Dayjs هم کار می‌کند؛ بعداً می‌توانی آداپتر شمسی اضافه کنی)
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import api from '../services/api';
// react-leaflet
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import type { LeafletMouseEvent } from 'leaflet';
const defaultIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;
type User = { id: number; role_level: number; full_name?: string };

type Vehicle = {
    id: number;
    owner_user_id: number;
    vehicle_type_code?: string;
    [k: string]: any;
};

// ---------- Helpers ----------
const ACC = '#00c6be';

// ⬇️ برای هم‌خوانی با الگوی خودت
type MonitorKey = any; // اگر جای دیگه MonitorKey داری از همون import کن

// اگر لیست وسایل نقلیه را جایی داری، این ref را موقع لود پر کن (برای fallback)


// وقتی کاربر یک خودرو انتخاب می‌کند، این state را ست کن تا options همان خودرو لود شود

// --- Geo helpers: متر⇄درجه، برخورد خط، کریدور دور مسیر، بیضی ---
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
    if (Math.abs(det) < 1e-9) return null;
    const [px, py] = p, [qx, qy] = q;
    const t = ((qx - px) * sy - (qy - py) * sx) / det;
    return [px + t * rx, py + t * ry];
}
function buildRouteBufferPolygon(
    pts: { lat: number; lng: number }[],
    radius_m: number,
    miterLimit = 4
): { lat: number; lng: number }[] {
    if (!pts || pts.length < 2) return [];
    // حذف نقاط صفرطول برای پایداری گوشه‌ها
    const clean = pts.filter((p, i, a) => i === 0 || p.lat !== a[i - 1].lat || p.lng !== a[i - 1].lng);
    const lat0 = clean[0].lat, lng0 = clean[0].lng;
    const P = clean.map(p => toXY(p.lat, p.lng, lat0, lng0));
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
        const a2: [number, number] = [xi + nNext[0] * radius_m, yi + nNext[1] * radius_m];
        let Lp = lineIntersect(a1, uPrev, a2, uNext) || a2;
        if (Math.hypot(Lp[0] - xi, Lp[1] - yi) > miterLimit * radius_m) Lp = a2;
        left.push(Lp);

        const b1: [number, number] = [xi - nPrev[0] * radius_m, yi - nPrev[1] * radius_m];
        const b2: [number, number] = [xi - nNext[0] * radius_m, yi - nNext[1] * radius_m];
        let Rp = lineIntersect(b1, uPrev, b2, uNext) || b2;
        if (Math.hypot(Rp[0] - xi, Rp[1] - yi) > miterLimit * radius_m) Rp = b2;
        right.push(Rp);
    }
    {
        const [x, y] = P[L - 1], [nx, ny] = nor[nor.length - 1];
        left.push([x + nx * radius_m, y + ny * radius_m]);
        right.push([x - nx * radius_m, y - ny * radius_m]);
    }

    const ringXY = [...left, ...right.reverse()];
    const ringLL = ringXY.map(([x, y]) => toLL(x, y, lat0, lng0));
    if (ringLL.length && (ringLL[0].lat !== ringLL.at(-1)!.lat || ringLL[0].lng !== ringLL.at(-1)!.lng)) {
        ringLL.push({ ...ringLL[0] });
    }
    return ringLL;
}
function ellipsePolygonPoints(
    center: { lat: number; lng: number },
    rx_m: number, ry_m: number, rotationDeg = 0, segments = 72
) {
    const R = 6378137, toRad = Math.PI / 180, cosLat = Math.cos(center.lat * toRad), rot = rotationDeg * toRad;
    const pts: { lat: number; lng: number }[] = [];
    for (let i = 0; i < segments; i++) {
        const t = (i / segments) * 2 * Math.PI;
        const x = rx_m * Math.cos(t), y = ry_m * Math.sin(t);
        const xr = x * Math.cos(rot) - y * Math.sin(rot);
        const yr = x * Math.sin(rot) + y * Math.cos(rot);
        const dLat = (yr / R) * (180 / Math.PI);
        const dLng = (xr / (R * cosLat)) * (180 / Math.PI);
        pts.push({ lat: center.lat + dLat, lng: center.lng + dLng });
    }
    pts.push(pts[0]);
    return pts;
}

export default function DefineLinePage() {
    const [tab, setTab] = React.useState<'drivers' | 'vehicles'>('drivers');
    const [q, setQ] = React.useState('');
    const [preset, setPreset] = React.useState<'today' | 'yesterday' | 'custom'>('today');
    const [from, setFrom] = React.useState<any>(null);
    const [to, setTo] = React.useState<any>(null);
    const [gfDrawing, setGfDrawing] = React.useState(false);
    const [addingStation, setAddingStation] = React.useState(false);
    const [drawingRoute, setDrawingRoute] = React.useState(false);
    const [routePoints, setRoutePoints] = React.useState<{ lat: number; lng: number }[]>([]);
    const [routeThreshold, setRouteThreshold] = React.useState<number>(60);
    const mapRef = React.useRef<L.Map | null>(null);
    const [selectedVid, setSelectedVid] = React.useState<number | null>(null);
    const [me, setMe] = React.useState<User | null>(null);
    const [permsLoading, setPermsLoading] = React.useState(false);
    const vehiclesRef = React.useRef<Array<{
        id: number; owner_user_id: number; vehicle_type_code?: string;
    }>>([]);
    const [profiles, setProfiles] = React.useState<SettingsProfile[]>([]);
    const [sidebarOpen, setSidebarOpen] = React.useState(false);
    const openSidebar = () => setSidebarOpen(true);
    const closeSidebar = () => setSidebarOpen(false);
    // دیالوگ کمکی
    const [auxLineOpen, setAuxLineOpen] = React.useState(false);
    // === Multi-waypoint routing (route & trip) ===
    const [multiPicking, setMultiPicking] = React.useState(false);
    const [multiStops, setMultiStops] = React.useState<TmpLatLng[]>([]);
    const [multiBusy, setMultiBusy] = React.useState(false);
    // ترتیب ایستگاه‌ها و حالت مأموریت
    const [dfOrdering, setDfOrdering] = React.useState<'free' | 'sequence'>('free');
    const [dfMission, setDfMission] = React.useState(false);

    // ساخت رشته مختصات "lon,lat;lon,lat;..."
    const toCoordStr = (pts: TmpLatLng[]) =>
        pts.map(p => `${p.lng},${p.lat}`).join(';');

    // مسیر با ترتیب همان نقاط (route service)
    async function fetchOsrmRouteMulti(points: TmpLatLng[]) {
        if (!points || points.length < 2) {
            alert('حداقل دو نقطه لازم است.');
            return;
        }
        setMultiBusy(true);
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${toCoordStr(points)}?overview=full&geometries=geojson&alternatives=false&steps=false`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
            const data = await res.json();
            const coords: [number, number][] = data?.routes?.[0]?.geometry?.coordinates || [];
            if (!coords.length) throw new Error('مسیر معتبری برنگشت.');
            setRoutePoints(coords.map(([lon, lat]) => ({ lat, lng: lon })));
        } catch (e: any) {
            console.error('OSRM multi-route failed', e);
            alert(e?.message || 'خطا در دریافت مسیر چندنقطه‌ای');
        } finally {
            setMultiBusy(false);
            setMultiPicking(false);
        }
    }

    // کوتاه‌ترین مسیر بین همه نقاط (trip service = بهینه‌سازی ترتیب)
    async function fetchOsrmTripOptimized(points: TmpLatLng[], roundtrip = false) {
        if (!points || points.length < 2) {
            alert('حداقل دو نقطه لازم است.');
            return;
        }
        setMultiBusy(true);
        try {
            const params =
                `?roundtrip=${roundtrip ? 'true' : 'false'}&source=first&destination=${roundtrip ? 'any' : 'last'}&overview=full&geometries=geojson`;
            const url = `https://router.project-osrm.org/trip/v1/driving/${toCoordStr(points)}${params}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
            const data = await res.json();

            // مسیر
            const tripCoords: [number, number][] = data?.trips?.[0]?.geometry?.coordinates || [];
            if (!tripCoords.length) throw new Error('Trip معتبر برنگشت.');

            setRoutePoints(tripCoords.map(([lon, lat]) => ({ lat, lng: lon })));

            // اگر خواستی ترتیب بازچینش‌شدهٔ نقاط را هم داشته باشی:
            // const orderedIdx = (data?.waypoints || []).map((w: any) => w.waypoint_index);
            // console.log('بهترین ترتیب نقاط:', orderedIdx);

        } catch (e: any) {
            console.error('OSRM trip failed', e);
            alert(e?.message || 'خطا در محاسبهٔ کوتاه‌ترین مسیر');
        } finally {
            setMultiBusy(false);
            setMultiPicking(false);
        }
    }
    const [roadRoutePicking, setRoadRoutePicking] = React.useState(false); // حالت انتخاب مبدأ/مقصد
    const [roadStart, setRoadStart] = React.useState<TmpLatLng | null>(null);
    const [roadEnd, setRoadEnd] = React.useState<TmpLatLng | null>(null);
    const [routingBusy, setRoutingBusy] = React.useState(false);

    // درخواست به OSRM (driving). توجه: ترتیب lon,lat در URL مهم است!
    async function fetchOsrmRoute(a: TmpLatLng, b: TmpLatLng) {
        const buildUrl = (A: TmpLatLng, B: TmpLatLng) =>
            `https://router.project-osrm.org/route/v1/driving/${A.lng},${A.lat};${B.lng},${B.lat}` +
            `?overview=full&geometries=geojson&alternatives=false&steps=false`;

        setRoutingBusy(true);
        try {
            const res = await fetch(buildUrl(a, b));
            if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
            const data = await res.json();

            const coords: [number, number][] =
                data?.routes?.[0]?.geometry?.coordinates || [];

            if (!coords.length) throw new Error('مسیر معتبری برنگشت.');

            // GeoJSON coords: [lon, lat] → به {lat,lng}
            const pts = coords.map(([lon, lat]) => ({ lat, lng: lon }));

            // نتیجه: ست‌کردن routePoints برای نقشه/ادیتور
            setRoutePoints(pts);
            // اگر می‌خوای کریدور هم بلافاصله آپدیت شود، routeThreshold قبلاً هست.
            // setDrawingRoute(false); // اگر حالت ترسیم دستی فعال بود، خاموشش کن
        } catch (e: any) {
            console.error('OSRM routing failed', e);
            alert(e?.message || 'خطا در دریافت مسیر از OSRM');
        } finally {
            setRoutingBusy(false);
            setRoadRoutePicking(false);
        }
    }
    function RoadRoutePicker({
        enabled,
        onDone,
    }: {
        enabled: boolean;
        onDone: (a: TmpLatLng, b: TmpLatLng) => void;
    }) {
        const [first, setFirst] = React.useState<TmpLatLng | null>(null);

        useMapEvent('click', (e: { latlng: TmpLatLng }) => {
            if (!enabled) return;
            const p = { lat: e.latlng.lat, lng: e.latlng.lng };
            if (!first) {
                setFirst(p);
            } else {
                onDone(first, p);
                setFirst(null);
            }
        });

        return null;
    }

    // کنترل‌های زمان‌بندی خط کمکی
    const [auxStartNow, setAuxStartNow] = React.useState(true);
    const [auxStartAt, setAuxStartAt] = React.useState<any>(null);  // dayjs | null
    const [auxDurationH, setAuxDurationH] = React.useState<number>(24);
    // ✅ دقیقاً مطابق بک‌اند NestJS شما:
    // حتماً همین ثابت‌ها را همانطور که گفتی استفاده می‌کنیم:


    const applyAuxProfileTemporarily = async () => {
        if (!selectedProfile) { alert('لطفاً یک خط را انتخاب کنید.'); return; }
        const vids = Array.from(selectedVehicleIds);
        if (!vids.length) { alert('حداقل یک ماشین را انتخاب کنید.'); return; }

        // زمان‌بندی
        const hours = Number(auxDurationH || 0);
        const durationMs = Math.max(1000, hours * 60 * 60 * 1000);
        const startIso = auxStartNow
            ? new Date().toISOString()
            : (auxStartAt?.toDate?.()
                ? auxStartAt.toDate().toISOString()
                : new Date(auxStartAt as any).toISOString());

        if (!auxStartNow && isNaN(+new Date(startIso))) { alert('زمان شروع نامعتبر است.'); return; }
        const startDelay = Math.max(0, +new Date(startIso) - Date.now());

        // 🔹 NEW: تایم‌هایی که باید برای بک‌اند هم بفرستیم
        const duration_minutes = Math.max(1, Math.round(durationMs / 60000));
        const untilIso = new Date(new Date(startIso).getTime() + durationMs).toISOString();

        // هِلپرها
        const toInt = (v: any, min = 1) => Math.max(min, Math.trunc(Number(v || 0)));
        const isFiniteNum = (v: any) => Number.isFinite(Number(v));

        // ------- Types & Type Guards -------
        type CircleGF = { type: 'circle'; center: { lat: number; lng: number }; radius_m: number; tolerance_m?: number };
        type PolyGF = { type: 'polygon'; points: Array<{ lat: number; lng: number }>; tolerance_m?: number };
        type GF = CircleGF | PolyGF | null;

        const isCircleGF = (g: GF): g is CircleGF => !!g && g.type === 'circle';
        const isPolygonGF = (g: GF): g is PolyGF => !!g && g.type === 'polygon';

        type Snap = {
            stations: Array<{ name?: string; lat: number; lng: number; radius_m: number; order_no?: number }>;
            geofence: GF;
            route: null | { route_id?: number; threshold_m?: number; points?: Array<{ lat: number; lng: number }>; name?: string };
        };

        const readVehicleStations = async (vid: number) => {
            try {
                const { data } = await api.get(`/vehicles/${vid}/stations`, {
                    params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }, validateStatus: s => s < 500
                });
                const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
                return (arr || []).map((s: any) => ({
                    name: String(s?.name ?? ''),
                    lat: Number(s?.lat ?? s?.latitude),
                    lng: Number(s?.lng ?? s?.longitude),
                    radius_m: Math.max(1, Number(s?.radius_m ?? s?.radiusM ?? s?.radius ?? 60)),
                    order_no: isFiniteNum(s?.order_no) ? Number(s.order_no) : undefined,
                })).filter((x: any) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
            } catch { return []; }
        };

        const readVehicleGeofence = async (vid: number): Promise<GF> => {
            try {
                const { data, status } = await api.get(`/vehicles/${vid}/geofence`, { validateStatus: s => s < 500 });
                //if (status >= 400 || data == null) return null;
                const type = String(data?.type ?? data?.geoType ?? '').toLowerCase();
                if (type === 'circle') {
                    const lat = Number(data?.centerLat ?? data?.center_lat ?? data?.center?.lat);
                    const lng = Number(data?.centerLng ?? data?.center_lng ?? data?.center?.lng);
                    const r = Math.max(1, Number(data?.radiusM ?? data?.radius_m ?? data?.radius));
                    const tol = Math.max(0, Number(data?.toleranceM ?? data?.tolerance_m ?? 15));
                    if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(r)) {
                        return { type: 'circle', center: { lat, lng }, radius_m: r, tolerance_m: tol };
                    }
                    return null;
                }
                const ptsRaw = data?.polygonPoints ?? data?.points ?? [];
                const pts = (Array.isArray(ptsRaw) ? ptsRaw : []).map((p: any) => ({
                    lat: Number(p?.lat ?? p?.latitude),
                    lng: Number(p?.lng ?? p?.longitude),
                })).filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
                const tol = Math.max(0, Number(data?.toleranceM ?? data?.tolerance_m ?? 15));
                if (pts.length >= 3) return { type: 'polygon', points: pts, tolerance_m: tol };
                return null;
            } catch { return null; }
        };

        const readVehicleRouteSnap = async (vid: number): Promise<Snap['route']> => {
            try {
                const { data, status } = await api.get(`/vehicles/${vid}/routes/current`, { validateStatus: s => s < 500 });
                if (status >= 400) return null;
                const rid = Number(data?.route_id ?? data?.id ?? data?.route?.id);
                const thr = Number(data?.threshold_m ?? data?.thresholdM ?? 60);
                if (Number.isFinite(rid)) {
                    return { route_id: rid, threshold_m: toInt(thr) };
                }
                return null;
            } catch { return null; }
        };

        const snapshotVehicle = async (vid: number): Promise<Snap> => {
            const [stations, geofence, route] = await Promise.all([
                readVehicleStations(vid),
                readVehicleGeofence(vid),
                readVehicleRouteSnap(vid),
            ]);
            return { stations, geofence, route };
        };

        const clearVehicle = async (vid: number) => {
            console.log(`[VID: ${vid}] Starting AGGRESSIVE CLEAR process...`);

            // --- پاک کردن مسیر و ایستگاه‌ها (بدون تغییر) ---
            await api.delete(`/vehicles/${vid}/routes/current`, { validateStatus: s => s < 500 }).catch(() => { /* ignore */ });
            try {
                const { data } = await api.get(`/vehicles/${vid}/stations`, { params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' } });
                const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
                for (const s of list) {
                    if (s?.id) {
                        await api.delete(`/vehicles/${vid}/stations/${s.id}`, { validateStatus: s => s < 500 }).catch(() => { /* ignore */ });
                    }
                }
            } catch (e) { /* ignore */ }
            console.log(`[VID: ${vid}] Route and stations cleared.`);

            // --- پاک‌سازی قدرتمند و با سماجت ژئوفنس ---
            let isGeofenceCleared = false;
            const maxTries = 4; // تا ۴ بار تلاش می‌کند

            for (let i = 1; i <= maxTries; i++) {
                console.log(`[VID: ${vid}] Geofence clear attempt #${i}...`);

                // مرحله ۱: ارسال دستور DELETE
                try {
                    await api.delete(`/vehicles/${vid}/geofence`, { validateStatus: s => s < 500 });
                    console.log(`[VID: ${vid}] Attempt #${i}: DELETE command sent.`);
                } catch (e) {
                    console.error(`[VID: ${vid}] Attempt #${i}: DELETE command failed`, e);
                }

                // مرحله ۲: کمی صبر می‌کنیم تا سرور پردازش کند (بسیار مهم)
                await new Promise(resolve => setTimeout(resolve, 300)); // ۳۰۰ میلی‌ثانیه صبر

                // مرحله ۳: با GET بررسی می‌کنیم که آیا واقعا پاک شده؟ این تنها حقیقت است.
                let currentGeofence = null;
                try {
                    currentGeofence = await readVehicleGeofence(vid); // از تابع کمکی شما استفاده می‌کند
                } catch (e) {
                    console.error(`[VID: ${vid}] Attempt #${i}: Error while reading geofence after delete. Assuming it's cleared.`, e);
                    isGeofenceCleared = true;
                    break;
                }

                console.log(`[VID: ${vid}] Attempt #${i}: Verification GET returned:`, currentGeofence);

                if (currentGeofence === null) {
                    console.log(`%c[VID: ${vid}] SUCCESS: Geofence confirmed cleared on attempt #${i}.`, 'color: green; font-weight: bold;');
                    isGeofenceCleared = true;
                    break; // اگر موفق بود، از حلقه خارج شو
                } else {
                    console.warn(`[VID: ${vid}] WARN: Geofence still exists after attempt #${i}. Retrying...`);
                }
            }

            // اگر بعد از تمام تلاش‌ها هنوز پاک نشده بود، کل عملیات را متوقف کن
            if (!isGeofenceCleared) {
                console.error(`[VID: ${vid}] CRITICAL FAILURE: Geofence could NOT be cleared after ${maxTries} attempts.`);
                // این خطا باعث می‌شود که کل فرآیند متوقف شود و وارد catch در runStart شود
                throw new Error(`خطای قطعی: ژئوفنس خودروی ${vid} پس از چندین تلاش پاک نشد. عملیات لغو شد.`);
            }
        };

        const applyProfileToVehicle = async (vid: number, prof: SettingsProfile) => {
            const { stations = [], geofence = null, route = null } = prof.settings || {};

            // A) مسیر
            if (route) {
                const thr = toInt((route as any)?.threshold_m ?? 60);
                if (isFiniteNum((route as any)?.id)) {
                    await api.put(`/vehicles/${vid}/routes/current`, { route_id: Number((route as any).id), threshold_m: thr }, { validateStatus: s => s < 500 }).catch(() => { });
                } else if (Array.isArray((route as any).points) && (route as any).points.length >= 2) {
                    const createPayload = {
                        name: (route as any).name || prof.name || `Route ${new Date().toISOString().slice(0, 10)}`,
                        threshold_m: thr,
                        points: (route as any).points.map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng) })),
                    };
                    const { data: created } = await api.post(`/vehicles/${vid}/routes`, createPayload, { validateStatus: s => s < 500 });
                    const newRid = Number(created?.route_id ?? created?.id ?? created?.route?.id);
                    if (Number.isFinite(newRid)) {
                        await api.put(`/vehicles/${vid}/routes/current`, { route_id: newRid, threshold_m: thr }, { validateStatus: s => s < 500 }).catch(() => { });
                    }
                }
            }

            // B) ایستگاه‌ها
            if (Array.isArray(stations) && stations.length) {
                for (const st of stations) {
                    const lat = Number(st?.lat), lng = Number(st?.lng);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
                    await api.post(`/vehicles/${vid}/stations`, {
                        name: (st?.name || '').trim() || 'ایستگاه',
                        lat, lng,
                        radius_m: toInt(st?.radius_m ?? 60),
                        ...(isFiniteNum(st?.order_no) ? { order_no: Number(st!.order_no) } : {}),
                    }, { validateStatus: s => s < 500 }).catch(() => { });
                }
            }

            // C) ژئوفنس (با نگه‌داشتن در متغیر محلی برای حفظ narrowing)
            const g: GF = geofence;
            if (isCircleGF(g)) {
                await api.put(`/vehicles/${vid}/geofence`, {
                    type: 'circle',
                    centerLat: g.center.lat,
                    centerLng: g.center.lng,
                    radiusM: toInt(g.radius_m, 1),
                    toleranceM: Math.max(0, Math.trunc(Number(g.tolerance_m ?? 15))),
                }, { validateStatus: s => s < 500 })
                    .catch(() => api.post(`/vehicles/${vid}/geofence`, {
                        type: 'circle',
                        centerLat: g.center.lat,
                        centerLng: g.center.lng,
                        radiusM: toInt(g.radius_m, 1),
                        toleranceM: Math.max(0, Math.trunc(Number(g.tolerance_m ?? 15))),
                    }, { validateStatus: s => s < 500 }).catch(() => { }));
            } else if (isPolygonGF(g) && Array.isArray(g.points) && g.points.length >= 3) {
                await api.put(`/vehicles/${vid}/geofence`, {
                    type: 'polygon',
                    polygonPoints: g.points.map(pt => ({ lat: Number(pt.lat), lng: Number(pt.lng) })),
                    toleranceM: Math.max(0, Math.trunc(Number(g.tolerance_m ?? 15))),
                }, { validateStatus: s => s < 500 })
                    .catch(() => api.post(`/vehicles/${vid}/geofence`, {
                        type: 'polygon',
                        polygonPoints: g.points.map(pt => ({ lat: Number(pt.lat), lng: Number(pt.lng) })),
                        toleranceM: Math.max(0, Math.trunc(Number(g.tolerance_m ?? 15))),
                    }, { validateStatus: s => s < 500 }).catch(() => { }));
            }
        };

        const restoreSnapshotToVehicle = async (vid: number, snap: Snap) => {
            // پارکسازی/دلیت قبل از ری‌استور
            await clearVehicle(vid);

            // مسیر
            const r = snap.route;
            if (r) {
                if (isFiniteNum(r.route_id)) {
                    await api.put(`/vehicles/${vid}/routes/current`, {
                        route_id: Number(r.route_id),
                        ...(isFiniteNum(r.threshold_m) ? { threshold_m: toInt(r.threshold_m as number) } : {}),
                    }, { validateStatus: s => s < 500 }).catch(() => { });
                } else if (Array.isArray(r.points) && r.points.length >= 2) {
                    const { data: created } = await api.post(`/vehicles/${vid}/routes`, {
                        name: r.name || `Route Restore ${new Date().toISOString().slice(0, 10)}`,
                        threshold_m: toInt(r.threshold_m ?? 60),
                        points: r.points.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) })),
                    }, { validateStatus: s => s < 500 });
                    const newRid = Number(created?.route_id ?? created?.id ?? created?.route?.id);
                    if (Number.isFinite(newRid)) {
                        await api.put(`/vehicles/${vid}/routes/current`, { route_id: newRid, threshold_m: toInt(r.threshold_m ?? 60) }, { validateStatus: s => s < 500 }).catch(() => { });
                    }
                }
            }

            // ایستگاه‌ها
            for (const st of (snap.stations || [])) {
                await api.post(`/vehicles/${vid}/stations`, {
                    name: (st?.name || '').trim() || 'ایستگاه',
                    lat: Number(st.lat), lng: Number(st.lng),
                    radius_m: toInt(st.radius_m ?? 60),
                    ...(isFiniteNum(st?.order_no) ? { order_no: Number(st.order_no) } : {}),
                }, { validateStatus: s => s < 500 }).catch(() => { });
            }

            // ژئوفنس (fix کاملِ possibly null)
            const g: GF = snap.geofence;
            if (isCircleGF(g)) {
                await api.put(`/vehicles/${vid}/geofence`, {
                    type: 'circle',
                    centerLat: g.center.lat,
                    centerLng: g.center.lng,
                    radiusM: toInt(g.radius_m, 1),
                    toleranceM: Math.max(0, Math.trunc(Number(g.tolerance_m ?? 15))),
                }, { validateStatus: s => s < 500 })
                    .catch(() => api.post(`/vehicles/${vid}/geofence`, {
                        type: 'circle',
                        centerLat: g.center.lat,
                        centerLng: g.center.lng,
                        radiusM: toInt(g.radius_m, 1),
                        toleranceM: Math.max(0, Math.trunc(Number(g.tolerance_m ?? 15))),
                    }, { validateStatus: s => s < 500 }).catch(() => { }));
            } else if (isPolygonGF(g)) {
                await api.put(`/vehicles/${vid}/geofence`, {
                    type: 'polygon',
                    polygonPoints: g.points.map(pt => ({ lat: Number(pt.lat), lng: Number(pt.lng) })),
                    toleranceM: Math.max(0, Math.trunc(Number(g.tolerance_m ?? 15))),
                }, { validateStatus: s => s < 500 })
                    .catch(() => api.post(`/vehicles/${vid}/geofence`, {
                        type: 'polygon',
                        polygonPoints: g.points.map(pt => ({ lat: Number(pt.lat), lng: Number(pt.lng) })),
                        toleranceM: Math.max(0, Math.trunc(Number(g.tolerance_m ?? 15))),
                    }, { validateStatus: s => s < 500 }).catch(() => { }));
            }
        };

        // کار اصلی که در زمان شروع اجرا می‌شود:
        const runStart = async () => {
            setApplyBusy(true);
            try {
                // 1) اسنپ‌شات همه
                const snapshots: Record<number, Snap> = {};
                for (const vid of vids) {
                    snapshots[vid] = await snapshotVehicle(vid);
                }

                // 2) پارکسازی/دلیت فعلی
                for (const vid of vids) {
                    await clearVehicle(vid);

                }
                console.log("--- CHECKING STATUS AFTER CLEARANCE ---");
                for (const vid of vids) {
                    const currentGeofence = await readVehicleGeofence(vid);
                    console.log(`[VID: ${vid}] Geofence status after clear is:`, currentGeofence);
                    if (currentGeofence) {
                        console.error(`!!! CRITICAL FAILURE: Vehicle ${vid} STILL HAS a geofence.`, currentGeofence);
                        alert(`خطای بحرانی: ژئوفنس خودروی ${vid} پاک نشده است!`);
                        setApplyBusy(false); // متوقف کردن عملیات
                        return; // خروج از تابع
                    }
                }
                console.log("--- CLEARANCE CONFIRMED. PROCEEDING TO APPLY NEW PROFILE. ---");

                // 3) اعمال خط کمکی
                for (const vid of vids) {
                    await applyProfileToVehicle(vid, selectedProfile);
                }

                // 🔹 NEW: زمان‌بندی را به بک‌اند هم اعلام کن
                try {
                    await api.post('/temporary-assignments', {
                        vehicle_ids: vids,
                        temp_profile: {
                            id: selectedProfile.id,
                            name: selectedProfile.name,
                            settings: {
                                ...selectedProfile.settings,
                                station_ordering: selectedProfile.settings?.station_ordering ?? 'free',
                                mission_mode: Boolean(selectedProfile.settings?.mission_mode),
                            },
                        },
                        start_at: startIso,
                        duration_minutes,
                        until: untilIso,
                    }, { validateStatus: s => s < 500 });
                } catch { /* اختیاری: لاگ خطای سمت سرور */ }

                // 4) ذخیره اسنپ‌شات در localStorage تا ری‌استور بعدی
                const restoreKey = `aux-restore-${Date.now()}`;
                const until = Date.now() + durationMs;
                localStorage.setItem(restoreKey, JSON.stringify({ vids, snapshots, until }));

                // 5) زمان‌بندی ری‌استور (فرانت‌اندی)
                window.setTimeout(async () => {
                    try {
                        const raw = localStorage.getItem(restoreKey);
                        if (!raw) return;
                        const payload = JSON.parse(raw);
                        for (const vid of (payload.vids || [])) {
                            const snap: Snap | undefined = payload.snapshots?.[vid];
                            if (snap) {
                                await restoreSnapshotToVehicle(vid, snap);
                            }
                        }
                    } finally {
                        localStorage.removeItem(restoreKey);
                    }
                }, durationMs);

                alert('خط کمکی اعمال شد. پس از اتمام مدت، حالت قبلی بازگردانی می‌شود.');
                setSelectedVehicleIds(new Set());
                setSelectedProfileId(null);
                setAuxLineOpen(false);
            } catch (e: any) {
                console.error('aux apply failed', e?.response?.data || e);
                alert(e?.response?.data?.message || 'خطا در اعمال خط کمکی');
            } finally {
                setApplyBusy(false);
            }
        };

        if (startDelay === 0) {
            runStart();
        } else {
            // زمان‌بندی شروع در آینده
            window.setTimeout(runStart, startDelay);
            alert('برنامه‌ریزی شد تا در زمان تعیین‌شده اعمال شود.');
            setAuxLineOpen(false);
        }
    };



    // --- Remaining vehicles state ---
    const [vehTab, setVehTab] = React.useState<string>('all'); // دارید، بماند
    const [remLoading, setRemLoading] = React.useState(false);
    const [remainingVehicleIds, setRemainingVehicleIds] = React.useState<Set<number>>(new Set());
    const [vehicleStatusMap, setVehicleStatusMap] = React.useState<Record<number, { hasRoute: boolean; hasGeofence: boolean; stationCount: number }>>({});

    // GET helpers to detect assignments (تحمل 404/204)
    const hasCurrentRoute = async (vid: number) => {
        try {
            // اگر بک‌اند GET ندارد، هنوز هم اکثر سرویس‌ها همین endpoint را دارند
            const { data, status } = await api.get(`/vehicles/${vid}/routes/current`, { validateStatus: s => s < 500 });
            if (status >= 400) return false;
            // هر کدام از این فیلدها کافی‌ست نشان دهد Route ست است
            return Boolean(data?.route_id ?? data?.id ?? data?.route?.id);
        } catch { return false; }
    };

    const hasAnyGeofence = async (vid: number) => {
        try {
            const { data, status } = await api.get(`/vehicles/${vid}/geofence`, { validateStatus: s => s < 500 });
            if (status >= 400 || data == null) return false;
            const type = String(data?.type ?? data?.geoType ?? '').toLowerCase();
            if (type === 'circle') {
                const lat = Number(data?.centerLat ?? data?.center_lat ?? data?.center?.lat);
                const lng = Number(data?.centerLng ?? data?.center_lng ?? data?.center?.lng);
                const r = Number(data?.radiusM ?? data?.radius_m ?? data?.radius);
                return Number.isFinite(lat) && Number.isFinite(lng) && r > 0;
            }
            const ptsRaw = data?.polygonPoints ?? data?.points ?? [];
            const pts = (Array.isArray(ptsRaw) ? ptsRaw : []).filter((p: any) =>
                Number.isFinite(Number(p?.lat ?? p?.latitude)) && Number.isFinite(Number(p?.lng ?? p?.longitude))
            );
            return pts.length >= 3;
        } catch { return false; }
    };

    const countStations = async (vid: number) => {
        try {
            const { data, status } = await api.get(`/vehicles/${vid}/stations`, {
                params: { _: Date.now() }, headers: { 'Cache-Control': 'no-store' }, validateStatus: s => s < 500
            });
            if (status >= 400) return 0;
            const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
            return Array.isArray(arr) ? arr.length : 0;
        } catch { return 0; }
    };

    // محاسبه‌ی «باقی‌مانده» با محدودیت کانکارنسی برای فشار نیاوردن به سرور
    const computeRemainingVehicles = async () => {
        const all = vehiclesRef.current || [];
        if (!all.length) {
            setRemainingVehicleIds(new Set());
            setVehicleStatusMap({});
            return;
        }

        setRemLoading(true);
        try {
            const statusMap: Record<number, { hasRoute: boolean; hasGeofence: boolean; stationCount: number }> = {};
            const ids = all.map(v => v.id);
            const concurrency = 6; // همزمانی ملایم
            for (let i = 0; i < ids.length; i += concurrency) {
                const batch = ids.slice(i, i + concurrency);
                const results = await Promise.all(batch.map(async (vid) => {
                    const [r, g, sc] = await Promise.all([
                        hasCurrentRoute(vid),
                        hasAnyGeofence(vid),
                        countStations(vid),
                    ]);
                    statusMap[vid] = { hasRoute: r, hasGeofence: g, stationCount: sc };
                    return { vid, r, g, sc };
                }));
                // می‌تونی این‌جا هم به‌روز کنی که UI فوری‌تر واکنش بده
                setVehicleStatusMap(prev => ({ ...prev, ...statusMap }));
            }
            const remaining = new Set<number>(ids.filter(id => {
                const s = statusMap[id];
                return s && !s.hasRoute && !s.hasGeofence && s.stationCount === 0;
            }));
            setRemainingVehicleIds(remaining);
            setVehicleStatusMap(statusMap);
        } finally {
            setRemLoading(false);
        }
    };

    const vehicleTypeLabel = React.useCallback((t?: string) => {
        const k = String(t || '').toLowerCase();
        const map: Record<string, string> = {
            bus: 'اتوبوس',
            khavar: 'خاور',
            minibus: 'مینی‌بوس',
            van: 'ون',
            tanker: 'تانکر',
            pickup: 'سواری',
            truck: 'کامیون',
            sedan: 'سواری',
        };
        return map[k] || (k ? k : 'نامشخص');
    }, []);
    const [vehiclesLineOpen, setVehiclesLineOpen] = React.useState(false);
    const loadVehiclesForSA = useCallback(async (saId: number) => {
        try {
            const { data } = await api
                .get('/vehicles', { params: { owner_user_id: saId, limit: 1000 } })
                .catch(() => ({ data: { items: [] } }));

            const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
            const list: Vehicle[] = (items || []).map((v: any) => ({
                id: Number(v?.id),
                owner_user_id: Number(v?.owner_user_id ?? v?.ownerUserId),
                vehicle_type_code: v?.vehicle_type_code ?? v?.vehicleTypeCode,
                ...v,
            })).filter((v: { id: unknown; }) => Number.isFinite(v.id));

            vehiclesRef.current = list;
            // اختیاری: برای دیباگ
            // console.debug('[vehiclesRef] loaded', { saId, count: list.length });
        } catch (e) {
            // console.error('[vehiclesRef] load error', e);
            vehiclesRef.current = [];
        }
    }, []);
    const [ownMonitorParams, setOwnMonitorParams] = React.useState<string[]>([]);
    const getVehicleOptions = React.useCallback(async (vid: number): Promise<MonitorKey[]> => {
        const v = vehiclesRef.current.find(x => x.id === vid);
        // اگر MONITOR_PARAMS اینجا در دسترسه، می‌تونی validate کنی:
        // const valid = new Set<MonitorKey>(MONITOR_PARAMS.map(m => m.key as MonitorKey));
        let raw: string[] = [];

        try {
            const { data } = await api.get(`/vehicles/${vid}/options`);
            raw = Array.isArray(data?.options) ? data.options : [];
        } catch {
            // فالبک: از پالیسی‌های مالک همین خودرو بخوان
            try {
                let ownerId = v?.owner_user_id;
                let vtCode = v?.vehicle_type_code;

                // اگر vehiclesRef پر نبود، یک بار خودرو را بگیر تا owner_user_id را داشته باشیم
                if (!ownerId || !vtCode) {
                    const { data: vehicle } = await api.get(`/vehicles/${vid}`).catch(() => ({ data: null }));
                    ownerId = Number(vehicle?.owner_user_id ?? vehicle?.ownerUserId);
                    vtCode = vehicle?.vehicle_type_code ?? vehicle?.vehicleTypeCode;
                }

                if (ownerId) {
                    const { data: policies } = await api
                        .get(`/vehicle-policies/user/${ownerId}`, { params: { onlyAllowed: true } })
                        .catch(() => ({ data: [] }));
                    const pol = (policies || []).find((p: any) =>
                        (p?.vehicle_type_code ?? p?.vehicleTypeCode) === vtCode
                    );
                    raw = Array.isArray(pol?.monitor_params ?? pol?.monitorParams)
                        ? (pol.monitor_params ?? pol.monitorParams) : [];
                }
            } catch { /* ignore */ }
        }

        const opts = Array.from(new Set(raw.map(s => s?.toString().trim().toLowerCase())))
            // اگر validate می‌خوای فعال باشه، این خط رو باز کن:
            // .filter((k): k is MonitorKey => valid.has(k as MonitorKey))
            ;

        return opts as MonitorKey[];
    }, []);
    // هر بار دیالوگ باز شد و تبِ remaining بود، یا وقتی کاربر به remaining سویچ کرد، محاسبه کن
    React.useEffect(() => {
        if (!vehiclesLineOpen) return;
        if (vehTab !== 'remaining') return;
        // اگر قبلاً محاسبه نشده یا لیست وسایل تغییر کرده، دوباره بساز
        // ساده: هر بار remaining شد محاسبه کن
        computeRemainingVehicles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vehiclesLineOpen, vehTab]);


    const resolveParentSA = React.useCallback(async (uid: number) => {
        try {
            const { data: rows } = await api.get(`/vehicle-policies/user/${uid}`, { params: { onlyAllowed: true } });
            const idSet = new Set<number>();
            (rows || []).forEach((r: any) => {
                [r.owner_user_id, r.ownerId, r.super_admin_user_id, r.superAdminUserId, r.grantor_user_id, r.grantorUserId]
                    .map((x: any) => Number(x)).filter(Boolean).forEach((n: number) => idSet.add(n));
            });
            for (const oid of idSet) {
                const { data: test } = await api.get('/vehicles', { params: { owner_user_id: String(oid), limit: 1 } }).catch(() => ({ data: { items: [] } }));
                const items = Array.isArray(test?.items) ? test.items : (Array.isArray(test) ? test : []);
                if (items.length) return { id: oid };
            }
        } catch { }
        try {
            const { data } = await api.get('/users/my-ancestor', { params: { level: 2 } });
            if (data?.id) return { id: Number(data.id) };
        } catch { }
        return null;
    }, []);
    // 🔹 وقتی me آماده شد، لیست ماشین‌های SA هدف را بارگذاری کن (بدون هیچ UI)
    useEffect(() => {
        let alive = true;
        (async () => {
            if (!me?.id) return;

            // مدیرکل (۱): همه را می‌بیند
            if (me.role_level === 1) {
                try {
                    const { data } = await api.get('/vehicles', { params: { limit: 1000 } });
                    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
                    vehiclesRef.current = (items || []).map((v: any) => ({
                        id: Number(v?.id),
                        owner_user_id: Number(v?.owner_user_id ?? v?.ownerUserId),
                        vehicle_type_code: v?.vehicle_type_code ?? v?.vehicleTypeCode,
                        ...v,
                    })).filter((v: any) => Number.isFinite(v.id));
                } catch {
                    vehiclesRef.current = [];
                }
                return;
            }

            // سوپر ادمین (۲): فقط ماشین‌های متعلق به خودش
            if (me.role_level === 2) {
                await loadVehiclesForSA(me.id);
                return;
            }

            // نقش‌های ۳..۵: فقط ماشین‌هایی که خودش مسئولشونه
            if (me.role_level >= 3 && me.role_level <= 5) {
                try {
                    const { data } = await api.get('/vehicles/responsible/my', { params: { limit: 1000 } });
                    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
                    vehiclesRef.current = (items || []).map((v: any) => ({
                        id: Number(v?.id),
                        owner_user_id: Number(v?.owner_user_id ?? v?.ownerUserId),
                        vehicle_type_code: v?.vehicle_type_code ?? v?.vehicleTypeCode,
                        ...v,
                    })).filter((v: any) => Number.isFinite(v.id));
                } catch {
                    vehiclesRef.current = [];
                }
                return;
            }

            // سایر نقش‌ها: چیزی لود نکن
            vehiclesRef.current = [];
        })();

        return () => { alive = false; };
    }, [me?.id, me?.role_level, loadVehiclesForSA]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                // اگر خودرو انتخاب شده: گزینه‌های همون خودرو
                if (selectedVid) {
                    const { data } = await api.get(`/vehicles/${selectedVid}/options`).catch(() => ({ data: {} }));
                    const raw: string[] = Array.isArray(data?.options) ? data.options : [];
                    if (!alive) return;
                    setOwnMonitorParams(Array.from(new Set(raw.map(x => String(x).toLowerCase().trim()))));
                    return;
                }

                // در غیر این‌صورت، پالیسی‌های خود کاربر (با فیلتر والد SA برای نقش‌های ۳..۵)
                const { data: me } = await api.get('/auth/me');
                let rows: any[] = [];
                try {
                    const { data } = await api.get(`/vehicle-policies/user/${me.id}`, { params: { onlyAllowed: true } });
                    rows = Array.isArray(data) ? data : [];
                } catch { }
                if (me.role_level >= 3 && me.role_level <= 5) {
                    const parent = await resolveParentSA(me.id);
                    if (parent?.id) {
                        const same = (v: any) => Number(v) === Number(parent.id);
                        rows = rows.filter(r =>
                            same(r.owner_user_id) || same(r.ownerId) ||
                            same(r.super_admin_user_id) || same(r.superAdminUserId) ||
                            same(r.grantor_user_id) || same(r.grantorUserId)
                        );
                    } else {
                        rows = [];
                    }
                }
                const uni = new Set<string>();
                rows.forEach((r: any) => (Array.isArray(r?.monitor_params) ? r.monitor_params : []).forEach((k: any) => uni.add(String(k).toLowerCase())));
                if (!alive) return;
                setOwnMonitorParams(Array.from(uni));
            } catch {
                if (!alive) return;
                setOwnMonitorParams([]);
            }
        })();
        return () => { alive = false; };
    }, [selectedVid, resolveParentSA]);
    // لود کاربر فعلی
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const { data } = await api.get('/auth/me');
                if (!alive) return;
                setMe({ id: Number(data?.id), role_level: Number(data?.role_level ?? data?.roleLevel ?? 0), full_name: data?.full_name ?? data?.name });
            } catch {
                setMe(null);
            }
        })();
        return () => { alive = false; };
    }, []);
    // === انتخاب خط و ماشین‌ها ===
    const [selectedProfileId, setSelectedProfileId] = React.useState<number | null>(null);
    const selectedProfile = React.useMemo(
        () => profiles.find(p => p.id === selectedProfileId) ?? null,
        [profiles, selectedProfileId]
    );

    // مجموعهٔ ماشین‌های انتخاب‌شده
    const [selectedVehicleIds, setSelectedVehicleIds] = React.useState<Set<number>>(new Set());

    // تغییر انتخاب یک ماشین
    const toggleVehicle = (id: number) => {
        setSelectedVehicleIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    React.useEffect(() => {
        if (vehiclesLineOpen && vehTab === 'remaining') computeRemainingVehicles();
    }, [selectedProfileId, vehiclesLineOpen, vehTab]);

    // انتخاب/لغو انتخاب همهٔ ماشین‌های لیستِ فیلترشده
    const toggleSelectAll = (list: Array<{ id: number }>, force?: boolean) => {
        setSelectedVehicleIds(prev => {
            const next = new Set(prev);
            const ids = list.map(v => v.id);
            const shouldSelect = typeof force === 'boolean' ? force : ids.some(id => !next.has(id));
            if (shouldSelect) ids.forEach(id => next.add(id));
            else ids.forEach(id => next.delete(id));
            return next;
        });
    };

    // خواندن پرمیشن‌ها بر اساس نقش
    useEffect(() => {
        if (!me?.id) return;
        let alive = true;

        (async () => {
            setPermsLoading(true);
            try {
                // ➊ اگر خودرو انتخاب شده: از /vehicles/:vid/options بخوان
                if (selectedVid) {
                    const opts = await getVehicleOptions(selectedVid);
                    if (!alive) return;
                    setOwnMonitorParams(opts as string[]);
                    return;
                }

                // ➋ در غیر این صورت: مثل قبل از پالیسی‌های کاربر (با فیلتر SA والد برای نقش‌های ۳..۵)
                const { data } = await api.get(`/vehicle-policies/user/${me.id}`, { params: { onlyAllowed: true } });
                const allRows: any[] = Array.isArray(data) ? data : [];
                let rows = allRows;

                if (me.role_level >= 3 && me.role_level <= 5) {
                    const parentSA = await resolveParentSA(me.id);
                    if (parentSA?.id) {
                        const sameId = (v: any) => Number(v) === Number(parentSA.id);
                        rows = allRows.filter(r =>
                            sameId(r.owner_user_id) || sameId(r.ownerId) ||
                            sameId(r.super_admin_user_id) || sameId(r.superAdminUserId) ||
                            sameId(r.grantor_user_id) || sameId(r.grantorUserId)
                        );
                    } else {
                        rows = [];
                    }
                }

                const union = new Set<string>();
                rows.forEach((r: any) => {
                    const arr: any[] = Array.isArray(r?.monitor_params ?? r?.monitorParams)
                        ? (r.monitor_params ?? r.monitorParams) : [];
                    arr.forEach(k => union.add(String(k).toLowerCase()));
                });

                if (!alive) return;
                setOwnMonitorParams(Array.from(union));
            } catch {
                if (!alive) return;
                setOwnMonitorParams([]);
            } finally {
                if (alive) setPermsLoading(false);
            }
        })();

        return () => { alive = false; };
    }, [me?.id, me?.role_level, selectedVid, getVehicleOptions, resolveParentSA]);

    // نرمال‌کننده: کلیدها را یکدست می‌کند
    const normalizeKey = (s: string) => String(s || '').toLowerCase().replace(/[-_\s]/g, '');

    // هلپر عمومی برای چک‌کردن مجوز یک فیچر
    const has = React.useCallback((key: string) => {
        const k = normalizeKey(key);
        return ownMonitorParams.map(normalizeKey).includes(k);
    }, [ownMonitorParams]);

    // === سناریوی خواسته‌شده: تصمیم بر اساس نقش
    const isSA = me?.role_level === 2;            // سوپرادمین
    const isManager = me && me.role_level >= 3 && me.role_level <= 5; // نقش‌های ۳ تا ۵

    // مثال از پرمیشن‌های مرتبط با تعریف خط/ژئوفنس (فعلاً فقط می‌خوانیم)
    const canRoute = React.useMemo(() => has('routes') || has('route') || has('line_define'), [has]);
    const canGeofence = React.useMemo(() => has('geo_fence') || has('geofence'), [has]);
    const canStation = React.useMemo(() => has('stations'), [has]);

    // برای شفافیت، منبع تصمیم را هم آماده کنیم:
    const permissionSourceLabel = useMemo(() => {
        if (!me) return '—';
        if (isSA) return 'پرمیشن‌های خود سوپرادمین (user policies)';
        if (isManager) return 'پرمیشن‌های اعطاشده توسط سوپرادمین (user policies)';
        return 'پرمیشن‌های کاربر';
    }, [isSA, isManager, me]);


    const previewProfileOnMainMap = (p: SettingsProfile) => {
        // 1) state‌ها را از روی پروفایل پر کن
        setDfStations(p.settings?.stations || []);
        setDfOrdering(p.settings?.station_ordering === 'sequence' ? 'sequence' : 'free');
        setDfMission(Boolean(p.settings?.mission_mode));

        const gf = p.settings?.geofence;
        const rt = p.settings?.route;
        if (gf) {
            if (gf.type === 'circle') {
                setDfGfMode('circle');
                setDfGfCircle({
                    center: gf.center,
                    radius_m: Math.max(1, gf.radius_m),
                    tolerance_m: Math.max(0, gf.tolerance_m ?? 15),
                });
                setDfGfPoly([]);
            } else {
                setDfGfMode('polygon');
                setDfGfPoly(gf.points || []);
                setDfGfCircle(c => ({ ...c, center: undefined, tolerance_m: Math.max(0, gf.tolerance_m ?? 15) }));
            }
        } else {
            // اگر ژئوفنس نداشت، پاکسازی
            setDfGfMode('circle');
            setDfGfCircle({ center: undefined, radius_m: 150, tolerance_m: 15 });
            setDfGfPoly([]);
        }
        setRoutePoints(rt?.points || []);
        setRouteThreshold(Math.max(1, Number(rt?.threshold_m ?? 60)));
        // 2) fitBounds روی کل اجزاء
        if (!mapRef.current) return;

        const bounds = L.latLngBounds([]);

        // ایستگاه‌ها
        (p.settings?.stations || []).forEach(s => bounds.extend([s.lat, s.lng]));

        // ژئوفنس
        if (gf) {
            if (gf.type === 'circle') {
                const cb = L.circle([gf.center.lat, gf.center.lng], { radius: Math.max(1, gf.radius_m) }).getBounds();
                bounds.extend(cb);
            } else {
                gf.points.forEach(pt => bounds.extend([pt.lat, pt.lng]));
            }
        }
        (rt?.points || []).forEach(pt => bounds.extend([pt.lat, pt.lng]));

        if (bounds.isValid()) mapRef.current.fitBounds(bounds.pad(0.2));
    };
    const routePayload = React.useMemo(() => ({
        name: `مسیر ${new Date().toLocaleDateString('fa-IR')}`,
        threshold_m: Math.max(1, Math.trunc(routeThreshold)),
        points: routePoints.map(p => ({ lat: +p.lat, lng: +p.lng })),
    }), [routePoints, routeThreshold]);
    const [renameOpen, setRenameOpen] = React.useState(false);
    const [renameId, setRenameId] = React.useState<number | null>(null);
    const [renameValue, setRenameValue] = React.useState('');
    const openRenameDialog = (p: SettingsProfile) => {
        setRenameId(p.id);
        setRenameValue(p.name || '');
        setRenameOpen(true);
    };
    const handleSaveNameOnly = async () => {
        const newName = (profileName || '').trim();
        if (!newName) { alert('نام معتبر وارد کنید.'); return; }

        try {
            if (editingProfileId) {
                // صرفاً تغییر نام روی همین پروفایلِ در حال ویرایش
                await api.put(`/vehicle-setting-profiles/${editingProfileId}`, { name: newName });
                await loadProfiles();
                alert('نام پروفایل ثبت شد.');
            } else {
                // هنوز پروفایلی ساخته نشده؛ نام رو در state نگه می‌داریم
                // و موقع «ذخیره پروفایل جدید» همراه تنظیمات ساخته می‌شود.
                alert('نام ذخیره شد. برای ساخت پروفایل جدید، «ذخیره پروفایل جدید» را بزنید.');
            }
        } catch (e: any) {
            console.error('save name failed', e?.response?.data || e);
            alert('خطا در ثبت نام پروفایل');
        }
    };

    const handleConfirmRename = async () => {
        if (!renameId) return;
        const newName = renameValue.trim();
        if (!newName) { alert('نام معتبر وارد کنید.'); return; }

        try {
            // فقط تغییر نام؛ اگر بخواهی با تنظیمات هم ذخیره کنی از همان handleSaveProfile استفاده کن
            await api.put(`/vehicle-setting-profiles/${renameId}`, { name: newName });
            await loadProfiles();
            setRenameOpen(false);
        } catch (e: any) {
            console.error('rename failed', e?.response?.data || e);
            alert('خطا در تغییر نام پروفایل');
        }
    };

    const corridorPolygon = React.useMemo(() =>
        buildRouteBufferPolygon(routePoints, Math.max(1, routeThreshold)),
        [routePoints, routeThreshold]);

    function GfClickCatcher({
        enabled,
        mode,
        setCircleCenter,
        pushPolyPoint,
    }: {
        enabled: boolean;
        mode: 'circle' | 'polygon';
        setCircleCenter: (lat: number, lng: number) => void;
        pushPolyPoint: (lat: number, lng: number) => void;
    }) {
        useMapEvent('click', (e: { latlng: { lat: any; lng: any; }; }) => {
            if (!enabled) return;
            const { lat, lng } = e.latlng;
            if (mode === 'circle') setCircleCenter(lat, lng);
            else pushPolyPoint(lat, lng);
        });
        return null;
    }

    // دیتای نمونه برای لیست
    const items = [
        { id: 1, title: 'زهراعی', sub: '—', letter: 'ز' },
        { id: 2, title: 'بابایی', sub: '—', letter: 'ب' },
        { id: 3, title: 'سپهری', sub: '—', letter: 'س' },
        { id: 4, title: 'جباری', sub: '—', letter: 'ج' },
        { id: 5, title: 'حسین‌زاده', sub: '—', letter: 'ح' },
        { id: 6, title: 'پورنظام', sub: '—', letter: 'پ' },
    ].filter(x => x.title.includes(q));
    function PickPointsDF({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lng: number) => void }) {
        useMapEvent('click', (e: { latlng: { lat: number; lng: number; }; }) => { if (enabled) onPick(e.latlng.lat, e.latlng.lng); });
        return null;
    }
    type TmpLatLng = { lat: number; lng: number };
    type TmpStation = { name: string; lat: number; lng: number; radius_m: number; order_no?: number };
    type TmpGeofenceCircle = { type: 'circle'; center: TmpLatLng; radius_m: number; tolerance_m?: number };
    type TmpGeofencePolygon = { type: 'polygon'; points: TmpLatLng[]; tolerance_m?: number };
    type TmpGeofence = TmpGeofenceCircle | TmpGeofencePolygon;


    type SettingsProfile = {
        id: number;
        name: string;
        settings: {
            stations: TmpStation[];
            geofence?: TmpGeofence | null;
            route?: {
                id: any;
                points: TmpLatLng[];
                threshold_m: number;
            } | null;
            station_ordering?: 'free' | 'sequence';
            mission_mode?: boolean;

        };
    };
    // =========================
    // تنظیمات پیش‌فرض (دیالوگ)
    // =========================
    const [defaultsOpen, setDefaultsOpen] = React.useState(false);
    const [currentView, setCurrentView] = React.useState<'list' | 'edit'>('list');
    const [profilesLoading, setProfilesLoading] = React.useState(false);
    const [profileName, setProfileName] = React.useState('');
    const [editingProfileId, setEditingProfileId] = React.useState<number | null>(null);

    // ادیتور: state‌ها
    const [dfStations, setDfStations] = React.useState<TmpStation[]>([]);
    const [dfGfMode, setDfGfMode] = React.useState<'circle' | 'polygon'>('circle');
    const [dfGfCircle, setDfGfCircle] = React.useState<{ center?: TmpLatLng; radius_m: number; tolerance_m: number }>({ radius_m: 150, tolerance_m: 15 });
    const [dfGfPoly, setDfGfPoly] = React.useState<TmpLatLng[]>([]);
    const [dfDrawing, setDfDrawing] = React.useState(false);
    const [dfTempSt, setDfTempSt] = React.useState<TmpStation | null>(null);
    const [dfAuto, setDfAuto] = React.useState(1);
    const [applyBusy, setApplyBusy] = React.useState(false);

    const applySelectedProfileToVehicles = async () => {
        if (!selectedProfile) { alert('ابتدا یک خط را از ستون راست انتخاب کنید.'); return; }
        const vids = Array.from(selectedVehicleIds);
        if (!vids.length) { alert('هیچ ماشینی انتخاب نشده است.'); return; }

        setApplyBusy(true);
        const logs: string[] = [];

        // Helpers
        const toInt = (v: any, min = 1) => Math.max(min, Math.trunc(Number(v || 0)));
        const normNum = (v: any) => Number.isFinite(Number(v)) ? Number(v) : null;

        try {
            const {
                stations = [],
                route = null,
                geofence = null,
                station_ordering = 'free',  // ⬅️ جدید
                mission_mode = false,       // ⬅️ جدید
            } = (selectedProfile.settings || {}) as {
                stations?: Array<{ name?: string; lat: number; lng: number; radius_m?: number; order_no?: number }>;
                route?: null | { id?: number; name?: string; threshold_m?: number; points?: Array<{ lat: number; lng: number }> };
                geofence?: null | (
                    | { type: 'circle'; center: { lat: number; lng: number }; radius_m: number; tolerance_m?: number }
                    | { type: 'polygon'; points: Array<{ lat: number; lng: number }>; tolerance_m?: number }
                );
                station_ordering?: 'free' | 'sequence'; // ⬅️ جدید
                mission_mode?: boolean;                 // ⬅️ جدید
            };


            const routeThreshold = toInt(route?.threshold_m ?? 60);

            // =========================
            // فاز ۱ — حذف‌ها (روی همهٔ ماشین‌ها)
            // =========================
            for (const vid of vids) {
                try {
                    // 1) لغو مسیر جاری — حتی اگر پروفایل مسیر نداشته باشد
                    await api.delete(`/vehicles/${vid}/routes/current`, {
                        validateStatus: s => s < 500,
                    }).catch(() =>
                        api.put(`/vehicles/${vid}/routes/current`, { route_id: null }, { validateStatus: s => s < 500 })
                    );

                    // 2) پاک‌سازی کامل ایستگاه‌های خودرو
                    try {
                        const res = await api.get(`/vehicles/${vid}/stations`, {
                            params: { _: Date.now() },
                            headers: { 'Cache-Control': 'no-store' },
                            validateStatus: s => s < 500,
                        });
                        const list: any[] =
                            (Array.isArray(res?.data?.items) && res.data.items) ||
                            (Array.isArray(res?.data) && res.data) || [];
                        for (const s of list) {
                            const sid = Number(s?.id);
                            if (Number.isFinite(sid)) {
                                await api.delete(`/vehicles/${vid}/stations/${sid}`, { validateStatus: s => s < 500 }).catch(() => { });
                            }
                        }
                    } catch { /* ignore */ }

                    // 3) حذف ژئوفنس موجود (اگر هر چی هست)
                    await api.delete(`/vehicles/${vid}/geofence`, { validateStatus: s => s < 500 }).catch(() => { });

                    try {
                        const { data: gfAfter1 } = await api.get(`/vehicles/${vid}/geofence`, {
                            headers: { 'Cache-Control': 'no-store' },
                            validateStatus: s => s < 500,
                        });

                        // اگر هنوز آبجکت برگشت (null/empty نبود) دوباره حذف کن و دوباره چک کن
                        if (gfAfter1) {
                            await api.delete(`/vehicles/${vid}/geofence`, { validateStatus: s => s < 500 }).catch(() => { });

                            const { data: gfAfter2 } = await api.get(`/vehicles/${vid}/geofence`, {
                                headers: { 'Cache-Control': 'no-store' },
                                validateStatus: s => s < 500,
                            });

                            if (gfAfter2) {
                                logs.push(`⚠️ ژئوفنس هنوز هست (VID ${vid}) — بک‌اند پاسخ داد اما آبجکت برمی‌گرده. (برای دیباگ)`);
                            }
                        }
                    } catch { /* ignore */ }

                    logs.push(`🗑️ حذف‌ها انجام شد: VID ${vid}`);
                } catch (e: any) {
                    console.error(`[phase:delete] vehicle ${vid}`, e?.response?.data || e);
                    logs.push(`⚠️ خطا در حذف‌ها برای VID ${vid}: ${e?.response?.data?.message || e?.message || 'نامشخص'}`);
                }
            }
            const orderingMode: 'free' | 'sequence' =
                station_ordering === 'sequence' ? 'sequence' : 'free';
            const missionMode = Boolean(mission_mode); // فعلاً فقط می‌خوانیم؛ اگر API مأموریت داشتی این‌جا صدا بزن

            // اگر sequence باشد: برای ایستگاه‌های فاقد order_no، ۱..N بگذار
            const stationsForApply = Array.isArray(stations)
                ? stations.map((s, idx) => ({
                    ...s,
                    order_no:
                        orderingMode === 'sequence'
                            ? (Number.isFinite(Number(s?.order_no)) ? Number(s!.order_no) : idx + 1)
                            : (Number.isFinite(Number(s?.order_no)) ? Number(s!.order_no) : undefined),
                }))
                : [];

            // =========================
            // فاز ۲ — اعمال‌ها (روی همهٔ ماشین‌ها)
            // =========================
            for (const vid of vids) {
                try {
                    // A) مسیر
                    if (route) {
                        if (normNum(route.id) != null) {
                            // assign مسیر موجود
                            await api.put(`/vehicles/${vid}/routes/current`, {
                                route_id: Number(route.id),
                                threshold_m: routeThreshold,
                            }, { validateStatus: s => s < 500 });
                        } else if (Array.isArray(route.points) && route.points.length >= 2) {
                            // ساخت مسیر جدید مخصوص همین خودرو
                            const createPayload = {
                                name: route.name || selectedProfile.name || `Route ${new Date().toISOString().slice(0, 10)}`,
                                threshold_m: routeThreshold,
                                points: route.points.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) })),
                            };
                            const { data: created } = await api.post(`/vehicles/${vid}/routes`, createPayload, { validateStatus: s => s < 500 });
                            const newRid = Number(created?.route_id ?? created?.id ?? created?.route?.id);
                            if (Number.isFinite(newRid)) {
                                await api.put(`/vehicles/${vid}/routes/current`, { route_id: newRid, threshold_m: routeThreshold }, { validateStatus: s => s < 500 })
                                    .catch(() => { });
                            }
                        }
                    }

                    // B) ایستگاه‌های خودرو
                    // B) ایستگاه‌های خودرو (با ترتیب نهایی)
                    if (Array.isArray(stationsForApply) && stationsForApply.length) {
                        for (const st of stationsForApply) {
                            const lat = Number(st?.lat), lng = Number(st?.lng);
                            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
                            await api.post(`/vehicles/${vid}/stations`, {
                                name: (st?.name || '').trim() || 'ایستگاه',
                                lat, lng,
                                radius_m: toInt(st?.radius_m ?? 60),
                                ...(normNum(st?.order_no) != null ? { order_no: Number(st!.order_no) } : {}),
                            }, { validateStatus: s => s < 500 }).catch(() => { });
                        }
                    }


                    // C) ژئوفنس
                    if (geofence) {
                        // circle
                        if (
                            geofence.type === 'circle' &&
                            geofence.center &&
                            Number.isFinite(Number(geofence.radius_m))
                        ) {
                            const payload = {
                                type: 'circle',
                                centerLat: Number(geofence.center.lat),
                                centerLng: Number(geofence.center.lng),
                                radiusM: Math.max(1, Math.trunc(Number(geofence.radius_m))),
                                toleranceM: Math.max(0, Math.trunc(Number(geofence.tolerance_m ?? 15))),
                            };

                            await api.put(`/vehicles/${vid}/geofence`, payload, { validateStatus: s => s < 500 })
                                .catch(async () => {
                                    // fallback برای کلاینت‌هایی که فقط POST می‌پذیرن
                                    await api.post(`/vehicles/${vid}/geofence`, payload, { validateStatus: s => s < 500 }).catch(() => { });
                                });
                        }
                        // polygon
                        else if (
                            geofence.type === 'polygon' &&
                            Array.isArray(geofence.points) &&
                            geofence.points.length >= 3
                        ) {
                            const payload = {
                                type: 'polygon',
                                polygonPoints: geofence.points.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) })),
                                toleranceM: Math.max(0, Math.trunc(Number(geofence.tolerance_m ?? 15))),
                            };

                            await api.put(`/vehicles/${vid}/geofence`, payload, { validateStatus: s => s < 500 })
                                .catch(async () => {
                                    // fallback برای کلاینت‌هایی که فقط POST می‌پذیرن
                                    await api.post(`/vehicles/${vid}/geofence`, payload, { validateStatus: s => s < 500 }).catch(() => { });
                                });
                        }
                    }

                    logs.push(`✅ اعمال شد: VID ${vid}`);
                } catch (e: any) {
                    console.error(`[phase:apply] vehicle ${vid}`, e?.response?.data || e);
                    logs.push(`❌ خطا در اعمال برای VID ${vid}: ${e?.response?.data?.message || e?.message || 'نامشخص'}`);
                }
            }

            alert('حذف کامل و سپس اعمال پروفایل روی ماشین‌های انتخابی انجام شد.');
            if (logs.length) console.log('[applySelectedProfileToVehicles]', logs.join('\n'));

            setSelectedVehicleIds(new Set());
            setSelectedProfileId(null);
            setVehiclesLineOpen(false);
        } finally {
            setApplyBusy(false);
        }

    };

    const readVehicleStations = React.useCallback(async (vid: number) => {
        try {
            const { data } = await api.get(`/vehicles/${vid}/stations`);
            const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
            const norm = arr.map((s: any) => ({
                name: String(s?.name ?? ''),
                lat: Number(s?.lat ?? s?.latitude),
                lng: Number(s?.lng ?? s?.longitude),
                radius_m: Math.max(1, Number(s?.radius_m ?? s?.radiusM ?? s?.radius ?? 60)),
                order_no: s?.order_no ?? s?.orderNo ?? undefined,
            })).filter((s: any) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
            setDfStations(norm);
        } catch {
            setDfStations([]);
        }
    }, []);
    const readVehicleGeofence = React.useCallback(async (vid: number) => {
        try {
            const { data } = await api.get(`/vehicles/${vid}/geofence`);
            const type = String(data?.type ?? data?.geoType ?? '').toLowerCase();

            if (type === 'circle') {
                const centerLat = Number(data?.centerLat ?? data?.center_lat ?? data?.center?.lat);
                const centerLng = Number(data?.centerLng ?? data?.center_lng ?? data?.center?.lng);
                const radiusM = Math.max(1, Number(data?.radiusM ?? data?.radius_m ?? data?.radius));
                const tolM = Math.max(0, Number(data?.toleranceM ?? data?.tolerance_m ?? 15));
                if (Number.isFinite(centerLat) && Number.isFinite(centerLng) && Number.isFinite(radiusM)) {
                    setDfGfMode('circle');
                    setDfGfCircle({ center: { lat: centerLat, lng: centerLng }, radius_m: radiusM, tolerance_m: tolM });
                    setDfGfPoly([]);
                    return;
                }
            }

            const ptsRaw = data?.polygonPoints ?? data?.points ?? [];
            const pts = (Array.isArray(ptsRaw) ? ptsRaw : []).map((p: any) => ({
                lat: Number(p?.lat ?? p?.latitude),
                lng: Number(p?.lng ?? p?.longitude),
            })).filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
            const tolM = Math.max(0, Number(data?.toleranceM ?? data?.tolerance_m ?? 15));

            if (pts.length >= 3) {
                setDfGfMode('polygon');
                setDfGfPoly(pts);
                setDfGfCircle(c => ({ ...c, center: undefined, tolerance_m: tolM }));
                return;
            }

            // اگر هیچ‌کدوم نبود:
            setDfGfMode('circle');
            setDfGfCircle({ center: undefined, radius_m: 150, tolerance_m: 15 });
            setDfGfPoly([]);
        } catch {
            setDfGfMode('circle');
            setDfGfCircle({ center: undefined, radius_m: 150, tolerance_m: 15 });
            setDfGfPoly([]);
        }
    }, []);
    useEffect(() => {
        if (!selectedVid) return;
        // اگر دیالوگ ادیت بازه و نمی‌خوای روی نقشهٔ اصلی لود کنی، این شرط رو اضافه کن:
        // if (defaultsOpen) return;

        if (canStation) readVehicleStations(selectedVid);
        if (canGeofence) readVehicleGeofence(selectedVid);
    }, [selectedVid, canStation, canGeofence, readVehicleStations, readVehicleGeofence]);
    // اعمال روی خودروها (ساده: ورودی VIDها)
    const [applyManualVids, setApplyManualVids] = React.useState<string>('');

    // کلیک برای بیضی‌های نمونه (نمایشی، اختیاری)
    const [clickFences, setClickFences] = React.useState<TmpLatLng[]>([]);
    const onMapClick = (e: LeafletMouseEvent) => {
        // برای ادیتور: اگر dfDrawing فعال و حالت polygon باشد، نقطه اضافه کن
        if (dfDrawing && dfGfMode === 'polygon') {
            setDfGfPoly(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
        }
    };

    const buildDfGeofence = (): TmpGeofence | null => {
        if (dfGfMode === 'circle') {
            if (!dfGfCircle.center || !Number.isFinite(dfGfCircle.radius_m)) return null;
            return {
                type: 'circle',
                center: dfGfCircle.center,
                radius_m: Math.max(1, dfGfCircle.radius_m),
                tolerance_m: Math.max(0, dfGfCircle.tolerance_m),
            };
        }
        if (dfGfPoly.length >= 3) {
            return { type: 'polygon', points: dfGfPoly.slice(), tolerance_m: Math.max(0, dfGfCircle.tolerance_m) };
        }
        return null;
    };

    const resetForms = () => {
        setDfStations([]);
        setDfGfMode('circle');
        setDfGfCircle({ radius_m: 150, tolerance_m: 15, center: undefined });
        setDfGfPoly([]);
        setDfDrawing(false);
        setDfTempSt(null);
        setDfAuto(1);
        setProfileName('');
        setEditingProfileId(null);
        setClickFences([]);
        setApplyManualVids('');
        setRoutePoints([]);           // ← مهم
        setRouteThreshold(60);        // ← مهم
        setDrawingRoute(false);
        setDfOrdering('sequence');
        setDfMission(false);
    };

    // داخل DefineLinePage.tsx
    const loadProfiles = React.useCallback(async () => {
        setProfilesLoading(true);
        try {
            // کاربر جاری باید مشخص باشد
            if (!me?.id) {
                setProfiles([]);
                return;
            }

            // پارام‌های درخواست به سرور
            const params: Record<string, any> = {};

            if (me.role_level === 2) {
                // سوپرادمین: فقط پروفایل‌های خودش
                params.owner_user_id = me.id;
            } else if (me.role_level >= 3 && me.role_level <= 5) {
                // نقش‌های ۳..۵: پروفایل‌های سوپرادمین والد
                const parent = await resolveParentSA(me.id);
                if (parent?.id) {
                    params.owner_user_id = parent.id;
                } else {
                    // اگر والد SA پیدا نشد، چیزی نمایش نده
                    setProfiles([]);
                    return;
                }
            }
            // نقش ۱ (مدیرکل/ادمین کل): params خالی = طبق بک‌اند شما «همه» یا محدوده مجاز

            const { data } = await api.get('/vehicle-setting-profiles', {
                params,
                validateStatus: s => s < 500,
            });

            // بک‌اند ممکنه items بده یا آرایه خام
            const rows =
                Array.isArray(data) ? data :
                    Array.isArray(data?.items) ? data.items :
                        [];

            setProfiles(rows);
        } catch (e) {
            console.error('Failed to fetch profiles', e);
            setProfiles([]);
        } finally {
            setProfilesLoading(false);
        }
    }, [me?.id, me?.role_level, resolveParentSA]);


    const handleCreateNewProfile = () => {
        resetForms();
        setCurrentView('edit');
    };

    const handleLoadProfile = (profileId: number) => {
        const p = profiles.find(x => x.id === profileId);
        if (!p) return;
        resetForms();
        setEditingProfileId(p.id);
        setProfileName(p.name);
        setDfStations(p.settings.stations || []);
        setRoutePoints(p.settings.route?.points || []);
        setRouteThreshold(Math.max(1, Number(p.settings.route?.threshold_m ?? 60)));
        const gf = p.settings.geofence;
        setDfOrdering(p.settings?.station_ordering === 'sequence' ? 'sequence' : 'free');
        setDfMission(Boolean(p.settings?.mission_mode));
        if (gf) {
            if (gf.type === 'circle') {
                setDfGfMode('circle');
                setDfGfCircle({
                    center: gf.center,
                    radius_m: gf.radius_m,
                    tolerance_m: gf.tolerance_m ?? 15,
                });
            } else {
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
        const settings = {
            stations: dfStations,
            geofence: buildDfGeofence(),
            route: (canRoute && routePoints.length > 1)
                ? { points: routePoints.slice(), threshold_m: Math.max(1, Math.trunc(routeThreshold)) }
                : null,
            station_ordering: dfOrdering,
            mission_mode: dfMission,
        }; try {
            if (editingProfileId) {
                await api.put(`/vehicle-setting-profiles/${editingProfileId}`, { name: profileName.trim(), settings });
            } else {
                await api.post('/vehicle-setting-profiles', { name: profileName.trim(), settings });
            }
            await loadProfiles();
            setCurrentView('list');
        } catch (e: any) {
            console.error('save profile failed', e?.response?.data || e);
            alert('خطا در ذخیره پروفایل');
        }
    };

    const handleDeleteProfile = async (profileId: number) => {
        if (!window.confirm('این پروفایل حذف شود؟')) return;
        try {
            await api.delete(`/vehicle-setting-profiles/${profileId}`);
            await loadProfiles();
        } catch (e: any) {
            console.error('delete profile failed', e?.response?.data || e);
            alert('خطا در حذف پروفایل');
        }
    };
    const ellipseLatLngs = React.useCallback(
        (center: { lat: number; lng: number }, rx = 80, ry = 40, rot = 0, seg = 72) =>
            ellipsePolygonPoints(center, rx, ry, rot, seg).map(p => [p.lat, p.lng] as [number, number]),
        []
    );

    const handleApplyDefaults = async () => {
        const geofence = buildDfGeofence();
        if (!dfStations.length && !geofence) {
            alert('هیچ آیتمی برای اعمال تنظیم نشده.');
            return;
        }
        // VID ها
        const vids = (applyManualVids || '')
            .split(',')
            .map(s => Number(s.trim()))
            .filter(n => Number.isFinite(n));

        if (!vids.length) {
            alert('حداقل یک VID معتبر وارد کنید.');
            return;
        }

        setApplyBusy(true);
        try {
            // اعمال ساده: ایستگاه‌ها replace + ژئوفنس set
            for (const vid of vids) {
                try {
                    // ایستگاه‌ها (replace ساده: اول delete همه، بعد add)
                    // اگر بک‌اندت endpoint مخصوص replace دارد، از همان استفاده کن.
                    // اینجا نمونه ساده: POST bulk اگر داری، جایگزین کن.
                    // نمونه: پاک‌سازی همه‌ی ایستگاه‌ها (اگر endpoint داری) — در غیر این‌صورت، skip.
                    // await api.delete(`/vehicles/${vid}/stations`)

                    for (const st of dfStations) {
                        await api.post(`/vehicles/${vid}/stations`, {
                            name: st.name,
                            lat: st.lat,
                            lng: st.lng,
                            radius_m: Math.max(1, st.radius_m),
                            order_no: st.order_no ?? undefined,
                        }).catch(() => { /* اگر duplicate بود، بک‌اند خودش هندل کند */ });
                    }

                    // ژئوفنس
                    if (geofence) {
                        if (geofence.type === 'circle') {
                            await api.put(`/vehicles/${vid}/geofence`, {
                                type: 'circle',
                                centerLat: geofence.center.lat,
                                centerLng: geofence.center.lng,
                                radiusM: geofence.radius_m,
                                toleranceM: geofence.tolerance_m ?? 15,
                            }).catch(() => api.post(`/vehicles/${vid}/geofence`, {
                                type: 'circle',
                                centerLat: geofence.center.lat,
                                centerLng: geofence.center.lng,
                                radiusM: geofence.radius_m,
                                toleranceM: geofence.tolerance_m ?? 15,
                            }));
                        } else {
                            await api.put(`/vehicles/${vid}/geofence`, {
                                type: 'polygon',
                                polygonPoints: geofence.points.map(p => ({ lat: p.lat, lng: p.lng })),
                                toleranceM: geofence.tolerance_m ?? 15,
                            }).catch(() => api.post(`/vehicles/${vid}/geofence`, {
                                type: 'polygon',
                                polygonPoints: geofence.points.map(p => ({ lat: p.lat, lng: p.lng })),
                                toleranceM: geofence.tolerance_m ?? 15,
                            }));
                        }
                    }
                } catch (e: any) {
                    console.error(`apply to VID ${vid} failed`, e?.response?.data || e);
                }
            }
            alert('اعمال تنظیمات انجام شد.');
        } finally {
            setApplyBusy(false);
        }
    };
    // مسیر و کریدور: خروجی‌های memoized برای استفاده در JSX
    const polylineLatLngs = React.useMemo(
        () => routePoints.map(p => [p.lat, p.lng] as [number, number]),
        [routePoints]
    );

    const corridorLatLngs = React.useMemo(
        () =>
            buildRouteBufferPolygon(routePoints, Math.max(1, routeThreshold))
                .map(p => [p.lat, p.lng] as [number, number]),
        [routePoints, routeThreshold]
    );

    React.useEffect(() => {
        if (defaultsOpen) {
            loadProfiles();
            //setCurrentView('list');
        } else {
            resetForms();
        }
    }, [defaultsOpen, loadProfiles]);


    return (

        <LocalizationProvider dateAdapter={AdapterDayjs}>
            {/* === Sidebar (عیناً از DashboardPage) === */}
            <Drawer
                anchor="left"
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
                    ].map((item, i) => (
                        <ListItem key={i} disablePadding>
                            <ListItemButton
                                component="a"
                                href={item.to}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={closeSidebar}
                            >
                                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                                <ListItemText primary={item.label} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </Drawer>

            {/* ناحیه‌ی نامرئی برای هاور در لبه‌ی راست (نسخه‌ی تو: top=64px) */}
            <Box
                onMouseEnter={openSidebar}
                sx={{
                    position: 'fixed',
                    top: 64,
                    left: 0,
                    width: 16,
                    height: 'calc(100vh - 64px)',
                    zIndex: (t) => t.zIndex.drawer + 1,
                    cursor: 'pointer',
                }}
            />

            {/* دکمه‌ی همبرگری شناور در سمت چپ (نسخه‌ی تو: top=20,left=20) */}
            <IconButton
                onClick={openSidebar}
                aria-label="باز کردن ناوبری"
                sx={{
                    position: 'fixed',
                    top: 20,
                    left: 20,
                    zIndex: (t) => t.zIndex.drawer + 1,
                    bgcolor: 'background.paper',
                    boxShadow: 1,
                    '&:hover': { bgcolor: 'background.default' },
                }}
            >
                <MenuRoundedIcon />
            </IconButton>

            <Box p={2.5} sx={{ direction: 'rtl' }}>
                {/* کنترل‌های ترسیم مسیر */}

                {/* تیتر صفحه */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Typography variant="h5" fontWeight={800}>تعریف خط</Typography>
                    <Stack direction="row" spacing={1}>
                        <Tooltip title="بروزرسانی">
                            <span><IconButton><RefreshRoundedIcon /></IconButton></span>
                        </Tooltip>
                        <Tooltip title="تنظیمات">
                            <span><IconButton><MoreVertRoundedIcon /></IconButton></span>
                        </Tooltip>
                    </Stack>
                </Stack>

                {/* گرید اصلی */}
                <Box
                    sx={{
                        display: 'grid',
                        gap: 1.5,
                        gridTemplateColumns: { xs: '1fr', lg: '1fr 420px' },
                        gridTemplateRows: 'minmax(520px, 1fr)',
                    }}
                >
                    {/* نقشه */}
                    <Paper sx={{ p: 1.5, minHeight: 520, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ flex: 1, minHeight: 0, borderRadius: 1, overflow: 'hidden' }}>
                            <MapContainer
                                center={[35.73, 51.42]} zoom={14} minZoom={3}
                                style={{ width: '100%', height: '100%' }}
                                whenCreated={(m: { on: (arg0: string, arg1: (e: any) => void) => void; }) => {
                                    mapRef.current = m;
                                    // فقط برای نمایش بیضی‌های نمونه روی کلیک (اختیاری)
                                    m.on('click', (e: any) => setClickFences(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]));
                                }}
                            >
                                <GfClickCatcher
                                    enabled={gfDrawing}
                                    mode={dfGfMode}
                                    setCircleCenter={(lat, lng) => setDfGfCircle(s => ({ ...s, center: { lat, lng } }))}
                                    pushPolyPoint={(lat, lng) => setDfGfPoly(prev => [...prev, { lat, lng }])}
                                />

                                {/* پیش‌نمایش ژئوفنس */}
                                {dfGfMode === 'circle' && dfGfCircle.center && (
                                    <Circle center={[dfGfCircle.center.lat, dfGfCircle.center.lng]} radius={dfGfCircle.radius_m} />
                                )}
                                {dfGfMode === 'polygon' && dfGfPoly.length >= 2 && (
                                    <Polygon positions={dfGfPoly.map(p => [p.lat, p.lng] as [number, number])} />
                                )}
                                {/* ⬇️ ایستگاه‌های پروفایل انتخابی روی نقشهٔ اصلی */}
                                {dfStations.map((st, i) => (
                                    <React.Fragment key={`main-st-${i}`}>
                                        <Circle center={[st.lat, st.lng]} radius={st.radius_m} />
                                        <Marker position={[st.lat, st.lng]}>
                                            <Popup><b>{st.name}</b><br />{st.lat.toFixed(5)}, {st.lng.toFixed(5)}</Popup>
                                        </Marker>
                                    </React.Fragment>
                                ))}
                                {routePoints.length > 1 && (
                                    <>
                                        <Polyline positions={polylineLatLngs} interactive={false} pathOptions={{ weight: 3, opacity: 0.9 }} />
                                        <Polygon positions={corridorLatLngs} interactive={false} pathOptions={{ weight: 1, opacity: 0.2 }} />
                                    </>
                                )}
                                {/* کلیک‌گیر مسیر خیابانی (OSRM): دقیقاً ۲ کلیک → درخواست به OSRM */}
                                <RoadRoutePicker
                                    enabled={roadRoutePicking}
                                    onDone={(a, b) => {
                                        setRoadStart(a);
                                        setRoadEnd(b);
                                        fetchOsrmRoute(a, b);
                                    }}
                                />

                                {/* مارکر مبدأ/مقصد وقتی انتخاب شده‌اند */}
                                {roadStart && <Marker position={[roadStart.lat, roadStart.lng]} />}
                                {roadEnd && <Marker position={[roadEnd.lat, roadEnd.lng]} />}

                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution="&copy; OpenStreetMap contributors"
                                />


                                {/* نمایش بیضی‌های نمونه روی map اصلی (صرفاً نمایشی) */}
                                {clickFences.map((p, i) => {
                                    const ring = ellipsePolygonPoints(p, 80, 40, 0, 72);
                                    return (
                                        <Polygon key={`cf-${i}`} positions={ring.map(r => [r.lat, r.lng] as [number, number])} />
                                    );
                                })}
                            </MapContainer>
                        </Box>
                    </Paper>

                    {/* سایدبار لیست */}
                    {/* سایدبار: لیست پروفایل‌ها */}
                    <Paper sx={{ p: 1.5, display: 'flex', flexDirection: 'column', minHeight: 520 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                            <Typography variant="subtitle1">
                                خط‌ها({profiles.length})
                            </Typography>
                            <Stack direction="row" spacing={1}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => { setCurrentView('edit'); setDefaultsOpen(true); }}
                                >
                                    ایجاد خط
                                </Button>
                                <Button size="small" variant="text" onClick={loadProfiles}>
                                    بروزرسانی
                                </Button>
                            </Stack>
                        </Stack>

                        {/* سرچ روی نام پروفایل */}
                        <TextField
                            size="small"
                            placeholder="جستجوی نام پروفایل"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ mb: 1 }}
                        />

                        <Divider sx={{ mb: 1 }} />

                        {/* لیست پروفایل‌ها */}
                        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                            {profilesLoading ? (
                                <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
                                    <CircularProgress size={24} />
                                </Stack>
                            ) : (
                                <List dense disablePadding>
                                    {profiles
                                        .filter(p => (p.name || '').toLowerCase().includes(q.trim().toLowerCase()))
                                        .map((p) => (
                                            <React.Fragment key={p.id}>
                                                <ListItem
                                                    sx={{ px: 1, cursor: 'pointer' }}
                                                    onClick={() => previewProfileOnMainMap(p)}
                                                >
                                                    <ListItemAvatar>
                                                        <Avatar>{(p.name || 'پ')[0]}</Avatar>
                                                    </ListItemAvatar>
                                                    <ListItemText
                                                        primary={p.name}
                                                        secondary={
                                                            <span style={{ opacity: 0.7 }}>
                                                                {`ایستگاه‌ها: ${p.settings?.stations?.length || 0} — `}
                                                                {p.settings?.geofence ? 'ژئوفنس: دارد' : 'ژئوفنس: ندارد'}
                                                            </span>
                                                        }
                                                        primaryTypographyProps={{ sx: { fontWeight: 600 } }}
                                                    />
                                                    {/* اکشن‌ها: ویرایش / اعمال / حذف */}
                                                    <Stack direction="row" spacing={0.75} sx={{ ml: 1 }}>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            onClick={() => {
                                                                handleLoadProfile(p.id);   // خودش فرم‌ها رو پر می‌کند و setCurrentView('edit') هم دارد
                                                                setCurrentView('edit');    // خیالت راحت؛ قبل از باز شدن روی edit می‌ماند
                                                                setDefaultsOpen(true);
                                                            }}
                                                        >
                                                            ویرایش
                                                        </Button>


                                                        <Button
                                                            size="small"
                                                            color="error"
                                                            variant="text"
                                                            onClick={() => handleDeleteProfile(p.id)}
                                                        >
                                                            حذف
                                                        </Button>
                                                    </Stack>

                                                </ListItem>
                                                <Divider component="li" />
                                            </React.Fragment>
                                        ))}
                                    {profiles.length === 0 && !profilesLoading && (
                                        <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                                            هنوز خطی ثبت نشده است.
                                        </Typography>
                                    )}
                                </List>
                            )}
                        </Box>
                    </Paper>

                </Box>
                {/* مثال: کنترل‌های ساده برای ترسیم ژئوفنس */}


                {clickFences.map((p, i) => (
                    <Polygon key={`cf-${i}`} positions={ellipseLatLngs(p)} />
                ))}
                {/* نوار فیلتر پایین */}
                <Paper sx={{ mt: 1.5, p: 1.25 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle2" sx={{ opacity: 0.85 }}></Typography>

                        </Stack>

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems="center">
                            <Button variant="contained" onClick={() => setVehiclesLineOpen(true)}>
                                تعریف خط ماشین‌ها
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => {
                                    setAuxLineOpen(true);
                                    setVehTab('all');              // لیست کامل طبق رول (۱=همه، ۲=مال خود، ۳..۵=مسئول)
                                }}
                            >
                                تعریف خط کمکی
                            </Button>

                        </Stack>

                    </Stack>
                </Paper>
            </Box>
            <Dialog
                open={auxLineOpen}
                onClose={() => setAuxLineOpen(false)}
                fullWidth
                maxWidth="xl"
            >
                <DialogTitle>تعریف خط کمکی</DialogTitle>

                <DialogContent sx={{ p: 0 }}>
                    <Box
                        sx={{
                            width: { xs: '100vw', md: '90vw' },
                            maxWidth: 1400,
                            height: { xs: '80vh', md: '70vh' },
                            display: 'flex',
                            flexDirection: 'row-reverse', // RTL: پروفایل‌ها راست
                        }}
                    >
                        {/* ستون چپ: لیست ماشین‌ها با تب (مثل دیالوگ اصلی) */}
                        <Box sx={{ width: { xs: '100%', md: '55%' }, p: 2, overflow: 'auto' }}>
                            <Typography variant="h6" gutterBottom>ماشین‌ها</Typography>

                            {(() => {
                                const allVehicles = vehiclesRef.current || [];

                                // مجموعه‌ی تایپ‌ها + تب‌های ثابت
                                const typeSet = new Set<string>();
                                allVehicles.forEach(v => typeSet.add(String(v?.vehicle_type_code || '').toLowerCase()));
                                const types = ['all', 'remaining', ...Array.from(typeSet).filter(Boolean)];

                                // فیلتر بر اساس تب
                                const filtered =
                                    vehTab === 'all'
                                        ? allVehicles
                                        : vehTab === 'remaining'
                                            ? allVehicles.filter(v => remainingVehicleIds.has(v.id))
                                            : allVehicles.filter(v => String(v?.vehicle_type_code || '').toLowerCase() === vehTab);

                                return (
                                    <>
                                        <Tabs
                                            value={vehTab}
                                            onChange={(_, val) => setVehTab(val)}
                                            variant="scrollable"
                                            allowScrollButtonsMobile
                                            sx={{ mb: 1 }}
                                        >
                                            {types.map((t) => (
                                                <Tab
                                                    key={t || 'unknown'}
                                                    value={t}
                                                    label={
                                                        t === 'all'
                                                            ? 'همه'
                                                            : t === 'remaining'
                                                                ? (remLoading ? 'ماشین‌های باقی‌مانده (در حال بررسی...)' : `ماشین‌های باقی‌مانده (${remainingVehicleIds.size})`)
                                                                : vehicleTypeLabel(t)
                                                    }
                                                    wrapped
                                                />
                                            ))}
                                        </Tabs>

                                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                {vehTab === 'all'
                                                    ? `تعداد: ${filtered.length}`
                                                    : vehTab === 'remaining'
                                                        ? (remLoading
                                                            ? 'در حال محاسبهٔ ماشین‌های فاقد مسیر/ژئوفنس/ایستگاه…'
                                                            : `ماشین‌های باقی‌مانده — تعداد: ${filtered.length}`)
                                                        : `${vehicleTypeLabel(vehTab)} — تعداد: ${filtered.length}`}
                                            </Typography>

                                            <Stack direction="row" spacing={1} alignItems="center">
                                                {vehTab === 'remaining' && (
                                                    <Button
                                                        size="small"
                                                        onClick={computeRemainingVehicles}
                                                        disabled={remLoading}
                                                    >
                                                        {remLoading ? 'در حال محاسبه…' : 'بازمحاسبه'}
                                                    </Button>
                                                )}
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            size="small"
                                                            checked={filtered.length > 0 && filtered.every(v => selectedVehicleIds.has(v.id))}
                                                            onChange={() => toggleSelectAll(filtered)}
                                                            disabled={!selectedProfile || (vehTab === 'remaining' && remLoading)}
                                                        />
                                                    }
                                                    label="انتخاب همه در این تب"
                                                />
                                            </Stack>
                                        </Stack>

                                        {vehTab === 'remaining' && remLoading ? (
                                            <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
                                                <CircularProgress size={22} />
                                                <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
                                                    در حال بررسی مسیر/ژئوفنس/ایستگاه برای ماشین‌ها…
                                                </Typography>
                                            </Stack>
                                        ) : filtered.length ? (
                                            <List dense disablePadding>
                                                {filtered.map((v: any) => {
                                                    const st = vehicleStatusMap[v.id];
                                                    return (
                                                        <React.Fragment key={v.id}>
                                                            <ListItem sx={{ px: 1.25 }}>
                                                                <ListItemAvatar>
                                                                    <Avatar>{(vehicleTypeLabel(v?.vehicle_type_code) || 'و')[0]}</Avatar>
                                                                </ListItemAvatar>
                                                                <ListItemText
                                                                    primary={v?.name || `Vehicle #${v.id}`}
                                                                    secondary={
                                                                        <span style={{ opacity: 0.75 }}>
                                                                            نوع: {vehicleTypeLabel(v?.vehicle_type_code)} — مالک: {v?.owner_user_id ?? 'نامشخص'}
                                                                            {vehTab === 'remaining' && st && <> — مسیر: ندارد — ژئوفنس: ندارد — ایستگاه: 0</>}
                                                                        </span>
                                                                    }
                                                                    primaryTypographyProps={{ sx: { fontWeight: 600 } }}
                                                                />
                                                                <Checkbox
                                                                    edge="end"
                                                                    disabled={!selectedProfile || (vehTab === 'remaining' && remLoading)}
                                                                    checked={selectedVehicleIds.has(v.id)}
                                                                    onChange={() => toggleVehicle(v.id)}
                                                                />
                                                            </ListItem>
                                                            <Divider component="li" />
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </List>
                                        ) : (
                                            <Typography color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                                                {vehTab === 'remaining'
                                                    ? (remLoading ? '...' : 'ماشینی که فاقد مسیر/ژئوفنس/ایستگاه باشد یافت نشد.')
                                                    : 'موردی یافت نشد.'}
                                            </Typography>
                                        )}
                                    </>
                                );
                            })()}
                        </Box>

                        {/* ستون راست: لیست خط‌ها */}
                        <Box
                            sx={{
                                width: { xs: '100%', md: '45%' },
                                borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
                                p: 2,
                                overflow: 'auto',
                            }}
                        >
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                                <Typography variant="h6">خط‌های ایجادشده</Typography>
                                <Chip size="small" label={`${profiles.length}`} />
                            </Stack>

                            {profilesLoading ? (
                                <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
                                    <CircularProgress size={24} />
                                </Stack>
                            ) : profiles.length ? (
                                <List dense disablePadding>
                                    {profiles.map((p) => (
                                        <React.Fragment key={p.id}>
                                            <ListItem
                                                sx={{
                                                    px: 1.25,
                                                    cursor: 'pointer',
                                                    bgcolor: p.id === selectedProfileId ? 'action.selected' : undefined,
                                                    borderRadius: 1,
                                                }}
                                                onClick={() => {
                                                    setSelectedProfileId(p.id);
                                                    setSelectedVehicleIds(new Set()); // تغییر پروفایل = پاک‌کردن انتخاب قبلی
                                                }}
                                            >
                                                <ListItemAvatar>
                                                    <Avatar>{(p.name || 'خ')[0]}</Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={p.name}
                                                    secondary={
                                                        <span style={{ opacity: 0.75 }}>
                                                            ایستگاه‌ها: {p.settings?.stations?.length || 0} — {p.settings?.geofence ? 'ژئوفنس: دارد' : 'ژئوفنس: ندارد'}
                                                            {p.settings?.route?.points?.length ? ' — مسیر: دارد' : ''}
                                                        </span>
                                                    }
                                                    primaryTypographyProps={{ sx: { fontWeight: 600 } }}
                                                />
                                            </ListItem>
                                            <Divider component="li" />
                                        </React.Fragment>
                                    ))}
                                </List>
                            ) : (
                                <Typography color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                                    هنوز خطی ثبت نشده است.
                                </Typography>
                            )}
                        </Box>
                    </Box>
                </DialogContent>

                {/* نوار پایینی: کنترل زمان‌بندی + ثبت */}
                <DialogActions sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={auxStartNow}
                                onChange={(e) => setAuxStartNow(e.target.checked)}
                            />
                        }
                        label="شروع از همین حالا"
                    />

                    {!auxStartNow && (
                        <DateTimePicker
                            label="زمان شروع"
                            value={auxStartAt}
                            onChange={(v) => setAuxStartAt(v)}
                            slotProps={{ textField: { size: 'small', sx: { minWidth: 220 } } }}
                        />
                    )}

                    <TextField
                        size="small"
                        type="number"
                        label="مدت (ساعت)"
                        value={auxDurationH}
                        onChange={(e) => setAuxDurationH(Number(e.target.value || 0))}
                        sx={{ width: 140 }}
                        inputProps={{ min: 1 }}
                    />

                    <Box sx={{ flex: 1 }} />

                    <Button onClick={() => setAuxLineOpen(false)}>بستن</Button>
                    <Button
                        variant="contained"
                        onClick={applyAuxProfileTemporarily}
                        disabled={!selectedProfile || applyBusy || selectedVehicleIds.size === 0}
                    >
                        {applyBusy ? 'در حال ثبت…' : 'ثبت خط کمکی'}
                    </Button>

                </DialogActions>
            </Dialog>


            <DialogContent sx={{ p: 0 }}>
                <Box
                    sx={{
                        width: { xs: '100vw', md: '90vw' },
                        maxWidth: 1400,
                        height: { xs: '80vh', md: '70vh' },
                        display: 'flex',
                        // row-reverse برای اینکه در RTL، ستون «خط‌ها» سمت راست دیده شود
                        flexDirection: 'row-reverse',
                    }}
                >
                    {/* ستون راست: لیست همهٔ خط‌ها (پروفایل‌ها) */}
                    <Dialog
                        open={vehiclesLineOpen}
                        onClose={() => setVehiclesLineOpen(false)}
                        fullWidth
                        maxWidth="xl"
                    >
                        <DialogTitle>تعریف خط ماشین‌ها</DialogTitle>

                        <DialogContent sx={{ p: 0 }}>
                            <Box
                                sx={{
                                    width: { xs: '100vw', md: '90vw' },
                                    maxWidth: 1400,
                                    height: { xs: '80vh', md: '70vh' },
                                    display: 'flex',
                                    // برای RTL: ستون خط‌ها سمت راست
                                    flexDirection: 'row-reverse',
                                }}
                            >
                                {/* ستون چپ: لیست ماشین‌ها با تب نوع وسیله */}
                                <Box
                                    sx={{
                                        width: { xs: '100%', md: '55%' },
                                        p: 2,
                                        overflow: 'auto',
                                    }}
                                >
                                    <Typography variant="h6" gutterBottom>ماشین‌ها</Typography>

                                    {(() => {
                                        const allVehicles = vehiclesRef.current || [];

                                        // مجموعه‌ی تایپ‌ها + تب‌های ثابت: همه / باقی‌مانده
                                        const typeSet = new Set<string>();
                                        allVehicles.forEach(v => typeSet.add(String(v?.vehicle_type_code || '').toLowerCase()));
                                        const types = ['all', 'remaining', ...Array.from(typeSet).filter(Boolean)];

                                        // فیلتر بر اساس تب
                                        const filtered =
                                            vehTab === 'all'
                                                ? allVehicles
                                                : vehTab === 'remaining'
                                                    ? allVehicles.filter(v => remainingVehicleIds.has(v.id))
                                                    : allVehicles.filter(v => String(v?.vehicle_type_code || '').toLowerCase() === vehTab);

                                        const allFilteredSelected =
                                            filtered.length > 0 && filtered.every(v => selectedVehicleIds.has(v.id));

                                        return (
                                            <>
                                                <Tabs
                                                    value={vehTab}
                                                    onChange={(_, val) => setVehTab(val)}
                                                    variant="scrollable"
                                                    allowScrollButtonsMobile
                                                    sx={{ mb: 1 }}
                                                >
                                                    {types.map((t) => (
                                                        <Tab
                                                            key={t || 'unknown'}
                                                            value={t}
                                                            label={
                                                                t === 'all'
                                                                    ? 'همه'
                                                                    : t === 'remaining'
                                                                        ? (remLoading ? 'ماشین‌های باقی‌مانده (در حال بررسی...)' : `ماشین‌های باقی‌مانده (${remainingVehicleIds.size})`)
                                                                        : vehicleTypeLabel(t)
                                                            }
                                                            wrapped
                                                        />
                                                    ))}
                                                </Tabs>

                                                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {vehTab === 'all'
                                                            ? `تعداد: ${filtered.length}`
                                                            : vehTab === 'remaining'
                                                                ? (remLoading
                                                                    ? 'در حال محاسبهٔ ماشین‌های فاقد مسیر/ژئوفنس/ایستگاه…'
                                                                    : `ماشین‌های باقی‌مانده — تعداد: ${filtered.length}`)
                                                                : `${vehicleTypeLabel(vehTab)} — تعداد: ${filtered.length}`}
                                                    </Typography>

                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        {vehTab === 'remaining' && (
                                                            <Button
                                                                size="small"
                                                                onClick={computeRemainingVehicles}
                                                                disabled={remLoading}
                                                            >
                                                                {remLoading ? 'در حال محاسبه…' : 'بازمحاسبه'}
                                                            </Button>
                                                        )}
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    size="small"
                                                                    checked={filtered.length > 0 && filtered.every(v => selectedVehicleIds.has(v.id))}
                                                                    onChange={() => toggleSelectAll(filtered)}
                                                                    disabled={!selectedProfile || (vehTab === 'remaining' && remLoading)}
                                                                />
                                                            }
                                                            label="انتخاب همه در این تب"
                                                        />
                                                    </Stack>
                                                </Stack>
                                                {vehTab === 'remaining' && remLoading ? (
                                                    <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
                                                        <CircularProgress size={22} />
                                                        <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
                                                            در حال بررسی مسیر/ژئوفنس/ایستگاه برای ماشین‌ها…
                                                        </Typography>
                                                    </Stack>
                                                ) : filtered.length ? (
                                                    <List dense disablePadding>
                                                        {filtered.map((v: any) => {
                                                            const st = vehicleStatusMap[v.id];
                                                            return (
                                                                <React.Fragment key={v.id}>
                                                                    <ListItem sx={{ px: 1.25 }}>
                                                                        <ListItemAvatar>
                                                                            <Avatar>{(vehicleTypeLabel(v?.vehicle_type_code) || 'و')[0]}</Avatar>
                                                                        </ListItemAvatar>
                                                                        <ListItemText
                                                                            primary={v?.name || `Vehicle #${v.id}`}
                                                                            secondary={
                                                                                <span style={{ opacity: 0.75 }}>
                                                                                    نوع: {vehicleTypeLabel(v?.vehicle_type_code)} — مالک: {v?.owner_user_id ?? 'نامشخص'}
                                                                                    {vehTab === 'remaining' && st && (
                                                                                        <> — مسیر: ندارد — ژئوفنس: ندارد — ایستگاه: 0</>
                                                                                    )}
                                                                                </span>
                                                                            }
                                                                            primaryTypographyProps={{ sx: { fontWeight: 600 } }}
                                                                        />
                                                                        <Checkbox
                                                                            edge="end"
                                                                            disabled={!selectedProfile || (vehTab === 'remaining' && remLoading)}
                                                                            checked={selectedVehicleIds.has(v.id)}
                                                                            onChange={() => toggleVehicle(v.id)}
                                                                        />
                                                                    </ListItem>
                                                                    <Divider component="li" />
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </List>
                                                ) : (
                                                    <Typography color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                                                        {vehTab === 'remaining'
                                                            ? (remLoading ? '...' : 'ماشینی که فاقد مسیر/ژئوفنس/ایستگاه باشد یافت نشد.')
                                                            : 'موردی یافت نشد.'}
                                                    </Typography>
                                                )}



                                            </>
                                        );
                                    })()}
                                </Box>


                                {/* ستون راست: لیست خط‌ها (profiles) */}
                                <Box
                                    sx={{
                                        width: { xs: '100%', md: '45%' },
                                        borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
                                        p: 2,
                                        overflow: 'auto',
                                    }}
                                >
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                                        <Typography variant="h6">خط‌های ایجادشده</Typography>
                                        <Chip size="small" label={`${profiles.length}`} />
                                    </Stack>

                                    {profilesLoading ? (
                                        <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
                                            <CircularProgress size={24} />
                                        </Stack>
                                    ) : profiles.length ? (
                                        <List dense disablePadding>
                                            {profiles.map((p) => (
                                                <React.Fragment key={p.id}>
                                                    <ListItem
                                                        sx={{
                                                            px: 1.25,
                                                            cursor: 'pointer',
                                                            bgcolor: p.id === selectedProfileId ? 'action.selected' : undefined,
                                                            borderRadius: 1,
                                                        }}
                                                        onClick={() => {
                                                            setSelectedProfileId(p.id);
                                                            setSelectedVehicleIds(new Set()); // با تغییر خط، انتخاب قبلی ماشین‌ها پاک شود
                                                        }}
                                                    >
                                                        <ListItemAvatar>
                                                            <Avatar>{(p.name || 'خ')[0]}</Avatar>
                                                        </ListItemAvatar>
                                                        <ListItemText
                                                            primary={p.name}
                                                            secondary={
                                                                <span style={{ opacity: 0.75 }}>
                                                                    ایستگاه‌ها: {p.settings?.stations?.length || 0} — {p.settings?.geofence ? 'ژئوفنس: دارد' : 'ژئوفنس: ندارد'}
                                                                    {p.settings?.route?.points?.length ? ' — مسیر: دارد' : ''}
                                                                </span>
                                                            }
                                                            primaryTypographyProps={{ sx: { fontWeight: 600 } }}
                                                        />
                                                    </ListItem>
                                                    <Divider component="li" />
                                                </React.Fragment>
                                            ))}
                                        </List>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                                            هنوز خطی ثبت نشده است.
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        </DialogContent>

                        <DialogActions>
                            <Button onClick={() => setVehiclesLineOpen(false)}>بستن</Button>
                            <Button
                                variant="contained"
                                onClick={applySelectedProfileToVehicles}
                                disabled={!selectedProfile || selectedVehicleIds.size === 0 || applyBusy}
                            >
                                {applyBusy ? 'در حال اعمال…' : 'ثبت'}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* ستون چپ: (جای خالی — چون کل UI در دیالوگ بالایی رندر می‌شود) */}
                </Box>
            </DialogContent>


            {/* ====== Dialog: مدیریت پروفایل‌های تنظیمات ====== */}
            <Dialog open={defaultsOpen} onClose={() => setDefaultsOpen(false)} fullWidth maxWidth="lg">
                <DialogTitle>مدیریت خط‌های تنظیمات</DialogTitle>
                <DialogContent dividers sx={{ p: 0, minHeight: '60vh', display: 'flex', flexDirection: 'column' }}>
                    {currentView === 'list' ? (
                        <Box p={3}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography variant="h6">خط‌های ذخیره‌شده</Typography>
                                <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateNewProfile}>
                                    ایجاد خط جدید
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
                                                    <Tooltip title="بارگذاری در ویرایشگر">
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
                                    هیچ خطی ذخیره نشده است. یک خط جدید بسازید.
                                </Typography>
                            )}
                        </Box>
                    ) : (
                        // --- ویرایشگر ---
                        <Box sx={{ height: 420, position: 'relative', borderRadius: 1, overflow: 'hidden' }}>


                            <MapContainer center={[35.73, 51.42]} zoom={13} minZoom={3} style={{ width: '100%', height: '100%' }}>
                                {/* مسیر و کریدور */}
                                {canRoute && routePoints.length > 1 && (
                                    <>
                                        <Polyline positions={polylineLatLngs} interactive={false} pathOptions={{ weight: 3, opacity: 0.9 }} />
                                        <Polygon positions={corridorLatLngs} interactive={false} pathOptions={{ weight: 1, opacity: 0.2 }} />
                                    </>
                                )}

                                {/* کلیک‌گیر ژئوفنس */}
                                <GfClickCatcher
                                    enabled={dfDrawing}
                                    mode={dfGfMode}
                                    setCircleCenter={(lat, lng) => setDfGfCircle(c => ({ ...c, center: { lat, lng } }))}
                                    pushPolyPoint={(lat, lng) => setDfGfPoly(prev => [...prev, { lat, lng }])}
                                />

                                {/* کلیک‌گیر مسیر */}
                                {drawingRoute && (
                                    <PickPointsDF
                                        enabled
                                        onPick={(lat, lng) => setRoutePoints(prev => [...prev, { lat, lng }])}
                                    />
                                )}
                                {/* جمع کردن نقاط چندگانه برای مسیر چندنقطه‌ای */}
                                {multiPicking && (
                                    <PickPointsDF
                                        enabled
                                        onPick={(lat, lng) => setMultiStops(prev => [...prev, { lat, lng }])}
                                    />
                                )}
                                {multiStops.map((p, i) => (
                                    <Marker key={`mw-${i}`} position={[p.lat, p.lng]}>
                                        <Popup>
                                            نقطه {i + 1}<br />
                                            {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                                        </Popup>
                                    </Marker>
                                ))}

                                {/* کلیک‌گیر ایستگاه */}
                                {addingStation && (
                                    <PickPointsDF
                                        enabled
                                        onPick={(lat, lng) => {
                                            setDfTempSt({ name: `ایستگاه ${dfAuto}`, lat, lng, radius_m: 60 });
                                            setDfAuto(a => a + 1);
                                            setAddingStation(false);
                                        }}
                                    />
                                )}
                                <RoadRoutePicker
                                    enabled={roadRoutePicking}
                                    onDone={(a, b) => {
                                        setRoadStart(a);
                                        setRoadEnd(b);
                                        fetchOsrmRoute(a, b);
                                    }}
                                />

                                {/* ✅ مارکرهای مبدأ/مقصد روی نقشهٔ دیالوگ */}
                                {roadStart && <Marker position={[roadStart.lat, roadStart.lng]} />}
                                {roadEnd && <Marker position={[roadEnd.lat, roadEnd.lng]} />}
                                {/* TileLayer (یکی کافیه) */}
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution="&copy; OpenStreetMap contributors"
                                />

                                {/* پیش‌نمایش ژئوفنس */}
                                {dfGfMode === 'circle' && dfGfCircle.center && (
                                    <Circle center={[dfGfCircle.center.lat, dfGfCircle.center.lng]} radius={dfGfCircle.radius_m} />
                                )}
                                {dfGfMode === 'polygon' && dfGfPoly.length >= 2 && (
                                    <Polygon positions={dfGfPoly.map(p => [p.lat, p.lng] as [number, number])} />
                                )}

                                {/* ایستگاه‌ها */}
                                {dfStations.map((st, i) => (
                                    <React.Fragment key={`dfst-${i}`}>
                                        <Circle center={[st.lat, st.lng]} radius={st.radius_m} />
                                        <Marker position={[st.lat, st.lng]}>
                                            <Popup>
                                                <b>{st.name}</b><br />
                                                {st.lat.toFixed(5)}, {st.lng.toFixed(5)}
                                            </Popup>
                                        </Marker>
                                    </React.Fragment>
                                ))}

                                {/* مارکر موقت ایستگاه */}
                                {dfTempSt && (
                                    <>
                                        <Circle center={[dfTempSt.lat, dfTempSt.lng]} radius={dfTempSt.radius_m} />
                                        <Marker
                                            position={[dfTempSt.lat, dfTempSt.lng]}
                                            draggable
                                            eventHandlers={{
                                                dragend: (e: any) => {
                                                    const ll = e.target.getLatLng();
                                                    setDfTempSt(s => s ? ({ ...s, lat: ll.lat, lng: ll.lng }) : s);
                                                },
                                            }}
                                        >
                                            <Popup autoClose={false} closeOnClick={false} autoPan>
                                                <div style={{ minWidth: 220 }}>
                                                    <strong>ایستگاه جدید</strong>
                                                    <div style={{ marginTop: 8 }}>
                                                        <input
                                                            style={{ width: '100%', padding: 6 }}
                                                            placeholder="نام ایستگاه"
                                                            value={dfTempSt.name}
                                                            onChange={(e) => setDfTempSt(s => s ? ({ ...s, name: e.target.value }) : s)}
                                                        />
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                                        <button onClick={() => {
                                                            if (dfTempSt) {
                                                                setDfStations(p => [...p, dfTempSt]);
                                                                setDfTempSt(null);
                                                            }
                                                        }}>تایید</button>
                                                        <button onClick={() => setDfTempSt(null)}>لغو</button>
                                                    </div>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    </>
                                )}
                            </MapContainer>
                            {/* نوار کنترل شناور */}
                            <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                sx={{
                                    position: 'absolute',
                                    zIndex: 1000,
                                    top: 8,
                                    left: 8,
                                    bgcolor: 'background.paper',
                                    p: 1,
                                    borderRadius: 1,
                                    boxShadow: 2,
                                    flexWrap: 'wrap',
                                    rowGap: 1,
                                }}
                            >
                                {/* مسیر */}
                                {false && (
                                    <>

                                        <Button
                                            size="small"
                                            variant={drawingRoute ? 'contained' : 'outlined'}
                                            onClick={() => {
                                                setDrawingRoute(v => !v);
                                                if (!drawingRoute) setRoutePoints([]); // شروع تازه
                                            }}
                                        >
                                            {drawingRoute ? 'پایان ترسیم مسیر' : 'ترسیم مسیر'}
                                        </Button>

                                        <Button
                                            size="small"
                                            variant="outlined"
                                            disabled={routePoints.length < 2}
                                            onClick={() => {
                                                console.log('ROUTE PAYLOAD →', routePayload);
                                                console.log('CORRIDOR (polygon) →', corridorLatLngs);
                                                alert('Payload مسیر و پلیگون کریدور در console آماده است.');
                                            }}
                                        >
                                            خروجی مسیر/کریدور
                                        </Button>

                                        <TextField
                                            size="small"
                                            type="number"
                                            label="عرض کریدور (m)"
                                            value={routeThreshold}
                                            onChange={(e) => setRouteThreshold(Math.max(1, Number(e.target.value || 0)))}
                                            sx={{ width: 150 }}
                                        />
                                    </>
                                )}
                                <Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />
                                {canRoute && (
                                    <>
                                        {/* حالت چندنقطه‌ای */}
                                        <Button
                                            size="small"
                                            variant={multiPicking ? 'contained' : 'outlined'}
                                            disabled={multiBusy}
                                            onClick={() => {
                                                setMultiPicking(v => !v);
                                                setDrawingRoute(false);      // جلوگیری از تداخل با ترسیم دستی
                                                setAddingStation(false);
                                            }}
                                        >
                                            {multiBusy ? '...' : (multiPicking ? 'در حال انتخاب نقاط…' : 'مسیر چندنقطه‌ای')}
                                        </Button>

                                        <Button
                                            size="small"
                                            variant="outlined"
                                            disabled={multiBusy || multiStops.length < 2}
                                            onClick={() => fetchOsrmRouteMulti(multiStops)}
                                        >
                                            محاسبه (به همین ترتیب)
                                        </Button>



                                        <Button
                                            size="small"
                                            variant="text"
                                            disabled={multiBusy && multiStops.length === 0}
                                            onClick={() => setMultiStops([])}
                                        >
                                            پاک‌کردن نقاط
                                        </Button>

                                        <Typography variant="caption" sx={{ ml: .5, opacity: .75 }}>
                                            نقاط انتخاب‌شده: {multiStops.length}
                                        </Typography>
                                        <Button size="small" onClick={() => setMultiStops(s => s.slice(0, -1))} disabled={!multiStops.length}>
                                            برگشت نقطه
                                        </Button>
                                    </>
                                )}

                                {/* ژئوفنس */}
                                {canGeofence && (
                                    <>
                                        <Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />
                                        <Button
                                            size="small"
                                            variant={dfDrawing ? 'contained' : 'outlined'}
                                            onClick={() => setDfDrawing(v => !v)}
                                        >
                                            {dfDrawing ? 'پایان ژئوفنس' : 'ترسیم ژئوفنس'}
                                        </Button>

                                        <FormControl size="small" sx={{ minWidth: 120 }}>
                                            <InputLabel id="ov-gf-mode">حالت</InputLabel>
                                            <Select
                                                labelId="ov-gf-mode"
                                                label="حالت"
                                                value={dfGfMode}
                                                onChange={(e) => {
                                                    setDfGfMode(e.target.value as 'circle' | 'polygon');
                                                    setDfGfPoly([]);
                                                    setDfGfCircle(c => ({ ...c, center: undefined }));
                                                }}
                                            >
                                                <MenuItem value="circle">دایره‌ای</MenuItem>
                                                <MenuItem value="polygon">چندضلعی</MenuItem>
                                            </Select>
                                        </FormControl>

                                        <TextField
                                            size="small"
                                            type="number"
                                            label="تلورانس (m)"
                                            value={dfGfCircle.tolerance_m}
                                            onChange={(e) => setDfGfCircle(c => ({ ...c, tolerance_m: Math.max(0, Number(e.target.value || 0)) }))}
                                            sx={{ width: 130 }}
                                        />

                                        {dfGfMode === 'circle' && (
                                            <TextField
                                                size="small"
                                                type="number"
                                                label="شعاع (m)"
                                                value={dfGfCircle.radius_m}
                                                onChange={(e) => setDfGfCircle(c => ({ ...c, radius_m: Math.max(1, Number(e.target.value || 0)) }))}
                                                sx={{ width: 120 }}
                                            />
                                        )}

                                        {dfGfMode === 'polygon' && (
                                            <Stack direction="row" spacing={1}>
                                                <Button size="small" onClick={() => setDfGfPoly(pts => pts.slice(0, -1))} disabled={!dfGfPoly.length}>
                                                    برگشت نقطه
                                                </Button>
                                                <Button size="small" onClick={() => setDfGfPoly([])} disabled={!dfGfPoly.length}>
                                                    پاک‌کردن
                                                </Button>
                                            </Stack>
                                        )}
                                    </>
                                )}

                                {/* ایستگاه */}
                                {canStation && (
                                    <>
                                        <Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />

                                        <FormControl size="small" sx={{ minWidth: 180 }}>
                                            <InputLabel id="ordering-mode">ترتیب ایستگاه‌ها</InputLabel>
                                            <Select
                                                labelId="ordering-mode"
                                                label="ترتیب ایستگاه‌ها"
                                                value={dfOrdering}
                                                onChange={(e) => setDfOrdering(e.target.value as 'free' | 'sequence')}
                                            >
                                                <MenuItem value="free">آزاد (بدون ترتیب اجباری)</MenuItem>
                                                <MenuItem value="sequence">دنباله‌ای </MenuItem>
                                            </Select>
                                        </FormControl>

                                        <FormControlLabel
                                            sx={{ ml: 1 }}
                                            control={
                                                <Checkbox checked={dfMission} onChange={(e) => setDfMission(e.target.checked)} />
                                            }
                                            label="حالت مأموریت (Mission)"
                                        />
                                        <Button
                                            size="small"
                                            variant={addingStation ? 'contained' : 'outlined'}
                                            onClick={() => setAddingStation(v => !v)}
                                        >
                                            {addingStation ? 'انتخاب روی نقشه…' : 'افزودن ایستگاه روی نقشه'}
                                        </Button>
                                        <Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />
                                        <TextField
                                            size="small"
                                            label="نام پروفایل"
                                            value={profileName}
                                            onChange={(e) => setProfileName(e.target.value)}
                                            sx={{ width: 220 }}
                                        />
                                        <Button size="small" variant="contained" onClick={handleSaveNameOnly}>
                                            ثبت
                                        </Button>
                                    </>
                                )}
                            </Stack>
                        </Box>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setDefaultsOpen(false)}>بستن</Button>
                    {currentView === 'edit' ? (
                        <>
                            <Button variant="outlined" onClick={handleSaveProfile} startIcon={<AddIcon />}>
                                {editingProfileId ? 'ذخیره تغییرات خط' : 'ذخیره خط جدید'}
                            </Button>

                        </>
                    ) : null}
                </DialogActions>
            </Dialog>
        </LocalizationProvider >
    );
}