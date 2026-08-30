import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { TenantId } from '../common/decorators/user.decorator';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { RemitBulkDto, SetRemittedDto } from './dto/remit.dto';

@Controller('shipments')
@UseGuards(JwtGuard)
export class ShipmentsController {
  constructor(private readonly service: ShipmentsService) {}

  @Post()
  create(@Body() dto: CreateShipmentDto, @TenantId() tenantId: string) {
    return this.service.create(dto, tenantId);
  }

  /**
   * Delivered parcels the courier still owes cash on.
   *
   * Declared before `GET :id` — Nest matches routes in declaration order, so the
   * other way round this path is swallowed as an id and 404s.
   */
  @Get('awaiting-remittance')
  awaitingRemittance(@TenantId() tenantId: string) {
    return this.service.listAwaitingRemittance(tenantId);
  }

  /** Records one courier settlement covering many parcels. */
  @Post('remit')
  remitBulk(@Body() dto: RemitBulkDto, @TenantId() tenantId: string) {
    return this.service.remitBulk(dto.shipmentIds, tenantId);
  }

  /** Marks a single parcel paid or, with `remitted: false`, undoes that. */
  @Patch(':id/remit')
  setRemitted(
    @Param('id') id: string,
    @Body() dto: SetRemittedDto,
    @TenantId() tenantId: string,
  ) {
    return this.service.setRemitted(id, dto.remitted, tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }
}
