// src/pages/LogsPage.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import api from '../services/api';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    IconButton,
    InputAdornment,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Pagination,
    Paper,
    Stack,
    TextField,
    Typography,
    Autocomplete,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFnsJalali } from '@mui/x-date-pickers/AdapterDateFnsJalali';
import faIR from 'date-fns-jalali/locale/fa-IR';
import { alpha, keyframes } from '@mui/material/styles';
import { Grow, Skeleton, Tooltip, Avatar } from '@mui/material';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import DirectionsBusFilledRoundedIcon from '@mui/icons-material/DirectionsBusFilledRounded';
import UsbRoundedIcon from '@mui/icons-material/UsbRounded';
import PolicyRoundedIcon from '@mui/icons-material/PolicyRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import {
    PersonAddAlt1Rounded as PersonAddIcon,
    DeleteForeverRounded as DeleteIcon,
    EditRounded as EditIcon,
    LoginRounded as LoginIcon,
    LogoutRounded as LogoutIcon,
    SecurityRounded as SecurityIcon,
    SyncRounded as SyncIcon,
    DirectionsBusFilledRounded as BusIcon,
    UsbRounded as UsbIcon,
    PolicyRounded as PolicyIcon,
    PublicRounded as CountryIcon,
    PersonRounded as PersonIcon,
    ArrowForwardIosRounded as ArrowIcon,
} from '@mui/icons-material';
import { Zoom, Badge } from '@mui/material';
import {
    AdminPanelSettingsRounded as SAIcon,
    PublicRounded as AllIcon,
    ChevronRightRounded as ChevronIcon,
} from '@mui/icons-material';

// تعریف keyframes برای wiggle
const wiggle = keyframes`
  0% { transform: translateX(0); }
  25% { transform: translateX(2px); }
  50% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
  100% { transform: translateX(0); }
`;
const pulse = keyframes`
  0% { transform: translateY(0); box-shadow: 0 6px 14px rgba(99,102,241,.15); }
  50% { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(236,72,153,.25); }
  100% { transform: translateY(0); box-shadow: 0 6px 14px rgba(34, 154, 197, 0.18); }
`;

const shimmer = keyframes`
  0% { background-position: 0% 50% }
  50% { background-position: 100% 50% }
  100% { background-position: 0% 50% }
`;
const pulse2 = keyframes`
  0% { transform: translateY(0); box-shadow: 0 6px 14px rgba(99,102,241,.12); }
  50% { transform: translateY(-1px); box-shadow: 0 12px 28px rgba(236,72,153,.22); }
  100% { transform: translateY(0); box-shadow: 0 6px 14px rgba(34,197,94,.16); }
`;

const shimmer2 = keyframes`
  0% { background-position: 0% 50% }
  50% { background-position: 100% 50% }
  100% { background-position: 0% 50% }
`;

const floatY = keyframes`
  0% { transform: translateX(0) }
  50% { transform: translateX(-2px) }
  100% { transform: translateX(0) }
`;

const glowPulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(99,102,241,.25) }
  70% { box-shadow: 0 0 0 10px rgba(99,102,241,0) }
  100% { box-shadow: 0 0 0 0 rgba(99,102,241,0) }
`;

const fancyBorder = (theme: any) => ({
    // مرز خود MUI رو حذف کن که دوبل نشه
    border: '1px solid transparent',
    borderRadius: 12,
    // لایه اول: رنگ پس‌زمینه (padding-box) ـ لایه دوم: قاب گرادیانی (border-box)
    background: `
    linear-gradient(${alpha(theme.palette.background.paper, 0.95)}, ${alpha(theme.palette.background.paper, 0.95)}) padding-box,
    linear-gradient(120deg, rgba(99,102,241,.5), rgba(236,72,153,.5), rgba(34,197,94,.5)) border-box
  `,
    backgroundClip: 'padding-box, border-box',
    backgroundOrigin: 'border-box',
    // انیمیشن گرادیان قاب
    backgroundSize: '200% 200%, 200% 200%',
    animation: `${shimmer} 8s ease infinite`,
});

type User = {
    id: number;
    full_name: string;
    role_level: number;
};

type AuditLog = {
    id: number;
    topic: string;
    event?: string | null;

    message?: string | null;
    metadata?: any | null;
    ip?: string | null;
    user_agent?: string | null;
    created_at: string;

    actor?: User | null;
    target_user?: User | null;

    actor_id: number | null;
    target_user_id?: number | null;

    actor_name_snapshot?: string | null;
    actor_role_level_snapshot?: number | null;
    target_name_snapshot?: string | null;
    target_role_level_snapshot?: number | null;
};

type Paged<T> = {
    items: T[];
    total: number;
    page: number;
    limit: number;
};
/** موضوعات فنی که نباید نمایش داده شوند (Safe client-side guard) */
const EXCLUDED_TOPICS_CLIENT = new Set<string>([
    'HTTP_REQUEST',
    'ENTITY_INSERT',
    'ENTITY_UPDATE',
    'ENTITY_REMOVE',
    'EXCEPTION',
]);

/** موضوعات. با بک‌اند هماهنگ باشه */
/** موضوعات (کُدها) */
const TOPICS = [
    'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_CHANGE_ROLE',
    'LOGIN', 'LOGOUT',
    'PERMISSION_GRANT', 'PERMISSION_REVOKE', 'PERMISSION_UPDATE', 'PERMISSION_SYNC',
    'VEHICLE_CREATE', 'VEHICLE_UPDATE', 'VEHICLE_DELETE',
    'DEVICE_BIND', 'DEVICE_UNBIND',
    'POLICY_UPDATE', 'COUNTRY_POLICY_UPDATE',
] as const;

type TopicCode = typeof TOPICS[number];

/** برچسب‌های فارسی برای نمایش */
const TOPIC_LABELS: Record<TopicCode, string> = {
    USER_CREATE: 'ایجاد کاربر',
    USER_UPDATE: 'ویرایش کاربر',
    USER_DELETE: 'حذف کاربر',
    USER_CHANGE_ROLE: 'تغییر نقش',

    LOGIN: 'ورود',
    LOGOUT: 'خروج',

    PERMISSION_GRANT: 'اعطای مجوز',
    PERMISSION_REVOKE: 'لغو مجوز',
    PERMISSION_UPDATE: 'به‌روزرسانی مجوزها',
    PERMISSION_SYNC: 'همسان‌سازی مجوزها',

    VEHICLE_CREATE: 'ایجاد وسیله',
    VEHICLE_UPDATE: 'ویرایش وسیله',
    VEHICLE_DELETE: 'حذف وسیله',

    DEVICE_BIND: 'اتصال دستگاه',
    DEVICE_UNBIND: 'جداکردن دستگاه',

    POLICY_UPDATE: 'به‌روزرسانی سیاست وسیله',
    COUNTRY_POLICY_UPDATE: 'به‌روزرسانی سیاست کشوری',
};

// === Jalali utils (TZ + fallback) ===
const TZ = 'Asia/Tehran';

// اعداد انگلیسی -> فارسی
function toFaDigits(s: string) {
    return s.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

// Gregorian -> Jalali (fallback سبک)
function g2j(gY: number, gM: number, gD: number) {
    const gy = gY - 1600, gm = gM - 1, gd = gD - 1;
    const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let gDayNo = 365 * gy + Math.floor((gy + 3) / 4) - Math.floor((gy + 99) / 100) + Math.floor((gy + 399) / 400) + gdm[gm] + gd;
    const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    if (gm > 1 && isLeap(gy + 1600)) gDayNo++;
    let jDayNo = gDayNo - 79;
    const jNp = Math.floor(jDayNo / 12053);
    jDayNo %= 12053;
    let jy = 979 + 33 * jNp + 4 * Math.floor(jDayNo / 1461);
    jDayNo %= 1461;
    if (jDayNo >= 366) { jy += Math.floor((jDayNo - 366) / 365); jDayNo = (jDayNo - 366) % 365; }
    const jm = jDayNo < 186 ? 1 + Math.floor(jDayNo / 31) : 7 + Math.floor((jDayNo - 186) / 30);
    const jd = jDayNo < 186 ? 1 + (jDayNo % 31) : 1 + ((jDayNo - 186) % 30);
    return { jy, jm, jd };
}

// اجزای تاریخ/ساعت در TZ
function partsInTZ(d: Date, tz: string) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, calendar: 'gregory',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d);
    const get = (t: Intl.DateTimeFormatPartTypes) => fmt.find(p => p.type === t)?.value!;
    return { y: +get('year'), m: +get('month'), d: +get('day'), hh: get('hour'), mm: get('minute') };
}

// فرمت جلالی (با زمان/بی‌زمان)
function fmtJalali(input: string | number | Date, withTime = true) {
    try {
        const d = new Date(input);
        const ok = Intl.DateTimeFormat.supportedLocalesOf(['fa-IR-u-ca-persian']).length > 0;
        if (ok) {
            const f = new Intl.DateTimeFormat(`fa-IR-u-ca-persian-nu-arabext`, {
                timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
                ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {})
            });
            return f.format(d).replace(/[،,]/g, ' ').replace(/\u200e|\u200f/g, '').trim();
        }
        const { y, m, d: day, hh, mm } = partsInTZ(d, TZ);
        const { jy, jm, jd } = g2j(y, m, day);
        const date = `${String(jy).padStart(4, '0')}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
        return toFaDigits(withTime ? `${date} ${hh}:${mm}` : date);
    } catch { return String(input); }
}

