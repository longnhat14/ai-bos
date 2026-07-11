import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { EventType } from '../../common/event-bus/events';
import { TicketPart } from '../warehouse/ticket-part.entity';
import { Invoice, InvoiceStatus } from './invoice.entity';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(TicketPart) private readonly ticketPartRepo: Repository<TicketPart>,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Tu dong tao hoa don khi ticket dong (goi tu InvoiceProcessor lang nghe event ticket.closed).
   * finalPrice cua ticket la tong tien khach phai tra (da gom ca linh kien + cong sua).
   *
   * LUU Y: laborAmount = finalPrice - partsAmount chi la cach tinh don gian cho MVP.
   * Neu ky thuat vien nhap final_price khong khop voi tong gia tri linh kien da dung
   * (vd quen cap nhat), laborAmount co the ra am - can Admin ra soat thu cong trong
   * truong hop nay (khong chan tao hoa don, chi la diem can luu y).
   */
  async createFromTicket(
    tenantId: string,
    ticketId: string,
    customerId: string,
    finalPrice: number,
  ): Promise<Invoice> {
    const existing = await this.invoiceRepo.findOne({ where: { tenantId, ticketId } });
    if (existing) {
      this.logger.warn(`Hoa don cho ticket ${ticketId} da ton tai, bo qua tao trung`);
      return existing;
    }

    const parts = await this.ticketPartRepo.find({ where: { tenantId, ticketId } });
    const partsAmount = parts.reduce((sum, p) => sum + Number(p.unitSellPrice) * p.quantity, 0);
    const laborAmount = Number(finalPrice) - partsAmount;

    if (laborAmount < 0) {
      this.logger.warn(
        `Ticket ${ticketId}: labor_amount am (${laborAmount}) - final_price co the chua cap nhat dung sau khi dung linh kien. Can Admin kiem tra lai.`,
      );
    }

    const invoiceNumber = await this.generateInvoiceNumber(tenantId);

    const invoice = this.invoiceRepo.create({
      tenantId,
      invoiceNumber,
      ticketId,
      customerId,
      partsAmount,
      laborAmount,
      totalAmount: Number(finalPrice),
      status: InvoiceStatus.UNPAID,
    });
    await this.invoiceRepo.save(invoice);

    await this.eventBus.publish(tenantId, EventType.INVOICE_CREATED, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      ticketId,
      customerId,
      totalAmount: invoice.totalAmount,
    });

    return invoice;
  }

  async findByTicket(tenantId: string, ticketId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({ where: { tenantId, ticketId } });
    if (!invoice) throw new NotFoundException('Chua co hoa don cho ticket nay');
    return invoice;
  }

  async findAll(tenantId: string): Promise<Invoice[]> {
    return this.invoiceRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(tenantId: string, id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({ where: { tenantId, id } });
    if (!invoice) throw new NotFoundException('Khong tim thay hoa don');
    return invoice;
  }

  async markPaid(tenantId: string, id: string): Promise<Invoice> {
    const invoice = await this.findOne(tenantId, id);
    invoice.status = InvoiceStatus.PAID;
    invoice.paidAt = new Date();
    await this.invoiceRepo.save(invoice);

    await this.eventBus.publish(tenantId, EventType.INVOICE_PAID, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    });

    return invoice;
  }

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.invoiceRepo.count({ where: { tenantId } });
    const nextNumber = (count + 1).toString().padStart(4, '0');
    return `INV-${year}-${nextNumber}`;
  }
}
