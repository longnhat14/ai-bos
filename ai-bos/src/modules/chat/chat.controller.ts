import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { ChatService } from './chat.service';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';

@Controller('api/v1/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  createConversation(@CurrentUser() user: JwtPayload, @Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(user.tenantId, dto);
  }

  // Toan bo hoi thoai WhatsApp/Zalo - dung cho man hinh "hop thu chung" gop
  // chung voi AI Chat Website. Dat TRUOC ':id' vi 'conversations' la path tinh.
  @Get('conversations')
  findAllConversations(@CurrentUser() user: JwtPayload) {
    return this.chatService.findAllConversations(user.tenantId);
  }

  @Get('conversations/:id')
  findConversation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.chatService.findConversation(user.tenantId, id);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.tenantId, id, dto);
  }

  // Man hinh cua nhan vien/ky thuat vien - thay ca ban goc va ban dich
  @Get('conversations/:id/messages/staff-view')
  getMessagesForStaff(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.chatService.getMessagesForStaff(user.tenantId, id);
  }

  // Man hinh cua khach hang - CHI thay ngon ngu cua ho (mo phong giao dien chat phia khach)
  @Get('conversations/:id/messages/customer-view')
  getMessagesForCustomer(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.chatService.getMessagesForCustomer(user.tenantId, id);
  }

  // Nhan vien "nhan xu ly" 1 cuoc hoi thoai WhatsApp - can truoc khi tham gia /s <so> tren Telegram
  @Post('conversations/:id/claim')
  claimConversation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.chatService.claimConversation(user.tenantId, id, user.sub);
  }

  @Post('conversations/:id/release')
  releaseConversation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.chatService.releaseConversation(user.tenantId, id);
  }

  @Get('my-conversations')
  findMyConversations(@CurrentUser() user: JwtPayload) {
    return this.chatService.findMyConversations(user.tenantId, user.sub);
  }
}
