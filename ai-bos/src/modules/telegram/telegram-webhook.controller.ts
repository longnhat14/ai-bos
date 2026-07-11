import { Body, Controller, Headers, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

      const reply = await this.commandService.handleCommand(binding.tenantId, text);
      await this.telegramChannel.send({ externalId: chatId }, { text: reply });
    } catch (err) {
      this.logger.error(`Loi xu ly webhook Telegram: ${err.message}`);
    }

    return { ok: true };
  }
}
