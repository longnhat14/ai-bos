import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { AttachmentsService } from './attachments.service';
import {
  AssignTechnicianDto,
  CreateTicketDto,
  QuoteTicketDto,
  UpdateTicketStatusDto,
} from './dto/ticket.dto';
import { TicketStatus } from './ticket.entity';
import { TicketsService } from './tickets.service';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

@Controller('api/v1/tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user.tenantId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query('status') status?: TicketStatus) {
    return this.ticketsService.findAll(user.tenantId, status);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ticketsService.findOne(user.tenantId, id);
  }

  @Patch(':id/assign')
  assignTechnician(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignTechnicianDto,
  ) {
    return this.ticketsService.assignTechnician(user.tenantId, id, dto, user.sub);
  }

  @Patch(':id/quote')
  quote(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: QuoteTicketDto) {
    return this.ticketsService.quote(user.tenantId, id, dto, user.sub);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateStatus(user.tenantId, id, dto, user.sub);
  }

  // Upload anh/file dinh kem cho ticket - KH hoac KTV gui anh loi, man hinh xanh, hinh hong may...
  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: AttachmentsService.getUploadDir(),
        filename: (_req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return callback(
            new BadRequestException(`Dinh dang file khong duoc ho tro: ${file.mimetype}`),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadAttachment(
    @CurrentUser() user: JwtPayload,
    @Param('id') ticketId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Khong nhan duoc file');
    // Dam bao ticket ton tai va thuoc dung tenant truoc khi luu attachment
    await this.ticketsService.findOne(user.tenantId, ticketId);
    return this.attachmentsService.saveAttachment(user.tenantId, ticketId, file, user.sub);
  }

  @Get(':id/attachments')
  getAttachments(@CurrentUser() user: JwtPayload, @Param('id') ticketId: string) {
    return this.attachmentsService.findByTicket(user.tenantId, ticketId);
  }
}
