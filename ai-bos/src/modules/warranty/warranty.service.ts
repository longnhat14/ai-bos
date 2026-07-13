import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { EventType } from '../../common/event-bus/events';
import { ManualCreateWarrantyDto, VoidWarrantyDto } from './dto/warranty.dto';
import { Warranty, WarrantyStatus } from './warranty.entity';

// Mac dinh 3 thang bao hanh neu khong chi dinh - co the chinh qua .env sau nay
const DEFAULT_WARRANTY_MONTHS = parseInt(process.env.DEFAULT_WARRANTY_MONTHS || '3', 10);

@Injectable()
export class WarrantyService {
  private readonly logger = new Logger(WarrantyService.name);

  constructor(
    @InjectRepository(Warranty) private readonly warrantyRepo: Repository<Warranty>,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Tu dong tao bao hanh khi ticket dong (goi tu WarrantyEventHandler lang nghe ticket.closed).
   * Dung DEFAULT_WARRANTY_MONTHS neu khong co thong tin gi khac - Admin co the chinh
   * lai so thang qua endpoint updateMonths() sau khi tao neu can.
   */
  async createFromTicket(
    tenantId: string,
    ticketId: string,
    customerId: string,
    deviceType?: string,
    deviceModel?: string,
    warrantyMonths: number = DEFAULT_WARRANTY_MONTHS,
  ): Promise<Warranty> {
    const existing = await this.warrantyRepo.findOne({ where: { tenantId, ticketId } });
    if (existing) {
      this.logger.warn(`Bao hanh cho ticket ${ticketId} da ton tai, bo qua tao trung`);
      return existing;
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + warrantyMonths);

    const warranty = this.warrantyRepo.create({
      tenantId,
      ticketId,
      customerId,
      deviceType,
      deviceModel,
      warrantyMonths,
      startDate,
      endDate,
      status: WarrantyStatus.ACTIVE,
    });
    await this.warrantyRepo.save(warranty);

    await this.eventBus.publish(tenantId, EventType.WARRANTY_CREATED, {
      warrantyId: warranty.id,
      ticketId,
      customerId,
      endDate: warranty.endDate,
    });

    return warranty;
  }

  async createManual(tenantId: string, dto: ManualCreateWarrantyDto): Promise<Warranty> {
    return this.createFromTicket(
      tenantId,
      dto.ticketId,
      dto.customerId,
      dto.deviceType,
      dto.deviceModel,
      dto.warrantyMonths,
    );
  }

  async findByTicket(tenantId: string, ticketId: string): Promise<Warranty> {
    const warranty = await this.warrantyRepo.findOne({ where: { tenantId, ticketId } });
    if (!warranty) throw new NotFoundException('Chua co bao hanh cho ticket nay');
    return warranty;
  }

  async findAll(tenantId: string): Promise<Warranty[]> {
    return this.warrantyRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(tenantId: string, id: string): Promise<Warranty> {
    const warranty = await this.warrantyRepo.findOne({ where: { tenantId, id } });
    if (!warranty) throw new NotFoundException('Khong tim thay bao hanh');
    return warranty;
  }

  async findByCustomer(tenantId: string, customerId: string): Promise<Warranty[]> {
    return this.warrantyRepo.find({
      where: { tenantId, customerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Kiem tra bao hanh con hieu luc khong - tinh truc tiep tu ngay hien tai,
   * KHONG dua vao truong "status" da luu san (vi status chi cap nhat khi co
   * job quet dinh ky - Sprint sau se bo sung cron job, hien tai tinh real-time
   * de dam bao luon chinh xac).
   */
  async checkActive(tenantId: string, ticketId: string): Promise<{
    isActive: boolean;
    daysRemaining: number;
    warranty: Warranty;
  }> {
    const warranty = await this.findByTicket(tenantId, ticketId);

    if (warranty.status === WarrantyStatus.VOIDED) {
      return { isActive: false, daysRemaining: 0, warranty };
    }

    const now = new Date();
    const msRemaining = new Date(warranty.endDate).getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

    return {
      isActive: daysRemaining > 0,
      daysRemaining: Math.max(daysRemaining, 0),
      warranty,
    };
  }

  async voidWarranty(tenantId: string, id: string, dto: VoidWarrantyDto): Promise<Warranty> {
    const warranty = await this.warrantyRepo.findOne({ where: { tenantId, id } });
    if (!warranty) throw new NotFoundException('Khong tim thay bao hanh');

    warranty.status = WarrantyStatus.VOIDED;
    warranty.notes = dto.reason;
    await this.warrantyRepo.save(warranty);

    await this.eventBus.publish(tenantId, EventType.WARRANTY_VOIDED, {
      warrantyId: warranty.id,
      ticketId: warranty.ticketId,
      reason: dto.reason,
    });

    return warranty;
  }
}
