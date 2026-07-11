import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('order_items')
export class OrderItem extends TenantBaseEntity {
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'inventory_item_id', type: 'uuid' })
  inventoryItemId: string;

  @Column({ type: 'int' })
  quantity: number;

  // Gia tai thoi diem dat hang - khong tham chieu gia hien tai cua InventoryItem
  // (giong nguyen tac da ap dung o TicketPart, tranh don hang cu bi doi gia)
  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;
}
