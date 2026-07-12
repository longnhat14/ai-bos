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

  // Phien webchat NHAN VIEN NAY dang tap trung tra loi qua Telegram - tranh tinh
  // trang doan mo "phien gan nhat" khi ho dang xu ly NHIEU phien cung luc (rui ro
  // gui nham cau tra loi cho khach khac). Duoc set khi takeover() hoac lenh /s.
  @Column({ name: 'active_session_id', type: 'uuid', nullable: true })
  activeSessionId: string | null;

  // Bo dem so thu tu TIEP THEO se gan cho khach moi (giong so thu tu ve xep hang) -
  // MOI TANG DAN, KHONG BAO GIO giam/tai su dung. Khac voi cach danh so theo VI TRI
  // trong danh sach (co the doi khi co khach moi xen vao), so nay CO DINH tu luc
  // takeover, khong doi du co bao nhieu khach khac den sau.
  @Column({ name: 'next_queue_number', type: 'int', default: 1 })
  nextQueueNumber: number;
}
