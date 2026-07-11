import { IsArray, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateKnowledgeEntryDto {
  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  content: string;

  @IsOptional()
  category?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class UpdateKnowledgeEntryDto {
  @IsOptional()
  title?: string;

  @IsOptional()
  content?: string;

  @IsOptional()
  category?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
