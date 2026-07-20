import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health';

/**
 * Root application module.
 * Feature modules will be imported here as they are developed.
 */
@Module({
  imports: [
    // ── Config ──────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ── Rate Limiting ────────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10) * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
      },
    ]),

    // ── Database ─────────────────────────────────────────────────
    DatabaseModule,

    // ── Feature Modules (add here as developed) ──────────────────
    HealthModule,
    // AuthModule,
    // UsersModule,
    // FarmsModule,
    // CropsModule,
    // PlotsModule,
    // ReportsModule,
  ],
})
export class AppModule {}
