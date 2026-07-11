import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventType } from '../../common/event-bus/events';
import { InvoiceService } from './invoice.service';

/**
 * Day chinh la minh chung ro nhat cho kien truc Event Bus da thiet ke:
 * TicketsService (Sprint 1) KHONG he biet den Invoice module.
 * No chi phat event 'ticket.closed'. Class nay (thuoc Invoice module, viet o Sprint 7)
 * duoc EventDispatcherProcessor goi toi moi khi co event do - hoan toan khong can
 * sua lai 1 dong code nao trong TicketsService.
 */
@Injectable()
export class InvoiceEventHandler {
  private readonly logger = new Logger(InvoiceEventHandler.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  async handle(job: Job): Promise<void> {
    if (job.name !== EventType.TICKET_CLOSED) return;

    const { tenantId, ticketId, customerId, finalPrice } = job.data;

    if (finalPrice === null || finalPrice === undefined) {
      this.logger.warn(
        `Ticket ${ticketId} dong nhung khong co final_price - bo qua tao hoa don tu dong, can tao thu cong`,
      );
      return;
    }

    try {
      const invoice = await this.invoiceService.createFromTicket(
        tenantId,
        ticketId,
        customerId,
        finalPrice,
      );
      this.logger.log(`Da tu dong sinh hoa don ${invoice.invoiceNumber} cho ticket ${ticketId}`);
    } catch (err) {
      this.logger.error(`Loi khi tu dong sinh hoa don cho ticket ${ticketId}: ${err.message}`);
    }
  }
}
