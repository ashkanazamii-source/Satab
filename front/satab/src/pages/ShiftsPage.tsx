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
import { Tabs, Tab } from '@mui/material';
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
    date: string;           // YYYY-MM-DD (برنامه)
    start_time: string;     // HH:mm (برنامه)
    end_time: string;       // HH:mm (برنامه)
    type: ShiftType;
    note?: string;
    status: ShiftStatus;

    // --- جدید:
    has_start_confirm?: boolean;   // راننده شروع را تأیید کرده؟
    has_end_confirm?: boolean;     // راننده پایان را تأیید کرده؟
    actual_start_time?: string | null; // HH:mm واقعی (اختیاری)
    actual_end_time?: string | null;   // HH:mm واقعی (اختیاری)
    tardy_minutes?: number;      // ← اضافه
    is_unfinished?: boolean;     // ← اضافه (نام را با بک‌اند هماهنگ کن)
};

// ====== APIهای رویدادی شیفت ======
async function confirmShiftStart(id: ID): Promise<Shift> {
    const res = await api.post(`/shifts/${id}/confirm-start`, {}); // سرور زمان فعلی را ثبت می‌کند
    return res.data;
}
async function confirmShiftEnd(id: ID): Promise<Shift> {
    const res = await api.post(`/shifts/${id}/confirm-end`, {});   // سرور زمان فعلی را ثبت می‌کند
    return res.data;
}

/** اطمینان از ساخت اضافه‌کاری برای شیفتی که پایانش تأیید نشده و از end_time رد شده
 *  سرور اگر لازم باشد یک Overtime(PENDING) می‌سازد و برمی‌گرداند. */
