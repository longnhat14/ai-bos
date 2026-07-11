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
