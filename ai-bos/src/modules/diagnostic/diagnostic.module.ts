import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { TicketsModule } from '../tickets/tickets.module';
import { DiagnosticCache } from './diagnostic-cache.entity';
import { DiagnosticController } from './diagnostic.controller';
import { DiagnosticService } from './diagnostic.service';

@Module({
  imports: [TypeOrmModule.forFeature([DiagnosticCache]), TicketsModule, KnowledgeModule],
  controllers: [DiagnosticController],
  providers: [DiagnosticService],
  exports: [DiagnosticService],
})
export class DiagnosticModule {}
