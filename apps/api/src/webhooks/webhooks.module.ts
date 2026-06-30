import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { InventoryStateMachineService } from './inventory-state-machine.service';
import { YalidineAdapter } from './adapters/yalidine.adapter';
import { AramexAdapter } from './adapters/aramex.adapter';
import { JexportAdapter } from './adapters/jexport.adapter';

@Module({
  controllers: [WebhooksController],
  providers: [
    InventoryStateMachineService,
    YalidineAdapter,
    AramexAdapter,
    JexportAdapter,
  ],
  exports: [InventoryStateMachineService],
})
export class WebhooksModule {}
