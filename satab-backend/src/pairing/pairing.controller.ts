// pairing/pairing.controller.ts
import { Body, Controller, Get, HttpCode, Logger, Post, Query, Req, BadRequestException } from '@nestjs/common';
import { PairingService } from './pairing.service';
import { IssueDto, RedeemDto } from '../dto/pairing.dto';

@Controller()
export class PairingController {
  private readonly logger = new Logger(PairingController.name);
  constructor(private readonly pairing: PairingService) {}

  @Post('pairing-codes')
  @HttpCode(201)
  async issue(@Body() dto: IssueDto, @Req() req: any) {
    this.logger.log(`ISSUE by user=${req?.user?.id ?? '-'} for userId=${dto.userId}`);
    return this.pairing.issue(dto.userId);
  }

  // برد اینو صدا می‌زنه: فقط vehicle_id برمی‌گرده
  @Post('pairing-codes/redeem')
  @HttpCode(200)
  async redeem(@Body() dto: RedeemDto) {
    return this.pairing.redeem(dto.code, dto.device_id, dto.device_name);
  }

  // (اگه لازم نداری، می‌تونی حذفش کنی)
  @Get('pairing-codes/wait')
  @HttpCode(200)
  async wait(@Query('code') code: string) {
    if (!code || !/^\d{4}$/.test(code)) throw new BadRequestException('bad code');
    return this.pairing.wait(code);
  }
}
