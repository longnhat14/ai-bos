import { Module } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module';
import { DiagnosticController } from './diagnostic.controller';
import { DiagnosticService } from './diagnostic.service';

@Module({
  imports: [TicketsModule],
  controllers: [DiagnosticController],
  providers: [DiagnosticService],
  exports: [DiagnosticService],
})
export class DiagnosticModule {}
