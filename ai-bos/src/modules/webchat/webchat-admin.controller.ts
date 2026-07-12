import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { AIChatService } from './ai-chat.service';

/**
 * Endpoint danh cho NHAN VIEN (co JWT) de giam sat va can thiep cac phien
 * AI Chat Website - khac voi WebChatController (public, danh cho khach vang lai).
 *
 * Day la "API giam sat webchat" da thong nhat: chuan bi san du lieu/logic,
 * CHUA co giao dien - nhan vien van phai goi API truc tiep (Postman/curl)
 * cho den khi co Admin Frontend that.
 */
@Controller('api/v1/webchat')
@UseGuards(JwtAuthGuard)
export class WebChatAdminController {
  constructor(private readonly aiChatService: AIChatService) {}

  // Liet ke tat ca phien chat cua tenant - nhan vien thay dang co bao nhieu khach dang chat
  @Get('sessions')
  findAllSessions(@CurrentUser() user: JwtPayload) {
    return this.aiChatService.findAllSessions(user.tenantId);
  }

  // Xem chi tiet 1 phien - giong endpoint public nhung yeu cau dang nhap
  @Get('sessions/:id')
  async getSessionDetail(@CurrentUser() user: JwtPayload, @Param('id') sessionId: string) {
    const session = await this.aiChatService.findSession(user.tenantId, sessionId);
    const messages = await this.aiChatService.getHistory(sessionId);
    return { session, messages };
  }

  // "Gianh quyen" tu AI - AI se ngung tu dong tra loi trong phien nay
  @Post('sessions/:id/takeover')
  takeover(@CurrentUser() user: JwtPayload, @Param('id') sessionId: string) {
    return this.aiChatService.takeover(user.tenantId, sessionId, user.sub);
  }

  // Tra quyen lai cho AI (nhan vien khong con can thiep nua)
  @Post('sessions/:id/release')
  release(@CurrentUser() user: JwtPayload, @Param('id') sessionId: string) {
    return this.aiChatService.releaseToAI(user.tenantId, sessionId);
  }

  // Nhan vien tu go tin nhan gui truc tiep cho khach (BAT BUOC da takeover truoc)
  @Post('sessions/:id/reply')
  staffReply(
    @CurrentUser() user: JwtPayload,
    @Param('id') sessionId: string,
    @Body('text') text: string,
  ) {
    return this.aiChatService.staffReply(user.tenantId, sessionId, user.sub, text);
  }
}
