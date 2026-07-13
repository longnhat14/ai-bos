import { IsEmail, IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import { CustomerSource } from '../customer.entity';

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

  // Tuy chon - cac service noi bo (WhatsApp/Zalo/AI Chat) tu truyen dung gia tri,
  // con Frontend/API thu cong KHONG truyen gi ca -> mac dinh COUNTER (theo entity).
  @IsOptional()
  @IsIn(Object.values(CustomerSource))
  source?: CustomerSource;
}

export class UpdateCustomerDto {
  @IsOptional()
  fullName?: string;

  @IsOptional()
  phone?: string;

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
