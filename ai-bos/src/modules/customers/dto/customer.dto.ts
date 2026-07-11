import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCustomerDto {
  @IsNotEmpty()
  fullName: string;

  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  address?: string;

  @IsOptional()
  city?: string;

  // Ma quoc gia ISO, vd: 'VN', 'SG'. Neu khong truyen, mac dinh 'VN' (theo entity).
  // Quan trong voi RemoteIT - khach hang quoc te.
  @IsOptional()
  country?: string;

  @IsOptional()
  notes?: string;
}

export class UpdateCustomerDto {
  @IsOptional()
  fullName?: string;

  @IsOptional()
  email?: string;

  @IsOptional()
  address?: string;

  @IsOptional()
  city?: string;

  @IsOptional()
  country?: string;

  @IsOptional()
  notes?: string;
}
