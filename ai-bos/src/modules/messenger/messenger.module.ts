import { forwardRef, Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { CustomersModule } from '../customers/customers.module';
import { TenantsModule } from '../tenants/tenants.module';
import { MessengerChannel } from './messenger-channel.service';
import { MessengerInboundService } from './messenger-inbound.service';
import { MessengerWebhookController } from './messenger-webhook.controller';

@Module({
  imports: [TenantsModule, CustomersModule, forwardRef(() => ChatModule)],
  controllers: [MessengerWebhookController],
  providers: [MessengerChannel, MessengerInboundService],
  exports: [MessengerChannel],
})
export class MessengerModule {}
