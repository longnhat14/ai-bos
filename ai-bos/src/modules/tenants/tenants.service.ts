import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';

// Ca 2 tenant duoc seed san khi app khoi dong lan dau, vi AI BOS phuc vu ca PCTech va RemoteIT
const SEED_TENANTS = [
  { code: 'pctech', name: 'PCTech Computer Repair' },
  { code: 'remoteit', name: 'RemoteIT Fix' },
];

@Injectable()
export class TenantsService implements OnModuleInit {
  private readonly logger = new Logger(TenantsService.name);

  constructor(@InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>) {}

  /**
   * Tu dong tao 2 tenant mac dinh (pctech, remoteit) khi app khoi dong lan dau,
   * thay the cho dong INSERT seed truoc day nam trong schema.sql
   * (schema.sql gio chi con dung de tham khao/import thu cong len hosting that).
   */
  async onModuleInit() {
    for (const seed of SEED_TENANTS) {
      const existing = await this.tenantRepo.findOne({ where: { code: seed.code } });
      if (!existing) {
        const tenant = this.tenantRepo.create(seed);
        await this.tenantRepo.save(tenant);
        this.logger.log(`Da tu dong tao tenant mac dinh: ${seed.code}`);
      }
    }
  }

  async getByCode(code: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { code } });
    if (!tenant) {
      throw new NotFoundException(`Khong tim thay tenant: ${code}`);
    }
    return tenant;
  }

  async getById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Khong tim thay tenant voi id: ${id}`);
    }
    return tenant;
  }

  /** Dung boi SettingsController khi Admin upload logo thuong hieu moi */
  async updateLogo(tenantId: string, logoPath: string): Promise<Tenant> {
    const tenant = await this.getById(tenantId);
    tenant.logoPath = logoPath;
    return this.tenantRepo.save(tenant);
  }
}
