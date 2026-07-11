import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreatePriceCatalogDto {
  @IsNotEmpty()
  skillCode: string;

  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  laborPrice: number;
}

export class UpdatePriceCatalogDto {
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  laborPrice?: number;
}
