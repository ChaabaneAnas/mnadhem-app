import { IsEnum, IsString } from 'class-validator';
import { Courier } from '@mnadhem/database';

export class CreateShipmentDto {
  @IsString() orderId!: string;
  @IsString() trackingNumber!: string;
  @IsEnum(Courier) courier!: Courier;
}
