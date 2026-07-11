import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Invoice } from '../invoice/invoice.entity';
import { InventoryItem } from '../warehouse/inventory-item.entity';
import { Order, OrderStatus } from '../shop/order.entity';
import { Ticket, TicketStatus } from '../tickets/ticket.entity';
import { User, UserRole } from '../users/user.entity';

const OPEN_TICKET_STATUSES = [
  TicketStatus.RECEIVED,
  TicketStatus.DIAGNOSING,
  TicketStatus.QUOTED,
  TicketStatus.CONFIRMED,
  TicketStatus.REPAIRING,
  TicketStatus.TESTING,
];

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InventoryItem) private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Tong quan chinh - dung cho man hinh Dashboard chinh va sau nay
   * cung se la du lieu goc cho "AI CEO" hoi qua Zalo (Sprint 12).
   */
  async getOverview(tenantId: string) {
    const todayStart = this.getStartOfToday();
    const monthStart = this.getStartOfMonth();

    const [
      openTickets,
      closedToday,
      lowStockItems,
      pendingOrders,
      revenueToday,
      revenueThisMonth,
    ] = await Promise.all([
      this.ticketRepo.count({ where: { tenantId, status: In(OPEN_TICKET_STATUSES) } }),
      this.ticketRepo
        .createQueryBuilder('ticket')
        .where('ticket.tenant_id = :tenantId', { tenantId })
        .andWhere('ticket.status = :status', { status: TicketStatus.CLOSED })
        .andWhere('ticket.closed_at >= :todayStart', { todayStart })
        .getCount(),
      this.itemRepo
        .createQueryBuilder('item')
        .where('item.tenant_id = :tenantId', { tenantId })
        .andWhere('item.is_active = true')
        .andWhere('item.quantity_on_hand <= item.low_stock_threshold')
        .getCount(),
      this.orderRepo.count({ where: { tenantId, status: OrderStatus.PENDING } }),
      this.sumInvoiceAmount(tenantId, todayStart),
      this.sumInvoiceAmount(tenantId, monthStart),
    ]);

    return {
      openTickets,
      closedTicketsToday: closedToday,
      lowStockItemsCount: lowStockItems,
      pendingOrders,
      revenueToday,
      revenueThisMonth,
      generatedAt: new Date(),
    };
  }

  /**
   * Do bau cong viec cua tung ky thuat vien - phuc vu AI Dispatcher sau nay (Sprint 9)
   * de biet ai dang ranh/ban khi de xuat giao viec.
   */
  async getTechnicianWorkload(tenantId: string) {
    const technicians = await this.userRepo.find({
      where: { tenantId, role: UserRole.TECHNICIAN, isActive: true },
    });

    const workload = await Promise.all(
      technicians.map(async (tech) => {
        const openTicketsCount = await this.ticketRepo.count({
          where: {
            tenantId,
            assignedTechnicianId: tech.id,
            status: In(OPEN_TICKET_STATUSES),
          },
        });
        return {
          technicianId: tech.id,
          fullName: tech.fullName,
          isAvailable: tech.isAvailable,
          rating: tech.rating,
          openTicketsCount,
        };
      }),
    );

    return workload;
  }

  private async sumInvoiceAmount(tenantId: string, fromDate: Date): Promise<number> {
    const result = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .select('SUM(invoice.total_amount)', 'total')
      .where('invoice.tenant_id = :tenantId', { tenantId })
      .andWhere('invoice.created_at >= :fromDate', { fromDate })
      .getRawOne();

    return Number(result?.total || 0);
  }

  private getStartOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private getStartOfMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
