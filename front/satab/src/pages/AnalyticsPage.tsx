// src/pages/AnalyticsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import {
  Box, Grid, Paper, Stack, Typography, CircularProgress, useTheme, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Tooltip,
  TextField, MenuItem, Breadcrumbs, Link
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { alpha, keyframes } from '@mui/material/styles';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
  AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis,
  Treemap,
  RadialBarChart, RadialBar,
  ComposedChart
} from 'recharts';

type Bucket = 'day'|'week'|'month';

const shimmer = keyframes`
  0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%}
`;
const fancy = (t:any)=>({
  border:'1px solid transparent', borderRadius:14,
  background:`
    linear-gradient(${alpha(t.palette.background.paper,.85)}, ${alpha(t.palette.background.paper,.85)}) padding-box,
    linear-gradient(120deg, rgba(99,102,241,.45), rgba(236,72,153,.4), rgba(16,185,129,.4)) border-box
  `,
  backgroundSize:'200% 200%,200% 200%', animation:`${shimmer} 10s ease infinite`, backdropFilter:'blur(8px)'
});

const COLORS = [
  '#7C3AED','#EC4899','#10B981','#3B82F6','#F59E0B',
  '#06B6D4','#8B5CF6','#F97316','#22C55E','#E11D48',
  '#14B8A6','#A855F7','#F43F5E','#0EA5E9','#84CC16'
];

// ----------------- helpers -----------------
const num = (v:any, d=0)=> Number.isFinite(+v) ? +v : d;
function rangeFromBucket(bucket: Bucket) {
  const to = new Date();
  const from = new Date();
  if (bucket === 'day') from.setDate(to.getDate()-1);
  else if (bucket === 'week') from.setDate(to.getDate()-7);
  else from.setMonth(to.getMonth()-1);
  return { from: from.toISOString(), to: to.toISOString() };
}
function roleFa(role: number) {
  return ({1:'مدیرکل',2:'سوپرادمین',3:'مدیر شعبه',4:'مالک',5:'تکنسین',6:'راننده'} as any)[role] ?? 'نامشخص';
}
const truncate = (s:string, n=18)=> s?.length>n ? s.slice(0,n-1)+'…' : s;

