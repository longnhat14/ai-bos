import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

export enum ConversationStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

@Entity('conversations')
export class Conversation extends TenantBaseEntity {
  @Column({ name: 'ticket_id', type: 'uuid', nullable: true })
  ticketId: string | null; // lien ket voi ticket sua chua/ho tro RemoteIT (neu co)

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  // Ma ngon ngu ISO 639-1, vd: 'en', 'ja', 'ko', 'zh'
  @Column({ name: 'customer_language' })
  customerLanguage: string;

  // Ngon ngu cua nguoi tiep nhan - mac dinh tieng Viet
  @Column({ name: 'staff_language', default: 'vi' })
  staffLanguage: string;

  // Co bat dich tu dong hay khong - CHI bat mac dinh cho tenant RemoteIT,
  // xac dinh boi ChatService khi tao conversation (xem ghi chu trong chat.service.ts)
  @Column({ name: 'auto_translate_enabled', default: false })
  autoTranslateEnabled: boolean;

  @Column({ type: 'varchar', default: ConversationStatus.OPEN })
  status: ConversationStatus;
}
