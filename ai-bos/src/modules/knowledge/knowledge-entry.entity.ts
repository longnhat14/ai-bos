import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

/**
 * Kho tri thuc SOP/quy trinh sua chua.
 *
 * GHI CHU QUAN TRONG VE THIET KE: Ke hoach ban dau du dinh dung Vector DB
 * (pgvector cua PostgreSQL) de tim kiem ngu nghia. Sau khi chuyen sang MariaDB
 * (theo hosting thuc te), va theo dung nguyen tac "khong xay dung truoc cho quy mo
 * chua co" da thong nhat truoc day (xem thao luan ve IChannel/Communication Layer),
 * Sprint nay dung TIM KIEM THEO TU KHOA (keyword matching o tang ung dung) thay vi
 * vector search that su:
 * - Quy mo du lieu thuc te (SOP cua 1 tiem sua chua) chi vai chuc-vai tram muc,
 *   khong can ha tang vector chuyen dung
 * - Tranh phu thuoc them 1 API embedding rieng (vd Voyage AI) khi chua chac can
 * - Neu sau nay quy mo lon hon that (vd ban SaaS cho hang tram cua hang, moi cua
 *   hang hang nghin SOP), luc do nen nang cap len vector search that su
 */
@Entity('knowledge_entries')
export class KnowledgeEntry extends TenantBaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  category: string; // vd: 'mainboard', 'printer', 'network'...

  // Tu khoa dung de tim kiem, vd: ["beep", "khong len nguon", "RAM"]
  @Column({ type: 'json', nullable: true })
  tags: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
