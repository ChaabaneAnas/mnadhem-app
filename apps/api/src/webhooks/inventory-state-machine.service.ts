import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OrderStatus, Prisma, ShipmentStatus } from '@mnadhem/database';
import { PrismaService } from '../prisma/prisma.service';
import type { ICourierWebhookPayload, WebhookEventType } from './interfaces/courier-webhook-payload.interface';

type Tx = Prisma.TransactionClient;

interface StockDelta {
  physical: number;
  reserved: number;
  available: number;
}

// Maps each courier event to the signed delta applied per unit of quantity.
// IN_TRANSIT  : Available → Reserved (physical unchanged)
// DELIVERED   : sale finalised — physical and reserved both shrink
// RETURNED    : reservation cancelled — reserved shrinks, available recovers
// OUT_OF_ZONE : treated identically to RETURNED
const DELTA_MAP: Partial<Record<WebhookEventType, StockDelta>> = {
  IN_TRANSIT: { physical: 0, reserved: 1, available: -1 },
  DELIVERED: { physical: -1, reserved: -1, available: 0 },
  RETURNED: { physical: 0, reserved: -1, available: 1 },
  OUT_OF_ZONE: { physical: 0, reserved: -1, available: 1 },
};

const SHIPMENT_STATUS_MAP: Partial<Record<WebhookEventType, ShipmentStatus>> = {
  IN_TRANSIT: ShipmentStatus.IN_TRANSIT,
  DELIVERED: ShipmentStatus.DELIVERED,
  RETURNED: ShipmentStatus.RETURNED,
  OUT_OF_ZONE: ShipmentStatus.OUT_OF_ZONE,
};

const ORDER_STATUS_MAP: Partial<Record<WebhookEventType, OrderStatus>> = {
  IN_TRANSIT: OrderStatus.PROCESSING,
  DELIVERED: OrderStatus.DELIVERED,
  RETURNED: OrderStatus.RETURNED,
  OUT_OF_ZONE: OrderStatus.RETURNED,
};

// Every state a manual order can sit in while its stock is already reserved and
// the courier has not yet collected the parcel. Generating an AWB and requesting
// a pickup move an order through these without touching inventory, so all three
// must suppress the IN_TRANSIT reservation below — testing only for
// PENDING_FULFILLMENT would let a parcel reserve its stock a second time the
// moment the merchant used either fulfillment action.
const PRE_TRANSIT_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.PENDING_FULFILLMENT,
  OrderStatus.READY_FOR_SHIPMENT,
  OrderStatus.PICKUP_REQUESTED,
]);

@Injectable()
export class InventoryStateMachineService {
  private readonly logger = new Logger(InventoryStateMachineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reserves stock for a manually created order. Must be called inside an
   * existing $transaction from OrdersService so the stock mutation and order
   * creation are atomic.
   *
   * Moves units: stockAvailable--, stockReserved++ for each item.
   * Throws BadRequestException if any item has insufficient available stock.
   */
  async reserveForManualOrder(
    items: { variantId: string; quantity: number }[],
    tenantId: string,
    tx: Tx,
  ): Promise<void> {
    for (const item of items) {
      const variant = await tx.variant.findFirst({
        where: { id: item.variantId, product: { tenantId }, deletedAt: null },
      });

      if (!variant) {
        throw new BadRequestException(`Variant "${item.variantId}" not found in this store`);
      }
      if (variant.stockAvailable < item.quantity) {
        throw new BadRequestException(
          `Not enough stock for "${variant.name}": ${variant.stockAvailable} ready to sell, ${item.quantity} requested`,
        );
      }

      await tx.variant.update({
        where: { id: item.variantId },
        data: {
          stockAvailable: { decrement: item.quantity },
          stockReserved: { increment: item.quantity },
        },
      });
    }
  }

  /**
   * Reverses a manual order's stock reservation. Must be called inside an
   * existing $transaction from OrdersService so the stock rollback and the
   * order status update are atomic.
   *
   * Moves units: stockAvailable++, stockReserved-- for each item.
   * Safe to call if the order has no items (no-op).
   */
  async releaseOrderReservation(orderId: string, tenantId: string, tx: Tx): Promise<void> {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId },
      include: { items: true },
    });

    if (!order) return;

    for (const item of order.items) {
      await tx.variant.update({
        where: { id: item.variantId },
        data: {
          stockAvailable: { increment: item.quantity },
          stockReserved: { decrement: item.quantity },
        },
      });
    }
  }

  async handle(payload: ICourierWebhookPayload, tenantId: string): Promise<void> {
    const { trackingNumber, event, courier, rawPayload } = payload;

    const shipment = await this.prisma.shipment.findUnique({
      where: { trackingNumber },
      include: { order: { include: { items: true } } },
    });

    if (!shipment) {
      this.logger.warn(`Unmatched webhook — tracking: ${trackingNumber}, event: ${event}`);
    }

    await this.prisma.$transaction(async (tx) => {
      const deltaSign = DELTA_MAP[event];
      const newShipmentStatus = SHIPMENT_STATUS_MAP[event];
      const newOrderStatus = ORDER_STATUS_MAP[event];
      const stockDeltas: unknown[] = [];

      if (shipment && deltaSign) {
        // IN_TRANSIT on an order that has not yet been collected means stock was
        // already reserved at manual order creation time — skip the inventory
        // mutation and only advance the statuses to avoid a double-reservation.
        const stockAlreadyReserved =
          event === 'IN_TRANSIT' && PRE_TRANSIT_STATUSES.has(shipment.order.status);

        if (!stockAlreadyReserved) {
          for (const item of shipment.order.items) {
            await tx.variant.update({
              where: { id: item.variantId },
              data: {
                stockPhysical: { increment: deltaSign.physical * item.quantity },
                stockReserved: { increment: deltaSign.reserved * item.quantity },
                stockAvailable: { increment: deltaSign.available * item.quantity },
              },
            });

            stockDeltas.push({
              variantId: item.variantId,
              quantity: item.quantity,
              delta: deltaSign,
            });
          }
        }

        await tx.shipment.update({
          where: { id: shipment.id },
          data: {
            ...(newShipmentStatus && { status: newShipmentStatus }),
            ...(event === 'DELIVERED' && { collectedCash: shipment.order.codAmount }),
          },
        });

        if (newOrderStatus) {
          await tx.order.update({
            where: { id: shipment.orderId },
            data: { status: newOrderStatus },
          });
        }
      }

      // Immutable audit record — always written, even for unmatched webhooks
      await tx.webhookEvent.create({
        data: {
          courier,
          eventType: event,
          payload: rawPayload as never,
          tenantId,
          shipmentId: shipment?.id ?? null,
          stockDelta: stockDeltas.length > 0 ? (stockDeltas as never) : undefined,
        },
      });
    });

    this.logger.log(`Handled ${event} for ${trackingNumber} (tenant: ${tenantId})`);
  }
}
