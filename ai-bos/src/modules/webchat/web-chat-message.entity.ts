import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

export enum WebChatRole {
  CUSTOMER = 'customer',
  ASSISTANT = 'assistant',
}

@Entity('web_chat_messages')
export class WebChatMessage extends TenantBaseEntity {
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ type: 'varchar' })
  role: WebChatRole;

  @Column({ type: 'text' })
  text: string;

  // Neu khach gui kem anh (chup tu camera dien thoai qua input capture="environment")
  @Column({ name: 'image_path', type: 'varchar', nullable: true })
  imagePath: string | null;

  @Column({ name: 'image_mime_type', type: 'varchar', nullable: true })
  imageMimeType: string | null;
}
