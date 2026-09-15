import { Module } from '@nestjs/common';
import { DependencyCheckerService } from './dependency-checker.service.js';

@Module({
  providers: [DependencyCheckerService],
  exports: [DependencyCheckerService],
})
export class DependenciesModule {}
