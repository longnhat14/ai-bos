import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { EventType } from '../../common/event-bus/events';
import { Customer } from './customer.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    private readonly eventBus: EventBusService,
  ) {}

  async create(tenantId: string, dto: CreateCustomerDto): Promise<Customer> {
    // Tim khach hang trung SDT truoc, tranh tao trung (theo unique constraint tenantId+phone)
    const existing = await this.customerRepo.findOne({ where: { tenantId, phone: dto.phone } });
    if (existing) return existing;

    const customer = this.customerRepo.create({ tenantId, ...dto });
    await this.customerRepo.save(customer);

    await this.eventBus.publish(tenantId, EventType.CUSTOMER_CREATED, {
      customerId: customer.id,
      fullName: customer.fullName,
      phone: customer.phone,
    });

    return customer;
  }

  async findAll(tenantId: string): Promise<Customer[]> {
    return this.customerRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(tenantId: string, id: string): Promise<Customer> {
    const customer = await this.customerRepo.findOne({ where: { tenantId, id } });
    if (!customer) throw new NotFoundException('Khong tim thay khach hang');
    return customer;
  }

  async findByPhone(tenantId: string, phone: string): Promise<Customer | null> {
    return this.customerRepo.findOne({ where: { tenantId, phone } });
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(tenantId, id);

    // Neu doi SDT, kiem tra trung voi khach hang KHAC (khong tinh chinh no) - tranh
    // vi pham unique constraint (tenantId, phone) va bao loi ro rang thay vi de
    // TypeORM nem loi SQL kho hieu ra ngoai.
    if (dto.phone && dto.phone !== customer.phone) {
      const existing = await this.customerRepo.findOne({ where: { tenantId, phone: dto.phone } });
      if (existing) {
        throw new ConflictException(
          `Số điện thoại "${dto.phone}" đã được dùng bởi khách hàng "${existing.fullName}".`,
        );
      }
    }

    Object.assign(customer, dto);
    return this.customerRepo.save(customer);
  }
}