const fmtJalaliDateTime = (x: any) => fmtJalali(x, true);

// yyyy-MM-dd (هم‌راستا با TZ) برای سرور
function fmtForServerDate(d: Date) {
    const { y, m, d: day } = partsInTZ(d, TZ);
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** —————————————————————————————————————————————————————————
 *  صفحه‌ی اصلی لاگ‌ها: انتخاب ویوی نقش
 * ————————————————————————————————————————————————————————— */
export default function LogsPage() {
    const [me, setMe] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            try {
                const { data } = await api.get('/auth/me');
                setMe(data);
            } catch {
                setMe(null);
            } finally {
                setLoading(false);
            }
        };
        run();
    }, []);

    if (loading) return <Box p={2}>در حال بارگذاری...</Box>;
    if (!me) return <Box p={2} color="error.main">مشکل در دریافت اطلاعات کاربر</Box>;

    switch (me.role_level) {
        case 1: return <ManagerLogsSection user={me} />;
        case 2: return <SuperAdminLogsSection user={me} />;
        case 3: return <BranchManagerLogsSection user={me} />;
        case 4: return <OwnerLogsSection user={me} />;
        case 5: return <TechnicianLogsSection user={me} />;
        default: return <Box p={2}>این نقش دسترسی به گزارش ها را ندارد.</Box>;
    }
}

/** —————————————————————————————————————————————————————————
 *  جدول ساده لاگ‌ها
 * ————————————————————————————————————————————————————————— */
