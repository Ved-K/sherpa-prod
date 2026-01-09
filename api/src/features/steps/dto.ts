import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';

export class CreateStepDto {
  @ApiPropertyOptional({
    description: 'If omitted, backend assigns next step number.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  stepNo?: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(
    { require_protocol: true },
    { message: 'trainingLink must be a valid URL (include https://)' },
  )
  trainingLink?: string;
}

export class UpdateStepDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  stepNo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(
    { require_protocol: true },
    { message: 'trainingLink must be a valid URL (include https://)' },
  )
  trainingLink?: string;
}

export class UpdateStatusDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}
