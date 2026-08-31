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
import type { CourierAccount } from '@mnadhem/database';
import { PrismaService } from '../prisma/prisma.service';
import { SecretCipherService } from '../common/crypto/secret-cipher.service';
import { InventoryStateMachineService } from './inventory-state-machine.service';
import { AramexAdapter } from './adapters/aramex.adapter';

/** The only carrier, and the only accepted path segment. */
const ARAMEX_SLUG = 'aramex';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipherService,
    private readonly stateMachine: InventoryStateMachineService,
    private readonly aramex: AramexAdapter,
  ) {}

  /**
   * Entry point for Aramex status webhooks.
   * URL:  POST /api/v1/webhooks/:tenantSlug/aramex
   * Auth: x-api-key must match the tenant's stored webhook secret.
   */
  @Post(':tenantSlug/:courier')
  @HttpCode(200)
  async handleWebhook(
    @Param('tenantSlug') tenantSlug: string,
    @Param('courier') courier: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-api-key') apiKey: string,
  ) {
    if (courier.toLowerCase() !== ARAMEX_SLUG) {
      throw new BadRequestException({
        code: 'UNKNOWN_COURIER',
        message: `Unknown courier: ${courier}`,
      });
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant)
      throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });

    const account = await this.prisma.courierAccount.findUnique({
      where: { tenantId: tenant.id },
    });
    if (!account)
      throw new UnauthorizedException({
        code: 'INVALID_COURIER_API_KEY',
        message: 'Invalid API key for courier',
      });

    this.validateApiKey(account, apiKey);

    const payload = this.aramex.normalize(body);
    await this.stateMachine.handle(payload, tenant.id);

    return { received: true };
  }

  /**
   * Compares in constant time. A plain `!==` returns as soon as two bytes
   * differ, so response timing leaks how much of a guessed key was correct.
   */
  private validateApiKey(account: CourierAccount, apiKey: string) {
    const stored = account.webhookSecretCipher;
    if (!stored || !apiKey) {
      throw new UnauthorizedException({
        code: 'INVALID_COURIER_API_KEY',
        message: 'Invalid API key for courier',
      });
    }

    this.cipher.warnIfLegacy(stored, `CourierAccount ${account.id}`);

    if (!this.cipher.matches(apiKey, this.cipher.decrypt(stored))) {
      throw new UnauthorizedException({
        code: 'INVALID_COURIER_API_KEY',
        message: 'Invalid API key for courier',
      });
    }
  }
}
