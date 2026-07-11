import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventType } from '../../common/event-bus/events';
import { WarrantyService } from './warranty.service';

/**
 * Giong InvoiceEventHandler - lang nghe 'ticket.closed' va tu dong tao bao hanh,
 * hoan toan doc lap voi TicketsService va InvoiceEventHandler. Ca 2 handler nay
 * cung phan ung voi CUNG 1 event ma khong biet ve nhau - dung nguyen tac fan-out
 * cua EventDispatcherProcessor.
 */
@Injectable()
export class WarrantyEventHandler {
  private readonly logger = new Logger(WarrantyEventHandler.name);

  constructor(private readonly warrantyService: WarrantyService) {}

  async handle(job: Job): Promise<void> {
    if (job.name !== EventType.TICKET_CLOSED) return;

    const { tenantId, ticketId, customerId, deviceType, deviceModel } = job.data;

    try {
      const warranty = await this.warrantyService.createFromTicket(
        tenantId,
        ticketId,
        customerId,
        deviceType,
        deviceModel,
      );
      this.logger.log(
        `Da tu dong tao bao hanh cho ticket ${ticketId}, het han: ${warranty.endDate}`,
      );
    } catch (err) {
      this.logger.error(`Loi khi tu dong tao bao hanh cho ticket ${ticketId}: ${err.message}`);
    }
  }
}
