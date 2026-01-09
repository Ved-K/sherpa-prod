import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/current-user';
import { TaskCategoriesService } from './task-categories.service';

@Controller('task-categories')
export class TaskCategoriesController {
  constructor(private readonly svc: TaskCategoriesService) {}

  @Get()
  list(@Query('active') active?: string) {
    const onlyActive = active === 'true';
    return this.svc.list(onlyActive);
  }

  @Post()
  create(
    @Body() body: { name: string; sortOrder?: number },
    @CurrentUser() user: RequestUser,
  ) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.svc.create(body.name, body.sortOrder);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; sortOrder?: number; isActive?: boolean },
    @CurrentUser() user: RequestUser,
  ) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.svc.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.svc.remove(id);
  }
}
