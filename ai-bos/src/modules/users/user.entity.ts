import { Column, Entity, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

export enum UserRole {
  ADMIN = 'admin',
  TECHNICIAN = 'technician',
}

@Entity('users')
@Unique(['tenantId', 'email'])
export class User extends TenantBaseEntity {
  @Column()
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', default: UserRole.TECHNICIAN })
  role: UserRole;

  @Column({ nullable: true })
  phone: string;

  // Khu vuc phuc vu cua ky thuat vien - dung cho tieu chi "khoang cach" trong AI Dispatcher
  @Column({ nullable: true })
  city: string;

  // Ma quoc gia ISO 3166-1 alpha-2 - dung de kiem tra tinh kha thi khi dieu phoi
  // KTV onsite (vd 'VN'). Voi Remote Engineer, truong nay chi la thong tin tham khao.
  @Column({ default: 'VN' })
  country: string;

  // true = Remote Engineer (ho tro tu xa, khong bi rang buoc quoc gia/tinh thanh)
  // false = KTV onsite (bat buoc cung quoc gia moi kha thi ve mat vat ly)
  @Column({ name: 'is_remote', default: false })
  isRemote: boolean;

  // Chuan bi san cho AI Dispatcher (Giai doan 3) - vd: [{ skill: 'mainboard', level: 5 }]
  // MariaDB dung 'json' (khong co 'jsonb' nhu Postgres); gia tri mac dinh xu ly o tang service
  @Column({ type: 'json', nullable: true })
  skills: { skill: string; level: number }[];

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 5.0 })
  rating: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
