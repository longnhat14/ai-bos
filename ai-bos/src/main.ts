import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import { AttachmentsService } from './modules/tickets/attachments.service';
import { AppModule } from './app.module';

async function bootstrap() {
  // Tao san thu muc luu file dinh kem, tranh loi ENOENT khi multer ghi file lan dau
  const uploadDir = AttachmentsService.getUploadDir();
  fs.mkdirSync(uploadDir, { recursive: true });

  const app = await NestFactory.create(AppModule);

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
