// src/ingest/dto/ingest.dto.ts
import { IsNumber, IsOptional, IsString, IsObject, ValidateNested, IsBoolean, Min, Max, ValidateIf, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';

// ingest.dto.ts
class IngestDataDto {
  @Type(() => Number) @IsNumber() vehicle_id!: number
  @IsOptional() @Type(() => Number) @IsNumber() lat?: number
  @IsOptional() @Type(() => Number) @IsNumber() lng?: number
  @IsOptional() @Type(() => Number) @IsNumber() speed?: number
  @IsOptional() @Type(() => Number) @IsNumber() heading?: number
  @IsOptional() @IsBoolean() ignition?: boolean
  @IsOptional() @Type(() => Number) @IsNumber() odometer?: number
  @IsOptional() @Type(() => Number) @IsNumber() idle_time?: number
  engine_temp: number | undefined;
}

export class IngestDto {
  @IsOptional() @IsString() device_id?: string
  @IsOptional() @Type(() => Number) @IsNumber() ts!: number
  @IsOptional() @IsObject() meta?: Record<string, any>
  @IsDefined() @ValidateNested() @Type(() => IngestDataDto) data!: IngestDataDto
}

