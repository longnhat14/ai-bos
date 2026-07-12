import {
  Body,
  Controller,
  forwardRef,
  Headers,
  Inject,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIChatService } from '../webchat/ai-chat.service';
import { TelegramBinding } from './telegram-binding.entity';
import { TelegramChannel } from './telegram-channel.service';
import { TelegramCommandService } from './telegram-command.service';

/**
 * Endpoint PUBLIC (khong qua JwtAuthGuard) vi Telegram goi truc tiep tu internet.
 * Bao mat qua secret token rieng cua Telegram (khac co che voi Meta - Telegram dung
 * header 'X-Telegram-Bot-Api-Secret-Token' don gian hon chu ky HMAC cua WhatsApp).
 */
@Controller('webhooks/telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    @InjectRepository(TelegramBinding) private readonly bindingRepo: Repository<TelegramBinding>,
    private readonly telegramChannel: TelegramChannel,
    private readonly commandService: TelegramCommandService,
    @Inject(forwardRef(() => AIChatService)) private readonly aiChatService: AIChatService,
  ) {}

  @Post()
  async receiveWebhook(
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string,
  ) {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret && secretToken !== expectedSecret) {
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }

    const message = update?.message;
    if (!message || !message.text) return { ok: true };

    const chatId = String(message.chat.id);
    const text = message.text as string;

    try {
      // Chua lien ket voi tai khoan noi bo nao -> chi tra ve Chat ID de nhan vien
      // dung ID nay lien ket qua endpoint xac thuc (POST /api/v1/telegram/link)
      const binding = await this.bindingRepo.findOne({ where: { telegramChatId: chatId } });

      if (!binding) {
        await this.telegramChannel.send(
          { externalId: chatId },
          {
            text:
              `👋 Chào bạn! Chat ID của bạn là: <code>${chatId}</code>\n\n` +
              `Vui lòng đăng nhập vào hệ thống AI BOS và liên kết Telegram bằng ID này ` +
              `trước khi có thể sử dụng lệnh.`,
          },
        );
        return { ok: true };
      }

      // Cac lenh dieu khien (bat dau bang "/") LUON duoc xu ly nhu lenh, KHONG BAO GIO
      // bi hieu nham thanh cau tra loi cho khach - du dang co phien active hay khong.
      if (text.trim().startsWith('/')) {
        const reply = await this.commandService.handleCommand(binding.tenantId, text, binding.userId);
        await this.telegramChannel.send({ externalId: chatId }, { text: reply });
        return { ok: true };
      }

      // Neu nhan vien nay dang co 1 phien webchat "dang focus" (da takeover hoac
      // vua /switch sang) -> coi tin nhan Telegram nay CHINH LA cau tra loi cho
      // khach cua phien do. KHONG con doan "phien gan nhat" nhu truoc - vi khi
      // xu ly nhieu khach cung luc, doan mo se gui NHAM cau tra loi.
      const activeSession = await this.aiChatService.getActiveSessionForStaff(
        binding.tenantId,
        binding.userId,
      );

      if (activeSession) {
        await this.aiChatService.staffReply(binding.tenantId, activeSession.id, binding.userId, text);
        await this.telegramChannel.send(
          { externalId: chatId },
          {
            text: `✅ Đã gửi trả lời cho khách (phiên <code>${activeSession.id.slice(0, 8)}</code>). Dùng /ds nếu bạn đang xử lý nhiều khách cùng lúc.`,
          },
        );
        return { ok: true };
      }

      const reply = await this.commandService.handleCommand(binding.tenantId, text, binding.userId);
      await this.telegramChannel.send({ externalId: chatId }, { text: reply });
    } catch (err) {
      this.logger.error(`Loi xu ly webhook Telegram: ${err.message}`);
    }

    return { ok: true };
  }
}
