import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

export enum WebChatControlMode {
  AI = 'ai', // AI tu dong xu ly (mac dinh)
  STAFF = 'staff', // Nhan vien da "gianh quyen", AI dung tu dong tra loi
}

/**
 * 1 phien chat cua khach vang lai tren website (chua chac da co Customer/Ticket).
 * customerId co the null luc dau (khach chua cung cap thong tin), duoc dien vao
 * khi AI hoi va khach tra loi ten/SDT, hoac ngay khi tao ticket that.
 */
@Entity('web_chat_sessions')
export class WebChatSession extends TenantBaseEntity {
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({ name: 'created_ticket_id', type: 'uuid', nullable: true })
  createdTicketId: string | null; // neu AI da tao ticket trong phien nay

  // Che do dieu khien phien nay - khi nhan vien "gianh quyen" (takeover), AI ngung
  // tu dong tra loi, nhan vien tu go tin nhan qua endpoint /reply.
  @Column({ name: 'control_mode', type: 'varchar', default: WebChatControlMode.AI })
  controlMode: WebChatControlMode;

  // Nhan vien nao dang phu trach phien nay (null neu con AI kiem soat)
  @Column({ name: 'assigned_staff_id', type: 'uuid', nullable: true })
  assignedStaffId: string | null;
}
