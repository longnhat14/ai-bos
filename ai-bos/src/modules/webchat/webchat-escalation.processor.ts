import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { MoreThan, Repository } from 'typeorm';
import { ChatMessage, SenderType } from '../chat/chat-message.entity';
import { Conversation } from '../chat/conversation.entity';
import { TelegramBinding } from '../telegram/telegram-binding.entity';
import { TelegramChannel } from '../telegram/telegram-channel.service';
import { WebChatMessage, WebChatRole } from './web-chat-message.entity';
import { WebChatSession } from './web-chat-session.entity';

export interface EscalationJobData {
  entityType?: 'webchat' | 'whatsapp'; // mac dinh 'webchat' neu khong khai bao (tuong thich nguoc)
  tenantId: string;
  sessionId: string; // la WebChatSession.id neu webchat, Conversation.id neu whatsapp
  customerMessageId: string;
  customerMessageText: string;
  customerMessageCreatedAt: string; // ISO string (BullMQ serialize JSON, khong giu duoc Date object)
}

/**
 * Sau khi nhan vien "gianh quyen"/"claim" 1 phien webchat HOAC cuoc hoi thoai
 * WhatsApp, neu khach nhan tiep tin nhan MOI ma sau 15 GIAY van chua co nhan vien
 * tra loi, tu dong gui CANH BAO qua Telegram - bien Telegram thanh kenh thong bao
 * thuc te, khong can cho co Admin Frontend that (hien chua xay).
 *
 * Dung CHUNG 1 processor cho ca 2 loai (phan biet qua job.data.entityType) de
 * khong lap lai logic kiem tra "da tra loi chua" 2 lan.
 */
@Processor('webchat-escalation')
export class WebchatEscalationProcessor extends WorkerHost {
  private readonly logger = new Logger(WebchatEscalationProcessor.name);

  constructor(
    @InjectRepository(WebChatSession) private readonly sessionRepo: Repository<WebChatSession>,
    @InjectRepository(WebChatMessage) private readonly messageRepo: Repository<WebChatMessage>,
    @InjectRepository(Conversation) private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(ChatMessage) private readonly chatMessageRepo: Repository<ChatMessage>,
    @InjectRepository(TelegramBinding) private readonly bindingRepo: Repository<TelegramBinding>,
    private readonly telegramChannel: TelegramChannel,
  ) {
    super();
  }

  async process(job: Job<EscalationJobData>): Promise<void> {
    if (job.data.entityType === 'whatsapp') {
      return this.processWhatsAppEscalation(job.data);
    }
    return this.processWebChatEscalation(job.data);
  }

  private async processWebChatEscalation(data: EscalationJobData): Promise<void> {
    const { tenantId, sessionId, customerMessageText, customerMessageCreatedAt } = data;

    const session = await this.sessionRepo.findOne({ where: { id: sessionId, tenantId } });
    if (!session) return; // phien co the da bi xoa, bo qua

    const staffReplyAfter = await this.messageRepo.findOne({
      where: {
        tenantId,
        sessionId,
        role: WebChatRole.ASSISTANT,
        createdAt: MoreThan(new Date(customerMessageCreatedAt)),
      },
    });

    if (staffReplyAfter && staffReplyAfter.staffId) {
      this.logger.log(`Phien webchat ${sessionId} da duoc nhan vien tra loi, khong can canh bao`);
      return;
    }

    const recipients = session.assignedStaffId
      ? await this.bindingRepo.find({ where: { tenantId, userId: session.assignedStaffId } })
      : await this.bindingRepo.find({ where: { tenantId } });

    if (recipients.length === 0) return;

    const alertText =
      `⚠️ <b>Khách số ${session.queueNumber ?? '?'} (Website) đang chờ phản hồi!</b>\n\n` +
      `Tin nhắn khách: "${customerMessageText}"\n\n` +
      `Đã quá 15 giây chưa có ai trả lời.\n` +
      `👉 Gõ <code>/s ${session.queueNumber}</code> để trả lời ngay.`;

    for (const binding of recipients) {
      await this.telegramChannel.send({ externalId: binding.telegramChatId }, { text: alertText });
    }
    this.logger.log(`Da gui canh bao Telegram cho phien webchat ${sessionId} toi ${recipients.length} nguoi`);
  }

  private async processWhatsAppEscalation(data: EscalationJobData): Promise<void> {
    const { tenantId, sessionId: conversationId, customerMessageText, customerMessageCreatedAt } = data;

    const conversation = await this.conversationRepo.findOne({ where: { id: conversationId, tenantId } });
    if (!conversation) return;

    // Kiem tra: co tin nhan STAFF nao tao SAU thoi diem khach gui tin nay khong?
    const staffReplyAfter = await this.chatMessageRepo.findOne({
      where: {
        tenantId,
        conversationId,
        senderType: SenderType.STAFF,
        createdAt: MoreThan(new Date(customerMessageCreatedAt)),
      },
    });

    if (staffReplyAfter) {
      this.logger.log(`Hoi thoai WhatsApp ${conversationId} da duoc nhan vien tra loi, khong can canh bao`);
      return;
    }

    const recipients = conversation.assignedStaffId
      ? await this.bindingRepo.find({ where: { tenantId, userId: conversation.assignedStaffId } })
      : await this.bindingRepo.find({ where: { tenantId } });

    if (recipients.length === 0) return;

    const alertText =
      `⚠️ <b>Khách số ${conversation.queueNumber ?? '?'} (WhatsApp) đang chờ phản hồi!</b>\n\n` +
      `Tin nhắn khách: "${customerMessageText}"\n\n` +
      `Đã quá 15 giây chưa có ai trả lời.\n` +
      `👉 Gõ <code>/s ${conversation.queueNumber}</code> để trả lời ngay.`;

    for (const binding of recipients) {
      await this.telegramChannel.send({ externalId: binding.telegramChatId }, { text: alertText });
    }
    this.logger.log(
      `Da gui canh bao Telegram cho hoi thoai WhatsApp ${conversationId} toi ${recipients.length} nguoi`,
    );
  }
}
