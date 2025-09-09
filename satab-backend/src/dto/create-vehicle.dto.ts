// src/dto/create-vehicle.dto.ts
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
export class CreateVehicleDto {
  @IsIn(['IR', 'QA', 'AE', 'IQ', 'AF', 'TM', 'TR'])
  country_code: 'IR' | 'QA' | 'AE' | 'IQ' | 'AF' | 'TM' | 'TR';

  @IsString() @IsNotEmpty()
  plate_no: string;

  @IsIn(['bus', 'minibus', 'van', 'tanker', 'truck', 'khavar', 'sedan', 'pickup'])
  vehicle_type_code: 'bus' | 'minibus' | 'van' | 'tanker' | 'truck' | 'khavar' | 'sedan';

  @IsNotEmpty()
  owner_user_id: number;
  @IsNotEmpty()
  @Matches(/^[A-Z0-9._-]{4,64}$/)
  tracker_imei: string;
  @IsOptional() vin?: string;
  @IsOptional() fuel_type?: string;
  @IsOptional() manufactured_year?: number;
  @IsOptional() tank_capacity_liters?: number;
}
// src/vehicles/dto/update-vehicle.dto.ts
export class UpdateVehicleDto {
  @IsOptional() @IsIn(['IR', 'QA', 'AE', 'IQ', 'AF', 'TM', 'TR'])
  country_code?: 'IR' | 'QA' | 'AE' | 'IQ' | 'AF' | 'TM' | 'TR';

  @IsOptional() @IsString()
  plate_no?: string;

  @IsOptional() @IsIn(['bus', 'minibus', 'van', 'tanker', 'truck', 'khavar', 'sedan', 'pickup'])
  vehicle_type_code?: 'bus' | 'minibus' | 'van' | 'tanker' | 'truck' | 'khavar' | 'sedan' | 'pickup';
  @Matches(/^[A-Z0-9._-]{4,64}$/)
  tracker_imei?: string;
  @IsOptional() owner_user_id?: number;
  @IsOptional() vin?: string;
  @IsOptional() fuel_type?: string;
  @IsOptional() manufactured_year?: number;
  @IsOptional() tank_capacity_liters?: number;
}
export function normalizePlate(input: string): string {
  if (!input) return '';
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  const map = (ch: string) => {
    const i1 = fa.indexOf(ch); if (i1 >= 0) return String(i1);
    const i2 = ar.indexOf(ch); if (i2 >= 0) return String(i2);
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
