// src/shifts/dto/update-shift.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateShiftDto } from './create-shift.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ShiftStatus } from '../shifts/shift.entity';

export class UpdateShiftDto extends PartialType(CreateShiftDto) {
    @IsOptional()
    @IsEnum(ShiftStatus)
    status?: ShiftStatus; 
}
