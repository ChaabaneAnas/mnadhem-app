import { IsString, MinLength, Matches, IsOptional } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, numbers, and hyphens only' })
  slug!: string;

  @IsOptional() @IsString() yalidineApiKey?: string;
  @IsOptional() @IsString() aramexApiKey?: string;
  @IsOptional() @IsString() jexportApiKey?: string;
}
