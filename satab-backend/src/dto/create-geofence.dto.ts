// dto/create-geofence.dto.ts
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsPositive, Min, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class LatLngDto {
    @IsNumber() lat!: number;
    @IsNumber() lng!: number;
}

export class CreateGeofenceDto {
    @IsIn(['polygon', 'circle'])
    type!: 'polygon' | 'circle';

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => LatLngDto)
    @ArrayMinSize(3)
    polygonPoints?: LatLngDto[];

    @IsOptional() @IsNumber() centerLat?: number;
    @IsOptional() @IsNumber() centerLng?: number;
    @IsOptional() @IsNumber() @IsPositive() radiusM?: number;

    @IsOptional() @IsInt() @Min(0) toleranceM?: number;
    @IsOptional() @IsInt() @Min(1) outsideN?: number;
    @IsOptional() @IsInt() @Min(0) cooldownMs?: number;
    @IsOptional() @IsBoolean() active?: boolean;
}
// dto/update-geofence.dto.ts
import { PartialType } from '@nestjs/mapped-types';

export class UpdateGeofenceDto extends PartialType(CreateGeofenceDto) { }