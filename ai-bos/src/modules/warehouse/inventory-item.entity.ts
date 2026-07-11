import { Column, Entity, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('inventory_items')
@Unique(['tenantId', 'sku'])
export class InventoryItem extends TenantBaseEntity {
  @Column()
  sku: string; // ma linh kien, vd: 'SSD-SAMSUNG-1TB'

  @Column()
  name: string;

  @Column({ nullable: true })
  unit: string; // vd: 'cai', 'chiec'

  @Column({ name: 'quantity_on_hand', type: 'int', default: 0 })
  quantityOnHand: number;

  @Column({ name: 'low_stock_threshold', type: 'int', default: 5 })
  lowStockThreshold: number;

  @Column({ name: 'cost_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  costPrice: number; // gia nhap

  @Column({ name: 'sell_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  sellPrice: number; // gia ban

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
