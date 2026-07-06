import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkCreateRowDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() variantName?: string;
  @IsOptional() @IsString() variantSku?: string;

  @IsNumber() @Min(0) @Type(() => Number)
  price!: number;

  @IsInt() @Min(0) @Type(() => Number)
  stockPhysical!: number;
}

export class BulkCreateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCreateRowDto)
  rows!: BulkCreateRowDto[];
}
