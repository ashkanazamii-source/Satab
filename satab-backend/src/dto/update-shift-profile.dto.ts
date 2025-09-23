import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ShiftProfilePayloadDto } from './payload.dto';

export class UpdateShiftProfileDto {
  @IsOptional() @IsString() @MaxLength(160)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftProfilePayloadDto)
  payload?: ShiftProfilePayloadDto;
}
