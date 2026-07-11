import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

/**
 * Ghi lai linh kien da dung cho 1 ticket cu the.
 * Luu ca gia tai thoi diem su dung (khong tham chieu truc tiep gia hien tai cua
 * InventoryItem), vi gia co the thay doi sau nay nhung hoa don cu khong duoc doi theo.
 */
@Entity('ticket_parts')
export class TicketPart extends TenantBaseEntity {
  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId: string;

  @Column({ name: 'inventory_item_id', type: 'uuid' })
  inventoryItemId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'unit_cost_price', type: 'decimal', precision: 12, scale: 2 })
  unitCostPrice: number;

  @Column({ name: 'unit_sell_price', type: 'decimal', precision: 12, scale: 2 })
  unitSellPrice: number;
}
