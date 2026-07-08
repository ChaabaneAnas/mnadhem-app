import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { slugifySku } from '../common/utils/sku.util';
import type { CreateVariantDto } from './dto/create-variant.dto';
import type { UpdateVariantDto } from './dto/update-variant.dto';
import type { StockAdjustmentDto } from './dto/stock-adjustment.dto';

@Injectable()
export class VariantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(productId: string, dto: CreateVariantDto, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
    });
    if (!product)
      throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });

    // No SKU given? Derive one from the product SKU for consistency with bulk import.
    const sku = dto.sku || (product.sku ? `${product.sku}-${slugifySku(dto.name)}` : undefined);

    if (sku) {
      const conflict = await this.prisma.variant.findFirst({
        where: { productId, sku, deletedAt: null },
      });
      if (conflict)
        throw new ConflictException({
          code: 'SKU_TAKEN',
          message: `SKU "${sku}" already exists on this product`,
        });
    }

    const { stockPhysical = 0, ...rest } = dto;
    return this.prisma.variant.create({
      data: {
        ...rest,
        sku,
        productId,
        stockPhysical,
        stockAvailable: stockPhysical,
        stockReserved: 0,
      },
    });
  }

  findAll(productId: string, tenantId: string) {
    return this.prisma.variant.findMany({
      where: { productId, product: { tenantId }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const variant = await this.prisma.variant.findFirst({
      where: { id, product: { tenantId }, deletedAt: null },
    });
    if (!variant)
      throw new NotFoundException({ code: 'VARIANT_NOT_FOUND', message: 'Variant not found' });
    return variant;
  }

  async update(id: string, dto: UpdateVariantDto, tenantId: string) {
    const variant = await this.findOne(id, tenantId);
    if (dto.sku && dto.sku !== variant.sku) {
      const conflict = await this.prisma.variant.findFirst({
        where: { productId: variant.productId, sku: dto.sku, deletedAt: null, id: { not: id } },
      });
      if (conflict)
        throw new ConflictException({
          code: 'SKU_TAKEN',
          message: `SKU "${dto.sku}" already exists on this product`,
        });
    }
    return this.prisma.variant.update({ where: { id }, data: dto });
  }

  async adjustStock(id: string, dto: StockAdjustmentDto, tenantId: string) {
    const variant = await this.findOne(id, tenantId);
    const newPhysical = variant.stockPhysical + dto.physicalDelta;

    if (newPhysical < 0) {
      throw new BadRequestException({
        code: 'NEGATIVE_STOCK',
        message: 'Adjustment would result in negative physical stock',
      });
    }
    if (newPhysical < variant.stockReserved) {
      throw new BadRequestException({
        code: 'STOCK_BELOW_RESERVED',
        message: `Cannot reduce physical stock below reserved quantity (${variant.stockReserved})`,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.variant.update({
        where: { id },
        data: {
          stockPhysical: { increment: dto.physicalDelta },
          stockAvailable: { increment: dto.physicalDelta },
        },
      });
    });
  }

  /**
   * Soft-deletes a variant. Blocked if any units are currently reserved with a courier
   * to prevent orphaning in-flight shipment records.
   */
  async remove(id: string, tenantId: string) {
    const variant = await this.findOne(id, tenantId);

    if (variant.stockReserved > 0) {
      throw new ConflictException({
        code: 'VARIANT_HAS_RESERVED',
        message: `Cannot archive "${variant.name}" — ${variant.stockReserved} unit(s) are currently with a courier. Wait for those shipments to complete first.`,
      });
    }

    return this.prisma.variant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
