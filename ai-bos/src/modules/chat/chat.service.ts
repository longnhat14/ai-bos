import { InjectQueue } from '@nestjs/bullmq';
import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { In, Repository } from 'typeorm';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { EventType } from '../../common/event-bus/events';
import { ActiveChannelType, TelegramBinding } from '../telegram/telegram-binding.entity';
import { TelegramChannel } from '../telegram/telegram-channel.service';
import { TenantsService } from '../tenants/tenants.service';
import { WhatsAppChannel } from '../whatsapp/whatsapp-channel.service';
import { ZaloChannel } from '../zalo/zalo-channel.service';
import { MessengerChannel } from '../messenger/messenger-channel.service';
import { ChatMessage, SenderType } from './chat-message.entity';
import { Conversation, ConversationChannel } from './conversation.entity';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';
import { TranslationService } from './translation.service';

// Tenant code duy nhat duoc bat tinh nang dich tu dong theo mac dinh - da thong nhat truoc day:
// "Mac dinh BAT cho RemoteIT, mac dinh TAT cho PCTech - nhung co the bat rieng tung conversation"
const AUTO_TRANSLATE_TENANT_CODE = 'remoteit';
const ESCALATION_DELAY_MS = 15000; // dung chung 15s voi WebChat, xem webchat-escalation.processor.ts

