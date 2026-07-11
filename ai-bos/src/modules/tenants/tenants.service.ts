import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';

const DEFAULT_TENANT_CODE = process.env.DEFAULT_TENANT_CODE || 'pctech';

@Injectable()
export class TenantsService implements OnModuleInit {
  private readonly logger = new Logger(TenantsService.name);

  constructor(@InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>) {}

  /**
   * Tu dong tao tenant mac dinh (pctech) khi app khoi dong lan dau,
   * thay the cho dong INSERT seed truoc day nam trong schema.sql
   * (schema.sql gio chi con dung de tham khao/import thu cong len hosting that).
   */
  async onModuleInit() {
    const existing = await this.tenantRepo.findOne({ where: { code: DEFAULT_TENANT_CODE } });
    if (!existing) {
      const tenant = this.tenantRepo.create({
        code: DEFAULT_TENANT_CODE,
        name: 'PCTech Computer Repair',
      });
      await this.tenantRepo.save(tenant);
      this.logger.log(`Da tu dong tao tenant mac dinh: ${DEFAULT_TENANT_CODE}`);
    }
  }

  async getByCode(code: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { code } });
    if (!tenant) {
      throw new NotFoundException(`Khong tim thay tenant: ${code}`);
    }
    return tenant;
  }
}
