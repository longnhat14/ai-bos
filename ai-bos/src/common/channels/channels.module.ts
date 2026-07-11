import { Module } from '@nestjs/common';
import { ConsoleChannel } from './console-channel';

/** Token dung de inject IChannel qua NestJS DI (vi IChannel la interface TypeScript, khong phai class) */
export const CHANNEL_TOKEN = 'CHANNEL';

@Module({
  providers: [
    {
      provide: CHANNEL_TOKEN,
      // Sprint 12: doi useClass thanh ZaloChannel/TelegramChannel (hoac dung factory
      // de chon kenh theo config), khong can sua noi nao khac dang inject CHANNEL_TOKEN.
      useClass: ConsoleChannel,
    },
  ],
  exports: [CHANNEL_TOKEN],
})
export class ChannelsModule {}
