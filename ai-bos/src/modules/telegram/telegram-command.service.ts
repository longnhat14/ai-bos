import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
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
  ) {}

  async handleCommand(tenantId: string, text: string, staffUserId: string): Promise<string> {
    const normalized = text.trim().toLowerCase();

    if (normalized === '/ds') {
      return this.handleListSessions(tenantId, staffUserId);
    }

    if (normalized === '/s' || normalized.startsWith('/s ')) {
      return this.handleSelectSession(tenantId, staffUserId, normalized);
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
   * Liet ke cac khach nhan vien nay dang phu trach, hien DUNG so thu tu CO DINH
   * (queueNumber) da gan tu luc takeover - day chi la lenh XEM LAI TUY CHON, KHONG
   * BAT BUOC phai go truoc /s <so> nua (so da co san tu luc canh bao Telegram).
   */
  private async handleListSessions(tenantId: string, staffUserId: string): Promise<string> {
    const sessions = await this.aiChatService.findMySessions(tenantId, staffUserId);
    if (sessions.length === 0) {
      return '📭 Bạn hiện không phụ trách phiên chat nào.';
    }

    const lines = sessions.map(
      (s) => `${s.queueNumber}. Khách (cập nhật ${s.updatedAt.toLocaleTimeString('vi-VN')})`,
    );
    return (
      `📋 <b>Các khách bạn đang phụ trách</b>\n${lines.join('\n')}\n\n` +
      `Dùng lệnh <code>/s &lt;số&gt;</code> để chọn khách muốn trả lời tiếp theo (vd: <code>/s 2</code>).`
    );
  }

  /**
   * Chon khach theo SO THU TU CO DINH - so nay duoc gan 1 LAN DUY NHAT luc takeover,
   * KHONG PHAI vi tri trong danh sach, nen luon dung du co khach moi takeover sau do.
   * KHONG BAT BUOC phai go /ds truoc - so da hien san trong canh bao Telegram.
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
      return `✅ Đã chuyển sang trả lời khách số ${queueNumber}. Tin nhắn tiếp theo bạn gõ sẽ gửi cho khách này.`;
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
