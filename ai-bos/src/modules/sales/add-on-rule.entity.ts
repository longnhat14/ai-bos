import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

export enum TriggerType {
  PRODUCT_SKU = 'product_sku', // kich hoat khi don hang co san pham voi SKU nay
  SKILL_CODE = 'skill_code', // kich hoat khi ticket can ky nang nay (vd 'mainboard')
}

/**
 * AI Sales - Sprint tiep theo (rut gon).
 *
 * Dung RULE-BASED truoc (theo dung ke hoach 4 tuan da thong nhat: "AI Sales:
 * rule-based goi y add-on truoc, nhanh hon nhieu so voi AI-based, nang cap sau").
 * Khong goi Claude API o day - chi la mapping don gian, tiet kiem chi phi
 * va du nhanh cho truong hop pho bien (mua SSD -> goi y cai Win, sao luu...).
 */
@Entity('add_on_rules')
export class AddOnRule extends TenantBaseEntity {
  @Column({ name: 'trigger_type', type: 'varchar' })
  triggerType: TriggerType;

  @Column({ name: 'trigger_value' })
  triggerValue: string; // SKU san pham hoac skill code, tuy trigger_type

  // Danh sach SKU san pham nen goi y kem theo, vd: ["WIN11-LICENSE", "ANTIVIRUS-1Y"]
  @Column({ name: 'suggested_product_skus', type: 'json', nullable: true })
  suggestedProductSkus: string[];

  // Ghi chu dich vu cong them (khong nhat thiet la san pham co san trong kho),
  // vd: "Cai dat Windows + Office", "Ve sinh may dinh ky"
  @Column({ name: 'suggested_service_note', type: 'text', nullable: true })
  suggestedServiceNote: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
