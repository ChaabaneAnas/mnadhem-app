import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  HttpCode,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Courier } from '@mnadhem/database';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryStateMachineService } from './inventory-state-machine.service';
import { YalidineAdapter } from './adapters/yalidine.adapter';
import { AramexAdapter } from './adapters/aramex.adapter';
import { JexportAdapter } from './adapters/jexport.adapter';
import type { ICourierAdapter } from './interfaces/courier-adapter.interface';

const COURIER_PARAM_MAP: Record<string, Courier> = {
  yalidine: Courier.YALIDINE,
  aramex: Courier.ARAMEX,
  jexport: Courier.JEXPORT,
};

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: InventoryStateMachineService,
    private readonly yalidine: YalidineAdapter,
    private readonly aramex: AramexAdapter,
    private readonly jexport: JexportAdapter,
  ) {}

  /**
   * Entry point for all courier webhooks.
   * URL:  POST /api/v1/webhooks/:tenantSlug/:courier
   * Auth: x-api-key header must match the tenant's stored key for that courier.
   */
  @Post(':tenantSlug/:courier')
  @HttpCode(200)
  async handleWebhook(
    @Param('tenantSlug') tenantSlug: string,
    @Param('courier') courierParam: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-api-key') apiKey: string,
  ) {
    // 1. Resolve courier
    const courier = COURIER_PARAM_MAP[courierParam.toLowerCase()];
    if (!courier)
      throw new BadRequestException({
        code: 'UNKNOWN_COURIER',
        message: `Unknown courier: ${courierParam}`,
      });

    // 2. Resolve tenant
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant)
      throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });

    // 3. Validate API key against the tenant's stored key for this courier
    this.validateApiKey(tenant, courier, apiKey);

    // 4. Normalize via the correct adapter
    const adapter = this.getAdapter(courier);
    const payload = adapter.normalize(body);

    // 5. Drive the inventory state machine
    await this.stateMachine.handle(payload, tenant.id);

    return { received: true };
  }

  private validateApiKey(
    tenant: { yalidineApiKey: string | null; aramexApiKey: string | null; jexportApiKey: string | null },
    courier: Courier,
    apiKey: string,
  ) {
    const keyMap: Record<Courier, string | null> = {
      [Courier.YALIDINE]: tenant.yalidineApiKey,
      [Courier.ARAMEX]: tenant.aramexApiKey,
      [Courier.JEXPORT]: tenant.jexportApiKey,
    };

    const storedKey = keyMap[courier];
    if (!storedKey || storedKey !== apiKey) {
      throw new UnauthorizedException({
        code: 'INVALID_COURIER_API_KEY',
        message: 'Invalid API key for courier',
      });
    }
  }

  private getAdapter(courier: Courier): ICourierAdapter {
    const adapterMap: Record<Courier, ICourierAdapter> = {
      [Courier.YALIDINE]: this.yalidine,
      [Courier.ARAMEX]: this.aramex,
      [Courier.JEXPORT]: this.jexport,
    };
    return adapterMap[courier];
  }
}
