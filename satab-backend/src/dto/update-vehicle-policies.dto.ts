import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
  ArrayMaxSize,
  ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';

export const VEHICLE_TYPES = [
  'bus', 'minibus', 'van', 'tanker', 'truck', 'khavar', 'sedan', 'pickup',
] as const;
export type VehicleTypeCode = (typeof VEHICLE_TYPES)[number];
export const VEHICLE_TYPES_ARR = [...VEHICLE_TYPES] as string[];

export const MONITOR_KEYS = [
  'gps', 'ignition', 'idle_time', 'odometer', 'engine_temp',
  'geo_fence', 'stations', 'routes', 'consumables',
] as const;
export type MonitorKey = (typeof MONITOR_KEYS)[number];
export const MONITOR_KEYS_ARR = [...MONITOR_KEYS] as string[];

/* ========== ۱) مدیرکل (full upsert) ========== */
export class VehiclePolicyItemDto {
  @IsIn(VEHICLE_TYPES_ARR)
  vehicle_type_code!: VehicleTypeCode;

  @IsBoolean()
  is_allowed!: boolean;

  @IsInt()
  @Min(0)
  max_count!: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(MONITOR_KEYS_ARR, { each: true })
  @Type(() => String)
  monitor_params?: MonitorKey[];
}

export class UpdateVehiclePoliciesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehiclePolicyItemDto)
  @ArrayMaxSize(32)
  policies!: VehiclePolicyItemDto[];
}

/* ========== ۲) سوپرادمین (bounded) ========== */
export class OneTypeBoundedPolicyDto {
  @IsIn(VEHICLE_TYPES_ARR)
  vehicle_type_code!: VehicleTypeCode;

  @IsArray()
  @ArrayUnique()
  @IsIn(MONITOR_KEYS_ARR, { each: true })
  @Type(() => String)
  monitor_params!: MonitorKey[];

  @IsOptional()
  @IsBoolean()
  is_allowed?: boolean;
}

export class SetBoundedVehiclePoliciesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OneTypeBoundedPolicyDto)
  @ArrayMaxSize(32)
  policies!: OneTypeBoundedPolicyDto[];
}
