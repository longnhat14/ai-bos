import { Column, Entity, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

export enum ActiveChannelType {
  WEBCHAT = 'webchat',
  WHATSAPP = 'whatsapp',
}

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

  // Phien/hoi thoai NHAN VIEN NAY dang tap trung tra loi qua Telegram - tranh tinh
  // trang doan mo "phien gan nhat" khi ho dang xu ly NHIEU phien cung luc (rui ro
  // gui nham cau tra loi cho khach khac). Duoc set khi takeover()/claim() hoac lenh /s.
  @Column({ name: 'active_session_id', type: 'uuid', nullable: true })
  activeSessionId: string | null;

  // Phan biet activeSessionId dang tro toi WebChatSession (AI Chat Website) hay
  // Conversation (WhatsApp) - vi 2 loai deu dung chung 1 co che /s <so>, can biet
  // goi staffReply() cua service nao khi nhan vien go tin nhan tu do tren Telegram.
  @Column({ name: 'active_channel_type', type: 'varchar', nullable: true })
  activeChannelType: ActiveChannelType | null;

  // Bo dem so thu tu TIEP THEO se gan cho khach moi (giong so thu tu ve xep hang) -
  // MOI TANG DAN, KHONG BAO GIO giam/tai su dung. DUNG CHUNG cho ca WebChat va WhatsApp,
  // giup nhan vien khong phai nho "so nay la webchat hay whatsapp" - chi can nho /s <so>.
  @Column({ name: 'next_queue_number', type: 'int', default: 1 })
  nextQueueNumber: number;
}
