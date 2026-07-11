import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomersService } from '../customers/customers.service';
import { TenantsService } from '../tenants/tenants.service';
import { TicketsService } from '../tickets/tickets.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { WebChatMessage, WebChatRole } from './web-chat-message.entity';
import { WebChatSession } from './web-chat-session.entity';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CHAT_MODEL = 'claude-sonnet-5'; // can suy luan tot hon Haiku vi phai dieu phoi tool-calling + hoi thoai tu nhien
const MAX_TOOL_ROUNDS = 3; // gioi han so vong goi tool lien tiep, tranh vong lap vo han

const TOOLS = [
  {
    name: 'check_inventory',
    description:
      'Tra cuu ton kho va gia THAT tu he thong (khong duoc tu doan gia/so luong). Dung khi khach hoi ve san pham, linh kien, gia ca, con hang khong.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Ten hoac tu khoa san pham can tim, vd "RAM 8GB"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_ticket',
    description:
      'Tao ticket sua chua THAT trong he thong. CHI goi tool nay SAU KHI khach da xac nhan ro rang (vd tra loi "co", "dong y", "xac nhan") - KHONG tu y goi truoc khi khach dong y.',
    input_schema: {
      type: 'object',
      properties: {
        customerName: { type: 'string' },
        customerPhone: { type: 'string' },
        issueDescription: { type: 'string' },
        deviceType: { type: 'string' },
      },
      required: ['customerName', 'customerPhone', 'issueDescription'],
    },
  },
];

const SYSTEM_PROMPT = `Ban la tro ly AI tu van khach hang tren website cua mot tiem sua chua may tinh (PCTech/RemoteIT).

Quy tac BAT BUOC:
- KHONG BAO GIO tu bia gia hoac so luong ton kho - LUON goi tool "check_inventory" de lay du lieu that.
- Khi khach muon tao ticket sua chua, HOI xin ten va so dien thoai truoc (neu chua co), TOM TAT lai yeu cau va HOI KHACH XAC NHAN ro rang truoc khi goi tool "create_ticket". Khong duoc tu y tao ticket khi khach chua dong y.
- Neu khach gui kem anh, hay quan sat ky (man hinh loi, hu hong vat ly...) va phan hoi dua tren nhung gi thay duoc trong anh.
- Tra loi ngan gon, than thien, bang dung ngon ngu khach dang dung (tieng Viet hoac tieng Anh).`;

@Injectable()
export class AIChatService {
  private readonly logger = new Logger(AIChatService.name);

  constructor(
    @InjectRepository(WebChatSession) private readonly sessionRepo: Repository<WebChatSession>,
    @InjectRepository(WebChatMessage) private readonly messageRepo: Repository<WebChatMessage>,
    private readonly tenantsService: TenantsService,
    private readonly customersService: CustomersService,
    private readonly ticketsService: TicketsService,
    private readonly warehouseService: WarehouseService,
  ) {}

  async createSession(tenantCode: string): Promise<WebChatSession> {
    const tenant = await this.tenantsService.getByCode(tenantCode);
    const session = this.sessionRepo.create({ tenantId: tenant.id, customerId: null });
    return this.sessionRepo.save(session);
  }

  async getHistory(sessionId: string): Promise<WebChatMessage[]> {
    return this.messageRepo.find({ where: { sessionId }, order: { createdAt: 'ASC' } });
  }

  /**
   * Xu ly 1 luot tin nhan cua khach: luu tin nhan (kem anh neu co), goi Claude voi
   * Tool Use (check_inventory, create_ticket), thuc thi tool THAT (khong AI tu bia),
   * roi tra ve cau tra loi cuoi cung cho khach.
   */
  async sendMessage(
    tenantId: string,
    sessionId: string,
    text: string,
    imageFile?: { path: string; mimeType: string },
  ): Promise<{ reply: string; createdTicketId: string | null }> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException('Khong tim thay phien chat');

