import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InvoiceEventHandler } from '../../modules/invoice/invoice-event.handler';
import { NotificationService } from '../../modules/notification/notification.service';
import { WarrantyEventHandler } from '../../modules/warranty/warranty-event.handler';

/**
 * EVENT DISPATCHER - DUY NHAT 1 NOI dang ky @Processor('ai-bos-events') trong toan he thong.
 *
 * TAI SAO CHI 1 PROCESSOR:
 * BullMQ hoat dong theo kieu "competing consumers" - neu nhieu @Processor cung dang ky
 * tren 1 queue, moi job CHI duoc 1 trong so do nhan (canh tranh), KHONG PHAI ca nhieu
 * cai cung nhan (khac voi pub/sub thuc su). De dam bao NHIEU module cung phan ung doc lap
 * voi 1 event (dung nhu thiet ke Business Event Bus ban dau), ta dung 1 DISPATCHER duy nhat,
 * no nhan job roi TU GOI tuan tu toi cac Service thuan (khong phai Processor) tuong ung.
 *
 * QUAN TRONG: TicketsService, WarehouseService... vAN HOAN TOAN KHONG BIET den
 * NotificationService hay InvoiceService. Chung chi goi eventBus.publish(...).
 * Viec "ai lang nghe event nao" chi duoc khai bao O DAY - dung 1 cho duy nhat,
 * de sau nay them module moi (Warranty, AI Dispatcher...) chi can them 1 dong goi
 * trong ham process() ben duoi, khong dung cham gi den code nghiep vu goc.
 */
@Processor('ai-bos-events')
export class EventDispatcherProcessor extends WorkerHost {
  private readonly logger = new Logger(EventDispatcherProcessor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly invoiceEventHandler: InvoiceEventHandler,
    private readonly warrantyEventHandler: WarrantyEventHandler,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    // Moi handler chay doc lap - loi o 1 handler KHONG duoc lam hong cac handler con lai
    const handlers: Array<{ name: string; run: () => Promise<void> }> = [
      { name: 'NotificationService', run: () => this.notificationService.handle(job) },
      { name: 'InvoiceEventHandler', run: () => this.invoiceEventHandler.handle(job) },
      { name: 'WarrantyEventHandler', run: () => this.warrantyEventHandler.handle(job) },
      // Them module moi lang nghe event: chi can them 1 dong o day
    ];

    for (const handler of handlers) {
      try {
        await handler.run();
      } catch (err) {
        this.logger.error(
          `Handler "${handler.name}" loi khi xu ly event "${job.name}": ${err.message}`,
        );
        // Khong throw tiep - de cac handler khac van chay binh thuong
      }
    }
  }
}
