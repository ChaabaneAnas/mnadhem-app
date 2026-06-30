import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { TenantId } from '../common/decorators/user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
@UseGuards(JwtGuard)
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  /** Manual order creation with immediate stock reservation — primary path for User B merchants. */
  @Post('manual')
  createManual(@Body() dto: CreateOrderDto, @TenantId() tenantId: string) {
    return this.service.createManual(dto, tenantId);
  }

  /** Generic order creation without stock reservation — reserved for future storefront webhook ingestion. */
  @Post()
  create(@Body() dto: CreateOrderDto, @TenantId() tenantId: string) {
    return this.service.create(dto, tenantId);
  }

  @Get()
  findAll(@TenantId() tenantId: string, @Query('wilaya') wilaya?: string) {
    return this.service.findAll(tenantId, wilaya);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  /** Cancels a PENDING_FULFILLMENT order and releases its stock reservation. */
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.cancel(id, tenantId);
  }

  /** Soft-deletes an order. Releases stock reservation if still PENDING_FULFILLMENT. */
  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
