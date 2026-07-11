import { Column, Entity, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

/**
 * Cache ket qua chan doan CHINH XAC (exact-match) - CHI tai su dung khi
 * cau hoi giong het (sau khi chuan hoa) VA cung loai thiet bi.
 *
 * KHONG lam "fuzzy cache" (tim cau hoi "tuong tu" roi tai su dung) - vi cac
 * su co phan cung phu thuoc rat nhieu vao ngu canh cu the (vd tieng beep
 * 3 lan co y nghia khac nhau tuy hang mainboard/BIOS), tai su dung sai co
 * the khien ky thuat vien chan doan sai. Voi truong hop "tuong tu", giai
 * phap dung la de ky thuat vien XAC NHAN ket qua dung roi luu vao
 * Knowledge Base that su (co con nguoi kiem chung), khong phai cache mu.
 */
@Entity('diagnostic_cache')
@Unique(['tenantId', 'queryHash'])
export class DiagnosticCache extends TenantBaseEntity {
  // SHA-256 cua (deviceType + deviceModel + issueDescription da chuan hoa)
  @Column({ name: 'query_hash' })
  queryHash: string;

  @Column({ name: 'device_type', nullable: true })
  deviceType: string;

  @Column({ name: 'issue_description', type: 'text' })
  issueDescription: string;

  @Column({ name: 'result_json', type: 'json' })
  resultJson: Record<string, any>;

  @Column({ name: 'hit_count', type: 'int', default: 0 })
  hitCount: number; // theo doi cache nay da duoc dung lai bao nhieu lan
}
