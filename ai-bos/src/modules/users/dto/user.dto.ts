import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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
