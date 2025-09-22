// consumables.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, ParseIntPipe, Body, UsePipes, ValidationPipe
} from '@nestjs/common';
import { ConsumablesService } from './consumables.service';
import { CreateConsumableDto, UpdateConsumableDto } from '../dto/consumables.dto';
import { Query } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExportConsumablesDto } from '../dto/consumables.dto';

@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
@Controller('vehicles/:vehicleId/consumables')
export class ConsumablesController {
  constructor(private readonly service: ConsumablesService) {}

  @Get()
  list(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
    return this.service.list(vehicleId);
  }

  @Get(':id')
  getOne(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.getOne(vehicleId, id);
  }

  @Post()
  create(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() dto: CreateConsumableDto,
  ) {
    return this.service.create(vehicleId, dto);
  }

  @Patch(':id')
  update(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConsumableDto,
  ) {
    return this.service.update(vehicleId, id, dto);
  }

  @Delete(':id')
  remove(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.remove(vehicleId, id);
  }
}
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
@Controller('super-admins/:superAdminId/consumables')
export class ConsumablesForSaController {
  constructor(
    private readonly service: ConsumablesService,
    private readonly http: HttpService,
  ) {}

  /**
   * کل مصرفی‌های خودروهای زیرمجموعهٔ یک سوپرادمین را جمع می‌کند
   * و به URL داده‌شده POST می‌زند (ارسال چانکی).
   *
   * POST /super-admins/:superAdminId/consumables/export?from=...&to=...&mode=km&vehicleId=123
   * body: { "url": "https://example.com/hook", "chunk_size": 500, "timeout_ms": 120000 }
   */
  @Post('export')
  async exportAllForSA(
    @Param('superAdminId', ParseIntPipe) superAdminId: number,
    @Body() dto: ExportConsumablesDto,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('mode') mode?: 'km' | 'time',
    @Query('vehicleId') vehicleIdQ?: string,
  ) {
    const pageLimit = 1000;                          // اندازهٔ خواندن از DB در هر صفحه
    const chunkSize = dto.chunk_size ?? 500;         // اندازهٔ هر بستهٔ ارسال
    const timeout = dto.timeout_ms ?? 120_000;       // تایم‌اوت هر درخواست POST

    let offset = 0;
    let total = 0;
    let batchCounter = 0;

    // صفحه به صفحه می‌خوانیم تا تمام شود
    for (;;) {
      const page = await this.service.listForSuperAdmin(superAdminId, {
        from, to,
        mode,
        vehicleId: vehicleIdQ ? Number(vehicleIdQ) : undefined,
        limit: pageLimit,
        offset,
      });

      if (!page.length) break;

      // ارسال چانکی به URL مقصد
      for (let i = 0; i < page.length; i += chunkSize) {
        const batch = page.slice(i, i + chunkSize);
        await firstValueFrom(
          this.http.post(
            dto.url,
            {
              superAdminId,
              totalEstimated: 'unknown', // اگر خواستی تخمینی بده، می‌تونی یک count جدا بگیری
              batchIndex: batchCounter++,
              batchSize: batch.length,
              items: batch,
            },
            { timeout },
          ),
        );
        total += batch.length;
      }

      offset += page.length;
    }

    return {
      superAdminId,
      posted_to: dto.url,
      sent: total,
      ok: true,
    };
  }
  // لیست مصرفی‌های زیرمجموعهٔ SA (برای داشبورد)
@Get()
async listForSA(
  @Param('superAdminId', ParseIntPipe) superAdminId: number,
  @Query('limit') limitQ?: string,
  @Query('offset') offsetQ?: string,
  @Query('mode') mode?: 'km' | 'time',
  @Query('from') from?: string,
  @Query('to') to?: string,
  @Query('vehicleId') vehicleIdQ?: string,
) {
  const limit = Math.min(Math.max(Number(limitQ ?? 300), 1), 10_000);
  const offset = Math.max(Number(offsetQ ?? 0), 0);

  const rows = await this.service.listForSuperAdmin(superAdminId, {
    limit,
    offset,
    mode,
    from,
    to,
    vehicleId: vehicleIdQ ? Number(vehicleIdQ) : undefined,
  });

  // می‌تونی همین آرایه را برگردونی یا در صورت نیاز به شکل {items,limit,offset} بدهی
  return rows;
}

}
