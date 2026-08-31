import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { CouriersModule } from '../couriers/couriers.module';

@Module({
  // WebhooksModule for the inventory state machine (stock reservation on create),
  // CouriersModule for the carrier registry the fulfillment actions call out through.
  imports: [WebhooksModule, CouriersModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderFulfillmentService],
})
export class OrdersModule {}
