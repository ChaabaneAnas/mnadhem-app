import { IsString, MinLength, Matches } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  // Message is a stable error code the frontend maps to a translated string.
  @Matches(/^[a-z0-9-]+$/, { message: 'SLUG_INVALID_FORMAT' })
  slug!: string;

  // Courier credentials used to live here as three plaintext columns. They now
  // belong to CourierAccount, one row per configured carrier, encrypted at rest
  // and reachable only through /couriers/accounts — which also keeps a carrier's
  // outbound API key separate from its inbound webhook secret.
}
