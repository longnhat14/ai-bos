import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string; // vd: 'pctech', 'remoteit'

  @Column()
  name: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Duong dan file logo tren o dia server (vd: uploads/branding/xxx.png).
  // Dung cho man hinh AI Chat Website va sau nay la giao dien SaaS cho tung khach hang rieng.
  // QUAN TRONG: phai khai bao type: 'varchar' tuong minh - neu chi de TypeScript
  // suy luan tu "string | null", reflect-metadata se tra ve "Object" thay vi "String",
  // khien TypeORM bao loi "Data type Object is not supported".
  @Column({ name: 'logo_path', type: 'varchar', nullable: true })
  logoPath: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
