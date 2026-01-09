import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // while Postgres installs, keep API booting
    if (process.env.SKIP_DB_CONNECT === '1') {
      this.logger.warn('SKIP_DB_CONNECT=1 -> Skipping Prisma DB connect');
      return;
    }
    await this.$connect();
    this.logger.log('Connected to DB');
  }

  async onModuleDestroy() {
    if (process.env.SKIP_DB_CONNECT === '1') return;
    await this.$disconnect();
  }
}