function LogsTable({
    data,
    loading,
    page,
    limit,
    total,
    onPageChange,
}: {
    data: AuditLog[];
    loading: boolean;
    page: number;
    limit: number;
    total: number;
    onPageChange: (p: number) => void;
}) {
    const visibleRows = useMemo(() => data.filter(isMeaningfulRow), [data]);

    return (
        <Paper
            elevation={0}
            sx={(t) => ({
                ...fancyBorder(t),
                overflow: 'hidden',
                // یکدست: همه‌جا همین radius رو بگذار
                borderRadius: 12,
            })}
        >
            <Box
                p={1.5}
                sx={{
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
                    backdropFilter: 'blur(4px)',
                }}
            >
                <Typography fontWeight={700}>گزارشات</Typography>
            </Box>

            {/* Loading زیباتر با Skeleton */}
            {loading ? (
                <Box p={2}>
                    <Stack spacing={1.5}>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Box
                                key={i}
                                sx={{
                                    p: 1.25,
                                    borderRadius: 12,
                                    bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
                                }}
                            >
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Skeleton variant="circular" width={32} height={32} />
                                    <Skeleton variant="text" sx={{ flex: 1 }} />
                                    <Skeleton variant="text" width={120} />
                                </Stack>
                                <Skeleton variant="text" sx={{ mt: 1, width: '60%' }} />
                            </Box>
                        ))}
                    </Stack>
                </Box>
            ) : visibleRows.length === 0 ? (
                <Box p={3} textAlign="center" color="text.secondary">
                    گزارشی پیدا نشد.
                </Box>
            ) : (
                <List disablePadding dense>
                    {visibleRows.map((row, idx) => {
                        const ui = topicUi(row.topic);
                        const gr = `linear-gradient(90deg, ${ui.c1}, ${ui.c2})`;
                        return (
                            <Grow in key={row.id} timeout={200 + idx * 40}>
                                <ListItem
                                    alignItems="flex-start"
                                    disableGutters
                                    sx={{
                                        px: 2,
                                        py: 1.25,
                                        position: 'relative',
                                        overflow: 'hidden',
                                        '&:not(:last-of-type)': { borderBottom: '1px dashed', borderColor: 'divider' },
                                        // خط تایم‌لاین رنگی سمت راست
                                        '&::after': {
                                            content: '""',
                                            position: 'absolute',
                                            right: 0,
                                            top: 6,
                                            bottom: 6,
                                            width: 3,
                                            borderRadius: 3,
                                            background: gr,
                                            opacity: 0.85,
                                        },
                                        // هُور افکت
                                        '&:hover': {
                                            bgcolor: (t) => alpha(t.palette.background.default, 0.6),
                                            transform: 'translateY(-2px)',
                                            transition: 'transform .18s ease, background .25s ease',
                                        },
                                    }}
                                >
                                    {/* آواتار موضوع با گرادیان */}
                                    <Box
                                        sx={{
                                            mr: 1.5,
                                            width: 36,
                                            height: 36,
                                            borderRadius: '50%',
                                            display: 'grid',
                                            placeItems: 'center',
                                            background: gr,
                                            boxShadow: (t) =>
                                                `0 6px 14px ${alpha(ui.c2, 0.28)}, inset 0 0 0 2px ${alpha('#fff', 0.65)}`,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {ui.icon}
                                    </Box>

                                    <ListItemText
                                        primary={
                                            <Stack direction="row" gap={1.25} alignItems="center" flexWrap="wrap">
                                                <Tooltip title={row.actor ? 'اعمال‌کننده' : 'سیستم'}>
                                                    <Typography fontWeight={700}>
                                                        {renderPersonName({
                                                            user: row.actor ?? null,
                                                            snapshot: row.actor_name_snapshot,
                                                            id: row.actor_id,
                                                            emptyLabel: 'سیستم',
                                                        })}
                                                    </Typography>
                                                </Tooltip>

                                                <AnimatedArrow />

                                                <Tooltip title="اعمال‌شونده">
                                                    <Typography fontWeight={600}>
                                                        {renderPersonName({
                                                            user: row.target_user ?? null,
                                                            snapshot: row.target_name_snapshot,
                                                            id: row.target_user_id ?? null,
                                                            emptyLabel: '—',
                                                        })}
                                                    </Typography>
                                                </Tooltip>

                                                <Chip
                                                    size="small"
                                                    label={ui.label}
                                                    sx={{
                                                        ml: 1,
                                                        bgcolor: (t) => alpha(ui.c1, 0.12),
                                                        color: ui.c2,
                                                        border: `1px solid ${alpha(ui.c2, 0.35)}`,
                                                        fontWeight: 700,
                                                    }}
                                                />

                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ ml: 'auto', fontVariantNumeric: 'tabular-nums' }}
                                                >
                                                    {fmtJalaliDateTime(row.created_at)}
                                                </Typography>
                                            </Stack>
                                        }
                                        secondary={(() => {
                                            const txt = rowFinalText(row);
                                            return txt ? (
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        mt: 0.5,
                                                        lineHeight: 1.65,
                                                        pr: 0.5,
                                                    }}
                                                >
                                                    {txt}
                                                </Typography>
                                            ) : null;
                                        })()}
                                    />
                                </ListItem>
                            </Grow>
                        );
                    })}
                </List>
            )}

            <Divider />
            <Box
                p={1.5}
                display="flex"
                justifyContent="center"
                sx={{
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.03),
                    borderTop: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Pagination
                    page={page}
                    onChange={(_, p) => onPageChange(p)}
                    count={Math.max(1, Math.ceil(total / limit))}
                    shape="rounded"
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{
                        '& .MuiPaginationItem-root': {
                            fontWeight: 700,
                            borderRadius: 12,
                        },
                    }}
                />
            </Box>
        </Paper>
    );
}
function topicUi(topic: string) {
    const base = {
        label: 'رویداد',
        c1: '#6366F1',
        c2: '#EC4899',
        icon: <PersonRoundedIcon sx={{ color: '#fff' }} fontSize="small" />,
    };

    const map: Record<string, Partial<typeof base>> = {
        USER_CREATE: { icon: <PersonAddAlt1RoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        USER_UPDATE: { icon: <EditRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        USER_DELETE: { icon: <DeleteForeverRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        LOGIN: { icon: <LoginRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        LOGOUT: { icon: <LogoutRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        PERMISSION_GRANT: { icon: <SecurityRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        PERMISSION_REVOKE: { icon: <SecurityRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        PERMISSION_UPDATE: { icon: <SecurityRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        PERMISSION_SYNC: { icon: <SyncRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        VEHICLE_CREATE: { icon: <DirectionsBusFilledRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        VEHICLE_DELETE: { icon: <DirectionsBusFilledRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        DEVICE_BIND: { icon: <UsbRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        DEVICE_UNBIND: { icon: <UsbRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        POLICY_UPDATE: { icon: <PolicyRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
        COUNTRY_POLICY_UPDATE: { icon: <PublicRoundedIcon sx={{ color: '#fff' }} fontSize="small" /> },
    };

    return { ...base, ...(map[topic] || {}) };
}

// و در AnimatedArrow:
function AnimatedArrow() {
    return (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', mx: 0.25, opacity: 0.7, animation: `${wiggle} 1.8s ease-in-out infinite` }} aria-hidden>
            <ArrowForwardIosRoundedIcon sx={{ fontSize: 16 }} />
        </Box>
    );
}

/** —————————————————————————————————————————————————————————
 *  فیلترها
 * ————————————————————————————————————————————————————————— */
type Filters = {
    q: string;
    topics: string[];
    from?: Date | null;
    to?: Date | null;
    actor_id?: number;
    target_user_id?: number;
};

function FiltersBar({
    filters,
    setFilters,
    usersForSelect,
    onSearch,
}: {
    filters: Filters;
    setFilters: (fn: (f: Filters) => Filters) => void;
    usersForSelect: User[];
    onSearch: () => void;
}) {
    return (
        <Paper
            elevation={0}
            sx={(t) => ({
                ...fancyBorder(t),
                p: 1.5,
                mb: 1.5,
                borderRadius: 12,
                // رنگ داخل کارت را کمی مات کن (اختیاری)
                background: `
      linear-gradient(${alpha(t.palette.background.paper, 0.92)}, ${alpha(t.palette.background.paper, 0.92)}) padding-box,
      linear-gradient(120deg, rgba(99,102,241,.5), rgba(236,72,153,.5), rgba(34,197,94,.5)) border-box
    `,
            })}
        >

            <Grow in>
                <Grid container spacing={1.25}>
                    <Grid item xs={12} md={3}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="جستجو در پیام/متادیتا"
                            value={filters.q}
                            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: (t) => alpha(t.palette.primary.main, 0.6),
                                },
                                '& .MuiOutlinedInput-root.Mui-focused': {
                                    boxShadow: (t) =>
                                        `0 0 0 3px ${alpha(t.palette.primary.main, 0.15)}`,
                                },
                            }}
                        />
                    </Grid>

                    <LocalizationProvider
                        dateAdapter={AdapterDateFnsJalali}
                        adapterLocale={faIR}
                    >
                        <Grid item xs={12} sm={6} md={2.5}>
                            <DatePicker
                                label="از تاریخ"
                                value={filters.from ?? null}
                                onChange={(val) => setFilters((f) => ({ ...f, from: val ?? null }))}
                                format="yyyy/MM/dd"
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        size: 'small',
                                        sx: {
                                            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline':
                                            {
                                                borderColor: (t) => alpha(t.palette.primary.main, 0.6),
                                            },
                                            '& .MuiOutlinedInput-root.Mui-focused': {
                                                boxShadow: (t) =>
                                                    `0 0 0 3px ${alpha(t.palette.primary.main, 0.15)}`,
                                            },
                                        },
                                    },
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2.5}>
                            <DatePicker
                                label="تا تاریخ"
                                value={filters.to ?? null}
                                onChange={(val) => setFilters((f) => ({ ...f, to: val ?? null }))}
                                format="yyyy/MM/dd"
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        size: 'small',
                                        sx: {
                                            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline':
                                            {
                                                borderColor: (t) => alpha(t.palette.primary.main, 0.6),
                                            },
                                            '& .MuiOutlinedInput-root.Mui-focused': {
                                                boxShadow: (t) =>
                                                    `0 0 0 3px ${alpha(t.palette.primary.main, 0.15)}`,
                                            },
                                        },
                                    },
                                }}
                            />
                        </Grid>
                    </LocalizationProvider>

                    <Grid item xs={12} md={4}>
                        <Autocomplete
                            multiple
                            size="small"
                            options={TOPICS as unknown as TopicCode[]}
                            value={filters.topics as TopicCode[]}
                            onChange={(_, val) => setFilters((f) => ({ ...f, topics: val }))}
                            getOptionLabel={(code) => TOPIC_LABELS[code] ?? code}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="موضوعات"
                                    placeholder="انتخاب کنید..."
                                    sx={{
                                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline':
                                            { borderColor: (t) => alpha(t.palette.secondary.main, 0.6) },
                                        '& .MuiOutlinedInput-root.Mui-focused': {
                                            boxShadow: (t) =>
                                                `0 0 0 3px ${alpha(t.palette.secondary.main, 0.15)}`,
                                        },
                                    }}
                                />
                            )}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <Autocomplete
                            size="small"
                            options={usersForSelect}
                            getOptionLabel={(u) => u.full_name}
                            onChange={(_, u) =>
                                setFilters((f) => ({ ...f, actor_id: u?.id || undefined }))
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="اعمال کننده"
                                    sx={{
                                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline':
                                            { borderColor: (t) => alpha(t.palette.info.main, 0.6) },
                                        '& .MuiOutlinedInput-root.Mui-focused': {
                                            boxShadow: (t) =>
                                                `0 0 0 3px ${alpha(t.palette.info.main, 0.15)}`,
                                        },
                                    }}
                                />
                            )}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <Autocomplete
                            size="small"
                            options={usersForSelect}
                            getOptionLabel={(u) => u.full_name}
                            onChange={(_, u) =>
                                setFilters((f) => ({ ...f, target_user_id: u?.id || undefined }))
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="اعمال شونده"
                                    sx={{
                                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline':
                                            { borderColor: (t) => alpha(t.palette.success.main, 0.6) },
                                        '& .MuiOutlinedInput-root.Mui-focused': {
                                            boxShadow: (t) =>
                                                `0 0 0 3px ${alpha(t.palette.success.main, 0.15)}`,
                                        },
                                    }}
                                />
                            )}
                        />
                    </Grid>

                    <Grid item xs={12} md="auto">
                        <Stack direction="row" gap={1} alignItems="center" sx={{ height: '100%' }}>
                            <Button
                                onClick={onSearch}
                                size="small"
                                variant="contained"
                                startIcon={<SearchIcon />}
                                sx={{
                                    px: 2.2,
                                    fontWeight: 800,
                                    letterSpacing: '.2px',
                                    background:
                                        'linear-gradient(90deg, #6366F1, #EC4899, #22C55E)',
                                    backgroundSize: '200% 200%',
                                    animation: `${shimmer} 6s ease infinite, ${pulse} 2.2s ease-in-out infinite`,
                                    boxShadow: '0 10px 22px rgba(99,102,241,.22)',
                                    '&:hover': {
                                        transform: 'translateY(-1px)',
                                    },
                                }}
                            >
                                جستجو
                            </Button>

                            <Tooltip title="ریست فیلترها">
                                <IconButton
                                    size="small"
                                    onClick={() =>
                                        setFilters(() => ({
                                            q: '',
                                            topics: [],
                                            from: null,
                                            to: null,
                                            actor_id: undefined,
                                            target_user_id: undefined,
                                        }))
                                    }
                                    aria-label="reset-filters"
                                    sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: (t) => alpha(t.palette.warning.main, 0.06),
                                        transition: 'all .2s ease',
                                        '&:hover': {
                                            bgcolor: (t) => alpha(t.palette.warning.main, 0.12),
                                            transform: 'rotate(-8deg) scale(1.04)',
                                        },
                                    }}
                                >
                                    <RefreshIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    </Grid>

                    <Grid item xs />

                    {/* چیپ‌های فیلتر فعال (نمایش خلاصه) */}
                    {(filters.q ||
                        filters.topics.length ||
                        filters.actor_id ||
                        filters.target_user_id ||
                        filters.from ||
                        filters.to) && (
                            <Grid item xs={12}>
                                <Zoom in>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ pt: 0.5 }}>
                                        {filters.q && (
                                            <Chip
                                                label={`جستجو: ${filters.q}`}
                                                onDelete={() => setFilters((f) => ({ ...f, q: '' }))}
                                                sx={{ bgcolor: (t) => alpha(t.palette.info.main, 0.08) }}
                                            />
                                        )}
                                        {filters.topics.map((t) => (
                                            <Chip
                                                key={t}
                                                label={TOPIC_LABELS[t as TopicCode] ?? t}
                                                onDelete={() =>
                                                    setFilters((f) => ({
                                                        ...f,
                                                        topics: f.topics.filter((x) => x !== t),
                                                    }))
                                                }
                                                sx={{ bgcolor: (t2) => alpha(t2.palette.secondary.main, 0.08) }}
                                            />
                                        ))}
                                        {filters.actor_id && (
                                            <Chip
                                                label={`اعمال‌کننده: #${filters.actor_id}`}
                                                onDelete={() =>
                                                    setFilters((f) => ({ ...f, actor_id: undefined }))
                                                }
                                                sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.08) }}
                                            />
                                        )}
                                        {filters.target_user_id && (
                                            <Chip
                                                label={`اعمال‌شونده: #${filters.target_user_id}`}
                                                onDelete={() =>
                                                    setFilters((f) => ({ ...f, target_user_id: undefined }))
                                                }
                                                sx={{ bgcolor: (t) => alpha(t.palette.success.main, 0.08) }}
                                            />
                                        )}
                                        {(filters.from || filters.to) && (
                                            <Chip
                                                label={[
                                                    filters.from ? `از ${fmtForServerDate(filters.from)}` : '',
                                                    filters.to ? `تا ${fmtForServerDate(filters.to)}` : '',
                                                ]
                                                    .filter(Boolean)
                                                    .join(' — ')}
                                                onDelete={() =>
                                                    setFilters((f) => ({ ...f, from: null, to: null }))
                                                }
                                                sx={{ bgcolor: (t) => alpha(t.palette.warning.main, 0.08) }}
                                            />
                                        )}
                                    </Stack>
                                </Zoom>
                            </Grid>
                        )}
                </Grid>
            </Grow>
        </Paper>
    );

}

