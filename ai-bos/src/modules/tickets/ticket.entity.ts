import { Column, Entity, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

export enum TicketStatus {
  RECEIVED = 'received',
  DIAGNOSING = 'diagnosing',
  QUOTED = 'quoted',
  CONFIRMED = 'confirmed',
  REPAIRING = 'repairing',
  TESTING = 'testing',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export enum TicketPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('tickets')
@Unique(['tenantId', 'ticketCode'])
export class Ticket extends TenantBaseEntity {
  @Column({ name: 'ticket_code' })
  ticketCode: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'assigned_technician_id', type: 'uuid', nullable: true })
  assignedTechnicianId: string | null;

  @Column({ name: 'issue_description', type: 'text' })
  issueDescription: string;

  @Column({ name: 'device_type', nullable: true })
  deviceType: string;

  @Column({ name: 'device_model', nullable: true })
  deviceModel: string;

  @Column({ type: 'varchar', default: TicketStatus.RECEIVED })
  status: TicketStatus;

  @Column({ type: 'varchar', default: TicketPriority.NORMAL })
  priority: TicketPriority;

  // Dung cho AI Dispatcher sau nay, vd: ["mainboard"]
  @Column({ name: 'skill_required', type: 'jsonb', default: [] })
  skillRequired: string[];

  @Column({ name: 'quoted_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  quotedPrice: number | null;

  @Column({ name: 'final_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  finalPrice: number | null;

  @Column({ name: 'sla_due_at', type: 'timestamptz', nullable: true })
  slaDueAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;
}
