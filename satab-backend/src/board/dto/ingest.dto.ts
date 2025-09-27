// src/ingest/dto/ingest.dto.ts
import { IsNumber, IsOptional, IsString, IsObject, ValidateNested, IsBoolean, Min, Max, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

class IngestDataDto {
  @IsOptional() @IsNumber() vehicle_id?: number;

  @ValidateIf(o => o.lat !== undefined)
  @IsNumber() @Min(-90) @Max(90)
  lat?: number;

  @ValidateIf(o => o.lng !== undefined)
  @IsNumber() @Min(-180) @Max(180)
  lng?: number;

  @IsOptional() @IsNumber() speed?: number;
  @IsOptional() @IsNumber() heading?: number;
  @IsOptional() @IsBoolean() ignition?: boolean;
  @IsOptional() @IsNumber() odometer?: number;
  @IsOptional() @IsNumber() idle_time?: number;
}

export class IngestDto {
  @IsString() device_id!: string;   // public_id یا device_id
  @IsNumber() ts!: number;          // epoch milliseconds یا seconds

  @IsOptional() @IsObject() meta?: Record<string, any>;

  @IsOptional() @ValidateNested() @Type(() => IngestDataDto)
  data?: IngestDataDto;
}
