import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() description?: string;
}
