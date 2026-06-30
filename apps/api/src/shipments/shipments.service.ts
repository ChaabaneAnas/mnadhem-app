import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
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
}
