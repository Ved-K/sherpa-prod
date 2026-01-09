import { IsIn, IsOptional, IsString } from 'class-validator';

export const CHANGE_SCOPES = [
  'LINE_TREE',
  'MACHINE_TREE',
  'TASK_TREE',
  'STEP_TREE',
  'ASSESSMENT',
  'HAZARD_LIBRARY',
  'RISK_MATRIX',
] as const;

export type ChangeScope = (typeof CHANGE_SCOPES)[number];

export class CreateChangeRequestDto {
  @IsIn(CHANGE_SCOPES)
  scope!: ChangeScope;

  @IsString()
  rootId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
