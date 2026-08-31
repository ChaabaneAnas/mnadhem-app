import { IsBoolean, IsOptional, IsString, Length, MinLength } from 'class-validator';

/**
 * Aramex account settings. Every field is optional so the form can be saved
 * incrementally — the merchant collects these from Aramex over time, and being
 * unable to save a half-filled form would be worse than storing one.
 * Completeness is enforced where it matters: at the point of calling Aramex.
 *
 * Validator `message` values are stable SCREAMING_SNAKE codes that
 * `main.ts`'s validationExceptionFactory hoists into `code`, matching
 * `create-tenant.dto.ts`.
 *
 * Secrets omitted from the payload leave the stored value untouched — the API
 * never returns them, so the form cannot echo one back.
 */
export class UpdateAramexAccountDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  testMode?: boolean;

  // --- ClientInfo ---
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'CARRIER_CREDENTIAL_EMPTY' })
  password?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'CARRIER_CREDENTIAL_EMPTY' })
  accountPin?: string;

  @IsOptional()
  @IsString()
  @Length(1, 3, { message: 'ARAMEX_ENTITY_INVALID' })
  accountEntity?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'ARAMEX_COUNTRY_INVALID' })
  accountCountryCode?: string;

  /** Max length 4 per the manual, which never states the expected value. */
  @IsOptional()
  @IsString()
  @Length(1, 4, { message: 'ARAMEX_VERSION_INVALID' })
  version?: string;

  // --- Shipping defaults ---
  @IsOptional()
  @IsString()
  @Length(1, 3, { message: 'ARAMEX_PRODUCT_GROUP_INVALID' })
  productGroup?: string;

  @IsOptional()
  @IsString()
  @Length(1, 3, { message: 'ARAMEX_PRODUCT_TYPE_INVALID' })
  productType?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'ARAMEX_CURRENCY_INVALID' })
  codCurrency?: string;

  // --- Shipper / pickup identity ---
  @IsOptional() @IsString() shipperCompany?: string;
  @IsOptional() @IsString() shipperContactName?: string;
  @IsOptional() @IsString() shipperPhone?: string;
  @IsOptional() @IsString() shipperCellPhone?: string;
  @IsOptional() @IsString() shipperEmail?: string;
  @IsOptional() @IsString() shipperLine1?: string;
  @IsOptional() @IsString() shipperCity?: string;
  @IsOptional() @IsString() shipperStateCode?: string;
  @IsOptional() @IsString() shipperPostCode?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'ARAMEX_COUNTRY_INVALID' })
  shipperCountryCode?: string;

  /** Inbound webhook shared secret, separate from the outbound credentials. */
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'CARRIER_CREDENTIAL_EMPTY' })
  webhookSecret?: string;
}
