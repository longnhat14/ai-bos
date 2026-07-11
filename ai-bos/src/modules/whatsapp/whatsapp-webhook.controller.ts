import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { WhatsAppInboundService } from './whatsapp-inbound.service';

/**
 * Endpoint nay PUBLIC (khong qua JwtAuthGuard) vi Meta goi truc tiep tu internet,
 * khong the dinh kem JWT token cua he thong. Bao mat duoc dam bao qua:
 * 1. GET: xac thuc bang WHATSAPP_WEBHOOK_VERIFY_TOKEN luc dang ky webhook voi Meta (1 lan duy nhat)
 * 2. POST: xac thuc CHU KY (X-Hub-Signature-256) tren MOI request, dam bao du lieu
 *    thuc su den tu Meta, khong phai ai do gia mao goi POST toi endpoint nay.
 */
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(private readonly inboundService: WhatsAppInboundService) {}

  // Meta goi GET 1 lan duy nhat khi ban dang ky webhook URL tren Meta App Dashboard
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && token && expectedToken && token === expectedToken) {
      this.logger.log('WhatsApp webhook da xac thuc thanh cong voi Meta');
      return res.status(200).send(challenge);
    }

    this.logger.warn('WhatsApp webhook verify token khong khop - tu choi');
    return res.status(403).send('Forbidden');
  }

  // Meta goi POST moi khi co tin nhan/su kien moi
  @Post()
  async receiveWebhook(
    @Req() req: Request,
    @Headers('x-hub-signature-256') signature: string,
    @Res() res: Response,
  ) {
    // QUAN TRONG: xac thuc chu ky truoc khi xu ly bat ky du lieu nao trong body,
    // tranh ke xau gia mao request gui tin nhan gia vao he thong.
    if (!this.isValidSignature(req, signature)) {
      this.logger.warn('WhatsApp webhook: chu ky khong hop le, tu choi request');
      throw new BadRequestException('Invalid signature');
    }

    // Tra 200 NGAY LAP TUC cho Meta (Meta yeu cau phan hoi nhanh, neu khong se retry lien tuc),
    // xu ly nghiep vu o "background" (khong await) - chap nhan tradeoff don gian hoa cho MVP,
    // Sprint sau co the day vao Event Bus/Queue rieng neu luu luong lon.
    res.status(200).send('OK');

    try {
      const entries = req.body?.entry || [];
      for (const entry of entries) {
        for (const change of entry.changes || []) {
          const value = change.value;
          const contacts = value?.contacts || [];
          const messages = value?.messages || [];

          for (const message of messages) {
            if (message.type !== 'text') continue; // MVP: chi xu ly tin nhan van ban truoc

            const contactName = contacts.find((c: any) => c.wa_id === message.from)?.profile?.name;

            await this.inboundService.handleIncomingMessage({
              from: message.from,
              text: message.text?.body || '',
              contactName,
            });
          }
        }
      }
    } catch (err) {
      this.logger.error(`Loi khi xu ly webhook WhatsApp: ${err.message}`);
    }
  }

  private isValidSignature(req: Request, signatureHeader: string | undefined): boolean {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!appSecret) {
      this.logger.warn(
        'WHATSAPP_APP_SECRET chua cau hinh - BO QUA xac thuc chu ky (KHONG an toan, chi nen dung khi dang test local)',
      );
      return true; // MVP fallback: cho phep test khi chua co app secret, nhung PHAI cau hinh truoc khi len production that
    }

    if (!signatureHeader || !rawBody) return false;

    const expectedSignature =
      'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');

    try {
      return timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature));
    } catch {
      return false; // do dai buffer khac nhau se nem loi - coi la khong hop le
    }
  }
}
