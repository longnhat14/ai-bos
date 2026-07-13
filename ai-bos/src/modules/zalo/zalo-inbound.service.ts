import { Injectable, Logger } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import { SenderType } from '../chat/chat-message.entity';
import { CustomersService } from '../customers/customers.service';
import { CustomerSource } from '../customers/customer.entity';
import { TenantsService } from '../tenants/tenants.service';

// Tenant nhan tin nhan Zalo - mac dinh PCTech (khach hang Viet Nam), khac voi
// WhatsApp mac dinh RemoteIT (khach hang quoc te). Xem kien truoc kenh da thong nhat:
// "Zalo OA: danh cho khach hang Viet Nam" vs "WhatsApp: khach hang My/Chau Au".
const ZALO_TENANT_CODE = process.env.ZALO_TENANT_CODE || 'pctech';

export interface IncomingZaloMessage {
  from: string; // Zalo user_id cua khach
  text: string;
  displayName?: string;
}

@Injectable()
export class ZaloInboundService {
  private readonly logger = new Logger(ZaloInboundService.name);

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly customersService: CustomersService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * Xu ly 1 tin nhan Zalo den - tim/tao Customer, tim/tao Conversation (channel=zalo),
   * luu tin nhan qua ChatService. Khac WhatsApp (mac dinh dich tu dong), Zalo mac dinh
   * KHONG dich (khach Viet Nam noi tieng Viet, khong can dich) - PCTech co the bat rieng
   * neu gap khach nuoc ngoai qua enableAutoTranslate khi tao conversation.
   */
  async handleIncomingMessage(msg: IncomingZaloMessage): Promise<void> {
    const tenant = await this.tenantsService.getByCode(ZALO_TENANT_CODE);

    let customer = await this.customersService.findByPhone(tenant.id, msg.from);
    if (!customer) {
      customer = await this.customersService.create(tenant.id, {
        fullName: msg.displayName || `Zalo ${msg.from}`,
        phone: msg.from, // Zalo user_id luu tam vao truong phone de dinh danh duy nhat
        source: CustomerSource.ZALO,
      });
      this.logger.log(`Tu dong tao khach hang moi tu Zalo: ${msg.from}`);
    }

    const conversation = await this.chatService.findOrCreateForZalo(tenant.id, customer.id, msg.from);

    await this.chatService.sendMessage(tenant.id, conversation.id, {
      senderType: SenderType.CUSTOMER,
      text: msg.text,
    });

    this.logger.log(`Da xu ly tin nhan Zalo tu ${msg.from}: "${msg.text}"`);
  }
}
