import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { slugifySku } from '../common/utils/sku.util';
import type { BulkCreateDto } from './dto/bulk-create.dto';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto, tenantId: string) {
    if (dto.sku) {
      const conflict = await this.prisma.product.findFirst({
        where: { tenantId, sku: dto.sku, deletedAt: null },
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
    const product = await this.findOne(id, tenantId);
    if (dto.sku && dto.sku !== product.sku) {
      const conflict = await this.prisma.product.findFirst({
        where: { tenantId, sku: dto.sku, deletedAt: null, id: { not: id } },
      });
      if (conflict) throw new ConflictException(`SKU "${dto.sku}" already exists`);
    }
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  /**
   * Bulk-creates products and variants from CSV-parsed rows.
   * Rows are merged by product SKU (or by name when no SKU): the first row
   * creates the Product, subsequent rows with the same SKU attach as extra
   * Variants — including onto products that already existed before the import.
   * A row is skipped only when a matching active variant (same name or same
   * variant SKU) already exists on the product, so re-uploads stay idempotent.
   * Variant SKU comes from the row's variantSku, else is derived from the
   * product SKU + variant name (e.g. "TSH-001" + "Red/M" → "TSH-001-RED-M").
   */
  async bulkCreate(dto: BulkCreateDto, tenantId: string) {
    let createdProducts = 0;
    let createdVariants = 0;
    let skipped = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const row of dto.rows) {
        let product = row.sku
          ? await tx.product.findFirst({
              where: { tenantId, sku: row.sku, deletedAt: null },
            })
          : await tx.product.findFirst({
              where: { tenantId, name: row.name, sku: null, deletedAt: null },
            });

        if (!product) {
          product = await tx.product.create({
            data: { name: row.name, sku: row.sku, tenantId },
          });
          createdProducts++;
        }

        const variantName = row.variantName ?? 'Default';
        const variantSku =
          row.variantSku || (row.sku ? `${row.sku}-${slugifySku(variantName)}` : undefined);

        const existing = await tx.variant.findFirst({
          where: {
            productId: product.id,
            deletedAt: null,
            OR: [{ name: variantName }, ...(variantSku ? [{ sku: variantSku }] : [])],
          },
        });
        if (existing) {
          skipped++;
          continue;
        }

        await tx.variant.create({
          data: {
            name: variantName,
            sku: variantSku,
            price: row.price,
            stockPhysical: row.stockPhysical,
            stockAvailable: row.stockPhysical,
            stockReserved: 0,
            productId: product.id,
          },
        });

        createdVariants++;
      }
    });

    return { createdProducts, createdVariants, skipped, total: dto.rows.length };
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
