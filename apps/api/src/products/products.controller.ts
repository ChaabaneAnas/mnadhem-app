import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { TenantId } from '../common/decorators/user.decorator';
import { ProductsService } from './products.service';
import { BulkCreateDto } from './dto/bulk-create.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
@UseGuards(JwtGuard)
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  /** Bulk-create products from CSV-parsed rows. Skips rows with existing SKUs (idempotent). */
  @Post('bulk-create')
  bulkCreate(@Body() dto: BulkCreateDto, @TenantId() tenantId: string) {
    return this.service.bulkCreate(dto, tenantId);
  }

  @Post()
  create(@Body() dto: CreateProductDto, @TenantId() tenantId: string) {
    return this.service.create(dto, tenantId);
  }

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @TenantId() tenantId: string,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
