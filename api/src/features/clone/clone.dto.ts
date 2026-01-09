import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CloneTaskDto {
  @ApiProperty()
  @IsString()
  targetMachineId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  resetStatus?: boolean;
}

export class CloneMachineDto {
  @ApiProperty()
  @IsString()
  targetLineId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  resetStatus?: boolean;
}

export class CloneLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  resetStatus?: boolean;
}
