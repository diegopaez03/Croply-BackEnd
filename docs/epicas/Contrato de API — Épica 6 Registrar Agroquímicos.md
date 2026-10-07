# Contrato de API — Épica 6: Registrar Agroquímicos

> Este contrato no repite las convenciones transversales ya definidas (ERR-01 a ERR-13, y la convención de `message` en éxitos). Solo se detallan acá endpoints, requests, responses y errores específicos de esta épica. Contrastado contra el código real de `Croply-BackEnd` y `Croply-FrontEnd`, en particular `PlanesAccionService`, `fincas.controller.ts`, `LogOperaciones`, `AdminFincaLayout.tsx` y `App.tsx`, y el catálogo real de errores (`DomainErrorCode`).
> 

---

## Decisiones tomadas en esta 1° versión (no quedó nada pendiente — se dejan anotadas para quien lea el contrato después)

**1. La tarea automática necesita un Hito real, y el modal original no lo contemplaba.** `Tarea.hito` no es una relación opcional en el modelo real (`@ManyToOne(() => Hito, ..., { onDelete: 'CASCADE' })`, sin `nullable: true`) — toda tarea necesita un hito concreto. El texto original de HU-AQ-01 no incluía ningún selector de Hito ni exigía que la parcela tuviera un plan de acción generado. Se corrige: la parcela elegida debe tener un plan de acción activo con al menos un hito, y el modal de registro suma un campo **Hito** (desplegable, obligatorio, con los hitos del plan de acción de la parcela seleccionada). Se agrega el error `PARCEL_WITHOUT_ACTION_PLAN` (ERR-12) para el caso sin plan.

**2. Responsable ≠ "usuario que registró" — el DC solo modela uno de los dos.** `AplicacionAgroquimico` tiene una única relación real con `UsuarioFinca` en el DC. Esa relación es el **Responsable** (el que se elige en el modal y se copia a la tarea automática). "Usuario que registró la operación" no es una columna propia: se resuelve vía `LogOperaciones` (`Usuario`, `tipo_operacion`, `descripcion`, `fecha`), el mecanismo de auditoría transversal que ya usan `fincas`, `roles`, `cultivos` y `tipos-sensor` — se escribe una entrada ahí al crear/editar una aplicación, igual que en esos módulos, sin agregar ninguna columna nueva a `AplicacionAgroquimico`.

**3. Todos los endpoints van explícitos bajo `/fincas/:id_finca/agroquimicos` — no existe ningún anclaje global de "finca activa".** Se verificó contra el código real: `AdminFincaLayout.tsx` es un shell sin contexto ni estado de finca; la ruta `/admin-finca/agroquimicos` no lleva `:id_finca`; el único `selectedFincaId` que existe en todo el frontend es estado local de `DashboardAdminFincaPage`, no se comparte con ninguna otra pantalla. Por eso esta épica sigue el mismo patrón que el resto de la API (`/fincas/:id_finca/clima`, etc.): todo bajo `/fincas/:id_finca/agroquimicos`, con `:id_finca` explícito en la URL. Cómo resuelve el frontend de dónde sale ese `:id_finca` (selector propio en la pantalla, o algo más global) queda fuera de este contrato. Como consecuencia directa, el modal de exportar (HU-AQ-07) pierde el campo **Finca** (y la opción "Todas las fincas") que tenía en el texto original de la HU — ya no hace falta, la finca la da la URL.

**4. `Responsable` se agrega como campo editable en HU-AQ-02.** El texto original no lo listaba entre los campos editables del modal (solo Fecha y hora, Producto, Dosis, Unidad de dosis), pero la propia cláusula de éxito de la HU ya daba por sentado que se podía propagar un cambio de responsable a la tarea — sin ningún campo que lo dispare, esa frase quedaba huérfana. Se agrega al modal de edición junto a los demás campos editables.

**5. Numeración de HU relacionadas en el documento fuente:** HU-AQ-03 menciona "HU-AQ-08 — Exportar..." en sus relacionadas; no existe una HU-08, es HU-AQ-07 (mismo título). Error de numeración del documento, sin impacto en este contrato.

