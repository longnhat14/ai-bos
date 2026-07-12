import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TenantsService } from '../tenants/tenants.service';
import { AIChatService } from './ai-chat.service';
import { SendWebChatMessageDto } from './dto/webchat.dto';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'webchat');

/**
 * Controller nay KHONG dung JwtAuthGuard - day la endpoint PUBLIC cho khach vang lai
 * tren website (chua dang nhap). Danh tinh khach duoc xac dinh qua sessionId (Sprint
 * sau co the them CAPTCHA/rate-limit de chong spam, hien tai MVP chua lam).
 */
@Controller('api/v1/public/webchat')
export class WebChatController {
  constructor(
    private readonly aiChatService: AIChatService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Post('sessions')
  async createSession(@Body('tenantCode') tenantCode: string, @Body('customerLanguage') customerLanguage?: string) {
    if (!tenantCode) throw new BadRequestException('Thieu tenantCode');
    return this.aiChatService.createSession(tenantCode, customerLanguage);
  }

  // Public - khach xem lai hoi thoai cua minh. Hien BAN DA DICH (neu co) thay vi
  // nguyen van tieng Viet nhan vien go, dam bao khach LUON chi thay dung ngon ngu cua ho.
  @Get('sessions/:id/history')
  async getHistory(@Param('id') sessionId: string) {
    return this.aiChatService.getCustomerFacingHistory(sessionId);
  }

  // Public - widget chat dung de hien logo thuong hieu tren man hinh chat truoc khi khach dang nhap
  @Get('branding')
  async getBranding(@Query('tenantCode') tenantCode: string) {
    if (!tenantCode) throw new BadRequestException('Thieu tenantCode');
    const tenant = await this.tenantsService.getByCode(tenantCode);
    return {
      logoUrl: tenant.logoPath ? `/uploads/branding/${tenant.logoPath.split('/').pop()}` : null,
      name: tenant.name,
    };
  }

  // Gui tin nhan, co the kem 1 anh chup tu camera dien thoai (input capture="environment")
  @Post('messages')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, callback) => {
          callback(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          return callback(new BadRequestException('Chi ho tro anh JPEG/PNG/WEBP'), false);
        }
        callback(null, true);
      },
    }),
  )
  async sendMessage(
    @Body() dto: SendWebChatMessageDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const tenant = await this.tenantsService.getByCode(dto.tenantCode);

    let sessionId = dto.sessionId;
    if (!sessionId) {
      const session = await this.aiChatService.createSession(dto.tenantCode, dto.customerLanguage);
      sessionId = session.id;
    }

    const result = await this.aiChatService.sendMessage(
      tenant.id,
      sessionId,
      dto.text,
      image ? { path: image.path, mimeType: image.mimetype } : undefined,
    );

    return { sessionId, ...result };
  }

  static getUploadDir(): string {
    return UPLOAD_DIR;
  }
}
