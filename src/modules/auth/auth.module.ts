import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerStubService } from '../../common/mailer';
import { UsuariosModule } from '../usuarios';
import { FincasModule } from '../fincas';
import { RolesModule } from '../roles';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ResetsContrasena } from './entities/resets-contrasena.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminCroplyGuard } from './guards/admin-croply.guard';

@Module({
  imports: [
    UsuariosModule,
    FincasModule,
    RolesModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(
          'JWT_SECRET',
          'CHANGE_ME_super_secret_jwt_key_256bits',
        ),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') as
            | number
            | `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
    TypeOrmModule.forFeature([ResetsContrasena]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    AdminCroplyGuard,
    MailerStubService,
  ],
  exports: [AuthService, JwtAuthGuard, JwtModule, JwtStrategy],
})
export class AuthModule {}
