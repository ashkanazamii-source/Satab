// src/lib/dayjs-setup.ts
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import jalaliPlugin from 'jalali-dayjs';
import 'dayjs/locale/fa';

// پلاگین‌ها
dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(jalaliPlugin);

// فیکس خطای 'L'
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

// زبان
dayjs.locale('fa');

export default dayjs;