/** —————————————————————————————————————————————————————————
 *  ویوی مدیرکل (ستون SA + لاگ‌ها)
 * ————————————————————————————————————————————————————————— */
function ManagerLogsSection({ user }: { user: User }) {
    const [loadingSA, setLoadingSA] = useState(false);
    const [superAdmins, setSuperAdmins] = useState<User[]>([]);
    const [selectedSA, setSelectedSA] = useState<User | null>(null);

    const [filters, setFilters] = useState<Filters>({ q: '', topics: [] });
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<Paged<AuditLog>>({ items: [], total: 0, page: 1, limit: 20 });

    const [useServerScopeBySA] = useState(false);
    const [scopeUsers, setScopeUsers] = useState<User[]>([]);

    useEffect(() => {
        const loadSA = async () => {
            setLoadingSA(true);
            try {
                const { data } = await api.get('/users/my-subordinates-flat');
                const all: User[] = data || [];
                const sas = all.filter((u) => u.role_level === 2);
                setSuperAdmins(sas);
                setScopeUsers([{ id: user.id, full_name: user.full_name, role_level: user.role_level }, ...all]);
            } finally {
                setLoadingSA(false);
            }
        };
        loadSA();
    }, [user.id, user.role_level, user.full_name]);

    const doSearch = async (resetPage = false) => {
        if (resetPage) setPage(1);

        setLoading(true);
        try {
            const params: any = {
                q: filters.q || undefined,
                page: resetPage ? 1 : page,
                limit,
            };
            if (filters.topics.length) params.topic = filters.topics;
            if (filters.actor_id) params.actor_id = filters.actor_id;
            if (filters.target_user_id) params.target_user_id = filters.target_user_id;
            if (filters.from) params.from = fmtForServerDate(filters.from);
            if (filters.to) params.to = fmtForServerDate(filters.to);

            if (useServerScopeBySA && selectedSA) {
                params.scope_root_user_id = selectedSA.id;
            }

            const { data } = await api.get('/logs', { params });
            setData(data);
        } catch {
            setData({ items: [], total: 0, page: 1, limit });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { doSearch(true); }, [useServerScopeBySA, selectedSA?.id]);
    useEffect(() => { doSearch(false); }, [page]);

    return (
        <Grid
            container
            spacing={2}
            sx={{
                p: 2,
                background: (t) =>
                    `linear-gradient(180deg, ${alpha(t.palette.primary.light, 0.06)}, transparent)`,
                borderRadius: 12,
            }}
        >
            <Grid item xs={12}>
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 800,
                        background:
                            'linear-gradient(90deg,#6366F1,#EC4899,#22C55E)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                        backgroundSize: '200% 200%',
                        animation: `${shimmer2} 10s ease infinite`,
                    }}
                >
                    گزارشات — مدیرکل
                </Typography>
            </Grid>

            {/* ستون چپ: SA ها */}
            <Grid item xs={12} md={3}>
                <Paper
                    elevation={0}
                    sx={(t) => ({
                        ...fancyBorder(t),
                        p: 1.25,
                        borderRadius: 12,
                    })}
                >

                    <Box px={1} pb={1} display="flex" alignItems="center" gap={1}>
                        <Avatar
                            sx={{
                                width: 28,
                                height: 28,
                                background: 'linear-gradient(135deg,#6366F1,#EC4899)',
                                color: '#fff',
                                animation: `${pulse2} 2.4s ease-in-out infinite`,
                            }}
                        >
                            <SAIcon sx={{ fontSize: 18 }} />
                        </Avatar>
                        <Typography fontWeight={700}>سوپرادمین‌ها</Typography>
                    </Box>
                    <Divider />
                    <SAList
                        items={superAdmins}
                        loading={loadingSA}
                        selectedId={selectedSA?.id || null}
                        onSelect={(sa) => setSelectedSA(sa)}
                    />
                </Paper>
            </Grid>

            {/* ستون راست: فیلتر + جدول لاگ */}
            <Grid item xs={12} md={9}>
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                >
                    <Stack direction="row" alignItems="center" gap={1}>
                        <Typography fontWeight={800}>
                            {selectedSA ? `گزارش‌های مرتبط با: ${selectedSA.full_name}` : 'همه‌ی زیرمجموعه‌ها'}
                        </Typography>
                        {selectedSA && (
                            <Zoom in>
                                <Chip
                                    label="فعال"
                                    size="small"
                                    sx={{
                                        fontWeight: 700,
                                        bgcolor: (t) => alpha(t.palette.success.main, 0.12),
                                        border: '1px solid',
                                        borderColor: (t) => alpha(t.palette.success.main, 0.3),
                                    }}
                                />
                            </Zoom>
                        )}
                    </Stack>

                    <Stack direction="row" gap={1}>
                        {!useServerScopeBySA && selectedSA && (
                            <Chip
                                size="small"
                                variant="outlined"
                                label="نکته: فیلتر دقیق زیر‌درخت SA را بهتر است بک‌اند انجام دهد."
                                sx={{
                                    borderStyle: 'dashed',
                                    bgcolor: (t) => alpha(t.palette.warning.main, 0.06),
                                }}
                            />
                        )}
                    </Stack>
                </Stack>

                <Grow in>
                    <Box>
                        <FiltersBar
                            filters={filters}
                            setFilters={setFilters}
                            usersForSelect={scopeUsers}
                            onSearch={() => doSearch(true)}
                        />
                    </Box>
                </Grow>

                <Paper
                    variant="outlined"
                    sx={{
                        p: 0,
                        borderRadius: 3,
                        overflow: 'hidden',
                        borderColor: (t) => alpha(t.palette.divider, 0.7),
                        boxShadow: (t) => `0 10px 26px ${alpha(t.palette.primary.main, 0.08)}`,
                    }}
                >
                    <LogsTable
                        data={useMemo(() => {
                            if (useServerScopeBySA || !selectedSA) return data.items;
                            return data.items.filter(
                                (row) =>
                                    row.actor_id === selectedSA.id ||
                                    row.target_user_id === selectedSA.id
                            );
                        }, [data.items, selectedSA, useServerScopeBySA])}
                        loading={loading}
                        page={page}
                        limit={limit}
                        total={data.total}
                        onPageChange={setPage}
                    />
                </Paper>
            </Grid>
        </Grid>
    );

}

