// pairing/dto.ts
import { IsInt, Min, IsString, Length, Matches, IsOptional, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class IssueDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number; // ownerId
}

export class RedeemDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'code باید ۴ رقم باشد' })
  code!: string; // "0000".."9999"

  @IsString()
  @Matches(/^[0-9a-f]{24}$/i, { message: 'device_id باید hex با طول ۲۴ کاراکتر (۹۶ بیت) باشد' })
  @Transform(({ value }) => String(value).toLowerCase())
  device_id!: string; // 96-bit hex

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  device_name?: string;
}
