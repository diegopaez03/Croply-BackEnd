import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerStubService } from '../../common/mailer';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { FincasModule } from '../fincas/fincas.module';
import { RolesModule } from '../roles/roles.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ResetsContrasena } from './entities/resets-contrasena.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminCroplyGuard } from './guards/admin-croply.guard';
import { AdminFincaGuard } from './guards/admin-finca.guard';
import { AdminCroplyOAdminFincaGuard } from './guards/admin-croply-o-admin-finca.guard';

@Module({
  imports: [
    forwardRef(() => UsuariosModule),
    forwardRef(() => FincasModule),
    forwardRef(() => RolesModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
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
    AdminFincaGuard,
    AdminCroplyOAdminFincaGuard,
    MailerStubService,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    AdminCroplyGuard,
    AdminFincaGuard,
    AdminCroplyOAdminFincaGuard,
    JwtModule,
    JwtStrategy,
    MailerStubService,
  ],
})
export class AuthModule {}
