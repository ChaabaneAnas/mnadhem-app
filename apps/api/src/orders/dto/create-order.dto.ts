import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString() variantId!: string;

  @IsInt() @Min(1) @Type(() => Number)
  quantity!: number;
}

export class CreateOrderDto {
  @IsString() @MinLength(1) reference!: string;

  @IsNumber() @Min(0) @Type(() => Number)
  codAmount!: number;

  @IsString() @MinLength(1) customerName!: string;
  @IsString() @MinLength(1) customerPhone!: string;
  @IsString() @MinLength(1) wilaya!: string;
  @IsOptional() @IsString() commune?: string;
  @IsOptional() @IsString() address?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
