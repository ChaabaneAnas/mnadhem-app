import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { TenantsModule } from './tenants/tenants.module';
import { ProductsModule } from './products/products.module';
import { VariantsModule } from './variants/variants.module';
import { OrdersModule } from './orders/orders.module';
import { CouriersModule } from './couriers/couriers.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    WebhooksModule,
    TenantsModule,
    ProductsModule,
    VariantsModule,
    OrdersModule,
    CouriersModule,
    ShipmentsModule,
    StatsModule,
  ],
})
export class AppModule {}
