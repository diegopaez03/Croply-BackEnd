import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Permite requests públicos; si hay Bearer válido, adjunta el usuario.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
    }>();
    if (!request.headers.authorization) {
      return true;
    }
    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch {
      return true;
    }
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    if (err || !user) {
      return null as TUser;
    }
    return user;
  }
}
