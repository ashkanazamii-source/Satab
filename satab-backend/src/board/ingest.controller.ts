// src/ingest/ingest.controller.ts
import { Body, Controller, Headers, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiKeyGuard } from './guards/api-key.guard';
import { IngestDto } from './dto/ingest.dto';
import { IngestService } from './ingest.service';

@Controller('ingest')
@UseGuards(ApiKeyGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class IngestController {
    constructor(private readonly svc: IngestService) { }

    // JSON استاندارد
    @Post('json')
    async ingestJson(@Body() body: IngestDto) {
        await this.svc.handleJson(body);
        return { ok: true };
    }

    // متن خام: برای بردهایی که JSON نمی‌فرستند
    @Post('text')
    async ingestText(@Req() req: any, @Headers('content-type') ct?: string) {
        const text = typeof req.body === 'string'
            ? req.body
            : (ct?.includes('text') ? String(req.body) : '');
        await this.svc.handleText(text);
        return { ok: true };
    }
}