    await this.messageRepo.save(
      this.messageRepo.create({
        tenantId,
        sessionId,
        role: WebChatRole.CUSTOMER,
        text,
        imagePath: imageFile?.path ?? null,
        imageMimeType: imageFile?.mimeType ?? null,
      }),
    );

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const fallback = 'Xin loi, tro ly AI hien chua san sang. Vui long lien he truc tiep nhan vien.';
      await this.saveAssistantReply(tenantId, sessionId, fallback);
      return { reply: fallback, createdTicketId: null };
    }

    const history = await this.getHistory(sessionId);
    const messages = await this.buildMessagesForClaude(history);

    let createdTicketId: string | null = null;
    let finalReplyText = '';

    try {
      let round = 0;
      let currentMessages = messages;

      while (round < MAX_TOOL_ROUNDS) {
        const response = await this.callClaude(apiKey, currentMessages);

        if (response.stop_reason !== 'tool_use') {
          finalReplyText = response.content.find((b: any) => b.type === 'text')?.text || '';
          break;
        }

        // Xu ly tung tool_use block - goi THAT vao service, khong de AI tu bia ket qua
        const toolResults: any[] = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          const result = await this.executeTool(tenantId, block.name, block.input);
          if (block.name === 'create_ticket' && result.ticketId) {
            createdTicketId = result.ticketId;
            session.createdTicketId = result.ticketId;
            await this.sessionRepo.save(session);
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }

        currentMessages = [
          ...currentMessages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults },
        ];
        round++;
      }

      if (!finalReplyText) {
        finalReplyText = 'Xin loi, minh can them thong tin de ho tro ban tot hon.';
      }
    } catch (err) {
      this.logger.error(`Loi AI Chat: ${err.message}`);
      finalReplyText = 'Xin loi, da co loi xay ra. Vui long thu lai hoac lien he truc tiep nhan vien.';
    }

    await this.saveAssistantReply(tenantId, sessionId, finalReplyText);
    return { reply: finalReplyText, createdTicketId };
  }

  private async executeTool(tenantId: string, toolName: string, input: any): Promise<any> {
    if (toolName === 'check_inventory') {
      const items = await this.warehouseService.findAll(tenantId);
      const matched = items.filter((i) =>
        i.name.toLowerCase().includes(String(input.query).toLowerCase()),
      );
      return {
        results: matched.map((i) => ({
          name: i.name,
          sku: i.sku,
          sellPrice: Number(i.sellPrice),
          quantityOnHand: i.quantityOnHand,
          inStock: i.quantityOnHand > 0,
        })),
      };
    }

    if (toolName === 'create_ticket') {
      let customer = await this.customersService.findByPhone(tenantId, input.customerPhone);
      if (!customer) {
        customer = await this.customersService.create(tenantId, {
          fullName: input.customerName,
          phone: input.customerPhone,
        });
      }

      const ticket = await this.ticketsService.create(tenantId, {
        customerId: customer.id,
        issueDescription: input.issueDescription,
        deviceType: input.deviceType,
      });

      return { ticketId: ticket.id, ticketCode: ticket.ticketCode, status: 'created' };
    }

    return { error: `Khong ho tro tool: ${toolName}` };
  }

  private async callClaude(apiKey: string, messages: any[]): Promise<any> {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API tra ve loi ${response.status}: ${errorBody}`);
    }

    return response.json();
  }

  private async buildMessagesForClaude(history: WebChatMessage[]): Promise<any[]> {
    const fs = await import('fs/promises');
    const messages: any[] = [];

    for (const msg of history) {
      if (msg.role === WebChatRole.ASSISTANT) {
        messages.push({ role: 'assistant', content: msg.text });
        continue;
      }

      const contentBlocks: any[] = [{ type: 'text', text: msg.text }];
      if (msg.imagePath && msg.imageMimeType) {
        try {
          const buffer = await fs.readFile(msg.imagePath);
          contentBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: msg.imageMimeType, data: buffer.toString('base64') },
          });
        } catch (err) {
          this.logger.warn(`Khong doc duoc anh ${msg.imagePath}: ${err.message}`);
        }
      }
      messages.push({ role: 'user', content: contentBlocks });
    }

    return messages;
  }

  private async saveAssistantReply(tenantId: string, sessionId: string, text: string): Promise<void> {
    await this.messageRepo.save(
      this.messageRepo.create({ tenantId, sessionId, role: WebChatRole.ASSISTANT, text }),
    );
  }
}
