import { IsInt, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreatePriceCatalogDto {
  @IsNotEmpty()
  skillCode: string;

  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  laborPrice: number;

  // Tuy chon - khong phai dich vu nao cung bao hanh (vd ve sinh may, cai dat
  // phan mem thuong khong bao hanh). Bo trong = khong bao hanh.
  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyMonths?: number;
}

export class UpdatePriceCatalogDto {
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  laborPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyMonths?: number;
}
