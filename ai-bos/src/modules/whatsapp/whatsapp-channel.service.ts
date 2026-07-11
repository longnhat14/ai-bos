import { Injectable, Logger } from '@nestjs/common';
import { ChannelMessage, ChannelRecipient, IChannel } from '../../common/channels/channel.interface';

const GRAPH_API_VERSION = 'v21.0';

/**
 * WhatsAppChannel - implementation THAT cua IChannel (khac voi ConsoleChannel
 * chi la placeholder). Day chinh la ly do IChannel duoc dinh nghia truoc o
 * Sprint 2 - gio chi can them class nay, KHONG phai sua NotificationService
 * hay bat ky code nghiep vu nao khac.
 *
 * Dung WhatsApp Cloud API (Meta) - can 3 bien moi truong:
 * - WHATSAPP_PHONE_NUMBER_ID: ID so dien thoai WhatsApp Business da dang ky tren Meta
 * - WHATSAPP_ACCESS_TOKEN: access token cua Meta App (System User token, khong het han
 *   neu dung Permanent Token, xem huong dan trong README)
 * - WHATSAPP_APP_SECRET: dung de xac thuc chu ky webhook (bao mat, xem whatsapp-webhook.controller.ts)
 */
@Injectable()
export class WhatsAppChannel implements IChannel {
  readonly name = 'whatsapp';
  private readonly logger = new Logger(WhatsAppChannel.name);

  async send(recipient: ChannelRecipient, message: ChannelMessage): Promise<void> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      this.logger.warn(
        'Chua cau hinh WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN - khong the gui tin nhan WhatsApp that',
      );
      return;
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient.externalId, // so dien thoai dang quoc te, khong co dau '+', vd '6591234567'
          type: 'text',
          text: { body: message.text },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`WhatsApp API tra ve loi ${response.status}: ${errorBody}`);
      }

      this.logger.log(`Da gui tin nhan WhatsApp toi ${recipient.externalId}`);
    } catch (err) {
      this.logger.error(`Loi khi gui tin nhan WhatsApp: ${err.message}`);
      // Khong throw tiep - loi gui WhatsApp khong nen lam sap luong luu tin nhan trong DB,
      // tin nhan van duoc luu (xem ChatService), chi la khach chua nhan duoc ben ngoai.
      // Sprint sau co the them co che retry/canh bao cho nhan vien khi gui that bai.
    }
  }
}
