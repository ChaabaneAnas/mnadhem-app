import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { TenantId } from '../common/decorators/user.decorator';
import { OrdersService } from './orders.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { BulkOrderIdsDto } from './dto/fulfillment.dto';

@Controller('orders')
@UseGuards(JwtGuard)
export class OrdersController {
  constructor(
    private readonly service: OrdersService,
    private readonly fulfillment: OrderFulfillmentService,
  ) {}

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

  // ── Fulfillment actions ──────────────────────────────────────────────────
  //
  // All three take a list and report `{ succeeded, skipped }` rather than
  // failing on the first ineligible order, so the merchant can select a whole
  // filtered page. Declared before `GET :id` and `POST :id/...` would collide —
  // Nest matches in declaration order, so literal paths come first.

  /** Books labels for the selected PENDING orders with the default carrier. */
  @Post('awb')
  generateAwbs(@Body() dto: BulkOrderIdsDto, @TenantId() tenantId: string) {
    return this.fulfillment.generateAwbs(dto.orderIds, tenantId);
  }

  /** Requests courier collection for the selected READY_FOR_SHIPMENT orders. */
  @Post('pickup')
  requestPickups(@Body() dto: BulkOrderIdsDto, @TenantId() tenantId: string) {
    return this.fulfillment.requestPickups(dto.orderIds, tenantId);
  }

  /**
   * Merges the selected orders' labels into one PDF, returned base64 in JSON
   * rather than streamed: the caller is a Next.js server action, which cannot
   * forward a binary stream, and this keeps the skipped-order reporting
   * identical to the other two bulk actions.
   */
  @Post('labels/print')
  printLabels(@Body() dto: BulkOrderIdsDto, @TenantId() tenantId: string) {
    return this.fulfillment.printLabels(dto.orderIds, tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  /** Single-order AWB. The bulk endpoint above handles a selection. */
  @Post(':id/awb')
  generateAwb(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.fulfillment.generateAwbs([id], tenantId);
  }

  /** Public tracking page for this order's parcel, or null. */
  @Get(':id/tracking')
  tracking(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.fulfillment.trackingUrl(id, tenantId);
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