**6. Guard reutilizado — no hace falta crear uno nuevo.** `AdminFincaGuard` ya existe en el backend real y, pese al nombre, no exige rol Administrador de Finca — solo valida membresía vigente en el `:id_finca` de la ruta. Combinado con `PermisoGuard` + `RequirePermiso(PERMISO_FINCA.REGISTRO_AGROQUIMICOS)` alcanza para todos los endpoints de esta épica — mismo patrón ya usado hoy en `fincas.controller.ts` para `GESTION_TRABAJADORES`.

**7. `fecha_creacion` y `fecha_modificacion` se agregan como extensión al DC.** El DC de `AplicacionAgroquimico` solo modela `id_aplicacion`, `nombre_producto_aa`, `dosis_aa`, `fecha_hora_aplicacion_aa`, `observaciones` — sin fecha de alta ni de modificación. Pero HU-AQ-01 pide explícitamente persistir "fecha/hora de creación" y HU-AQ-02 pide "fecha/hora de última modificación". Se agregan como extensión, mismo mecanismo ya usado varias veces en épicas anteriores.

**8. `dosis_aa` viaja como un único string ya combinado.** El modal captura "campo numérico con selector de unidad" (valor + unidad por separado), pero el DC modela `dosis_aa` como un único `String`. El frontend arma el string combinado (`"2 L/ha"`) antes de mandarlo — el backend no recibe valor y unidad por separado.

---

## Errores nuevos que se agregan en esta Épica

Reutilizar siempre que aplique: `REQUIRED_FIELD` (ERR-01), `RESOURCE_NOT_FOUND` (ERR-05), `PARCEL_WITHOUT_ACTION_PLAN` (ERR-12).

**ERR-14 — Tipo de tarea de agroquímico no disponible (HU-AQ-01)**

```json
{
  "statusCode": 400,
  "errorCode": "AGROCHEMICAL_TASK_TYPE_UNAVAILABLE",
  "message": "No es posible registrar la aplicación. El tipo de tarea requerido no está disponible."
}
```

Se dispara si no existe ningún `TipoTarea` con `es_tipo_agroquimico: true` y activo (nunca por nombre).

**ERR-15 — Tarea asociada eliminada (HU-AQ-02)**

```json
{
  "statusCode": 409,
  "errorCode": "LINKED_TASK_DELETED",
  "message": "No es posible editar esta aplicación. La tarea asociada fue eliminada."
}
```

**ERR-16 — Rango de fechas inválido (HU-AQ-05, HU-AQ-07)**

```json
{
  "statusCode": 400,
  "errorCode": "INVALID_DATE_RANGE",
  "message": "La fecha de fin debe ser igual o posterior a la fecha de inicio."
}
```

**ERR-17 — Sin datos para exportar (HU-AQ-07)**

```json
{
  "statusCode": 400,
  "errorCode": "EMPTY_EXPORT_RESULT",
  "message": "No hay aplicaciones para exportar con los filtros seleccionados. Ajustá la configuración del reporte."
}
```

---

## HU-AQ-01. Registrar aplicación de agroquímico en una parcela

- **Autenticación:** Requerida (Rol: Administrador de Finca o usuario con permiso `Registro de agroquímicos`). Guard: `JwtAuthGuard, AdminFincaGuard, PermisoGuard` + `@RequirePermiso(PERMISO_FINCA.REGISTRO_AGROQUIMICOS)`.

