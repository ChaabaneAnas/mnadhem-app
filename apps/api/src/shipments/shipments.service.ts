import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ShipmentStatus } from '@mnadhem/database';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateShipmentDto } from './dto/create-shipment.dto';

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateShipmentDto, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, tenantId },
      include: { shipment: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.shipment) throw new ConflictException('Order already has a shipment');

    const trackingConflict = await this.prisma.shipment.findUnique({
      where: { trackingNumber: dto.trackingNumber },
    });
    if (trackingConflict) throw new BadRequestException('Tracking number already in use');

    return this.prisma.shipment.create({
      data: {
        orderId: dto.orderId,
        trackingNumber: dto.trackingNumber,
        courier: dto.courier,
      },
      include: { order: { select: { reference: true, codAmount: true, wilaya: true } } },
    });
  }

  async findOne(id: string, tenantId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, order: { tenantId } },
      include: {
        order: true,
        webhookEvents: { orderBy: { processedAt: 'asc' } },
      },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  /**
   * Delivered parcels whose cash the courier has not yet handed over — the
   * merchant's receivables queue, and what a weekly payout is reconciled
   * against.
   */
  listAwaitingRemittance(tenantId: string) {
    return this.prisma.shipment.findMany({
      where: {
        status: ShipmentStatus.LIVRE,
        remittedAt: null,
        order: { tenantId, deletedAt: null },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        order: {
          select: { reference: true, customerName: true, wilaya: true, codAmount: true },
        },
      },
    });
  }

  /** Per-shipment toggle; `remitted: false` undoes a mistaken payout entry. */
  async setRemitted(id: string, remitted: boolean, tenantId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, order: { tenantId } },
    });
    if (!shipment)
      throw new NotFoundException({
        code: 'SHIPMENT_NOT_FOUND',
        message: 'Shipment not found',
      });
    if (shipment.status !== ShipmentStatus.LIVRE)
      throw new BadRequestException({
        code: 'SHIPMENT_NOT_DELIVERED',
        message: 'Only delivered shipments can be marked remitted',
      });

    return this.prisma.shipment.update({
      where: { id },
      data: { remittedAt: remitted ? new Date() : null },
    });
  }

  /**
   * Records one courier payout across many parcels. Ids that are not this
   * tenant's, not delivered, or already remitted are skipped rather than
   * rejected, so re-submitting the same settlement file is a no-op instead of
   * an error — couriers routinely resend them.
   */
  async remitBulk(shipmentIds: string[], tenantId: string) {
    const requested = [...new Set(shipmentIds)];

    return this.prisma.$transaction(async (tx) => {
      const eligible = await tx.shipment.findMany({
        where: {
          id: { in: requested },
          status: ShipmentStatus.LIVRE,
          remittedAt: null,
          order: { tenantId, deletedAt: null },
        },
        select: { id: true },
      });

      const ids = eligible.map((s) => s.id);
      if (ids.length > 0) {
        await tx.shipment.updateMany({
          where: { id: { in: ids } },
          data: { remittedAt: new Date() },
        });
      }

      return { remitted: ids.length, skipped: requested.length - ids.length, shipmentIds: ids };
    });
  }
}
