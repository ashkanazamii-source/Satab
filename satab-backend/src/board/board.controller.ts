import { Body, Controller, Headers, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiKeyGuard } from './guards/api-key.guard';
import { IngestDto } from './dto/ingest.dto';
import { BoardService } from './board.service';

@Controller('board')
@UseGuards(ApiKeyGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class BoardController {
  constructor(private readonly service: BoardService) {}

  // JSON: برد بفرسته Content-Type: application/json
  @Post('ingest')
  async ingestJson(@Body() body: IngestDto) {
    return this.service.handleIngest(body);
  }

  // متن خام: اگر برد JSON بلد نیست و متن می‌فرسته
  @Post('ingest-text')
  async ingestText(@Req() req: any, @Headers('content-type') ct?: string) {
    const text = typeof req.body === 'string' ? req.body : (ct?.includes('text') ? String(req.body) : '');
    return this.service.handleIngest(text);
  }
}
