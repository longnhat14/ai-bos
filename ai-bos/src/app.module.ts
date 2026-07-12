import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tenant } from './modules/tenants/tenant.entity';
import { User } from './modules/users/user.entity';
import { Customer } from './modules/customers/customer.entity';
import { Ticket } from './modules/tickets/ticket.entity';
import { TicketStatusHistory } from './modules/tickets/ticket-status-history.entity';
import { TicketAttachment } from './modules/tickets/ticket-attachment.entity';
import { InventoryItem } from './modules/warehouse/inventory-item.entity';
import { TicketPart } from './modules/warehouse/ticket-part.entity';
import { Invoice } from './modules/invoice/invoice.entity';
import { Warranty } from './modules/warranty/warranty.entity';
import { Order } from './modules/shop/order.entity';
import { OrderItem } from './modules/shop/order-item.entity';
import { Conversation } from './modules/chat/conversation.entity';
import { ChatMessage } from './modules/chat/chat-message.entity';
import { PriceCatalog } from './modules/pricing/price-catalog.entity';
import { KnowledgeEntry } from './modules/knowledge/knowledge-entry.entity';
import { DiagnosticCache } from './modules/diagnostic/diagnostic-cache.entity';
import { AddOnRule } from './modules/sales/add-on-rule.entity';
import { TelegramBinding } from './modules/telegram/telegram-binding.entity';
import { WebChatSession } from './modules/webchat/web-chat-session.entity';
import { WebChatMessage } from './modules/webchat/web-chat-message.entity';
import { EventLog } from './common/event-bus/event-log.entity';

import { TenantsModule } from './modules/tenants/tenants.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { WarrantyModule } from './modules/warranty/warranty.module';
import { ShopModule } from './modules/shop/shop.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ChatModule } from './modules/chat/chat.module';
import { DispatcherModule } from './modules/dispatcher/dispatcher.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { DiagnosticModule } from './modules/diagnostic/diagnostic.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { SalesModule } from './modules/sales/sales.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { ZaloModule } from './modules/zalo/zalo.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { WebChatModule } from './modules/webchat/webchat.module';
import { SettingsModule } from './modules/settings/settings.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ChannelsModule } from './common/channels/channels.module';
import { EventBusModule } from './common/event-bus/event-bus.module';
import { EventDispatcherProcessor } from './common/event-bus/event-dispatcher.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting toan cuc - mac dinh 100 request/60s cho MOI IP. Cac endpoint
    // nhay cam hon (webchat public, webhook) co the tu dat @Throttle rieng chat
    // hon o tung controller. Bao ve chinh: endpoint public khong co JWT
    // (/public/webchat/messages, /webhooks/*) tranh bi spam/DDoS don gian.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mariadb',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get('DB_USER', 'ai_bos'),
        password: config.get('DB_PASSWORD', 'ai_bos_password'),
        database: config.get('DB_NAME', 'ai_bos'),
        entities: [
          Tenant,
          User,
          Customer,
          Ticket,
          TicketStatusHistory,
          TicketAttachment,
          InventoryItem,
          TicketPart,
          Invoice,
          Warranty,
          Order,
          OrderItem,
          Conversation,
          ChatMessage,
          PriceCatalog,
          KnowledgeEntry,
          DiagnosticCache,
          AddOnRule,
          TelegramBinding,
          WebChatSession,
          WebChatMessage,
          EventLog,
        ],
        synchronize: config.get('NODE_ENV') === 'development', // CHI true khi dev, production dung migration
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),

    TenantsModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    TicketsModule,
    WarehouseModule,
    InvoiceModule,
    WarrantyModule,
    ShopModule,
    DashboardModule,
    ChatModule,
    DispatcherModule,
    PricingModule,
    DiagnosticModule,
    KnowledgeModule,
    SalesModule,
    WhatsAppModule,
    ZaloModule,
    TelegramModule,
    WebChatModule,
    SettingsModule,
    NotificationModule,
    ChannelsModule,
    EventBusModule,
  ],
  // EventDispatcherProcessor la DUY NHAT noi dang ky @Processor('ai-bos-events').
  // No can NotificationModule + InvoiceModule da import o tren de lay duoc
  // NotificationService va InvoiceEventHandler qua Dependency Injection.
  providers: [
    EventDispatcherProcessor,
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // ap dung rate limit cho TOAN BO endpoint
  ],
})
export class AppModule {}
