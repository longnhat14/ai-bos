import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { TranslationService } from '../chat/translation.service';
import { CustomersService } from '../customers/customers.service';
import { TelegramBinding } from '../telegram/telegram-binding.entity';
import { TenantsService } from '../tenants/tenants.service';
import { TicketsService } from '../tickets/tickets.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { WebChatMessage, WebChatRole } from './web-chat-message.entity';
import { WebChatControlMode, WebChatSession } from './web-chat-session.entity';

const ESCALATION_DELAY_MS = 15000; // 15 giay - dung theo yeu cau da thong nhat
const AUTO_TRANSLATE_TENANT_CODE = 'remoteit'; // dung nhat quan voi ChatService (RemoteIT mac dinh bat dich)

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
    @InjectRepository(TelegramBinding) private readonly telegramBindingRepo: Repository<TelegramBinding>,
    @InjectQueue('webchat-escalation') private readonly escalationQueue: Queue,
    private readonly tenantsService: TenantsService,
    private readonly customersService: CustomersService,
    private readonly ticketsService: TicketsService,
    private readonly warehouseService: WarehouseService,
    private readonly translationService: TranslationService,
  ) {}

  /**
   * Tao phien webchat moi. autoTranslateEnabled mac dinh THEO TENANT (RemoteIT = bat),
   * giong dung nguyen tac da ap dung cho Chat/WhatsApp - dam bao nhat quan toan he thong.
   */
  async createSession(tenantCode: string, customerLanguage = 'en'): Promise<WebChatSession> {
    const tenant = await this.tenantsService.getByCode(tenantCode);
    const session = this.sessionRepo.create({
      tenantId: tenant.id,
      customerId: null,
      customerLanguage,
      autoTranslateEnabled: tenant.code === AUTO_TRANSLATE_TENANT_CODE,
    });
    return this.sessionRepo.save(session);
  }

  async getHistory(sessionId: string): Promise<WebChatMessage[]> {
    return this.messageRepo.find({ where: { sessionId }, order: { createdAt: 'ASC' } });
  }

  /**
   * Lich su hien thi PHIA KHACH (public) - neu tin nhan cua nhan vien co ban dich,
   * hien ban dich (ngon ngu khach), KHONG hien nguyen van tieng Viet nhan vien go.
   */
  async getCustomerFacingHistory(
    sessionId: string,
  ): Promise<Array<{ id: string; text: string; role: WebChatRole; createdAt: Date }>> {
    const messages = await this.getHistory(sessionId);
    return messages.map((msg) => ({
      id: msg.id,
      text: msg.translatedText ?? msg.text,
      role: msg.role,
      createdAt: msg.createdAt,
    }));
  }

  /**
   * Danh sach TAT CA phien chat cua tenant - dung cho man hinh (sau nay) hoac API
   * de nhan vien thay dang co bao nhieu khach chat, phien nao dang can chu y.
   */
  async findAllSessions(tenantId: string): Promise<WebChatSession[]> {
    return this.sessionRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findSession(tenantId: string, sessionId: string): Promise<WebChatSession> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException('Khong tim thay phien chat');
    return session;
  }

  /**
   * Danh sach TAT CA phien nhan vien nay dang phu trach (da takeover), KEM SO THU TU
   * CO DINH (queueNumber) da gan tu luc takeover - dung cho lenh Telegram "/ds".
   */
  async findMySessions(tenantId: string, staffUserId: string): Promise<WebChatSession[]> {
    return this.sessionRepo.find({
      where: { tenantId, assignedStaffId: staffUserId, controlMode: WebChatControlMode.STAFF },
      order: { queueNumber: 'ASC' },
    });
  }

  /**
   * Chon phien theo SO THU TU CO DINH (queueNumber) - so nay duoc gan 1 LAN DUY NHAT
   * luc takeover(), KHONG PHAI vi tri trong danh sach nen KHONG BAO GIO bi lech du
   * co bao nhieu khach khac takeover sau do (khac hoan toan voi cach danh so theo
   * vi tri/snapshot truoc day). Vi vay KHONG can go /ds truoc - so da co san tu
   * luc canh bao Telegram hien ra.
   */
  async selectSessionByNumber(
    tenantId: string,
    staffUserId: string,
    queueNumber: number,
  ): Promise<WebChatSession> {
    const session = await this.sessionRepo.findOne({
      where: {
        tenantId,
        assignedStaffId: staffUserId,
        controlMode: WebChatControlMode.STAFF,
        queueNumber,
      },
    });

    if (!session) {
      throw new NotFoundException(
        `Không tìm thấy khách số ${queueNumber} trong danh sách bạn phụ trách. Dùng /ds để xem lại.`,
      );
    }

    await this.setActiveSessionForStaff(tenantId, staffUserId, session.id);
    return session;
  }

  /**
   * Dung boi TelegramWebhookController de biet tin nhan tu do cua nhan vien
   * la cau tra loi cho PHIEN NAO - dua vao active_session_id da luu san tren
   * TelegramBinding (KHONG doan "phien gan nhat", vi khi co nhieu khach nhan
   * cung luc, doan mo se gui NHAM cau tra loi cho khach khac).
   */
  async getActiveSessionForStaff(tenantId: string, staffUserId: string): Promise<WebChatSession | null> {
    const binding = await this.telegramBindingRepo.findOne({ where: { tenantId, userId: staffUserId } });
    if (!binding?.activeSessionId) return null;

    return this.sessionRepo.findOne({
      where: {
        id: binding.activeSessionId,
        tenantId,
        assignedStaffId: staffUserId,
        controlMode: WebChatControlMode.STAFF,
      },
    });
  }

  /**
   * Nhan vien chon 1 phien lam "phien dang focus" - dung khi ho go lenh /s <so>
   * tren Telegram de chuyen qua lai giua nhieu khach dang xu ly cung luc.
   */
  async setActiveSessionForStaff(
    tenantId: string,
    staffUserId: string,
    sessionId: string,
  ): Promise<void> {
    await this.findSession(tenantId, sessionId);
    const binding = await this.telegramBindingRepo.findOne({ where: { tenantId, userId: staffUserId } });
    if (binding) {
      binding.activeSessionId = sessionId;
      await this.telegramBindingRepo.save(binding);
    }
  }

  /**
   * Nhan vien "gianh quyen" tu AI - tu day AI SE KHONG con tu dong tra loi trong
   * sendMessage() nua, nhan vien phai tu go tin nhan qua staffReply().
   *
   * Gan SO THU TU CO DINH (queueNumber) cho phien nay dua tren bo dem rieng cua
   * TUNG nhan vien (TelegramBinding.nextQueueNumber) - so nay KHONG BAO GIO doi
   * sau do, dam bao canh bao Telegram + lenh /s <so> luon chinh xac vinh vien,
   * du co bao nhieu khach khac takeover sau (khong con phu thuoc vao thu tu hay
   * "anh chup" danh sach nhu thiet ke truoc).
   *
   * Dong thoi TU DONG dat phien nay thanh "phien dang focus" tren Telegram cua ho.
   */
  async takeover(tenantId: string, sessionId: string, staffUserId: string): Promise<WebChatSession> {
    const session = await this.findSession(tenantId, sessionId);

    let binding = await this.telegramBindingRepo.findOne({ where: { tenantId, userId: staffUserId } });
    const assignedNumber = binding?.nextQueueNumber ?? 1;

    session.controlMode = WebChatControlMode.STAFF;
    session.assignedStaffId = staffUserId;
    session.queueNumber = assignedNumber;
    await this.sessionRepo.save(session);

    if (binding) {
      binding.nextQueueNumber = assignedNumber + 1;
      binding.activeSessionId = sessionId;
      await this.telegramBindingRepo.save(binding);
    }

    return session;
  }

  /** Tra quyen lai cho AI (nhan vien khong con can thiep nua) */
  async releaseToAI(tenantId: string, sessionId: string): Promise<WebChatSession> {
    const session = await this.findSession(tenantId, sessionId);
    session.controlMode = WebChatControlMode.AI;
    session.assignedStaffId = null;
    session.queueNumber = null;
    await this.sessionRepo.save(session);

    const binding = await this.telegramBindingRepo.findOne({
      where: { tenantId, activeSessionId: sessionId },
    });
    if (binding) {
      binding.activeSessionId = null;
      await this.telegramBindingRepo.save(binding);
    }

    return session;
  }

  /**
   * Nhan vien tu go tin nhan gui truc tiep cho khach (sau khi da takeover).
   *
   * NEU session.autoTranslateEnabled = true (RemoteIT mac dinh, hoac PCTech duoc
   * bat rieng), tin nhan se duoc DICH TU DONG sang ngon ngu khach (customerLanguage)
   * truoc khi khach nhin thay - dung Claude API giong het co che da dung cho
   * Chat/WhatsApp truoc day (TranslationService dung chung, khong viet lai).
   */
  async staffReply(
    tenantId: string,
    sessionId: string,
    staffUserId: string,
    text: string,
  ): Promise<WebChatMessage> {
    const session = await this.findSession(tenantId, sessionId);
    if (session.controlMode !== WebChatControlMode.STAFF) {
      throw new NotFoundException(
        'Phien nay chua duoc "gianh quyen" - goi API takeover truoc khi tra loi thu cong',
      );
    }

    let translatedText: string | null = null;
    let translatedLanguage: string | null = null;

    if (session.autoTranslateEnabled && session.customerLanguage !== 'vi') {
      translatedText = await this.translationService.translate(text, 'vi', session.customerLanguage);
      translatedLanguage = session.customerLanguage;
    }

    return this.messageRepo.save(
      this.messageRepo.create({
        tenantId,
        sessionId,
        role: WebChatRole.ASSISTANT,
        text,
        staffId: staffUserId,
        translatedText,
        translatedLanguage,
      }),
    );
  }

  /**
   * Xu ly 1 luot tin nhan cua khach: luu tin nhan (kem anh neu co), goi Claude voi
   * Tool Use (check_inventory, create_ticket), thuc thi tool THAT (khong AI tu bia),
   * roi tra ve cau tra loi cuoi cung cho khach.
   *
   * Neu phien da bi nhan vien "gianh quyen" (control_mode = staff), CHI luu tin nhan
   * cua khach, KHONG goi Claude nua - nhan vien se tu tra loi qua staffReply().
   */
  async sendMessage(
    tenantId: string,
    sessionId: string,
    text: string,
    imageFile?: { path: string; mimeType: string },
  ): Promise<{ reply: string | null; createdTicketId: string | null; awaitingStaff: boolean }> {
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

    if (session.controlMode === WebChatControlMode.STAFF) {
      // Nhan vien da gianh quyen - AI khong tra loi tu dong nua.
      // Dat lich kiem tra sau 15s: neu van chua co nhan vien tra loi, canh bao qua Telegram.
      const customerMessage = await this.messageRepo.findOne({
        where: { tenantId, sessionId, role: WebChatRole.CUSTOMER },
        order: { createdAt: 'DESC' },
      });
      if (customerMessage) {
        await this.escalationQueue.add(
          'check-response',
          {
            tenantId,
            sessionId,
            customerMessageId: customerMessage.id,
            customerMessageText: customerMessage.text,
            customerMessageCreatedAt: customerMessage.createdAt.toISOString(),
            queueNumber: session.queueNumber,
          },
          { delay: ESCALATION_DELAY_MS },
        );
      }

      return { reply: null, createdTicketId: null, awaitingStaff: true };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const fallback = 'Xin loi, tro ly AI hien chua san sang. Vui long lien he truc tiep nhan vien.';
      await this.saveAssistantReply(tenantId, sessionId, fallback);
      return { reply: fallback, createdTicketId: null, awaitingStaff: false };
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
    return { reply: finalReplyText, createdTicketId, awaitingStaff: false };
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
