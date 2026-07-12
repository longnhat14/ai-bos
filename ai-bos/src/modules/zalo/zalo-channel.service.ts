import { Injectable, Logger } from '@nestjs/common';
import { ChannelMessage, ChannelRecipient, IChannel } from '../../common/channels/channel.interface';

const ZALO_OA_API_URL = 'https://openapi.zalo.me/v3.0/oa/message/cs';

/**
 * ZaloChannel - implementation THAT cua IChannel, giong cach lam voi WhatsAppChannel
 * va TelegramChannel. Dung Zalo Official Account (OA) API de gui tin nhan tu van (CS).
 *
 * Can 1 bien moi truong:
 * - ZALO_OA_ACCESS_TOKEN: access token cua Zalo OA (lay qua Zalo Developers,
 *   can lam moi dinh ky - Zalo access token co thoi han ngan hon Meta/Telegram,
 *   Sprint sau nen them co che tu dong lam moi qua refresh token)
 */
@Injectable()
export class ZaloChannel implements IChannel {
  readonly name = 'zalo';
  private readonly logger = new Logger(ZaloChannel.name);

  async send(recipient: ChannelRecipient, message: ChannelMessage): Promise<void> {
    const accessToken = process.env.ZALO_OA_ACCESS_TOKEN;
    if (!accessToken) {
      this.logger.warn('Chua cau hinh ZALO_OA_ACCESS_TOKEN - khong the gui tin nhan Zalo');
      return;
    }

    try {
      const response = await fetch(ZALO_OA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: accessToken,
        },
        body: JSON.stringify({
          recipient: { user_id: recipient.externalId }, // Zalo user_id cua khach (tu su kien webhook)
          message: { text: message.text },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Zalo OA API tra ve loi ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      if (data.error && data.error !== 0) {
        throw new Error(`Zalo OA API tra ve error code ${data.error}: ${data.message}`);
      }

      this.logger.log(`Da gui tin nhan Zalo toi ${recipient.externalId}`);
    } catch (err) {
      this.logger.error(`Loi khi gui tin nhan Zalo: ${err.message}`);
    }
  }
}