function SAList({
    items, loading, selectedId, onSelect,
}: {
    items: User[];
    loading: boolean;
    selectedId: number | null;
    onSelect: (u: User | null) => void;
}) {
    const [q, setQ] = useState('');
    const filtered = useMemo(() => {
        const s = q.trim();
        if (!s) return items;
        return items.filter((u) => u.full_name.includes(s));
    }, [q, items]);

    return (
        <Box
            sx={{
                px: 1,
                pt: 1,
                pb: 0.5,
                position: 'relative',
                '& .MuiList-root': {
                    maxHeight: 480,
                    overflowY: 'auto',
                    pr: 0.5,
                    '&::-webkit-scrollbar': { width: 8 },
                    '&::-webkit-scrollbar-thumb': {
                        borderRadius: 8,
                        background:
                            'linear-gradient(180deg, rgba(99,102,241,.6), rgba(236,72,153,.6))',
                    },
                },
            }}
        >
            <TextField
                size="small"
                fullWidth
                placeholder="جستجو..."
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
                    mb: 1,
                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: (t) => alpha(t.palette.primary.main, 0.6),
                    },
                    '& .MuiOutlinedInput-root.Mui-focused': {
                        boxShadow: (t) => `0 0 0 3px ${alpha(t.palette.primary.main, 0.16)}`,
                    },
                }}
            />

            {loading ? (
                <Box p={2} display="flex" justifyContent="center">
                    <CircularProgress size={18} />
                </Box>
            ) : (
                <List dense>
                    {/* همه‌ی زیرمجموعه‌ها */}
                    <ListItem disableGutters sx={{ mb: 0.5 }}>
                        <Tooltip title="نمایش همه‌ی لاگ‌های زیردرخت" arrow placement="top">
                            <ListItemButton
                                selected={!selectedId}
                                onClick={() => onSelect(null)}
                                sx={{
                                    borderRadius: 12,
                                    px: 1.25,
                                    py: 0.75,
                                    transition: 'all .18s ease',
                                    border: '1px solid',
                                    borderColor: (t) =>
                                        !selectedId ? alpha(t.palette.primary.main, 0.4) : 'divider',
                                    background: (t) =>
                                        !selectedId
                                            ? `linear-gradient(90deg, ${alpha(
                                                t.palette.primary.main,
                                                0.18
                                            )}, ${alpha(t.palette.secondary.main, 0.18)})`
                                            : 'transparent',
                                    boxShadow: (t) =>
                                        !selectedId
                                            ? `0 10px 22px ${alpha(t.palette.primary.main, 0.15)}`
                                            : 'none',
                                    '&:hover': {
                                        transform: 'translateY(-1px)',
                                        background: (t) =>
                                            `linear-gradient(90deg, ${alpha(
                                                t.palette.primary.main,
                                                0.12
                                            )}, ${alpha(t.palette.secondary.main, 0.12)})`,
                                    },
                                }}
                            >
                                <Avatar
                                    sx={{
                                        width: 28,
                                        height: 28,
                                        mr: 1,
                                        fontSize: 14,
                                        background:
                                            'linear-gradient(135deg,#22C55E,#10B981,#06B6D4)',
                                        color: '#fff',
                                    }}
                                >
                                    <AllIcon sx={{ fontSize: 18 }} />
                                </Avatar>
                                <ListItemText
                                    primary="همه‌ی زیرمجموعه‌ها"
                                    primaryTypographyProps={{
                                        sx: { fontWeight: 600 },
                                    }}
                                />
                                <ChevronIcon
                                    sx={{ fontSize: 16, opacity: 0.65, animation: `${floatY} 1.6s ease-in-out infinite` }}
                                />
                            </ListItemButton>
                        </Tooltip>
                    </ListItem>

                    {/* SAها */}
                    {filtered.map((u) => {
                        const isSel = selectedId === u.id;
                        return (
                            <ListItem key={u.id} disableGutters sx={{ mb: 0.5 }}>
                                <ListItemButton
                                    selected={isSel}
                                    onClick={() => onSelect(u)}
                                    sx={{
                                        borderRadius: 12,
                                        px: 1.25,
                                        py: 0.75,
                                        transition: 'all .18s ease',
                                        position: 'relative',
                                        border: '1px solid',
                                        borderColor: (t) =>
                                            isSel ? alpha(t.palette.secondary.main, 0.5) : 'divider',
                                        background: (t) =>
                                            isSel
                                                ? `linear-gradient(90deg, ${alpha(
                                                    t.palette.secondary.main,
                                                    0.18
                                                )}, ${alpha(t.palette.primary.main, 0.18)})`
                                                : 'transparent',
                                        boxShadow: (t) =>
                                            isSel
                                                ? `0 10px 22px ${alpha(t.palette.secondary.main, 0.2)}`
                                                : 'none',
                                        '&::after': isSel
                                            ? {
                                                content: '""',
                                                position: 'absolute',
                                                inset: 0,
                                                borderRadius: 8,
                                                padding: '1px',
                                                background:
                                                    'linear-gradient(120deg, rgba(99,102,241,.55), rgba(236,72,153,.55), rgba(34,197,94,.55))',
                                                WebkitMask:
                                                    'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                                                WebkitMaskComposite: 'xor',
                                                maskComposite: 'exclude',
                                                animation: `${shimmer2} 7s ease infinite`,
                                                pointerEvents: 'none',
                                            }
                                            : undefined,
                                        '&:hover': {
                                            transform: 'translateY(-1px)',
                                            background: (t) =>
                                                `linear-gradient(90deg, ${alpha(
                                                    t.palette.secondary.main,
                                                    0.12
                                                )}, ${alpha(t.palette.primary.main, 0.12)})`,
                                        },
                                    }}
                                >
                                    <Badge
                                        overlap="circular"
                                        variant="dot"
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        sx={{
                                            '& .MuiBadge-badge': {
                                                bgcolor: '#34D399',
                                                boxShadow: '0 0 0 2px #fff',
                                                animation: isSel ? `${glowPulse} 1.8s ease-in-out infinite` : 'none',
                                            },
                                        }}
                                    >
                                        <Avatar
                                            sx={{
                                                width: 28,
                                                height: 28,
                                                mr: 1,
                                                fontSize: 14,
                                                background:
                                                    'linear-gradient(135deg,#6366F1,#EC4899)',
                                                color: '#fff',
                                            }}
                                        >
                                            <SAIcon sx={{ fontSize: 18 }} />
                                        </Avatar>
                                    </Badge>

                                    <ListItemText
                                        primary={u.full_name}
                                        secondary="سوپرادمین"
                                        primaryTypographyProps={{ sx: { fontWeight: 600 } }}
                                        secondaryTypographyProps={{ sx: { fontSize: 11, opacity: 0.7 } }}
                                    />

                                    <ChevronIcon sx={{ fontSize: 16, opacity: 0.65 }} />
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>
            )}
        </Box>
    );

}

/** —————————————————————————————————————————————————————————
 *  Viewer عمومی نقش‌های 2..5
 * ————————————————————————————————————————————————————————— */
function ScopeLogsViewer({ currentUser }: { currentUser: User }) {
    const [filters, setFilters] = useState<Filters>({ q: '', topics: [] });
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<Paged<AuditLog>>({ items: [], total: 0, page: 1, limit });
    const [scopeUsers, setScopeUsers] = useState<User[]>([]);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/users/my-subordinates-flat');
                setScopeUsers([{ id: currentUser.id, full_name: currentUser.full_name, role_level: currentUser.role_level }, ...(data || [])]);
            } catch {
                setScopeUsers([{ id: currentUser.id, full_name: currentUser.full_name, role_level: currentUser.role_level }]);
            }
        })();
    }, [currentUser]);

    const fetchLogs = async (reset = false) => {
        if (reset) setPage(1);
        setLoading(true);
        try {
            const params: any = {
                q: filters.q || undefined,
                page: reset ? 1 : page,
                limit,
            };
            if (filters.topics.length) params.topic = filters.topics;
            if (filters.actor_id) params.actor_id = filters.actor_id;
            if (filters.target_user_id) params.target_user_id = filters.target_user_id;
            if (filters.from) params.from = fmtForServerDate(filters.from);
            if (filters.to) params.to = fmtForServerDate(filters.to);

            const { data } = await api.get('/logs', { params });
            setData(data);
        } catch {
            setData({ items: [], total: 0, page: 1, limit });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(true); }, []);
    useEffect(() => { fetchLogs(false); }, [page]);

    return (
        <Box p={2}>
            <Typography variant="h6">گزارشات</Typography>

            <FiltersBar
                filters={filters}
                setFilters={setFilters}
                usersForSelect={scopeUsers}
                onSearch={() => fetchLogs(true)}
            />

            <LogsTable
                data={data.items}
                loading={loading}
                page={page}
                limit={limit}
                total={data.total}
                onPageChange={setPage}
            />
        </Box>
    );
}

