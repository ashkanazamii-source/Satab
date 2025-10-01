// src/driver-vehicle-assignment/dto/assign.dto.ts
import { IsInt, IsISO8601, IsOptional, IsPositive } from 'class-validator';

export class StartAssignmentDto {
  @IsInt() @IsPositive()
  driverId: number;

  @IsInt() @IsPositive()
  vehicleId: number;
}

export class EndAssignmentDto {
  @IsInt() @IsPositive()
  driverId: number;
  @IsInt()
  vehicleId: number;
}
export class ToggleAssignmentDto {
  @IsInt() @IsPositive()
  driverId: number;

  @IsInt() @IsPositive()
  vehicleId: number;

  @IsOptional() @IsISO8601()
  at?: string; // اختیاری
}