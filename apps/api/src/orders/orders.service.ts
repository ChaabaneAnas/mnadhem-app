import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@mnadhem/database';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryStateMachineService } from '../webhooks/inventory-state-machine.service';
import type { CreateOrderDto } from './dto/create-order.dto';

/**
 * Statuses in which a manual order's stock is still held as reserved — it was
 * reserved at creation and is only consumed or released by a courier webhook.
 * Generating an AWB and requesting a pickup move an order between these without
 * touching inventory, so anything that unwinds an order must cover all three.
 */
const STOCK_RESERVED_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.PENDING_FULFILLMENT,
  OrderStatus.READY_FOR_SHIPMENT,
  OrderStatus.PICKUP_REQUESTED,
]);

/** Cancellable while the parcel is still in the merchant's hands. */
const CANCELLABLE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.PENDING_FULFILLMENT,
  OrderStatus.READY_FOR_SHIPMENT,
]);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: InventoryStateMachineService,
  ) {}

  async create(dto: CreateOrderDto, tenantId: string) {
    const existing = await this.prisma.order.findUnique({ where: { reference: dto.reference } });
    if (existing)
      throw new ConflictException({
        code: 'ORDER_REFERENCE_TAKEN',
        message: `Order reference "${dto.reference}" already exists`,
      });

    const variantIds = dto.items.map((i) => i.variantId);
    const variants = await this.prisma.variant.findMany({
      where: { id: { in: variantIds }, product: { tenantId } },
    });

    if (variants.length !== variantIds.length) {
      throw new BadRequestException({
        code: 'INVALID_VARIANTS',
        message: 'One or more variant IDs are invalid or do not belong to this tenant',
      });
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const { items, ...orderData } = dto;

    return this.prisma.order.create({
      data: {
        ...orderData,
        tenantId,
        items: {
          create: items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: variantMap.get(item.variantId)!.price,
          })),
        },
      },
      include: { items: { include: { variant: true } }, shipment: true },
    });
  }

  /**
   * Creates an order and immediately reserves stock in one atomic transaction.
   * This is the primary order-creation path for User B (social/manual merchants).
   */
  async createManual(dto: CreateOrderDto, tenantId: string) {
    const existing = await this.prisma.order.findUnique({ where: { reference: dto.reference } });
    if (existing)
      throw new ConflictException({
        code: 'ORDER_REFERENCE_TAKEN',
        message: `Order reference "${dto.reference}" already exists`,
      });

    const variantIds = dto.items.map((i) => i.variantId);
    const variants = await this.prisma.variant.findMany({
      where: { id: { in: variantIds }, product: { tenantId }, deletedAt: null },
    });

    if (variants.length !== variantIds.length) {
      throw new BadRequestException({
        code: 'INVALID_VARIANTS',
        message: 'One or more variant IDs are invalid or do not belong to this tenant',
      });
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const { items, ...orderData } = dto;

    return this.prisma.$transaction(async (tx) => {
      await this.stateMachine.reserveForManualOrder(
        items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        tenantId,
        tx,
      );

      return tx.order.create({
        data: {
          ...orderData,
          tenantId,
          status: OrderStatus.PENDING_FULFILLMENT,
          items: {
            create: items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: variantMap.get(item.variantId)!.price,
            })),
          },
        },
        include: { items: { include: { variant: true } }, shipment: true },
      });
    });
  }

  findAll(tenantId: string, wilaya?: string) {
    return this.prisma.order.findMany({
      where: { tenantId, deletedAt: null, ...(wilaya && { wilaya }) },
      include: {
        items: { include: { variant: { select: { name: true, sku: true } } } },
        shipment: { select: { trackingNumber: true, status: true, courier: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        items: { include: { variant: true } },
        shipment: { include: { webhookEvents: { orderBy: { processedAt: 'asc' } } } },
      },
    });
    if (!order)
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    return order;
  }

  /**
   * Cancels an order and releases its stock reservation atomically.
   *
   * Allowed up to the point a pickup is requested. A label having been printed
   * is not a reason to refuse — merchants void packed parcels routinely — but
   * once the courier has been asked to collect, cancelling here would leave them
   * turning up for a parcel the merchant believes is voided. That has to be
   * settled with the courier, not in this app.
   */
  async cancel(id: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!order)
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    if (!CANCELLABLE_STATUSES.has(order.status)) {
      throw new BadRequestException({
        code: 'ORDER_NOT_CANCELLABLE',
        message:
          'Only orders that have not been collected yet can be cancelled. Once a pickup is ' +
          'requested, cancel with the courier directly.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await this.stateMachine.releaseOrderReservation(id, tenantId, tx);
      return tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
      });
    });
  }

  /**
   * Soft-deletes an order. If its stock is still reserved — true for every
   * pre-transit status, not just PENDING_FULFILLMENT — the reservation is
   * released in the same transaction before archiving the record. Missing the
   * two fulfillment states here would strand the reserved units permanently.
   */
  async remove(id: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!order)
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });

    return this.prisma.$transaction(async (tx) => {
      if (STOCK_RESERVED_STATUSES.has(order.status)) {
        await this.stateMachine.releaseOrderReservation(id, tenantId, tx);
      }
      return tx.order.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }
}

