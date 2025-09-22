// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { networkInterfaces } from 'os';

function getLocalIPs(): string[] {
  const nets = networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
    }
  }
  return ips;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',').map(s => s.trim()) || true,
    credentials: false,
  });

  // سرو استاتیک آپلودها
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  const port = Number(process.env.PORT || 3000);

  // ⬅️ مهم: روی همه‌ی اینترفیس‌ها گوش بده تا از شبکه‌ی محلی هم در دسترس باشه
  await app.listen(port, '0.0.0.0');

  const ds = await app.get(DataSource);

  console.log('📡 Connected to DB:', ds.isInitialized);
  console.log(`🚀 Server is running on 0.0.0.0:${port}`);
  console.log({
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
  });

  const ips = getLocalIPs();
  if (ips.length) {
    console.log('🔗 Local LAN URLs (به برد بده):');
    ips.forEach(ip => {
      console.log(`- http://${ip}:${port}/pairing-codes/redeem`);
      console.log(`- http://${ip}:${port}/board/ingest`);
    });
  } else {
    console.log('⚠️ نتونستم IP لوکال پیدا کنم؛ سیستم و برد باید روی یک شبکه باشند.');
  }
}

bootstrap();
