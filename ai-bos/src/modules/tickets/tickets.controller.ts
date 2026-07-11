import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import {
  AssignTechnicianDto,
  CreateTicketDto,
  QuoteTicketDto,
  UpdateTicketStatusDto,
} from './dto/ticket.dto';
import { TicketStatus } from './ticket.entity';
import { TicketsService } from './tickets.service';

@Controller('api/v1/tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

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
}
