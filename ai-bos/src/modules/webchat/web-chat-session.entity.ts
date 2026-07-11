import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

/**
 * 1 phien chat cua khach vang lai tren website (chua chac da co Customer/Ticket).
 * customerId co the null luc dau (khach chua cung cap thong tin), duoc dien vao
 * khi AI hoi va khach tra loi ten/SDT, hoac ngay khi tao ticket that.
 */
@Entity('web_chat_sessions')
export class WebChatSession extends TenantBaseEntity {
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({ name: 'created_ticket_id', type: 'uuid', nullable: true })
  createdTicketId: string | null; // neu AI da tao ticket trong phien nay
}
