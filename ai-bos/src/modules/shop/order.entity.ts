import { Column, Entity, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

export enum OrderStatus {
  PENDING = 'pending', // vua tao, chua xac nhan
  CONFIRMED = 'confirmed', // da xac nhan, da tru kho
  COMPLETED = 'completed', // da giao/thanh toan xong
  CANCELLED = 'cancelled',
}

@Entity('orders')
@Unique(['tenantId', 'orderNumber'])
export class Order extends TenantBaseEntity {
  @Column({ name: 'order_number' })
  orderNumber: string; // vd: 'ORD-2026-0001'

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar', default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
