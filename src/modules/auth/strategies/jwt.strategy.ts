import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { AuthJwtPayload } from '../auth.service';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usuarios_service: UsuariosService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>(
        'JWT_SECRET',
        'CHANGE_ME_super_secret_jwt_key_256bits',
      ),
    });
  }

  async validate(payload: AuthJwtPayload): Promise<Usuario> {
    const usuario = await this.usuarios_service.find_by_id(payload.sub);
    if (!usuario) {
      return null as unknown as Usuario;
    }
    return usuario;
  }
}
