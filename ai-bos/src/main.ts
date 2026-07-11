import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as fs from 'fs';
import { join } from 'path';
import { AttachmentsService } from './modules/tickets/attachments.service';
import { SettingsController } from './modules/settings/settings.controller';
import { WebChatController } from './modules/webchat/webchat.controller';
import { AppModule } from './app.module';

async function bootstrap() {
  // Tao san cac thu muc luu file dinh kem, tranh loi ENOENT khi multer ghi file lan dau
  fs.mkdirSync(AttachmentsService.getUploadDir(), { recursive: true });
  fs.mkdirSync(WebChatController.getUploadDir(), { recursive: true });
  fs.mkdirSync(SettingsController.getUploadDir(), { recursive: true });

  // rawBody: true - can thiet de xac thuc chu ky webhook WhatsApp (X-Hub-Signature-256),
  // Meta ky chu ky dua tren RAW BYTES cua body, khong phai JSON da parse.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Serve CONG KHAI thu muc uploads/branding (logo thuong hieu) qua URL /uploads/branding/*.
  // CHI thu muc nay duoc serve cong khai - cac thu muc khac (ticket attachments, webchat images)
  // KHONG serve tinh, vi chua anh nhay cam (loi may, thong tin khach hang) khong nen public.
  app.useStaticAssets(join(process.cwd(), 'uploads', 'branding'), {
    prefix: '/uploads/branding/',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // loai bo field khong khai bao trong DTO - chong injection du lieu thua
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`AI BOS backend dang chay tai http://localhost:${port}`);
}
bootstrap();
