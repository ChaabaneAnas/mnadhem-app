import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class StockAdjustmentDto {
  @IsInt()
  @Type(() => Number)
  physicalDelta!: number;
}
