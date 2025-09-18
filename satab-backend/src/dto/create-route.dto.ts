// src/vehicles/dto/create-route.dto.ts
import { Type } from 'class-transformer';
import { IsArray, ArrayMinSize, ValidateNested, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRoutePointDto {
  @IsNumber() lat: number;
  @IsNumber() lng: number;

  @IsOptional()
  @IsInt() @Min(1)
  order_no?: number;

  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsInt() @Min(1)
  radius_m?: number;
}

export class CreateRouteDto {
  @IsString() name: string;

  @IsOptional() @IsInt() @Min(1)
  threshold_m?: number;

  @IsArray() @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateRoutePointDto)
  points: CreateRoutePointDto[];
}
