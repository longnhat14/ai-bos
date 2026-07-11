import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsUUID, Min } from 'class-validator';

export class CreateInventoryItemDto {
  @IsNotEmpty()
  sku: string;

  @IsNotEmpty()
  name: string;

  @IsOptional()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityOnHand?: number;

  @IsOptional()
  @IsInt()
  lowStockThreshold?: number;

  @IsNumber()
  @Min(0)
  costPrice: number;

  @IsNumber()
  @Min(0)
  sellPrice: number;
}

export class AdjustStockDto {
  // So duong = nhap kho, so am = xuat kho thu cong (khong qua ticket)
  @IsInt()
  quantityChange: number;

  @IsOptional()
  note?: string;
}

export class UsePartForTicketDto {
  @IsUUID()
  inventoryItemId: string;

  @IsInt()
  @IsPositive()
  quantity: number;
}
