import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { Role } from '@mnadhem/database';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTenantDto, userId: string) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" is already taken`);

    return this.prisma.tenant.create({
      data: {
        ...dto,
        members: { create: { userId, role: Role.OWNER } },
      },
      include: { members: true },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.tenant.findMany({
      where: { members: { some: { userId } } },
      include: { members: { where: { userId }, select: { role: true } } },
    });
  }

  async findOne(tenantId: string, userId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, members: { some: { userId } } },
    });
    if (!tenant)
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found or access denied',
      });
    return tenant;
  }

  async update(tenantId: string, dto: UpdateTenantDto, userId: string) {
    await this.assertMember(tenantId, userId, [Role.OWNER, Role.ADMIN]);
    if (dto.slug) {
      const conflict = await this.prisma.tenant.findFirst({
        where: { slug: dto.slug, NOT: { id: tenantId } },
      });
      if (conflict)
        throw new ConflictException({
          code: 'SLUG_TAKEN',
          message: `Slug "${dto.slug}" is already taken`,
        });
    }
    return this.prisma.tenant.update({ where: { id: tenantId }, data: dto });
  }

  private async assertMember(tenantId: string, userId: string, roles: Role[]) {
    const member = await this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!member || !roles.includes(member.role)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Insufficient permissions',
      });
    }
  }
}
