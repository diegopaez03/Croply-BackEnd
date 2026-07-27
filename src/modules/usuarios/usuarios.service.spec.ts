import { HttpStatus } from '@nestjs/common';
import { EstadoUsuario } from '../../common/enums';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let usuario_repo: Record<string, jest.Mock>;
  let roles_service: { find_rol_sistema_by_id: jest.Mock };
  let fincas_service: {
    cancelar_invitaciones_pendientes_por_email: jest.Mock;
  };
  let log_service: { registrar: jest.Mock };

  beforeEach(() => {
    usuario_repo = {
      findOne: jest.fn(),
      save: jest.fn(async (x) => x),
      create: jest.fn((x) => x),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    roles_service = { find_rol_sistema_by_id: jest.fn() };
    fincas_service = {
      cancelar_invitaciones_pendientes_por_email: jest
        .fn()
        .mockResolvedValue(true),
    };
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };

    service = new UsuariosService(
      usuario_repo as never,
      roles_service as never,
      fincas_service as never,
      log_service as never,
    );
  });

  it('invalida sesión al pasar de Activo a Inactivo', async () => {
    const usuario = {
      id_usuario: 46,
      email: 'c@agro.com',
      estado: EstadoUsuario.ACTIVO,
      token_version: 0,
      fecha_baja: null,
      usuario_fincas: [],
    };
    usuario_repo.findOne.mockResolvedValue(usuario);

    const actor = {
      rol_sistema: { codigo: 'ADMIN_CROPLY' },
      usuario_fincas: [],
    };

    const result = await service.actualizar_estado(
      46,
      { estado: EstadoUsuario.INACTIVO },
      actor as never,
    );

    expect(result.estado).toBe(EstadoUsuario.INACTIVO);
    expect(usuario.token_version).toBe(1);
    expect(result.message).toBe('Estado de cuenta actualizado correctamente.');
  });

  it('cancela invitación al pasar de Pendiente a Inactivo', async () => {
    const usuario = {
      id_usuario: 46,
      email: 'c@agro.com',
      estado: EstadoUsuario.PENDIENTE,
      token_version: 0,
      fecha_baja: null,
      usuario_fincas: [],
    };
    usuario_repo.findOne.mockResolvedValue(usuario);

    const result = await service.actualizar_estado(
      46,
      { estado: EstadoUsuario.INACTIVO },
      { rol_sistema: { codigo: 'ADMIN_CROPLY' }, usuario_fincas: [] } as never,
    );

    expect(result.message).toContain('invitación pendiente fue cancelada');
    expect(
      fincas_service.cancelar_invitaciones_pendientes_por_email,
    ).toHaveBeenCalledWith('c@agro.com');
  });

  it('Admin Finca no puede setear Pendiente', async () => {
    usuario_repo.findOne.mockResolvedValue({
      id_usuario: 46,
      estado: EstadoUsuario.ACTIVO,
      usuario_fincas: [{ finca: { id_finca: 12 } }],
    });

    await expect(
      service.actualizar_estado(
        46,
        { estado: EstadoUsuario.PENDIENTE },
        {
          rol_sistema: null,
          usuario_fincas: [
            {
              finca: { id_finca: 12 },
              rol_finca: { codigo_rol_finca: 'ADMIN_FINCA' },
              fecha_fin_rol: null,
            },
          ],
        } as never,
      ),
    ).rejects.toMatchObject({
      errorCode: 'STATE_NOT_ALLOWED',
      status: HttpStatus.FORBIDDEN,
    });
  });
});
