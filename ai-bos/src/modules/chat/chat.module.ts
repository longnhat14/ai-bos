import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventBusModule } from '../../common/event-bus/event-bus.module';
import { TelegramBinding } from '../telegram/telegram-binding.entity';
import { TelegramModule } from '../telegram/telegram.module';
import { TenantsModule } from '../tenants/tenants.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { ZaloModule } from '../zalo/zalo.module';
import { MessengerModule } from '../messenger/messenger.module';
import { ChatMessage } from './chat-message.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { Conversation } from './conversation.entity';
import { TranslationService } from './translation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ChatMessage, TelegramBinding]),
    BullModule.registerQueue({ name: 'webchat-escalation' }),
    TenantsModule,
    EventBusModule,
    forwardRef(() => WhatsAppModule),
    forwardRef(() => TelegramModule),
    forwardRef(() => ZaloModule),
    forwardRef(() => MessengerModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, TranslationService],
  exports: [ChatService, TranslationService],
})
export class ChatModule {}
