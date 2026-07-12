import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, BullModule.registerQueue({ name: 'webchat-escalation' })],
  controllers: [HealthController],
})
export class HealthModule {}
