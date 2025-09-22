// src/pages/ShiftsPage.tsx
import * as React from 'react';
import {
    Box, Paper, Typography, Stack, IconButton, Button, Divider,
    TextField, MenuItem, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
    FormControlLabel, Checkbox, Snackbar, Alert, Chip, CircularProgress, InputAdornment,
    List, ListItem, ListItemText, ListItemSecondaryAction
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import DirectionsBusFilledRoundedIcon from '@mui/icons-material/DirectionsBusFilledRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import NotesRoundedIcon from '@mui/icons-material/NotesRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';

import api from '../services/api';

/** =========================
 *  Types
 *  ========================= */
type ID = number;
// ماه شمسی
type JMonthRef = { jy: number; jm: number }; // 1..12

// محاسبه‌ی تاریخ میلادی روز اول و آخرِ یک ماه شمسی، به‌صورت String YYYY-MM-DD برای API
function jMonthBoundaries(jmref: JMonthRef) {
    const { jy, jm } = jmref;
    // روز اول ماه شمسی
    const g1 = j2g(jy, jm, 1);
    const firstDate = new Date(g1.gy, g1.gm - 1, g1.gd);

    // تعداد روزهای ماه شمسی
    const jDays =
        jm <= 6 ? 31
            : jm <= 11 ? 30
                : // اسفند: 29 یا 30 (سال کبیسه‌ی جلالی)
                (isJalaliLeap(jy) ? 30 : 29);

    // روز آخر ماه شمسی
    const gLast = j2g(jy, jm, jDays);
    const lastDate = new Date(gLast.gy, gLast.gm - 1, gLast.gd);

    const toYMD = (d: Date) => `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}`;
    return { firstDate, lastDate, fromYMD: toYMD(firstDate), toYMD: toYMD(lastDate) };
}

// تشخیص کبیسه جلالی (ساده و دقیق)
function isJalaliLeap(jy: number) {
    // الگوریتم متداول: دوره‌های 33ساله
    const a = jy - (jy > 0 ? 474 : 473);
    const b = (a % 2820) + 474;
    return (((b + 38) * 682) % 2816) < 682;
}

type ShiftStatus = 'DRAFT' | 'PUBLISHED' | 'LOCKED';
type ShiftType = 'morning' | 'evening' | 'night';

type Driver = { id: ID; full_name: string; phone?: string; branch_name?: string };
type Vehicle = { id: ID; name: string; plate_no?: string };
type Station = { id: ID; name: string };
type Route = { id: ID; name: string };

type Shift = {
    id: ID;
    driver_id: ID;
    vehicle_id?: ID | null;
    route_id?: ID | null;
    station_start_id?: ID | null;
    station_end_id?: ID | null;
    /** تاریخ به صورت YYYY-MM-DD */
    date: string;
    /** HH:mm */
    start_time: string;
    /** HH:mm */
    end_time: string;
    type: ShiftType;
    note?: string;
    status: ShiftStatus;
};

type MonthRef = { y: number; m: number }; // m: 1..12

/** ابزار تاریخ ساده بدون وابستگی */
function fmt2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(d: Date) { return `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}`; }
function toDate(ymdStr: string) {
    if (!ymdStr) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymdStr);
    if (!m) return null;
    const y = +m[1], mo = +m[2], da = +m[3];
    const dt = new Date(y, mo - 1, da);
    if (Number.isNaN(dt.getTime())) return null;
    // جلوگیری از auto-correct جاوااسکریپت (مثلاً 2024-02-31 → Mar 2)
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== da) return null;
    return dt;
}

