import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { TicketPriority, TicketStatus } from '../ticket.entity';

export class CreateTicketDto {
  @IsUUID()
  customerId: string;

  @IsNotEmpty()
  issueDescription: string;

  @IsOptional()
  deviceType?: string;

  @IsOptional()
  deviceModel?: string;

  @IsOptional()
  @IsIn(Object.values(TicketPriority))
  priority?: TicketPriority;

  @IsOptional()
  @IsArray()
  skillRequired?: string[];
}

export class UpdateTicketStatusDto {
  @IsIn(Object.values(TicketStatus))
  status: TicketStatus;

  @IsOptional()
  note?: string;
}

export class AssignTechnicianDto {
  @IsUUID()
  technicianId: string;
}

export class QuoteTicketDto {
  @IsNumber()
  quotedPrice: number;
}
