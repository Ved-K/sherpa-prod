import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateMachineDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdateMachineDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;
}
