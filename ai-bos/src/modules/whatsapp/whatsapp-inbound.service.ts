import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import { SenderType } from '../chat/chat-message.entity';
import { CustomersService } from '../customers/customers.service';
import { TenantsService } from '../tenants/tenants.service';

// Tenant se nhan tin nhan WhatsApp - MVP hien tai chi co RemoteIT dung WhatsApp.
// Khi mo rong SaaS cho nhieu tenant deu dung WhatsApp, can thay bang bang mapping
// phone_number_id (cua Meta) -> tenant_id, thay vi 1 bien ENV co dinh nhu hien tai.
const WHATSAPP_TENANT_CODE = process.env.WHATSAPP_TENANT_CODE || 'remoteit';

export interface IncomingWhatsAppMessage {
  from: string; // so dien thoai dang WhatsApp (wa_id), vd '6591234567'
  text: string;
  contactName?: string;
}

@Injectable()
export class WhatsAppInboundService {
  private readonly logger = new Logger(WhatsAppInboundService.name);

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly customersService: CustomersService,
    @Inject(forwardRef(() => ChatService)) private readonly chatService: ChatService,
  ) {}

  /**
   * Xu ly 1 tin nhan WhatsApp den: tim hoac tao Customer theo so dien thoai,
   * tim hoac tao Conversation (channel=whatsapp), roi luu tin nhan qua ChatService
   * (tu dong dich neu tenant/conversation bat auto-translate).
   */
  async handleIncomingMessage(msg: IncomingWhatsAppMessage): Promise<void> {
    const tenant = await this.tenantsService.getByCode(WHATSAPP_TENANT_CODE);

    let customer = await this.customersService.findByPhone(tenant.id, msg.from);
    if (!customer) {
      customer = await this.customersService.create(tenant.id, {
        fullName: msg.contactName || `WhatsApp ${msg.from}`,
        phone: msg.from,
      });
      this.logger.log(`Tu dong tao khach hang moi tu WhatsApp: ${msg.from}`);
    }

    const conversation = await this.chatService.findOrCreateForWhatsApp(
      tenant.id,
      customer.id,
      msg.from,
    );

    await this.chatService.sendMessage(tenant.id, conversation.id, {
      senderType: SenderType.CUSTOMER,
      text: msg.text,
    });

    this.logger.log(`Da xu ly tin nhan WhatsApp tu ${msg.from}: "${msg.text}"`);
  }
}
