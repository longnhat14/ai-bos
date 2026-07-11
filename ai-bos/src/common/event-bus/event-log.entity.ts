import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../entities/tenant-base.entity';

export enum EventLogStatus {
  PENDING = 'pending',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

@Entity('event_log')
export class EventLog extends TenantBaseEntity {
  @Column({ name: 'event_type' })
  eventType: string; // vd: 'ticket.created', 'ticket.closed'

  @Column({ type: 'json' })
  payload: Record<string, any>;

  @Column({ type: 'varchar', default: EventLogStatus.PENDING })
  status: EventLogStatus;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt: Date | null;
}
