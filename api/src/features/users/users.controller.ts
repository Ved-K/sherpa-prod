import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/current-user';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    if (!user.email) throw new BadRequestException('Missing user identity');
    return this.service.upsertMe(user.email);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.service.list();
  }

  @Post()
  create(
    @Body()
    body: { email: string; displayName?: string; role?: 'ADMIN' | 'USER' },
    @CurrentUser() user: RequestUser,
  ) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.service.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: { displayName?: string; role?: 'ADMIN' | 'USER'; isActive?: boolean },
    @CurrentUser() user: RequestUser,
  ) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.service.update(id, body);
  }
}
