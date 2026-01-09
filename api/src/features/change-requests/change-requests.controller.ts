import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/current-user';
import { ChangeRequestsService } from './change-requests.service';
import { CreateChangeRequestDto } from './dto';

@Controller('change-requests')
export class ChangeRequestsController {
  constructor(private readonly service: ChangeRequestsService) {}

  @Post()
  create(
    @Body() dto: CreateChangeRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user.email) throw new BadRequestException('Missing user identity');
    return this.service.create(dto.scope, dto.rootId, user.email, dto.reason);
  }

  @Get()
  list(@Query('status') status?: string) {
    return this.service.list(status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    if (!user.email) throw new BadRequestException('Missing user identity');
    return this.service.approve(id, user.email);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    if (!user.email) throw new BadRequestException('Missing user identity');
    return this.service.reject(id, user.email);
  }
}
