import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { TicketsService } from '../tickets/tickets.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { AIChatService } from '../webchat/ai-chat.service';

/**
 * Xu ly lenh noi bo qua Telegram - RULE-BASED (khong goi Claude API), giong dung
 * nguyen tac da ap dung cho AI Sales: cac truy van co cau truc ro rang (doanh thu,
 * ticket, ton kho...) khong can AI, chi can tra thang du lieu that qua Dashboard/
 * Tickets/Warehouse Service da co san - nhanh hon, khong ton chi phi API.
 *
 * Day chinh la tinh nang "AI CEO" da mo ta tu dau du an: chu doanh nghiep hoi
 * nhanh "Hom nay co gi?" qua Telegram thay vi mo web.
 */
@Injectable()
export class TelegramCommandService {
  private readonly logger = new Logger(TelegramCommandService.name);

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly ticketsService: TicketsService,
    private readonly warehouseService: WarehouseService,
    @Inject(forwardRef(() => AIChatService)) private readonly aiChatService: AIChatService,
    @Inject(forwardRef(() => ChatService)) private readonly chatService: ChatService,
  ) {}

  async handleCommand(tenantId: string, text: string, staffUserId: string): Promise<string> {
    const normalized = text.trim().toLowerCase();

    if (normalized === '/ds') {
      return this.handleListSessions(tenantId, staffUserId);
    }

    if (normalized === '/s' || normalized.startsWith('/s ')) {
      return this.handleSelectSession(tenantId, staffUserId, normalized);
    }

    if (normalized.startsWith('/claim')) {
      return this.handleClaimConversation(tenantId, staffUserId, normalized);
    }

    if (this.matchesAny(normalized, ['doanh thu', 'revenue'])) {
      return this.handleRevenue(tenantId);
    }

    if (this.matchesAny(normalized, ['ticket', 'sua chua'])) {
      return this.handleTickets(tenantId);
    }

    if (this.matchesAny(normalized, ['ton kho', 'kho', 'inventory', 'stock'])) {
      return this.handleLowStock(tenantId);
    }

    return this.handleHelp();
  }

  /**
   * Nhan xu ly 1 cuoc hoi thoai WhatsApp CHUA CO AI phu trach - dua vao ma ngan
   * (8 ky tu dau cua conversation id) da hien trong canh bao "khach WhatsApp moi".
   */
  private async handleClaimConversation(
    tenantId: string,
    staffUserId: string,
    normalized: string,
  ): Promise<string> {
    const shortId = normalized.replace('/claim', '').trim();
    if (!shortId) {
      return 'Vui lòng dùng đúng cú pháp: <code>/claim &lt;mã&gt;</code> (xem mã trong thông báo khách mới).';
    }

    // Tim conversation theo ma ngan trong danh sach cua tenant (khong the query
    // truc tiep theo prefix ID qua repository don gian, nen duyet qua findAllSessions
    // tuong duong - o day dung tam findMyConversations voi staffUserId rong de lay
    // tat ca chua ai nhan, don gian hoa bang cach goi ham rieng trong ChatService).
    try {
      const conversation = await this.chatService.claimConversationByShortId(tenantId, shortId, staffUserId);
      return `✅ Đã nhận xử lý, bạn là khách số ${conversation.queueNumber}. Gõ tin nhắn tự do để trả lời ngay.`;
    } catch (err) {
      return err.message || 'Không tìm thấy cuộc hội thoại này, kiểm tra lại mã.';
    }
  }

  /**
   * Liet ke cac khach nhan vien nay dang phu trach, hien DUNG so thu tu CO DINH
   * (queueNumber) da gan tu luc takeover/claim - day chi la lenh XEM LAI TUY CHON,
   * KHONG BAT BUOC phai go truoc /s <so> nua (so da co san tu luc canh bao Telegram).
   * Gom CA WebChat lan WhatsApp vi dung chung 1 day so.
   */
  private async handleListSessions(tenantId: string, staffUserId: string): Promise<string> {
    const [webSessions, conversations] = await Promise.all([
      this.aiChatService.findMySessions(tenantId, staffUserId),
      this.chatService.findMyConversations(tenantId, staffUserId),
    ]);

    const lines = [
      ...webSessions.map((s) => `${s.queueNumber}. Khách Website (cập nhật ${s.updatedAt.toLocaleTimeString('vi-VN')})`),
      ...conversations.map((c) => `${c.queueNumber}. Khách WhatsApp (cập nhật ${c.updatedAt.toLocaleTimeString('vi-VN')})`),
    ].sort();

    if (lines.length === 0) {
      return '📭 Bạn hiện không phụ trách khách nào.';
    }

    return (
      `📋 <b>Các khách bạn đang phụ trách</b>\n${lines.join('\n')}\n\n` +
      `Dùng lệnh <code>/s &lt;số&gt;</code> để chọn khách muốn trả lời tiếp theo (vd: <code>/s 2</code>).`
    );
  }

  /**
   * Chon khach theo SO THU TU CO DINH - so nay duoc gan 1 LAN DUY NHAT luc
   * takeover/claim, KHONG PHAI vi tri trong danh sach. Thu WebChat truoc, neu
   * khong thay thi thu WhatsApp (vi dung chung 1 day so nen chi 1 trong 2 co
   * dung so nay tai 1 thoi diem).
   */
  private async handleSelectSession(
    tenantId: string,
    staffUserId: string,
    normalized: string,
  ): Promise<string> {
    const arg = normalized.replace('/s', '').trim();
    const queueNumber = parseInt(arg, 10);

    if (!arg || isNaN(queueNumber) || queueNumber < 1) {
      return 'Vui lòng dùng đúng cú pháp: <code>/s &lt;số&gt;</code> (vd: <code>/s 2</code>). Xem danh sách qua lệnh /ds nếu quên số.';
    }

    try {
      await this.aiChatService.selectSessionByNumber(tenantId, staffUserId, queueNumber);
      return `✅ Đã chuyển sang trả lời khách số ${queueNumber} (Website). Tin nhắn tiếp theo bạn gõ sẽ gửi cho khách này.`;
    } catch {
      // Khong thay o WebChat, thu WhatsApp
    }

    try {
      await this.chatService.selectConversationByNumber(tenantId, staffUserId, queueNumber);
      return `✅ Đã chuyển sang trả lời khách số ${queueNumber} (WhatsApp). Tin nhắn tiếp theo bạn gõ sẽ gửi cho khách này.`;
    } catch (err) {
      return err.message || 'Không thể chọn khách này, vui lòng thử /ds để xem lại danh sách.';
    }
  }

  private async handleRevenue(tenantId: string): Promise<string> {
    const overview = await this.dashboardService.getOverview(tenantId);
    return (
      `📊 <b>Doanh thu</b>\n` +
      `Hôm nay: ${this.formatCurrency(overview.revenueToday)}\n` +
      `Tháng này: ${this.formatCurrency(overview.revenueThisMonth)}`
    );
  }

  private async handleTickets(tenantId: string): Promise<string> {
    const overview = await this.dashboardService.getOverview(tenantId);
    return (
      `🎫 <b>Ticket</b>\n` +
      `Đang mở: ${overview.openTickets}\n` +
      `Đã đóng hôm nay: ${overview.closedTicketsToday}`
    );
  }

  private async handleLowStock(tenantId: string): Promise<string> {
    const items = await this.warehouseService.findLowStock(tenantId);
    if (items.length === 0) {
      return '📦 <b>Tồn kho</b>\nKhông có linh kiện nào sắp hết hàng.';
    }
    const lines = items
      .map((i) => `- ${i.name} (${i.sku}): còn ${i.quantityOnHand}, ngưỡng ${i.lowStockThreshold}`)
      .join('\n');
    return `📦 <b>Cảnh báo tồn kho thấp</b>\n${lines}`;
  }

  private handleHelp(): string {
    return (
      `🤖 <b>AI BOS - Trợ lý nội bộ</b>\n\n` +
      `Bạn có thể hỏi:\n` +
      `- "doanh thu hôm nay"\n` +
      `- "ticket đang mở"\n` +
      `- "tồn kho thấp"\n\n` +
      `Khi có khách chờ trả lời:\n` +
      `- Cảnh báo tự động sẽ báo sẵn số thứ tự của khách, gõ <code>/s &lt;số&gt;</code> để trả lời ngay (vd: /s 2)\n` +
      `- <code>/ds</code> - xem lại danh sách khách đang phụ trách (không bắt buộc, chỉ khi cần xem tổng quan)`
    );
  }

  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some((k) => text.includes(k));
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  }
}
