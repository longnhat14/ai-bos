import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from '../chat/chat.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { TicketsModule } from '../tickets/tickets.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { WebChatModule } from '../webchat/webchat.module';
import { TelegramBinding } from './telegram-binding.entity';
import { TelegramChannel } from './telegram-channel.service';
import { TelegramCommandService } from './telegram-command.service';
import { TelegramController } from './telegram.controller';
import { TelegramWebhookController } from './telegram-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TelegramBinding]),
    DashboardModule,
    TicketsModule,
    WarehouseModule,
    forwardRef(() => WebChatModule),
    forwardRef(() => ChatModule),
  ],
  controllers: [TelegramController, TelegramWebhookController],
  providers: [TelegramChannel, TelegramCommandService],
  exports: [TelegramChannel],
})
export class TelegramModule {}
