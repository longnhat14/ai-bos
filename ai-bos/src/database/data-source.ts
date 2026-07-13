import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Tenant } from '../modules/tenants/tenant.entity';
import { User } from '../modules/users/user.entity';
import { Customer } from '../modules/customers/customer.entity';
import { Ticket } from '../modules/tickets/ticket.entity';
import { TicketStatusHistory } from '../modules/tickets/ticket-status-history.entity';
import { TicketAttachment } from '../modules/tickets/ticket-attachment.entity';
import { InventoryItem } from '../modules/warehouse/inventory-item.entity';
import { InventoryItemImage } from '../modules/warehouse/inventory-item-image.entity';
import { TicketPart } from '../modules/warehouse/ticket-part.entity';
import { Invoice } from '../modules/invoice/invoice.entity';
import { Warranty } from '../modules/warranty/warranty.entity';
import { Order } from '../modules/shop/order.entity';
import { OrderItem } from '../modules/shop/order-item.entity';
import { Conversation } from '../modules/chat/conversation.entity';
import { ChatMessage } from '../modules/chat/chat-message.entity';
import { PriceCatalog } from '../modules/pricing/price-catalog.entity';
import { KnowledgeEntry } from '../modules/knowledge/knowledge-entry.entity';
import { DiagnosticCache } from '../modules/diagnostic/diagnostic-cache.entity';
import { AddOnRule } from '../modules/sales/add-on-rule.entity';
import { TelegramBinding } from '../modules/telegram/telegram-binding.entity';
import { WebChatSession } from '../modules/webchat/web-chat-session.entity';
import { WebChatMessage } from '../modules/webchat/web-chat-message.entity';
import { EventLog } from '../common/event-bus/event-log.entity';

dotenv.config();

// Tu dong nhan biet dang chay qua ts-node (file .ts, dung luc dev/generate migration)
// hay ban da compile (file .js trong dist/, dung luc production that su) - de tro
// dung duong dan migration tuong ung. Neu de co dinh ".ts", khi chay "node dist/..."
// (khong co ts-node) se KHONG tim thay migration nao (glob khong khop file .js).
const isCompiled = __filename.endsWith('.js');
const migrationsGlob = isCompiled ? `${__dirname}/migrations/*.js` : `${__dirname}/migrations/*.ts`;

export const AppDataSource = new DataSource({
  type: 'mariadb',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'ai_bos',
  password: process.env.DB_PASSWORD || 'ai_bos_password',
  database: process.env.DB_NAME || 'ai_bos',
  entities: [
    Tenant,
    User,
    Customer,
    Ticket,
    TicketStatusHistory,
    TicketAttachment,
    InventoryItem,
    InventoryItemImage,
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
  migrations: [migrationsGlob],
  synchronize: false, // KHONG dung true o production - dung migration
  logging: process.env.NODE_ENV === 'development',
});
