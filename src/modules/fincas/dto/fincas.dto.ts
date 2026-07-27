import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, Min } from 'class-validator';
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

export { CrearRolFincaDto, ActualizarPermisosDto, ListarUsuariosQueryDto };
