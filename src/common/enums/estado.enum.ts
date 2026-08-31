export enum EstadoUsuario {
  PENDIENTE = 'Pendiente',
  ACTIVO = 'Activo',
  INACTIVO = 'Inactivo',
}

export enum EstadoInvitacion {
  PENDIENTE = 'Pendiente',
  ACEPTADA = 'Aceptada',
  RECHAZADA = 'Rechazada',
  CANCELADA = 'Cancelada',
}

export enum EstadoSolicitud {
  PENDIENTE = 'Pendiente',
  CONTACTADO = 'Contactado',
  APROBADA = 'Aprobada',
  RECHAZADA = 'Rechazada',
}

export enum TipoRol {
  SISTEMA = 'sistema',
  FINCA = 'finca',
}

export enum AmbitoPermiso {
  SISTEMA = 'sistema',
  FINCA = 'finca',
}

export enum TipoOperacion {
  EXITO = 'Exito',
  FALLO = 'Fallo',
  OPERACION_DESTRUCTIVA = 'Operacion_destructiva',
}

export const CODIGO_ADMIN_CROPLY = 'ADMIN_CROPLY';
export const CODIGO_ADMIN_FINCA = 'ADMIN_FINCA';

export enum EpocaCultivo {
  TODO_EL_ANIO = 'Todo_el_anio',
  PRIMAVERA_VERANO = 'Primavera_verano',
  OTONIO_INVIERNO = 'Otonio_invierno',
}

export enum FormaSiembra {
  DIRECTA = 'Directa',
  ALMACIGO = 'Almacigo',
}
