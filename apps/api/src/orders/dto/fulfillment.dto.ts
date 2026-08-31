import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/**
 * Selection payload shared by the three bulk fulfillment actions. Orders that
 * are not eligible are reported back as skipped rather than rejected, so the
 * merchant can select a whole filtered page and let the server sort it out —
 * the same tolerance `ShipmentsService.remitBulk` already applies.
 */
export class BulkOrderIdsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'NO_ORDERS_SELECTED' })
  // Each id costs one carrier round-trip, so an unbounded list would hold a
  // request open for minutes. Well above any realistic packing batch.
  @ArrayMaxSize(200, { message: 'TOO_MANY_ORDERS_SELECTED' })
  @IsString({ each: true })
  orderIds!: string[];
}
