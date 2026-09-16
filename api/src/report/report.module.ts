import { Module } from '@nestjs/common';
import { DependenciesModule } from '../dependencies/dependencies.module.js';
import { GithubModule } from '../github/github.module.js';
import { ReportService } from './report.service.js';

@Module({
  imports: [GithubModule, DependenciesModule],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
