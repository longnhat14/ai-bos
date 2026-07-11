import { Column, Entity, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('customers')
@Unique(['tenantId', 'phone'])
export class Customer extends TenantBaseEntity {
  @Column({ name: 'full_name' })
  fullName: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  // Ma quoc gia ISO 3166-1 alpha-2, vd: 'VN', 'SG', 'JP'. Quan trong cho RemoteIT
  // (khach hang quoc te) - PCTech mac dinh 'VN' neu khong truyen.
  @Column({ default: 'VN' })
  country: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'customer_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  customerScore: number;
}
