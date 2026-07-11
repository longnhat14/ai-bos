import { Injectable, Logger } from '@nestjs/common';
import { ChannelMessage, ChannelRecipient, IChannel } from '../../common/channels/channel.interface';

/**
 * TelegramChannel - implementation THAT cua IChannel, giong cach lam voi WhatsAppChannel.
 * Goi THANG Telegram Bot API (khong qua OpenClaw), dung theo kien truc da thong nhat:
 * "Telegram: goi thang Telegram Bot API cho noi bo, khong can lop trung gian vi
 * Telegram Bot API von da rat don gian/manh".
 */
@Injectable()
export class TelegramChannel implements IChannel {
  readonly name = 'telegram';
  private readonly logger = new Logger(TelegramChannel.name);

  async send(recipient: ChannelRecipient, message: ChannelMessage): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      this.logger.warn('Chua cau hinh TELEGRAM_BOT_TOKEN - khong the gui tin nhan Telegram');
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: recipient.externalId,
          text: message.text,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Telegram API tra ve loi ${response.status}: ${errorBody}`);
      }

      this.logger.log(`Da gui tin nhan Telegram toi chat ${recipient.externalId}`);
    } catch (err) {
      this.logger.error(`Loi khi gui tin nhan Telegram: ${err.message}`);
    }
  }
}
