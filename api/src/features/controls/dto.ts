import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum ControlPhase {
  EXISTING = 'EXISTING',
  ADDITIONAL = 'ADDITIONAL',
}

export enum ControlType {
  ENGINEERING = 'ENGINEERING',
  ADMIN = 'ADMIN',
  PPE = 'PPE',
  OTHER = 'OTHER',
}

export class CreateControlDto {
  @IsEnum(ControlPhase)
  phase!: ControlPhase;

  @IsEnum(ControlType)
  type!: ControlType;

  @IsString()
  @MinLength(1)
  description!: string;

  // required only when phase=ADDITIONAL
  @ValidateIf((o) => o.phase === ControlPhase.ADDITIONAL)
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string; // ISO string

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}

export class UpdateControlDto {
  @IsOptional()
  @IsEnum(ControlPhase)
  phase?: ControlPhase;

  @IsOptional()
  @IsEnum(ControlType)
  type?: ControlType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  // allow clearing with null
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  categoryId?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  owner?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsISO8601()
  dueDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}
