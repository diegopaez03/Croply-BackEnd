import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { SeedModule } from './database/seed';
import { HealthModule } from './modules/health';
import { AuthModule } from './modules/auth';
import { UsuariosModule } from './modules/usuarios';
import { FincasModule } from './modules/fincas';
import { RolesModule } from './modules/roles';
import { SolicitudesDigitalizacionModule } from './modules/solicitudes-digitalizacion';

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

    // ── Feature Modules ──────────────────────────────────────────
    HealthModule,
    RolesModule,
    UsuariosModule,
    FincasModule,
    AuthModule,
    SolicitudesDigitalizacionModule,

    // ── Seed (desarrollo: admins del equipo) ─────────────────────
    SeedModule,
  ],
})
export class AppModule {}
