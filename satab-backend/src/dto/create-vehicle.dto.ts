// src/dto/create-vehicle.dto.ts
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  IsInt,
} from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['IR', 'QA', 'AE', 'IQ', 'AF', 'TM', 'TR'])
  country_code: 'IR' | 'QA' | 'AE' | 'IQ' | 'AF' | 'TM' | 'TR';

  @IsString()
  @IsNotEmpty()
  plate_no: string;

  @IsIn(['bus', 'minibus', 'van', 'tanker', 'truck', 'khavar', 'sedan', 'pickup'])
  vehicle_type_code:
    | 'bus'
    | 'minibus'
    | 'van'
    | 'tanker'
    | 'truck'
    | 'khavar'
    | 'sedan'
    | 'pickup';

  @IsInt()
  owner_user_id: number;

  // IMEI اختیاری — اگر ارسال شود، باید معتبر باشد
  @IsOptional()
  @Matches(/^[A-Z0-9._-]{4,64}$/)
  tracker_imei?: string;

  // پین ۴ رقمی اختیاری (برای جفت‌سازی/Provisioning)
  @IsOptional()
  @Matches(/^\d{4}$/)
  pairing_pin?: string;

  @IsOptional()
  vin?: string;

  // فقط برای تانکر ممکن است استفاده شود
  @IsOptional()
  tank_capacity_liters?: number;

  @IsOptional()
  @IsInt()
  responsible_user_id?: number | null;
}

// ——————————————————————————————————————————————————————————————

export function normalizePlate(input: string): string {
  if (!input) return '';
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  const map = (ch: string) => {
    const i1 = fa.indexOf(ch);
    if (i1 >= 0) return String(i1);
    const i2 = ar.indexOf(ch);
    if (i2 >= 0) return String(i2);
    return ch;
  };
  return input
    .trim()
    .split('')
    .map(map)
    .join('')
    .replace(/[\s\-_.]/g, '')
    .toUpperCase();
}


export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['IR', 'QA', 'AE', 'IQ', 'AF', 'TM', 'TR'])
  country_code?: 'IR' | 'QA' | 'AE' | 'IQ' | 'AF' | 'TM' | 'TR';

  @IsOptional()
  @IsString()
  plate_no?: string;

  @IsOptional()
  @IsIn(['bus', 'minibus', 'van', 'tanker', 'truck', 'khavar', 'sedan', 'pickup'])
  vehicle_type_code?:
    | 'bus'
    | 'minibus'
    | 'van'
    | 'tanker'
    | 'truck'
    | 'khavar'
    | 'sedan'
    | 'pickup';

  // همچنان اختیاری: اگر بیاید باید معتبر باشد
  @IsOptional()
  @Matches(/^[A-Z0-9._-]{4,64}$/)
  tracker_imei?: string;

  @IsOptional()
  @IsInt()
  owner_user_id?: number;

  @IsOptional()
  vin?: string;

  @IsOptional()
  tank_capacity_liters?: number;
}
