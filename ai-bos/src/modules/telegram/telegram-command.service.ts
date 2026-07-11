import { Injectable, Logger } from '@nestjs/common';
import { DashboardService } from '../dashboard/dashboard.service';
import { TicketsService } from '../tickets/tickets.service';
import { WarehouseService } from '../warehouse/warehouse.service';

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
  ) {}

  async handleCommand(tenantId: string, text: string): Promise<string> {
    const normalized = text.trim().toLowerCase();

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
      `- "tồn kho thấp"`
    );
  }

  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some((k) => text.includes(k));
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  }
}