function monthGrid({ y, m }: MonthRef) {
    // برمی‌گرداند: 6x7 سلول (تاریخ یا null)
    const first = new Date(y, m - 1, 1);
    const firstDow = (first.getDay() + 6) % 7; // شنبه=0
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${fmt2(m)}-${fmt2(d)}`);
    while (cells.length % 7 !== 0) cells.push(null);
    while (cells.length < 42) cells.push(null);
    // تقسیم به ردیف‌های 7تایی
    const rows: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
}
function monthTitle({ y, m }: MonthRef) {
    const faMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    // اگر تقویم شمسی داری، اینجا جلالی کن؛ فعلاً نمای میلادی به‌صورت y/m
    return `ماه ${fmt2(m)} / ${y}`;
}

/** =========================
 *  API wrappers (قابل جایگزینی با بک‌اند واقعی)
 *  ========================= */
// 🔁 REPLACE: fetchDrivers => از my-subordinates-flat (فقط نقش ۶ + فیلتر q محلی)
async function fetchDrivers(q: string): Promise<Driver[]> {
    // همهٔ زیردست‌های کاربر جاری
    const { data } = await api.get('/users/my-subordinates-flat', {
        validateStatus: s => s < 500,
    }).catch(() => ({ data: [] }));

    const all: FlatUser[] = Array.isArray(data) ? data : [];
    // فقط راننده‌ها
    let drivers = all.filter(u => Number(u.role_level) === 6);

    // فیلتر جستجو روی فرانت (نام/تلفن)
    const needle = (q || '').trim().toLowerCase();
    if (needle) {
        drivers = drivers.filter(d =>
            (d.full_name || '').toLowerCase().includes(needle) ||
            (d.phone || '').includes(needle)
        );
    }

    // نگاشت به Driver
    return drivers.map(d => ({
        id: Number(d.id),
        full_name: String(d.full_name || '').trim(),
        phone: d.phone || undefined,
        branch_name: d.branch_name || undefined,
    }));
}

async function fetchVehicles(): Promise<Vehicle[]> {
    const res = await api.get('/vehicles', { params: { limit: 200 } });
    return res.data ?? [];
}
async function fetchStations(): Promise<Station[]> {
    const res = await api.get('/stations', { params: { limit: 200 } });
    return res.data ?? [];
}
async function fetchRoutes(): Promise<Route[]> {
    const res = await api.get('/routes', { params: { limit: 200 } });
    return res.data ?? [];
}
async function fetchShifts(driverId: ID, from: string, to: string): Promise<Shift[]> {
    const res = await api.get('/shifts', { params: { driverId, from, to } });
    return res.data ?? [];
}
async function createShift(payload: Omit<Shift, 'id' | 'status'> & { status?: ShiftStatus }): Promise<Shift> {
    const res = await api.post('/shifts', payload);
    return res.data;
}
async function updateShift(id: ID, payload: Partial<Shift>): Promise<Shift> {
    const res = await api.put(`/shifts/${id}`, payload);
    return res.data;
}
async function deleteShift(id: ID): Promise<void> {
    await api.delete(`/shifts/${id}`);
}
async function publishShift(id: ID): Promise<Shift> {
    const res = await api.post(`/shifts/${id}/publish`, {});
    return res.data;
}
async function lockShift(id: ID): Promise<Shift> {
    const res = await api.post(`/shifts/${id}/lock`, {});
    return res.data;
}
function jMonthGrid(jmref: JMonthRef): (string | null)[][] {
    const { jy, jm } = jmref;

    // روز اول ماه شمسی → میلادی
    const g1 = j2g(jy, jm, 1);
    const firstG = new Date(g1.gy, g1.gm - 1, g1.gd);

    // شنبه=0
    const firstDow = (firstG.getDay() + 6) % 7;

    // طول ماه شمسی
    const jDays =
        jm <= 6 ? 31 :
            jm <= 11 ? 30 :
                (isJalaliLeap(jy) ? 30 : 29);

    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);

    for (let d = 1; d <= jDays; d++) {
        const g = j2g(jy, jm, d);
        const ymdStr = `${g.gy}-${fmt2(g.gm)}-${fmt2(g.gd)}`; // میلادی برای API
        cells.push(ymdStr);
    }

    while (cells.length % 7 !== 0) cells.push(null);
    while (cells.length < 42) cells.push(null);

    const rows: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
}

/** "YYYY-MM-DD" میلادی → شماره روز شمسی (۱..۳۱) */
function gYmdToJDay(ymdStr: string): number {
    const [gy, gm, gd] = ymdStr.split('-').map(Number);
    const { jd } = g2j(gy, gm, gd);
    return jd;
}
// اگر قبلاً تعریف نکردی:
type FlatUser = {
    id: number;
    full_name?: string;
    phone?: string;
    branch_name?: string;
    role_level?: number;
    parent_id?: number | null;
};

const mapDriverSafe = (u: FlatUser) => ({
    id: Number(u.id),
    full_name: String(u.full_name || '').trim(),
    phone: u.phone || undefined,
    branch_name: u.branch_name || undefined,
});

/** =========================
 *  Component
 *  ========================= */
export default function ShiftsPage() {
    const today = new Date();
    const jToday = g2j(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const [jmonth, setJmonth] = React.useState<JMonthRef>({ jy: jToday.jy, jm: jToday.jm });
    function addDaysYMD(ymdStr: string, days: number) {
        const [y, m, d] = ymdStr.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dt.setDate(dt.getDate() + days);
        return `${dt.getFullYear()}-${fmt2(dt.getMonth() + 1)}-${fmt2(dt.getDate())}`;
    }
    // تنظیمات تکثیر (m راننده × تاریخ‌های دلخواه)
    const [bulk, setBulk] = React.useState<{
        extraDriverIds: ID[];
        dates: string[]; // تاریخ‌های میلادی "YYYY-MM-DD"
    }>({
        extraDriverIds: [],
        dates: [],
    });


    const [drivers, setDrivers] = React.useState<Driver[]>([]);
    const [driverQ, setDriverQ] = React.useState('');
    const [driverId, setDriverId] = React.useState<ID | ''>('');
    const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
    const [stations, setStations] = React.useState<Station[]>([]);
    const [routes, setRoutes] = React.useState<Route[]>([]);
    const [shifts, setShifts] = React.useState<Shift[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [snack, setSnack] = React.useState<{ open: boolean; msg: string; sev: 'success' | 'error' | 'info' }>({ open: false, msg: '', sev: 'success' });
    const [me, setMe] = React.useState<User | null>(null);

    function findTopSuperAdmin(userId: number | null | undefined, byId: Record<number, FlatUser>): number | null {
        let cursor = (userId != null) ? byId[userId] : undefined;
        let steps = 0;
        while (cursor && steps < 1000) {
            if (cursor.role_level === 2) return cursor.id;
            const pid = cursor.parent_id ?? null;
            cursor = (pid != null) ? byId[pid] : undefined;
            steps++;
        }
        return null;
    }
    React.useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const { data } = await api.get('/auth/me');
                if (!alive) return;
                setMe({
                    id: Number(data?.id),
                    role_level: Number(data?.role_level ?? data?.roleLevel ?? 0),
                    full_name: data?.full_name ?? data?.name,
                });
            } catch {
                if (!alive) return;
                setMe(null);
            }
        })();
        return () => { alive = false; };
    }, []);
    // جستجوی راننده‌ها بر اساس SA هدف (مثل DefineLinePage)
    // راننده‌ها را از /users/my-subordinates-flat بگیر و روی نام/تلفن فیلتر کن
    React.useEffect(() => {
        let alive = true;

        (async () => {
            try {
                const { data } = await api.get('/users/my-subordinates-flat', {
                    validateStatus: s => s < 500,
                }).catch(() => ({ data: [] }));

                if (!alive) return;

                const all: FlatUser[] = Array.isArray(data) ? data : [];
                // فقط نقش ۶ = راننده
                let list = all.filter(u => Number(u.role_level) === 6).map(mapDriverSafe);

                // فیلتر جستجو (نام/تلفن)
                const q = (driverQ || '').trim().toLowerCase();
                if (q) {
                    list = list.filter(d =>
                        (d.full_name || '').toLowerCase().includes(q) ||
                        (d.phone || '').includes(q)
                    );
                }

                setDrivers(list);

                // اگر راننده انتخاب‌شده دیگر در لیست نبود، انتخاب را پاک کن
                if (driverId && !list.some(d => d.id === driverId)) {
                    setDriverId('');
                }
            } catch {
                if (!alive) return;
                setDrivers([]);
            }
        })();

        return () => { alive = false; };
    }, [driverQ]);  // ← هر بار جستجو عوض شد، همین لیست را محلی فیلتر می‌کنیم


    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<Shift | null>(null);
    const [draft, setDraft] = React.useState<Omit<Shift, 'id'>>({
        driver_id: 0, vehicle_id: null, route_id: null, station_start_id: null, station_end_id: null,
        date: ymd(today), start_time: '08:00', end_time: '16:00', type: 'morning', note: '', status: 'DRAFT'
    });
    function JalaliDateInput({
        label,
        valueYMD,
        onChangeYMD,
        placeholder = 'YYYY-MM-DD (شمسی)'
    }: {
        label: string;
        valueYMD: string;              // میلادی "YYYY-MM-DD" (state فعلی draft.date)
        onChangeYMD: (ymd: string) => void; // میلادی "YYYY-MM-DD"
        placeholder?: string;
    }) {
        // نمایش در input به‌صورت "YYYY-MM-DD" جلالی
        const d = toDate(valueYMD);
        const [text, setText] = React.useState(d ? dateToJYMD(d) : '');

        React.useEffect(() => {
            const nd = toDate(valueYMD);
            setText(nd ? dateToJYMD(nd) : '');
        }, [valueYMD]);

        const handleBlur = () => {
            if (!text.trim()) { onChangeYMD(''); return; }
            const g = jymdToDate(text);
            if (g && !Number.isNaN(+g)) {
                const ymdStr = `${g.getFullYear()}-${fmt2(g.getMonth() + 1)}-${fmt2(g.getDate())}`;
                onChangeYMD(ymdStr);
            } else {
                // نامعتبر → برگرد به مقدار قبلی
                const nd = toDate(valueYMD);
                setText(nd ? dateToJYMD(nd) : '');
            }
        };

        return (
            <TextField
                label={label}
                size="small"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={handleBlur}
                placeholder={placeholder}
                helperText={d ? fmtJalali(d) : ' '}
                InputLabelProps={{ shrink: true }}
                InputProps={{ inputProps: { inputMode: 'numeric', pattern: '\\d{4}-\\d{2}-\\d{2}' } }}
            />
        );
    }
    // === User type (برای تشخیص نقش) ===
    type User = { id: number; role_level: number; full_name?: string };

    // === پیدا کردن SA والد دقیقاً مثل DefineLinePage ===
    const resolveParentSA = async (uid: number) => {
        try {
            const { data: rows } = await api.get(`/vehicle-policies/user/${uid}`, { params: { onlyAllowed: true } });
            const idSet = new Set<number>();
            (rows || []).forEach((r: any) => {
                [r.owner_user_id, r.ownerId, r.super_admin_user_id, r.superAdminUserId, r.grantor_user_id, r.grantorUserId]
                    .map((x: any) => Number(x))
                    .filter(Boolean)
                    .forEach((n: number) => idSet.add(n));
            });
            for (const oid of idSet) {
                const { data: test } = await api.get('/vehicles', { params: { owner_user_id: String(oid), limit: 1 } })
                    .catch(() => ({ data: { items: [] } }));
                const items = Array.isArray(test?.items) ? test.items : (Array.isArray(test) ? test : []);
                if (items.length) return { id: oid };
            }
        } catch { }
        try {
            const { data } = await api.get('/users/my-ancestor', { params: { level: 2 } });
            if (data?.id) return { id: Number(data.id) };
        } catch { }
        return null;
    };

    // === Mapper امن برای Driver ===
    function mapDriver(raw: any): Driver {
        return {
            id: Number(raw?.id),
            full_name: String(raw?.full_name ?? raw?.name ?? '').trim(),
            phone: raw?.phone ?? raw?.mobile ?? raw?.tel ?? undefined,
            branch_name: raw?.branch_name ?? raw?.branchName ?? undefined,
        };
    }

    // 🔁 REPLACE: گرفتن راننده‌های دامنهٔ یک SA از my-subordinates-flat
    async function fetchDriversForSA(saId: number, q: string): Promise<Driver[]> {
        const { data } = await api.get('/users/my-subordinates-flat', {
            validateStatus: s => s < 500,
        }).catch(() => ({ data: [] }));

        const all: FlatUser[] = Array.isArray(data) ? data : [];
        const byId: Record<number, FlatUser> = {};
        all.forEach(u => { if (u && Number.isFinite(Number(u.id))) byId[Number(u.id)] = u; });

        // فقط راننده‌ها
        let drivers = all.filter(u => Number(u.role_level) === 6);

        // فقط راننده‌هایی که سوپرادمینِ بالادستی‌شان = saId است
        drivers = drivers.filter(d => {
            const top = findTopSuperAdmin(d.parent_id ?? null, byId);
            return top === saId;
        });

        // فیلتر متن جستجو
        const needle = (q || '').trim().toLowerCase();
        if (needle) {
            drivers = drivers.filter(d =>
                (d.full_name || '').toLowerCase().includes(needle) ||
                (d.phone || '').includes(needle)
            );
        }

        // نگاشت به Driver
        return drivers.map(mapDriver);
    }

    const { firstDate, lastDate, fromYMD: monthFrom, toYMD: monthTo } = jMonthBoundaries(jmonth);
    /** 6×7 سلول: هر سلول یا null یا "YYYY-MM-DD" میلادی */



    /** load support lists */
    React.useEffect(() => {
        let ok = true;
        (async () => {
            try {
                const [v, s, r] = await Promise.all([fetchVehicles(), fetchStations(), fetchRoutes()]);
                if (!ok) return;
                setVehicles(v); setStations(s); setRoutes(r);
            } catch (e: any) {
                setSnack({ open: true, sev: 'error', msg: 'خطا در بارگذاری داده‌های پشتیبان' });
            }
        })();
        return () => { ok = false; };
    }, []);

    /** load shifts */
    React.useEffect(() => {
        if (!driverId) { setShifts([]); return; }
        let ok = true;
        (async () => {
            setLoading(true);
            try {
                const list = await fetchShifts(driverId as ID, monthFrom, monthTo);
                if (!ok) return;
                setShifts(list);
            } catch {
                setSnack({ open: true, sev: 'error', msg: 'خطا در دریافت شیفت‌ها' });
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [driverId, jmonth.jy, jmonth.jm]);

    const byDate = React.useMemo(() => {
        const map = new Map<string, Shift[]>();
        for (const sh of shifts) {
            if (!map.has(sh.date)) map.set(sh.date, []);
            map.get(sh.date)!.push(sh);
        }
        return map;
    }, [shifts]);

    /** helpers */
    const openCreate = (date?: string) => {
        if (!driverId) { setSnack({ open: true, sev: 'info', msg: 'لطفاً ابتدا راننده را انتخاب کنید' }); return; }
        setEditing(null);
        setDraft({
            driver_id: driverId as ID,
            vehicle_id: null,
            route_id: null,
            station_start_id: null,
            station_end_id: null,
            date: date ?? monthFrom,
            start_time: '08:00',
            end_time: '16:00',
            type: 'morning',
            note: '',
            status: 'DRAFT',
        });
        setBulk({ extraDriverIds: [], dates: date ? [date] : [monthFrom] });
        setDialogOpen(true);
    };

    const openEdit = (s: Shift) => {
        setEditing(s);
        setDraft({ ...s });
        setDialogOpen(true);
    };

    const onSave = async () => {
        try {
            // اعتبارسنجی
            if (!draft.driver_id) throw new Error('راننده نامعتبر است');
            if (!draft.date) throw new Error('تاریخ نامعتبر است');
            if (!draft.start_time || !draft.end_time) throw new Error('ساعت شروع/پایان را وارد کنید');
            const start = Number(draft.start_time.replace(':', ''));
            const end = Number(draft.end_time.replace(':', ''));
            if (end <= start) throw new Error('ساعت پایان باید بعد از ساعت شروع باشد');

            // ویرایش: تکثیر نداریم
            if (editing) {
                const updated = await updateShift(editing.id, { ...draft });
                setShifts(prev => prev.map(x => x.id === editing.id ? updated : x));
                setSnack({ open: true, sev: 'success', msg: 'شیفت ویرایش شد' });
                setDialogOpen(false);
                return;
            }

            // ایجاد: m راننده × تاریخ‌های دلخواه
            const targetDates = (bulk.dates && bulk.dates.length) ? uniq(sortYmdAsc(bulk.dates)) : [draft.date];
            const driverIds = uniq<ID>([draft.driver_id, ...bulk.extraDriverIds].filter(Boolean) as ID[]);

            const payloads = [];
            for (const did of driverIds) {
                for (const dt of targetDates) {
                    payloads.push({ ...draft, driver_id: did, date: dt });
                }
            }

            const results = await Promise.allSettled(payloads.map(p => createShift(p)));

            const successes: Shift[] = [];
            let failures = 0;
            results.forEach(r => {
                if (r.status === 'fulfilled') successes.push(r.value);
                else failures++;
            });

            if (successes.length) setShifts(prev => [...prev, ...successes]);

            if (failures && successes.length) {
                setSnack({ open: true, sev: 'info', msg: `بخشاً موفق: ${successes.length} ثبت شد، ${failures} مورد خطا داشت` });
            } else if (failures && !successes.length) {
                setSnack({ open: true, sev: 'error', msg: `ثبت ناموفق بود (${failures} مورد)` });
            } else {
                setSnack({ open: true, sev: 'success', msg: `${successes.length} شیفت ثبت شد` });
            }

            setDialogOpen(false);
        } catch (e: any) {
            setSnack({ open: true, sev: 'error', msg: e?.message ?? 'خطا در ذخیره شیفت' });
        }
    };


    const onDelete = async (s: Shift) => {
        if (!window.confirm('حذف این شیفت؟')) return;
        try {
            await deleteShift(s.id);
            setShifts(prev => prev.filter(x => x.id !== s.id));
            setSnack({ open: true, sev: 'success', msg: 'شیفت حذف شد' });
        } catch {
            setSnack({ open: true, sev: 'error', msg: 'حذف ناموفق بود' });
        }
    };

    const onPublish = async (s: Shift) => {
        try {
            const res = await publishShift(s.id);
            setShifts(prev => prev.map(x => x.id === s.id ? res : x));
            setSnack({ open: true, sev: 'success', msg: 'شیفت منتشر شد (اطلاع به راننده ارسال می‌شود)' });
        } catch {
            setSnack({ open: true, sev: 'error', msg: 'انتشار ناموفق' });
        }
    };

    const onLock = async (s: Shift) => {
        try {
            const res = await lockShift(s.id);
            setShifts(prev => prev.map(x => x.id === s.id ? res : x));
            setSnack({ open: true, sev: 'success', msg: 'شیفت قفل شد' });
        } catch {
            setSnack({ open: true, sev: 'error', msg: 'قفل‌کردن ناموفق' });
        }
    };
    const rows: (string | null)[][] = jMonthGrid(jmonth);

    /** رندر */
    return (
        <Box sx={{ p: 2, direction: 'rtl' }}>
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="h5" fontWeight={900}>مدیریت شیفت رانندگان</Typography>
                    <Tooltip title="راهنما">
                        <InfoOutlinedIcon fontSize="small" />
                    </Tooltip>
                </Stack>

                <Stack direction="row" spacing={1}>
                    <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => {
                        if (driverId) {
                            setLoading(true);
                            fetchShifts(driverId as ID, monthFrom, monthTo).then(setShifts).finally(() => setLoading(false));
                        }
                    }}>
                        بروزرسانی
                    </Button>
                    <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openCreate()}>
                        افزودن شیفت
                    </Button>
                </Stack>
            </Stack>

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                    <TextField
                        label="جستجوی راننده"
                        placeholder="نام/تلفن..."
                        value={driverQ}
                        onChange={(e) => setDriverQ(e.target.value)}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <SearchRoundedIcon fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ width: { xs: '100%', md: 260 } }}
                    />

                    <TextField
                        select
                        label="راننده (دامنهٔ سوپرادمین)"
                        value={driverId}
                        onChange={(e) => setDriverId(Number(e.target.value))}
                        sx={{ minWidth: 280 }}
                        helperText={drivers.length ? `${drivers.length} راننده یافت شد` : 'راننده‌ای در دامنهٔ سوپرادمین پیدا نشد'}
                    >
                        {drivers.length === 0 ? (
                            <MenuItem value="" disabled>— موردی نیست —</MenuItem>
                        ) : (
                            drivers.map((d) => (
                                <MenuItem key={d.id} value={d.id}>
                                    {d.full_name}{d.branch_name ? ` — ${d.branch_name}` : ''}{d.phone ? ` — ${d.phone}` : ''}
                                </MenuItem>
                            ))
                        )}
                    </TextField>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto' }}>
                        <IconButton
                            onClick={() =>
                                setJmonth((j) => ({
                                    jy: j.jm === 1 ? j.jy - 1 : j.jy,
                                    jm: j.jm === 1 ? 12 : j.jm - 1,
                                }))
                            }
                        >
                            <ChevronRightRoundedIcon />
                        </IconButton>

                        <Chip
                            icon={<TodayRoundedIcon />}
                            label={fmtJalali(firstDate, { year: 'numeric', month: 'long' })} // مثل «مهر ۱۴۰۴»
                        />

                        <IconButton
                            onClick={() =>
                                setJmonth((j) => ({
                                    jy: j.jm === 12 ? j.jy + 1 : j.jy,
                                    jm: j.jm === 12 ? 1 : j.jm + 1,
                                }))
                            }
                        >
                            <ChevronLeftRoundedIcon />
                        </IconButton>
                    </Stack>
                </Stack>
            </Paper>


            {/* Main */}
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
                {/* Calendar */}
                <Paper sx={{ p: 2, flex: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="h6" fontWeight={800}>تقویم ماهانهٔ شیفت‌ها</Typography>
                        <Typography variant="body2" color="text.secondary">
                            بازه: {fmtJalali(firstDate)} تا {fmtJalali(lastDate)} {loading && <CircularProgress size={16} sx={{ ml: 1 }} />}
                        </Typography>

                    </Stack>
                    <Divider sx={{ mb: 1 }} />
                    <CalendarMonth
                        jmonth={jmonth}
                        byDate={byDate}
                        onCellClick={(date) => openCreate(date)}
                        onShiftClick={(s) => openEdit(s)}
                    />

                </Paper>

                {/* Right panel: list of shifts in month */}
                <Paper sx={{ p: 2, width: { xs: '100%', lg: 380 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="h6" fontWeight={800}>لیست شیفت‌های ماه</Typography>
                        <Typography variant="caption" color="text.secondary">{shifts.length} مورد</Typography>
                    </Stack>
                    <Divider sx={{ mb: 1 }} />
                    <List dense sx={{ maxHeight: 520, overflow: 'auto' }}>
                        {shifts.length === 0 && (
                            <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
                                برای مشاهده لیست، راننده را انتخاب کنید یا شیفت جدید اضافه کنید.
                            </Typography>
                        )}
                        {shifts
                            .slice()
                            .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
                            .map((s: Shift) => (
                                <ListItem key={s.id} sx={{ borderBottom: '1px dashed', borderColor: 'divider' }} button onClick={() => openEdit(s)}>
                                    <ListItemText
                                        primary={
                                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Chip size="small" label={fmtJalali(toDate(s.date))} variant="outlined" />
                                                    <Chip size="small" icon={<AccessTimeRoundedIcon />} label={`${s.start_time}–${s.end_time}`} />
                                                    <Chip size="small" label={labelShiftType(s.type)} />
                                                </Stack>
                                                <Stack direction="row" spacing={0.5} alignItems="center">
                                                    {s.status === 'DRAFT' && <Chip size="small" label="پیش‌نویس" />}
                                                    {s.status === 'PUBLISHED' && <Chip size="small" color="info" label="منتشر" />}
                                                    {s.status === 'LOCKED' && <Chip size="small" color="warning" label="قفل" />}
                                                </Stack>
                                            </Stack>
                                        }
                                        secondary={
                                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: .5 }}>
                                                {!!s.vehicle_id && <Chip size="small" icon={<DirectionsBusFilledRoundedIcon />} label={vehicleName(vehicles, s.vehicle_id)} />}
                                                {!!s.route_id && <Chip size="small" icon={<MapRoundedIcon />} label={routeName(routes, s.route_id)} />}
                                                {!!s.note && <Chip size="small" icon={<NotesRoundedIcon />} label="یادداشت" />}
                                            </Stack>
                                        }
                                    />
                                    <ListItemSecondaryAction>
                                        <Tooltip title="ویرایش">
                                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(s); }}>
                                                <EditRoundedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="انتشار">
                                            <span>
                                                <IconButton size="small" disabled={s.status !== 'DRAFT'} onClick={(e) => { e.stopPropagation(); onPublish(s); }}>
                                                    <PublishRoundedIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                        <Tooltip title="قفل">
                                            <span>
                                                <IconButton size="small" disabled={s.status !== 'PUBLISHED'} onClick={(e) => { e.stopPropagation(); onLock(s); }}>
                                                    <LockRoundedIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                        <Tooltip title="حذف">
                                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(s); }}>
                                                <DeleteRoundedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                    </List>
                </Paper>
            </Stack>

            {/* Dialog: create/edit */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
                <DialogTitle sx={{ fontWeight: 900 }}>{editing ? 'ویرایش شیفت' : 'افزودن شیفت'}</DialogTitle>
                <DialogContent dividers>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <Stack flex={1} spacing={2}>
                            <JalaliDateInput
                                label="تاریخ (شمسی)"
                                valueYMD={draft.date}
                                onChangeYMD={(ymd) => setDraft({ ...draft, date: ymd })}
                            />

                            <Stack direction="row" spacing={2}>
                                <TextField
                                    label="شروع"
                                    type="time"
                                    value={draft.start_time}
                                    onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
                                    InputLabelProps={{ shrink: true }}
                                />
                                <TextField
                                    label="پایان"
                                    type="time"
                                    value={draft.end_time}
                                    onChange={(e) => setDraft({ ...draft, end_time: e.target.value })}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Stack>
                            <TextField
                                select
                                label="نوع شیفت"
                                value={draft.type}
                                onChange={(e) => setDraft({ ...draft, type: e.target.value as ShiftType })}
                            >
                                <MenuItem value="morning">صبح</MenuItem>
                                <MenuItem value="evening">عصر</MenuItem>
                                <MenuItem value="night">شب</MenuItem>
                            </TextField>
                            <TextField
                                multiline
                                minRows={3}
                                label="یادداشت"
                                placeholder="توضیحات سرپرست..."
                                value={draft.note ?? ''}
                                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                            />
                        </Stack>

                        <Divider orientation="vertical" flexItem />

                        <Stack flex={1} spacing={2}>
                            <TextField
                                select
                                label="وسیله (اختیاری)"
                                value={draft.vehicle_id ?? ''}
                                onChange={(e) => setDraft({ ...draft, vehicle_id: e.target.value === '' ? null : Number(e.target.value) })}
                            >
                                <MenuItem value="">—</MenuItem>
                                {vehicles.map(v => <MenuItem key={v.id} value={v.id}>{v.name}{v.plate_no ? ` — ${v.plate_no}` : ''}</MenuItem>)}
                            </TextField>

                            <TextField
                                select
                                label="مسیر (اختیاری)"
                                value={draft.route_id ?? ''}
                                onChange={(e) => setDraft({ ...draft, route_id: e.target.value === '' ? null : Number(e.target.value) })}
                            >
                                <MenuItem value="">—</MenuItem>
                                {routes.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                            </TextField>

                            <Stack direction="row" spacing={2}>
                                <TextField
                                    select
                                    label="ایستگاه شروع (اختیاری)"
                                    value={draft.station_start_id ?? ''}
                                    onChange={(e) => setDraft({ ...draft, station_start_id: e.target.value === '' ? null : Number(e.target.value) })}
                                    sx={{ flex: 1 }}
                                >
                                    <MenuItem value="">—</MenuItem>
                                    {stations.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                                </TextField>
                                <TextField
                                    select
                                    label="ایستگاه پایان (اختیاری)"
                                    value={draft.station_end_id ?? ''}
                                    onChange={(e) => setDraft({ ...draft, station_end_id: e.target.value === '' ? null : Number(e.target.value) })}
                                    sx={{ flex: 1 }}
                                >
                                    <MenuItem value="">—</MenuItem>
                                    {stations.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                                </TextField>
                            </Stack>

                            <Stack direction="row" spacing={2} alignItems="center">
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={draft.status !== 'DRAFT'}
                                            onChange={(e) => setDraft({ ...draft, status: e.target.checked ? 'PUBLISHED' : 'DRAFT' })}
                                        />
                                    }
                                    label="انتشار هم‌زمان (اطلاع به راننده)"
                                />
                                {editing && (
                                    <Chip
                                        icon={<DoneAllRoundedIcon />}
                                        label={`وضعیت فعلی: ${labelStatus(editing.status)}`}
                                        size="small"
                                    />
                                )}
                            </Stack>
                        </Stack>
                    </Stack>
                    <Divider sx={{ my: 1 }} />

                    {/* کنترل‌های سریع */}
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <Button
                            size="small"
                            onClick={() => {
                                const all = (rows.flat().filter(Boolean) as string[]);
                                setBulk(b => ({ ...b, dates: uniq(sortYmdAsc([...b.dates, ...all])) }));
                            }}
                        >
                            انتخاب همهٔ ماه
                        </Button>
                        <Button
                            size="small"
                            onClick={() => setBulk(b => ({ ...b, dates: [] }))}
                        >
                            پاک‌کردن انتخاب‌ها
                        </Button>
                    </Stack>

                    {/* شبکهٔ روزهای ماه با تیک */}
                    <Stack spacing={1} sx={{ mb: 1 }}>
                        {rows.map((row: (string | null)[], ri: number) => (
                            <Stack key={ri} direction="row" spacing={1}>
                                {row.map((cell: string | null, ci: number) => {
                                    const selected = !!cell && bulk.dates.includes(cell);
                                    return (
                                        <Paper
                                            key={ci}
                                            variant="outlined"
                                            sx={{
                                                flex: 1,
                                                p: .5,
                                                minHeight: 56,
                                                opacity: cell ? 1 : 0.4,
                                            }}
                                        >
                                            {cell ? (
                                                <FormControlLabel
                                                    sx={{ m: 0, width: '100%' }}
                                                    control={
                                                        <Checkbox
                                                            checked={selected}
                                                            onChange={() => {
                                                                setBulk(b => {
                                                                    const exists = b.dates.includes(cell);
                                                                    const dates = exists
                                                                        ? b.dates.filter(x => x !== cell)
                                                                        : uniq(sortYmdAsc([...b.dates, cell]));
                                                                    return { ...b, dates };
                                                                });
                                                            }}
                                                            size="small"
                                                        />
                                                    }
                                                    label={
                                                        <Stack direction="row" justifyContent="space-between" sx={{ width: '100%' }}>
                                                            <Typography variant="body2">{fmtJalali(toDate(cell))}</Typography>
                                                            <Typography variant="caption" color="text.secondary">روز {gYmdToJDay(cell)}</Typography>
                                                        </Stack>
                                                    }
                                                />
                                            ) : null}
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        ))}
                    </Stack>

                    {/* نمایش «چیپ»ها برای تاریخ‌های انتخاب‌شده + امکان حذف سریع */}
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        {(bulk.dates.length ? sortYmdAsc(bulk.dates) : []).map(d => (
                            <Chip
                                key={d}
                                label={fmtJalali(toDate(d))}
                                onDelete={() => setBulk(b => ({ ...b, dates: b.dates.filter(x => x !== d) }))}
                                variant="outlined"
                                sx={{ mb: 1 }}
                            />
                        ))}
                    </Stack>

                    <Typography variant="caption" color="text.secondary">
                        اگر خالی باشد، فقط تاریخ اصلیِ فرم («{fmtJalali(toDate(draft.date))}») ثبت می‌شود.
                    </Typography>

                    <Divider sx={{ my: 1 }} />

                    <Typography variant="subtitle2" fontWeight={800}>اعمال برای رانندگان دیگر</Typography>
                    <TextField
                        select
                        SelectProps={{ multiple: true }}
                        label="رانندگان اضافه (اختیاری)"
                        value={bulk.extraDriverIds}
                        onChange={(e) => {
                            const value = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                            setBulk((b) => ({ ...b, extraDriverIds: uniq(value.map(Number)) }));
                        }}
                        helperText="در صورت خالی بودن، فقط برای راننده انتخاب‌شده ثبت می‌شود"
                    >
                        {drivers
                            .filter(d => d.id !== (draft.driver_id || driverId))
                            .map(d => (
                                <MenuItem key={d.id} value={d.id}>
                                    {d.full_name}{d.branch_name ? ` — ${d.branch_name}` : ''}{d.phone ? ` — ${d.phone}` : ''}
                                </MenuItem>
                            ))}
                    </TextField>


                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>بستن</Button>
                    <Button variant="contained" onClick={onSave} startIcon={<AddRoundedIcon />}>
                        {editing ? 'ذخیره تغییرات' : 'افزودن شیفت'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snack */}
            <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))}>
                <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.sev} variant="filled">
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}

/** =========================
 *  Subcomponents
 *  ========================= */

function CalendarMonth(props: {
    jmonth: JMonthRef;
    byDate: Map<string, Shift[]>;
    onCellClick: (date: string) => void;
    onShiftClick: (s: Shift) => void;
}) {
    const { jmonth, byDate, onCellClick, onShiftClick } = props;
    const rows = jMonthGrid(jmonth);
    const weekDays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

    return (
        <Box sx={{ direction: 'rtl' }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                {weekDays.map((w, i) => (
                    <Box key={i} sx={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>{w}</Box>
                ))}
            </Stack>

            <Stack spacing={1}>
                {rows.map((row: (string | null)[], ri: number) => (
                    <Stack key={ri} direction="row" spacing={1}>
                        {row.map((cell: string | null, ci: number) => (
                            <Paper
                                key={ci}
                                variant="outlined"
                                sx={{
                                    flex: 1,
                                    minHeight: 110,
                                    p: 1,
                                    cursor: cell ? 'pointer' : 'default',
                                    opacity: cell ? 1 : 0.5,
                                }}
                                onClick={() => cell && onCellClick(cell)} // cell = Y-M-D میلادی
                            >
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle2" fontWeight={800}>
                                        {cell ? gYmdToJDay(cell) : ''}
                                    </Typography>
                                </Stack>

                                <Stack spacing={0.5} sx={{ mt: 1 }}>
                                    {cell ? (byDate.get(cell) ?? []).slice(0, 3).map((s: Shift) => (
                                        <Chip
                                            key={s.id}
                                            size="small"
                                            label={`${labelShiftType(s.type)} • ${s.start_time}–${s.end_time}`}
                                            onClick={(e) => { e.stopPropagation(); onShiftClick(s); }}
                                            color={chipColorByStatus(s.status)}
                                        />
                                    )) : null}
                                    {cell && (byDate.get(cell)?.length ?? 0) > 3 && (
                                        <Typography variant="caption" color="text.secondary">
                                            +{(byDate.get(cell)?.length ?? 0) - 3} شیفت دیگر
                                        </Typography>
                                    )}
                                </Stack>
                            </Paper>
                        ))}
                    </Stack>
                ))}
            </Stack>
        </Box>
    );
}


/** =========================
 *  Utils
 *  ========================= */
function vehicleName(list: Vehicle[], id?: ID | null) {
    if (!id) return '';
    const v = list.find(x => x.id === id);
    return v ? (v.plate_no ? `${v.name} — ${v.plate_no}` : v.name) : '';
}
function routeName(list: Route[], id?: ID | null) {
    if (!id) return '';
    const r = list.find(x => x.id === id);
    return r ? r.name : '';
}
function labelShiftType(t: ShiftType) {
    switch (t) {
        case 'morning': return 'صبح';
        case 'evening': return 'عصر';
        case 'night': return 'شب';
    }
}
function labelStatus(s: ShiftStatus) {
    switch (s) {
        case 'DRAFT': return 'پیش‌نویس';
        case 'PUBLISHED': return 'منتشر';
        case 'LOCKED': return 'قفل';
    }
}
function chipColorByStatus(s: ShiftStatus): any {
    switch (s) {
        case 'DRAFT': return 'default';
        case 'PUBLISHED': return 'info';
        case 'LOCKED': return 'warning';
    }
}




























/** =========================
 *  Jalali (Persian) Date Utils — no deps
 *  ========================= */
// floor div
const _div = (a: number, b: number) => Math.floor(a / b);

/** میلادی ← جلالی */
function g2j(gy: number, gm: number, gd: number) {
    // gm: 1..12
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? gy + 1 : gy;
    let days = 365 * gy + _div(gy2 + 3, 4) - _div(gy2 + 99, 100) + _div(gy2 + 399, 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * _div(days, 12053); days %= 12053;
    jy += 4 * _div(days, 1461); days %= 1461;
    if (days > 365) { jy += _div(days - 1, 365); days = (days - 1) % 365; }
    const jm = (days < 186) ? 1 + _div(days, 31) : 7 + _div(days - 186, 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { jy, jm, jd };
}

/** جلالی ← میلادی */
function j2g(jy: number, jm: number, jd: number) {
    let gy = (jy > 979) ? 1600 : 621;
    jy = (jy > 979) ? jy - 979 : jy;
    let days = 365 * jy + _div(jy, 33) * 8 + _div((jy % 33) + 3, 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
    gy += 400 * _div(days, 146097); days %= 146097;
    if (days > 36524) {
        gy += 100 * _div(--days, 36524); days %= 36524;
        if (days >= 365) days++;
    }
    gy += 4 * _div(days, 1461); days %= 1461;
    if (days > 365) { gy += _div(days - 1, 365); days = (days - 1) % 365; }
    const gd = days + 1;

    const leap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
    const sal_a = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 0, d = gd;
    for (let i = 1; i <= 12; i++) {
        if (d <= sal_a[i]) { gm = i; break; }
        d -= sal_a[i];
    }
    return { gy, gm, gd: d };
}

/** کمکی‌ها */
const _pad2 = (n: number) => n < 10 ? `0${n}` : String(n);

/** Date → "YYYY-MM-DD" جلالی */
function dateToJYMD(d: Date) {
    const { jy, jm, jd } = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return `${jy}-${_pad2(jm)}-${_pad2(jd)}`;
}

/** "YYYY-MM-DD" جلالی → Date (میلادی) */
function jymdToDate(jymd: string): Date | null {
    const m = /^(\d{3,4})-(\d{1,2})-(\d{1,2})$/.exec(jymd.trim());
    if (!m) return null;
    const jy = +m[1], jm = +m[2], jd = +m[3];
    if (!(jy > 0 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= 31)) return null;
    const { gy, gm, gd } = j2g(jy, jm, jd);
    return new Date(gy, gm - 1, gd);
}

function fmtJalali(d?: Date | null, opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: '2-digit' }) {
    if (!d || Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', opts).format(d);
}


/** نام ماهِ جلالی از Date میلادی (برای هدرها) */
function jalaliMonthTitle(d: Date) {
    return fmtJalali(d, { year: 'numeric', month: 'long' }); // مثل «مهر ۱۴۰۴»
}
function uniq<T>(arr: T[]) {
    return Array.from(new Set(arr));
}
function sortYmdAsc(arr: string[]) {
    return arr.slice().sort((a, b) => a.localeCompare(b));
}
