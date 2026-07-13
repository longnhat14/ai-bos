import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

/**
 * 1 linh kien co the co NHIEU anh (vd chup nhieu goc do) - khac voi TicketAttachment
 * (anh loi may, gan voi 1 Ticket), day gan voi 1 InventoryItem. Dung cung pattern
 * da ap dung cho TicketAttachment de nhat quan trong toan he thong.
 */
@Entity('inventory_item_images')
export class InventoryItemImage extends TenantBaseEntity {
  @Column({ name: 'inventory_item_id', type: 'uuid' })
  inventoryItemId: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'mime_type' })
  mimeType: string;
}
