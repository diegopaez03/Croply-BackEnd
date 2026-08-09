import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';
import {
  ActualizarPermisosDto,
  CrearRolFincaDto,
} from '../../roles/dto/crear-rol.dto';
import { ListarUsuariosQueryDto } from '../../usuarios/dto/usuarios.dto';

export class CrearInvitacionDto {
  @ApiProperty({ example: 'empleado@correo.com' })
  @IsEmail()
  @IsNotEmpty()
  email_invitado: string;

  @ApiProperty({ example: 21 })
  @IsInt()
  @Min(1)
  id_rol: number;
}

export class AsignarRolUsuarioFincaDto {
  @ApiProperty({ example: 21 })
  @IsInt()
  @Min(1)
  id_rol: number;
}

export class ListarUsuariosFincaQueryDto extends ListarUsuariosQueryDto {
  @ApiPropertyOptional({
    example: 12,
    description:
      'Acota el listado a una finca. Sin este parámetro se devuelven los usuarios de todas las fincas administradas.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_finca?: number;
}

export { CrearRolFincaDto, ActualizarPermisosDto, ListarUsuariosQueryDto };
