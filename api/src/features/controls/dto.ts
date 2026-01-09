import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum ControlPhaseDto {
  EXISTING = 'EXISTING',
  ADDITIONAL = 'ADDITIONAL',
}

export enum ControlTypeDto {
  ENGINEERING = 'ENGINEERING',
  ADMIN = 'ADMIN',
  PPE = 'PPE',
  OTHER = 'OTHER',
}

export class CreateControlDto {
  @ApiProperty({ enum: ControlPhaseDto })
  @IsEnum(ControlPhaseDto)
  phase!: ControlPhaseDto;

  @ApiProperty({ enum: ControlTypeDto })
  @IsEnum(ControlTypeDto)
  type!: ControlTypeDto;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiPropertyOptional({ description: 'ISO string date' })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}

export class UpdateControlDto {
  @ApiPropertyOptional({ enum: ControlPhaseDto })
  @IsOptional()
  @IsEnum(ControlPhaseDto)
  phase?: ControlPhaseDto;

  @ApiPropertyOptional({ enum: ControlTypeDto })
  @IsOptional()
  @IsEnum(ControlTypeDto)
  type?: ControlTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiPropertyOptional({ description: 'ISO string date' })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}
