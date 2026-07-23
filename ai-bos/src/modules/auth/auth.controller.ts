import { Body, Controller, Post } from '@nestjs/common';
import { TenantsService } from '../tenants/tenants.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/auth.dto';

// Neu khong truyen tenantCode trong body, mac dinh lay theo ENV (hoac 'pctech').
// Sang Giai doan 4 se doc tu subdomain hoac header 'X-Tenant-Code' thay vi body.
const DEFAULT_TENANT_CODE = process.env.DEFAULT_TENANT_CODE || 'pctech';

/**
 * QUAN TRONG - DA XOA endpoint POST /register cong khai (lo hong bao mat nghiem
 * trong: bat ky ai cung tu dang ky duoc VA tu chon role=admin, chiem quyen quan
 * tri toan bo tenant). Tao tai khoan nhan vien gio CHI thuc hien duoc qua
 * POST /api/v1/users (yeu cau dang nhap + RolesGuard(ADMIN)) - xem UsersController.
 */
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const tenant = await this.tenantsService.getByCode(dto.tenantCode || DEFAULT_TENANT_CODE);
    return this.authService.login(dto, tenant.id);
  }
}
