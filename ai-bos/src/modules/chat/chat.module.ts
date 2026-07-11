import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventBusModule } from '../../common/event-bus/event-bus.module';
import { TenantsModule } from '../tenants/tenants.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { ChatMessage } from './chat-message.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { Conversation } from './conversation.entity';
import { TranslationService } from './translation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ChatMessage]),
    TenantsModule,
    EventBusModule,
    forwardRef(() => WhatsAppModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, TranslationService],
  exports: [ChatService],
})
export class ChatModule {}
