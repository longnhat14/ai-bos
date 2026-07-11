import { Body, Controller, Post } from '@nestjs/common';
import { TenantsService } from '../tenants/tenants.service';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

// Neu khong truyen tenantCode trong body, mac dinh lay theo ENV (hoac 'pctech').
// Sang Giai doan 4 se doc tu subdomain hoac header 'X-Tenant-Code' thay vi body.
const DEFAULT_TENANT_CODE = process.env.DEFAULT_TENANT_CODE || 'pctech';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const tenant = await this.tenantsService.getByCode(dto.tenantCode || DEFAULT_TENANT_CODE);
    return this.authService.register(dto, tenant.id);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const tenant = await this.tenantsService.getByCode(dto.tenantCode || DEFAULT_TENANT_CODE);
    return this.authService.login(dto, tenant.id);
  }
}
