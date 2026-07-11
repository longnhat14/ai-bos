import { Injectable, Logger } from '@nestjs/common';
import { ChannelMessage, ChannelRecipient, IChannel } from './channel.interface';

/**
 * ConsoleChannel - implementation TAM THOI cua IChannel, chi ghi log.
 *
 * Day la "kenh" duy nhat AI BOS dung cho den Sprint 12. Khi do se them
 * ZaloChannel (dung OpenClaw) va TelegramChannel (goi thang Telegram Bot API),
 * ca 2 deu implement IChannel giong class nay - NotificationService goi
 * IChannel.send(...) se khong doi code du ben duoi la Console, Zalo hay Telegram.
 */
@Injectable()
export class ConsoleChannel implements IChannel {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleChannel.name);

  async send(recipient: ChannelRecipient, message: ChannelMessage): Promise<void> {
    this.logger.log(`[ConsoleChannel] Gui toi ${recipient.externalId}: ${message.text}`);
  }
}
