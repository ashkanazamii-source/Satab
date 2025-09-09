// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { NestExpressApplication } from '@nestjs/platform-express'; // ⬅️ اضافه شد
import { join } from 'path'; // ⬅️ اضافه شد

async function bootstrap() {
  // تغییر نوع app
  const app = await NestFactory.create<NestExpressApplication>(AppModule); 

  app.enableCors();

  // اضافه کردن static assets
  // این خط به سرور می‌گوید فایل‌های داخل پوشه 'uploads' را از مسیر '/uploads' سرو کند
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads', // URL prefix
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log('📡 Connected to DB:', (await app.get(DataSource)).isInitialized);
  console.log(`🚀 Server is running on port ${port}`);
  console.log({
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
  });
}
bootstrap();