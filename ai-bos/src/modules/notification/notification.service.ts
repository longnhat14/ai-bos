import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventType } from '../../common/event-bus/events';

/**
 * NotificationService KHONG tu dang ky @Processor rieng nua.
 * Ly do: neu 2 module cung @Processor tren CHUNG 1 queue BullMQ, chung se
 * CANH TRANH nhau xu ly job (moi job chi 1 trong 2 nhan duoc - "competing consumers"),
 * KHONG PHAI ca 2 cung nhan duoc nhu pub/sub. Day la ban chat cua queue, khac voi event bus
 * kieu "fan-out" ma AI BOS can (nhieu module doc lap cung phan ung voi 1 event).
 *
 * Giai phap: chi co DUY NHAT 1 @Processor (EventDispatcherProcessor, o event-bus module),
 * no goi lan luot toi cac Service thuan (nhu class nay) tuy theo loai event.
 * TicketsService van hoan toan khong biet den class nay - nguyen tac decoupling giu nguyen.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async handle(job: Job): Promise<void> {
    switch (job.name) {
      case EventType.TICKET_CREATED:
        this.logger.log(
          `[Notification] Ticket moi da tao: ${job.data.ticketCode} (customer=${job.data.customerId})`,
        );
        // TODO: gui email/SMS/Zalo that cho khach hang (Sprint 12)
        break;

      case EventType.TICKET_CLOSED:
        this.logger.log(`[Notification] Ticket da dong: ${job.data.ticketCode}`);
        break;

      case EventType.INVENTORY_LOW_STOCK:
        this.logger.warn(
          `[Notification] CANH BAO TON KHO THAP: ${job.data.name} (${job.data.sku}) chi con ${job.data.quantityOnHand}, nguong canh bao la ${job.data.threshold}`,
        );
        break;

      case EventType.INVOICE_CREATED:
        this.logger.log(
          `[Notification] Hoa don ${job.data.invoiceNumber} da duoc tao, tong tien: ${job.data.totalAmount}`,
        );
        break;

      default:
        // Event khac chua can xu ly thong bao, bo qua
        break;
    }
  }
}
