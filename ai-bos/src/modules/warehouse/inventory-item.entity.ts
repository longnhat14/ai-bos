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

  // So thang bao hanh cho linh kien nay (vd RAM bao hanh 36 thang) - null nghia
  // la khong ap dung/chua khai bao. Khac voi Warranty module (bao hanh cho TICKET
  // sua chua), day la bao hanh CUA NHA SAN XUAT/NHA CUNG CAP cho linh kien trong kho.
  @Column({ name: 'warranty_months', type: 'int', nullable: true })
  warrantyMonths: number | null;

  // Link video gioi thieu/huong dan (vd video YouTube tu nha cung cap) - CHI 1
  // link duy nhat, khac voi hinh anh co the nhieu (xem InventoryItemImage).
  @Column({ name: 'video_url', type: 'varchar', nullable: true })
  videoUrl: string | null;
}
