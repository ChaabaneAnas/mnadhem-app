import { IsString, MinLength, Matches, IsOptional } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  // Message is a stable error code the frontend maps to a translated string.
  @Matches(/^[a-z0-9-]+$/, { message: 'SLUG_INVALID_FORMAT' })
  slug!: string;

  @IsOptional() @IsString() yalidineApiKey?: string;
  @IsOptional() @IsString() aramexApiKey?: string;
  @IsOptional() @IsString() jexportApiKey?: string;
}