/** Ten hien thi cho kenh ngoai - dung chung, tranh lap ternary nhieu nhanh o nhieu noi. */
function getChannelDisplayLabel(channel: ConversationChannel): string {
  switch (channel) {
    case ConversationChannel.ZALO:
      return 'Zalo';
    case ConversationChannel.MESSENGER:
      return 'Messenger';
    case ConversationChannel.WHATSAPP:
    default:
      return 'WhatsApp';
  }
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation) private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(ChatMessage) private readonly messageRepo: Repository<ChatMessage>,
    @InjectRepository(TelegramBinding) private readonly telegramBindingRepo: Repository<TelegramBinding>,
    @InjectQueue('webchat-escalation') private readonly escalationQueue: Queue,
    private readonly tenantsService: TenantsService,
    private readonly translationService: TranslationService,
    @Inject(forwardRef(() => WhatsAppChannel)) private readonly whatsAppChannel: WhatsAppChannel,
    @Inject(forwardRef(() => ZaloChannel)) private readonly zaloChannel: ZaloChannel,
    @Inject(forwardRef(() => MessengerChannel)) private readonly messengerChannel: MessengerChannel,
    @Inject(forwardRef(() => TelegramChannel)) private readonly telegramChannel: TelegramChannel,
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
      channel: ConversationChannel.INTERNAL, // tao qua API luon la "internal" - WhatsApp tao qua findOrCreateForWhatsApp
    });
    await this.conversationRepo.save(conversation);

    return conversation;
  }

  /**
   * Dung boi WhatsAppWebhookController khi co tin nhan WhatsApp MOI den ma chua tung
   * co cuoc hoi thoai nao gan voi so dien thoai nay - tu dong tao 1 conversation
   * voi channel = whatsapp, danh dau externalContactId = so dien thoai WhatsApp.
   */
  async findOrCreateForWhatsApp(
    tenantId: string,
    customerId: string,
    phoneNumber: string,
  ): Promise<Conversation> {
    const existing = await this.conversationRepo.findOne({
      where: {
        tenantId,
        customerId,
        channel: ConversationChannel.WHATSAPP,
        externalContactId: phoneNumber,
      },
    });
    if (existing) return existing;

    const tenant = await this.tenantsService.getById(tenantId);
    const conversation = this.conversationRepo.create({
      tenantId,
      customerId,
      customerLanguage: 'en', // mac dinh tieng Anh cho khach WhatsApp quoc te (Sprint sau co the tu dong nhan dien)
      staffLanguage: 'vi',
      autoTranslateEnabled: tenant.code === AUTO_TRANSLATE_TENANT_CODE,
      channel: ConversationChannel.WHATSAPP,
      externalContactId: phoneNumber,
    });
    return this.conversationRepo.save(conversation);
  }

  /**
   * Dung boi ZaloWebhookController khi co tin nhan Zalo MOI den - tu dong tao
   * 1 conversation voi channel = zalo. Khac WhatsApp (mac dinh dich cho RemoteIT),
   * Zalo mac dinh KHONG dich (khach Viet Nam, khong can dich) - dung nguyen tac
   * kien truc kenh da thong nhat: "Zalo OA: khach hang Viet Nam".
   */
  async findOrCreateForZalo(
    tenantId: string,
    customerId: string,
    zaloUserId: string,
  ): Promise<Conversation> {
    const existing = await this.conversationRepo.findOne({
      where: {
        tenantId,
        customerId,
        channel: ConversationChannel.ZALO,
        externalContactId: zaloUserId,
      },
    });
    if (existing) return existing;

    const conversation = this.conversationRepo.create({
      tenantId,
      customerId,
      customerLanguage: 'vi', // khach Zalo mac dinh tieng Viet
      staffLanguage: 'vi',
      autoTranslateEnabled: false, // mac dinh TAT - PCTech co the bat rieng qua enableAutoTranslate neu gap khach nuoc ngoai
      channel: ConversationChannel.ZALO,
      externalContactId: zaloUserId,
    });
    return this.conversationRepo.save(conversation);
  }

  /**
   * Dung boi MessengerWebhookController - tuong tu Zalo (mac dinh PCTech, khong
   * dich tu dong vi gia dinh khach Viet Nam) - co the bat rieng qua enableAutoTranslate
   * neu PCTech gap khach nuoc ngoai nhan tin qua Facebook Page.
   */
  async findOrCreateForMessenger(
    tenantId: string,
    customerId: string,
    messengerPsid: string,
  ): Promise<Conversation> {
    const existing = await this.conversationRepo.findOne({
      where: {
        tenantId,
        customerId,
        channel: ConversationChannel.MESSENGER,
        externalContactId: messengerPsid,
      },
    });
    if (existing) return existing;

    const conversation = this.conversationRepo.create({
      tenantId,
      customerId,
      customerLanguage: 'vi',
      staffLanguage: 'vi',
      autoTranslateEnabled: false,
      channel: ConversationChannel.MESSENGER,
      externalContactId: messengerPsid,
    });
    return this.conversationRepo.save(conversation);
  }

  async findConversation(tenantId: string, id: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({ where: { tenantId, id } });
    if (!conversation) throw new NotFoundException('Khong tim thay cuoc hoi thoai');
    return conversation;
  }

  /**
   * Nhan xu ly 1 cuoc hoi thoai WhatsApp CHUA CO AI phu trach, tim theo MA NGAN
   * (8 ky tu dau cua ID) - vi canh bao Telegram chi hien ma ngan de gon gang.
   */
  async claimConversationByShortId(
    tenantId: string,
    shortId: string,
    staffUserId: string,
  ): Promise<Conversation> {
    const candidates = await this.conversationRepo.find({
      where: [
        { tenantId, channel: ConversationChannel.WHATSAPP },
        { tenantId, channel: ConversationChannel.ZALO },
        { tenantId, channel: ConversationChannel.MESSENGER },
      ],
    });
    const matched = candidates.find((c) => c.id.startsWith(shortId) && !c.assignedStaffId);

    if (!matched) {
      throw new NotFoundException(
        `Không tìm thấy cuộc hội thoại chưa nhận nào khớp với mã "${shortId}".`,
      );
    }

    return this.claimConversation(tenantId, matched.id, staffUserId);
  }

  /**
   * Nhan vien "nhan xu ly" 1 cuoc hoi thoai WhatsApp qua Telegram - KHAC voi WebChat
   * (luon co AI xu ly truoc), Conversation KHONG CO AI nen buoc nay BAT BUOC truoc
   * khi tham gia co che /s <so>. Dung CHUNG bo dem so thu tu voi WebChatSession
   * (TelegramBinding.nextQueueNumber) - nhan vien chi can nho 1 day so duy nhat.
   */
  async claimConversation(tenantId: string, conversationId: string, staffUserId: string): Promise<Conversation> {
    const conversation = await this.findConversation(tenantId, conversationId);

    let binding = await this.telegramBindingRepo.findOne({ where: { tenantId, userId: staffUserId } });
    const assignedNumber = binding?.nextQueueNumber ?? 1;

    conversation.assignedStaffId = staffUserId;
    conversation.queueNumber = assignedNumber;
    await this.conversationRepo.save(conversation);

    if (binding) {
      binding.nextQueueNumber = assignedNumber + 1;
      binding.activeSessionId = conversationId;
      binding.activeChannelType = ActiveChannelType.WHATSAPP;
      await this.telegramBindingRepo.save(binding);
    }

    return conversation;
  }

  async releaseConversation(tenantId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.findConversation(tenantId, conversationId);
    conversation.assignedStaffId = null;
    conversation.queueNumber = null;
    await this.conversationRepo.save(conversation);

    const binding = await this.telegramBindingRepo.findOne({
      where: { tenantId, activeSessionId: conversationId, activeChannelType: ActiveChannelType.WHATSAPP },
    });
    if (binding) {
      binding.activeSessionId = null;
      binding.activeChannelType = null;
      await this.telegramBindingRepo.save(binding);
    }

    return conversation;
  }

  /**
   * Gui tin nhan - day la noi xu ly dich tu dong VA gui that ra kenh ben ngoai.
   *
   * Neu conversation.autoTranslateEnabled = false (vd tenant PCTech), tin nhan
   * duoc luu nguyen ban, translatedText = originalText, KHONG goi Claude API.
   *
   * Neu conversation.channel = whatsapp VA nguoi gui la STAFF, sau khi dich xong
   * se GUI THAT tin nhan da dich toi khach qua WhatsAppChannel - day la diem
   * ket noi giua he thong chat noi bo va kenh WhatsApp that.
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

    // Neu la tin nhan cua staff tren 1 cuoc hoi thoai kenh ngoai (WhatsApp/Zalo/Messenger) -> gui THAT ra ngoai cho khach
    if (!isFromCustomer && conversation.externalContactId) {
      if (conversation.channel === ConversationChannel.WHATSAPP) {
        await this.whatsAppChannel.send(
          { externalId: conversation.externalContactId },
          { text: translatedText },
        );
      } else if (conversation.channel === ConversationChannel.ZALO) {
        await this.zaloChannel.send(
          { externalId: conversation.externalContactId },
          { text: translatedText },
        );
      } else if (conversation.channel === ConversationChannel.MESSENGER) {
        await this.messengerChannel.send(
          { externalId: conversation.externalContactId },
          { text: translatedText },
        );
      }
    }

    // Canh bao qua Telegram khi khach nhan tin (CHI ap dung kenh ben ngoai - WhatsApp/Zalo/Messenger -
    // vi cac kenh nay khong co AI tu tra loi nhu WebChat, nen luon can nguoi that xu ly):
    const isExternalChannel =
      conversation.channel === ConversationChannel.WHATSAPP ||
      conversation.channel === ConversationChannel.ZALO ||
      conversation.channel === ConversationChannel.MESSENGER;

    if (isFromCustomer && isExternalChannel) {
      if (!conversation.assignedStaffId) {
        // Chua ai "nhan xu ly" cuoc hoi thoai nay - bao NGAY cho TAT CA nhan vien
        // da lien ket Telegram cua tenant, kem lenh /claim de nhan xu ly.
        await this.notifyUnclaimedConversation(tenantId, conversation, dto.text);
      } else {
        // Da co nguoi nhan - dat lich kiem tra sau 15s giong het co che cua WebChat.
        await this.escalationQueue.add(
          'check-response',
          {
            entityType: 'whatsapp', // dung chung nhan nay cho ca WhatsApp va Zalo - xem ghi chu trong webchat-escalation.processor.ts
            channelLabel: getChannelDisplayLabel(conversation.channel),
            tenantId,
            sessionId: conversationId,
            customerMessageId: message.id,
            customerMessageText: dto.text,
            customerMessageCreatedAt: message.createdAt.toISOString(),
          },
          { delay: ESCALATION_DELAY_MS },
        );
      }
    }

    return message;
  }

  private async notifyUnclaimedConversation(
    tenantId: string,
    conversation: Conversation,
    customerText: string,
  ): Promise<void> {
    const bindings = await this.telegramBindingRepo.find({ where: { tenantId } });
    if (bindings.length === 0) {
      this.logger.warn(`Khong co Telegram binding nao de bao khach moi (tenant ${tenantId})`);
      return;
    }

    const channelLabel = getChannelDisplayLabel(conversation.channel);
    const shortId = conversation.id.slice(0, 8);
    const alertText =
      `📲 <b>Khách ${channelLabel} mới nhắn, chưa ai nhận xử lý!</b>\n\n` +
      `Tin nhắn: "${customerText}"\n\n` +
      `👉 Gõ <code>/claim ${shortId}</code> để nhận xử lý cuộc hội thoại này.`;

    for (const binding of bindings) {
      await this.telegramChannel.send({ externalId: binding.telegramChatId }, { text: alertText });
    }
  }

  /**
   * Danh sach cac cuoc hoi thoai WhatsApp nhan vien nay dang phu trach - dung cho /ds.
   */
  async findMyConversations(tenantId: string, staffUserId: string): Promise<Conversation[]> {
    return this.conversationRepo.find({
      where: { tenantId, assignedStaffId: staffUserId },
      order: { queueNumber: 'ASC' },
    });
  }

  // Xem TOAN BO cuoc hoi thoai (khong loc theo nhan vien) - dung cho man hinh
  // "hop thu chung" gop ca WhatsApp/Zalo voi AI Chat Website, giup nhan vien
  // thay duoc CA cac cuoc hoi thoai CHUA AI NHAN (khac findMyConversations
  // chi thay cua rieng minh).
  async findAllConversations(tenantId: string): Promise<Conversation[]> {
    return this.conversationRepo.find({
      where: { tenantId, channel: In([ConversationChannel.WHATSAPP, ConversationChannel.ZALO, ConversationChannel.MESSENGER]) },
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * Chon cuoc hoi thoai WhatsApp theo SO THU TU CO DINH (dung chung bo dem voi
   * WebChatSession) - giong het nguyen tac AIChatService.selectSessionByNumber.
   */
  async selectConversationByNumber(
    tenantId: string,
    staffUserId: string,
    queueNumber: number,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({
      where: { tenantId, assignedStaffId: staffUserId, queueNumber },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Không tìm thấy khách WhatsApp số ${queueNumber} trong danh sách bạn phụ trách.`,
      );
    }

    const binding = await this.telegramBindingRepo.findOne({ where: { tenantId, userId: staffUserId } });
    if (binding) {
      binding.activeSessionId = conversation.id;
      binding.activeChannelType = ActiveChannelType.WHATSAPP;
      await this.telegramBindingRepo.save(binding);
    }

    return conversation;
  }

  /** Dung boi TelegramWebhookController khi active_channel_type = whatsapp */
  async getActiveConversationForStaff(tenantId: string, staffUserId: string): Promise<Conversation | null> {
    const binding = await this.telegramBindingRepo.findOne({ where: { tenantId, userId: staffUserId } });
    if (!binding?.activeSessionId || binding.activeChannelType !== ActiveChannelType.WHATSAPP) return null;

    return this.conversationRepo.findOne({
      where: { id: binding.activeSessionId, tenantId, assignedStaffId: staffUserId },
    });
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
