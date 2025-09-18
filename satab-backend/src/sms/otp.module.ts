// src/sms/sms.module.ts
import { Module } from '@nestjs/common';
import { SmsProvider } from './sms.provider';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';

@Module({
  providers: [SmsProvider],
  exports: [SmsProvider],
})
export class SmsModule {}

// src/sms/otp.module.ts (اگر داری) یا هر ماژولی که OtpService/Controller داخلش است
@Module({
  imports: [SmsModule],
  providers: [OtpService],
  controllers: [OtpController],
})
export class OtpModule {}
