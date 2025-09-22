// dto/consumables.dto.ts
import {
  IsIn, IsNumber, IsOptional, IsISO8601, IsString,
  IsUrl, IsInt, Min
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';

export class CreateConsumableDto {
  @IsIn(['km','time']) mode: 'km'|'time';
  @IsOptional() @IsString() note?: string;

  // حالت time
  @IsOptional() @IsISO8601() start_at?: string;

  // حالت km
  @IsOptional() @Type(() => Number) @IsNumber() base_odometer_km?: number;
}
export class UpdateConsumableDto extends PartialType(CreateConsumableDto) {}

/** بدنهٔ درخواست برای اکسپورت همهٔ مصرفی‌های زیرمجموعهٔ یک سوپرادمین */
export class ExportConsumablesDto {
  @IsUrl()
  url!: string;                           // مقصد POST

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  chunk_size?: number;                    // اندازه دسته‌ها (پیش‌فرض 500)

  @IsOptional() @Type(() => Number) @IsInt() @Min(1000)
  timeout_ms?: number;                    // تایم‌اوت هر درخواست (پیش‌فرض 120000)
}
