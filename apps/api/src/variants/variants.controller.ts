import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { TenantId } from '../common/decorators/user.decorator';
import { VariantsService } from './variants.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';

@Controller()
@UseGuards(JwtGuard)
export class VariantsController {
  constructor(private readonly service: VariantsService) {}

  @Post('products/:productId/variants')
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateVariantDto,
    @TenantId() tenantId: string,
  ) {
    return this.service.create(productId, dto, tenantId);
  }

  @Get('products/:productId/variants')
  findAll(@Param('productId') productId: string, @TenantId() tenantId: string) {
    return this.service.findAll(productId, tenantId);
  }

  @Get('variants/:id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  @Patch('variants/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVariantDto,
    @TenantId() tenantId: string,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Patch('variants/:id/stock')
  adjustStock(
    @Param('id') id: string,
    @Body() dto: StockAdjustmentDto,
    @TenantId() tenantId: string,
  ) {
    return this.service.adjustStock(id, dto, tenantId);
  }

  @Delete('variants/:id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
