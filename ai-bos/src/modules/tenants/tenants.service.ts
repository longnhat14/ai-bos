import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';

@Injectable()
export class TenantsService {
  constructor(@InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>) {}

  async getByCode(code: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { code } });
    if (!tenant) {
      throw new NotFoundException(`Khong tim thay tenant: ${code}`);
    }
    return tenant;
  }
}
