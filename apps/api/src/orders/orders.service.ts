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
   * Cancels a PENDING_FULFILLMENT order and releases its stock reservation atomically.
   * Only valid while the order has not yet been handed to a courier.
   */
  async cancel(id: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!order)
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    if (order.status !== OrderStatus.PENDING_FULFILLMENT) {
      throw new BadRequestException({
        code: 'ORDER_NOT_CANCELLABLE',
        message:
          'Only orders with status "En attente" can be cancelled. Orders already with a courier cannot be recalled here.',
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
   * Soft-deletes an order. If the order is still PENDING_FULFILLMENT, its stock
   * reservation is released in the same transaction before archiving the record.
   */
  async remove(id: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!order)
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });

    return this.prisma.$transaction(async (tx) => {
      if (order.status === OrderStatus.PENDING_FULFILLMENT) {
        await this.stateMachine.releaseOrderReservation(id, tenantId, tx);
      }
      return tx.order.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }
}
