import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

export enum ConversationStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum ConversationChannel {
  INTERNAL = 'internal', // mo phong qua API, chua gan kenh that (dung khi test truoc day)
  WHATSAPP = 'whatsapp',
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

  // Kenh thuc su cua cuoc hoi thoai nay - quyet dinh tin nhan tra loi cua staff
  // co duoc GUI THAT ra ngoai (vd WhatsApp) hay chi luu noi bo (internal, dung khi test qua API)
  @Column({ type: 'varchar', default: ConversationChannel.INTERNAL })
  channel: ConversationChannel;

  // ID lien lac ben ngoai tuong ung voi kenh - vd voi WhatsApp la so dien thoai
  // dang whatsapp (wa_id). null neu channel = internal.
  @Column({ name: 'external_contact_id', nullable: true })
  externalContactId: string | null;

  @Column({ type: 'varchar', default: ConversationStatus.OPEN })
  status: ConversationStatus;
}
