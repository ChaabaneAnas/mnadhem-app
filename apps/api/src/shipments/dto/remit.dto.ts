import { ArrayNotEmpty, IsArray, IsBoolean, IsString } from 'class-validator';

/** Body for the bulk payout endpoint — one courier settlement, many parcels. */
export class RemitBulkDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  shipmentIds!: string[];
}

/** Body for the per-shipment toggle; `false` undoes a mistaken payout entry. */
export class SetRemittedDto {
  @IsBoolean() remitted!: boolean;
}
