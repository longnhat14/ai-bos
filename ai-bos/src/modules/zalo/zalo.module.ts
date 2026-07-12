import { forwardRef, Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { CustomersModule } from '../customers/customers.module';
import { TenantsModule } from '../tenants/tenants.module';
import { ZaloChannel } from './zalo-channel.service';
import { ZaloInboundService } from './zalo-inbound.service';
import { ZaloWebhookController } from './zalo-webhook.controller';

@Module({
  imports: [TenantsModule, CustomersModule, forwardRef(() => ChatModule)],
  controllers: [ZaloWebhookController],
  providers: [ZaloChannel, ZaloInboundService],
  exports: [ZaloChannel],
})
export class ZaloModule {}