/* ================== برچسب‌ها/ترجمه‌ها ================== */
// دسترسی‌ها
const ACTION_LABELS_FA: Record<string, string> = {
    create_user: 'ایجاد کاربر',
    grant_sub_permissions: 'دادن نقش‌های زیرمجموعه',
    view_transaction: 'مشاهدهٔ تراکنش‌ها',
    view_report: 'مشاهدهٔ گزارش‌ها',
    control_device_remotely: 'کنترل از راه دور دستگاه',
    report_device_fault: 'ثبت خرابی دستگاه',
    chat: 'امکان چت',
    track_driver: 'ردیابی راننده‌ها',
    view_logs: 'مشاهدهٔ گزارشات',

    // ریزهای track_driver
    gps: 'جی‌پی‌اس',
    ignition: 'سوئیچ',
    idle_time: 'توقف/دور آرام',
    odometer: 'کیلومترشمار',
    geo_fence: 'حصار جغرافیایی',
    stations: 'ایستگاه‌ها',
    routes: 'مسیرها',
    consumables: 'اقلام مصرفی',
};
const actionFa = (a: string) => ACTION_LABELS_FA[a] || a;
const faJoin = (arr: string[]) => arr.map(actionFa).join('، ');

// مانیتورهای پالیسی
const MONITOR_LABELS_FA: Record<string, string> = {
    gps: 'GPS / موقعیت',
    ignition: 'وضعیت سوییچ',
    idle_time: 'مدت توقف/سکون',
    odometer: 'کیلومترشمار',
    geo_fence: 'ژئوفنس/منطقه مجاز',
    stations: 'ایستگاه‌ها',
    routes: 'مسیرها',
    consumables: 'چک تعویض لوازم مصرفی',
};
const monitorFa = (k: string) => MONITOR_LABELS_FA[k] || k;
const joinMonitorsFa = (arr: string[]) => arr.map(monitorFa).join('، ');

