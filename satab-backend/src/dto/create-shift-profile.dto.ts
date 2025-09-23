import { IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ShiftProfilePayloadDto } from './payload.dto';

export class CreateShiftProfileDto {
  @IsString() @MaxLength(160)
  name!: string;

  @ValidateNested()
  @Type(() => ShiftProfilePayloadDto)
  payload!: ShiftProfilePayloadDto;
}
