import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { InventoryStateMachineService } from './inventory-state-machine.service';
import { AramexAdapter } from './adapters/aramex.adapter';

@Module({
  controllers: [WebhooksController],
  providers: [InventoryStateMachineService, AramexAdapter],
  exports: [InventoryStateMachineService],
})
export class WebhooksModule {}
