import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

export enum SenderType {
  CUSTOMER = 'customer',
  STAFF = 'staff',
}

@Entity('chat_messages')
export class ChatMessage extends TenantBaseEntity {
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ name: 'sender_type', type: 'varchar' })
  senderType: SenderType;

  @Column({ name: 'original_text', type: 'text' })
  originalText: string;

  @Column({ name: 'original_language' })
  originalLanguage: string;

  // Neu auto_translate_enabled = false (vd tenant PCTech), 2 truong nay
  // se duoc gan bang chinh ban goc (khong dich) de API tra ve nhat quan.
  @Column({ name: 'translated_text', type: 'text' })
  translatedText: string;

  @Column({ name: 'translated_language' })
  translatedLanguage: string;
}
