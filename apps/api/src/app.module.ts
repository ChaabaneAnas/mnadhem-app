import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { TenantsModule } from './tenants/tenants.module';
import { ProductsModule } from './products/products.module';
import { VariantsModule } from './variants/variants.module';
import { OrdersModule } from './orders/orders.module';
import { ShipmentsModule } from './shipments/shipments.module';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    WebhooksModule,
    TenantsModule,
    ProductsModule,
    VariantsModule,
    OrdersModule,
    ShipmentsModule,
  ],
})
export class AppModule {}
