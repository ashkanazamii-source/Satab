import dayjs from 'dayjs';

declare module 'dayjs' {
  interface Dayjs {
    calendar(referenceTime?: dayjs.ConfigType, formats?: object): string;
  }
}
