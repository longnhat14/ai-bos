import { IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, Max, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../user.entity';

// Tao tai khoan nhan vien MOI - CHI Admin duoc goi (xem UsersController).
// Khac han "RegisterDto" cu (da bi XOA vi la lo hong bao mat nghiem trong -
// bat ky ai cung tu dang ky duoc va tu chon role=admin). Endpoint nay BAT BUOC
// phai chon role ro rang, khong cho mac dinh ngam de tranh nham lan.
export class CreateEmployeeDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsNotEmpty()
  fullName: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  phone?: string;
}

export class SkillInputDto {
  @IsNotEmpty()
  skill: string;

  @IsInt()
  @Min(1)
  @Max(5)
  level: number; // 1-5
}

export class UpdateTechnicianProfileDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillInputDto)
  skills?: SkillInputDto[];

  @IsOptional()
  city?: string;

  // Ma quoc gia ISO, vd: 'VN', 'SG'. Quan trong voi RemoteIT khi phan biet
  // KTV onsite (phai cung quoc gia) va Remote Engineer (khong bat buoc).
  @IsOptional()
  country?: string;

  // true = Remote Engineer (ho tro tu xa, khong bi rang buoc quoc gia/tinh thanh)
  @IsOptional()
  @IsBoolean()
  isRemote?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
