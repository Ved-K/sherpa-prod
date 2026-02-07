import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewStatus } from '@prisma/client';
import { ValidateIf } from 'class-validator';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  IsISO8601,
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

  // ✅ NEW
  @ApiPropertyOptional({
    description: 'Review date (ISO 8601). Use null to clear.',
    nullable: true,
    example: '2026-02-06T00:00:00.000Z',
  })
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string')
  @IsISO8601({}, { message: 'reviewDate must be a valid ISO 8601 datetime' })
  reviewDate?: string | null;
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

  // ✅ NEW
  @ApiPropertyOptional({
    description: 'Review date (ISO 8601). Use null to clear.',
    nullable: true,
    example: '2026-02-06T00:00:00.000Z',
  })
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string')
  @IsISO8601({}, { message: 'reviewDate must be a valid ISO 8601 datetime' })
  reviewDate?: string | null;
}

export class UpdateStatusDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}
