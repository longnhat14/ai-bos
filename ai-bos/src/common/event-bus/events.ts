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

  // (Se bo sung tiep o Sprint 5-8: order.created, invoice.created, warranty.expiring...)
}

export interface BaseEventPayload {
  tenantId: string;
  [key: string]: any;
}
