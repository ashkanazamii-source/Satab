import { useEffect, useState, useMemo } from 'react';
import React from 'react';
import api from '../services/api';
import { MenuItem, Portal, } from '@mui/material';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Checkbox, FormGroup, FormControlLabel, Grid,
  IconButton, Button, Collapse, List, ListItem, ListItemText, Box
} from '@mui/material';
import type { VirtualElement } from '@popperjs/core';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import { Stack } from '@mui/material';
import { Chip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PublicIcon from '@mui/icons-material/Public';
import { alpha, keyframes } from '@mui/material/styles';
import {
  Paper, Typography, Avatar, Tooltip, Popper, Fade, LinearProgress, Radio,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
// +++
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





type SAType = 'fleet' | 'device' | 'universal';
const SA_TYPE_OPTS: { value: SAType; label: string }[] = [
  { value: 'fleet', label: 'ناوگانی' },
  { value: 'device', label: 'مدیریت دستگاه' },
  { value: 'universal', label: 'جامع' },
];



export const NODE_W = 200;   // عرض ثابت کارت
export const NODE_H = 76;    // ارتفاع ثابت کارت
// ==== Hover Summary Bus ====




const SUMMARY_CACHE = new Map<string, any>();

type HoverAction =
  | { type: 'show'; userId: number; anchorEl: HTMLElement }
  | { type: 'hide' };

export const HoverSummaryBus = (() => {
  let handler: ((a: HoverAction) => void) | null = null;
  return {
    setHandler(h: typeof handler) { handler = h; },
    showFor(userId: number, anchorEl: HTMLElement) { handler?.({ type: 'show', userId, anchorEl }); },
    hide() { handler?.({ type: 'hide' }); },
  };
})();






function AnalyticsHoverPortal({ from, to }: { from?: string; to?: string }) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [data, setData] = useState<{
    nodeId: number; drivers: number; totalDistanceKm: number; engineHours: number; totalViolations: number;
  } | null>(null);
  const [timer, setTimer] = useState<any>(null);

  useEffect(() => {
    HoverSummaryBus.setHandler(async (a) => {
      if (a.type === 'hide') {
        setOpen(false);
        setAnchorEl(null);
        setUserId(null);
        setErr('');
        if (timer) clearTimeout(timer);
        return;
      }

      // show روی المنت
      setOpen(true);
      setErr('');
      setUserId(a.userId);
      setAnchorEl(a.anchorEl);

      if (timer) clearTimeout(timer);
      const t = setTimeout(async () => {
        const key = `${a.userId}|${from ?? ''}|${to ?? ''}`;
        if (SUMMARY_CACHE.has(key as any)) {
          setData(SUMMARY_CACHE.get(key as any));
          setLoading(false);
          return;
        }
        try {
          setLoading(true);
          const { data } = await api.get('/analytics/node-summary', { params: { userId: a.userId, from, to } });
          SUMMARY_CACHE.set(key as any, data);
          setData(data);
        } catch (e: any) {
          setErr(e?.response?.data?.message || 'خطا در دریافت سامری');
          setData(null);
        } finally {
          setLoading(false);
        }
      }, 140);
      setTimer(t);
    });
    return () => HoverSummaryBus.setHandler(null);
  }, [from, to]);

  if (!open || !anchorEl) return null;

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement="top-start"
      transition
      modifiers={[
        { name: 'offset', options: { offset: [0, 8] } },
        { name: 'preventOverflow', options: { boundary: 'viewport', padding: 8 } },
        { name: 'flip', options: { fallbackPlacements: ['right-start', 'left-start', 'bottom-start'] } },
      ]}
      style={{ zIndex: 20000, pointerEvents: 'none' }}
    >
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={120}>
          <Paper
            elevation={3}
            sx={{
              p: 1.25,
              borderRadius: 2,
              minWidth: 260,
              maxWidth: 320,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: `0 10px 24px rgba(0,0,0,.16)`,
              background: `linear-gradient(180deg,#fff, #fafafa)`,
              pointerEvents: 'none',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: .5 }}>
              <Typography fontWeight={700} fontSize={13}>خلاصهٔ آنالیز</Typography>
              <Chip size="small" label={userId ? `#${userId}` : ''} />
            </Stack>

            {loading ? (
              <Box sx={{ py: 1 }}><LinearProgress /></Box>
            ) : err ? (
              <Typography color="error" fontSize={12}>{err}</Typography>
            ) : data ? (
              <Grid container spacing={1} sx={{ mt: .5 }}>
                <Grid item xs={6}><Metric label="راننده" value={data.drivers} /></Grid>
                <Grid item xs={6}><Metric label="تخلف" value={data.totalViolations} /></Grid>
                <Grid item xs={12}>
                  <Metric label="مسافت" value={`${Number(data.totalDistanceKm || 0).toLocaleString('fa-IR')} km`} />
                </Grid>
                <Grid item xs={12}>
                  <Metric label="ساعت موتور" value={`${Number(data.engineHours || 0).toLocaleString('fa-IR')} h`} />
                </Grid>
              </Grid>
            ) : (
              <Typography fontSize={12} color="text.secondary">داده‌ای نیست.</Typography>
            )}
          </Paper>
        </Fade>
      )}
    </Popper>
  );
}




function Metric({ label, value }: { label: string; value: any }) {
  return (
    <Box sx={{ p: .5, borderRadius: 1 }}>
      <Typography variant="caption" sx={{ color: '#64748b' }}>{label}</Typography>
      <Typography fontWeight={700} sx={{ lineHeight: 1 }}>{value}</Typography>
    </Box>
  );
}


function UserCard({
  u,
  isRoot = false,
  onEdit, onDelete, onEditVehiclePolicy, onGrantMonitors,
  currentUserId, currentUserRoleLevel, canDelete, roleSaType
}: any) {
  const roleColor =
    u.role_level === 2 ? royal.c2 :
      u.role_level === 1 ? '#60A5FA' : royal.c1;
  const effectiveSaType: SAType | undefined = (u as any).sa_type ?? roleSaType; // 👈 مهم

  return (
    <Paper
      elevation={0}
      sx={(t) => ({
        ...fancyBorderRoyal(t),
        // ⬇️ ابعاد ثابت
        width: NODE_W,
        height: NODE_H,
        px: 1,
        py: 0.75,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden', // متن یا دکمه‌ها کارت را بزرگ نکنند
        position: 'relative',
        transition: 'transform .18s ease, box-shadow .18s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 16px 28px ${alpha(royal.c2, .18)}`,
        },
      })}
      onMouseEnter={(e) => HoverSummaryBus.showFor(u.id, e.currentTarget as HTMLElement)}
      onMouseLeave={() => HoverSummaryBus.hide()}
      onFocus={(e) => HoverSummaryBus.showFor(u.id, e.currentTarget as HTMLElement)}   // برای دسترسی‌پذیری
      onBlur={() => HoverSummaryBus.hide()}

    >
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ width: '100%', minWidth: 0 }}>
        <Avatar
          sx={{
            width: 34, height: 34,
            background: `linear-gradient(135deg, ${royal.c1}, ${royal.c2})`,
            border: '2px solid #fff',
            animation: isRoot ? `${glow} 1.8s ease-in-out infinite` : 'none',
            flexShrink: 0,
          }}
        >
          {displayName(u).slice(0, 1)}
        </Avatar>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap fontWeight={700} sx={{ lineHeight: 1.1, maxWidth: '100%' }}>
            {displayName(u)}
          </Typography>
          <Typography noWrap variant="caption" sx={{ color: roleColor, lineHeight: 1.1, maxWidth: '100%' }}>
            ({roleLabel(u.role_level, effectiveSaType)}) {/* 👈 اینجا */}
          </Typography>
        </Box>

        <Stack
          direction="row"
          gap={0.5}
          sx={{
            ml: 'auto',
            flexShrink: 0,
            '& .MuiIconButton-root': { width: 28, height: 28, p: 0.25 }, // دکمه‌ها کوچک و فشرده
          }}
        >
          {/* مدیرکل ← سیاست/سهمیه خودرو برای SA */}
          {onEditVehiclePolicy && currentUserRoleLevel === 1 && u.role_level === 2 && (
            <Tooltip title="سهمیه و مجوز ماشین‌ها">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onEditVehiclePolicy(u); }}
                sx={{ bgcolor: alpha(royal.c2, .08), '&:hover': { bgcolor: alpha(royal.c2, .16) } }}
              >
                <DirectionsBusIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {/* حذف */}
          {onDelete && u.id !== currentUserId && (
            ((currentUserRoleLevel === 1 && u.role_level > 1) ||
              (currentUserRoleLevel === 2 && canDelete && u.role_level > 2)) && (
              <Tooltip title="حذف کاربر">
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => { e.stopPropagation(); onDelete(u); }}
                  sx={{ bgcolor: alpha('#ef4444', .08), '&:hover': { bgcolor: alpha('#ef4444', .16) } }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )
          )}

          {/* مانیتورینگ برای زیرمجموعه‌های SA */}
          {onGrantMonitors && currentUserRoleLevel === 2 && u.role_level > 2 && (
            <Tooltip title="واگذاری پرمیشن‌های مانیتورینگ">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onGrantMonitors(u); }}
                sx={{ bgcolor: alpha(royal.c1, .08), '&:hover': { bgcolor: alpha(royal.c1, .16) } }}
              >
                <DirectionsBusIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {/* ویرایش */}
          {((currentUserRoleLevel === 2 && u.role_level > 2 && u.id !== currentUserId) ||
            (currentUserRoleLevel === 1 && u.role_level === 2)) && (
              <Tooltip title="ویرایش کاربر">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onEdit?.(u); }}
                  sx={{ bgcolor: alpha(royal.c2, .08), '&:hover': { bgcolor: alpha(royal.c2, .16) } }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
        </Stack>
      </Stack>
    </Paper>
  );
}
const shimmerRoyal = keyframes`
  0% { background-position: 0% 50% }
  50% { background-position: 100% 50% }
  100% { background-position: 0% 50% }
`;
const glow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(37,99,235,.35) }
  70% { box-shadow: 0 0 0 10px rgba(37,99,235,0) }
  100% { box-shadow: 0 0 0 0 rgba(37,99,235,0) }
