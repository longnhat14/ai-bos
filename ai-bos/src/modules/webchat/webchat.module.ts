import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersModule } from '../customers/customers.module';
import { TenantsModule } from '../tenants/tenants.module';
import { TicketsModule } from '../tickets/tickets.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { AIChatService } from './ai-chat.service';
import { WebChatAdminController } from './webchat-admin.controller';
import { WebChatController } from './webchat.controller';
import { WebChatMessage } from './web-chat-message.entity';
import { WebChatSession } from './web-chat-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebChatSession, WebChatMessage]),
    TenantsModule,
    CustomersModule,
    TicketsModule,
    WarehouseModule,
  ],
  controllers: [WebChatController, WebChatAdminController],
  providers: [AIChatService],
  exports: [AIChatService],
})
export class WebChatModule {}
