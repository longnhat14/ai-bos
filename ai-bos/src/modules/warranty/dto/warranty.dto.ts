import { IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';

export class VoidWarrantyDto {
  @IsNotEmpty()
  reason: string;
}

export class UpdateWarrantyMonthsDto {
  @IsInt()
  @Min(1)
  warrantyMonths: number;
}

export class ManualCreateWarrantyDto {
  @IsUUID()
  ticketId: string;

  @IsUUID()
  customerId: string;

  @IsOptional()
  deviceType?: string;

  @IsOptional()
  deviceModel?: string;

  @IsInt()
  @Min(1)
  warrantyMonths: number;
}