`;

// قاب گرادیانی بدون شبه‌عنصر (بدون مشکل هلال گوشه‌ها)
const fancyBorderRoyal = (t: any) => ({
  border: '1px solid transparent',
  borderRadius: 12,
  background: `
    linear-gradient(${alpha(t.palette.background.paper, 0.96)}, ${alpha(t.palette.background.paper, 0.96)}) padding-box,
    linear-gradient(135deg, ${royal.c1}, ${royal.c2}) border-box
  `,
  backgroundClip: 'padding-box, border-box',
  backgroundOrigin: 'border-box',
  backgroundSize: '200% 200%, 200% 200%',
  animation: `${shimmerRoyal} 10s ease infinite`,
});
const royal = {
  c1: '#0EA5B7',   // teal
  c2: '#2563EB',   // royal blue
  bg: '#0F172A',   // تیره شیک
};
// ---------- INTERFACE ----------
interface User {
  sa_type?: SAType; // فقط همینه؛ یک‌بار تعریف، اختیاری
  id: number;
  full_name: string;
  role_level: number;
  parent_id?: number | null;
}



// ——— کارت هر نود (مربعِ گوشه‌گرد)
function NodeCard({
  u,
  isRoot = false,
  onEdit, onDelete, onEditVehiclePolicy, onGrantMonitors,
  currentUserId, currentUserRoleLevel, canDelete, roleSaType
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
  roleSaType?: SAType
}) {
  const roleColor =
    u.role_level === 2 ? royal.c2 :
      u.role_level === 1 ? '#60A5FA' : royal.c1;
  const effectiveSaType: SAType | undefined = (u as any).sa_type ?? roleSaType; // 👈 مهم

  return (
    <Paper
      elevation={0}
      sx={{
        width: Math.max(NODE_W, 320), // حداقل عرض 320px
        minHeight: NODE_H,
        maxHeight: NODE_H + 40,
        borderRadius: 16,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden', // مهم: جلوگیری از خروج محتوا
        bgcolor: 'transparent',
        background: `
        linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%),
        linear-gradient(135deg, ${royal.c1}15, ${royal.c2}25)
      `,
        backdropFilter: 'blur(15px) saturate(180%)',
        border: `2px solid rgba(255,255,255,0.3)`,
        boxShadow: `
        0 8px 32px rgba(0,0,0,0.1),
        0 4px 16px ${royal.c2}25,
        inset 0 1px 0 rgba(255,255,255,0.6)
      `,
        position: 'relative',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `
          0 16px 48px rgba(0,0,0,0.15),
          0 8px 32px ${royal.c2}30,
          inset 0 1px 0 rgba(255,255,255,0.8)
        `,
        },

      }}
      onMouseEnter={(e) => HoverSummaryBus.showFor(u.id, e.currentTarget as HTMLElement)}
      onMouseLeave={() => HoverSummaryBus.hide()}
      onFocus={(e) => HoverSummaryBus.showFor(u.id, e.currentTarget as HTMLElement)}   // برای دسترسی‌پذیری
      onBlur={() => HoverSummaryBus.hide()}

    >
      {/* بخش بالا: آواتار و اطلاعات کاربر */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{
          width: '100%',
          minWidth: 0,
          flex: 1,
          overflow: 'hidden', // جلوگیری از overflow
        }}
      >
        {/* آواتار */}
        <Box sx={{ flexShrink: 0 }}>
          <Avatar
            sx={{
              width: 44,
              height: 44,
              background: `linear-gradient(135deg, ${royal.c1}, ${royal.c2})`,
              color: '#fff',
              fontWeight: 700,
              fontSize: '1.1rem',
              border: '2px solid rgba(255,255,255,0.8)',
              boxShadow: `0 4px 16px ${royal.c2}40`,
              transition: 'all 0.3s ease',
            }}
          >
            {displayName(u).slice(0, 1)}
          </Avatar>
        </Box>

        {/* اطلاعات کاربر - با محدودیت عرض */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0, // اجازه shrink شدن
            maxWidth: '65%', // محدودیت عرض
            overflow: 'hidden',
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              fontSize: '0.95rem',
              lineHeight: 1.2,
              color: '#2c3e50',
              mb: 0.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', // یک خط
            }}
          >
            {displayName(u)}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: roleColor,
              fontSize: '0.75rem',
              fontWeight: 500,
              lineHeight: 1.1,
              opacity: 0.8,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', // یک خط
            }}
          >
            ({roleLabel(u.role_level, effectiveSaType)}) {/* 👈 اینجا */}
          </Typography>
        </Box>
      </Stack>

      {/* بخش پایین: دکمه‌های عملیات */}
      <Stack
        direction="row"
        justifyContent="flex-end"
        alignItems="center"
        spacing={0.5}
        sx={{
          width: '100%',
          mt: 1,
          flexShrink: 0, // عدم کوچک شدن
          '& .MuiIconButton-root': {
            width: 32,
            height: 32,
            borderRadius: 8,
            bgcolor: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.5)',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          },
        }}
      >
        {/* مدیرکل → سیاست/سهمیه خودرو برای SA */}
        {onEditVehiclePolicy && currentUserRoleLevel === 1 && u.role_level === 2 && (
          <Tooltip title="سهمیه و مجوز ماشین‌ها" arrow>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onEditVehiclePolicy(u); }}
              sx={{
                bgcolor: `${royal.c1}20`,
                '&:hover': { bgcolor: `${royal.c1}30` },
              }}
            >
              <DirectionsBusIcon fontSize="small" sx={{ color: royal.c1 }} />
            </IconButton>
          </Tooltip>
        )}

        {/* حذف */}
        {onDelete && u.id !== currentUserId && (
          ((currentUserRoleLevel === 1 && u.role_level > 1) ||
            (currentUserRoleLevel === 2 && canDelete && u.role_level > 2)) && (
            <Tooltip title="حذف کاربر" arrow>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onDelete(u); }}
                sx={{
                  bgcolor: 'rgba(244, 67, 54, 0.1)',
                  '&:hover': {
                    bgcolor: 'rgba(244, 67, 54, 0.2)',
                  },
                }}
              >
                <DeleteIcon fontSize="small" sx={{ color: '#f44336' }} />
              </IconButton>
            </Tooltip>
          )
        )}

        {/* مانیتورینگ برای زیرمجموعه‌های SA */}
        {onGrantMonitors && currentUserRoleLevel === 2 && u.role_level > 2 && (
          <Tooltip title="واگذاری پرمیشن‌های مانیتورینگ" arrow>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onGrantMonitors(u); }}
              sx={{
                bgcolor: `${royal.c2}20`,
                '&:hover': { bgcolor: `${royal.c2}30` },
              }}
            >
              <DirectionsBusIcon fontSize="small" sx={{ color: royal.c2 }} />
            </IconButton>
          </Tooltip>
        )}

        {/* ویرایش */}
        {onEdit &&
          ((currentUserRoleLevel === 2 && u.role_level > 2 && u.id !== currentUserId) ||
            (currentUserRoleLevel === 1 && u.role_level === 2)) && (
            <Tooltip title="ویرایش کاربر" arrow>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onEdit(u); }}
                sx={{
                  bgcolor: 'rgba(76, 175, 80, 0.1)',
                  '&:hover': {
                    bgcolor: 'rgba(76, 175, 80, 0.2)',
                  },
                }}
              >
                <EditIcon fontSize="small" sx={{ color: '#4caf50' }} />
              </IconButton>
            </Tooltip>
          )}
      </Stack>
    </Paper>
  );
}
// ——— استایل درخت با خطوط اتصال (بدون کتابخانه)
const orgTreeSx = {
  // تنظیمات
  '--gx': '10px',                      // فاصله افقی بین نودها
  '--gy': '18px',                      // فاصله عمودی بین سطوح
  '--lw': '2px',                       // ضخامت خط
  '--lc': alpha(royal.c2, .4),         // رنگ خط
  '--cr': '6px',                       // انحنای گوشه‌ی خطوط

  direction: 'ltr',
  textAlign: 'center',

  '& ul': {
    position: 'relative',
    paddingLeft: 0,
    margin: 0,
    display: 'inline-block',
    paddingTop: 'var(--gy)',           // فاصله تا نوار افقیِ خواهر/برادرها
  },

  '& li': {
    listStyle: 'none',
    display: 'inline-block',
    verticalAlign: 'top',
    position: 'relative',
    padding: 'var(--gy) var(--gx) 0 var(--gx)', // بالا = فاصله تا نوار افقی
  },

  // نیمه‌های نوار افقی بین خواهر/برادرها
  '& li::before, & li::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    width: '50%',
    height: 'var(--gy)',
    borderTop: `var(--lw) solid var(--lc)`,
  },
  '& li::before': { right: '50%' },
  '& li::after': { left: '50%' },

  // تک‌فرزندی: خط افقی لازم نیست
  '& li:only-child::before, & li:only-child::after': { display: 'none' },
  '& li:only-child': { paddingTop: 0 },

  // ابتدا/انتهای خواهر/برادرها: نیمه‌ی اضافی حذف + گوشه گرد
  '& li:first-of-type::before': { borderTop: 'none' },
  '& li:last-of-type::after': { borderTop: 'none' },
  '& li:last-of-type::before': {
    borderRight: `var(--lw) solid var(--lc)`,
    borderTopLeftRadius: 'var(--cr)',
  },
  '& li:first-of-type::after': {
    borderLeft: `var(--lw) solid var(--lc)`,
    borderTopRightRadius: 'var(--cr)',
  },

  // 👇 توجه: عمودیِ قدیمی را حذف کردیم تا اتصال دقیق را خودِ نود بکشد
  // '& ul ul::before':  << اینو نداشته باش
};


// ——— نود بازگشتی درخت
function OrgTreeNode({
  node,
  onEdit, onDelete, onEditVehiclePolicy, onGrantMonitors,
  currentUserId, currentUserRoleLevel, canDelete, roleSaType
}: {
  node: UserNode;
  onEdit?: (u: UserNode) => void;
  onDelete?: (u: UserNode) => void;
  onEditVehiclePolicy?: (u: UserNode) => void;
  onGrantMonitors?: (u: UserNode) => void;
  currentUserId?: number;
  currentUserRoleLevel?: number;
  canDelete?: boolean;
  roleSaType?: SAType
}) {
  const children = node.subordinates || [];
  return (

    <Box component="li">

      <NodeCard
        u={node}
        isRoot={node.role_level === 2}
        onEdit={onEdit}
        onDelete={onDelete}
        onEditVehiclePolicy={onEditVehiclePolicy}
        onGrantMonitors={onGrantMonitors}
        currentUserId={currentUserId}
        currentUserRoleLevel={currentUserRoleLevel}
        canDelete={canDelete}
        roleSaType={roleSaType}   // 👈 مهم
      />

      {children.length > 0 && (

        <Box component="ul">
          {children.map((ch: UserNode) => (
            <OrgTreeNode
              key={ch.id}
              node={ch}
              onEdit={onEdit}
              onDelete={onDelete}
              onEditVehiclePolicy={onEditVehiclePolicy}
              onGrantMonitors={onGrantMonitors}
              currentUserId={currentUserId}
              currentUserRoleLevel={currentUserRoleLevel}
              canDelete={canDelete}
              roleSaType={roleSaType}
            />
          ))}
        </Box>

      )}
    </Box>

  );
}



// ---------- LABELS ----------
const ROLE_LABELS_DEFAULT: Record<number, string> = {
  1: 'مدیرکل',
  2: 'سازمان',
  3: 'مدیر شعبه',
  4: 'مالک',
  5: 'تکنسین',
  6: 'راننده',
};

// همون SAType موجود شما: 'fleet' | 'device' | 'universal'
const ROLE_LABELS_FLEET: Partial<Record<number, string>> = {
  1: 'مدیرکل',
  2: 'سازمان',
  3: 'مدیریت شهر',
  4: 'مدیریت منطقه',
  5: 'مسئول خط',
  6: 'راننده',
};
declare global {
  // اگر User را در همین فایل دارید، همین‌جا آپدیت کنید
  interface User {
    sa_type?: SAType; // ممکن است سرور برگرداند
  }
}


export function roleLabel(level: number, saType?: SAType): string {
  if (saType === 'fleet' && ROLE_LABELS_FLEET[level]) {
    return ROLE_LABELS_FLEET[level]!;
  }
  return ROLE_LABELS_DEFAULT[level] ?? '---';
}
const actionLabels: Record<string, string> = {
  create_user: 'ایجاد کاربر',
  grant_sub_permissions: 'دادن نقش‌های زیرمجموعه',
  view_transaction: 'مشاهده تراکنش‌ها',
  view_report: 'مشاهده گزارش‌ها',
  control_device_remotely: 'کنترل از راه دور دستگاه',
  report_device_fault: 'ثبت خرابی دستگاه',
  chat: 'امکان چت',
  track_driver: 'ردیابی راننده‌ها',
  view_logs: 'مشاهده لاگ‌ها',
};
const actions = Object.keys(actionLabels);

// ========== MAIN PAGE ==========
export default function RoleManagementPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<UserNode[]>([]);
  // اگر لازم نیست، می‌تونی flatUsers رو حذف کنی
  const [flatUsers, setFlatUsers] = useState<{ id: number; full_name: string; role_level: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: me } = await api.get('/auth/me');
        setUser(me);

        if (me.role_level === 1) {
          const { data } = await api.get('/users/my-subordinates-flat');
          setTree(buildTree(
            data,
            { id: me.id, full_name: me.full_name, role_level: me.role_level, sa_type: (me as any).sa_type }
          ));
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div>در حال بارگذاری...</div>;
  if (!user) return <div>مشکل در دریافت اطلاعات کاربر</div>;

  // ⬇️ به‌جای return داخل switch، فقط body را مقداردهی کن
  let body: React.ReactNode;
  switch (user.role_level) {
    case 1:
      body = <ManagerRoleSection user={user} tree={tree} setTree={setTree} />;
      break;
    case 2:
      body = <SuperAdminRoleSection user={user} />;
      break;
    case 3:
      body = <BranchManagerRoleSection user={user} />;
      break;
    case 4:
      body = <OwnerRoleSection user={user} />;
      break;
    case 5:
      body = <TechnicianRoleSection user={user} />;
      break;
    case 6:
      body = <DriverRoleSection user={user} />; // اگر برای راننده هم لازم داشتی بعداً همین الگو
      break;
    default:
      body = <div>نقش کاربر شناسایی نشد.</div>;
  }

  return (
    <>
      {/* فقط یک‌بار اینجا؛ برای همهٔ نقش‌ها فعال است و بالای کارت نمایش می‌آید */}
      <AnalyticsHoverPortal />


      {body}
    </>);
}

interface UserNode {
  id: number;
  full_name: string;
  role_level: number;
  subordinates?: UserNode[];
}

interface UserNode extends User {
  subordinates?: UserNode[];
}

const VEHICLE_TYPES = [
  { code: 'bus', label: 'اتوبوس' },
  { code: 'minibus', label: 'مینی‌بوس' },
  { code: 'van', label: 'ون' },
  { code: 'tanker', label: 'تانکر آب' },
  { code: 'truck', label: 'کامیون' },
  { code: 'khavar', label: 'خاور' },
  { code: 'sedan', label: 'سواری' },
  { code: 'pickup', label: 'وانت' },
] as const;

type VehicleTypeCode = typeof VEHICLE_TYPES[number]['code'];

// پارامترهای مانیتورینگ قابل انتخاب برای هر نوع خودرو
const MONITOR_PARAMS = [
  { key: 'gps', label: 'GPS / موقعیت لحظه‌ای' },
  { key: 'ignition', label: 'وضعیت سوییچ (روشن/خاموش)' },
  { key: 'idle_time', label: 'مدت توقف/سکون' },
  { key: 'odometer', label: 'کیلومترشمار' },
  { key: 'geo_fence', label: 'ژئوفنس/منطقه مجاز' },
  { key: 'stations', label: 'تعریف ایستگاه' },
  { key: 'routes', label: 'تعریف مسیر' },
  { key: 'consumables', label: 'چک تعویض لوازم مصرفی' },
] as const;
type MonitorKey = typeof MONITOR_PARAMS[number]['key'];



function VehicleQuotaDialog({
  open,
  onClose,
  superAdmin,
}: {
  open: boolean;
  onClose: (changed?: boolean) => void;
  superAdmin: UserNode | null;
}) {
  const VEHICLE_TYPES = [
    { code: 'bus', label: 'اتوبوس' },
    { code: 'minibus', label: 'مینی‌بوس' },
    { code: 'van', label: 'ون' },
    { code: 'tanker', label: 'تانکر آب' },
    { code: 'truck', label: 'کامیون' },
    { code: 'khavar', label: 'خاور' },
    { code: 'sedan', label: 'سواری' },
    { code: 'pickup', label: 'وانت' },
  ] as const;
  type VehicleTypeCode = typeof VEHICLE_TYPES[number]['code'];

  const MONITOR_PARAMS = [
    { key: 'gps', label: 'GPS / موقعیت لحظه‌ای' },
    { key: 'ignition', label: 'وضعیت سوییچ (روشن/خاموش)' },
    { key: 'idle_time', label: 'مدت توقف/سکون' },
    { key: 'odometer', label: 'کیلومترشمار' },
    { key: 'geo_fence', label: 'ژئوفنس/منطقه مجاز' },
    { key: 'stations', label: 'تعریف ایستگاه' },
    { key: 'routes', label: 'تعریف مسیر' },
    { key: 'consumables', label: 'چک تعویض لوازم مصرفی' },
  ] as const;
  type MonitorKey = typeof MONITOR_PARAMS[number]['key'];

  const COUNTRY_OPTS = [
    { code: 'IR', label: 'ایران' },
    { code: 'QA', label: 'قطر' },
    { code: 'AE', label: 'امارات' },
    { code: 'IQ', label: 'عراق' },
    { code: 'AF', label: 'افغانستان' },
    { code: 'TM', label: 'ترکمنستان' },
    { code: 'TR', label: 'ترکیه' },
  ] as const;
  type CountryCode = typeof COUNTRY_OPTS[number]['code'];

  type VehiclePolicy = {
    vehicle_type_code: VehicleTypeCode;
    is_allowed: boolean;
    max_count: number;
    monitor_params: MonitorKey[];
  };

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [policies, setPolicies] = useState<Record<VehicleTypeCode, VehiclePolicy>>(() => {
    const init: Record<VehicleTypeCode, VehiclePolicy> = {} as any;
    VEHICLE_TYPES.forEach(t => {
      init[t.code] = {
        vehicle_type_code: t.code,
        is_allowed: false,
        max_count: 0,
        monitor_params: [],
      };
    });
    return init;
  });

  const [expanded, setExpanded] = useState<Record<VehicleTypeCode, boolean>>({} as any);

  // کشورها
  const [allowedCountries, setAllowedCountries] = useState<CountryCode[]>([]);

  useEffect(() => {
    if (!open || !superAdmin) return;
    const run = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        // سیاست‌های فعلی
        const { data: vehiclePolicies } = await api.get(`/vehicle-policies/user/${superAdmin.id}`);
        const next: Record<VehicleTypeCode, VehiclePolicy> = {} as any;
        const exp: Record<VehicleTypeCode, boolean> = {} as any;
        VEHICLE_TYPES.forEach(t => {
          const found = vehiclePolicies.find((p: any) => p.vehicle_type_code === t.code);
          const allowed = !!found?.is_allowed;
          next[t.code] = {
            vehicle_type_code: t.code,
            is_allowed: allowed,
            max_count: Number(found?.max_count) || 0,
            monitor_params: Array.isArray(found?.monitor_params) ? found.monitor_params : [],
          };
          exp[t.code] = allowed;
        });
        setPolicies(next);
        setExpanded(exp);

        // کشورها
        const { data: countries } = await api.get(`/country-policies/user/${superAdmin.id}`);
        setAllowedCountries(countries || []);
      } catch (e: any) {
        setErrorMsg(e?.response?.data?.message || 'خطا در دریافت اطلاعات');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [open, superAdmin]);

  const toggleAllowed = (code: VehicleTypeCode, checked: boolean) => {
    setPolicies(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        is_allowed: checked,
        max_count: checked ? Math.max(prev[code].max_count, 1) : 0,
      },
    }));
    setExpanded(prev => ({ ...prev, [code]: checked }));
  };

  const changeMax = (code: VehicleTypeCode, value: string) => {
    const num = Math.max(0, Number(value) || 0);
    setPolicies(prev => ({ ...prev, [code]: { ...prev[code], max_count: num } }));
  };

  const toggleMonitor = (code: VehicleTypeCode, key: MonitorKey, checked: boolean) => {
    setPolicies(prev => {
      const set = new Set(prev[code].monitor_params);
      if (checked) set.add(key); else set.delete(key);
      return {
        ...prev,
        [code]: { ...prev[code], monitor_params: Array.from(set) as MonitorKey[] },
      };
    });
  };

  const toggleCountry = (code: CountryCode, checked: boolean) => {
    setAllowedCountries(prev => {
      const s = new Set(prev);
      if (checked) s.add(code); else s.delete(code);
      return Array.from(s) as CountryCode[];
    });
  };

  const handleSave = async () => {
    if (!superAdmin) return;
    setLoading(true);
    setErrorMsg('');
    try {
      // ذخیره کشورها
      await api.put(`/country-policies/user/${superAdmin.id}`, { countries: allowedCountries });
      // ذخیره سیاست وسایل
      const payload = { policies: VEHICLE_TYPES.map(t => policies[t.code]) };
      await api.put(`/vehicle-policies/user/${superAdmin.id}`, payload);
      onClose(true);
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.message || 'ذخیره‌سازی ناموفق بود');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} fullWidth>
      <DialogTitle>سهمیه و مجوز — {superAdmin && displayName(superAdmin)}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <div>در حال بارگذاری...</div>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {errorMsg && <Box sx={{ color: 'error.main' }}>{errorMsg}</Box>}

            {/* بخش انتخاب کشورها */}
            <Box sx={{ border: '1px solid #ccc', borderRadius: 1, p: 2 }}>
              <Box sx={{ fontWeight: 600, mb: 1 }}>کشورهای مجاز پلاک</Box>
              <FormGroup>
                <Grid container spacing={1}>
                  {COUNTRY_OPTS.map(c => (
                    <Grid item xs={12} sm={6} md={4} key={c.code}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={allowedCountries.includes(c.code)}
                            onChange={(e) => toggleCountry(c.code, e.target.checked)}
                          />
                        }
                        label={c.label}
                      />
                    </Grid>
                  ))}
                </Grid>
              </FormGroup>
            </Box>

            {/* لیست انواع خودرو */}
            {VEHICLE_TYPES.map(t => {
              const pol = policies[t.code];
              const openRow = !!expanded[t.code];

              return (
                <Box key={t.code} sx={{ border: '1px solid #eee', borderRadius: 1, p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={pol.is_allowed}
                          onChange={e => toggleAllowed(t.code, e.target.checked)}
                        />
                      }
                      label={t.label}
                    />
                    <IconButton onClick={() => setExpanded(prev => ({ ...prev, [t.code]: !openRow }))} disabled={!pol.is_allowed}>
                      {openRow ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>

                  <Collapse in={openRow} timeout="auto" unmountOnExit>
                    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        label="حداکثر مجاز"
                        type="number"
                        size="small"
                        value={pol.max_count}
                        onChange={e => changeMax(t.code, e.target.value)}
                        inputProps={{ min: 0 }}
                        sx={{ maxWidth: 240 }}
                      />

                      <Box sx={{ fontWeight: 600, fontSize: 14 }}>پارامترهای مانیتورینگ</Box>
                      <FormGroup>
                        <Grid container spacing={1}>
                          {MONITOR_PARAMS.map(mp => (
                            <Grid item xs={12} sm={6} md={4} key={mp.key}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={pol.monitor_params.includes(mp.key as any)}
                                    onChange={(e) => toggleMonitor(t.code, mp.key as any, e.target.checked)}
                                  />
                                }
                                label={mp.label}
                              />
                            </Grid>
                          ))}
                        </Grid>
                      </FormGroup>
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Magnetic>
          <Button onClick={() => onClose(false)} disabled={loading}>انصراف</Button></Magnetic>

        <Magnetic>
          <Button variant="contained" onClick={handleSave} disabled={loading}>ذخیره</Button></Magnetic>

      </DialogActions>
    </Dialog>
  );
}
// کمک‌تابع: پیدا کردن نود با id داخل درخت
function findNodeById(root: UserNode | undefined, id: number | null): UserNode | null {
  if (!root || id == null) return null;
  if (root.id === id) return root;
  for (const ch of root.subordinates || []) {
    const f = findNodeById(ch, id);
    if (f) return f;
  }
  return null;
}

// نوار بالای صفحه: لیست سوپراَدمین‌ها برای انتخاب
function SuperAdminStrip({
  items, selectedId, onSelect,
}: {
  items: UserNode[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
      {items.map((sa: UserNode) => (
        <Paper
          key={sa.id}
          onClick={() => onSelect(sa.id)}


          sx={(t) => ({
            cursor: 'pointer',
            px: 1.25, py: 1,
            borderRadius: 12,
            minWidth: 220,
            display: 'flex', alignItems: 'center', gap: 1,
            ...fancyBorderRoyal(t),
            boxShadow: selectedId === sa.id ? `0 10px 24px ${alpha(royal.c2, .18)}` : 'none',
            opacity: selectedId && selectedId !== sa.id ? .7 : 1,
            transition: 'all .18s ease',
            '&:hover': { transform: 'translateY(-2px)' },
          })}
        >
          <Avatar sx={{ width: 34, height: 34, background: `linear-gradient(135deg, ${royal.c1}, ${royal.c2})`, color: '#fff' }}>
            {displayName(sa).slice(0, 1)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap fontWeight={700}>{displayName(sa)}</Typography>
            <Typography noWrap variant="caption" sx={{ color: royal.c2 }}>
              ({roleLabel(2, (sa as any).sa_type)})
            </Typography>
          </Box>
        </Paper>
      ))}
    </Stack>
  );
}

// درخت «همیشه باز»: بدون Collapse/Expand — کل زیرشاخه‌ها یکجا
function AlwaysOpenTree({
  root,
  currentUserId,
  currentUserRoleLevel,
  canDelete,
  onEdit,
  onDelete,
  onEditVehiclePolicy,
  onGrantMonitors,
  roleSaType
}: {
  root: UserNode;
  currentUserId: number;
  currentUserRoleLevel: number;
  canDelete?: boolean;
  onEdit?: (u: UserNode) => void;
  onDelete?: (u: UserNode) => void;
  onEditVehiclePolicy?: (u: UserNode) => void;
  onGrantMonitors?: (u: UserNode) => void;
  roleSaType?: SAType;
}) {
  const render = (u: UserNode, depth = 0) => (
    <Box
      key={u.id}
      sx={{
        position: 'relative',
        ml: depth ? 3 : 0,
        // نمایش خط‌های درختی
        ...(depth > 0 && {
          '&::before': {
            content: '""',
            position: 'absolute',
            right: 'calc(100% - 12px)',
            top: 0, bottom: 0,
            borderRight: '1px dashed',
            borderColor: alpha(royal.c1, .25),
          },
        }),
      }}
    >
      <UserCard
        u={u}
        isRoot={depth === 0}
        onEdit={onEdit}
        onDelete={onDelete}
        onEditVehiclePolicy={onEditVehiclePolicy}
        onGrantMonitors={onGrantMonitors}
        currentUserId={currentUserId}
        currentUserRoleLevel={currentUserRoleLevel}
        canDelete={!!canDelete}
        roleSaType={roleSaType}

      />
      {(u.subordinates || []).map(ch => render(ch, depth + 1))}
    </Box>
  );

  return <Box>{render(root, 0)}</Box>;
}

// ========== نمایش بازگشتی درخت ==========
function UserTreeList({
  users,
  onEdit,
  onEditVehiclePolicy,
  currentUserRoleLevel,
  currentUserId,                 // 👈 جدید
  onEditCountryPolicy,
  onAddVehicle,              // ⬅️ جدید
  onGrantMonitors,          // ⬅️ جدید
  onManageVehicles,      // 👈 جدید
  onDelete,
  canDelete,
  roleSaType
}: {
  users: UserNode[];
  onEdit?: (u: UserNode) => void;
  onEditVehiclePolicy?: (u: UserNode) => void;
  currentUserRoleLevel?: number; // 1 = مدیرکل
  onEditCountryPolicy?: (u: UserNode) => void;   // ⬅️ جدید
  currentUserId?: number;
  onAddVehicle?: (u: UserNode) => void;  // ⬅️ جدید
  onGrantMonitors?: (u: UserNode) => void;  // ⬅️ جدید
  onManageVehicles?: (u: UserNode) => void;   // 👈 جدید
  onDelete?: (u: UserNode) => void;   // ✔ جدید
  canDelete?: boolean;
  roleSaType?: SAType;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (u: UserNode) => {
    const hasChildren = !!u.subordinates && u.subordinates.length > 0;
    const isOpen = expanded.has(u.id);

    return (
      <Box key={u.id} sx={{ ml: 2 }}>
        <ListItem
          disableGutters
          onClick={() => hasChildren && toggle(u.id)}
          secondaryAction={
            <>
              {/* مدیرکل → آیکون سهمیه/مجوز نوع خودرو برای سوپرادمین‌ها */}
              {onEditVehiclePolicy &&
                currentUserRoleLevel === 1 &&
                u.role_level === 2 && (
                  <IconButton
                    edge="end"
                    onClick={(e) => { e.stopPropagation(); onEditVehiclePolicy(u); }}
                    title="سهمیه و مجوز ماشین‌ها"
                    sx={{ mr: 1 }}
                  >
                    <DirectionsBusIcon />
                  </IconButton>
                )}


              {/* حذف کاربر (برای نقش 2: فقط زیرمجموعه‌ها | برای نقش 1: هر کسی پایین‌تر از خودش) */}
              {onDelete && u.id !== currentUserId && (
                ((currentUserRoleLevel === 1 && u.role_level > 1) ||             // مدیرکل: همه پایین‌تر
                  (currentUserRoleLevel === 2 && canDelete && u.role_level > 2))  // SA: فقط اگر تیک create_user دارد
                && (
                  <IconButton
                    edge="end"
                    color="error"
                    onClick={(e) => { e.stopPropagation(); onDelete(u); }}
                    title="حذف کاربر"
                    sx={{ mr: 1 }}
                  >
                    <DeleteIcon />
                  </IconButton>
                )
              )}


              {/* آیکون «ماشین» — واگذاری پرمیشن‌های مانیتورینگ برای زیرمجموعه‌ها */}
              {onGrantMonitors && currentUserRoleLevel === 2 && u.role_level > 2 && (
                <IconButton
                  edge="end"
                  onClick={(e) => { e.stopPropagation(); onGrantMonitors(u); }}
                  title="واگذاری پرمیشن‌های مانیتورینگ"
                  sx={{ mr: 1 }}
                >
                  <DirectionsBusIcon />
                </IconButton>
              )}

              {/* آیکن ویرایش — مدیرکل: فقط روی سوپرادمین‌ها | سوپرادمین: فقط روی زیرمجموعه‌ها (نه خودش) */}
              {onEdit &&
                (
                  (currentUserRoleLevel === 2 && u.role_level > 2 && u.id !== currentUserId) || // سوپرادمین
                  (currentUserRoleLevel === 1 && u.role_level === 2)                            // مدیرکل
                ) && (
                  <IconButton
                    edge="end"
                    onClick={(e) => { e.stopPropagation(); onEdit(u); }}
                    title="ویرایش کاربر"
                  >
                    <EditIcon />
                  </IconButton>
                )}

              {hasChildren && (
                <IconButton
                  edge="end"
                  onClick={(e) => { e.stopPropagation(); toggle(u.id); }}
                >
                  {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              )}
            </>
          }

        >
          <ListItemText
            primary={
              <span style={{ fontWeight: u.role_level <= 2 ? 'bold' : 'normal' }}>
                {displayName(u)} <small>({roleLabel(u.role_level, (u as any).sa_type ?? roleSaType)})</small>
              </span>
            }
          />
        </ListItem>
        {hasChildren && (
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{ ml: 4 }}>
              {u.subordinates!.map(child => renderNode(child))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  if (!users || users.length === 0)
    return <span style={{ color: '#aaa' }}>زیرمجموعه‌ای وجود ندارد.</span>;

  return <List sx={{ width: '100%' }}>{users.map(renderNode)}</List>;
}








// مرحله ۲: والد هر کاربر رو پیدا کن و به children اضافه کن
function buildTree(
  flatUsers: User[],
  root: { id: number; full_name: string; role_level: number; sa_type?: SAType }, // 👈 این خط
): UserNode[] {
  const map = new Map<number, UserNode>();
  const roots: UserNode[] = [];

  const base = flatUsers.some(u => u.id === root.id)
    ? flatUsers
    : [{
      id: root.id, full_name: root.full_name, role_level: root.role_level, sa_type: root.sa_type,           // ←← مهم
    } as User, ...flatUsers];

  base.forEach(u => map.set(u.id, { ...u, subordinates: [] }));

  base.forEach(u => {
    const pid = u.parent_id ?? null;
    if (pid && pid !== u.id && map.has(pid)) {
      map.get(pid)!.subordinates!.push(map.get(u.id)!);
    } else if (u.id === root.id) {
      roots.push(map.get(u.id)!);
    }
  });

  return roots;
}



// ========== دیالوگ افزودن/ویرایش ==========



export function SuperAdminFormDialog({
  open,
  onClose,
  onSubmit,
  initialData
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: any;
}) {
  const [form, setForm] = useState<{
    full_name: string;
    phone: string;
    password: string;

    permissions: { action: string; is_allowed: boolean }[];
    sa_type: SAType;
  }>({
    full_name: '',
    phone: '',
    password: '',
    permissions: actions.map(action => ({ action, is_allowed: false })),
    sa_type: 'fleet',                // 👈 پیش‌فرض

  });

  useEffect(() => {
    if (initialData) {
      setForm({
        full_name: initialData.full_name ?? '',
        phone: initialData.phone ?? '',
        // اگه می‌خوای موقع ادیت پسورد خالی باشه، بذار '' — ولی چون خودت گذاشته بودی همونو نگه داشتم
        password: initialData.password ?? '',
        permissions: actions.map(action => ({
          action,
          is_allowed:
            initialData.permissions?.find((p: any) => p.action === action)?.is_allowed ?? false,
        })),
        sa_type: (initialData.sa_type as SAType) ?? 'fleet',   // 👈 اگر از سرور آمد

      });
    } else {
      setForm({
        full_name: '',
        phone: '',
        password: '',
        permissions: actions.map(action => ({ action, is_allowed: false })),
        sa_type: 'fleet',                                      // 👈 پیش‌فرض

      });
    }
  }, [initialData, open]);

  const handleCheck = (action: string, checked: boolean) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.map(p =>
        p.action === action ? { ...p, is_allowed: checked } : p
      ),
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  // ✅ این تابع همونیه که نداشتی
  const handleSubmit = () => {
    onSubmit(form);
  };

  return (

    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>{initialData ? 'ویرایش سوپرادمین' : 'افزودن سوپرادمین جدید'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="نام کامل"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={6}>
            <TextField
              label="شماره موبایل"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              fullWidth
            />
          </Grid>

          <Grid item xs={6}>
            <TextField
              label="رمز عبور"
              type="text"
              name="password"
              value={form.password}
              onChange={handleChange}
              fullWidth
            />
          </Grid>

          <Grid item xs={12}><b>مجوزها:</b></Grid>
          <Grid item xs={12}>
            <FormGroup>
              {actions.map(action => (
                <FormControlLabel
                  key={action}
                  control={
                    <Checkbox
                      checked={form.permissions.find(p => p.action === action)?.is_allowed || false}
                      onChange={e => handleCheck(action, e.target.checked)}
                    />
                  }
                  label={actionLabels[action]}
                />
              ))}
            </FormGroup>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ fontWeight: 700, mb: 1 }}>نوع سوپرادمین</Box>

            <FormGroup row>
              {SA_TYPE_OPTS.map(opt => (
                <FormControlLabel
                  key={opt.value}
                  control={
                    <Radio
                      checked={form.sa_type === opt.value}
                      onChange={() => setForm(f => ({ ...f, sa_type: opt.value }))}
                    />
                  }
                  label={opt.label}
                />
              ))}
            </FormGroup>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>انصراف</Button>
        <Button onClick={handleSubmit} variant="contained">
          {initialData ? 'ذخیره تغییرات' : 'افزودن'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


async function fetchSuperAdminPermissions(id: number) {
  // لیست مجوزها را از بک‌اند می‌گیرد
  const { data: permissions } = await api.get(`/role-permissions/user/${id}`);
  return permissions;
}


// ========== بخش مدیرکل ==========
function ManagerRoleSection({
  user,
  tree,
  setTree
}: {
  user: User;
  tree: UserNode[];
  setTree: React.Dispatch<React.SetStateAction<UserNode[]>>;
}) {
  // +++ کنار سایر state ها
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const openSidebar = () => setSidebarOpen(true);
  const closeSidebar = () => setSidebarOpen(false);

  const [editData, setEditData] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedSaType, setSelectedSaType] = useState<SAType | undefined>(undefined);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySA, setCountrySA] = useState<UserNode | null>(null);

  const handleEditCountryPolicy = (sa: UserNode) => {
    setCountrySA(sa);
    setCountryOpen(true);
  };
  const [canDelete, setCanDelete] = useState(false);

  const checkPermissionBasics = async () => {
    try {
      const { data: mine } = await api.get(`/role-permissions/user/${user.id}`);
      const allowed = (mine || []).filter((p: any) => p.is_allowed);
      const hasCreate = !!allowed.find((p: any) => p.action === 'create_user');

      // مدیرکل: همیشه اجازه حذف دارد. سوپرادمین: اگر create_user داشته باشد.
      setCanDelete(user.role_level === 1 || hasCreate);
    } catch {
      setCanDelete(user.role_level === 1); // حتی اگر خطا، مدیرکل بتواند
    }
  };

  const handleDeleteUser = async (u: UserNode) => {
    if (!canDelete) return;
    if (!u) return;
    if (u.id === user.id) { alert('نمی‌توانید خودتان را حذف کنید.'); return; }
    if (u.role_level <= user.role_level) { alert('فقط کاربر با نقش پایین‌تر را می‌توانید حذف کنید.'); return; }
    if (!confirm(`کاربر «${u.full_name ?? u.id}» حذف شود؟`)) return;

    try {
      await api.delete(`/users/${u.id}`);
      await refreshTree();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'حذف ناموفق بود');
    }
  };

  useEffect(() => { checkPermissionBasics(); }, []);

  // ⬇️ جدید
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policySA, setPolicySA] = useState<UserNode | null>(null);

  const refreshTree = async () => {
    setTreeLoading(true);
    const { data } = await api.get('/users/my-subordinates-flat');
    setTree(buildTree(
      data,
      { id: user.id, full_name: user.full_name, role_level: user.role_level, sa_type: (user as any).sa_type }
    ));

    setTreeLoading(false);
  };

  // داخل ManagerRoleSection
  const handleEdit = async (sa: UserNode) => {
    // هم‌زمان پروفایل کاربر و مجوزها رو بگیر
    const [{ data: userRow }, permissions] = await Promise.all([
      api.get(`/users/${sa.id}`),               // ← از دیتابیس: phone و ... میاد
      fetchSuperAdminPermissions(sa.id),        // ← همین که داشتی
    ]);

    // مقداردهی اولیه برای فرم ادیت
    setEditData({
      ...sa,
      phone: userRow?.phone ?? '',              // ← شماره از دیتابیس
      permissions,
    });
  };


  // ⬇️ جدید
  const handleEditVehiclePolicy = (sa: UserNode) => {
    setPolicySA(sa);
    setPolicyOpen(true);
  };
  const saList = useMemo<UserNode[]>(() => {
    const root = tree?.[0];
    const children = root?.subordinates || [];
    return children.filter(u => u.role_level === 2);
  }, [tree]);

  const [selectedSAId, setSelectedSAId] = useState<number | null>(null);

  // انتخاب پیش‌فرض: اولین SA
  useEffect(() => {
    if (saList.length && (selectedSAId == null || !saList.find(sa => sa.id === selectedSAId))) {
      setSelectedSAId(saList[0].id);
    }
  }, [saList, selectedSAId]);
  // هر بار SA تغییر کرد، نوعش را از سرور بگیر (تا اگر در فلَت نبود، اینجا داشته باشیم)
  useEffect(() => {
    (async () => {
      if (!selectedSAId) { setSelectedSaType(undefined); return; }
      try {
        const { data: saRow } = await api.get(`/users/${selectedSAId}`);
        setSelectedSaType(saRow?.sa_type as SAType | undefined);
      } catch {
        setSelectedSaType(undefined);
      }
    })();
  }, [selectedSAId]);
  // نود انتخابی (با تمام زیرمجموعه‌ها)
  const selectedSANode = useMemo(
    () => findNodeById(tree?.[0], selectedSAId ?? null),
    [tree, selectedSAId]
  );
  return (

    <div>
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

      <h2>مدیریت نقش‌ها (مدیرکل)</h2>

      <Button variant="contained" onClick={() => setAddOpen(true)} sx={{ mb: 2 }} >
        افزودن سوپرادمین جدید
      </Button>

      {/* نوار انتخاب سوپرادمین‌ها در بالا */}
      {treeLoading ? (
        <div className="fade-in-up">در حال بروزرسانی...</div>
      ) : saList.length === 0 ? (
        <div style={{ color: '#4b5563' }} data-badge className="fade-in-up">سوپرادمینی یافت نشد.</div>
      ) : (
        <>
          <SuperAdminStrip
            items={saList}
            selectedId={selectedSAId}
            onSelect={setSelectedSAId}
          />

          {/* ... بالاتر SuperAdminStrip و انتخاب SA ... */}

          {selectedSANode ? (
            <ScrollViewport height="calc(100vh - 240px)">
              <Box sx={orgTreeSx}>
                <Box component="ul">
                  <OrgTreeNode
                    node={selectedSANode}
                    onEdit={handleEdit}
                    onDelete={handleDeleteUser}
                    onEditVehiclePolicy={handleEditVehiclePolicy}
                    onGrantMonitors={(_u) => { }}
                    currentUserId={user.id}
                    currentUserRoleLevel={user.role_level}
                    canDelete
                    roleSaType={(selectedSANode as any)?.sa_type ?? selectedSaType} />
                </Box>
              </Box>
            </ScrollViewport>
          ) : (
            <div style={{ color: '#888' }}>یک سوپرادمین را انتخاب کنید.</div>
          )}


        </>
      )}


      {/* افزودن سوپرادمین */}
      // افزودن
      <SuperAdminFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={async (data) => {
          setAddLoading(true);
          // 1) بساز
          const { data: created } = await api.post('/users', {
            ...data,
            role_level: 2,
            permissions: data.permissions,
            sa_type: data.sa_type,
          });
          // 2) کَسکید نوع روی زیرمجموعه‌ها
          await api.post(`/users/${created.id}/cascade-sa-type`, { sa_type: data.sa_type });

          setAddOpen(false);
          await refreshTree();
          setAddLoading(false);
        }}
      />


      {/* ویرایش سوپرادمین */}
      <SuperAdminFormDialog
        open={!!editData}
        onClose={() => setEditData(null)}
        initialData={editData || undefined}
        onSubmit={async (data) => {
          // 1) خود SA را آپدیت کن
          await api.put(`/users/${editData.id}`, {
            full_name: data.full_name,
            phone: data.phone,
            password: data.password,
            sa_type: data.sa_type,
          });
          // 2) مجوزها (مثل قبل)
          await api.put(`/role-permissions/user/${editData.id}`, { permissions: data.permissions });
          // 3) کَسکید روی همهٔ زیرمجموعه‌ها
          await api.post(`/users/${editData.id}/cascade-sa-type`, { sa_type: data.sa_type });

          setEditData(null);
          await refreshTree();
        }}
      />


      {/* ⬇️ Dialog سهمیه ماشین‌ها */}
      <VehicleQuotaDialog
        open={policyOpen}
        superAdmin={policySA}
        onClose={async (changed) => {
          setPolicyOpen(false);
          setPolicySA(null);
          if (changed) {
            // اگر لازم داری چیزی رفرش بشه
            // await refreshTree();
          }
        }}
      />
    </div>
  );

}





// ====== سایر نقش‌ها با همان استایل قبلی ======
function SuperAdminRoleSection({ user }: { user: User }) {
  // +++ کنار سایر state ها
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const openSidebar = () => setSidebarOpen(true);
  const closeSidebar = () => setSidebarOpen(false);

  const [tree, setTree] = useState<UserNode[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [vehOpen, setVehOpen] = useState(false);
  const handleOpenVehicle = () => setVehOpen(true);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantTarget, setGrantTarget] = useState<UserNode | null>(null);
  const [saType, setSaType] = useState<SAType | undefined>(user.sa_type as SAType | undefined);
  const handleAddVehicleFromTree = (_u: UserNode) => setVehOpen(true);
  const [vehAccessOpen, setVehAccessOpen] = useState(false);
  const [vehAccessUser, setVehAccessUser] = useState<UserNode | null>(null);
  const [canDelete, setCanDelete] = useState(false); // ⬅️ جدید

  const openVehAccess = (u: UserNode) => { setVehAccessUser(u); setVehAccessOpen(true); };
  const [canCreate, setCanCreate] = useState(false);
  const [canGrant, setCanGrant] = useState(false);

  // نوع خودرو => کلیدهایی که SA اجازه واگذاری‌شان را دارد
  const [grantableMap, setGrantableMap] =
    useState<Record<VehicleTypeCode, MonitorKey[]>>({} as any);


  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/users/${user.id}`);
        setSaType((data?.sa_type as SAType) ?? (user.sa_type as SAType | undefined));
      } catch {
        setSaType((user.sa_type as SAType | undefined) ?? undefined);
      }
    })();
  }, [user.id]);

  const fetchSubordinates = async () => {
    const { data } = await api.get('/users/my-subordinates-flat');
    // ریشه را با sa_type قطعی بساز تا درخت برچسب‌های فلیتی بگیرد
    setTree(buildTree(
      data,
      { id: user.id, full_name: user.full_name, role_level: user.role_level, sa_type: saType }
    ));
  };
  const checkPermissionBasics = async () => {
    try {
      const { data: mine } = await api.get(`/role-permissions/user/${user.id}`);
      const allowed = (mine || []).filter((p: any) => p.is_allowed);

      const hasCreate = !!allowed.find((p: any) => p.action === 'create_user');
      const hasGrant = !!allowed.find((p: any) => p.action === 'grant_sub_permissions');

      setCanCreate(hasCreate);
      setCanGrant(hasGrant);
      setCanDelete(hasCreate); // ✔ همان تیک ساخت کاربر ⇒ اجازه حذف
    } catch {
      setCanCreate(false);
      setCanGrant(false);
      setCanDelete(false);
    }
  };

  const handleDeleteUser = async (u: UserNode) => {
    if (!canDelete) return;
    if (!u) return;
    if (u.id === user.id) { alert('نمی‌توانید خودتان را حذف کنید.'); return; }
    if (u.role_level <= user.role_level) { alert('فقط کاربر با نقش پایین‌تر را می‌توانید حذف کنید.'); return; }
    if (!confirm(`کاربر «${u.full_name ?? u.id}» حذف شود؟`)) return;

    try {
      await api.delete(`/users/${u.id}`);
      await fetchSubordinates();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'حذف ناموفق بود');
    }
  };
  const fetchGrantable = async () => {
    try {
      const { data } = await api.get('/vehicle-policies/grantable');
      const map: Record<VehicleTypeCode, MonitorKey[]> = {} as any;
      (data || []).forEach((p: any) => {
        if (p.is_allowed) {
          map[p.vehicle_type_code as VehicleTypeCode] =
            Array.isArray(p.monitor_params) ? (p.monitor_params as MonitorKey[]) : [];
        }
      });
      setGrantableMap(map); // حتی اگر آرایه مانیتور خالی باشد، کلید type می‌ماند
    } catch (e) {
      console.error('grantable fetch error:', e);
      setGrantableMap({} as any);
    }
  };

  useEffect(() => {
    fetchSubordinates();
  }, [saType]);

  useEffect(() => {
    checkPermissionBasics();
    fetchGrantable();
  }, []);

  useEffect(() => { if (addOpen) fetchGrantable(); }, [addOpen]);
  useEffect(() => { if (editOpen) fetchGrantable(); }, [editOpen]);

  const handleEditUser = async (u: UserNode) => {
    try {
      const { data: userRow } = await api.get(`/users/${u.id}`);
      setEditUser({ ...u, ...userRow });
      setEditOpen(true);
    } catch (e) { console.error(e); }
  };

  return (
    <div>
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

      <h2>مدیریت نقش‌ها ({roleLabel(user.role_level, saType)})</h2>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {canCreate && (
          <Magnetic>

            <Button variant="contained" onClick={() => setAddOpen(true)}>
              افزودن کاربر جدید
            </Button>
          </Magnetic>

        )}
        <Magnetic>

          <Button startIcon={<DirectionsBusIcon />} onClick={() => setVehOpen(true)}>
            افزودن ماشین
          </Button>
        </Magnetic>

      </Box>

      <h3>زیرمجموعه‌ها:</h3>
      {tree.length > 0 ? (
        <ScrollViewport height="calc(100vh - 240px)">
          <Box sx={orgTreeSx}>
            <Box component="ul">
              <OrgTreeNode
                node={tree[0]}                        // ریشه = خودِ سوپرادمین
                onEdit={handleEditUser}               // ✏️ ویرایش همان قبلی
                onDelete={handleDeleteUser}           // 🗑️ حذف
                onGrantMonitors={(u) => {             // 🚌 واگذاری مانیتورینگ/ماشین
                  setGrantTarget(u);
                  setGrantOpen(true);
                }}
                // اگر برای SA هم دیالوگ مدیریت ماشین/پالیسی داری و میخوای روی کارت نشان بدهی:
                onEditVehiclePolicy={undefined}       // معمولاً برای Manager روی SAهاست؛ برای SA میتونی undefined بگذاری
                currentUserId={user.id}
                currentUserRoleLevel={user.role_level}
                canDelete={canDelete}
                roleSaType={saType} />
            </Box>
          </Box>
        </ScrollViewport>
      ) : (
        <div style={{ color: '#aaa' }}>هیچ زیرمجموعه‌ای ثبت نشده است.</div>
      )}

      {/* دیالوگ مدیریت دسترسیِ ماشین برای زیرمجموعه */}
      <SubUserVehicleAccessDialog
        open={vehAccessOpen}
        onClose={() => { setVehAccessOpen(false); setVehAccessUser(null); }}
        subUser={vehAccessUser}
        ownerId={user.id}
        grantableMap={grantableMap}
      />
      {canCreate && (
        <AddUserDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          parentId={user.id}
          onCreated={fetchSubordinates}
          canGrant={canGrant}
          grantableMap={grantableMap}
          saType={saType}
        />
      )}

      <EditUserDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        data={editUser}
        canGrant={canGrant}
        grantableMap={grantableMap}
        onSaved={async () => {
          setEditOpen(false);
          await fetchSubordinates();
        }}
        roleSaType={saType}                    // ✅
      />
      {/* ⬇️ همین‌جا اضافه کن */}
      <AddVehicleDialog
        open={vehOpen}
        onClose={() => setVehOpen(false)}
        ownerId={user.id}                // ماشین به نام همین SA
        onCreated={fetchSubordinates}
      />
      <GrantMonitorDialog
        open={grantOpen}
        onClose={() => { setGrantOpen(false); setGrantTarget(null); }}
        targetUser={grantTarget}
        grantableMap={grantableMap}
      />
    </div>
  );
}

