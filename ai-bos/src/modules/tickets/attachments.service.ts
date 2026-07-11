import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Repository } from 'typeorm';
import { TicketAttachment } from './ticket-attachment.entity';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(TicketAttachment)
    private readonly attachmentRepo: Repository<TicketAttachment>,
  ) {}

  async saveAttachment(
    tenantId: string,
    ticketId: string,
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<TicketAttachment> {
    const attachment = this.attachmentRepo.create({
      tenantId,
      ticketId,
      fileName: file.originalname,
      filePath: file.path, // duong dan tren dia da duoc multer ghi san (xem tickets.controller.ts)
      mimeType: file.mimetype,
      fileSize: file.size,
      uploadedBy,
    });
    return this.attachmentRepo.save(attachment);
  }

  async findByTicket(tenantId: string, ticketId: string): Promise<TicketAttachment[]> {
    return this.attachmentRepo.find({ where: { tenantId, ticketId }, order: { createdAt: 'ASC' } });
  }

  /** Chi lay anh (image/*) - dung cho AI Diagnostic doc hinh anh, bo qua file khac (vd PDF) */
  async findImagesByTicket(tenantId: string, ticketId: string): Promise<TicketAttachment[]> {
    const all = await this.findByTicket(tenantId, ticketId);
    return all.filter((a) => ALLOWED_IMAGE_TYPES.includes(a.mimeType));
  }

  /**
   * Doc file tu dia va tra ve base64 - dung de gui cho Claude API (vision).
   * Neu file da bi xoa/di chuyen tren dia, nem loi ro rang thay vi de crash mo ho.
   */
  async readAsBase64(attachment: TicketAttachment): Promise<string> {
    try {
      const buffer = await fs.readFile(attachment.filePath);
      return buffer.toString('base64');
    } catch (err) {
      throw new NotFoundException(
        `Khong doc duoc file dinh kem "${attachment.fileName}" tren dia: ${err.message}`,
      );
    }
  }

  static getUploadDir(): string {
    return path.join(process.cwd(), 'uploads', 'tickets');
  }
}
