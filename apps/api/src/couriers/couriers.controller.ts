import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { TenantId } from '../common/decorators/user.decorator';
import { CouriersService } from './couriers.service';
import { UpdateAramexAccountDto } from './dto/courier-account.dto';

/**
 * The tenant's Aramex configuration. One account per tenant, so these are
 * singleton routes with no id in the path.
 */
@Controller('couriers')
@UseGuards(JwtGuard)
export class CouriersController {
  constructor(private readonly service: CouriersService) {}

  /** Current settings, with secrets reduced to "configured or not". */
  @Get('aramex')
  get(@TenantId() tenantId: string) {
    return this.service.get(tenantId);
  }

  @Put('aramex')
  save(@Body() dto: UpdateAramexAccountDto, @TenantId() tenantId: string) {
    return this.service.save(dto, tenantId);
  }

  /** Verifies the saved credentials against Aramex and records the result. */
  @Post('aramex/test')
  test(@TenantId() tenantId: string) {
    return this.service.test(tenantId);
  }
}
