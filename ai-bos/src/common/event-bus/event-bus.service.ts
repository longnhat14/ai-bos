import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventLog, EventLogStatus } from './event-log.entity';
import { EventType } from './events';

/**
 * EventBusService - trai tim cua kien truc Event-Driven trong AI BOS.
 *
 * Nguyen tac Outbox: ghi event vao DB (event_log) TRUOC, sau do moi day vao
 * BullMQ. Neu Redis/BullMQ tam thoi loi, du lieu khong mat vi da nam trong DB,
 * co the retry lai tu event_log (status = 'pending').
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    @InjectQueue('ai-bos-events') private readonly eventQueue: Queue,
    @InjectRepository(EventLog) private readonly eventLogRepo: Repository<EventLog>,
  ) {}

  async publish(tenantId: string, eventType: EventType, payload: Record<string, any>): Promise<void> {
    // 1. Ghi vao outbox truoc
    const eventLog = this.eventLogRepo.create({
      tenantId,
      eventType,
      payload,
      status: EventLogStatus.PENDING,
    });
    await this.eventLogRepo.save(eventLog);

    // 2. Day vao queue de cac module khac xu ly bat dong bo
    try {
      await this.eventQueue.add(eventType, { eventLogId: eventLog.id, tenantId, ...payload });
      eventLog.status = EventLogStatus.PUBLISHED;
      eventLog.publishedAt = new Date();
      await this.eventLogRepo.save(eventLog);
      this.logger.log(`Event published: ${eventType} (tenant=${tenantId})`);
    } catch (err) {
      eventLog.status = EventLogStatus.FAILED;
      await this.eventLogRepo.save(eventLog);
      this.logger.error(`Failed to publish event ${eventType}: ${err.message}`);
      // Khong throw - nghiep vu chinh (vd tao ticket) van phai thanh cong,
      // event se duoc retry sau boi 1 job quet event_log status='failed' (bo sung sau)
    }
  }
}
