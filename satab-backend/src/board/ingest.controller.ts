// src/ingest/ingest.controller.ts
import { Body, Controller, Headers, Logger, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { IngestDto } from './dto/ingest.dto';
import { IngestService } from './ingest.service';
const log = new Logger('IngestController');
@Controller('ingest')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class IngestController {
    constructor(private readonly svc: IngestService) { }

    // JSON استاندارد
    @Post('json')
    async ingestJson(@Body() body: IngestDto) {
        const vid = body?.data?.vehicle_id;
        const lat = body?.data?.lat, lng = body?.data?.lng;
        log.log(`rx json vid=${vid} lat=${lat} lng=${lng} ts=${body?.ts ?? 'now'}`);
        await this.svc.handleJson(body);
        return { ok: true };
    }

    // متن خام: برای بردهایی که JSON نمی‌فرستند
    @Post('text')
    async ingestText(@Req() req: any, @Headers('content-type') ct?: string) {
        const text = typeof req.body === 'string' ? req.body : (ct?.includes('text') ? String(req.body) : '');
        log.log(`rx text: ${text.slice(0, 200)}`);
        await this.svc.handleText(text);
        return { ok: true };
    }
}
