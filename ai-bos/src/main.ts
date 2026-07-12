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

  // CORS: gioi han theo danh sach domain cho phep (bien moi truong ALLOWED_ORIGINS,
  // cach nhau boi dau phay). KHONG con mo hoan toan nhu truoc - truoc khi len
  // production BAT BUOC dien domain that (vd domain website PCTech/RemoteIT,
  // domain Admin Frontend sau nay), tranh website la co the goi API tu do.
  //
  // LUU Y: cac endpoint public khong dung cookie/session (chi JWT trong header
  // hoac hoan toan khong xac thuc nhu webchat/webhook), nen rui ro CORS o day
  // chu yeu la ngan website la GOI API THAY MAT nguoi dung that (neu ho dang
  // dang nhap tab khac) - van nen gioi han thay vi de mo mai mai.
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : true; // fallback: mo cho MOI origin - CHI dung khi dev/test, PHAI cau hinh ALLOWED_ORIGINS truoc khi len that

  if (allowedOrigins === true) {
    // eslint-disable-next-line no-console
    console.warn(
      '[CANH BAO] ALLOWED_ORIGINS chua duoc cau hinh - CORS dang mo cho MOI domain. ' +
        'Dien bien moi truong ALLOWED_ORIGINS (vd: https://pctech.vn,https://remoteit.com) truoc khi len production.',
    );
  }

  app.enableCors({ origin: allowedOrigins, credentials: true });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`AI BOS backend dang chay tai http://localhost:${port}`);
}
bootstrap();
