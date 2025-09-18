// src/sms/otp.controller.ts
import { Body, Controller, Get, Headers, Post, Query, ForbiddenException } from '@nestjs/common';
import { OtpService } from './otp.service';

@Controller('auth/otp') // مسیر واضح‌تر از 'auth'
export class OtpController {
  constructor(private otp: OtpService) {}

  @Post('send')
  send(@Body() body: { phone: string; purpose?: string }) {
    return this.otp.send(body.phone, body.purpose ?? 'signup');
  }

  @Post('verify')
  async verify(@Body() body: { phone: string; code: string; purpose?: string }) {
    return this.otp.verify(body.phone, body.code, body.purpose ?? 'signup');
  }

  // اختیاری: فقط برای QA — با توکن
  @Get('_peek')
  peek(
    @Query('phone') phone: string,
    @Query('purpose') purpose = 'signup',
    @Headers('x-debug-token') token?: string,
  ) {
    const expected = process.env.OTP_DEBUG_TOKEN;
    if (!expected || token !== expected) {
      throw new ForbiddenException('invalid debug token');
    }
    return this.otp.peek(phone, purpose);
  }
}
