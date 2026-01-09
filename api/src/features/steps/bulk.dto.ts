import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

class StepCreateItemDto {
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
    { message: 'trainingLink must include https://' },
  )
  trainingLink?: string;
}

export class BulkCreateStepsDto {
  @ApiProperty({ type: [StepCreateItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepCreateItemDto)
  steps!: StepCreateItemDto[];
}
