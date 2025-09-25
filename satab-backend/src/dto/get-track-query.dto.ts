import { IsISO8601, IsOptional } from 'class-validator';

export class GetTrackQueryDto {
  @IsISO8601({}, { message: 'فرمت تاریخ شروع باید ISO8601 باشد (e.g., 2025-09-25T10:00:00.000Z)' })
  @IsOptional()
  from?: string;

  @IsISO8601({}, { message: 'فرمت تاریخ پایان باید ISO8601 باشد (e.g., 2025-09-25T14:00:00.000Z)' })
  @IsOptional()
  to?: string;
}