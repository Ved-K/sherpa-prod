// api/src/prisma/prisma.prod.service.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaProdService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaProdService.name);

  constructor() {
    const url = process.env.DATABASE_URL_PROD;
    if (!url) {
      // fail early so you don't get mystery 500s later
      throw new Error(
        'DATABASE_URL_PROD is missing (check .env loading for the API process)',
      );
    }
    super({
      datasources: { db: { url } },
      log: ['error', 'warn'], // add 'query' if you want noisy debugging
    });
  }

  async onModuleInit() {
    if (process.env.SKIP_DB_CONNECT === '1') {
      this.logger.warn('SKIP_DB_CONNECT=1 -> Skipping Prisma PROD DB connect');
      return;
    }
    await this.$connect();
    this.logger.log('Connected to PROD DB');
  }

  async onModuleDestroy() {
    if (process.env.SKIP_DB_CONNECT === '1') return;
    await this.$disconnect();
  }
}
