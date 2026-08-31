import { Module } from '@nestjs/common';
import { CouriersController } from './couriers.controller';
import { CouriersService } from './couriers.service';
import { CourierRegistryService } from './courier-registry.service';
import { AramexProvider } from './providers/aramex.provider';

/**
 * Outbound Aramex integration and the per-tenant credentials behind it.
 *
 * The inbound direction lives in WebhooksModule. They share `CourierAccount` —
 * one carrier, two credentials, configured together — but nothing else.
 */
@Module({
  controllers: [CouriersController],
  providers: [CouriersService, CourierRegistryService, AramexProvider],
  exports: [CourierRegistryService],
})
export class CouriersModule {}
