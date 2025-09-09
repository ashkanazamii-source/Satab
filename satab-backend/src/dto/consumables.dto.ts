// dto/consumables.dto.ts
import { IsIn, IsNumber, IsOptional, IsISO8601, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateConsumableDto {
  @IsIn(['km','time']) mode: 'km'|'time';
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsISO8601() start_at?: string;      // time
  @IsOptional() @IsNumber()  base_odometer_km?: number; // km
}
export class UpdateConsumableDto extends PartialType(CreateConsumableDto) {}
