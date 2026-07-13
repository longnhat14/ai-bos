import { IsNumber, Min } from 'class-validator';

export class CreateInvoiceManualDto {
  // Gia cuoi cung khach phai tra (da gom ca linh kien + cong sua) - nguoi tao
  // hoa don thu cong tu nhap, dung khi ticket dong ma chua tung duoc bao gia
  // (nen khong tu dong sinh hoa don duoc) hoac can dieu chinh lai gia cuoi.
  @IsNumber()
  @Min(0)
  finalPrice: number;
}
