import { Body, Controller, Post } from '@nestjs/common';
import { TenantsService } from '../tenants/tenants.service';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

// Tam thoi tenant code lay tu ENV / hard-code 'pctech'.
// Sang Giai doan 4 se doc tu subdomain hoac header 'X-Tenant-Code'.
const DEFAULT_TENANT_CODE = process.env.DEFAULT_TENANT_CODE || 'pctech';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const tenant = await this.tenantsService.getByCode(DEFAULT_TENANT_CODE);
    return this.authService.register(dto, tenant.id);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const tenant = await this.tenantsService.getByCode(DEFAULT_TENANT_CODE);
    return this.authService.login(dto, tenant.id);
  }
}
