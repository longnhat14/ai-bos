import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import { SenderType } from '../chat/chat-message.entity';
import { CustomersService } from '../customers/customers.service';
import { CustomerSource } from '../customers/customer.entity';
import { TenantsService } from '../tenants/tenants.service';

const MESSENGER_TENANT_CODE = process.env.MESSENGER_TENANT_CODE || 'pctech';

export interface IncomingMessengerMessage {
  from: string;
  text: string;
}

@Injectable()
export class MessengerInboundService {
  private readonly logger = new Logger(MessengerInboundService.name);

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly customersService: CustomersService,
    @Inject(forwardRef(() => ChatService)) private readonly chatService: ChatService,
  ) {}

  async handleIncomingMessage(msg: IncomingMessengerMessage): Promise<void> {
    const tenant = await this.tenantsService.getByCode(MESSENGER_TENANT_CODE);

    let customer = await this.customersService.findByPhone(tenant.id, msg.from);
    if (!customer) {
      customer = await this.customersService.create(tenant.id, {
        fullName: `Messenger ${msg.from}`,
        phone: msg.from,
        source: CustomerSource.MESSENGER,
      });
      this.logger.log(`Tu dong tao khach hang moi tu Messenger: ${msg.from}`);
    }

    const conversation = await this.chatService.findOrCreateForMessenger(tenant.id, customer.id, msg.from);

    await this.chatService.sendMessage(tenant.id, conversation.id, {
      senderType: SenderType.CUSTOMER,
      text: msg.text,
    });

    this.logger.log(`Da xu ly tin nhan Messenger tu ${msg.from}: "${msg.text}"`);
  }
}
