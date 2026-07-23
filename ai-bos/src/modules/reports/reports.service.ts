import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { Invoice, InvoiceStatus } from '../invoice/invoice.entity';
import { Ticket, TicketStatus } from '../tickets/ticket.entity';
import { User, UserRole } from '../users/user.entity';

export interface RevenuePoint {
  date: string;
  revenue: number;
}

export interface CustomerSourceBreakdown {
  source: string;
  count: number;
}

export interface TechnicianPerformance {
  technicianId: string;
  fullName: string;
  ticketsClosed: number;
  totalRevenue: number;
  rating: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async getRevenueOverTime(tenantId: string, days: number): Promise<RevenuePoint[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const invoices = await this.invoiceRepo.find({
      where: { tenantId, status: InvoiceStatus.PAID, paidAt: MoreThanOrEqual(since) },
    });

    const revenueByDate = new Map<string, number>();
    for (const invoice of invoices) {
      if (!invoice.paidAt) continue;
      const dateKey = new Date(invoice.paidAt).toISOString().slice(0, 10);
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + Number(invoice.totalAmount));
    }

    const points: RevenuePoint[] = [];
    const cursor = new Date(since);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    while (cursor <= today) {
      const dateKey = cursor.toISOString().slice(0, 10);
      points.push({ date: dateKey, revenue: revenueByDate.get(dateKey) || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    return points;
  }

  async getCustomerSourceBreakdown(tenantId: string): Promise<CustomerSourceBreakdown[]> {
    const customers = await this.customerRepo.find({ where: { tenantId } });
    const counts = new Map<string, number>();
    for (const c of customers) {
      counts.set(c.source, (counts.get(c.source) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([source, count]) => ({ source, count }));
  }

  async getTechnicianPerformance(tenantId: string): Promise<TechnicianPerformance[]> {
    const technicians = await this.userRepo.find({ where: { tenantId, role: UserRole.TECHNICIAN } });
    const closedTickets = await this.ticketRepo.find({
      where: { tenantId, status: TicketStatus.CLOSED },
    });

    return technicians.map((tech) => {
      const ticketsForTech = closedTickets.filter((t) => t.assignedTechnicianId === tech.id);
      const totalRevenue = ticketsForTech.reduce((sum, t) => sum + Number(t.finalPrice || 0), 0);

      return {
        technicianId: tech.id,
        fullName: tech.fullName,
        ticketsClosed: ticketsForTech.length,
        totalRevenue,
        rating: Number(tech.rating),
      };
    });
  }
}
