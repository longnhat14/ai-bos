import { IsNotEmpty } from 'class-validator';

export class LinkTelegramDto {
  @IsNotEmpty()
  telegramChatId: string;
}
