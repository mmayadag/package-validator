import { Module } from '@nestjs/common';
import { SubscriptionsRepository } from './subscriptions.repository.js';

@Module({
  providers: [SubscriptionsRepository],
  exports: [SubscriptionsRepository],
})
export class SubscriptionsModule {}
