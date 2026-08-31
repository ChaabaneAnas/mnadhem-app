import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus, ShipmentStatus, type Courier, type Prisma } from '@mnadhem/database';
import { PDFDocument } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import { CourierRegistryService } from '../couriers/courier-registry.service';
import type { AramexCredentials, AwbRequest } from '../couriers/carrier.types';

/**
 * The on-demand steps between a confirmed order and a collected parcel:
 * request an AWB, print the label, ask for a pickup.
 *
 * Kept out of OrdersService, which owns order CRUD and stock reservation. The
 * two touch the same rows but for different reasons, and only this one talks to
 * a carrier.
 *
 * None of these actions moves stock. A manual order reserves its stock at
 * creation (OrdersService.createManual), so an AWB and a pickup only advance
 * the order's status — see PRE_TRANSIT_STATUSES in the inventory state machine,
 * which relies on exactly that.
 */

export interface SkippedOrder {
  orderId: string;
  reference: string;
  /** Stable code the frontend translates; see the `errors` message namespace. */
  reason: string;
}

export interface FulfillmentResult {
  succeeded: number;
  skipped: SkippedOrder[];
}

export interface PrintLabelsResult extends FulfillmentResult {
  /** Merged PDF, base64. Null when nothing printable was selected. */
  pdfBase64: string | null;
}

/** Order shape the fulfillment actions need, including what a carrier asks for. */
const ORDER_INCLUDE = {
  items: { include: { variant: { select: { name: true } } } },
  shipment: true,
} satisfies Prisma.OrderInclude;

type FulfillableOrder = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

@Injectable()
export class OrderFulfillmentService {
  private readonly logger = new Logger(OrderFulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: CourierRegistryService,
  ) {}