function GrantMonitorDialog({
  open,
  onClose,
  targetUser,
  grantableMap,
}: {
  open: boolean;
  onClose: (changed?: boolean) => void;
  targetUser: UserNode | null;
  grantableMap: Record<VehicleTypeCode, MonitorKey[]>;
}) {
  const [loading, setLoading] = useState(false);
  const [perType, setPerType] = useState<Record<VehicleTypeCode, Set<MonitorKey>>>({} as any);
  const hasAnyGrantable = Object.keys(grantableMap || {}).length > 0;
  // +++ کنار سایر state ها
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const openSidebar = () => setSidebarOpen(true);
  const closeSidebar = () => setSidebarOpen(false);
  const [vehLoading, setVehLoading] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehIds, setSelectedVehIds] = useState<Set<number>>(new Set());
  const [vehQuery, setVehQuery] = useState('');
  const [vehTypeFilter, setVehTypeFilter] = useState<VehicleTypeCode | ''>('');
  const pageSize = 500; // یا هر مقدار مناسب
  useEffect(() => {
    if (!open) return;
    // اگر user هدف مشخص نیست، بخش ماشین‌ها را هم خالی کن
    if (!targetUser?.id) { setVehicles([]); setSelectedVehIds(new Set()); return; }

    (async () => {
      setVehLoading(true);
      try {
        // سوپرادمین همهٔ ماشین‌ها را می‌بیند (list فعلی‌ات responsible_user را هم برمی‌گرداند)
        const { data } = await api.get('/vehicles', {
          params: { page: 1, limit: pageSize, /* اختیاری: owner_user_id, country_code, vehicle_type_code */ }
        });

        const items = Array.isArray(data?.items) ? data.items : [];
        setVehicles(items);

        // پیش‌انتخاب: هر ماشینی که مسئول فعلی‌اش targetUser است
        const pre = new Set<number>();
        items.forEach((v: any) => {
          if (v?.responsible_user_id === targetUser.id || v?.responsible_user?.id === targetUser.id) {
            pre.add(Number(v.id));
          }
        });
        setSelectedVehIds(pre);
      } finally {
        setVehLoading(false);
      }
    })();
  }, [open, targetUser]);
  const vehiclesFiltered = React.useMemo(() => {
    const q = vehQuery.trim().toLowerCase();
    return vehicles.filter((v: any) => {
      if (vehTypeFilter && v.vehicle_type_code !== vehTypeFilter) return false;
      if (!q) return true;
      const name = (v.name || '').toLowerCase();
      const plate = (v.plate_no || '').toLowerCase();
      return name.includes(q) || plate.includes(q);
    });
  }, [vehicles, vehQuery, vehTypeFilter]);

  useEffect(() => {
    if (!open || !targetUser?.id) return;
    (async () => {
      setLoading(true);
      try {
        // پرمیشن‌های فعلی کاربر هدف
        const { data: policies } = await api.get(`/vehicle-policies/user/${targetUser.id}`, { params: { onlyAllowed: true } });
        const next: Record<VehicleTypeCode, Set<MonitorKey>> = {} as any;

        (Object.keys(grantableMap) as VehicleTypeCode[]).forEach(vt => {
          const row = (policies || []).find((p: any) => p.vehicle_type_code === vt);
          const current = new Set<MonitorKey>(Array.isArray(row?.monitor_params) ? row.monitor_params : []);
          const allowed = new Set<MonitorKey>(grantableMap[vt] || []);
          const initial: MonitorKey[] = [];
          current.forEach(k => allowed.has(k) && initial.push(k)); // تقاطع
          next[vt] = new Set(initial);
        });

        setPerType(next);
      } catch {
        const empty: Record<VehicleTypeCode, Set<MonitorKey>> = {} as any;
        (Object.keys(grantableMap) as VehicleTypeCode[]).forEach(vt => (empty[vt] = new Set()));
        setPerType(empty);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, targetUser, grantableMap]);

  const toggle = (vt: VehicleTypeCode, key: MonitorKey, checked: boolean) => {
    setPerType(prev => {
      const next = { ...prev };
      const s = new Set(next[vt] || []);
      checked ? s.add(key) : s.delete(key);
      next[vt] = s;
      return next;
    });
  };

  const handleSave = async () => {
    if (!targetUser?.id) return;
    setLoading(true);
    try {
      // 1) ذخیرهٔ پرمیشن‌های مانیتورینگ
      const policies = (Object.keys(grantableMap) as VehicleTypeCode[]).map(vt => ({
        vehicle_type_code: vt,
        monitor_params: Array.from(perType[vt] || []),
      }));
      await api.put(`/vehicle-policies/user/${targetUser.id}/bounded`, { policies });

      // 2) واگذاری مسئولیت ماشین‌ها (Bulk)
      await api.put(`/vehicles/responsible/bulk/${targetUser.id}`, {
        vehicle_ids: Array.from(selectedVehIds),
      });

      onClose(true);
    } catch (e) {
      console.error(e);
      onClose(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} fullWidth>
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

      <DialogTitle>
        واگذاری دسترسی مانیتورینگ — {targetUser && displayName(targetUser)}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? 'در حال بارگذاری...' : (
          !hasAnyGrantable ? (
            <Box sx={{ color: 'text.secondary' }}>
              شما پرمیشن قابل‌واگذاری فعالی ندارید.
            </Box>
          ) : (
            <>
              {(Object.keys(grantableMap) as VehicleTypeCode[]).map(vt => (
                <Box key={vt} sx={{ border: '1px solid #eee', borderRadius: 1, p: 2, mb: 1 }}>
                  <Box sx={{ fontWeight: 600, mb: 1 }}>
                    {VEHICLE_TYPES.find(t => t.code === vt)?.label || vt}
                  </Box>
                  <FormGroup>
                    <Grid container spacing={1}>
                      {grantableMap[vt].map(mk => (
                        <Grid item xs={12} sm={6} md={4} key={`${vt}-${mk}`}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={(perType[vt] || new Set()).has(mk)}
                                onChange={(e) => toggle(vt, mk as MonitorKey, e.target.checked)}
                              />
                            }
                            label={MONITOR_PARAMS.find(m => m.key === mk)?.label || mk}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </FormGroup>
                </Box>
              ))}

              {/* ====== اینجــا بلوک انتخاب ماشین‌ها می‌آید ====== */}
              <Box sx={{ mt: 3 }}>
                <Box sx={{ fontWeight: 700, mb: 1.5 }}>تعیین ماشین‌های تحت مسئولیت</Box>

                {/* فیلترها */}
                <Grid container spacing={1} sx={{ mb: 1 }}>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="جستجوی نام/پلاک"
                      value={vehQuery}
                      onChange={(e) => setVehQuery(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      select
                      fullWidth
                      label="نوع خودرو"
                      value={vehTypeFilter}
                      onChange={(e) => setVehTypeFilter(e.target.value as any)}
                    >
                      <MenuItem value="">همه</MenuItem>
                      {VEHICLE_TYPES.map(vt => (
                        <MenuItem key={vt.code} value={vt.code}>{vt.label}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs />
                  <Grid item>
                    <Magnetic>
                      <Button
                        size="small"
                        onClick={() => setSelectedVehIds(new Set(vehiclesFiltered.map(v => v.id)))}
                      >
                        انتخاب همهٔ نتایج
                      </Button>
                    </Magnetic>

                  </Grid>
                  <Grid item>
                    <Button size="small" onClick={() => setSelectedVehIds(new Set())}>
                      حذف انتخاب
                    </Button>
                  </Grid>
                </Grid>

                {/* جدول/لیست ماشین‌ها */}
                <Box sx={{ border: '1px solid #eee', borderRadius: 1, overflow: 'hidden' }}>
                  {vehLoading ? (
                    <Box sx={{ p: 2 }}>در حال بارگذاری ماشین‌ها…</Box>
                  ) : (
                    <List dense sx={{ maxHeight: 380, overflow: 'auto' }}>
                      {vehiclesFiltered.map((v: any) => {
                        const checked = selectedVehIds.has(v.id);
                        const handleToggle = () => {
                          setSelectedVehIds(prev => {
                            const n = new Set(prev);
                            checked ? n.delete(v.id) : n.add(v.id);
                            return n;
                          });
                        };
                        return (
                          <ListItem key={v.id} divider
                            secondaryAction={<Checkbox edge="end" onChange={handleToggle} checked={checked} />}
                          >
                            <ListItemText
                              primary={v.name || 'بدون نام'}
                              secondary={
                                <>
                                  <span>پلاک: {v.plate_no}</span>{' — '}
                                  <span>نوع: {v.vehicle_type_code}</span>{' — '}
                                  <span>مسئول فعلی: {v.responsible_user?.full_name || v.responsible_user_id || '—'}</span>
                                </>
                              }
                            />
                          </ListItem>
                        );
                      })}
                      {!vehiclesFiltered.length && (
                        <ListItem><ListItemText primary="موردی یافت نشد." /></ListItem>
                      )}
                    </List>
                  )}
                </Box>
              </Box>
              {/* ====== پایان بلوک انتخاب ماشین‌ها ====== */}
            </>
          )
        )}
      </DialogContent>

      <DialogActions>
        <Magnetic>
          <Button onClick={() => onClose(false)} disabled={loading}>انصراف</Button></Magnetic>

        <Magnetic>
          <Button variant="contained" onClick={handleSave} disabled={loading || !hasAnyGrantable}>
            ذخیره
          </Button>
        </Magnetic>

      </DialogActions>
    </Dialog>
  );
}






type CountryCode = 'IR' | 'QA' | 'AE' | 'IQ' | 'AF' | 'TM' | 'TR';

export function AddVehicleDialog({
  open,
  onClose,
  ownerId,      // id سوپرادمین
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  ownerId: number;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // pairing state
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<string>('');
  const [pairedDeviceId, setPairedDeviceId] = useState<string | null>(null);
  // بالای کامپوننت
  const [phoneVerified, setPhoneVerified] = useState(false);
  // اگه قبلاً saving داری، دوباره تعریفش نکن!
  const [saving, setSaving] = useState(false);

  // لیست نوع‌های مجاز با ظرفیت باقی‌مانده
  const [allowedTypes, setAllowedTypes] = useState<{ code: VehicleTypeCode; label: string; remaining: number }[]>([]);
  // کشورهایی که منیجر برای این سوپرادمین مجاز کرده
  const [allowedCountries, setAllowedCountries] = useState<CountryCode[]>([]);

  // فرم + تکه‌های پلاک ایران
  const [form, setForm] = useState<{
    name: string;
    country_code: CountryCode | '';
    plate_no: string;
    plate_part1: string;
    plate_part2: string;
    plate_part3: string;
    plate_part4: string;
    vehicle_type_code: VehicleTypeCode | '';
    tank_capacity_liters: number | '';
  }>({
    name: '',
    country_code: '',
    plate_no: '',
    plate_part1: '',
    plate_part2: '',
    plate_part3: '',
    plate_part4: '',
    vehicle_type_code: '',
    tank_capacity_liters: '',
  });


  type VehicleTypeCode =
    | 'bus'
    | 'minibus'
    | 'van'
    | 'tanker'
    | 'truck'
    | 'khavar'
    | 'sedan'
    | 'pickup';

  const labelOfType = (code: VehicleTypeCode) =>
    VEHICLE_TYPES.find(t => t.code === code)?.label || code;

  // --- منطق «رمز ۴ رقمی» + شمارش معکوس
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pairExpiresAt, setPairExpiresAt] = useState<number | null>(null); // ms epoch
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!pairExpiresAt) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((pairExpiresAt - Date.now()) / 1000));
      setSecondsLeft(s);
      if (s <= 0) {
        setPairCode(null);
        setPairExpiresAt(null);
      }
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [pairExpiresAt]);

  // فقط «انتظار برای پیام برد» (long-poll به بک‌اند)
  const waitForBoard = async () => {
    setRedeemMsg('');
    if (!pairCode || secondsLeft <= 0) {
      setRedeemMsg('کد منقضی شده؛ دوباره «دریافت رمز» بزنید.');
      return;
    }
    try {
      setRedeemLoading(true);
      // timeout کلاینت رو کمی بیشتر از 60s بگذار
      const { data } = await api.get('/pairing-codes/wait', {
        params: { code: pairCode },
        timeout: 65000,
      });
      // data = { paired:true, owner_user_id, device_id, device_name? }
      setPairedDeviceId(data?.device_id || null);
      setRedeemMsg('✅ پیام برد رسید و در بک‌اند ثبت شد.');
      try { onCreated(); } catch { }
    } catch (e: any) {
      setRedeemMsg(e?.response?.data?.message || e?.message || 'هیچ پیامی از برد دریافت نشد.');
    } finally {
      setRedeemLoading(false);
    }
  };

  // بارگذاری سیاست‌ها و کشورها هنگام باز شدن
  useEffect(() => {
    if (!open) return;

    const fetchAll = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        // 1) سیاست‌های نوع خودرو
        const { data: policies } = await api.get(`/vehicle-policies/user/${ownerId}`);

        // 2) شمارش وسایل فعلی برای محاسبه remaining
        const { data: vehiclesList } = await api.get('/vehicles', {
          params: { owner_user_id: ownerId, limit: 1000 },
        });
        const counts: Record<string, number> = {};
        VEHICLE_TYPES.forEach(t => (counts[t.code] = 0));
        (vehiclesList.items || []).forEach((v: any) => {
          if (counts[v.vehicle_type_code] !== undefined) counts[v.vehicle_type_code] += 1;
        });

        const types = (policies || [])
          .filter((p: any) => p.is_allowed)
          .map((p: any) => {
            const used = counts[p.vehicle_type_code] || 0;
            const remaining = Math.max(0, Number(p.max_count || 0) - used);
            return {
              code: p.vehicle_type_code as VehicleTypeCode,
              label: labelOfType(p.vehicle_type_code),
              remaining,
            };
          })
          .filter(x => x.remaining > 0);

        setAllowedTypes(types);

        // 3) کشورها
        const { data: countries } = await api.get(`/country-policies/user/${ownerId}`);
        setAllowedCountries(countries || []);

        // 4) مقداردهی اولیهٔ فرم
        setForm(prev => ({
          ...prev,
          vehicle_type_code: types.length === 1 ? types[0].code : '',
          country_code: countries?.length
            ? (countries.includes(prev.country_code as any) ? (prev.country_code as any) : (countries[0] as any))
            : '',
        }));

        // هر بار باز شدن: ریست کد/جفت‌سازی
        setPairCode(null);
        setPairExpiresAt(null);
        setSecondsLeft(0);
        setPairedDeviceId(null);
        setRedeemMsg('');
      } catch (e: any) {
        setErrorMsg(e?.response?.data?.message || 'خطا در دریافت مجوزها/آمار');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [open, ownerId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target as any;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setForm(f => ({ ...f, [name]: value }));
  };

  // ثبت وسیله (در این نسخه، بعد از جفت‌سازی فعال می‌شود)
  const handleSubmit = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (!form.name.trim()) throw new Error('نام ماشین را وارد کنید');
      if (!form.vehicle_type_code) throw new Error('نوع ماشین را انتخاب کنید');
      if (!form.country_code) throw new Error('کشور پلاک را انتخاب کنید');

      // اگه بدون جفت‌سازی نمی‌خوای اجازه بدی:
      if (!pairedDeviceId) throw new Error('ابتدا با برد جفت‌سازی کنید (دریافت رمز → در انتظار پیام).');

      // ساخت پلاک نهایی
      let plateNo = form.plate_no?.trim();
      if (form.country_code === 'IR') {
        if (!/^\d{2}$/.test(form.plate_part1)) throw new Error('دو رقم اولِ پلاک ایران صحیح نیست');
        if (!/^[ء-ی]$/.test(form.plate_part2)) throw new Error('حرف پلاک ایران باید فارسی باشد');
        if (!/^\d{3}$/.test(form.plate_part3)) throw new Error('سه رقم وسط پلاک ایران صحیح نیست');
        if (!/^\d{2}$/.test(form.plate_part4)) throw new Error('دو رقم آخر پلاک ایران صحیح نیست');
        plateNo = `${form.plate_part1}${form.plate_part2}${form.plate_part3}${form.plate_part4}`;
      } else {
        if (!plateNo) throw new Error('پلاک را وارد کنید');
      }

      // ⬅️ نکته‌ی اصلی: device_id را هم بفرست تا «همان ماشین» با همان شناسه ۹۶ بیتی ذخیره شود
      await api.post('/vehicles', {
        owner_user_id: ownerId,
        name: form.name.trim(),
        country_code: form.country_code,
        plate_no: plateNo,
        vehicle_type_code: form.vehicle_type_code,
        tank_capacity_liters:
          form.vehicle_type_code === 'tanker' && form.tank_capacity_liters !== ''
            ? Number(form.tank_capacity_liters)
            : undefined,
        device_id: pairedDeviceId, // 👈 حتماً بفرست
      });

      onClose();
      onCreated();
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.message || e?.message || 'ثبت ناموفق بود');
    } finally {
      setLoading(false);
    }
  };

  const noTypeCapacity = !allowedTypes.length;
  const noCountryAllowed = !allowedCountries.length;
  const canSubmit =
    !saving && !loading && !noTypeCapacity && !noCountryAllowed && !!pairedDeviceId;
  const requestPairCode = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      setRedeemMsg('');
      setPairedDeviceId(null);   // ریست شناسهٔ متصل‌شده
      const { data } = await api.post('/pairing-codes', { userId: ownerId });
      const code = String(data?.code ?? '').padStart(4, '0').slice(-4);
      const exp = data?.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 60_000;
      setPairCode(code);
      setPairExpiresAt(exp);
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.message || 'دریافت رمز ناموفق بود');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>افزودن ماشین جدید</DialogTitle>
      <DialogContent>
        {loading ? (
          <div>در حال بارگذاری...</div>
        ) : (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {errorMsg && (
              <Grid item xs={12}>
                <Box sx={{ color: 'error.main', fontSize: 14 }}>{errorMsg}</Box>
              </Grid>
            )}

            {/* نام ماشین — بالا */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="نام ماشین"
                name="name"
                value={form.name}
                onChange={handleChange}
              />
            </Grid>

            {(noTypeCapacity || noCountryAllowed) ? (
              <Grid item xs={12}>
                <Box sx={{ color: 'text.secondary' }}>
                  {!allowedCountries.length
                    ? 'هیچ کشور مجازی توسط مدیرکل برای شما تعریف نشده است.'
                    : 'برای هیچ نوع خودرویی ظرفیت مجاز فعالی وجود ندارد.'}
                </Box>
              </Grid>
            ) : (
              <>
                <Grid item xs={12}>
                  <label>نوع ماشین (ظرفیت باقیمانده)</label>
                  <select
                    name="vehicle_type_code"
                    value={form.vehicle_type_code}
                    onChange={handleSelect}
                    style={{ width: '100%', padding: '8px', marginTop: 6 }}
                  >
                    <option value="" disabled>انتخاب نوع</option>
                    {allowedTypes.map(t => (
                      <option key={t.code} value={t.code}>
                        {t.label} — باقی‌مانده: {t.remaining}
                      </option>
                    ))}
                  </select>
                </Grid>

                <Grid item xs={6}>
                  <label>کشور پلاک</label>
                  <select
                    name="country_code"
                    value={form.country_code}
                    onChange={handleSelect}
                    style={{ width: '100%', padding: '8px', marginTop: 6 }}
                  >
                    {allowedCountries.map(code => (
                      <option key={code} value={code}>
                        {({
                          IR: 'ایران', QA: 'قطر', AE: 'امارات', IQ: 'عراق',
                          AF: 'افغانستان', TM: 'ترکمنستان', TR: 'ترکیه'
                        } as Record<string, string>)[code] || code}
                      </option>
                    ))}
                  </select>
                </Grid>

                {/* پلاک */}
                <Grid container spacing={1}>
                  {form.country_code === 'IR' ? (
                    <Grid container spacing={1} alignItems="center" sx={{ mt: 1 }}>
                      <Grid item>
                        <TextField
                          label="دو رقم اول"
                          value={form.plate_part1}
                          onChange={(e) =>
                            setForm(f => ({ ...f, plate_part1: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                          size="small"
                          sx={{ width: 120 }}
                        />
                      </Grid>
                      <Grid item>
                        <TextField
                          label="حرف فارسی"
                          value={form.plate_part2}
                          onChange={(e) =>
                            setForm(f => ({
                              ...f,
                              plate_part2: e.target.value
                                .replace(/[^آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]/g, '')
                                .slice(0, 1),
                            }))}
                          size="small"
                          sx={{ width: 120 }}
                        />
                      </Grid>
                      <Grid item>
                        <TextField
                          label="سه رقم وسط"
                          value={form.plate_part3}
                          onChange={(e) =>
                            setForm(f => ({ ...f, plate_part3: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                          size="small"
                          sx={{ width: 120 }}
                        />
                      </Grid>
                      <Grid item>
                        <TextField
                          label="دو رقم آخر"
                          value={form.plate_part4}
                          onChange={(e) =>
                            setForm(f => ({ ...f, plate_part4: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                          size="small"
                          sx={{ width: 120 }}
                        />
                      </Grid>
                    </Grid>
                  ) : (
                    <Grid item xs={12} sx={{ mt: 1 }}>
                      <TextField
                        fullWidth
                        label="پلاک"
                        name="plate_no"
                        value={form.plate_no}
                        onChange={(e) => setForm(f => ({ ...f, plate_no: e.target.value }))}
                      />
                    </Grid>
                  )}
                </Grid>

                {/* تانکر: ظرفیت مخزن */}
                {form.vehicle_type_code === 'tanker' && (
                  <Grid item xs={6} sx={{ mt: 1 }}>
                    <TextField
                      fullWidth
                      label="حجم مخزن (لیتر)"
                      name="tank_capacity_liters"
                      type="number"
                      value={form.tank_capacity_liters}
                      onChange={handleChange}
                    />
                  </Grid>
                )}

                {/* --- بخش دریافت/انتظار رمز --- */}
                <Grid item xs={12} sx={{ mt: 2 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography fontWeight={700} sx={{ mb: 0.5 }}>
                          سینک اولیه با رمز ۴ رقمی
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          «دریافت رمز» → کد را روی برد وارد کنید → «در انتظار پیام از برد». اعتبار کد ~۶۰ثانیه است.
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1}>
                        {pairCode && (
                          <Tooltip title="کپی رمز">
                            <IconButton onClick={async () => { try { await navigator.clipboard.writeText(pairCode); } catch { } }} size="small">
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        <Button
                          variant="contained"
                          startIcon={<RefreshIcon />}
                          onClick={requestPairCode}
                          disabled={loading}
                        >
                          دریافت رمز
                        </Button>

                        <Button
                          variant="outlined"
                          onClick={waitForBoard}
                          disabled={!pairCode || secondsLeft <= 0 || redeemLoading}
                        >
                          در انتظار پیام از برد
                        </Button>
                      </Stack>
                    </Stack>

                    {redeemLoading && <Box sx={{ mt: 1 }}><LinearProgress /></Box>}
                    {redeemMsg && (
                      <Typography variant="caption" sx={{ mt: 1, display: 'block' }} color={redeemMsg.startsWith('✅') ? 'success.main' : 'error.main'}>
                        {redeemMsg}
                      </Typography>
                    )}

                    {pairedDeviceId && (
                      <Box sx={{ mt: 1 }}>
                        <Chip label={`متصل: ${pairedDeviceId.slice(0, 8)}…`} variant="outlined" />
                      </Box>
                    )}

                    <Collapse in={!!pairCode} unmountOnExit>
                      <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Typography sx={{ letterSpacing: 6, fontSize: 28, fontWeight: 800 }}>
                          {pairCode || '----'}
                        </Typography>
                        <Typography variant="caption" color={secondsLeft > 0 ? 'text.secondary' : 'error'}>
                          {secondsLeft > 0 ? `انقضا: ${secondsLeft} ثانیه` : 'منقضی شد، دوباره دریافت کنید.'}
                        </Typography>
                      </Box>
                    </Collapse>
                  </Paper>
                </Grid>
              </>
            )}
          </Grid>
        )}
      </DialogContent>

      <DialogActions>
        <Magnetic>
          <Button onClick={onClose} disabled={loading}>انصراف</Button></Magnetic>

        <Magnetic>

          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={saving || (form.role_level === 6 && !phoneVerified)}
          >
            ثبت
          </Button>
        </Magnetic>

      </DialogActions>
    </Dialog>
  );
}

function normalize8ByteCode(input: string): { ok: boolean; hex16?: string; msg?: string } {
  const v = (input || '').trim();
  if (!v) return { ok: false, msg: 'کد کارت الزامی است' };

  const hex = v.replace(/^0x/i, '').toUpperCase();
  // دقیقاً 16 رقم هگز = 8 بایت
  if (/^[0-9A-F]{16}$/.test(hex)) return { ok: true, hex16: hex };

  // اگر ده‌دهی وارد شد، به هگز 16 رقمی تبدیلش کن (با BigInt تا overflow نداشته باشیم)
  if (/^\d+$/.test(v)) {
    try {
      const n = BigInt(v);
      if (n < 0n || n > 0xFFFFFFFFFFFFFFFFn) {
        return { ok: false, msg: 'عدد باید بین 0 تا 18446744073709551615 باشد' };
      }
      return { ok: true, hex16: n.toString(16).toUpperCase().padStart(16, '0') };
    } catch { }
  }
  return { ok: false, msg: 'کد نامعتبر است؛ ۱۶ رقم هگز (مثل 1A2B3C4D5E6F7788) یا عدد ده‌دهی' };
}


function AddUserDialog({
  open,
  onClose,
  parentId,
  onCreated,
  canGrant,
  grantableMap,
  saType,
}: {
  open: boolean;
  onClose: () => void;
  parentId: number;
  onCreated: () => void;
  canGrant: boolean;
  grantableMap: Record<VehicleTypeCode, MonitorKey[]>;
  saType?: SAType;      // ← این را به تایپ اضافه کن

}) {
  // فرم پروفایل + نقش
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    password: '',
    role_level: 4,          // پیش‌فرض: مالک
    parent_user_id: parentId,
  });
  // بالا کنار useStateهای فرم
  const [driverCard, setDriverCard] = useState('');         // ورودی کاربر
  const [driverCardErr, setDriverCardErr] = useState('');   // پیام خطا
  // والدهای مجاز براساس نقش انتخابی
  const [filteredParents, setFilteredParents] =
    useState<{ id: number; full_name: string }[]>([]);
  // بالای AddUserDialog
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpMsg, setOtpMsg] = useState('');
  const [otpSeconds, setOtpSeconds] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);

  useEffect(() => {
    let iv: any = null;
    if (otpSeconds > 0) {
      iv = setInterval(() => setOtpSeconds(s => Math.max(0, s - 1)), 1000);
    }
    return () => iv && clearInterval(iv);
  }, [otpSeconds]);

  const sendOtp = async () => {
    setOtpMsg('');
    if (!form.phone?.trim()) { setOtpMsg('ابتدا شماره را وارد کنید'); return; }
    try {
      setOtpSending(true);
      await api.post('/auth/otp/send', { phone: form.phone });
      setOtpSent(true);
      setOtpSeconds(60);           // 60 ثانیه محدودیت ارسال مجدد (بک‌اند هم rate دارد)
      setOtpMsg('کد ارسال شد');
    } catch (e: any) {
      setOtpMsg(e?.response?.data?.message || 'ارسال ناموفق بود');
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async () => {
    setOtpMsg('');
    try {
      setOtpVerifying(true);
      await api.post('/auth/otp/verify', { phone: form.phone, code: otpCode.trim() });
      setPhoneVerified(true);
      setOtpMsg('✅ شماره تأیید شد');
    } catch (e: any) {
      setOtpMsg(e?.response?.data?.message || 'کد نادرست/منقضی است');
      setPhoneVerified(false);
    } finally {
      setOtpVerifying(false);
    }
  };

  // انتخاب‌های مانیتورینگ برای هر نوع خودرو (فقط از روی grantableMap)
  const [perType, setPerType] =
    useState<Record<VehicleTypeCode, Set<MonitorKey>>>({} as any);

  // وضعیت‌ها
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ full_name?: string; phone?: string; password?: string }>({});

  // هر بار دیالوگ باز شد، مقداردهی اولیه
  useEffect(() => {
    if (!open) return;

    // reset پروفایل
    setForm(f => ({
      ...f,
      full_name: '',
      phone: '',
      password: '',
      role_level: 4,
      parent_user_id: parentId,
    }));

    // reset انتخاب‌های مانیتورینگ (فقط روی کلیدهای قابل واگذاری‌ی SA)
    const init: Record<VehicleTypeCode, Set<MonitorKey>> = {} as any;
    (Object.keys(grantableMap) as VehicleTypeCode[]).forEach(vt => (init[vt] = new Set()));
    setPerType(init);
    setErrors({});
  }, [open, parentId, grantableMap]);

  // لیست والدها را براساس نقش انتخابی فیلتر کن
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await api.get('/users/my-subordinates-flat');
      const all = [{ id: parentId, full_name: `زیرمجموعه مستقیم من (${roleLabel(2, saType)})`, role_level: 2 }, ...data];
      // فقط کسانی که نقش‌شان از کاربر جدید بالاتر است می‌توانند والد باشند
      const filtered = all.filter(u => u.role_level < form.role_level);
      // اگر parent انتخاب‌شده معتبر نیست، اولین گزینه را بگذار
      if (!filtered.find(u => u.id === form.parent_user_id)) {
        setForm(f => ({ ...f, parent_user_id: filtered[0]?.id ?? parentId }));
      }
      setFilteredParents(filtered.map(u => ({ id: u.id, full_name: u.full_name })));
    })();
  }, [open, form.role_level, parentId]);

  // تغییر فیلدهای متنی
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  // تغییر سلکت‌ها (نقش/والد)
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.name;
    const value = name === 'role_level' || name === 'parent_user_id'
      ? Number(e.target.value) : e.target.value;
    setForm(f => ({ ...f, [name]: value }));
    if (name === 'role_level') {
      const lvl = Number(value);
      if (lvl !== 6) {
        setDriverCard('');
        setDriverCardErr('');
      }
    }

  };

  // تیک‌های مانیتورینگ
  const toggleMonitor = (vt: VehicleTypeCode, key: MonitorKey, checked: boolean) => {
    setPerType(prev => {
      const next = { ...prev };
      const set = new Set(next[vt] || []);
      checked ? set.add(key) : set.delete(key);
      next[vt] = set;
      return next;
    });
  };

  // اعتبارسنجی ساده‌ی پروفایل
  const validate = () => {
    const e: typeof errors = {};
    if (!form.full_name.trim()) e.full_name = 'نام الزامی است';
    if (!form.phone.trim()) e.phone = 'شماره موبایل الزامی است';
    if (!form.password.trim()) e.password = 'رمز عبور الزامی است';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const label = (lvl: number) => roleLabel(lvl, saType);

  // ثبت کاربر
  const handleSubmit = async () => {
    try {
      // 1) ساخت کاربر
      const { parent_user_id, role_level, ...rest } = form;
      if (!rest.full_name?.trim() || !rest.phone?.trim() || !rest.password?.trim()) {
        throw new Error('نام، موبایل و رمز الزامی است');
      }
      if (form.role_level === 6 && !phoneVerified) {
        throw new Error('برای راننده، ابتدا باید شماره موبایل تایید شود.');
      }

      const payload: any = { ...rest, role_level, parent_id: parent_user_id };
      if (role_level === 6) {
        const r = normalize8ByteCode(driverCard);
        if (!r.ok) throw new Error(r.msg || 'کد کارت راننده نامعتبر است');
        payload.driver_card_hex = r.hex16; // 👈 نام فیلد سمت سرور (در صورت تفاوت، این را مطابق API خودت تغییر بده)
      }
      const { data: created } = await api.post('/users', payload);
      const newUserId = created?.id;
      if (!newUserId) throw new Error('ساخت کاربر موفق بود ولی id برنگشت.');

      // 2) در صورت نیاز، واگذاری دسترسی‌های مانیتورینگ (اختیاری)
      if (canGrant && Object.keys(grantableMap).length) {
        const policies = (Object.keys(grantableMap) as VehicleTypeCode[]).map(vt => ({
          vehicle_type_code: vt,
          monitor_params: Array.from(perType[vt] || []),
        }));
        // فقط اگر حداقل یک مانیتور انتخاب شده بود
        const hasAny = policies.some(p => p.monitor_params.length > 0);
        if (hasAny) {
          api.put(`/vehicle-policies/user/${newUserId}/bounded`, { policies })
            .catch(err => {
              console.warn('bounded failed but user created:', err?.response?.data || err?.message);
              // این خطا نباید فرآیند ساخت را خراب کند
            });
        }
      }

      // 3) بستن و رفرش
      onClose();
      onCreated();
    } catch (e) {
      console.error(e);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>افزودن کاربر جدید</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* فیلدهای پروفایل */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="نام و نام خانوادگی"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              error={!!errors.full_name}
              helperText={errors.full_name}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="شماره موبایل"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              error={!!errors.phone}
              helperText={errors.phone}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              type="password"
              label="رمز عبور"
              name="password"
              value={form.password}
              onChange={handleChange}
              error={!!errors.password}
              helperText={errors.password}
            />
          </Grid>
          {form.role_level === 6 && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                {/* بخش تایید شماره (OTP 6 رقمی) */}
                <Stack direction="row" alignItems="center" spacing={1}>
                  <TextField
                    label="کد تایید ۶ رقمی"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    size="small"
                    sx={{ width: 180 }}
                    disabled={phoneVerified}
                  />
                  <Button
                    variant="outlined"
                    onClick={sendOtp}
                    disabled={otpSending || otpSeconds > 0 || phoneVerified || !form.phone.trim()}
                  >
                    {otpSeconds > 0 ? `ارسال مجدد (${otpSeconds})` : 'ارسال کد'}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={verifyOtp}
                    disabled={otpVerifying || phoneVerified || otpCode.length !== 6}
                  >
                    تأیید
                  </Button>
                  {phoneVerified && <Chip color="success" label="تأیید شد" />}
                </Stack>

                {otpMsg && (
                  <Typography
                    variant="caption"
                    sx={{ mt: 1, display: 'block' }}
                    color={otpMsg.startsWith('✅') ? 'success.main' : 'error.main'}
                  >
                    {otpMsg}
                  </Typography>
                )}

                {/* جداکننده بصری */}
                <Box sx={{ my: 2, height: 1, bgcolor: 'divider' }} />

                {/* بخش کد کارت ۸ بایتی */}
                <Stack spacing={1}>
                  <TextField
                    label="کد کارت ۸ بایتی (Hex 16 رقم یا Decimal)"
                    value={driverCard}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setDriverCard(v);
                      const r = normalize8ByteCode(v);
                      setDriverCardErr(r.ok ? '' : (r.msg || 'کد نامعتبر است'));
                    }}
                    error={!!driverCardErr}
                    helperText={driverCardErr || 'مثال Hex: 1A2B3C4D5E6F7788 — مثال Decimal: 1234567890123456'}
                    fullWidth
                    size="small"
                  />

                  {/* پیش‌نمایش هگز نرمال‌شده (اختیاری) */}
                  {driverCard && !driverCardErr && (
                    <Typography variant="caption" color="text.secondary">
                      هگز نهایی: {normalize8ByteCode(driverCard).hex16}
                    </Typography>
                  )}
                </Stack>
              </Paper>
            </Grid>
          )}




          {/* نقش و والد */}
          <Grid item xs={6}>
            <label>نقش:</label>
            <select
              name="role_level"
              value={form.role_level}
              onChange={handleSelectChange}
              style={{ width: '100%', padding: 8, marginTop: 6 }}
            >
              <option value={3}>{label(3)}</option>
              <option value={4}>{label(4)}</option>
              <option value={5}>{label(5)}</option>
              <option value={6}>{label(6)}</option>
            </select>
          </Grid>

          <Grid item xs={6}>
            <label>زیرمجموعه‌ی:</label>
            <select
              name="parent_user_id"
              value={form.parent_user_id}
              onChange={handleSelectChange}
              style={{ width: '100%', padding: 8, marginTop: 6 }}
            >
              {filteredParents.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </Grid>

          {/* دسترسی‌های مانیتورینگ قابل واگذاری */}

        </Grid>
      </DialogContent>

      <DialogActions>
        <Magnetic>

          <Button onClick={onClose} disabled={saving}>انصراف</Button></Magnetic>

        <Magnetic>

          <Button onClick={handleSubmit} variant="contained" disabled={saving}>
            ثبت
          </Button>
        </Magnetic>

      </DialogActions>
    </Dialog>
  );
}



function BranchManagerRoleSection({ user }: { user: User }) {
  return <ScopedSubtreeSection user={user} />;
}
function OwnerRoleSection({ user }: { user: User }) {
  return <ScopedSubtreeSection user={user} />;
}
function TechnicianRoleSection({ user }: { user: User }) {
  return <ScopedSubtreeSection user={user} />;
}
function DriverRoleSection({ user }: { user: User }) {
  return <ScopedSubtreeSection user={user} />;
}
function EditUserDialog({
  open,
  onClose,
  data,
  canGrant,
  grantableMap, // دیگه استفاده نمی‌کنیم ولی برای سازگاری می‌ذاریم
  onSaved,
  roleSaType,
}: {
  open: boolean;
  onClose: () => void;
  data: any;
  canGrant: boolean;
  grantableMap: Record<VehicleTypeCode, MonitorKey[]>;
  onSaved: () => void;
  roleSaType?: SAType;
}) {
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [formInfo, setFormInfo] = useState({ full_name: '', phone: '', password: '' });
  const [roleLevel, setRoleLevel] = useState<number>(4);
  // بالای EditUserDialog
  const [saType, setSaType] = useState<SAType>('fleet');
  const effectiveSaType = roleSaType ?? saType;

  useEffect(() => {
    if (open && data?.role_level === 2) {
      setSaType((data?.sa_type as SAType) ?? 'fleet');
    }
  }, [open, data]);
  // مجوزها
  const [myAllowed, setMyAllowed] = useState<Set<string>>(new Set());          // مجوزهای خودِ SA
  const [grantableActions, setGrantableActions] = useState<string[]>([]);       // اکشن‌هایی که SA می‌تواند واگذار کند
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());// انتخاب‌های فعلی برای زیرمجموعه
  const [savingPerms, setSavingPerms] = useState(false);

  useEffect(() => {
    if (!open || !data?.id) return;

    // مقداردهی فیلدهای پروفایل/نقش
    setFormInfo({ full_name: data.full_name || '', phone: data.phone || '', password: '' });
    setRoleLevel(data.role_level ?? 4);
    setSaType((data?.sa_type as SAType) ?? 'fleet');

    (async () => {
      try {
        // 1) گرفتن خودِ من (سوپرادمین)
        const { data: me } = await api.get('/auth/me');

        // 2) مجوزهای خودِ SA
        const { data: mine } = await api.get(`/role-permissions/user/${me.id}`);
        const mineAllowed = (mine || [])
          .filter((p: any) => p.is_allowed)
          .map((p: any) => p.action as string);
        const mineSet = new Set<string>(mineAllowed);
        setMyAllowed(mineSet);

        // 3) مجوزهای فعلی کاربر هدف
        const { data: target } = await api.get(`/role-permissions/user/${data.id}`);
        const targetAllowed = new Set<string>(
          (target || []).filter((p: any) => p.is_allowed).map((p: any) => p.action as string)
        );

        // 4) اکشن‌های قابل واگذاری = اکشن‌هایی که خودم دارم
        const grantables = actions.filter(a => mineSet.has(a));
        setGrantableActions(grantables);

        // 5) مقدار اولیهٔ انتخاب‌ها = تقاطعِ (target ∩ grantables)
        const initial = new Set<string>();
        grantables.forEach(a => { if (targetAllowed.has(a)) initial.add(a); });
        setSelectedActions(initial);
      } catch (e) {
        setMyAllowed(new Set());
        setGrantableActions([]);
        setSelectedActions(new Set());
      }
    })();
  }, [open, data]);

  const toggleAction = (action: string, checked: boolean) => {
    setSelectedActions(prev => {
      const next = new Set(prev);
      checked ? next.add(action) : next.delete(action);
      return next;
    });
  };

  const handleSaveUserInfo = async () => {
    if (!data?.id) return;
    setSavingInfo(true);
    try {
      const payload: any = { full_name: formInfo.full_name, phone: formInfo.phone };
      const pwd = formInfo.password.trim();
      if (pwd) payload.password = pwd;
      await api.put(`/users/${data.id}`, payload);
      await onSaved();
    } finally { setSavingInfo(false); }
  };

  const handleSaveRole = async () => {
    if (!data?.id) return;
    setSavingRole(true);
    try {
      await api.put(`/users/${data.id}`, { role_level: roleLevel });
      await onSaved();
    } finally { setSavingRole(false); }
  };

  const handleSavePermissions = async () => {
    if (!data?.id) return;
    setSavingPerms(true);
    try {
      // فقط داخل دامنهٔ مجازِ خودِ SA اجازه می‌دهیم
      const payload = {
        permissions: actions.map(a => ({
          action: a,
          is_allowed: myAllowed.has(a) && selectedActions.has(a),
        })),
      };
      await api.put(`/role-permissions/user/${data.id}`, payload);
      await onSaved();
    } finally { setSavingPerms(false); }
  };

  if (!data) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>ویرایش کاربر — {data.full_name}</DialogTitle>
      <DialogContent>
        {/* پروفایل */}
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth label="نام کامل"
              value={formInfo.full_name}
              onChange={e => setFormInfo({ ...formInfo, full_name: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth label="شماره موبایل"
              value={formInfo.phone}
              onChange={e => setFormInfo({ ...formInfo, phone: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth type="password" label="رمز عبور جدید"
              value={formInfo.password}
              onChange={e => setFormInfo({ ...formInfo, password: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <Magnetic>

              <Button variant="outlined" onClick={handleSaveUserInfo} disabled={savingInfo}>
                ذخیره اطلاعات کاربر
              </Button>
            </Magnetic>

          </Grid>
          {data?.role_level === 2 && (
            <Grid item xs={12}>
              <Box sx={{ fontWeight: 700, mb: 1 }}>نوع سوپرادمین</Box>
              <FormGroup row>
                {SA_TYPE_OPTS.map(opt => (
                  <FormControlLabel
                    key={opt.value}
                    control={<Radio checked={saType === opt.value} onChange={() => setSaType(opt.value)} />}
                    label={opt.label}
                  />
                ))}
              </FormGroup>
              <Button
                variant="contained"
                onClick={async () => {
                  // 1) خود SA
                  await api.put(`/users/${data.id}`, { sa_type: saType });
                  // 2) کَسکید
                  await api.post(`/users/${data.id}/cascade-sa-type`, { sa_type: saType });
                  await onSaved();
                }}
              >
                ذخیره نوع (با اعمال به زیرمجموعه‌ها)
              </Button>
            </Grid>
          )}
          {/* نقش */}
          <Grid item xs={12}>
            <label>نقش:</label>
            <select
              value={roleLevel}
              onChange={e => setRoleLevel(Number(e.target.value))}
              style={{ width: '100%', padding: 8, marginTop: 6 }}
              disabled={!canGrant}
            >
              <option value={3}>{roleLabel(3, effectiveSaType)}</option>
              <option value={4}>{roleLabel(4, effectiveSaType)}</option>
              <option value={5}>{roleLabel(5, effectiveSaType)}</option>
              <option value={6}>{roleLabel(6, effectiveSaType)}</option>
            </select>
          </Grid>
          <Grid item xs={12}>
            <Magnetic>

              <Button variant="contained" onClick={handleSaveRole} disabled={savingRole || !canGrant}>
                ذخیره نقش
              </Button>
            </Magnetic>

          </Grid>

          {/* مجوزهای اکشنی قابل‌واگذاری */}
          {canGrant && (
            <Grid item xs={12}>
              <b>مجوزهای قابل واگذاری (بر اساس مجوزهای شما):</b>
              {grantableActions.length === 0 ? (
                <Box sx={{ color: 'text.secondary', mt: 1 }}>
                  شما مجوزی برای واگذاری ندارید.
                </Box>
              ) : (
                <FormGroup sx={{ mt: 1 }}>
                  <Grid container spacing={1}>
                    {grantableActions.map(action => (
                      <Grid item xs={12} sm={6} md={4} key={action}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedActions.has(action)}
                              onChange={e => toggleAction(action, e.target.checked)}
                            />
                          }
                          label={actionLabels[action]}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </FormGroup>
              )}
              <Box sx={{ mt: 1 }}>
                <Magnetic>
                  <Button
                    variant="contained"
                    onClick={handleSavePermissions}
                    disabled={savingPerms || grantableActions.length === 0}
                  >
                    ذخیره مجوزها
                  </Button></Magnetic>

              </Box>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Magnetic>
          <Button onClick={onClose} disabled={savingInfo || savingRole || savingPerms}>بستن</Button></Magnetic>

      </DialogActions>
    </Dialog>
  );
}




function SubUserVehicleAccessDialog({
  open,
  onClose,
  subUser,
  ownerId,                      // id سوپرادمین (خود کاربر جاری)
  grantableMap,                 // مجوزهای نوعیِ خود SA (از سمت منیجر)
}: {
  open: boolean;
  onClose: () => void;
  subUser: UserNode | null;
  ownerId: number;
  grantableMap: Record<VehicleTypeCode, MonitorKey[]>;
}) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // فقط نوع‌های خودرو که SA واقعاً دارد
  const [types, setTypes] = useState<VehicleTypeCode[]>([]);
  const [typeCounts, setTypeCounts] = useState<Record<VehicleTypeCode, number>>({} as any);

  // مجوزهای فعلی زیرمجموعه به تفکیک نوع (محدود به مجوزهای خود SA)
  const [perType, setPerType] = useState<Record<VehicleTypeCode, Set<MonitorKey>>>({} as any);

  const labelOfType = (code: VehicleTypeCode) =>
    VEHICLE_TYPES.find(t => t.code === code)?.label || code;

  useEffect(() => {
    if (!open || !subUser) return;

    const run = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        // 1) همه‌ی خودروهای خود SA ⇒ استخراج نوع‌های یکتا + شمارش
        const { data: list } = await api.get('/vehicles', {
          params: { owner_user_id: ownerId, limit: 1000 },
        });
        const items = list?.items || [];
        const counts: Record<VehicleTypeCode, number> = {} as any;
        items.forEach((v: any) => {
          const code = v.vehicle_type_code as VehicleTypeCode;
          counts[code] = (counts[code] || 0) + 1;
        });

        // نوع‌های یکتا که هم وجود دارند هم برای SA قابل واگذاری‌اند
        const uniqTypes: VehicleTypeCode[] = Array.from(
          new Set<VehicleTypeCode>(
            items.map((v: any) => v.vehicle_type_code as VehicleTypeCode)
          )
        ).filter(
          (vt) => (grantableMap[vt] ?? []).length > 0
        );

        setTypes(uniqTypes);
        setTypeCounts(counts);

        // 2) سیاست‌های فعلی زیرمجموعه (فقط Allowed) و اینترسکت با مجوزهای SA
        const { data: childAllowed } = await api.get(
          `/vehicle-policies/user/${subUser.id}`,
          { params: { onlyAllowed: true } }
        );

        const init: Record<VehicleTypeCode, Set<MonitorKey>> = {} as any;
        uniqTypes.forEach(vt => {
          const saAllowed = new Set<MonitorKey>(grantableMap[vt] || []);
          const row = (childAllowed || []).find((p: any) => p.vehicle_type_code === vt);
          const childSet = new Set<MonitorKey>(Array.isArray(row?.monitor_params) ? row.monitor_params : []);
          const fin: MonitorKey[] = [];
          childSet.forEach(m => saAllowed.has(m) && fin.push(m));
          init[vt] = new Set(fin);
        });
        setPerType(init);
      } catch (e: any) {
        setErrorMsg(e?.response?.data?.message || 'خطا در دریافت اطلاعات');
        // اگر خطا خورد، لیست خالی می‌ماند
        setTypes([]);
        setPerType({} as any);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [open, subUser, ownerId, grantableMap]);

  const toggleMonitor = (vt: VehicleTypeCode, key: MonitorKey, checked: boolean) => {
    setPerType(prev => {
      const next = { ...prev };
      const s = new Set(next[vt] || []);
      checked ? s.add(key) : s.delete(key);
      next[vt] = s;
      return next;
    });
  };

  const handleSave = async () => {
    if (!subUser) return;
    setLoading(true);
    setErrorMsg('');
    try {
      // فقط نوع‌هایی که نمایش داده شده‌اند را به bounded بفرست
      const policies = types.map(vt => ({
        vehicle_type_code: vt,
        monitor_params: Array.from(perType[vt] || []),
      }));
      await api.put(`/vehicle-policies/user/${subUser.id}/bounded`, { policies });
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.message || 'ذخیره ناموفق بود');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        ماشین‌ها و مجوزهای «{subUser && displayName(subUser)}»
      </DialogTitle>
      <DialogContent dividers>
        {loading ? 'در حال بارگذاری...' : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {errorMsg && <Box sx={{ color: 'error.main' }}>{errorMsg}</Box>}

            <Box sx={{ color: 'text.secondary', fontSize: 13 }}>
              تیک‌های هر ردیف، قوانین نوع همان ردیف را تغییر می‌دهد و برای همهٔ
              خودروهای همان نوع برای این کاربر اعمال می‌شود.
            </Box>

            {types.length === 0 ? (
              <Box sx={{ color: 'text.secondary' }}>نوع خودرویی برای نمایش موجود نیست.</Box>
            ) : (
              <Grid container spacing={2}>
                {types.map(vt => {
                  const available = grantableMap[vt] || [];
                  const selected = Array.from(perType[vt] || []);
                  return (
                    <Grid item xs={12} key={vt}>
                      <Box sx={{ border: '1px solid #eee', borderRadius: 1, p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Box sx={{ fontWeight: 600 }}>
                            {labelOfType(vt)}{typeCounts[vt] ? ` — ${typeCounts[vt]} دستگاه` : ''}
                          </Box>
                          <Box>
                            {selected.map(k => (
                              <Chip key={k} label={MONITOR_PARAMS.find(m => m.key === k)?.label || k} size="small" sx={{ mr: .5 }} />
                            ))}
                          </Box>
                        </Box>

                        <FormGroup>
                          <Grid container spacing={1}>
                            {available.map((mk: MonitorKey) => (
                              <Grid item xs={12} sm={6} md={4} key={`${vt}-${mk}`}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={(perType[vt] || new Set()).has(mk)}
                                      onChange={(e) => toggleMonitor(vt, mk, e.target.checked)}
                                    />
                                  }
                                  label={MONITOR_PARAMS.find(m => m.key === mk)?.label || mk}
                                />
                              </Grid>
                            ))}
                          </Grid>
                        </FormGroup>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Magnetic>
          <Button onClick={onClose} disabled={loading}>بستن</Button></Magnetic>

        <Button variant="contained" onClick={handleSave} disabled={loading}>ذخیره</Button>
      </DialogActions>
    </Dialog>
  );
}

import { useLayoutEffect, useRef } from 'react';
import Tilt from '../theme/Tilt';
import Magnetic from '../theme/Magnetic';
export function AutoFitTree({
  children,
  minScale = 0.45,               // اگر درخت خیلی پهن شد، بیشتر کوچیک می‌کنه
  maxScale = 1,                  // بیشتر از اندازه‌ی واقعی بزرگ نکن
  height = 'calc(100vh - 220px)' // ارتفاع قاب؛ برای صفحه‌ی منیجر هماهنگ با هدر/نوارها تنظیم کن
}: {
  children: React.ReactNode;
  minScale?: number;
  maxScale?: number;
  height?: string | number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [st, setSt] = useState({ ready: false, scale: 1, tx: 0, ty: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const c = containerRef.current;
      const d = contentRef.current;
      if (!c || !d) return;

      // حواشی داخلی محتوا رو حذف نکن؛ اندازه‌ی واقعی درخت باید به‌دست بیاد
      const crect = c.getBoundingClientRect();
      const drect = d.getBoundingClientRect();

      const fit = Math.min(
        crect.width / Math.max(1, drect.width),
        crect.height / Math.max(1, drect.height)
      );

      const scale = Math.max(minScale, Math.min(maxScale, fit));
      const tx = (crect.width - drect.width * scale) / 2;
      const ty = (crect.height - drect.height * scale) / 2;

      setSt({ ready: true, scale, tx, ty });
    };

    // یک بار و با تغییر اندازه‌ها
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    // اگر فونت‌ها دیر لود شوند
    window.addEventListener('load', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('load', measure);
    };
  }, [minScale, maxScale]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        height,
        overflow: 'hidden',         // نه اسکرول عمودی، نه پرش
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.default'
      }}
    >
      <Box
        ref={contentRef}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${st.tx}px, ${st.ty}px) scale(${st.scale})`,
          transformOrigin: 'top left',
          transition: 'transform 140ms ease',
          visibility: st.ready ? 'visible' : 'hidden', // تا مقیاس محاسبه نشه، مخفی ⇒ CLS صفر
          p: 2
        }}
      >
        {children}
      </Box>
    </Box>
  );
}


function AutoFitScale({
  children,
  minScale = 0.35,   // حداقل بزرگ‌نمایی (برای خیلی درخت‌های بزرگ‌تر)
  maxScale = 1,      // نذار بزرگ‌تر از اندازه‌ی واقعی بشه
  pad = 24,          // حاشیه امن داخل ظرف
  sx,
}: {
  children: React.ReactNode;
  minScale?: number;
  maxScale?: number;
  pad?: number;
  sx?: any;
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const content = contentRef.current;
    if (!outer || !content) return;

    const calc = () => {
      // ابعاد ظرف قابل استفاده
      const availW = Math.max(outer.clientWidth - pad * 2, 1);
      const availH = Math.max(outer.clientHeight - pad * 2, 1);

      // ابعاد واقعی محتوا (transform روی اینها اثر نداره، پس قابل اندازه‌گیری‌اند)
      const needW = Math.max(content.scrollWidth, 1);
      const needH = Math.max(content.scrollHeight, 1);

      const s = Math.min(availW / needW, availH / needH);
      const clamped = Math.max(minScale, Math.min(maxScale, s || 1));
      setScale(clamped);
    };

    // رویدادهای تغییر اندازه
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(calc);
    });
    ro.observe(outer);
    ro.observe(content);

    calc();
    return () => ro.disconnect();
  }, [minScale, maxScale, pad]);

  return (
    <div
      ref={outerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',   // جلوگیری از اسکرول ناگهانی
        ...sx,
      }}
    >
      <div
        ref={contentRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          transition: 'transform 120ms ease',
          // برای اینکه محتوا وسط ظرف قرار بگیرد:
          margin: '0 auto',
          width: 'max-content',
          willChange: 'transform',
          padding: pad,
        }}
      >
        {children}
      </div>
    </div>
  );
}
function ScrollViewport({
  children,
  height = 'calc(100vh - 240px)', // هرچی خواستی بده
}: {
  children: React.ReactNode;
  height?: string | number;
}) {
  return (
    <Box
      sx={{
        position: 'relative',
        height,
        overflow: 'auto',                // ⇐ اسکرول عمودی/افقی
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        p: 1,
      }}
    >
      {/* این لایه باعث میشه عرض به اندازهٔ محتوا بزرگ بشه تا اسکرول افقی داشته باشی */}
      <Box sx={{ width: 'max-content', minHeight: '100%' }}>
        {children}
      </Box>
    </Box>
  );
}
function ScopedSubtreeSection({ user }: { user: User }) {
  const [tree, setTree] = useState<UserNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleSaType, setRoleSaType] = useState<SAType | undefined>(undefined);

  const [canCreate, setCanCreate] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canGrant, setCanGrant] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  // فقط زیرمجموعه‌های خود کاربر
  const refreshTree = async () => {
    const { data } = await api.get('/users/my-subordinates-flat');
    setTree(buildTree(
      data,
      { id: user.id, full_name: user.full_name, role_level: user.role_level, sa_type: (user as any).sa_type }
    ));
  };

  const loadMyPerms = async () => {
    try {
      const { data: mine } = await api.get(`/role-permissions/user/${user.id}`);
      const allowed = (mine || []).filter((p: any) => p.is_allowed);
      const has = (a: string) => !!allowed.find((p: any) => p.action === a);

      const _canCreate = has('create_user');
      const _canEdit = has('edit_user') || _canCreate;
      const _canDelete = has('delete_user') || _canCreate;
      const _canGrant = has('grant_sub_permissions');

      setCanCreate(_canCreate);
      setCanEdit(_canEdit);
      setCanDelete(_canDelete);
      setCanGrant(_canGrant);
    } catch {
      setCanCreate(false); setCanEdit(false); setCanDelete(false); setCanGrant(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([refreshTree(), loadMyPerms()]);
      setLoading(false);
    })();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const { data: sa } = await api.get('/users/me/ancestor-super-admin');
        if (sa?.id) {
          const { data: saRow } = await api.get(`/users/${sa.id}`);
          setRoleSaType(saRow?.sa_type); // 'fleet' | 'device' | 'universal'
        }
      } catch { }
    })();
  }, []);
  const handleDeleteUser = async (u: UserNode) => {
    if (!canDelete) return;
    if (u.id === user.id) return alert('حذف خودتان مجاز نیست.');
    if (u.role_level <= user.role_level) return alert('فقط نقش‌های پایین‌تر قابل حذف‌اند.');
    if (!confirm(`کاربر «${displayName(u)}» حذف شود؟`)) return;
    await api.delete(`/users/${u.id}`);
    await refreshTree();
  };

  const handleEditUser = async (u: UserNode) => {
    if (!canEdit) return;
    try {
      const { data: row } = await api.get(`/users/${u.id}`);
      setEditUser({ ...u, ...row });
      setEditOpen(true);
    } catch (e) { console.error(e); }
  };

  if (loading) return <div>در حال بارگذاری...</div>;

  return (
    <div>
      <h2>مدیریت نقش‌ها ({roleLabel(user.role_level, roleSaType)})</h2>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {canCreate && (
          <Magnetic>

            <Button variant="contained" onClick={() => setAddOpen(true)}>
              افزودن کاربر جدید
            </Button>
          </Magnetic>

        )}
      </Box>

      {tree.length > 0 ? (
        <ScrollViewport height="calc(100vh - 240px)">
          <Box sx={orgTreeSx}>
            <Box component="ul">
              <OrgTreeNode
                node={tree[0]}                       // ریشه = خودِ کاربر
                onEdit={canEdit ? handleEditUser : undefined}
                onDelete={canDelete ? handleDeleteUser : undefined}
                onEditVehiclePolicy={undefined}      // این دکمه مخصوص مدیرکل روی SA است
                onGrantMonitors={undefined}          // اگر برای نقش‌های ۳..۵ لازم شد بعداً وصل کن
                currentUserId={user.id}
                currentUserRoleLevel={user.role_level}
                canDelete={canDelete}
                roleSaType={roleSaType}
              />
            </Box>
          </Box>
        </ScrollViewport>
      ) : (
        <div style={{ color: '#888' }}>هیچ زیرمجموعه‌ای ثبت نشده است.</div>
      )}

      {/* افزودن کاربر (فقط وقتی create_user دارد) */}
      {canCreate && (
        <AddUserDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          parentId={user.id}               // والد = همین کاربر
          onCreated={refreshTree}
          canGrant={canGrant}              // اگر اجازهٔ واگذاری مجوز دارد
          grantableMap={EMPTY_GRANT_MAP}
          saType={roleSaType}                  // ← اضافه شد

        />
      )}

      {/* ویرایش کاربر (اگر اجازه دارد) */}
      <EditUserDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        data={editUser}
        canGrant={canGrant}
        grantableMap={EMPTY_GRANT_MAP}
        onSaved={async () => { setEditOpen(false); await refreshTree(); }}
        roleSaType={roleSaType}
      />
    </div>
  );
}
// جایی بالاتر از کامپوننت
const EMPTY_GRANT_MAP = {
  bus: [], minibus: [], van: [], tanker: [],
  truck: [], khavar: [], sedan: [], pickup: [],
} satisfies Record<VehicleTypeCode, MonitorKey[]>;



function displayName(u: { full_name?: string; name?: string; username?: string }) {
  const n = (u.full_name ?? u.name ?? u.username ?? '').trim();
  return n || 'بدون‌نام'; // هیچ‌وقت phone یا id نشون نده
}


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
