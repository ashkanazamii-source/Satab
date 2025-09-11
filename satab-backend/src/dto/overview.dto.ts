import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { IsIn } from 'class-validator';

export type Bucket = 'day' | 'week' | 'month';

export class OverviewQueryDto {
    @IsEnum(['day', 'week', 'month'], { message: 'bucket باید day|week|month باشد' })
    @Transform(({ value }) => (value ?? 'day'))
    @IsOptional()
    @IsIn(['day', 'week', 'month'])
    bucket: 'day' | 'week' | 'month' = 'day';
    @IsOptional()
    @Transform(({ value }) => (value ? Number(value) : 10))
    topN?: number = 10;
}
// src/dto/overview.dto.ts



export interface OverviewResponse {
    bucket: Bucket;
    range: { from: string; to: string };
    summaryCards: {
        drivers: number;
        totalDistanceKm: number;
        engineHours: number;
        totalViolations: number;
    };
    charts: {
        distancePerDriverBar: Array<{ driverId: number; name: string; km: number }>;
        engineHoursPerDriverBar: Array<{ driverId: number; name: string; hours: number }>;
        distanceTrendLine: Array<{ bucket: string; km: number }>;
        violationsPie: Array<{ type: string; count: number }>;
        consumablesPie: Array<{ name: string; remaining: number }>;
    };
    table: Array<{
        driverId: number;
        driverName: string;
        distanceKm: number;
        engineOnHours: number;
        violations: number;
    }>;
}
