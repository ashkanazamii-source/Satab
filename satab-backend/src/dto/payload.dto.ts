import { IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, ValidateNested, IsArray, ArrayNotEmpty, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ShiftStatus } from '../shifts/shift.entity';

export class ShiftProfilePayloadDto {
  @IsString() start_time!: string; // 'HH:mm' (اعتبارسنجی فرمت را در سرویس هم چک می‌کنیم)
  @IsString() end_time!: string;

  @IsIn(['morning', 'evening', 'night'])
  type!: 'morning' | 'evening' | 'night';

  @IsOptional() @IsInt() vehicle_id?: number | null;
  @IsOptional() @IsInt() route_id?: number | null;
  @IsOptional() @IsInt() station_start_id?: number | null;
  @IsOptional() @IsInt() station_end_id?: number | null;

  @IsOptional() @IsString() @MaxLength(500)
  note?: string | null;

  @IsOptional() @IsEnum(ShiftStatus)
  status?: ShiftStatus;

  @IsOptional() @IsArray()
  @Type(() => String)
  apply_dates?: string[]; // 'YYYY-MM-DD'
}
