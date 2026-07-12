import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from '../chat/chat-message.entity';
import { ChatModule } from '../chat/chat.module';
import { Conversation } from '../chat/conversation.entity';
import { CustomersModule } from '../customers/customers.module';
import { TelegramBinding } from '../telegram/telegram-binding.entity';
import { TelegramModule } from '../telegram/telegram.module';
import { TenantsModule } from '../tenants/tenants.module';
import { TicketsModule } from '../tickets/tickets.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { AIChatService } from './ai-chat.service';
import { WebchatEscalationProcessor } from './webchat-escalation.processor';
import { WebChatAdminController } from './webchat-admin.controller';
import { WebChatController } from './webchat.controller';
import { WebChatMessage } from './web-chat-message.entity';
import { WebChatSession } from './web-chat-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebChatSession, WebChatMessage, TelegramBinding, Conversation, ChatMessage]),
    BullModule.registerQueue({ name: 'webchat-escalation' }),
    TenantsModule,
    CustomersModule,
    TicketsModule,
    WarehouseModule,
    forwardRef(() => ChatModule),
    forwardRef(() => TelegramModule),
  ],
  controllers: [WebChatController, WebChatAdminController],
  providers: [AIChatService, WebchatEscalationProcessor],
  exports: [AIChatService],
})
export class WebChatModule {}
