import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { EventType } from '../../common/event-bus/events';
import {
  AssignTechnicianDto,
  CreateTicketDto,
  QuoteTicketDto,
  UpdateTicketStatusDto,
} from './dto/ticket.dto';
import { TicketStatusHistory } from './ticket-status-history.entity';
import { Ticket, TicketStatus } from './ticket.entity';

// Cac buoc chuyen trang thai hop le - tranh nhay buoc sai (vd tu 'received' nhay thang sang 'closed')
const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.RECEIVED]: [TicketStatus.DIAGNOSING, TicketStatus.CANCELLED],
  [TicketStatus.DIAGNOSING]: [TicketStatus.QUOTED, TicketStatus.CANCELLED],
  [TicketStatus.QUOTED]: [TicketStatus.CONFIRMED, TicketStatus.CANCELLED],
  [TicketStatus.CONFIRMED]: [TicketStatus.REPAIRING, TicketStatus.CANCELLED],
  [TicketStatus.REPAIRING]: [TicketStatus.TESTING, TicketStatus.CANCELLED],
  [TicketStatus.TESTING]: [TicketStatus.CLOSED, TicketStatus.REPAIRING],
  [TicketStatus.CLOSED]: [],
  [TicketStatus.CANCELLED]: [],
};

// Dung chung voi Dashboard - trang thai duoc coi la "dang mo", phuc vu AI Dispatcher tinh workload
const OPEN_TICKET_STATUSES = [
  TicketStatus.RECEIVED,
  TicketStatus.DIAGNOSING,
  TicketStatus.QUOTED,
  TicketStatus.CONFIRMED,
  TicketStatus.REPAIRING,
  TicketStatus.TESTING,
];

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketStatusHistory)
    private readonly historyRepo: Repository<TicketStatusHistory>,
    private readonly eventBus: EventBusService,
  ) {}

  async create(tenantId: string, dto: CreateTicketDto): Promise<Ticket> {
    const ticketCode = await this.generateTicketCode(tenantId);

    const ticket = this.ticketRepo.create({
      tenantId,
      ticketCode,
      customerId: dto.customerId,
      issueDescription: dto.issueDescription,
      deviceType: dto.deviceType,
      deviceModel: dto.deviceModel,
      priority: dto.priority,
      skillRequired: dto.skillRequired ?? [],
      status: TicketStatus.RECEIVED,
    });
    await this.ticketRepo.save(ticket);

    await this.recordHistory(tenantId, ticket.id, null, TicketStatus.RECEIVED, null, 'Ticket duoc tao');

    await this.eventBus.publish(tenantId, EventType.TICKET_CREATED, {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      customerId: ticket.customerId,
    });

    return ticket;
  }

  async findAll(tenantId: string, status?: TicketStatus): Promise<Ticket[]> {
    return this.ticketRepo.find({
      where: status ? { tenantId, status } : { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { tenantId, id } });
    if (!ticket) throw new NotFoundException('Khong tim thay ticket');
    return ticket;
  }

  async assignTechnician(tenantId: string, id: string, dto: AssignTechnicianDto, changedBy: string): Promise<Ticket> {
    const ticket = await this.findOne(tenantId, id);
    ticket.assignedTechnicianId = dto.technicianId;
    await this.ticketRepo.save(ticket);

    await this.eventBus.publish(tenantId, EventType.TICKET_ASSIGNED, {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      technicianId: dto.technicianId,
    });

    return ticket;
  }

  async quote(tenantId: string, id: string, dto: QuoteTicketDto, changedBy: string): Promise<Ticket> {
    const ticket = await this.findOne(tenantId, id);
    this.assertTransition(ticket.status, TicketStatus.QUOTED);

    ticket.quotedPrice = dto.quotedPrice;
    const fromStatus = ticket.status;
    ticket.status = TicketStatus.QUOTED;
    await this.ticketRepo.save(ticket);

    await this.recordHistory(tenantId, ticket.id, fromStatus, TicketStatus.QUOTED, changedBy, `Bao gia: ${dto.quotedPrice}`);
    await this.eventBus.publish(tenantId, EventType.TICKET_QUOTED, {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      quotedPrice: dto.quotedPrice,
    });

    return ticket;
  }

  /**
   * Ghi lai gia cuoi cung THAT SU cua ticket - dung boi InvoiceController khi
   * Admin tao hoa don thu cong (vd ticket dong ma chua tung bao gia nen khong
   * tu dong sinh hoa don duoc). KHONG doi trang thai/khong kiem tra transition,
   * chi cap nhat gia tri de dong bo voi hoa don vua tao thu cong.
   */
  async setFinalPrice(tenantId: string, id: string, finalPrice: number): Promise<Ticket> {
    const ticket = await this.findOne(tenantId, id);
    ticket.finalPrice = finalPrice;
    return this.ticketRepo.save(ticket);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    dto: UpdateTicketStatusDto,
    changedBy: string,
  ): Promise<Ticket> {
    const ticket = await this.findOne(tenantId, id);
    this.assertTransition(ticket.status, dto.status);

    const fromStatus = ticket.status;
    ticket.status = dto.status;

    if (dto.status === TicketStatus.CLOSED) {
      ticket.closedAt = new Date();
      ticket.finalPrice = ticket.finalPrice ?? ticket.quotedPrice;
    }

    await this.ticketRepo.save(ticket);
    await this.recordHistory(tenantId, ticket.id, fromStatus, dto.status, changedBy, dto.note);

    await this.eventBus.publish(tenantId, EventType.TICKET_STATUS_CHANGED, {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      fromStatus,
      toStatus: dto.status,
    });

    if (dto.status === TicketStatus.CLOSED) {
      await this.eventBus.publish(tenantId, EventType.TICKET_CLOSED, {
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        customerId: ticket.customerId,
        finalPrice: ticket.finalPrice,
        deviceType: ticket.deviceType,
        deviceModel: ticket.deviceModel,
      });
    }

    return ticket;
  }

  private assertTransition(from: TicketStatus, to: TicketStatus) {
    const allowed = VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Khong the chuyen trang thai tu '${from}' sang '${to}'`);
    }
  }

  private async recordHistory(
    tenantId: string,
    ticketId: string,
    fromStatus: string | null,
    toStatus: string,
    changedBy: string | null,
    note?: string | null,
  ) {
    const history = this.historyRepo.create({
      tenantId,
      ticketId,
      fromStatus: fromStatus ?? undefined,
      toStatus,
      changedBy: changedBy ?? undefined,
      note: note ?? undefined,
    });
    await this.historyRepo.save(history);
  }

  /** Dung boi AI Dispatcher (Sprint 9) de tinh tieu chi "do ban" cua ky thuat vien */
  async countOpenTicketsByTechnician(tenantId: string, technicianId: string): Promise<number> {
    return this.ticketRepo.count({
      where: { tenantId, assignedTechnicianId: technicianId, status: In(OPEN_TICKET_STATUSES) },
    });
  }

  /**
   * Sinh ma ticket dang PCT-YYYY-NNNN.
   * Luu y: cach dem don gian nay co the co race condition khi nhieu request
   * tao ticket cung luc - o Sprint 2 nen thay bang DB sequence rieng per-tenant.
   */
  private async generateTicketCode(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.ticketRepo.count({ where: { tenantId } });
    const nextNumber = (count + 1).toString().padStart(4, '0');
    return `PCT-${year}-${nextNumber}`;
  }
}
