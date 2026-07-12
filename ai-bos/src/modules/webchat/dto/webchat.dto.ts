import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class SendWebChatMessageDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string; // neu khong truyen, tao phien moi

  @IsNotEmpty()
  text: string;

  @IsNotEmpty()
  tenantCode: string; // khach vang lai chua dang nhap, can biet dang chat voi tenant nao (vd 'pctech')

  // Ma ngon ngu khach (ISO 639-1, vd 'en', 'ja') - CHI dung khi tao phien MOI
  // (sessionId chua truyen). Mac dinh 'en' neu khong khai bao.
  @IsOptional()
  customerLanguage?: string;
}
