import { Module } from '@nestjs/common';
import { DependencyCheckerService } from './dependency-checker.service.js';
import { NpmRegistryClient } from './npm-registry.client.js';

@Module({
  providers: [NpmRegistryClient, DependencyCheckerService],
  exports: [DependencyCheckerService],
})
export class DependenciesModule {}
