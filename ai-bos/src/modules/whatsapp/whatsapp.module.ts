import { forwardRef, Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { CustomersModule } from '../customers/customers.module';
import { TenantsModule } from '../tenants/tenants.module';
import { WhatsAppChannel } from './whatsapp-channel.service';
import { WhatsAppInboundService } from './whatsapp-inbound.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

@Module({
  imports: [TenantsModule, CustomersModule, forwardRef(() => ChatModule)],
  controllers: [WhatsAppWebhookController],
  providers: [WhatsAppChannel, WhatsAppInboundService],
  exports: [WhatsAppChannel],
})
export class WhatsAppModule {}
