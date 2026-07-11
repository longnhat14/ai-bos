import { Body, ConflictException, Controller, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { LinkTelegramDto } from './dto/telegram.dto';
import { TelegramBinding } from './telegram-binding.entity';

@Controller('api/v1/telegram')
@UseGuards(JwtAuthGuard)
export class TelegramController {
  constructor(
    @InjectRepository(TelegramBinding) private readonly bindingRepo: Repository<TelegramBinding>,
  ) {}

  // Nhan vien nhan tin cho Bot truoc de lay Chat ID, roi goi endpoint nay (co dang nhap)
  // de lien ket Chat ID do voi tai khoan cua minh.
  @Post('link')
  async link(@CurrentUser() user: JwtPayload, @Body() dto: LinkTelegramDto) {
    const existing = await this.bindingRepo.findOne({
      where: { tenantId: user.tenantId, telegramChatId: dto.telegramChatId },
    });
    if (existing) {
      throw new ConflictException('Chat ID nay da duoc lien ket voi 1 tai khoan khac');
    }

    const binding = this.bindingRepo.create({
      tenantId: user.tenantId,
      telegramChatId: dto.telegramChatId,
      userId: user.sub,
    });
    await this.bindingRepo.save(binding);

    return { message: 'Da lien ket Telegram thanh cong. Ban co the bat dau nhan lenh qua Bot.' };
  }
}
