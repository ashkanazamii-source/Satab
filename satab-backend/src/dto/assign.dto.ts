// src/driver-vehicle-assignment/dto/assign.dto.ts
import { IsInt, IsPositive } from 'class-validator';

export class StartAssignmentDto {
  @IsInt() @IsPositive()
  driverId: number;

  @IsInt() @IsPositive()
  vehicleId: number;
}

export class EndAssignmentDto {
  @IsInt() @IsPositive()
  driverId: number;
}
