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
// EN_COURS  : Available → Reserved (physical unchanged)
// LIVRE     : sale finalised — physical and reserved both shrink
// RETOURNE  : reservation cancelled — reserved shrinks, available recovers
// HORS_ZONE : treated identically to RETOURNE
const DELTA_MAP: Partial<Record<WebhookEventType, StockDelta>> = {
  EN_COURS: { physical: 0, reserved: 1, available: -1 },
  LIVRE: { physical: -1, reserved: -1, available: 0 },
  RETOURNE: { physical: 0, reserved: -1, available: 1 },
  HORS_ZONE: { physical: 0, reserved: -1, available: 1 },
};

const SHIPMENT_STATUS_MAP: Partial<Record<WebhookEventType, ShipmentStatus>> = {
  EN_COURS: ShipmentStatus.EN_COURS,
  LIVRE: ShipmentStatus.LIVRE,
  RETOURNE: ShipmentStatus.RETOURNE,
  HORS_ZONE: ShipmentStatus.HORS_ZONE,
};

const ORDER_STATUS_MAP: Partial<Record<WebhookEventType, OrderStatus>> = {
  EN_COURS: OrderStatus.PROCESSING,
  LIVRE: OrderStatus.DELIVERED,
  RETOURNE: OrderStatus.RETURNED,
  HORS_ZONE: OrderStatus.RETURNED,
};

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
        // EN_COURS on a PENDING_FULFILLMENT order means stock was already reserved
        // at manual order creation time — skip the inventory mutation and only
        // advance the statuses to avoid a double-reservation.
        const stockAlreadyReserved =
          event === 'EN_COURS' &&
          shipment.order.status === OrderStatus.PENDING_FULFILLMENT;

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
            ...(event === 'LIVRE' && { collectedCash: shipment.order.codAmount }),
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
