import { BadRequestException, Body, Controller, Logger, Post, Req } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { ZaloInboundService } from './zalo-inbound.service';

/**
 * Endpoint PUBLIC (khong qua JwtAuthGuard) vi Zalo goi truc tiep tu internet.
 *
 * QUAN TRONG VE XAC THUC CHU KY: Zalo OA ky webhook bang truong "mac" trong
 * chinh payload JSON (khac WhatsApp dung header X-Hub-Signature-256, khac
 * Telegram dung header rieng). Cong thuc: mac = HMAC-SHA256(data_khong_co_truong_mac, app_secret).
 * Code duoi day trien khai theo tai lieu Zalo OA pho bien nhat - BAT BUOC kiem tra
 * lai voi tai lieu Zalo Developers moi nhat truoc khi dung that, vi API cua ben
 * thu ba co the thay doi (khac voi API noi bo do chinh minh kiem soat).
 */
@Controller('webhooks/zalo')
export class ZaloWebhookController {
  private readonly logger = new Logger(ZaloWebhookController.name);

  constructor(private readonly inboundService: ZaloInboundService) {}

  @Post()
  async receiveWebhook(@Body() body: any, @Req() req: Request) {
    if (!this.isValidSignature(body)) {
      this.logger.warn('Zalo webhook: chu ky (mac) khong hop le, tu choi request');
      throw new BadRequestException('Invalid signature');
    }

    // Tra ve OK ngay, xu ly nghiep vu "background" - giong nguyen tac da ap dung cho WhatsApp
    try {
      if (body.event_name === 'user_send_text' && body.sender?.id && body.message?.text) {
        await this.inboundService.handleIncomingMessage({
          from: body.sender.id,
          text: body.message.text,
        });
      }
    } catch (err) {
      this.logger.error(`Loi khi xu ly webhook Zalo: ${err.message}`);
    }

    return { message: 'success' };
  }

  private isValidSignature(body: any): boolean {
    const appSecret = process.env.ZALO_APP_SECRET;
    if (!appSecret) {
      this.logger.warn(
        'ZALO_APP_SECRET chua cau hinh - BO QUA xac thuc chu ky (KHONG an toan, chi nen dung khi test local)',
      );
      return true;
    }

    const { mac, ...dataWithoutMac } = body;
    if (!mac) return false;

    const expectedMac = createHmac('sha256', appSecret)
      .update(JSON.stringify(dataWithoutMac))
      .digest('hex');

    try {
      return timingSafeEqual(Buffer.from(mac), Buffer.from(expectedMac));
    } catch {
      return false;
    }
  }
}
