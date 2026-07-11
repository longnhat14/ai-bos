import { Column, Entity, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

export enum WarrantyStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  VOIDED = 'voided', // huy bao hanh thu cong (vd khach tu y thao may lam mat tem)
}

@Entity('warranties')
@Unique(['tenantId', 'ticketId'])
export class Warranty extends TenantBaseEntity {
  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'device_type', nullable: true })
  deviceType: string;

  @Column({ name: 'device_model', nullable: true })
  deviceModel: string;

  @Column({ name: 'warranty_months', type: 'int' })
  warrantyMonths: number;

  @Column({ name: 'start_date', type: 'datetime' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'datetime' })
  endDate: Date;

  @Column({ type: 'varchar', default: WarrantyStatus.ACTIVE })
  status: WarrantyStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
