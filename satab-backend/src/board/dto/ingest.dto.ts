import { IsNumber, IsOptional, IsString, IsObject } from 'class-validator';

export class IngestDto {
  @IsString() device_id!: string;
  @IsNumber() ts!: number;                 // epoch seconds/millis
  @IsObject() @IsOptional() meta?: Record<string, any>;
  @IsObject() @IsOptional() data?: Record<string, any>;
}
