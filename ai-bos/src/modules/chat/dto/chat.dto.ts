import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { SenderType } from '../chat-message.entity';

export class CreateConversationDto {
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @IsUUID()
  customerId: string;

  // Ma ISO ngon ngu khach hang, vd: 'en', 'ja'. Neu khong truyen, mac dinh 'en'.
  @IsOptional()
  customerLanguage?: string;

  // Ghi de mac dinh theo tenant (RemoteIT = bat, PCTech = tat).
  // Dung khi PCTech thinh thoang gap khach nuoc ngoai va muon bat dich rieng cho ca do,
  // KHONG lam thay doi mac dinh chung cua toan bo tenant PCTech.
  @IsOptional()
  @IsBoolean()
  enableAutoTranslate?: boolean;
}

export class SendMessageDto {
  @IsIn(Object.values(SenderType))
  senderType: SenderType;

  @IsNotEmpty()
  text: string;
}
