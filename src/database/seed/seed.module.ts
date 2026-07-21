import { Module } from '@nestjs/common';
import { UsuariosModule } from '../../modules/usuarios';
import { RolesModule } from '../../modules/roles';
import { SeedService } from './seed.service';

@Module({
  imports: [UsuariosModule, RolesModule],
  providers: [SeedService],
})
export class SeedModule {}
