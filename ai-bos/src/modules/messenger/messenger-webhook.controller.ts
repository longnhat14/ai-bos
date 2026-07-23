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
import { MessengerInboundService } from './messenger-inbound.service';

@Controller('webhooks/messenger')
export class MessengerWebhookController {
  private readonly logger = new Logger(MessengerWebhookController.name);

  constructor(private readonly inboundService: MessengerInboundService) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expectedToken = process.env.MESSENGER_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && token && expectedToken && token === expectedToken) {
      this.logger.log('Messenger webhook da xac thuc thanh cong voi Meta');
      return res.status(200).send(challenge);
    }

    this.logger.warn('Messenger webhook verify token khong khop - tu choi');
    return res.status(403).send('Forbidden');
  }

  @Post()
  async receiveWebhook(
    @Req() req: Request,
    @Headers('x-hub-signature-256') signature: string,
    @Res() res: Response,
  ) {
    if (!this.isValidSignature(req, signature)) {
      this.logger.warn('Messenger webhook: chu ky khong hop le, tu choi request');
      throw new BadRequestException('Invalid signature');
    }

    res.status(200).send('OK');

    try {
      const entries = req.body?.entry || [];
      for (const entry of entries) {
        for (const event of entry.messaging || []) {
          if (!event.message?.text || event.message.is_echo) continue;

          await this.inboundService.handleIncomingMessage({
            from: event.sender.id,
            text: event.message.text,
          });
        }
      }
    } catch (err) {
      this.logger.error(`Loi khi xu ly webhook Messenger: ${err.message}`);
    }
  }

  private isValidSignature(req: Request, signatureHeader: string | undefined): boolean {
    const appSecret = process.env.MESSENGER_APP_SECRET;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!appSecret) {
      this.logger.warn(
        'MESSENGER_APP_SECRET chua cau hinh - BO QUA xac thuc chu ky (KHONG an toan, chi nen dung khi dang test local)',
      );
      return true;
    }

    if (!signatureHeader || !rawBody) return false;

    const expectedSignature =
      'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');

    try {
      return timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }
}
