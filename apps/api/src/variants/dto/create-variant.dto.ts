import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVariantDto {
  @IsString() name!: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() size?: string;
  @IsOptional() @IsString() sku?: string;

  @IsNumber() @Min(0) @Type(() => Number)
  price!: number;

  @IsInt() @Min(0) @Type(() => Number)
  stockPhysical: number = 0;
}
