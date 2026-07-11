import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventLog } from './event-log.entity';
import { EventBusService } from './event-bus.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventLog]),
    BullModule.registerQueue({
      name: 'ai-bos-events',
    }),
  ],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}