// ----------------- component -----------------
export default function AnalyticsPage() {
  const t = useTheme();
  const [bucket, setBucket] = useState<Bucket>('day');

  // نود انتخاب‌شده + بردکرامب برای دریل‌داون
  const [crumbs, setCrumbs] = useState<{id:number; name:string; role:number}[]>([]);
  const currentNodeId = crumbs.at(-1)?.id; // undefined یعنی روت (کاربر لاگین)

  // دیتا
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = useMemo(()=>rangeFromBucket(bucket), [bucket]);

  const fetchTree = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get('/analytics/tree', {
        params: {
          userId: currentNodeId, // اگر undefined باشد، بک‌اند خودش me را می‌گیرد
          from, to
        }
      });
      setPayload(res.data);
      if (!crumbs.length && res.data?.node) {
        setCrumbs([{ id: res.data.node.id, name: res.data.node.full_name, role: res.data.node.role_level }]);
      }
    } catch (e:any) {
      console.error('analytics tree error', e);
      setError(e?.response?.data?.message || 'خطا در دریافت داده');
      setPayload(null);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ fetchTree(); /* eslint-disable-next-line */ }, [bucket, currentNodeId]);

  const handleOpenChild = (child: any) => {
    setCrumbs(prev => [...prev, { id: child.id, name: child.full_name, role: child.role_level }]);
  };
  const handleBack = () => {
    setCrumbs(prev => prev.length>1 ? prev.slice(0,-1) : prev);
  };
  const handleCrumbClick = (index: number) => {
    setCrumbs(prev => prev.slice(0, index+1));
  };

  // ---------- UI states ----------
  if (loading && !payload) {
    return <Box sx={{height:'65vh', display:'grid', placeItems:'center'}}><CircularProgress/></Box>;
  }

  if (error) {
    return (
      <Box p={3}>
        <Paper sx={{p:3, ...fancy(t)}}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" fontWeight={900}>آنالیز</Typography>
            <IconButton onClick={fetchTree}><RefreshRoundedIcon/></IconButton>
          </Stack>
          <Typography color="error" mt={1}>{error}</Typography>
        </Paper>
      </Box>
    );
  }

  const node = payload?.node;
  const summary = node?.summary ?? { drivers:0, totalDistanceKm:0, engineHours:0, totalViolations:0 };
  const children = (node?.children ?? []).map((c:any)=>({
    ...c,
    summary: {
      drivers: num(c?.summary?.drivers, c?.role_level===6?1:0),
      totalDistanceKm: num(c?.summary?.totalDistanceKm, 0),
      engineHours: num(c?.summary?.engineHours, 0),
      totalViolations: num(c?.summary?.totalViolations, 0)
    }
  }));

  // ---------- derived datasets (برای نمودارها) ----------
  const childBar = children.map((c:any)=>({
    name: truncate(c.full_name),
    km: c.summary.totalDistanceKm,
    hours: c.summary.engineHours,
    drivers: c.summary.drivers,
    violations: c.summary.totalViolations,
    id: c.id,
    role: c.role_level
  }));

  const topByKm = [...childBar].sort((a,b)=>b.km-a.km).slice(0,8);
  const topByHours = [...childBar].sort((a,b)=>b.hours-a.hours).slice(0,8);

  // Donut share per child (km / hours)
  const pieKm = childBar.map(d=>({ name:d.name, value: d.km }));
  const pieHours = childBar.map(d=>({ name:d.name, value: d.hours }));

  // Role breakdown (در صورت نبودِ node.role_breakdown از همین children می‌سازیم)
  const roleBreakdown = (node?.role_breakdown as any) ?? children.reduce((acc:any,c:any)=>{
    acc[c.role_level] = (acc[c.role_level] ?? 0) + 1; return acc;
  }, {});
  const roleRadial = Object.entries(roleBreakdown).map(([lvl,count]:any, i)=>({
    name: roleFa(+lvl), count: num(count), fill: COLORS[i%COLORS.length]
  }));

  // Radar (نرمالایز شده برای مقایسه سریع)
  const maxKm = Math.max(1, ...topByKm.map(d=>d.km));
  const maxHours = Math.max(1, ...topByKm.map(d=>d.hours));
  const maxDrivers = Math.max(1, ...topByKm.map(d=>d.drivers));
  const radarData = topByKm.slice(0,6).map(d=>({
    subject: d.name,
    kmPct: +(100*d.km/maxKm).toFixed(1),
    hoursPct: +(100*d.hours/maxHours).toFixed(1),
    driversPct: +(100*d.drivers/maxDrivers).toFixed(1)
  }));

  // Scatter (همبستگی km و ساعت موتور)
  const scatterData = childBar.map(d=>({ x: d.km, y: d.hours, z: Math.max(1,d.drivers), name: d.name }));

  // Treemap (اندازه = km)
  const treeMapData = childBar.map((d, i)=>({ name: d.name, size: Math.max(0, d.km), fill: COLORS[i%COLORS.length] }));

  // Trend (اختیاری؛ اگر بک‌اند بده)
  const trend = payload?.trend || node?.trend || null;
  const trendData = (trend?.buckets ?? []).map((b:any)=>({
    label: new Date(b.bucket).toLocaleDateString('fa-IR'),
    km: num(b.km), hours: num(b.hours)
  }));

  return (
    <Box p={3}>
      {/* Header + controls */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h4" fontWeight={900}>آنالیز</Typography>
          {/* Breadcrumbs (drilldown path) */}
          <Breadcrumbs separator={<KeyboardArrowRightRoundedIcon fontSize="small" />}>
            {crumbs.map((c, idx)=>(
              <Link key={c.id}
                component="button"
                onClick={()=>handleCrumbClick(idx)}
                underline={idx===crumbs.length-1?'none':'hover'}
                color={idx===crumbs.length-1?'text.primary':'inherit'}
                sx={{fontWeight: idx===crumbs.length-1?800:500}}
              >
                {c.name} <Typography component="span" sx={{mx:.5}} variant="caption" color="text.secondary">({roleFa(c.role)})</Typography>
              </Link>
            ))}
          </Breadcrumbs>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <TextField select size="small" label="بازهٔ زمانی" value={bucket} onChange={e=>setBucket(e.target.value as Bucket)}>
            <MenuItem value="day">روزانه</MenuItem>
            <MenuItem value="week">هفتگی</MenuItem>
            <MenuItem value="month">ماهانه</MenuItem>
          </TextField>
          <Tooltip title="به‌روزرسانی">
            <IconButton onClick={fetchTree}><RefreshRoundedIcon/></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Summary cards of current node (aggregate over its subtree) */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{p:2, ...fancy(t)}}>
            <Typography color="text.secondary">راننده‌ها (کل زیرشاخه)</Typography>
            <Typography variant="h4" fontWeight={900}>{summary.drivers ?? 0}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{p:2, ...fancy(t)}}>
            <Typography color="text.secondary">کل مسافت (km)</Typography>
            <Typography variant="h4" fontWeight={900}>{num(summary.totalDistanceKm,0).toFixed(2)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{p:2, ...fancy(t)}}>
            <Typography color="text.secondary">ساعت موتور</Typography>
            <Typography variant="h4" fontWeight={900}>{num(summary.engineHours,0).toFixed(2)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{p:2, ...fancy(t)}}>
            <Typography color="text.secondary">کل تخلفات</Typography>
            <Typography variant="h4" fontWeight={900}>{summary.totalViolations ?? 0}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* ======= Charts Row 1: Stacked Bars + Donuts ======= */}
      <Grid container spacing={2} mb={2}>
        {/* Stacked bar: km + hours per child */}
        <Grid item xs={12} md={7}>
          <Paper sx={{p:2, ...fancy(t)}}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography fontWeight={800}>مسافت و ساعت موتور به‌ازای زیرمجموعه</Typography>
              <Chip size="small" label={`${childBar.length} مورد`} />
            </Stack>
            <Box sx={{height:340}}>
              <ResponsiveContainer>
                <ComposedChart data={childBar}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={60}/>
                  <YAxis />
                  <RTooltip />
                  <Legend />
                  <Bar dataKey="km" name="کیلومتر" stackId="a" />
                  <Bar dataKey="hours" name="ساعت موتور" stackId="a" />
                  <Line type="monotone" dataKey="drivers" name="راننده‌ها" />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Donut: سهم مسافت بین زیرمجموعه‌ها */}
        <Grid item xs={12} md={5}>
          <Paper sx={{p:2, ...fancy(t)}}>
            <Typography fontWeight={800} mb={1}>سهم مسافت بین زیرمجموعه‌ها</Typography>
            <Box sx={{height:340}}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieKm} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} label>
                    {pieKm.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie>
                  <RTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* ======= Charts Row 2: Donut Hours + Radar + Radial Role ======= */}
      <Grid container spacing={2} mb={2}>
        {/* Donut: سهم ساعت موتور */}
        <Grid item xs={12} md={4}>
          <Paper sx={{p:2, ...fancy(t)}}>
            <Typography fontWeight={800} mb={1}>سهم ساعت موتور</Typography>
            <Box sx={{height:300}}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieHours} dataKey="value" nameKey="name" innerRadius={50} outerRadius={100} label>
                    {pieHours.map((_,i)=><Cell key={i} fill={COLORS[(i+3)%COLORS.length]} />)}
                  </Pie>
                  <RTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Radar: مقایسه‌ی نرمالایز شده‌ی تاپ‌ها */}
        <Grid item xs={12} md={4}>
          <Paper sx={{p:2, ...fancy(t)}}>
            <Typography fontWeight={800} mb={1}>رادار تاپ‌ها (٪ نسبت به بیشینه)</Typography>
            <Box sx={{height:300}}>
              <ResponsiveContainer>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar name="km" dataKey="kmPct" stroke="#6366F1" fill="#6366F1" fillOpacity={0.5} />
                  <Radar name="hours" dataKey="hoursPct" stroke="#EC4899" fill="#EC4899" fillOpacity={0.3} />
                  <Radar name="drivers" dataKey="driversPct" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* RadialBar: تفکیک نقش‌ها */}
        <Grid item xs={12} md={4}>
          <Paper sx={{p:2, ...fancy(t)}}>
            <Typography fontWeight={800} mb={1}>تفکیک نقش‌ها (زیرمجموعهٔ مستقیم)</Typography>
            <Box sx={{height:300}}>
              <ResponsiveContainer>
                <RadialBarChart innerRadius="20%" outerRadius="95%" data={roleRadial}>
                  <RadialBar minAngle={5} background clockWise dataKey="count" />
                  <Legend />
                  <RTooltip />
                </RadialBarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* ======= Charts Row 3: Scatter + Treemap + Trend (optional) ======= */}
      <Grid container spacing={2} mb={2}>
        {/* Scatter: km vs hours */}
        <Grid item xs={12} md={6}>
          <Paper sx={{p:2, ...fancy(t)}}>
            <Typography fontWeight={800} mb={1}>رابطه‌ی مسافت و ساعت موتور</Typography>
            <Box sx={{height:320}}>
              <ResponsiveContainer>
                <ScatterChart>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="x" name="km" />
                  <YAxis type="number" dataKey="y" name="hours" />
                  <ZAxis type="number" dataKey="z" range={[30, 160]} name="drivers" />
                  <RTooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Legend />
                  <Scatter name="زیرمجموعه‌ها" data={scatterData} />
                </ScatterChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Treemap: اندازه بر اساس km */}
        <Grid item xs={12} md={6}>
          <Paper sx={{p:2, ...fancy(t)}}>
            <Typography fontWeight={800} mb={1}>Treemap مسافت</Typography>
            <Box sx={{height:320}}>
              <ResponsiveContainer>
                <Treemap
                  data={treeMapData.length ? treeMapData : [{name:'—', size:1}]}
                  dataKey="size"
                  stroke="#fff"
                  content={({x, y, width, height, index, name}:any)=>(
                    <g>
                      <rect x={x} y={y} width={width} height={height} fill={COLORS[index%COLORS.length]} opacity={.85}/>
                      {width>60 && height>20 && (
                        <text x={x+6} y={y+18} fontSize={12} fill="#fff">{name}</text>
                      )}
                    </g>
                  )}
                />
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Optional trend area (اگر بک‌اند بده) */}
      {trendData.length>0 && (
        <Grid container spacing={2} mb={2}>
          <Grid item xs={12}>
            <Paper sx={{p:2, ...fancy(t)}}>
              <Typography fontWeight={800} mb={1}>روند بازه‌ی انتخابی</Typography>
              <Box sx={{height:320}}>
                <ResponsiveContainer>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <RTooltip />
                    <Legend />
                    <Area type="monotone" dataKey="km" name="کیلومتر" />
                    <Area type="monotone" dataKey="hours" name="ساعت موتور" />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ======= جدول دریل‌داون ======= */}
      <Paper sx={{p:2, ...fancy(t)}}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography fontWeight={800}>زیرمجموعه‌های مستقیم</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={`${children.length} مورد`} />
            <Tooltip title="بازگشت به یک سطح بالاتر">
              <span>
                <IconButton onClick={handleBack} disabled={(crumbs.length||0) <= 1}>
                  <ArrowBackRoundedIcon/>
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>نام</TableCell>
              <TableCell>نقش</TableCell>
              <TableCell align="right">راننده‌ها</TableCell>
              <TableCell align="right">km</TableCell>
              <TableCell align="right">ساعت موتور</TableCell>
              <TableCell align="right">تخلفات</TableCell>
              <TableCell align="center">بازکردن</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {children.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary">زیرمجموعه‌ای وجود ندارد.</Typography>
                </TableCell>
              </TableRow>
            )}
            {children.map((c:any, idx:number)=>(
              <TableRow key={c.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {c.role_level === 6 ? <PersonRoundedIcon fontSize="small"/> : <FolderRoundedIcon fontSize="small"/>}
                    <Typography>{c.full_name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{roleFa(c.role_level)}</TableCell>
                <TableCell align="right">{c.summary?.drivers ?? (c.role_level===6?1:0)}</TableCell>
                <TableCell align="right">{num(c.summary?.totalDistanceKm,0).toFixed(2)}</TableCell>
                <TableCell align="right">{num(c.summary?.engineHours,0).toFixed(2)}</TableCell>
                <TableCell align="right">{c.summary?.totalViolations ?? 0}</TableCell>
                <TableCell align="center">
                  <Tooltip title={c.hasChildren ? 'نمایش زیرمجموعه' : (c.role_level===6?'رانندهٔ نهایی':'زیرمجموعه ندارد')}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={()=> c.hasChildren ? handleOpenChild(c) : undefined}
                        disabled={!c.hasChildren}
                      >
                        <KeyboardArrowRightRoundedIcon/>
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
