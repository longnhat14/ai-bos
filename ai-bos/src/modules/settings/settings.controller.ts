import {
  BadRequestException,
  Controller,
  Get,
  Patch,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantsService } from '../tenants/tenants.service';

const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB - logo khong can qua nang
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'branding');

/**
 * Muc "Cai dat" (Settings) - hien tai chi co logo thuong hieu, sau nay co the
 * mo rong them mau sac giao dien, ten hien thi chat widget... Chi Admin duoc
 * phep doi (dung JwtAuthGuard, chua phan biet role rieng - Sprint sau nen
 * gan them @Roles(UserRole.ADMIN) neu muon chat che hon).
 */
@Controller('api/v1/settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('branding')
  async getBranding(@CurrentUser() user: JwtPayload) {
    const tenant = await this.tenantsService.getById(user.tenantId);
    return {
      logoUrl: tenant.logoPath ? `/uploads/branding/${tenant.logoPath.split('/').pop()}` : null,
    };
  }

  @Patch('branding/logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, callback) => {
          callback(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_LOGO_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_LOGO_TYPES.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Chi ho tro logo dang PNG/JPEG/SVG/WEBP'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadLogo(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Khong nhan duoc file logo');
    const tenant = await this.tenantsService.updateLogo(user.tenantId, file.path);
    return {
      message: 'Da cap nhat logo thuong hieu thanh cong',
      logoUrl: `/uploads/branding/${file.filename}`,
    };
  }

  static getUploadDir(): string {
    return UPLOAD_DIR;
  }
}
