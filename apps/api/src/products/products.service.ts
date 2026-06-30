import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BulkCreateDto } from './dto/bulk-create.dto';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto, tenantId: string) {
    if (dto.sku) {
      const conflict = await this.prisma.product.findUnique({
        where: { tenantId_sku: { tenantId, sku: dto.sku } },
      });
      if (conflict) throw new ConflictException(`SKU "${dto.sku}" already exists`);
    }
    return this.prisma.product.create({ data: { ...dto, tenantId } });
  }

  findAll(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        variants: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            stockPhysical: true,
            stockReserved: true,
            stockAvailable: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { variants: { where: { deletedAt: null } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: UpdateProductDto, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  /**
   * Bulk-creates products and their default variants from CSV-parsed rows.
   * Each row maps to one Product + one Variant. Rows with an existing SKU are
   * skipped (idempotent) rather than throwing, so a re-upload doesn't fail.
   * Returns a summary of how many rows were created vs skipped.
   */
  async bulkCreate(dto: BulkCreateDto, tenantId: string) {
    let created = 0;
    let skipped = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const row of dto.rows) {
        if (row.sku) {
          const existing = await tx.product.findUnique({
            where: { tenantId_sku: { tenantId, sku: row.sku } },
          });
          if (existing) {
            skipped++;
            continue;
          }
        }

        const product = await tx.product.create({
          data: { name: row.name, sku: row.sku, tenantId },
        });

        await tx.variant.create({
          data: {
            name: row.variantName ?? 'Default',
            price: row.price,
            stockPhysical: row.stockPhysical,
            stockAvailable: row.stockPhysical,
            stockReserved: 0,
            productId: product.id,
          },
        });

        created++;
      }
    });

    return { created, skipped, total: dto.rows.length };
  }

  /**
   * Soft-deletes a product and all its active variants in one transaction.
   * Blocked if any variant has units currently reserved with a courier.
   */
  async remove(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { variants: { where: { deletedAt: null } } },
    });
    if (!product) throw new NotFoundException('Product not found');

    const hasReservedStock = product.variants.some((v) => v.stockReserved > 0);
    if (hasReservedStock) {
      throw new ConflictException(
        'Cannot archive this product — one or more variants have units currently with a courier. Wait for those shipments to complete first.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.variant.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return tx.product.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }
}