// نوع وسیله
const VEHICLE_TYPE_LABELS_FA: Record<string, string> = {
    MINIBUS: 'مینی‌بوس',
    BUS: 'اتوبوس',
    TRUCK: 'کامیون',
    TANKER: 'تانکر آب',
    SEDAN: 'سواری',
    PICKUP: 'وانت',
    MOTOR: 'موتورسیکلت',

    // حالت‌های احتمالی lowercase/with underscore
    minibus: 'مینی‌بوس',
    tanker: 'تانکر آب',
    sedan: 'سواری',
};
const vehicleTypeFa = (t: string) => VEHICLE_TYPE_LABELS_FA[t] || t;

// اسم‌ها را تمیز نمایش بده (کاربر → اسنپ‌شات → #id → برچسب پیش‌فرض)
function renderPersonName(opts: {
    user?: User | null;
    snapshot?: string | null;
    id?: number | null;
    emptyLabel?: string;
}) {
    const { user, snapshot, id, emptyLabel = '—' } = opts;
    return user?.full_name
        ? user.full_name
        : (snapshot && snapshot.trim())
            ? snapshot
            : (typeof id === 'number' && id !== null)
                ? `#${id}`
                : emptyLabel;
}

/* ========== Humanizers + فیلتر کردن ردیف‌ها ========== */
// پیام‌های بی‌معنا که نباید نمایش داده شوند
const BLAND_MESSAGES = new Set<string>([
    'به‌روزرسانی مجوزها.',
    'همسان‌سازی مجوزها.',
    'به‌روزرسانی سیاست‌ها.',
]);

// متن فارسیِ لاگ‌های مجوزی
function humanizePermissionRow(row: AuditLog): string | null {
    const meta = row.metadata ?? {};

    if (row.topic === 'PERMISSION_GRANT') {
        const a = typeof meta.action === 'string' ? meta.action : '';
        return a ? `مجوز «${actionFa(a)}» داده شد.` : null;
    }

    if (row.topic === 'PERMISSION_REVOKE') {
        const a = typeof meta.action === 'string' ? meta.action : '';
        return a ? `مجوز «${actionFa(a)}» گرفته شد.` : null;
    }

    if (row.topic === 'PERMISSION_UPDATE') {
        const g = Array.isArray(meta.granted) ? meta.granted : [];
        const r = Array.isArray(meta.revoked) ? meta.revoked : [];

        if (g.length && r.length) return `مجوزها تغییر کرد؛ داده شد: ${faJoin(g)} — گرفته شد: ${faJoin(r)}`;
        if (g.length) return `مجوز داد: ${faJoin(g)}`;
        if (r.length) return `مجوز گرفت: ${faJoin(r)}`;

        // حالت تکی (اگر بک‌اند ست کند)
        if (typeof meta.action === 'string') {
            const a = meta.action as string;
            if (meta.is_allowed === true) return `مجوز «${actionFa(a)}» داده شد.`;
            if (meta.is_allowed === false) return `مجوز «${actionFa(a)}» گرفته شد.`;
        }
        return null;
    }

    if (row.topic === 'PERMISSION_SYNC') {
        const tc = typeof meta.totalCreated === 'number' ? meta.totalCreated : undefined;
        const cu = typeof meta.countUsers === 'number' ? meta.countUsers : undefined;
        if (tc !== undefined && cu !== undefined)
            return `همسان‌سازی مجوزهای پیش‌فرض: ${toFaDigits(String(tc))} مورد برای ${toFaDigits(String(cu))} کاربر ایجاد شد.`;
        return null;
    }

    return null;
}

// متن فارسیِ لاگ‌های پالیسی وسیله‌ها
function humanizePolicyRow(row: AuditLog): string | null {
    if (row.topic !== 'POLICY_UPDATE' && row.topic !== 'COUNTRY_POLICY_UPDATE') return null;
    const m = row.metadata ?? {};
    const code = typeof m.vehicle_type_code === 'string' ? m.vehicle_type_code : '';
    const granted = Array.isArray(m.granted) ? m.granted : [];
    const revoked = Array.isArray(m.revoked) ? m.revoked : [];

    const parts: string[] = [];
    if (code) parts.push(`سیاست وسیلهٔ «${vehicleTypeFa(code)}»`);

    // تغییر allowed/max اگر موجود بود
    const hasAllowedChange = typeof m.allowed_from === 'boolean' && typeof m.allowed_to === 'boolean' && m.allowed_from !== m.allowed_to;
    const hasMaxChange = Number.isFinite(m.max_from) && Number.isFinite(m.max_to) && m.max_from !== m.max_to;

    if (granted.length && revoked.length) {
        parts.push(`تغییر کرد؛ اضافه شد: ${joinMonitorsFa(granted)} — حذف شد: ${joinMonitorsFa(revoked)}`);
    } else if (granted.length) {
        parts.push(`اضافه شد: ${joinMonitorsFa(granted)}`);
    } else if (revoked.length) {
        parts.push(`حذف شد: ${joinMonitorsFa(revoked)}`);
    }

    if (hasAllowedChange) {
        parts.push(m.allowed_to ? 'فعال شد' : 'غیرفعال شد');
    }
    if (hasMaxChange) {
        parts.push(`سقف تعداد از ${toFaDigits(String(m.max_from))} به ${toFaDigits(String(m.max_to))}`);
    }

    const text = parts.join(' — ');
    return text || null;
}

// متن نهایی برای نمایش (اول humanized، بعد message خام)
function rowFinalText(row: AuditLog): string {
    const txt = String(
        humanizePermissionRow(row) ??
        humanizePolicyRow(row) ??
        row.message ??
        ''
    ).trim();
    return txt;
}

// ردیف «معنادار» است؟
function isMeaningfulRow(row: AuditLog): boolean {
    // اصلاً موضوعات فنی/درخواستی دیده نشه
    if (EXCLUDED_TOPICS_CLIENT.has(row.topic)) return false;

    // هر چیزی که event=REQUEST داشته باشه (ردپا از DB قدیمی)
    if (row.event && String(row.event).toUpperCase() === 'REQUEST') return false;

    // اگر شِبه HTTP باشد (داشتن status در metadata) هم پنهان
    const st = row?.metadata?.status ?? row?.metadata?.statusCode ?? row?.metadata?.httpStatus;
    if (typeof st === 'number') return false;

    // متن نهایی
    const txt = rowFinalText(row);
    if (!txt) return false;

    // هر پیامی که با «درخواست …» شروع شود
    if (/^\s*درخواست\b/.test(txt)) return false;

    // جمله‌های خنثی
    if (BLAND_MESSAGES.has(txt)) return false;

    return true;
}

