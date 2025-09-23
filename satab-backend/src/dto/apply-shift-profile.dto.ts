// src/shift-profiles/dto/apply-shift-profile.dto.ts
import { IsArray, ArrayNotEmpty, IsInt, IsOptional, IsBoolean, IsIn, IsString } from 'class-validator';

export class ApplyShiftProfileDto {
  @IsArray() @ArrayNotEmpty() @IsInt({ each: true })
  driver_ids: number[];

  @IsArray() @IsOptional() @IsString({ each: true }) // 'YYYY-MM-DD'
  dates?: string[];

  @IsBoolean() @IsOptional()
  publish?: boolean;

  /** اگر true باشد ابتدا شیفت‌های قبلی پاک می‌شوند */
  @IsBoolean() @IsOptional()
  wipe_first?: boolean;

  /** دامنهٔ پاک‌سازی: همهٔ شیفت‌های راننده یا فقط همین تاریخ‌ها */
  @IsOptional() @IsIn(['all','dates'])
  wipe_scope?: 'all' | 'dates';
}
