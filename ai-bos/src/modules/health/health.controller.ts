import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Endpoint /health - dung cho load balancer/uptime monitoring biet server con
 * song khong, VA quan trong hon la ca DB lan Redis (BullMQ) co ket noi duoc
 * khong - vi nhieu tinh nang (Event Bus, escalation Telegram, AI Chat) phu
 * thuoc vao ca 2, server "song" nhung mat ket noi DB/Redis van la loi nghiem trong.
 *
 * KHONG dat sau JwtAuthGuard - he thong giam sat (uptime checker, load balancer)
 * goi endpoint nay KHONG co JWT, va ban than /health khong lo thong tin nhay cam.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    @InjectQueue('webchat-escalation') private readonly escalationQueue: Queue,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.checkRedis(),
    ]);
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      // Dung lai chinh Redis client cua BullMQ (queue da co san) de ping, thay vi
      // tao ket noi Redis rieng chi de check - tiet kiem tai nguyen.
      await this.escalationQueue.client;
      return { redis: { status: 'up' } };
    } catch (err) {
      return { redis: { status: 'down', message: err.message } };
    }
  }
}