/** —————————————————————————————————————————————————————————
 *  نقش‌ها 2..5
 * ————————————————————————————————————————————————————————— */
function SuperAdminLogsSection({ user }: { user: User }) {
    const [filters, setFilters] = useState<Filters>({ q: '', topics: [] });
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<Paged<AuditLog>>({ items: [], total: 0, page: 1, limit });
    const [scopeUsers, setScopeUsers] = useState<User[]>([]);

    // لیست زیرمجموعه‌ها برای فیلتر و فallback
    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/users/my-subordinates-flat');
                const subs: User[] = data || [];
                setScopeUsers([{ id: user.id, full_name: user.full_name, role_level: user.role_level }, ...subs]);
            } catch {
                setScopeUsers([{ id: user.id, full_name: user.full_name, role_level: user.role_level }]);
            }
        })();
    }, [user]);

    const fetchLogs = useCallback(async (reset = false) => {
        if (reset) setPage(1);
        setLoading(true);
        try {
            const params: any = {
                q: filters.q || undefined,
                page: reset ? 1 : page,
                limit,
                // ⬅️ سروری: همهٔ لاگ‌های زیردرخت این SA
                scope_root_user_id: user.id,
            };
            if (filters.topics.length) params.topic = filters.topics;
            if (filters.actor_id) params.actor_id = filters.actor_id;
            if (filters.target_user_id) params.target_user_id = filters.target_user_id;
            if (filters.from) params.from = fmtForServerDate(filters.from);
            if (filters.to) params.to = fmtForServerDate(filters.to);

            const { data } = await api.get('/logs', { params });
            setData(data);
        } catch {
            setData({ items: [], total: 0, page: 1, limit });
        } finally {
            setLoading(false);
        }
    }, [filters, page, limit, user.id]);

    useEffect(() => { fetchLogs(true); }, []);     // بار اول
    useEffect(() => { fetchLogs(false); }, [page]); // صفحه‌بندی

    // کلاینتی: اگر سرور اسکُوپ اعمال نکرده بود، این فیلتر فقط زیردرخت خودت رو نگه می‌داره
    const scopeIds = useMemo(() => new Set([user.id, ...scopeUsers.map(u => u.id)]), [user.id, scopeUsers]);
    const scopedItems = useMemo(() => {
        return data.items.filter(r => {
            const actorInScope = r.actor_id != null && scopeIds.has(r.actor_id);
            const targetInScope = r.target_user_id != null && scopeIds.has(r.target_user_id!);
            return actorInScope || targetInScope;
        });
    }, [data.items, scopeIds]);

    return (
        <Box p={2}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                گزارشات زیرمجموعهٔ من
            </Typography>

            <FiltersBar
                filters={filters}
                setFilters={setFilters}
                usersForSelect={scopeUsers}
                onSearch={() => fetchLogs(true)}
            />

            <LogsTable
                data={scopedItems}
                loading={loading}
                page={page}
                limit={limit}
                total={data.total}
                onPageChange={setPage}
            />
        </Box>
    );
}

// یک سکشن عمومی برای هر نقشی که باید فقط خودش و زیرمجموعه‌اش را ببیند
// تابع عمومی: فقط لاگ‌های خود کاربر و زیردرخت او (نه بالادستی‌ها)
function ScopedLogsSection({ user, title }: { user: User; title: string }) {
    const [filters, setFilters] = useState<Filters>({ q: '', topics: [] });
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<Paged<AuditLog>>({ items: [], total: 0, page: 1, limit });
    const [scopeUsers, setScopeUsers] = useState<User[]>([]);

    // گرفتن زیردستی‌ها + خود کاربر (برای UI و فیلتر کلاینتی)
    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/users/my-subordinates-flat');
                const subs: User[] = data || [];
                setScopeUsers([{ id: user.id, full_name: user.full_name, role_level: user.role_level }, ...subs]);
            } catch {
                setScopeUsers([{ id: user.id, full_name: user.full_name, role_level: user.role_level }]);
            }
        })();
    }, [user]);

    // گرفتن لاگ‌ها با اسکُوپ سروری (اگر پیاده شده باشد)
    const fetchLogs = useCallback(async (reset = false) => {
        if (reset) setPage(1);
        setLoading(true);
        try {
            const params: any = {
                q: filters.q || undefined,
                page: reset ? 1 : page,
                limit,
                // فقط لاگ‌های زیردرخت این کاربر
                scope_root_user_id: user.id,
            };
            if (filters.topics.length) params.topic = filters.topics;
            if (filters.actor_id) params.actor_id = filters.actor_id;
            if (filters.target_user_id) params.target_user_id = filters.target_user_id;
            if (filters.from) params.from = fmtForServerDate(filters.from);
            if (filters.to) params.to = fmtForServerDate(filters.to);

            const { data } = await api.get('/logs', { params });
            setData(data);
        } catch {
            setData({ items: [], total: 0, page: 1, limit });
        } finally {
            setLoading(false);
        }
    }, [filters, page, limit, user.id]);

    useEffect(() => { fetchLogs(true); }, []);     // بار اول
    useEffect(() => { fetchLogs(false); }, [page]); // صفحه‌بندی

    // ✅ فیلتر کلاینتیِ سخت‌گیرانه:
    // فقط اگر actor در اسکوپ باشد نشان بده؛
    // استثناء: اگر لاگ «سیستمی» (actor_id == null) بود و target در اسکوپ بود، نشان بده.
    const scopeIds = useMemo(() => new Set([user.id, ...scopeUsers.map(u => u.id)]), [user.id, scopeUsers]);
    const scopedItems = useMemo(() => {
        return data.items.filter(r => {
            const actorInScope = r.actor_id != null && scopeIds.has(r.actor_id);
            const targetInScope = r.target_user_id != null && scopeIds.has(r.target_user_id!);
            return actorInScope || targetInScope;
        });
    }, [data.items, scopeIds]);


    return (
        <Box p={2}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                {title}
            </Typography>

            <FiltersBar
                filters={filters}
                setFilters={setFilters}
                usersForSelect={scopeUsers}
                onSearch={() => fetchLogs(true)}
            />

            <LogsTable
                data={scopedItems}
                loading={loading}
                page={page}
                limit={limit}
                total={data.total}
                onPageChange={setPage}
            />
        </Box>
    );
}

// این سه تا را جایگزین کن:
function BranchManagerLogsSection({ user }: { user: User }) {
    return <ScopedLogsSection user={user} title="گزارشات زیرمجموعهٔ من — مدیر شعبه" />;
}
function OwnerLogsSection({ user }: { user: User }) {
    return <ScopedLogsSection user={user} title="گزارشات زیرمجموعهٔ من — مالک" />;
}
function TechnicianLogsSection({ user }: { user: User }) {
    return <ScopedLogsSection user={user} title="گزارشات زیرمجموعهٔ من — تکنسین" />;
}
