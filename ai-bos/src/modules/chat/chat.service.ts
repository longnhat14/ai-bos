import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { EventType } from '../../common/event-bus/events';
import { TenantsService } from '../tenants/tenants.service';
import { ChatMessage, SenderType } from './chat-message.entity';
import { Conversation } from './conversation.entity';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';
import { TranslationService } from './translation.service';

// Tenant code duy nhat duoc bat tinh nang dich tu dong - da thong nhat truoc day:
// "Tinh nang dich tu dong chi ap dung cho du an RemoteITFix, khong ap dung cho PCTech"
const AUTO_TRANSLATE_TENANT_CODE = 'remoteit';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation) private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(ChatMessage) private readonly messageRepo: Repository<ChatMessage>,
    private readonly tenantsService: TenantsService,
    private readonly translationService: TranslationService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Quy tac bat/tat dich tu dong:
   * - Mac dinh theo tenant: RemoteIT = bat, cac tenant khac (PCTech...) = tat
   * - CO THE ghi de rieng cho tung conversation qua dto.enableAutoTranslate,
   *   vi du PCTech thinh thoang gap khach nuoc ngoai va muon bat dich cho
   *   dung cuoc hoi thoai do, khong bat mac dinh cho toan bo PCTech.
   */
  async createConversation(tenantId: string, dto: CreateConversationDto): Promise<Conversation> {
    const tenant = await this.tenantsService.getById(tenantId);
    const defaultAutoTranslate = tenant.code === AUTO_TRANSLATE_TENANT_CODE;
    const autoTranslateEnabled = dto.enableAutoTranslate ?? defaultAutoTranslate;

    const conversation = this.conversationRepo.create({
      tenantId,
      ticketId: dto.ticketId ?? null,
      customerId: dto.customerId,
      customerLanguage: dto.customerLanguage || 'en',
      staffLanguage: 'vi',
      autoTranslateEnabled,
    });
    await this.conversationRepo.save(conversation);

    return conversation;
  }

  async findConversation(tenantId: string, id: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({ where: { tenantId, id } });
    if (!conversation) throw new NotFoundException('Khong tim thay cuoc hoi thoai');
    return conversation;
  }

  /**
   * Gui tin nhan - day la noi xu ly dich tu dong.
   *
   * Neu conversation.autoTranslateEnabled = false (vd tenant PCTech), tin nhan
   * duoc luu nguyen ban, translatedText = originalText, KHONG goi Claude API
   * (tranh ton chi phi API khong can thiet cho tenant khong dung tinh nang nay).
   */
  async sendMessage(
    tenantId: string,
    conversationId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessage> {
    const conversation = await this.findConversation(tenantId, conversationId);

    const isFromCustomer = dto.senderType === SenderType.CUSTOMER;
    const sourceLanguage = isFromCustomer ? conversation.customerLanguage : conversation.staffLanguage;
    const targetLanguage = isFromCustomer ? conversation.staffLanguage : conversation.customerLanguage;

    let translatedText = dto.text;
    let translatedLanguage = sourceLanguage;

    if (conversation.autoTranslateEnabled) {
      translatedText = await this.translationService.translate(dto.text, sourceLanguage, targetLanguage);
      translatedLanguage = targetLanguage;
    }

    const message = this.messageRepo.create({
      tenantId,
      conversationId,
      senderType: dto.senderType,
      originalText: dto.text,
      originalLanguage: sourceLanguage,
      translatedText,
      translatedLanguage,
    });
    await this.messageRepo.save(message);

    await this.eventBus.publish(tenantId, EventType.CHAT_MESSAGE_SENT, {
      conversationId,
      messageId: message.id,
      senderType: dto.senderType,
    });

    return message;
  }

  /**
   * Man hinh cua NGUOI TIEP NHAN (staff) - thay CA ban goc va ban da dich,
   * de doi chieu/xac nhan dich dung khong.
   */
  async getMessagesForStaff(tenantId: string, conversationId: string): Promise<ChatMessage[]> {
    await this.findConversation(tenantId, conversationId); // dam bao ton tai + dung tenant
    return this.messageRepo.find({
      where: { tenantId, conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Man hinh cua KHACH HANG - CHI hien ngon ngu cua ho, khong bao gio thay tieng Viet:
   * - Tin nhan chinh khach gui: hien ban goc (dung ngon ngu khach)
   * - Tin nhan cua staff: hien ban DA DICH sang ngon ngu khach (khong hien tieng Viet goc)
   */
  async getMessagesForCustomer(
    tenantId: string,
    conversationId: string,
  ): Promise<Array<{ id: string; text: string; language: string; senderType: SenderType; createdAt: Date }>> {
    const messages = await this.getMessagesForStaff(tenantId, conversationId);

    return messages.map((msg) => {
      const isFromCustomer = msg.senderType === SenderType.CUSTOMER;
      return {
        id: msg.id,
        text: isFromCustomer ? msg.originalText : msg.translatedText,
        language: isFromCustomer ? msg.originalLanguage : msg.translatedLanguage,
        senderType: msg.senderType,
        createdAt: msg.createdAt,
      };
    });
  }
}
