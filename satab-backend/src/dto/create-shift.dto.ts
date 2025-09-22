// src/shifts/dto/create-shift.dto.ts
import { IsEnum, IsInt, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ShiftStatus, ShiftType } from '../shifts/shift.entity';
import { Type } from 'class-transformer';

export class CreateShiftDto {
  @Type(() => Number)
  @IsInt()
  driver_id: number;

  @IsOptional() @Type(() => Number) @IsInt()
  vehicle_id?: number | null;

  @IsOptional() @Type(() => Number) @IsInt()
  route_id?: number | null;

  @IsOptional() @Type(() => Number) @IsInt()
  station_start_id?: number | null;

  @IsOptional() @Type(() => Number) @IsInt()
  station_end_id?: number | null;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  start_time: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  end_time: string;

  @IsEnum(ShiftType)
  type: ShiftType;

  @IsOptional()
  @IsString()
  @MinLength(0)
  note?: string;

  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus; // اگر نفرستی، DRAFT می‌شود
}
