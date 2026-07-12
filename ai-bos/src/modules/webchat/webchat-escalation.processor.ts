import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { MoreThan, Repository } from 'typeorm';
import { TelegramBinding } from '../telegram/telegram-binding.entity';
import { TelegramChannel } from '../telegram/telegram-channel.service';
import { WebChatMessage, WebChatRole } from './web-chat-message.entity';
import { WebChatSession } from './web-chat-session.entity';

export interface EscalationJobData {
  tenantId: string;
  sessionId: string;
  customerMessageId: string;
  customerMessageText: string;
  customerMessageCreatedAt: string; // ISO string (BullMQ serialize JSON, khong giu duoc Date object)
}

/**
 * Sau khi nhan vien "gianh quyen" (takeover) 1 phien webchat, neu khach nhan tiep
 * tin nhan MOI ma sau 15 GIAY van chua co nhan vien tra loi, tu dong gui CANH BAO
 * qua Telegram - bien Telegram thanh kenh thong bao thuc te, khong can cho co
 * Admin Frontend that (hien chua xay).
 *
 * Day la workaround thuc te cho tinh trang hien tai: nhan vien khong co man hinh
 * nao de "canh" webchat, nen dung Telegram (kenh push notification manh) de bao
 * ngay khi co nguy co bo lo tin nhan khach.
 */
@Processor('webchat-escalation')
export class WebchatEscalationProcessor extends WorkerHost {
  private readonly logger = new Logger(WebchatEscalationProcessor.name);

  constructor(
    @InjectRepository(WebChatSession) private readonly sessionRepo: Repository<WebChatSession>,
    @InjectRepository(WebChatMessage) private readonly messageRepo: Repository<WebChatMessage>,
    @InjectRepository(TelegramBinding) private readonly bindingRepo: Repository<TelegramBinding>,
    private readonly telegramChannel: TelegramChannel,
  ) {
    super();
  }

  async process(job: Job<EscalationJobData>): Promise<void> {
    const { tenantId, sessionId, customerMessageText, customerMessageCreatedAt } = job.data;

    const session = await this.sessionRepo.findOne({ where: { id: sessionId, tenantId } });
    if (!session) return; // phien co the da bi xoa, bo qua

    // Kiem tra: co tin nhan nao cua NHAN VIEN (staffId khac null) tao SAU thoi diem
    // khach gui tin nhan nay khong? Neu co -> da duoc tra loi, khong can canh bao.
    const staffReplyAfter = await this.messageRepo.findOne({
      where: {
        tenantId,
        sessionId,
        role: WebChatRole.ASSISTANT,
        createdAt: MoreThan(new Date(customerMessageCreatedAt)),
      },
    });

    if (staffReplyAfter && staffReplyAfter.staffId) {
      this.logger.log(`Phien ${sessionId} da duoc nhan vien tra loi, khong can canh bao`);
      return;
    }

    // Chua co ai tra loi sau 15s - gui canh bao qua Telegram
    const recipients = session.assignedStaffId
      ? await this.bindingRepo.find({ where: { tenantId, userId: session.assignedStaffId } })
      : await this.bindingRepo.find({ where: { tenantId } }); // fallback: canh bao TAT CA nhan vien da lien ket Telegram

    if (recipients.length === 0) {
      this.logger.warn(
        `Khong co Telegram binding nao de canh bao cho phien ${sessionId} (tenant ${tenantId})`,
      );
      return;
    }

    const alertText =
      `⚠️ <b>Khách số ${session.queueNumber ?? '?'} đang chờ phản hồi!</b>\n\n` +
      `Tin nhắn khách: "${customerMessageText}"\n\n` +
      `Đã quá 15 giây chưa có ai trả lời.\n` +
      `👉 Gõ <code>/s ${session.queueNumber}</code> để chuyển sang trả lời khách này ngay (không cần xem danh sách trước).`;

    for (const binding of recipients) {
      await this.telegramChannel.send({ externalId: binding.telegramChatId }, { text: alertText });
    }

    this.logger.log(`Da gui canh bao Telegram cho phien ${sessionId} toi ${recipients.length} nguoi`);
  }
}
