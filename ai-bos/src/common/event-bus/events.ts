/**
 * AI BOS - Danh sach Event Type chuan hoa
 * Moi module khi phat sinh su kien quan trong PHAI dung dung ten o day,
 * khong tu dat ten khac de tranh loan khi mo rong (Invoice, Kho, Notification... se lang nghe theo ten nay)
 */
export enum EventType {
  // Ticket
  TICKET_CREATED = 'ticket.created',
  TICKET_STATUS_CHANGED = 'ticket.status_changed',
  TICKET_ASSIGNED = 'ticket.assigned',
  TICKET_QUOTED = 'ticket.quoted',
  TICKET_CLOSED = 'ticket.closed',

  // Customer
  CUSTOMER_CREATED = 'customer.created',

  // Warehouse (Sprint 6)
  INVENTORY_ITEM_CREATED = 'inventory.item_created',
  INVENTORY_STOCK_ADJUSTED = 'inventory.stock_adjusted',
  INVENTORY_LOW_STOCK = 'inventory.low_stock',
  TICKET_PART_USED = 'ticket.part_used',

  // Invoice (Sprint 7)
  INVOICE_CREATED = 'invoice.created',
  INVOICE_PAID = 'invoice.paid',

  // Warranty (Sprint 7)
  WARRANTY_CREATED = 'warranty.created',
  WARRANTY_EXPIRING = 'warranty.expiring',
  WARRANTY_VOIDED = 'warranty.voided',

  // Shop (Sprint 8)
  ORDER_CREATED = 'order.created',
  ORDER_CONFIRMED = 'order.confirmed',
  ORDER_COMPLETED = 'order.completed',
  ORDER_CANCELLED = 'order.cancelled',

  // Chat / Auto-Translate (chi ap dung cho RemoteIT)
  CHAT_MESSAGE_SENT = 'chat.message_sent',
}

export interface BaseEventPayload {
  tenantId: string;
  [key: string]: any;
}
