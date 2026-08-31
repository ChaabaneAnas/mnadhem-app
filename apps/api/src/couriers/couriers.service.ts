import { Injectable, NotFoundException } from '@nestjs/common';
import { Courier, type CourierAccount, type Prisma } from '@mnadhem/database';
import { PrismaService } from '../prisma/prisma.service';
import { SecretCipherService } from '../common/crypto/secret-cipher.service';
import { CourierRegistryService } from './courier-registry.service';
import type { UpdateAramexAccountDto } from './dto/courier-account.dto';

/**
 * What the API returns for the tenant's Aramex account.
 *
 * Secrets are represented by a boolean only — never the value — which is why
 * the settings form cannot pre-fill them and treats an empty field as "leave
 * unchanged".
 */
export interface AramexAccountView {
  /** Null before the merchant has saved anything. */
  id: string | null;
  enabled: boolean;
  testMode: boolean;

  username: string | null;
  hasPassword: boolean;
  accountNumber: string | null;
  hasAccountPin: boolean;
  accountEntity: string | null;
  accountCountryCode: string | null;
  version: string;

  productGroup: string;
  productType: string;
  codCurrency: string;

  shipperCompany: string | null;
  shipperContactName: string | null;
  shipperPhone: string | null;
  shipperCellPhone: string | null;
  shipperEmail: string | null;
  shipperLine1: string | null;
  shipperCity: string | null;
  shipperStateCode: string | null;
  shipperPostCode: string | null;
  shipperCountryCode: string | null;

  hasWebhookSecret: boolean;
  /** Paste target for Aramex's portal. */
  webhookPath: string;

  lastTestedAt: Date | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
}

@Injectable()
export class CouriersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipherService,
    private readonly registry: CourierRegistryService,
  ) {}

  private async tenantSlug(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    if (!tenant)
      throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Store not found' });
    return tenant.slug;
  }

  private toView(account: CourierAccount | null, tenantSlug: string): AramexAccountView {
    const webhookPath = `/api/v1/webhooks/${tenantSlug}/aramex`;

    if (!account) {
      // Defaults mirror the schema so an unsaved form renders identically to a
      // freshly saved one.
      return {
        id: null,
        enabled: false,
        testMode: true,
        username: null,
        hasPassword: false,
        accountNumber: null,
        hasAccountPin: false,
        accountEntity: null,
        accountCountryCode: null,
        version: 'v1.0',
        productGroup: 'EXP',
        productType: 'PPX',
        codCurrency: 'USD',
        shipperCompany: null,
        shipperContactName: null,
        shipperPhone: null,
        shipperCellPhone: null,
        shipperEmail: null,
        shipperLine1: null,
        shipperCity: null,
        shipperStateCode: null,
        shipperPostCode: null,
        shipperCountryCode: null,
        hasWebhookSecret: false,
        webhookPath,
        lastTestedAt: null,
        lastTestOk: null,
        lastTestError: null,
      };
    }

    return {
      id: account.id,
      enabled: account.enabled,
      testMode: account.testMode,
      username: account.username,
      hasPassword: account.passwordCipher !== null,
      accountNumber: account.accountNumber,
      hasAccountPin: account.accountPinCipher !== null,
      accountEntity: account.accountEntity,
      accountCountryCode: account.accountCountryCode,
      version: account.version,
      productGroup: account.productGroup,
      productType: account.productType,
      codCurrency: account.codCurrency,
      shipperCompany: account.shipperCompany,
      shipperContactName: account.shipperContactName,
      shipperPhone: account.shipperPhone,
      shipperCellPhone: account.shipperCellPhone,
      shipperEmail: account.shipperEmail,
      shipperLine1: account.shipperLine1,
      shipperCity: account.shipperCity,
      shipperStateCode: account.shipperStateCode,
      shipperPostCode: account.shipperPostCode,
      shipperCountryCode: account.shipperCountryCode,
      hasWebhookSecret: account.webhookSecretCipher !== null,
      webhookPath,
      lastTestedAt: account.lastTestedAt,
      lastTestOk: account.lastTestOk,
      lastTestError: account.lastTestError,
    };
  }

  async get(tenantId: string): Promise<AramexAccountView> {
    const [slug, account] = await Promise.all([
      this.tenantSlug(tenantId),
      this.prisma.courierAccount.findUnique({ where: { tenantId } }),
    ]);
    return this.toView(account, slug);
  }

  /**
   * Upserts the tenant's single account. Secrets absent from the payload are
   * left as they are, so saving the form without retyping a password keeps it.
   */
  async save(dto: UpdateAramexAccountDto, tenantId: string): Promise<AramexAccountView> {
    const slug = await this.tenantSlug(tenantId);

    const data: Prisma.CourierAccountUncheckedUpdateInput = {
      ...pick(dto, [
        'enabled',
        'testMode',
        'username',
        'accountNumber',
        'accountEntity',
        'accountCountryCode',
        'version',
        'productGroup',
        'productType',
        'codCurrency',
        'shipperCompany',
        'shipperContactName',
        'shipperPhone',
        'shipperCellPhone',
        'shipperEmail',
        'shipperLine1',
        'shipperCity',
        'shipperStateCode',
        'shipperPostCode',
        'shipperCountryCode',
      ]),
      ...(dto.password !== undefined && { passwordCipher: this.cipher.encrypt(dto.password) }),
      ...(dto.accountPin !== undefined && {
        accountPinCipher: this.cipher.encrypt(dto.accountPin),
      }),
      ...(dto.webhookSecret !== undefined && {
        webhookSecretCipher: this.cipher.encrypt(dto.webhookSecret),
      }),
    };

    const account = await this.prisma.courierAccount.upsert({
      where: { tenantId },
      update: data,
      create: { ...(data as Prisma.CourierAccountUncheckedCreateInput), tenantId, courier: Courier.ARAMEX },
    });

    return this.toView(account, slug);
  }

  /**
   * Runs a real authenticated call and records the outcome, so Settings can
   * show whether the saved credentials actually work. A failure is stored
   * rather than thrown — the merchant needs to read Aramex's reason.
   */
  async test(tenantId: string): Promise<AramexAccountView> {
    const creds = await this.registry.resolveForTest(tenantId);

    let ok = true;
    let error: string | null = null;
    try {
      await this.registry.provider.testConnection(creds);
    } catch (err) {
      ok = false;
      error = describeFailure(err);
    }

    const account = await this.prisma.courierAccount.update({
      where: { tenantId },
      data: { lastTestedAt: new Date(), lastTestOk: ok, lastTestError: error },
    });

    return this.toView(account, await this.tenantSlug(tenantId));
  }
}

/** Copies only the keys the caller actually sent, so absent means unchanged. */
function pick<T extends object, K extends keyof T>(source: T, keys: K[]): Partial<T> {
  const out: Partial<T> = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/** Nest exception bodies carry the useful text one level down, in `message`. */
function describeFailure(err: unknown): string {
  if (err instanceof Error && 'getResponse' in err && typeof err.getResponse === 'function') {
    const body = (err as { getResponse: () => unknown }).getResponse();
    if (typeof body === 'object' && body !== null && 'message' in body) {
      return String((body as { message: unknown }).message);
    }
  }
  return err instanceof Error ? err.message : 'Unknown error';
}