async function ensureOvertimeForShift(id: ID): Promise<{ created?: boolean; overtime?: Overtime | null }> {
    const res = await api.post(`/shifts/${id}/ensure-overtime`, {});
    return res.data ?? { created: false, overtime: null };
}
function hmToMinutes(hhmm: string) {
    const [h, m] = (hhmm || '0:0').split(':').map(Number);
    return (h * 60) + m;
}
function nowHM() {
    const d = new Date();
    return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
}
function isOvertimeActive(s: Shift): boolean {
    if (!s.has_start_confirm || s.has_end_confirm) return false;
    return hmToMinutes(nowHM()) > hmToMinutes(s.end_time);
}
function estimateOvertimeMinutes(s: Shift): number {
    // اگر امروز همان تاریخ شیفت نیست، برآورد نکن (به سرور واگذار)
    const isToday = ymd(new Date()) === s.date;
    if (!isToday) return 0;
    if (!s.has_start_confirm || s.has_end_confirm) return 0;
    const endPlan = hmToMinutes(s.end_time);
    const cur = hmToMinutes(nowHM());
    return Math.max(0, cur - endPlan);
}

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
type OvertimeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type Overtime = {
    id: ID;
    driver_id: ID;
    /** تاریخ میلادی "YYYY-MM-DD" */
    date: string;
    /** مدت به دقیقه */
    minutes: number;
    note?: string;
    status: OvertimeStatus;
};
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
    // == داخل ShiftsPage ==
    const [profileSelected, setProfileSelected] = React.useState<ShiftProfile | null>(null);
    const [assignDriverIds, setAssignDriverIds] = React.useState<ID[]>([]);
    const [applyPublish, setApplyPublish] = React.useState(false);
    const [applyLoading, setApplyLoading] = React.useState(false);
    const [driverQProfile, setDriverQProfile] = React.useState(''); // جستجوی محلیِ پنل پروفایل
    const [editingProfile, setEditingProfile] = React.useState<ShiftProfile | null>(null);
    async function updateShiftProfile(id: number, payload: { name?: string; payload?: ShiftProfilePayload }) {
        const res = await api.put(`/shift-profiles/${id}`, payload);
        return res.data;
    }
    async function deleteShiftProfile(id: number) {
        await api.delete(`/shift-profiles/${id}`);
    }

    // کلاینت برای اعمال پروفایل
    async function applyShiftProfile(
        profileId: ID,
        payload: { driver_ids: ID[]; dates?: string[]; publish?: boolean; wipe_first?: boolean; wipe_scope?: 'dates' | 'all' }
    ) {
        const res = await api.post(`/shift-profiles/${profileId}/apply`, payload);
        return res.data;
    }



    const [dialogMode, setDialogMode] = React.useState<'shift' | 'profile'>('shift');
    const [profileCreateOpen, setProfileCreateOpen] = React.useState(false);
    // درفت پروفایل (مثل شیفت ولی بدون driver_id و date)
    // فرم ساخت/ویرایش پروفایل شیفت
    const [profileDraft, setProfileDraft] = React.useState<ShiftProfilePayload>({
        start_time: '08:00',
        end_time: '16:00',
        type: 'morning',
        vehicle_id: null,
        route_id: null,
        station_start_id: null,
        station_end_id: null,
        note: '',
        status: 'DRAFT',
        apply_dates: [],   // ← انتخاب‌های تقویم
    });
    const [profileDates, setProfileDates] = React.useState<string[]>([]); // سینک با apply_dates
    const onCreateProfile = async () => {
        try {
            const name = (profileName || '').trim();
            if (!name) throw new Error('نام پروفایل را وارد کنید');

            if (!profileDraft.start_time || !profileDraft.end_time) {
                throw new Error('ساعت شروع/پایان را وارد کنید');
            }
            const start = Number(profileDraft.start_time.replace(':', ''));
            const end = Number(profileDraft.end_time.replace(':', ''));
            if (end <= start) throw new Error('ساعت پایان باید بعد از ساعت شروع باشد');

            // آماده کردن payload نهایی
            const payload: ShiftProfilePayload = {
                ...profileDraft,
                apply_dates: (profileDates && profileDates.length) ? uniq(sortYmdAsc(profileDates)) : [],
            };
            const created = await createShiftProfile(profileName.trim(), payload);

            setShiftProfiles(prev => [created, ...prev]);

            setSnack({ open: true, sev: 'success', msg: 'پروفایل با موفقیت ذخیره شد' });

            // ریست فرم
            setProfileName('');
            setProfileDraft({
                start_time: '08:00',
                end_time: '16:00',
                type: 'morning',
                vehicle_id: null,
                route_id: null,
                station_start_id: null,
                station_end_id: null,
                note: '',
                status: 'DRAFT',
                apply_dates: [],
            });
            setProfileDates([]);

            // می‌تونی دیالوگ رو باز نگه داری؛ اگر می‌خوای ببندیش:
            // setProfileOpen(false);
        } catch (e: any) {
            setSnack({ open: true, sev: 'error', msg: e?.message ?? 'خطا در ذخیره پروفایل' });
        }
    };


    // نام پروفایل (از قبل داری؛ اگر نداشتی:)

    // وضعیت ذخیره
    const [profileSaving, setProfileSaving] = React.useState(false);

    type ShiftProfilePayload = {
        start_time: string;
        end_time: string;
        type: ShiftType;
        vehicle_id?: ID | null;
        route_id?: ID | null;
        station_start_id?: ID | null;
        station_end_id?: ID | null;
        note?: string | null;
        status?: ShiftStatus;
        /** تاریخ‌های میلادی "YYYY-MM-DD" که کاربر برای این پروفایل انتخاب می‌کند */
        apply_dates?: string[];   // ← اضافه شد
    };

    const [bulk, setBulk] = React.useState<{
        extraDriverIds: ID[];
        dates: string[]; // تاریخ‌های میلادی "YYYY-MM-DD"
    }>({
        extraDriverIds: [],
        dates: [],
    });
    // -- Assignments API (منبع حقیقت حضور/غیاب) --
    type Assignment = {
        started_at: string;
        ended_at?: string | null;
        vehicle_id?: number | null; // اگر API نمی‌دهد، حذف کن و فیلتر را بردار
    };
    // ==== Profile Dialog states ====
    const [profileOpen, setProfileOpen] = React.useState(false);

    // لیست پروفایل‌های شیفت
    type ShiftProfile = {
        id: number;
        name: string;
        payload: ShiftProfilePayload;
    };

    const [shiftProfiles, setShiftProfiles] = React.useState<ShiftProfile[]>([]);

    // وقتی می‌خواهیم همان دیالوگِ شیفت را در «حالت ساخت پروفایل» باز کنیم:
    const [saveAsProfile, setSaveAsProfile] = React.useState<null | { returnToProfiles: boolean }>(null);
    const [profileName, setProfileName] = React.useState('');
    async function fetchShiftProfiles(): Promise<ShiftProfile[]> {
        const { data } = await api.get('/shift-profiles', { validateStatus: s => s < 500 }).catch(() => ({ data: [] }));
        return Array.isArray(data) ? data : (data?.items ?? []);
    }
    async function createShiftProfile(name: string, payload: ShiftProfilePayload): Promise<ShiftProfile> {
        const res = await api.post('/shift-profiles', { name, payload });
        return res.data;
    }
    React.useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const [v, s, r] = await Promise.all([fetchVehicles(), fetchStations(), fetchRoutes()]);
                if (!alive) return;
                setVehicles(v);
                setStations(s);
                setRoutes(r);
            } catch {
                // no-op
            }
        })();
        return () => { alive = false; };
    }, []);
    const onSaveProfile = async () => {
        try {
            const name = (profileName || '').trim();
            if (!name) throw new Error('نام پروفایل را وارد کنید');
            if (!profileDraft.start_time || !profileDraft.end_time) {
                throw new Error('ساعت شروع/پایان را وارد کنید');
            }
            const start = Number(profileDraft.start_time.replace(':', ''));
            const end = Number(profileDraft.end_time.replace(':', ''));
            if (end <= start) throw new Error('ساعت پایان باید بعد از ساعت شروع باشد');

            setProfileSaving(true);

            // payload نهایی: تاریخ‌ها همیشه از UI (profileDates)
            const finalPayload: ShiftProfilePayload = {
                ...profileDraft,
                apply_dates: (profileDates && profileDates.length) ? uniq(sortYmdAsc(profileDates)) : [],
            };

            if (editingProfile) {
                // ---- UPDATE ----
                const updated = await updateShiftProfile(editingProfile.id, {
                    name,
                    payload: finalPayload,
                });

                // اگر API کل آبجکت را برنمی‌گرداند، خودت local state را بساز:
                setShiftProfiles(prev =>
                    prev.map(x => x.id === editingProfile.id
                        ? { ...x, name, payload: { ...finalPayload, apply_dates: [...(finalPayload.apply_dates ?? [])] } }
                        : x
                    )
                );

                // اگر پروفایل انتخاب‌شده همین بود، انتخاب را هم آپدیت کن
                setProfileSelected(sel =>
                    sel?.id === editingProfile.id
                        ? { ...sel, name, payload: { ...finalPayload, apply_dates: [...(finalPayload.apply_dates ?? [])] } }
                        : sel
                );

                setSnack({ open: true, sev: 'success', msg: 'پروفایل ویرایش شد' });
            } else {
                // ---- CREATE ----
                const created = await createShiftProfile(name, finalPayload);
                setShiftProfiles(prev => [created, ...prev]);
                setSnack({ open: true, sev: 'success', msg: 'پروفایل با موفقیت ذخیره شد' });
            }

            // ریست و بستن
            setProfileCreateOpen(false);
            setEditingProfile(null);
            setProfileName('');
            setProfileDraft({
                start_time: '08:00',
                end_time: '16:00',
                type: 'morning',
                vehicle_id: null,
                route_id: null,
                station_start_id: null,
                station_end_id: null,
                note: '',
                status: 'DRAFT',
                apply_dates: [],
            });
            setProfileDates([]);
        } catch (e: any) {
            setSnack({ open: true, sev: 'error', msg: e?.message ?? 'خطا در ذخیره پروفایل' });
        } finally {
            setProfileSaving(false);
        }
    };


    React.useEffect(() => {
        if (!profileOpen) return;
        let alive = true;
        (async () => {
            try {
                const rows = await fetchShiftProfiles();
                if (!alive) return;
                setShiftProfiles(rows);
            } catch {
                if (!alive) return;
                setShiftProfiles([]);
            }
        })();
        return () => { alive = false; };
    }, [profileOpen]);

    // -- Assignments API
    async function fetchAssignmentHistory(driverId: ID): Promise<Assignment[]> {
        const res = await api.get(`/assignments/history/${driverId}`);
        return Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    }

    async function fetchCurrentAssignment(driverId: ID): Promise<Assignment | null> {
        const res = await api.get(`/assignments/current/${driverId}`);
        return res.data ?? null;
    }

    function toDateTime(ymdStr: string, hm: string) {
        const [y, m, d] = ymdStr.split('-').map(Number);
        const [hh, mm] = hm.split(':').map(Number);
        return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
    }

    function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
        return aStart <= bEnd && bStart <= aEnd;
    }
    function toDateTimeSpan(s: Shift) {
        const start = toDateTime(s.date, s.start_time);
        let end = toDateTime(s.date, s.end_time);
        if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
        return { start, end };
    }

    /** فیلدهای شیفت را صرفاً از روی بازه‌های انتساب مشتق می‌کند */
    function deriveFromAssignments(
        s: Shift,
        assigns: Assignment[],
        now = new Date(),
    ): Pick<Shift, 'has_start_confirm' | 'has_end_confirm' | 'actual_start_time' | 'actual_end_time'> & {
        tardy_minutes: number; unfinished: boolean
    } {
        const { start: shiftStart, end: shiftEnd } = toDateTimeSpan(s);

        const eff = assigns
            .filter(a => !s.vehicle_id || a.vehicle_id === s.vehicle_id)
            .map(a => ({ start: new Date(a.started_at), end: a.ended_at ? new Date(a.ended_at) : now }))
            .filter(a => overlap(a.start, a.end, shiftStart, shiftEnd))
            .sort((a, b) => a.start.getTime() - b.start.getTime());

        const hasStart = eff.length > 0;
        const actualStart = hasStart ? eff[0].start : null;
        const lastEnd = hasStart ? eff[eff.length - 1].end : null;

        // سگمنت‌های بریده به بازهٔ شیفت
        const segments = eff
            .map(e => ({
                start: e.start < shiftStart ? shiftStart : e.start,
                end: e.end > shiftEnd ? shiftEnd : e.end,
            }))
            .filter(seg => seg.start < seg.end)
            .sort((a, b) => a.start.getTime() - b.start.getTime());

        // وجود هر فاصله‌ای = خروج وسط شیفت
        let hadGap = false;
        if (segments.length > 0) {
            // گپ ابتدای شیفت
            if (segments[0].start.getTime() > shiftStart.getTime()) hadGap = true;
            // گپ‌های میانی
            for (let i = 1; i < segments.length && !hadGap; i++) {
                if (segments[i - 1].end.getTime() < segments[i].start.getTime()) {
                    hadGap = true;
                }
            }
            // گپ انتهای شیفت (اگر تا پایان پوشش نداشته باشد)
            if (segments[segments.length - 1].end.getTime() < shiftEnd.getTime()) hadGap = true;
        } else {
            // هیچ پوششی در کل بازه
            hadGap = true;
        }

        const hasEnd = !!(hasStart && lastEnd && lastEnd >= shiftEnd);

        const hhmm = (d: Date | null) =>
            d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null;

        const tardy_minutes = actualStart && actualStart > shiftStart
            ? Math.round((actualStart.getTime() - shiftStart.getTime()) / 60000)
            : 0;

        return {
            has_start_confirm: hasStart,
            has_end_confirm: hasEnd,
            actual_start_time: hhmm(actualStart),
            actual_end_time: hhmm(lastEnd),
            tardy_minutes,
            unfinished: hadGap, // ← هر گپ، شیفت را «ناتمام» می‌کند حتی اگر پایان پوشش داده شده باشد
            // اگر می‌خواهی «اصلاً شروع نکرده» هم ناتمام بماند، همین مقدار مناسب است چون hadGap=true می‌شود.
        };
    }




    // APIهای نمونه — در صورت تفاوت بک‌اند، فقط اینها را هماهنگ کن
    async function fetchOvertimes(params?: { status?: OvertimeStatus; q?: string; from?: string; to?: string; limit?: number; }): Promise<Overtime[]> {
        const res = await api.get('/overtimes', { params });
        // انتظار: آرایهٔ سادۀ Overtime
        return Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    }
    async function approveOvertime(id: ID): Promise<Overtime> {
        const res = await api.post(`/overtimes/${id}/approve`, {});
        return res.data;
    }
    // (اختیاری) تأیید گروهی سمت سرور اگر داشتی بهتره از این استفاده کنی
    async function approveOvertimesBulk(ids: ID[]): Promise<{ ok: ID[]; failed: ID[] }> {
        const res = await api.post(`/overtimes/approve-bulk`, { ids });
        return res.data ?? { ok: [], failed: [] };
    }
    const ensuredRef = React.useRef<Set<ID>>(new Set());
    const todayYMD = ymd(new Date());
    const [overtimeOpen, setOvertimeOpen] = React.useState(false);
    const [overtimes, setOvertimes] = React.useState<Overtime[]>([]);
    const [ovLoading, setOvLoading] = React.useState(false);
    const [ovQ, setOvQ] = React.useState('');
    const [ovSelected, setOvSelected] = React.useState<ID[]>([]);
    // همه‌ی آیتم‌های PENDINGِ فهرستِ فعلی
    const pendingVisibleIds = React.useMemo(
        () => overtimes.filter(o => o.status === 'PENDING').map(o => o.id),
        [overtimes]
    );
    const allChecked = pendingVisibleIds.length > 0 && pendingVisibleIds.every(id => ovSelected.includes(id));
    const someChecked = pendingVisibleIds.some(id => ovSelected.includes(id));

    function minutesToHM(mins: number) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}:${fmt2(m)}`;
    }
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
    // تب‌های پنل پروفایل: 0=همه راننده‌ها، 1=بدون شیفت
    const [profileTab, setProfileTab] = React.useState(0);

    // راننده‌هایی که در هیچ‌کدام از apply_dates پروفایل، شیفت ندارند
    const [remainingDrivers, setRemainingDrivers] = React.useState<Driver[]>([]);
    const [remLoading, setRemLoading] = React.useState(false);

    React.useEffect(() => {
        // وقتی پروفایل عوض شد یا تاریخ‌هایش تغییر کرد یا لیست راننده‌ها عوض شد، «بدون شیفت» را دوباره محاسبه کن
        if (!profileSelected || !(profileSelected.payload.apply_dates?.length)) {
            setRemainingDrivers([]);
            return;
        }
        const dates = Array.from(new Set(profileSelected.payload.apply_dates.filter(Boolean)));
        if (!dates.length) { setRemainingDrivers([]); return; }

        // از/تا برای یک بار گرفتن بازه
        const from = dates.slice().sort((a, b) => a.localeCompare(b))[0];
        const to = dates.slice().sort((a, b) => b.localeCompare(a))[0];
        const dateSet = new Set(dates);

        // برای کنترل فشار روی سرور: هم‌زمانی محدود
        const limit = 10; // حداکثر درخواست همزمان
        let idx = 0;
        const driversCopy = drivers.slice();
        const result: Driver[] = [];

        const runner = async () => {
            while (idx < driversCopy.length) {
                const i = idx++;
                const d = driversCopy[i];
                try {
                    const list = await fetchShifts(d.id, from, to);
                    const hasAny = (list || []).some(s => dateSet.has(s.date));
                    if (!hasAny) result.push(d); // یعنی هیچ شیفتی تو این تاریخ‌ها نداره
                } catch {
                    // اگر خطا شد، فرض نکن بدون شیفته؛ صرفاً رد شو
                }
            }
        };

        (async () => {
            setRemLoading(true);
            try {
                // limit تا روتین موازی
                await Promise.all(Array.from({ length: Math.min(limit, driversCopy.length) }, () => runner()));
                setRemainingDrivers(result);
            } finally {
                setRemLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        profileSelected?.id,
        JSON.stringify(profileSelected?.payload?.apply_dates ?? []),
        JSON.stringify(drivers.map(d => d.id)) // تغییر معنی‌دار لیست رانندگان
    ]);

    // poll assignments & ensure overtime
    React.useEffect(() => {
        if (!driverId) return;
        let cancel = false;
        let timer: any = null;

        const tick = async () => {
            try {
                const [hist, cur] = await Promise.all([
                    fetchAssignmentHistory(driverId as ID),
                    fetchCurrentAssignment(driverId as ID),
                ]);
                if (cancel) return;
                const assigns = [...hist, ...(cur ? [cur] : [])];

                setShifts(prev => prev.map(s => {
                    const enriched = deriveFromAssignments(s, assigns);
                    const patch: Partial<Shift> = {};
                    const isActiveStatus = s.status === 'PUBLISHED' || s.status === 'LOCKED';
                    const isToday = s.date === todayYMD;

                    // فقط وقتی امروز و شیفت فعال است، بک‌اند را آپدیت کن
                    if (isActiveStatus && isToday) {
                        if (enriched.tardy_minutes !== s.tardy_minutes) patch.tardy_minutes = enriched.tardy_minutes;
                        if (enriched.unfinished !== s.is_unfinished) patch.is_unfinished = enriched.unfinished;
                        if (enriched.has_start_confirm !== s.has_start_confirm) patch.has_start_confirm = enriched.has_start_confirm;
                        if (enriched.has_end_confirm !== s.has_end_confirm) patch.has_end_confirm = enriched.has_end_confirm;
                        if (enriched.actual_start_time !== s.actual_start_time) patch.actual_start_time = enriched.actual_start_time;
                        if (enriched.actual_end_time !== s.actual_end_time) patch.actual_end_time = enriched.actual_end_time;

                        if (Object.keys(patch).length) {
                            updateShift(s.id, patch).catch(() => {/* no-op */ });
                        }
                    }
                    const { end: shiftEnd } = toDateTimeSpan(s);
                    const now = new Date();
                    // شرط اضافه‌کاری خودکار
                    const nowStr = nowHM(); // ← تابعی که بالا داری
                    const overtimeCond =
                        isActiveStatus &&
                        enriched.has_start_confirm &&
                        !enriched.has_end_confirm &&
                        now.getTime() > shiftEnd.getTime();
                    if (overtimeCond && !ensuredRef.current.has(s.id)) {
                        ensuredRef.current.add(s.id);
                        ensureOvertimeForShift(s.id).catch(() => {
                            setSnack({ open: true, sev: 'error', msg: 'ثبت خودکار اضافه‌کاری ناموفق بود' });
                        });
                    }

                    return { ...s, ...enriched };
                }));

            } catch (e) {
                // ساکت یا snack سبک
            } finally {
                timer = setTimeout(tick, 60000); // هر ۶۰ ثانیه
            }
        };

        tick();
        return () => { cancel = true; if (timer) clearTimeout(timer); };
    }, [driverId]);

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





    /** load shifts */
    /** load shifts */
    React.useEffect(() => {
        if (!driverId) { setShifts([]); return; }
        let ok = true;
        (async () => {
            setLoading(true);
            try {
                // 1) خودِ برنامهٔ شیفت‌ها
                const list = await fetchShifts(driverId as ID, monthFrom, monthTo);

                // 2) منبع حقیقت حضور/غیاب از روی assignments
                const [hist, cur] = await Promise.all([
                    fetchAssignmentHistory(driverId as ID),
                    fetchCurrentAssignment(driverId as ID),
                ]);
                const assigns = [...hist, ...(cur ? [cur] : [])];

                // 3) تزریق وضعیت حضور/پایان/زمان‌های واقعی به هر شیفت
                const enriched = list.map(s => ({
                    ...s,
                    ...deriveFromAssignments(s, assigns),
                }));

                if (!ok) return;
                setShifts(enriched);
            } catch {
                setSnack({ open: true, sev: 'error', msg: 'خطا در دریافت شیفت/انتساب' });
            } finally {
                setLoading(false);
            }
        })();
        return () => { ok = false; };
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
    React.useEffect(() => {
        let alive = true;
        if (!overtimeOpen) return;
        (async () => {
            try {
                setOvLoading(true);
                const rows = await fetchOvertimes({ status: 'PENDING', q: ovQ, from: monthFrom, to: monthTo, limit: 500 });
                if (!alive) return;
                setOvertimes(rows);
                setOvSelected([]);
            } catch {
                setSnack({ open: true, sev: 'error', msg: 'خطا در دریافت اضافه‌کاری‌ها' });
            } finally {
                setOvLoading(false);
            }
        })();
        return () => { alive = false; };
        // فقط وقتی دیالوگ باز شود یا جستجو/بازه عوض شود
    }, [overtimeOpen, ovQ, monthFrom, monthTo]);

    /** helpers */
    const openCreate = (date?: string) => {
        //if (!driverId) { setSnack({ open: true, sev: 'info', msg: 'لطفاً ابتدا راننده را انتخاب کنید' }); return; }
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
            // اعتبارسنجی مشترک زمان‌ها
            if (!draft.start_time || !draft.end_time) throw new Error('ساعت شروع/پایان را وارد کنید');
            const start = Number(draft.start_time.replace(':', ''));
            const end = Number(draft.end_time.replace(':', ''));
            if (end <= start) throw new Error('ساعت پایان باید بعد از ساعت شروع باشد');

            // === حالت ساخت پروفایل ===
            if (saveAsProfile) {
                const name = (profileName || '').trim();
                if (!name) throw new Error('نام پروفایل را وارد کنید');

                const payload: ShiftProfilePayload = {
                    start_time: draft.start_time,
                    end_time: draft.end_time,
                    type: draft.type,
                    vehicle_id: draft.vehicle_id ?? null,
                    route_id: draft.route_id ?? null,
                    station_start_id: draft.station_start_id ?? null,
                    station_end_id: draft.station_end_id ?? null,
                    note: draft.note ?? '',
                    status: draft.status, // پیش‌فرض پروفایل (مثلاً DRAFT)
                };

                const created = await createShiftProfile(name, payload);

                // لیست پروفایل‌ها را رفرش کن/append کن
                setShiftProfiles(prev => [created, ...prev]);
                setSnack({ open: true, sev: 'success', msg: 'پروفایل با موفقیت ذخیره شد' });

                // بستن فرم و ماندن در دیالوگ پروفایل
                setDialogOpen(false);
                setSaveAsProfile(null);
                setProfileName('');
                setProfileOpen(true);

                return; // مهم
            }

            // === حالت معمول (ایجاد/ویرایش شیفت) ===
            // ویرایش
            if (editing) {
                const updated = await updateShift(editing.id, { ...draft });
                setShifts(prev => prev.map(x => x.id === editing.id ? updated : x));
                setSnack({ open: true, sev: 'success', msg: 'شیفت ویرایش شد' });
                setDialogOpen(false);
                return;
            }

            // ایجاد (bulk)
            if (!draft.date) throw new Error('تاریخ نامعتبر است');
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
            setSnack({ open: true, sev: 'error', msg: e?.message ?? 'خطا در ذخیره' });
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

                </Stack>

                <Stack direction="row" spacing={1}>
                    <Button
                        variant="outlined"
                        startIcon={<AccessTimeRoundedIcon />}  // همین آیکونی که قبلاً ایمپورت داری
                        onClick={() => setOvertimeOpen(true)}
                    >
                        اضافه‌کاری
                    </Button>

                    <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={async () => {
                        if (!driverId) return;
                        setLoading(true);
                        try {
                            const [list, hist, cur] = await Promise.all([
                                fetchShifts(driverId as ID, monthFrom, monthTo),
                                fetchAssignmentHistory(driverId as ID),
                                fetchCurrentAssignment(driverId as ID),
                            ]);
                            const assigns = [...hist, ...(cur ? [cur] : [])];
                            setShifts(list.map(s => ({ ...s, ...deriveFromAssignments(s, assigns) })));
                        } finally {
                            setLoading(false);
                        }
                    }}>
                        بروزرسانی
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => setProfileOpen(true)}
                    >
                        افزودن پروفایل
                    </Button>
                    <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openCreate()}>
                        افزودن شیفت
                    </Button>
                </Stack>
            </Stack>
            <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} fullWidth maxWidth="lg">
                <DialogTitle sx={{ fontWeight: 900 }}>پروفایل‌های شیفت</DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'row', minHeight: '70vh' }}>
                        {/* ستون راستِ راست: لیست + دکمه‌ی افزودن پروفایل شیفت */}
                        <Box
                            sx={{
                                width: { xs: '100%', md: 400 },
                                p: 2,
                                borderRight: (t) => `1px solid ${t.palette.divider}`, // ← قبلاً borderLeft بود
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1.25,
                            }}
                        >
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography variant="subtitle1" fontWeight={800}>لیست پروفایل‌ها</Typography>
                                <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => {
                                        setEditingProfile(null);                 // 👈 بسیار مهم
                                        setProfileName('');
                                        setProfileDraft({
                                            start_time: '08:00',
                                            end_time: '16:00',
                                            type: 'morning',
                                            vehicle_id: null,
                                            route_id: null,
                                            station_start_id: null,
                                            station_end_id: null,
                                            note: '',
                                            status: 'DRAFT',
                                            apply_dates: [],
                                        });
                                        setProfileDates([]);                     // 👈 تاریخ‌های UI
                                        setProfileCreateOpen(true);
                                    }}

                                >
                                    افزودن پروفایل شیفت
                                </Button>

                            </Stack>

                            <List dense sx={{ flex: 1, overflow: 'auto' }}>
                                {shiftProfiles.length === 0 && (
                                    <Typography variant="body2" color="text.secondary" sx={{ p: 1.5, textAlign: 'center' }}>
                                        پروفایلی وجود ندارد.
                                    </Typography>
                                )}

                                {shiftProfiles.map(p => (
                                    <ListItem
                                        key={p.id}
                                        divider
                                        secondaryAction={
                                            <Stack direction="row" spacing={0.5}>
                                                {/* ویرایش */}
                                                <Tooltip title="ویرایش پروفایل">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            setEditingProfile(p);
                                                            setProfileName(p.name);
                                                            setProfileDraft({
                                                                ...p.payload,
                                                                apply_dates: p.payload.apply_dates ?? [],
                                                            });
                                                            setProfileDates([...(p.payload.apply_dates ?? [])]); // 👈 سنکرون UI تاریخ‌ها
                                                            setProfileCreateOpen(true);
                                                        }}
                                                    >
                                                        <EditRoundedIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>

                                                {/* حذف */}
                                                <Tooltip title="حذف پروفایل">
                                                    <IconButton
                                                        size="small"
                                                        onClick={async () => {
                                                            if (!window.confirm(`حذف پروفایل «${p.name}»؟`)) return;
                                                            try {
                                                                await deleteShiftProfile(p.id);
                                                                setShiftProfiles(prev => prev.filter(x => x.id !== p.id));
                                                                // اگر پروفایل انتخاب‌شده‌ی سمت چپ همین بود، پاکش کنیم
                                                                setProfileSelected(sel => (sel?.id === p.id ? null : sel));
                                                                setSnack({ open: true, sev: 'success', msg: 'پروفایل حذف شد' });
                                                            } catch {
                                                                setSnack({ open: true, sev: 'error', msg: 'حذف پروفایل ناموفق بود' });
                                                            }
                                                        }}
                                                    >
                                                        <DeleteRoundedIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        }
                                    >
                                        <ListItemText
                                            onClick={() => {
                                                setProfileSelected(p);
                                                setAssignDriverIds([]);
                                                setDriverQProfile('');
                                            }}
                                            primary={
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Typography variant="subtitle2" fontWeight={800}>{p.name}</Typography>
                                                    {/* نشان انتخاب‌شدن */}
                                                    {profileSelected?.id === p.id && <Chip size="small" label="انتخاب شده" color="primary" />}
                                                </Stack>
                                            }
                                            secondary={
                                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: .5, flexWrap: 'wrap' }}>
                                                    <Chip size="small" icon={<AccessTimeRoundedIcon />} label={`${p.payload.start_time}–${p.payload.end_time}`} />
                                                    <Chip size="small" label={labelShiftType(p.payload.type)} />
                                                    {!!p.payload.route_id && <Chip size="small" icon={<MapRoundedIcon />} label={`مسیر #${p.payload.route_id}`} />}
                                                    {!!p.payload.vehicle_id && <Chip size="small" icon={<DirectionsBusFilledRoundedIcon />} label={`وسیله #${p.payload.vehicle_id}`} />}
                                                    {!!(p.payload.apply_dates?.length) && (
                                                        <Chip size="small" variant="outlined" label={`${p.payload.apply_dates.length} تاریخ`} />
                                                    )}
                                                </Stack>
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>

                        </Box>

                        {/* ستون چپ: انتساب پروفایل به راننده‌ها */}
                        <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {!profileSelected ? (
                                <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, opacity: .8 }}>
                                    <Typography variant="h6" color="text.secondary">یک پروفایل را از لیست سمت راست انتخاب کن</Typography>
                                    <Typography variant="body2" color="text.secondary">بعد می‌تونی آن را به راننده‌ها اعمال کنی</Typography>
                                </Stack>
                            ) : (
                                <>
                                    {/* خلاصهٔ پروفایل */}
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                                        <Typography variant="h6" fontWeight={800}>{profileSelected.name}</Typography>
                                        <Chip size="small" icon={<AccessTimeRoundedIcon />} label={`${profileSelected.payload.start_time}–${profileSelected.payload.end_time}`} />
                                        <Chip size="small" label={labelShiftType(profileSelected.payload.type as any)} />
                                        {!!profileSelected.payload.route_id && <Chip size="small" icon={<MapRoundedIcon />} label={`مسیر #${profileSelected.payload.route_id}`} />}
                                        {!!profileSelected.payload.vehicle_id && <Chip size="small" icon={<DirectionsBusFilledRoundedIcon />} label={`وسیله #${profileSelected.payload.vehicle_id}`} />}
                                    </Stack>



                                    {/* تب‌ها: همه راننده‌ها / بدون شیفت */}
                                    <Tabs
                                        value={profileTab}
                                        onChange={(_, v) => setProfileTab(v)}
                                        sx={{ borderBottom: (t) => `1px solid ${t.palette.divider}` }}
                                    >
                                        <Tab label={`همهٔ راننده‌ها (${drivers.length})`} />
                                        <Tab label={`بدون شیفت (${remLoading ? '...' : remainingDrivers.length})`} />
                                    </Tabs>

                                    {/* جستجو + انتخاب همه بر اساس تب فعال */}
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <TextField
                                            size="small"
                                            label={profileTab === 0 ? 'جستجوی راننده…' : 'جستجو در راننده‌های بدون شیفت…'}
                                            value={driverQProfile}
                                            onChange={(e) => setDriverQProfile(e.target.value)}
                                            sx={{ minWidth: 220 }}
                                            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }}
                                        />
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={(() => {
                                                        const pool = (profileTab === 0 ? drivers : remainingDrivers).filter(d =>
                                                            (d.full_name || '').toLowerCase().includes(driverQProfile.trim().toLowerCase()) ||
                                                            String(d.phone || '').includes(driverQProfile.trim())
                                                        ).map(d => d.id);
                                                        return pool.length > 0 && pool.every(id => assignDriverIds.includes(id));
                                                    })()}
                                                    indeterminate={(() => {
                                                        const pool = (profileTab === 0 ? drivers : remainingDrivers).filter(d =>
                                                            (d.full_name || '').toLowerCase().includes(driverQProfile.trim().toLowerCase()) ||
                                                            String(d.phone || '').includes(driverQProfile.trim())
                                                        ).map(d => d.id);
                                                        const some = pool.some(id => assignDriverIds.includes(id));
                                                        const all = pool.length > 0 && pool.every(id => assignDriverIds.includes(id));
                                                        return some && !all;
                                                    })()}
                                                    onChange={() => {
                                                        const pool = (profileTab === 0 ? drivers : remainingDrivers).filter(d =>
                                                            (d.full_name || '').toLowerCase().includes(driverQProfile.trim().toLowerCase()) ||
                                                            String(d.phone || '').includes(driverQProfile.trim())
                                                        ).map(d => d.id);
                                                        const allSelected = pool.length > 0 && pool.every(id => assignDriverIds.includes(id));
                                                        setAssignDriverIds(prev =>
                                                            allSelected ? prev.filter(id => !pool.includes(id)) : uniq([...prev, ...pool])
                                                        );
                                                    }}
                                                    disabled={(profileTab === 0 ? drivers.length === 0 : remainingDrivers.length === 0) || remLoading}
                                                />
                                            }
                                            label="انتخاب همه (فیلتر فعلی)"
                                        />
                                        {profileTab === 1 && (
                                            <Chip size="small" color="info" variant="outlined"
                                                label={remLoading ? 'در حال محاسبهٔ راننده‌های بدون شیفت…' : 'فقط راننده‌های بدون شیفت نمایش داده شده‌اند'}
                                            />
                                        )}
                                    </Stack>

                                    {/* لیست راننده‌ها با چک‌باکس (بر اساس تب فعال) */}
                                    <Paper variant="outlined" sx={{ p: .5, flex: 1, minHeight: 220, overflow: 'auto' }}>
                                        <List dense>
                                            {(() => {
                                                const source = profileTab === 0 ? drivers : remainingDrivers;
                                                const filtered = source.filter(d =>
                                                    (d.full_name || '').toLowerCase().includes(driverQProfile.trim().toLowerCase()) ||
                                                    String(d.phone || '').includes(driverQProfile.trim())
                                                );

                                                if (remLoading && profileTab === 1) {
                                                    return (
                                                        <Stack alignItems="center" justifyContent="center" sx={{ p: 2 }}>
                                                            <CircularProgress size={20} />
                                                        </Stack>
                                                    );
                                                }

                                                if (filtered.length === 0) {
                                                    return (
                                                        <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                                                            {profileTab === 0
                                                                ? 'راننده‌ای در زیرمجموعه پیدا نشد.'
                                                                : 'راننده‌ی بدون شیفت برای تاریخ‌های این پروفایل پیدا نشد.'}
                                                        </Typography>
                                                    );
                                                }

                                                return filtered.map(d => {
                                                    const checked = assignDriverIds.includes(d.id);
                                                    return (
                                                        <ListItem key={d.id} disableGutters>
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={checked}
                                                                        onChange={() => {
                                                                            setAssignDriverIds(prev =>
                                                                                checked ? prev.filter(x => x !== d.id) : [...prev, d.id]
                                                                            );
                                                                        }}
                                                                    />
                                                                }
                                                                label={
                                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                                        <Typography variant="body2">{d.full_name}</Typography>
                                                                        {!!d.branch_name && <Chip size="small" variant="outlined" label={d.branch_name} />}
                                                                        {!!d.phone && <Chip size="small" variant="outlined" label={d.phone} />}
                                                                        {profileTab === 1 && <Chip size="small" label="بدون شیفت" color="warning" variant="outlined" />}
                                                                    </Stack>
                                                                }
                                                            />
                                                        </ListItem>
                                                    );
                                                });
                                            })()}
                                        </List>
                                    </Paper>


                                </>
                            )}
                        </Box>


                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setProfileOpen(false)}>بستن</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={profileCreateOpen}
                onClose={() => setProfileCreateOpen(false)}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle sx={{ fontWeight: 900 }}>
                    {editingProfile ? 'ویرایش پروفایل شیفت' : 'افزودن پروفایل شیفت'}
                </DialogTitle>


                <DialogContent dividers>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        {/* ستون راست: نام + زمان‌ها + نوع + یادداشت */}
                        <Stack flex={1} spacing={2}>
                            <TextField
                                label="نام پروفایل"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                required
                            />

                            <Stack direction="row" spacing={2}>
                                <TextField
                                    label="شروع"
                                    type="time"
                                    value={profileDraft.start_time}
                                    onChange={(e) => setProfileDraft({ ...profileDraft, start_time: e.target.value })}
                                    InputLabelProps={{ shrink: true }}
                                />
                                <TextField
                                    label="پایان"
                                    type="time"
                                    value={profileDraft.end_time}
                                    onChange={(e) => setProfileDraft({ ...profileDraft, end_time: e.target.value })}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Stack>

                            <TextField
                                select
                                label="نوع شیفت"
                                value={profileDraft.type}
                                onChange={(e) => setProfileDraft({ ...profileDraft, type: e.target.value as ShiftType })}
                            >
                                <MenuItem value="morning">صبح</MenuItem>
                                <MenuItem value="evening">عصر</MenuItem>
                                <MenuItem value="night">شب</MenuItem>
                            </TextField>

                            <TextField
                                multiline
                                minRows={3}
                                label="یادداشت"
                                placeholder="توضیحات..."
                                value={profileDraft.note ?? ''}
                                onChange={(e) => setProfileDraft({ ...profileDraft, note: e.target.value })}
                            />
                        </Stack>

                        <Divider orientation="vertical" flexItem />

                        {/* ستون چپ: وسیله/مسیر/ایستگاه‌ها + وضعیت انتشار پیش‌فرض */}
                        <Stack flex={1} spacing={2}>
                            <TextField
                                select
                                label="وسیله (اختیاری)"
                                value={profileDraft.vehicle_id ?? ''}
                                onChange={(e) =>
                                    setProfileDraft({
                                        ...profileDraft,
                                        vehicle_id: e.target.value === '' ? null : Number(e.target.value),
                                    })
                                }
                            >
                                <MenuItem value="">—</MenuItem>
                                {vehicles.map(v => (
                                    <MenuItem key={v.id} value={v.id}>
                                        {v.name}{v.plate_no ? ` — ${v.plate_no}` : ''}
                                    </MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                select
                                label="مسیر (اختیاری)"
                                value={profileDraft.route_id ?? ''}
                                onChange={(e) =>
                                    setProfileDraft({
                                        ...profileDraft,
                                        route_id: e.target.value === '' ? null : Number(e.target.value),
                                    })
                                }
                            >
                                <MenuItem value="">—</MenuItem>
                                {routes.map(r => (
                                    <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                                ))}
                            </TextField>

                            <Stack direction="row" spacing={2}>
                                <TextField
                                    select
                                    label="ایستگاه شروع (اختیاری)"
                                    value={profileDraft.station_start_id ?? ''}
                                    onChange={(e) =>
                                        setProfileDraft({
                                            ...profileDraft,
                                            station_start_id: e.target.value === '' ? null : Number(e.target.value),
                                        })
                                    }
                                    sx={{ flex: 1 }}
                                >
                                    <MenuItem value="">—</MenuItem>
                                    {stations.map(s => (
                                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                                    ))}
                                </TextField>

                                <TextField
                                    select
                                    label="ایستگاه پایان (اختیاری)"
                                    value={profileDraft.station_end_id ?? ''}
                                    onChange={(e) =>
                                        setProfileDraft({
                                            ...profileDraft,
                                            station_end_id: e.target.value === '' ? null : Number(e.target.value),
                                        })
                                    }
                                    sx={{ flex: 1 }}
                                >
                                    <MenuItem value="">—</MenuItem>
                                    {stations.map(s => (
                                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                                    ))}
                                </TextField>
                            </Stack>

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={profileDraft.status !== 'DRAFT'}
                                        onChange={(e) =>
                                            setProfileDraft({ ...profileDraft, status: e.target.checked ? 'PUBLISHED' : 'DRAFT' })
                                        }
                                    />
                                }
                                label="انتشار پیش‌فرض (هنگام استفاده از این پروفایل)"
                            />
                        </Stack>
                    </Stack>

                    {/* ===== تاریخ‌های دلخواه (اختیاری) مثل دیالوگ شیفت ===== */}
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" fontWeight={800}>تاریخ‌های دلخواه (اختیاری)</Typography>

                    {/* افزودن تکی با ورودی جلالی */}
                    <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ mt: 1 }}>
                        <JalaliDateInput
                            label="تاریخ جدید (شمسی)"
                            valueYMD={''}
                            onChangeYMD={(ymd) => {
                                if (!ymd) return;
                                setProfileDates(prev => uniq(sortYmdAsc([...prev, ymd])));
                            }}
                            placeholder="مثلاً ۱۴۰۴-۰۷-۱۲"
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ mb: .5 }}>
                            تاریخ را وارد کن و فوکوس را خارج کن تا اضافه شود
                        </Typography>
                    </Stack>

                    {/* کنترل‌های سریع */}
                    <Stack direction="row" spacing={1} sx={{ my: 1 }}>
                        <Button
                            size="small"
                            onClick={() => {
                                const all = (jMonthGrid(jmonth).flat().filter(Boolean) as string[]);
                                setProfileDates(prev => uniq(sortYmdAsc([...prev, ...all])));
                            }}
                        >
                            انتخاب همهٔ ماه
                        </Button>
                        <Button size="small" onClick={() => setProfileDates([])}>
                            پاک‌کردن انتخاب‌ها
                        </Button>
                    </Stack>

                    {/* گرید روزهای ماه (6×7) با تیک */}
                    <Stack spacing={1} sx={{ mb: 1 }}>
                        {jMonthGrid(jmonth).map((row, ri) => (
                            <Stack key={ri} direction="row" spacing={1}>
                                {row.map((cell, ci) => {
                                    const selected = !!cell && profileDates.includes(cell as string);
                                    return (
                                        <Paper
                                            key={ci}
                                            variant="outlined"
                                            sx={{ flex: 1, p: .5, minHeight: 56, opacity: cell ? 1 : 0.4 }}
                                        >
                                            {cell ? (
                                                <FormControlLabel
                                                    sx={{ m: 0, width: '100%' }}
                                                    control={
                                                        <Checkbox
                                                            checked={selected}
                                                            onChange={() => {
                                                                setProfileDates(prev => {
                                                                    const exists = prev.includes(cell as string);
                                                                    return exists
                                                                        ? prev.filter(x => x !== (cell as string))
                                                                        : uniq(sortYmdAsc([...prev, cell as string]));
                                                                });
                                                            }}
                                                            size="small"
                                                        />
                                                    }
                                                    label={
                                                        <Stack direction="row" justifyContent="space-between" sx={{ width: '100%' }}>
                                                            <Typography variant="body2">{fmtJalali(toDate(cell as string))}</Typography>
                                                            <Typography variant="caption" color="text.secondary">روز {gYmdToJDay(cell as string)}</Typography>
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

                    {/* چیپ تاریخ‌های انتخاب‌شده */}
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        {(profileDates.length ? sortYmdAsc(profileDates) : []).map(d => (
                            <Chip
                                key={d}
                                label={fmtJalali(toDate(d))}
                                onDelete={() => setProfileDates(prev => prev.filter(x => x !== d))}
                                variant="outlined"
                                sx={{ mb: 1 }}
                            />
                        ))}
                    </Stack>
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setProfileCreateOpen(false)}>بستن</Button>
                    <Button
                        variant="contained"
                        onClick={onSaveProfile}
                        startIcon={<AddRoundedIcon />}
                        disabled={profileSaving}
                    >
                        {editingProfile ? 'ذخیره تغییرات' : 'ذخیره پروفایل'}
                    </Button>

                </DialogActions>
            </Dialog>



            <Dialog open={overtimeOpen} onClose={() => setOvertimeOpen(false)} fullWidth maxWidth="md">
                <DialogTitle sx={{ fontWeight: 900 }}>اضافه‌کاری</DialogTitle>
                <DialogContent dividers>
                    {/* نوار ابزار بالا */}
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 2 }}>
                        <TextField
                            size="small"
                            label="جستجوی راننده / توضیح"
                            value={ovQ}
                            onChange={(e) => setOvQ(e.target.value)}
                            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }}
                            sx={{ minWidth: 260 }}
                        />
                        <Chip
                            icon={<TodayRoundedIcon />}
                            label={`بازه: ${fmtJalali(firstDate)} تا ${fmtJalali(lastDate)}`}
                            sx={{ ml: 'auto' }}
                        />
                        <Button
                            size="small"
                            startIcon={<RefreshRoundedIcon />}
                            onClick={() => { setOvQ(q => q + ' '); }} // تریگر رفرش
                        >
                            بروزرسانی
                        </Button>
                    </Stack>

                    {/* لیست اضافه‌کاری‌ها */}
                    <Paper variant="outlined" sx={{ maxHeight: 420, overflow: 'auto' }}>
                        {ovLoading ? (
                            <Stack alignItems="center" justifyContent="center" sx={{ p: 3 }}>
                                <CircularProgress size={24} />
                            </Stack>
                        ) : (
                            <List dense>
                                {overtimes.length === 0 && (
                                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                                        موردی برای این بازه یافت نشد.
                                    </Typography>
                                )}

                                {overtimes.map(ot => {
                                    const drv = drivers.find(d => d.id === ot.driver_id);
                                    const selected = ovSelected.includes(ot.id);

                                    return (
                                        <ListItem
                                            key={ot.id}
                                            sx={{ borderBottom: '1px dashed', borderColor: 'divider' }}
                                            secondaryAction={
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Chip
                                                        size="small"
                                                        label={
                                                            ot.status === 'PENDING'
                                                                ? 'منتظر تأیید'
                                                                : ot.status === 'APPROVED'
                                                                    ? 'تأیید شده'
                                                                    : 'رد شده'
                                                        }
                                                        color={
                                                            ot.status === 'APPROVED'
                                                                ? 'success'
                                                                : ot.status === 'PENDING'
                                                                    ? 'warning'
                                                                    : 'default'
                                                        }
                                                    />
                                                    <FormControlLabel
                                                        sx={{ ml: 'auto' }}
                                                        control={
                                                            <Checkbox
                                                                checked={allChecked}
                                                                indeterminate={!allChecked && someChecked}
                                                                onChange={() => {
                                                                    setOvSelected(prev =>
                                                                        allChecked
                                                                            ? prev.filter(id => !pendingVisibleIds.includes(id)) // لغو همهٔ PENDINGهای فهرست
                                                                            : uniq([...prev, ...pendingVisibleIds])              // انتخاب همهٔ PENDINGهای فهرست
                                                                    );
                                                                }}
                                                                disabled={pendingVisibleIds.length === 0}
                                                            />
                                                        }
                                                        label="انتخاب همه"
                                                    />

                                                </Stack>
                                            }
                                        >
                                            <ListItemText
                                                primary={
                                                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                                                            <Chip size="small" variant="outlined" label={drv ? drv.full_name : `راننده #${ot.driver_id}`} />
                                                            <Chip size="small" icon={<AccessTimeRoundedIcon />} label={`${minutesToHM(ot.minutes)} ساعت`} />
                                                            <Chip size="small" label={fmtJalali(toDate(ot.date))} />
                                                        </Stack>
                                                    </Stack>
                                                }
                                                secondary={ot.note ? <Typography variant="caption" color="text.secondary">{ot.note}</Typography> : null}
                                            />
                                        </ListItem>
                                    );
                                })}

                            </List>
                        )}
                    </Paper>
                </DialogContent>

                {/* نوار پایینی: فقط راننده‌به‌راننده */}
                <DialogActions>
                    {(() => {
                        const selectedItems = overtimes.filter(o => ovSelected.includes(o.id));
                        const totalMinutes = selectedItems.reduce((sum, o) => sum + (o.minutes || 0), 0);

                        return (
                            <>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 'auto', ml: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {ovSelected.length
                                            ? `انتخاب‌شده: ${ovSelected.length} مورد — جمع زمان: ${Math.floor(totalMinutes / 60)}:${fmt2(totalMinutes % 60)}`
                                            : 'هیچ موردی انتخاب نشده است'}
                                    </Typography>
                                </Stack>

                                <Button onClick={() => setOvertimeOpen(false)}>بستن</Button>

                                <Button
                                    variant="contained"
                                    startIcon={<DoneAllRoundedIcon />}
                                    disabled={!ovSelected.length}
                                    onClick={async () => {
                                        try {
                                            setOvLoading(true);

                                            // فقط PENDINGها را فرآوری کن
                                            const pendingSelected = overtimes.filter(o => ovSelected.includes(o.id) && o.status === 'PENDING');
                                            if (!pendingSelected.length) {
                                                setSnack({ open: true, sev: 'info', msg: 'مورد PENDING برای تأیید انتخاب نشده' });
                                                return;
                                            }

                                            // گروه‌بندی بر اساس راننده
                                            const byDriver = new Map<ID, ID[]>();
                                            pendingSelected.forEach(o => {
                                                if (!byDriver.has(o.driver_id)) byDriver.set(o.driver_id, []);
                                                byDriver.get(o.driver_id)!.push(o.id);
                                            });

                                            const okIds: ID[] = [];
                                            const failedIds: ID[] = [];

                                            // توابع (ممکنه همون قبلی‌هات باشن)
                                            const bulkApprove = approveOvertimesBulk;
                                            const singleApprove = approveOvertime;

                                            for (const [driverIdKey, ids] of byDriver.entries()) {
                                                try {
                                                    const res = await bulkApprove(ids);
                                                    okIds.push(...(res.ok ?? []));
                                                    failedIds.push(...(res.failed ?? []));
                                                } catch {
                                                    // fallback: تک‌تک
                                                    const results = await Promise.allSettled(ids.map(id => singleApprove(id)));
                                                    results.forEach(r => {
                                                        if (r.status === 'fulfilled') okIds.push(r.value.id);
                                                        else failedIds.push(0 as any);
                                                    });
                                                }
                                            }

                                            // آپدیت UI
                                            if (okIds.length) {
                                                setOvertimes(prev => prev.map(x => okIds.includes(x.id) ? { ...x, status: 'APPROVED' } : x));
                                                setOvSelected(prev => prev.filter(id => !okIds.includes(id)));
                                            }

                                            if (okIds.length && failedIds.length) {
                                                setSnack({ open: true, sev: 'info', msg: `${okIds.length} مورد تأیید شد، ${failedIds.length} ناموفق` });
                                            } else if (okIds.length) {
                                                setSnack({ open: true, sev: 'success', msg: `${okIds.length} اضافه‌کاری تأیید شد` });
                                            } else {
                                                setSnack({ open: true, sev: 'error', msg: 'تأیید ناموفق بود' });
                                            }

                                            // (اختیاری) اگر لازم است شیفت‌های رانندهٔ انتخاب‌شده را هم رفرش کنی
                                            if (driverId) {
                                                try {
                                                    const list = await fetchShifts(driverId as ID, monthFrom, monthTo);
                                                    setShifts(list);
                                                } catch { }
                                            }
                                        } catch {
                                            setSnack({ open: true, sev: 'error', msg: 'خطا در تأیید اضافه‌کاری' });
                                        } finally {
                                            setOvLoading(false);
                                        }
                                    }}
                                >
                                    تأیید اضافه‌کاری
                                </Button>
                            </>
                        );
                    })()}
                </DialogActions>

            </Dialog>



            {/* Filters */}
            <Paper sx={{ p: 2, mb: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>

                    <TextField
                        select
                        label="راننده (دامنهٔ سوپرادمین)"
                        value={driverId}
                        onChange={(e) => setDriverId(Number(e.target.value))}
                        sx={{ minWidth: 280 }}
                        helperText={drivers.length ? `${drivers.length} راننده یافت شد` : 'راننده‌ای در دامنهٔ سازمان پیدا نشد'}
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
                        onShiftDelete={(s) => onDelete(s)}
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
    onShiftDelete: (s: Shift) => void;
}) {
    const { jmonth, byDate, onCellClick, onShiftClick, onShiftDelete } = props;
    const rows = jMonthGrid(jmonth);
    const weekDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

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
                                            onDelete={(e) => { e.stopPropagation(); onShiftDelete(s); }}
                                            deleteIcon={<DeleteRoundedIcon fontSize="small" />}
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
