import { EpocaCultivo, FormaSiembra } from '../../common/enums';
import { CrearCultivoBaseDto } from '../../modules/cultivos/dto/crear-cultivo-base.dto';
import { CrearVariedadDto } from '../../modules/cultivos/dto/crear-variedad.dto';
import { CrearPlantillaBaseDto } from '../../modules/cultivos/dto/crear-plantilla-base.dto';

export const CULTIVO_TOMATE_SEED: CrearCultivoBaseDto = {
  nombre_cultivo_base: 'Tomate',
  descripcion_cb: 'Fruto nacional premium',
  epoca_cultivo: EpocaCultivo.PRIMAVERA_VERANO,
  mes_siembra: 'Sep-Oct',
  ciclo_productivo_cb: '70-90 días',
  forma_siembra: FormaSiembra.ALMACIGO,
};

export const VARIEDADES_TOMATE_SEED: CrearVariedadDto[] = [
  {
    nombre_variedad: 'Perita',
    distancia_plantacion: '30x60cm',
    observaciones: 'Mas dulce, con menos semillas.',
    dias_a_cosecha: 75,
  },
  {
    nombre_variedad: 'Redondo',
    distancia_plantacion: '40x70cm',
    observaciones: null,
    dias_a_cosecha: 68,
  },
];

export const CULTIVO_AJO_SEED: CrearCultivoBaseDto = {
  nombre_cultivo_base: 'Ajo',
  descripcion_cb: 'Bulbo de ciclo invernal',
  epoca_cultivo: EpocaCultivo.OTONIO_INVIERNO,
  mes_siembra: 'Mar-Abr',
  ciclo_productivo_cb: '180-210 días',
  forma_siembra: FormaSiembra.DIRECTA,
};

export const PLANTILLA_TOMATE_NOMBRE = 'Plan de Cultivo de Tomate';

export function plantilla_tomate_seed(
  id_cultivo_base: number,
): CrearPlantillaBaseDto {
  return {
    nombre_pb: PLANTILLA_TOMATE_NOMBRE,
    cultivos: [{ id_cultivo_base, id_variedad: null }],
    hitos: [
      {
        nombre_hpb: 'Siembra',
        orden_hpb: 1,
        tareas: [
          {
            dia_relativo_tp: 0,
            id_tipo_tarea: 2,
            descripcion_tp: 'Preparación de almácigo',
          },
        ],
      },
      {
        nombre_hpb: 'Cosecha',
        orden_hpb: 2,
        tareas: [
          {
            dia_relativo_tp: 70,
            id_tipo_tarea: 7,
            descripcion_tp: 'Cosecha de frutos maduros',
          },
        ],
      },
    ],
  };
}
