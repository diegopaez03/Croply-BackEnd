import { Module } from '@nestjs/common';
import { UsuariosModule } from '../../modules/usuarios';
import { RolesModule } from '../../modules/roles';
import { FincasModule } from '../../modules/fincas';
import { SeedService } from './seed.service';

@Module({
  imports: [UsuariosModule, RolesModule, FincasModule],
  providers: [SeedService],
})
export class SeedModule {}
