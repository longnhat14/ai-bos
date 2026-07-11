import { IsArray, IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import { TriggerType } from '../add-on-rule.entity';

export class CreateAddOnRuleDto {
  @IsIn(Object.values(TriggerType))
  triggerType: TriggerType;

  @IsNotEmpty()
  triggerValue: string;

  @IsOptional()
  @IsArray()
  suggestedProductSkus?: string[];

  @IsOptional()
  suggestedServiceNote?: string;
}
