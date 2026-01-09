import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateHazardCategoryDto, CreateHazardDto } from './dto';
import { HazardsService } from './hazards.service';

@ApiTags('Hazards')
@Controller()
export class HazardsController {
  constructor(private readonly svc: HazardsService) {}

  @Get('hazard-categories')
  categories() {
    return this.svc.listCategoriesWithHazards();
  }

  @Post('hazard-categories')
  createCategory(@Body() dto: CreateHazardCategoryDto) {
    return this.svc.createCategory(dto.name, dto.sortOrder ?? 0);
  }

  @Get('hazards')
  hazards(@Query('categoryId') categoryId?: string, @Query('q') q?: string) {
    return this.svc.listHazards({ categoryId, q });
  }

  @Post('hazards')
  createHazard(@Body() dto: CreateHazardDto) {
    return this.svc.createHazard(dto);
  }
}
