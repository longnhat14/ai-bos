import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('ticket_attachments')
export class TicketAttachment extends TenantBaseEntity {
  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId: string;

  @Column({ name: 'file_name' })
  fileName: string;

  // Duong dan tren o dia server (vd: uploads/tickets/xxx.jpg) - Sprint sau co the
  // doi sang S3-compatible storage, chi can doi lai AttachmentsService, khong doi API.
  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize: number;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy: string | null;
}
