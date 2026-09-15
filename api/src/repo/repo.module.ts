import { Module } from '@nestjs/common';
import { DependenciesModule } from '../dependencies/dependencies.module.js';
import { EmailModule } from '../email/email.module.js';
import { GithubModule } from '../github/github.module.js';
import { RepoController } from './repo.controller.js';
import { RepoService } from './repo.service.js';

@Module({
  imports: [GithubModule, DependenciesModule, EmailModule],
  controllers: [RepoController],
  providers: [RepoService],
})
export class RepoModule {}
