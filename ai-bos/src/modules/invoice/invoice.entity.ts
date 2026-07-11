import { Column, Entity, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

export enum InvoiceStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

@Entity('invoices')
@Unique(['tenantId', 'invoiceNumber'])
export class Invoice extends TenantBaseEntity {
  @Column({ name: 'invoice_number' })
  invoiceNumber: string; // vd: 'INV-2026-0001'

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  // Tong tien linh kien (lay tu TicketPart tai thoi diem tao hoa don)
  @Column({ name: 'parts_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  partsAmount: number;

  // Tien cong sua = final_price cua ticket tru di parts_amount (co the am neu du lieu nhap sai,
  // can Admin ra soat lai neu vay - xem ghi chu trong InvoiceService)
  @Column({ name: 'labor_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  laborAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', default: InvoiceStatus.UNPAID })
  status: InvoiceStatus;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt: Date | null;
}
