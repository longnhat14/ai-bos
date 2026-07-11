import { Column, Entity, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

/**
 * Bang gia cong sua theo tung ky nang (skillCode phai khop voi ten dung trong
 * Ticket.skillRequired va User.skills, vd: 'mainboard', 'data-recovery', 'network').
 * AI Pricing se tra bang nay de tinh tien cong, cong voi tien linh kien tu Kho
 * de ra bao gia goi y.
 */
@Entity('price_catalog')
@Unique(['tenantId', 'skillCode'])
export class PriceCatalog extends TenantBaseEntity {
  @Column({ name: 'skill_code' })
  skillCode: string;

  @Column()
  description: string;

  @Column({ name: 'labor_price', type: 'decimal', precision: 12, scale: 2 })
  laborPrice: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
