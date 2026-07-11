/**
 * IChannel - Interface toi gian cho 1 kenh gui tin nhan (Zalo, Telegram, Website...).
 *
 * LY DO CHI DINH NGHIA INTERFACE O DAY, CHUA CODE ADAPTER THAT:
 * Tai thoi diem nay (Sprint 2), AI BOS CHUA co bat ky kenh that nao dang chay
 * (Zalo/Telegram se lam o Sprint 12). Neu xay dung "Communication Layer" day du
 * (Media, File, Interactive Card...) tu bay gio se la doan truoc nhu cau chua co
 * du lieu thuc te kiem chung - rui ro thiet ke sai va phai sua lai.
 *
 * Interface nay chi la "bao hiem re": khai bao truoc de NotificationService sau nay
 * (Sprint 12) chi can viet class implement IChannel cho tung kenh that (ZaloChannel,
 * TelegramChannel...), khong phai sua lai code nghiep vu da co san.
 *
 * Khi mo rong: neu sau nay can gui anh/file/nut bam, hay mo rong ChannelMessage
 * luc do (khi da biet ro Zalo/Telegram ho tro dinh dang nao), khong lam truoc.
 */

export interface ChannelRecipient {
  /** ID nguoi nhan theo tung kenh - vd: zalo_user_id, telegram_chat_id, email... */
  externalId: string;
}

export interface ChannelMessage {
  text: string;
}

export interface IChannel {
  /** Ten kenh, dung de log/debug - vd: 'zalo', 'telegram', 'website' */
  readonly name: string;

  send(recipient: ChannelRecipient, message: ChannelMessage): Promise<void>;
}