> `AplicacionAgroquimico` (DC + extensión): `id_aplicacion`, `nombre_producto_aa`, `dosis_aa`, `fecha_hora_aplicacion_aa`, `observaciones` (DC), más `fecha_creacion`, `fecha_modificacion` (extensión, ver Decisión #7). Relación con `Parcela` (obligatoria), `UsuarioFinca` como Responsable (obligatoria), `Tarea` (0..1, la tarea automática).
> 

`POST /api/v1/fincas/:id_finca/agroquimicos`

```json
{
  "fecha_hora_aplicacion_aa": "2026-09-22T09:00:00Z",
  "nombre_producto_aa": "Fungicida XYZ",
  "dosis_aa": "2 L/ha",
  "observaciones": "Aplicar en horas de baja radiación solar",
  "id_parcela": 101,
  "id_hito_real": 201,
  "id_responsable": 34
}
```

> `id_hito_real`: campo nuevo sumado al modal — ver Decisión #1. El desplegable de Hito se puebla encadenando `GET /api/v1/parcelas/:id_parcela` (trae el plan activo) + `GET /api/v1/planes-accion/:id_plan_accion` (trae sus hitos). `observaciones`: opcional.
> 

`201 Created`:

```json
{
  "message": "Aplicación registrada correctamente",
  "id_aplicacion": 55,
  "fecha_hora_aplicacion_aa": "2026-09-22T09:00:00Z",
  "nombre_producto_aa": "Fungicida XYZ",
  "dosis_aa": "2 L/ha",
  "observaciones": "Aplicar en horas de baja radiación solar",
  "id_parcela": 101,
  "nombre_parcela": "Parcela Norte",
  "id_hito_real": 201,
  "nombre_hito": "Siembra",
  "id_responsable": 34,
  "nombre_responsable": "Roberto Sánchez",
  "id_tarea": 601,
  "fecha_creacion": "2026-09-22T09:03:10Z"
}
```

> **Tarea automática:** se crea en el mismo hito elegido (`id_hito_real`), con `id_tipo_tarea` = el `TipoTarea` marcado con `es_tipo_agroquimico: true`, `id_estado_tarea` = el `EstadoTarea` marcado con `es_estado_finalizador: true` ("Completado") **desde el momento de creación** — es la única forma en todo el sistema de crear una tarea que nace ya completada, no pasa por "Planificado" primero. `nombre_tarea`/`descripcion_tarea` = `nombre_producto_aa`. `fecha_ejecucion_tarea` = `fecha_hora_aplicacion_aa`. `id_responsable` = el mismo elegido acá. Reutiliza la lógica de creación de `PlanesAccionService`, no el endpoint HTTP `POST .../hitos/:id_hito_real/tareas` (que fuerza estado inicial "Planificado") — necesita una variante interna del método de creación, no expuesta por su propia ruta.
> 
> 
> Se escribe además una entrada en `LogOperaciones` (usuario autenticado, `tipo_operacion` de creación, `recurso` apuntando a la aplicación) — es lo que resuelve "usuario que registró la operación" (ver Decisión #2), no viaja como campo de la respuesta.
> 

### Errores

- `AGROCHEMICAL_TASK_TYPE_UNAVAILABLE` → **ERR-14**.
- `PARCEL_WITHOUT_ACTION_PLAN` → **ERR-12**, si la parcela no tiene plan de acción activo con hitos.
- `REQUIRED_FIELD` → ERR-01, campos faltantes.
- `RESOURCE_NOT_FOUND` → ERR-05, si `id_parcela`/`id_hito_real`/`id_responsable` no existen o no pertenecen a la finca/parcela correspondiente.

---

## HU-AQ-02. Editar aplicación de agroquímico registrada

- **Autenticación:** igual que HU-AQ-01.

`PUT /api/v1/fincas/:id_finca/agroquimicos/:id_aplicacion`

```json
{
  "fecha_hora_aplicacion_aa": "2026-09-22T10:30:00Z",
  "nombre_producto_aa": "Fungicida XYZ Plus",
  "dosis_aa": "2.5 L/ha",
  "observaciones": "Se reprogramó por lluvia",
  "id_responsable": 41
}
```

> Editables: `fecha_hora_aplicacion_aa`, `nombre_producto_aa`, `dosis_aa`, `observaciones`, `id_responsable` (sumado, ver Decisión #4). `id_parcela` no se manda — de solo lectura, no se puede reasignar.
> 

`200 OK` con `message: "Aplicación actualizada correctamente"`, el detalle actualizado (mismo shape que la creación) y `fecha_modificacion` seteada.

> **Propagación a la tarea vinculada:** si `id_tarea` no es `null`, se actualizan en la tarea: `fecha_ejecucion_tarea` (= nuevo `fecha_hora_aplicacion_aa`), `descripcion_tarea` (= nuevo `nombre_producto_aa`), `id_responsable`. Si `id_tarea` es `null` (la tarea fue eliminada), se rechaza toda la edición — ver ERR-15.
> 

### Errores

- `LINKED_TASK_DELETED` → **ERR-15**, si `id_tarea` es `null`.
- `RESOURCE_NOT_FOUND` → ERR-05, si la aplicación o el nuevo `id_responsable` no existen.

---

## HU-AQ-03, HU-AQ-04, HU-AQ-05 y HU-AQ-06. Listar y filtrar aplicaciones de agroquímicos

- **Autenticación:** igual que HU-AQ-01.
- Un único endpoint para las 4 HU — los filtros son query params combinables entre sí.

`GET /api/v1/fincas/:id_finca/agroquimicos?page=1&pageSize=10&id_parcela=101&fecha_desde=2026-09-01&fecha_hasta=2026-09-30&id_responsable=34`

```json
{
  "aplicaciones": [
    {
      "id_aplicacion": 55,
      "fecha_hora_aplicacion_aa": "2026-09-22T09:00:00Z",
      "nombre_producto_aa": "Fungicida XYZ",
      "dosis_aa": "2 L/ha",
      "id_parcela": 101,
      "nombre_parcela": "Parcela Norte",
      "id_responsable": 34,
      "nombre_responsable": "Roberto Sánchez"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10
}
```

> Paginado de a 10 (HU-AQ-03 lo pide explícito). Orden por `fecha_hora_aplicacion_aa` descendente. `id_parcela` (HU-AQ-04), `fecha_desde`/`fecha_hasta` (HU-AQ-05, sobre `fecha_hora_aplicacion_aa`), `id_responsable` (HU-AQ-06) — todos opcionales y combinables entre sí, `"Todas"/"Todos"` = parámetro omitido. Sin resultados → `aplicaciones: []`, el frontend decide el mensaje según qué filtro esté activo; sin ningún registro en la finca → `"Aún no hay aplicaciones registradas. Hacé clic en 'Registrar Aplicación' para comenzar."`.
> 

### Errores

- `INVALID_DATE_RANGE` → **ERR-16**, si `fecha_hasta` < `fecha_desde`.

---

## HU-AQ-07. Exportar historial de aplicaciones de agroquímicos a PDF

- **Autenticación:** igual que HU-AQ-01. Vive en la misma sección de Agroquímicos (modal), no en una pantalla aparte — ver Decisión #3.

`GET /api/v1/fincas/:id_finca/agroquimicos/exportar?fecha_desde=2026-09-01&fecha_hasta=2026-09-30&id_parcela=101`

> Mismos filtros que HU-AQ-04/05 (sin `id_responsable`, la HU no lo pide acá), sin filtro de Finca (ver Decisión #3). Respuesta: `200 OK`, `Content-Type: application/pdf`, binario. Nombre de archivo (`Content-Disposition`): `agroquimicos_[nombre-finca]_[fecha-generacion].pdf`. Encabezado del PDF: "Croply", identificador único de reporte, fecha y hora de generación, título "Historial de Agroquímicos", rango de fechas y, si corresponde, parcela filtrada. Tabla: Fecha, Producto, Dosis, Parcela, ordenada por fecha descendente.
> 
> 
> La "Vista Previa" del modal es 100% frontend (HTML/CSS armando un boceto del layout), no pega contra este endpoint hasta que el usuario confirma "Descargar PDF" — no hace falta ninguna librería de PDF del lado del frontend, el archivo lo arma el backend.
> 

### Errores

- `INVALID_DATE_RANGE` → **ERR-16**.
- `EMPTY_EXPORT_RESULT` → **ERR-17**, si los filtros no arrojan ninguna aplicación — no se genera el archivo.

---

## Endpoints de Épicas anteriores que esta Épica toca

1. **`DELETE /planes-accion/:id_plan_accion/tareas/:id_tarea`** — este endpoint ya rechaza con `TASK_NOT_EDITABLE` cualquier tarea en un estado con `es_estado_finalizador: true` (llama a la misma validación que usa la edición). Como la tarea automática de agroquímico nace directo en un estado finalizador, **nunca puede eliminarse** — no hace falta ningún `ON DELETE SET NULL` ni manejo especial, el vínculo `AplicacionAgroquimico.id_tarea` nunca queda en `null` en la práctica actual. `LINKED_TASK_DELETED`/`ERR-15` en HU-AQ-02 queda como red de seguridad ante un cambio futuro de esta regla (por ejemplo, si algún día se permite eliminar tareas canceladas o finalizadas), no como un caso alcanzable hoy.
2. **`PlanesAccionService`** — necesita una variante interna del método de creación de tareas que permita nacer directo en el estado finalizador (hoy todo el flujo fuerza "Planificado" como estado inicial) — ver HU-AQ-01.