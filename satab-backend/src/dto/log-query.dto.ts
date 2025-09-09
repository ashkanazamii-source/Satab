// src/dto/log-query.dto.ts
import {
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  IsDateString,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

const toInt = (v: any) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : undefined;
};

const toTopics = (v: any): string[] => {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
};

const toDateStr = (v: any) => {
  if (v === undefined || v === null || String(v).trim() === '') return undefined;
  return String(v).trim(); // نمونه ورودی: 2024-10-08 (ISO کوتاه)
};

const toBool = (v: any) => v === true || v === 'true' || v === '1' || v === 1;

export class LogQueryDto {
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  actor_id?: number;

  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  target_user_id?: number;

  @IsOptional()
  @Transform(({ value }) => toTopics(value))
  @IsArray()
  topic?: string[];

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => toDateStr(value))
  @IsDateString()
  from?: string;

  @IsOptional()
  @Transform(({ value }) => toDateStr(value))
  @IsDateString()
  to?: string;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  includeTechnical?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  includeRequests?: boolean;

  @IsOptional()
  @Transform(({ value }) => toInt(value) ?? 1)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => toInt(value) ?? 20)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;
}
