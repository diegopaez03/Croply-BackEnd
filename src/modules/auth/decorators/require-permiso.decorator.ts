import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISO_KEY = 'require_permiso';

export const RequirePermiso = (...permisos: string[]) =>
  SetMetadata(REQUIRE_PERMISO_KEY, permisos);
