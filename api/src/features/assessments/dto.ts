import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAssessmentDto {
  @ApiProperty()
  @IsString()
  hazardId!: string;
}

export class BulkCreateAssessmentDto {
  @ApiProperty()
  @IsArray()
  hazardIds!: string[];
}

export class UpdateAssessmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unsafeConditions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unsafeActs?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  potentialHarm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  existingSeverity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  existingProbability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  newSeverity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  newProbability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
