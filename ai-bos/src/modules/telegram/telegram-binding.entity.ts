import { Column, Entity, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

/**
 * Lien ket 1 Telegram Chat ID voi 1 tai khoan noi bo (Admin/Technician) da co san
 * trong he thong. Day la lop bao mat quan trong nhat cua Telegram integration -
 * BAT KY AI cung co the nhan tin cho Bot, nhung CHI nguoi da lien ket (qua endpoint
 * xac thuc JWT) moi duoc phep thuc hien lenh dieu khien du lieu that.
 */
@Entity('telegram_bindings')
@Unique(['tenantId', 'telegramChatId'])
export class TelegramBinding extends TenantBaseEntity {
  @Column({ name: 'telegram_chat_id' })
  telegramChatId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string; // tai khoan noi bo (User) da lien ket

  @Column({ name: 'telegram_username', nullable: true })
  telegramUsername: string;
}
