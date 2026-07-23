import { Injectable, Logger } from '@nestjs/common';
import { ChannelMessage, ChannelRecipient, IChannel } from '../../common/channels/channel.interface';

const GRAPH_API_VERSION = 'v21.0';

/**
 * MessengerChannel - implementation THAT cua IChannel, dung Facebook Graph API
 * (cung ha tang Meta voi WhatsApp, nhung la Facebook Page Messenger, khac biet:
 * dung PAGE_ACCESS_TOKEN rieng cho tung Page, khong phai WhatsApp Business Number).
 *
 * Can 2 bien moi truong:
 * - MESSENGER_PAGE_ACCESS_TOKEN: Page Access Token cua Facebook Page (lay qua
 *   Meta for Developers, gan voi 1 Facebook Page cu the)
 * - MESSENGER_APP_SECRET: dung de xac thuc chu ky webhook (xem messenger-webhook.controller.ts)
 */
@Injectable()
export class MessengerChannel implements IChannel {
  readonly name = 'messenger';
  private readonly logger = new Logger(MessengerChannel.name);

  async send(recipient: ChannelRecipient, message: ChannelMessage): Promise<void> {
    const pageAccessToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN;

    if (!pageAccessToken) {
      this.logger.warn(
        'Chua cau hinh MESSENGER_PAGE_ACCESS_TOKEN - khong the gui tin nhan Messenger that',
      );
      return;
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${pageAccessToken}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipient.externalId }, // Facebook PSID (Page-Scoped ID) cua khach
          message: { text: message.text },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Messenger API tra ve loi ${response.status}: ${errorBody}`);
      }

      this.logger.log(`Da gui tin nhan Messenger toi ${recipient.externalId}`);
    } catch (err) {
      this.logger.error(`Loi khi gui tin nhan Messenger: ${err.message}`);
    }
  }
}
