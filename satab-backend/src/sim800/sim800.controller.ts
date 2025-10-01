// sim800.controller.ts
import { Controller, Get, Post, Body, Headers } from '@nestjs/common';

@Controller('sim800')
export class Sim800Controller {
  @Get('ping')
  ping() {
    return 'OK'; // Nest به‌صورت پیش‌فرض JSON می‌دهد؛
                 // اگر متن خالص می‌خواهی از res.send استفاده کن.
  }

  @Post('data')
  data(@Body() body: any, @Headers() headers: any) {
    // اگر بدنه متنی می‌آید، در main.ts یک TextBody middleware بگذار یا raw body بگیر
    console.log('SIM800 DATA:', body);
    return { ok: true };
  }
}
