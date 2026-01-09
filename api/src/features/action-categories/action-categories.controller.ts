import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ActionCategoriesService } from './action-categories.service';

@Controller('action-categories')
export class ActionCategoriesController {
  constructor(private readonly svc: ActionCategoriesService) {}

  @Get()
  async list(@Query('activeOnly') activeOnly?: string) {
    const flag = activeOnly === '1' || activeOnly === 'true';
    return this.svc.list({ activeOnly: flag });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      description?: string;
      color?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.svc.create(body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      color?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.svc.update(id, body);
  }

  // Soft delete (sets isActive=false)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.softDelete(id);
  }
}
