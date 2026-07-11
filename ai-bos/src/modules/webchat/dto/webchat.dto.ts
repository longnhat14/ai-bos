import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class SendWebChatMessageDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string; // neu khong truyen, tao phien moi

  @IsNotEmpty()
  text: string;

  @IsNotEmpty()
  tenantCode: string; // khach vang lai chua dang nhap, can biet dang chat voi tenant nao (vd 'pctech')
}
