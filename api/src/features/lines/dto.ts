import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateLineDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdateLineDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;
}
