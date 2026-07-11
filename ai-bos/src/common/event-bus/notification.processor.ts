import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventType } from './events';

/**
 * Vi du minh hoa: mot "module khac" (Notification Engine) lang nghe event
 * ma khong can Ticket module goi truc tiep den no.
 *
 * Sau nay Invoice, Kho, Warranty... se tao Processor tuong tu, chi can
 * dang ky @Processor('ai-bos-events') va xu ly theo job.name (= event type).
 */
@Processor('ai-bos-events')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case EventType.TICKET_CREATED:
        this.logger.log(
          `[Notification] Ticket moi da tao: ${job.data.ticketCode} (customer=${job.data.customerId})`,
        );
        // TODO Sprint 2: gui email/SMS that cho khach hang
        break;

      case EventType.TICKET_CLOSED:
        this.logger.log(`[Notification] Ticket da dong: ${job.data.ticketCode}`);
        // TODO Sprint 7: trigger Invoice Engine sinh hoa don o day
        break;

      default:
        // Cac event khac chua co processor xu ly, bo qua
        break;
    }
  }
}