  private load(orderIds: string[], tenantId: string): Promise<FulfillableOrder[]> {
    return this.prisma.order.findMany({
      where: { id: { in: [...new Set(orderIds)] }, tenantId, deletedAt: null },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Ids that matched no live order — deleted, or another tenant's. Reported as
   * skipped rather than ignored, so the counts in the toast always add up to
   * what the merchant selected.
   */
  private missing(orderIds: string[], found: FulfillableOrder[]): SkippedOrder[] {
    const seen = new Set(found.map((order) => order.id));
    return [...new Set(orderIds)]
      .filter((id) => !seen.has(id))
      .map((id) => ({ orderId: id, reference: '—', reason: 'ORDER_NOT_FOUND' }));
  }

  private toAwbRequest(order: FulfillableOrder): AwbRequest {
    return {
      reference: order.reference,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      wilaya: order.wilaya,
      commune: order.commune,
      address: order.address,
      codAmount: Number(order.codAmount),
      items: order.items.map((item) => ({
        name: item.variant.name,
        quantity: item.quantity,
      })),
    };
  }

  // ── AWB generation ────────────────────────────────────────────────────────

  /**
   * Books a label for every eligible order against the tenant's default carrier.
   *
   * The carrier call deliberately runs *outside* the database transaction.
   * Stock mutations must be transactional (CLAUDE.md rule 2), but holding a
   * transaction open across a network round-trip is what exhausts the pool
   * during a webhook burst — and these run in a loop. Each order gets its own
   * short transaction after its carrier call returns, so a failure on the
   * seventh parcel leaves the first six correctly recorded.
   */
  async generateAwbs(orderIds: string[], tenantId: string): Promise<FulfillmentResult> {
    const orders = await this.load(orderIds, tenantId);
    const skipped = this.missing(orderIds, orders);

    const eligible = orders.filter((order) => {
      const reason = this.awbIneligibility(order);
      if (reason) skipped.push({ orderId: order.id, reference: order.reference, reason });
      return reason === null;
    });

    if (eligible.length === 0) return { succeeded: 0, skipped };

    // Resolved once: a missing or disabled carrier should fail the whole action
    // loudly rather than reporting every order as individually skipped.
    const courier = await this.registry.resolveForTenant(tenantId);

    let succeeded = 0;
    for (const order of eligible) {
      const outcome = await this.generateOne(order, courier);
      if (outcome === null) succeeded += 1;
      else skipped.push({ orderId: order.id, reference: order.reference, reason: outcome });
    }

    return { succeeded, skipped };
  }

  /** Returns a skip reason, or null when the order can have an AWB generated. */
  private awbIneligibility(order: FulfillableOrder): string | null {
    // Checked before status: an order that already has a waybill must never be
    // sent to the carrier again. Carriers bill per label, and a second one
    // creates a ghost parcel nobody will ever collect.
    if (order.shipment) return 'ORDER_ALREADY_HAS_AWB';
    if (order.status !== OrderStatus.PENDING_FULFILLMENT) return 'ORDER_NOT_PENDING';
    return null;
  }

  private async generateOne(
    order: FulfillableOrder,
    courier: AramexCredentials,
  ): Promise<string | null> {
    let awb: Awaited<ReturnType<typeof this.registry.provider.generateAwb>>;
    try {
      awb = await this.registry.provider.generateAwb(this.toAwbRequest(order), courier);
    } catch (err) {
      this.logger.warn(
        `AWB generation failed for ${order.reference}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return this.codeOf(err, 'COURIER_API_ERROR');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.shipment.create({
          data: {
            orderId: order.id,
            trackingNumber: awb.awbNumber,
            courier: courier.account.courier,
            courierAccountId: courier.account.id,
            status: ShipmentStatus.PENDING,
            // Prisma's Bytes maps to Uint8Array; Buffer's backing store is typed
            // as possibly shared, so copy into a plain view rather than cast.
            labelPdf: awb.labelPdf ? new Uint8Array(awb.labelPdf) : null,
            labelPdfUrl: awb.labelPdfUrl,
            awbGeneratedAt: new Date(),
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.READY_FOR_SHIPMENT },
        });
      });
      return null;
    } catch (err) {
      // The carrier has already issued this waybill and charged for it, so the
      // number is logged at error level: it is the only record left, and the
      // shipment can be reconciled by hand from it.
      this.logger.error(
        `Carrier issued AWB ${awb.awbNumber} for order ${order.reference} (${order.id}) but it ` +
          `could not be saved: ${err instanceof Error ? err.message : 'unknown'}. ` +
          'This label exists at the carrier and needs manual reconciliation.',
      );
      return 'AWB_NOT_RECORDED';
    }
  }

  // ── Pickup requests ───────────────────────────────────────────────────────

  /**
   * Asks Aramex to collect the selected parcels in a single visit — the carrier
   * schedules and prices a pickup per visit, not per parcel, so all the eligible
   * waybills go in one call.
   */
  async requestPickups(orderIds: string[], tenantId: string): Promise<FulfillmentResult> {
    const orders = await this.load(orderIds, tenantId);
    const skipped = this.missing(orderIds, orders);

    const eligible = orders.filter((order) => {
      const reason = this.pickupIneligibility(order);
      if (reason) skipped.push({ orderId: order.id, reference: order.reference, reason });
      return reason === null;
    });

    if (eligible.length === 0) return { succeeded: 0, skipped };

    const courier = await this.registry.resolveForTenant(tenantId);
    const awbNumbers = eligible.map((order) => order.shipment!.trackingNumber);

    let pickup: Awaited<ReturnType<typeof this.registry.provider.requestPickup>>;
    try {
      pickup = await this.registry.provider.requestPickup(awbNumbers, courier);
    } catch (err) {
      this.logger.warn(
        `Pickup request failed for ${awbNumbers.length} parcel(s): ` +
          `${err instanceof Error ? err.message : 'unknown'}`,
      );
      const reason = this.codeOf(err, 'COURIER_API_ERROR');
      for (const order of eligible) {
        skipped.push({ orderId: order.id, reference: order.reference, reason });
      }
      return { succeeded: 0, skipped };
    }

    // One transaction for the batch: the carrier committed to a single visit,
    // so the orders either all reflect it or none do.
    const eligibleIds = eligible.map((order) => order.id);
    await this.prisma.$transaction([
      this.prisma.shipment.updateMany({
        where: { orderId: { in: eligibleIds } },
        data: {
          pickupReference: pickup.pickupReference,
          pickupScheduledAt: pickup.scheduledAt,
        },
      }),
      this.prisma.order.updateMany({
        where: { id: { in: eligibleIds } },
        data: { status: OrderStatus.PICKUP_REQUESTED },
      }),
    ]);

    return { succeeded: eligible.length, skipped };
  }

  private pickupIneligibility(order: FulfillableOrder): string | null {
    if (order.status !== OrderStatus.READY_FOR_SHIPMENT) return 'ORDER_NOT_READY';
    if (!order.shipment) return 'ORDER_HAS_NO_AWB';
    return null;
  }

  // ── Label printing ────────────────────────────────────────────────────────

  /**
   * Merges the stored labels into one document, in the order the merchant sees
   * them, so a packing batch is a single print job rather than N downloads.
   *
   * Reads the bytes captured at AWB generation rather than re-fetching from the
   * carrier: printing stays fast, works offline, and survives the carrier
   * expiring its label links.
   */
  async printLabels(orderIds: string[], tenantId: string): Promise<PrintLabelsResult> {
    const orders = await this.load(orderIds, tenantId);
    const skipped = this.missing(orderIds, orders);

    const printable = orders.filter((order) => {
      if (!order.shipment) {
        skipped.push({ orderId: order.id, reference: order.reference, reason: 'ORDER_HAS_NO_AWB' });
        return false;
      }
      if (!order.shipment.labelPdf) {
        skipped.push({ orderId: order.id, reference: order.reference, reason: 'LABEL_NOT_STORED' });
        return false;
      }
      return true;
    });

    if (printable.length === 0) return { succeeded: 0, skipped, pdfBase64: null };

    const merged = await PDFDocument.create();
    let succeeded = 0;

    for (const order of printable) {
      try {
        const source = await PDFDocument.load(Uint8Array.from(order.shipment!.labelPdf!));
        const pages = await merged.copyPages(source, source.getPageIndices());
        for (const page of pages) merged.addPage(page);
        succeeded += 1;
      } catch (err) {
        // One corrupt label must not cost the merchant the rest of the batch.
        this.logger.warn(
          `Label for ${order.reference} could not be merged: ${err instanceof Error ? err.message : 'unknown'}`,
        );
        skipped.push({
          orderId: order.id,
          reference: order.reference,
          reason: 'LABEL_UNREADABLE',
        });
      }
    }

    if (succeeded === 0) return { succeeded: 0, skipped, pdfBase64: null };

    return {
      succeeded,
      skipped,
      pdfBase64: Buffer.from(await merged.save()).toString('base64'),
    };
  }

  // ── Tracking ──────────────────────────────────────────────────────────────

  /** Public tracking page for one order's parcel, or null if unavailable. */
  async trackingUrl(orderId: string, tenantId: string): Promise<{ url: string | null }> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      include: { shipment: true },
    });

    if (!order)
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });

    const { shipment } = order;
    if (!shipment) return { url: null };

    return { url: this.registry.trackingUrl(shipment.trackingNumber) };
  }

  /**
   * Pulls the stable `code` out of a Nest exception body so a per-order skip
   * reason stays translatable, falling back when the error is something else.
   */
  private codeOf(err: unknown, fallback: string): string {
    if (err instanceof Error && 'getResponse' in err && typeof err.getResponse === 'function') {
      const body = (err as { getResponse: () => unknown }).getResponse();
      if (typeof body === 'object' && body !== null && 'code' in body) {
        return String((body as { code: unknown }).code);
      }
    }
    return fallback;
  }
}
