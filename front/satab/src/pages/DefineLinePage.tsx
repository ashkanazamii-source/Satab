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

    const [vehTab, setVehTab] = React.useState<string>('all');
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

            // اگر خود کاربر SA است: ماشین‌های خودش
            if (me.role_level === 2) {
                await loadVehiclesForSA(me.id);
                return;
            }

            // اگر مدیر/اپراتور است (۳..۵): ماشین‌های SA والد
            if (me.role_level >= 3 && me.role_level <= 5) {
                const parent = await resolveParentSA(me.id);
                if (!alive) return;
                if (parent?.id) {
                    await loadVehiclesForSA(parent.id);
                } else {
                    // اگر SA والد پیدا نشد، چیزی لود نکن
                    vehiclesRef.current = [];
                }
                return;
            }

            // سایر نقش‌ها: الان نیاز نیست چیزی بیاد
            vehiclesRef.current = [];
        })();

        return () => { alive = false; };
    }, [me?.id, me?.role_level, loadVehiclesForSA, resolveParentSA]);

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
            } = (selectedProfile.settings || {}) as {
                stations?: Array<{ name?: string; lat: number; lng: number; radius_m?: number; order_no?: number }>;
                route?: null | { id?: number; name?: string; threshold_m?: number; points?: Array<{ lat: number; lng: number }> };
                geofence?: null | (
                    | { type: 'circle'; center: { lat: number; lng: number }; radius_m: number; tolerance_m?: number }
                    | { type: 'polygon'; points: Array<{ lat: number; lng: number }>; tolerance_m?: number }
                );
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
                    await api.delete(`/vehicles/${vid}/geofence`, {
                        validateStatus: s => s < 500,
                    }).catch(() => { });

                    logs.push(`🗑️ حذف‌ها انجام شد: VID ${vid}`);
                } catch (e: any) {
                    console.error(`[phase:delete] vehicle ${vid}`, e?.response?.data || e);
                    logs.push(`⚠️ خطا در حذف‌ها برای VID ${vid}: ${e?.response?.data?.message || e?.message || 'نامشخص'}`);
                }
            }

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
                    if (Array.isArray(stations) && stations.length) {
                        for (const st of stations) {
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
                        if (geofence.type === 'circle' && geofence.center && Number.isFinite(geofence.radius_m)) {
                            const payload = {
                                type: 'circle',
                                centerLat: Number(geofence.center.lat),
                                centerLng: Number(geofence.center.lng),
                                radiusM: toInt(geofence.radius_m, 1),
                                toleranceM: Math.max(0, Math.trunc(Number(geofence.tolerance_m ?? 15))),
                            };
                            await api.put(`/vehicles/${vid}/geofence`, payload, { validateStatus: s => s < 500 })
                                .catch(() => api.post(`/vehicles/${vid}/geofence`, payload, { validateStatus: s => s < 500 }).catch(() => { }));
                        } else if (geofence.type === 'polygon' && Array.isArray(geofence.points) && geofence.points.length >= 3) {
                            const payload = {
                                type: 'polygon',
                                polygonPoints: geofence.points.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) })),
                                toleranceM: Math.max(0, Math.trunc(Number(geofence.tolerance_m ?? 15))),
                            };
                            await api.put(`/vehicles/${vid}/geofence`, payload, { validateStatus: s => s < 500 })
                                .catch(() => api.post(`/vehicles/${vid}/geofence`, payload, { validateStatus: s => s < 500 }).catch(() => { }));
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
    };

    const loadProfiles = React.useCallback(async () => {
        setProfilesLoading(true);
        try {
            const { data } = await api.get('/vehicle-setting-profiles');
            setProfiles(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Failed to fetch profiles', e);
            setProfiles([]);
        } finally {
            setProfilesLoading(false);
        }
    }, []);

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
                                            هنوز پروفایلی ثبت نشده است.
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
                        </Stack>

                    </Stack>
                </Paper>
            </Box>
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
                                        const typeSet = new Set<string>();
                                        allVehicles.forEach(v => typeSet.add(String(v?.vehicle_type_code || '').toLowerCase()));
                                        const types = ['all', ...Array.from(typeSet).filter(Boolean)];

                                        const filtered =
                                            vehTab === 'all'
                                                ? allVehicles
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
                                                            label={t === 'all' ? 'همه' : vehicleTypeLabel(t)}
                                                            wrapped
                                                        />
                                                    ))}
                                                </Tabs>

                                                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {vehTab === 'all'
                                                            ? `تعداد: ${filtered.length}`
                                                            : `${vehicleTypeLabel(vehTab)} — تعداد: ${filtered.length}`}
                                                    </Typography>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                size="small"
                                                                checked={allFilteredSelected}
                                                                onChange={() => toggleSelectAll(filtered)}
                                                                disabled={!selectedProfile}
                                                            />
                                                        }
                                                        label="انتخاب همه در این تب"
                                                    />
                                                </Stack>

                                                {filtered.length ? (
                                                    <List dense disablePadding>
                                                        {filtered.map((v: any) => (
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
                                                                            </span>
                                                                        }
                                                                        primaryTypographyProps={{ sx: { fontWeight: 600 } }}
                                                                    />
                                                                    <Checkbox
                                                                        edge="end"
                                                                        disabled={!selectedProfile}
                                                                        checked={selectedVehicleIds.has(v.id)}
                                                                        onChange={() => toggleVehicle(v.id)}
                                                                    />
                                                                </ListItem>
                                                                <Divider component="li" />
                                                            </React.Fragment>
                                                        ))}
                                                    </List>
                                                ) : (
                                                    <Typography color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                                                        موردی یافت نشد.
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
                                {canRoute && (
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
        </LocalizationProvider>
    );
}