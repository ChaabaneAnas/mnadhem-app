import { BadRequestException, Injectable } from '@nestjs/common';
import type { CourierAccount } from '@mnadhem/database';
import { PrismaService } from '../prisma/prisma.service';
import { SecretCipherService } from '../common/crypto/secret-cipher.service';
import { AramexProvider } from './providers/aramex.provider';
import type { AramexCredentials } from './carrier.types';

/**
 * Resolves a tenant's Aramex account and hands back its decrypted credentials.
 *
 * There is one carrier and one account per tenant, so this is a lookup rather
 * than the provider-selection registry it used to be. Ciphertext never leaves
 * this class.
 */
@Injectable()
export class CourierRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipherService,
    readonly provider: AramexProvider,
  ) {}

  /** The tenant's carrier, ready to call. Throws if it cannot be used. */
  async resolveForTenant(tenantId: string): Promise<AramexCredentials> {
    const account = await this.prisma.courierAccount.findUnique({ where: { tenantId } });

    if (!account) {
      throw new BadRequestException({
        code: 'ARAMEX_NOT_CONFIGURED',
        message: 'Aramex is not set up yet. Add your account details in Settings.',
      });
    }
    if (!account.enabled) {
      throw new BadRequestException({
        code: 'COURIER_DISABLED',
        message: 'Aramex is turned off. Enable it in Settings first.',
      });
    }

    return this.credentialsFor(account);
  }

  /**
   * Used by the Test-connection button, which must work on an account that is
   * saved but not yet enabled — that is the whole point of testing it.
   */
  async resolveForTest(tenantId: string): Promise<AramexCredentials> {
    const account = await this.prisma.courierAccount.findUnique({ where: { tenantId } });
    if (!account) {
      throw new BadRequestException({
        code: 'ARAMEX_NOT_CONFIGURED',
        message: 'Aramex is not set up yet. Add your account details in Settings.',
      });
    }
    return this.credentialsFor(account);
  }

  /**
   * Aramex authenticates with a password *and* an account PIN, so both secrets
   * must be present. An account backfilled from the old `Tenant.aramexApiKey`
   * column carries only a webhook secret and lands here until the merchant
   * enters the rest.
   */
  private credentialsFor(account: CourierAccount): AramexCredentials {
    if (!account.username || !account.passwordCipher || !account.accountNumber || !account.accountPinCipher) {
      throw new BadRequestException({
        code: 'COURIER_CREDENTIAL_MISSING',
        message:
          'Your Aramex credentials are incomplete. Add the username, password, account number and PIN in Settings.',
      });
    }

    this.cipher.warnIfLegacy(account.passwordCipher, `CourierAccount ${account.id}`);

    return {
      account,
      password: this.cipher.decrypt(account.passwordCipher),
      accountPin: this.cipher.decrypt(account.accountPinCipher),
    };
  }

  /**
   * Inbound counterpart, used by the webhook controller to authenticate Aramex
   * calling us. Null when no secret is configured.
   */
  webhookSecretFor(account: CourierAccount): string | null {
    if (!account.webhookSecretCipher) return null;
    this.cipher.warnIfLegacy(account.webhookSecretCipher, `CourierAccount ${account.id}`);
    return this.cipher.decrypt(account.webhookSecretCipher);
  }

  trackingUrl(awbNumber: string): string {
    return this.provider.trackingUrl(awbNumber);
  }
}
