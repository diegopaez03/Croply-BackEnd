# Contrato de API — Épica 5: Gestionar Tareas de Campo

Propietario: Paula Rodriguez

> Este contrato no repite las convenciones transversales ya definidas en épicas anteriores (ERR-01 a ERR-10, y la convención de `message` en éxitos). Solo se detallan acá endpoints, requests, responses y errores específicos de esta épica. Contrastado contra el código real de `Croply-BackEnd` y `Croply-FrontEnd` (no solo contra el DC), en particular contra `PlanesAccionService`, `PlanesAccionCronogramaController`, `TiposSensorController` (mismo patrón de ABM de catálogo de Admin Croply) y el catálogo de permisos real (`PERMISO_SISTEMA`, `PERMISO_FINCA`).
> 

---

## Pendientes (decisiones tomadas en esta 1° versión — no modificar)

**1. `Tarea.estado` y `Tarea.id_tipo_tarea` dejan de ser un enum cerrado / número plano y pasan a ser relaciones reales con `EstadoTarea` y `TipoTarea`.** Esto rompe intencionalmente el shape que ya está en producción desde Épica 4 (`PlanesAccionService.to_tarea_response`, `CambiarEstadoTareaDto`, y del lado del frontend `EstadoTareaPlan`, `TareaPlanModal.tsx`, `CronogramaPlanAccion.tsx`, `tipo-tarea.catalog.ts` en ambos repos). Confirmado con Paula: se prioriza que quede bien hecho por sobre no tocar lo ya shippeado. HU-BC-06 (Épica 4) queda desactualizada en este punto puntual y se da por reescrita acá, no por un contrato aparte.

**2. Semilla mínima, no el catálogo completo.** Solo se precargan vía seed (`src/database/seed/`) las filas que el sistema necesita para funcionar sin depender de que nadie las haya cargado a mano todavía:

- `EstadoTarea`: `Planificado`, `Completado` y `Cancelada`. `Planificado` porque `PlanesAccionService.crear()` lo asigna como default automático a cada tarea nueva cada vez que se genera un plan de acción (HU-FP-04, ya en producción) — no hay ningún desplegable de por medio donde un humano pueda elegir otra cosa, así que si no existe, esa creación se rompe. `Completado` porque tiene lógica de negocio propia atada (ver Pendiente #3). `Cancelada` porque el mensaje de baja de una parcela, ya en producción (`parcelas.service.ts`), promete: *"Las tareas pendientes fueron canceladas"* — sin una fila real que represente ese estado, esa promesa no se puede cumplir nunca (esa cascada, además, hoy tampoco está implementada de verdad — ver el último punto de este contrato). `En Progreso` **no** se siembra — el equipo lo carga a mano desde HU-TC-02 antes de necesitarlo, junto con cualquier estado adicional que decidan agregar.
- `TipoTarea`: solo `Aplicación de agroquímico` — es el único que tiene lógica de negocio propia atada (ver Pendiente #3). El resto de los tipos (hoy mockeados como prueba en `tipo-tarea.catalog.ts`: `Preparación del terreno`, `Siembra`, `Riego`, `Fertilización`, `Control de malezas`, `Cosecha`) **no** se siembran — el equipo los carga a mano desde HU-TC-01, con los nombres reales que definan, antes de que se generen planes de acción que los necesiten.

Importante: la biblioteca demo (Tomate, Ajo) que se siembra al arrancar el backend tiene `TareaPlantilla` con `id_tipo_tarea` de prueba ya persistidos en la base de Demo 1. Al migrar esa columna a FK real (Pendiente #1), esas referencias necesitan apuntar a tipos que existan — si no se van a sembrar todos, hay que cargar los tipos reales elegidos **antes** de que se vuelva a generar esa biblioteca demo, o actualizar el seed de biblioteca demo para que referencie los tipos reales una vez definidos.

**3. Tres flags internos, no dos — cada uno gobierna algo distinto.** `Planificado` necesita quedar protegido contra baja pero no dispara ninguna lógica especial. `Completado` y `Cancelada` comparten cierta lógica entre sí (ninguna de las dos debería marcarse como atrasada, ninguna se puede seguir editando) pero **no toda** — solo `Completado` representa el cierre exitoso de un cultivo. Por eso van tres flags separados:

- `protegido: boolean` — decide si se puede dar de baja (ERR-11). `true` únicamente en las filas semilla: `Planificado`, `Completado`, `Cancelada`, `Aplicación de agroquímico`. Cualquier fila creada después desde la UI nace en `false` y se puede borrar libremente (si no está en uso).
- `EstadoTarea.es_estado_finalizador` / `TipoTarea.es_tipo_agroquimico` — decide que una tarea dejó de estar "en curso": la excluye del cálculo de `atrasada` y bloquea su edición/eliminación (`TASK_NOT_EDITABLE`). `true` en `Completado` y en `Cancelada` (las dos representan que la tarea ya no sigue activa, para bien o para mal) y en `Aplicación de agroquímico`; `false` en `Planificado`, `En Progreso` y cualquier fila nueva.
- `EstadoTarea.cuenta_para_cierre_exitoso: boolean` — decide específicamente si una tarea cuenta como parte de un cultivo terminado con éxito: dispara `fecha_ejecucion_tarea` automática y cuenta para `todas_tareas_completadas` (el modal "¡Has finalizado correctamente este cultivo!"). `true` únicamente en `Completado`. `Cancelada` queda en `false` acá a propósito — una tarea cancelada no se "ejecutó", y un plan con tareas canceladas no debería disparar el modal de cierre exitoso.

Ninguno de los tres flags es editable desde el modal de alta/edición — el Admin Croply puede renombrar cualquier fila libremente, pero ningún flag se toca desde la UI. Toda la lógica de negocio se decide contra estos flags, nunca contra el nombre ni contra un ID fijo — reemplaza los `estado === EstadoTarea.COMPLETADO` y `id_tipo_tarea === 5` hardcodeados que hoy existen en `PlanesAccionService` y en `tipo-tarea.catalog.ts` (front y back).

**4. `orden_estado_tarea` queda fuera de esta versión.** Se evaluará con el resto del equipo. No hay restricción de secuencia entre estados (HU-TC-03 lo confirma explícitamente), así que de agregarse sería puramente cosmético para ordenar el selector/listado — nunca para decidir transiciones válidas.

**5. Se agrega el estado "Cancelada" al ABM de `EstadoTarea` — decisión revertida respecto a la primera versión de este contrato.** El texto de HU-TC-08 ya lo mencionaba ("distinto de Completada o Cancelada"), y hace falta de verdad: sin él no hay ninguna fila a la que mover las tareas pendientes cuando se da de baja una parcela o una finca, algo que el sistema ya promete hacer (ver Pendiente #2). Nace protegida (`protegido: true`, mismo motivo que `Planificado`: si se borra sin haberla usado todavía, esa baja en cascada se rompe), con `es_estado_finalizador: true` y `cuenta_para_cierre_exitoso: false` (ver Pendiente #3).

**6. Permiso nuevo: `Notas de campo`.** Se agrega al catálogo de permisos de finca (`PERMISO_FINCA`, hoy `Registro de agroquímicos` / `Reportes` / `Gestión de trabajadores` / `Tareas de campo`) para HU-TC-05/06/07. El Administrador de Finca lo tiene siempre (como todos los permisos de finca); un rol custom (Encargado, Operario) necesita que se lo asignen explícitamente vía Épica 2.

**7. `NotaCampo.parcela` es 0..1 (opcional).** `NotaCampo` no tiene relación directa con `Finca` en el DC — la finca de una nota se resuelve siempre a través de `UsuarioFinca` (la membresía con la que se capturó), nunca se persiste como columna aparte. Esto permite que una nota "general de la finca" (sin parcela) y una nota de una parcela puntual convivan sin duplicar el dato de finca.

**8. `AplicacionAgroquimico` como registro propio sigue perteneciendo al contrato de Épica 6.** HU-TC-03 dispara su creación (ver ese apartado), pero el shape completo de ese registro (más allá de los 3 campos que ya viajan embebidos en `Tarea` desde Épica 4) se define ahí, no acá — mismo pendiente que ya dejó Épica 4.

**9. Guard de alcance para notas por finca: ya existe, no hace falta construir nada nuevo — para notas por parcela: sigue faltando.** Para `GET /fincas/:id_finca/notas-campo` alcanza con `JwtAuthGuard, AdminFincaGuard, PermisoGuard` + `@RequirePermiso(PERMISO_FINCA.NOTAS_CAMPO)` — `AdminFincaGuard` ya existe en el backend real y, pese al nombre, no exige rol Administrador de Finca, solo valida membresía vigente en el `:id_finca` de la ruta (mismo patrón ya usado en `fincas.controller.ts` para `GESTION_TRABAJADORES`). Para `GET /parcelas/:id_parcela/notas-campo` sigue faltando un guard: `AdminFincaPorParcelaGuard` sí es exclusivo de rol Admin Finca (valida `codigo_rol_finca === CODIGO_ADMIN_FINCA`), no alcanza para "o usuario con permisos". Hace falta el equivalente sin el chequeo de rol — mismo criterio de alcance (cualquier `UsuarioFinca` vigente de la finca dueña de la parcela) pero solo con el permiso, indexado por `:id_parcela`.

---

## Errores nuevos que se agregan en esta Épica

Reutilizar siempre que aplique: `DUPLICATE_VALUE` (ERR-02), `RESOURCE_IN_USE` (ERR-04), `RESOURCE_NOT_FOUND` (ERR-05), `TASK_NOT_EDITABLE` (ERR-08).

**ERR-11 — Catálogo protegido (HU-TC-01/02)**

```json
{
  "statusCode": 409,
  "errorCode": "PROTECTED_CATALOG_ITEM",
  "message": "Este valor es necesario para el funcionamiento del sistema y no puede darse de baja."
}
```

Se chequea **antes** que `RESOURCE_IN_USE`: una fila con `protegido: true` nunca se puede dar de baja, esté o no en uso (ver Pendiente #3 — no es lo mismo que `es_estado_finalizador`/`es_tipo_agroquimico`).

**ERR-12 — Parcela sin plan de acción (HU-TC-07)**

```json
{
  "statusCode": 400,
  "errorCode": "PARCEL_WITHOUT_ACTION_PLAN",
  "message": "La parcela seleccionada no tiene un plan de acción generado. No es posible convertir la nota en tarea."
}
```

**ERR-13 — Nota ya convertida (HU-TC-07)**

```json
{
  "statusCode": 409,
  "errorCode": "NOTE_ALREADY_CONVERTED",
  "message": "Esta nota ya fue convertida en una tarea."
}
```

> Nota: la validación de "fecha de aplicación de agroquímico no coincide con hoy" (texto original de HU-TC-03, `[ERR-01]` en ese documento) **no se implementa como error de backend**. Queda resuelta 100% del lado del frontend, como una confirmación antes de llamar al endpoint (ver HU-TC-03) — no hay ningún patrón de "confirmación" existente en el backend para reutilizar (se buscó en `PlanesAccionService` y no hay), y agregar uno nuevo para esto sería resolver de más un caso que es, en el fondo, una cortesía de UX y no un problema de integridad de datos.
> 

---

## HU-TC-01. ABM de tipos de tarea

- **Autenticación — separada por verbo, no es un único guard para todo el controller:**
    - `GET` (listar): `JwtAuthGuard` únicamente. Cualquier usuario autenticado, sin excepción — no exige rol de sistema ni de finca, ni pasa por `RequireFinca` ni ningún guard de alcance. Un usuario sin ninguna finca asignada todavía también puede leer este catálogo. Es un catálogo global de solo nombres, sin dato sensible, y lo necesitan varios perfiles a la vez: Admin Croply administrándolo acá, y Admin Finca / Encargado / Operario poblando sus propios selectores (HU-TC-03, HU-TC-07, y el modal de "Agregar tarea" de Épica 4).
    - `POST` / `PUT` / `DELETE` (administrar el catálogo): Rol Administrador Croply. Guard: `JwtAuthGuard, AdminCroplyGuard, PermisoGuard` + `@RequirePermiso(PERMISO_SISTEMA.CATALOGOS_BASE)` — mismo patrón exacto que `TiposSensorController`.

> `TipoTarea` (DC + extensión): `id_tipo_tarea`, `nombre_tipo_tarea`, `fecha_alta_tipo_tarea`, `fecha_baja_tipo_tarea` (DC), más `protegido` y `es_tipo_agroquimico` (extensión al UML, booleanos, no editables desde la UI — ver Pendiente #3).
> 
> 
> Semilla: nace con una única fila, `Aplicación de agroquímico` (`protegido: true`, `es_tipo_agroquimico: true`). El resto de los tipos los carga el equipo a mano desde esta pantalla, con los nombres reales que definan — ver Pendiente #2.
> 

### Listar tipos de tarea

`GET /api/v1/tipos-tarea`

```json
{
  "tipos_tarea": [
    { "id_tipo_tarea": 1, "nombre_tipo_tarea": "Aplicación de agroquímico", "protegido": true, "es_tipo_agroquimico": true },
    { "id_tipo_tarea": 2, "nombre_tipo_tarea": "Siembra", "protegido": false, "es_tipo_agroquimico": false }
  ]
}
```

> Sin paginar (lista plana, mismo patrón que `GET /tipos-sensor`). Solo activos (`fecha_baja_tipo_tarea IS NULL`) — no hay caso de uso que necesite ver los dados de baja.
> 

### Crear tipo de tarea

`POST /api/v1/tipos-tarea`

```json
{ "nombre_tipo_tarea": "Poda" }
```

`201 Created` con `message: "Tipo de tarea creado correctamente"` y el detalle (`id_tipo_tarea`, `nombre_tipo_tarea`, `protegido: false`, `es_tipo_agroquimico: false` — nunca se crea con ninguno de los dos flags en `true` desde acá, esa fila ya nace en el seed).

### Editar tipo de tarea

`PUT /api/v1/tipos-tarea/:id_tipo_tarea` — `{ "nombre_tipo_tarea": "..." }`. `200 OK` con `message: "Tipo de tarea actualizado correctamente"`. Permitido incluso sobre la fila protegida (el nombre se puede cambiar libremente, los flags no).

### Dar de baja tipo de tarea

`DELETE /api/v1/tipos-tarea/:id_tipo_tarea` — baja lógica. `200 OK` con `message: "Tipo de tarea dado de baja correctamente"`.

### Errores

- `DUPLICATE_VALUE` (nombre repetido) → ERR-02, `field: "nombre_tipo_tarea"`.
- `PROTECTED_CATALOG_ITEM` → **ERR-11**, si `protegido: true`.
- `RESOURCE_IN_USE` → ERR-04, si tiene `Tarea`/`TareaPlantilla` asociadas (y no está protegido).

---

## HU-TC-02. ABM de estados de tarea

- **Autenticación:** mismo criterio separado por verbo que HU-TC-01 — `GET` con `JwtAuthGuard` únicamente (cualquier usuario autenticado, sin exigir finca asignada); `POST`/`PUT`/`DELETE` con Rol Administrador Croply.

> `EstadoTarea` (DC + extensión): `id_estado_tarea`, `nombre_estado_tarea`, `fecha_alta_estado_tarea`, `fecha_baja_estado_tarea` (DC), más `protegido`, `es_estado_finalizador` y `cuenta_para_cierre_exitoso` (extensión, ver Pendiente #3).
> 
> 
> Semilla: nace con tres filas — `Planificado` (`protegido: true`, `es_estado_finalizador: false`, `cuenta_para_cierre_exitoso: false`), `Completado` (`protegido: true`, `es_estado_finalizador: true`, `cuenta_para_cierre_exitoso: true`) y `Cancelada` (`protegido: true`, `es_estado_finalizador: true`, `cuenta_para_cierre_exitoso: false`). `En Progreso` y cualquier otro estado los carga el equipo a mano desde esta pantalla — ver Pendiente #2.
> 

### Listar / Crear / Editar / Dar de baja

Mismo patrón exacto que HU-TC-01, sobre `/api/v1/estados-tarea`:

```json
{
  "estados_tarea": [
    { "id_estado_tarea": 1, "nombre_estado_tarea": "Planificado", "protegido": true, "es_estado_finalizador": false, "cuenta_para_cierre_exitoso": false },
    { "id_estado_tarea": 2, "nombre_estado_tarea": "Completado", "protegido": true, "es_estado_finalizador": true, "cuenta_para_cierre_exitoso": true },
    { "id_estado_tarea": 3, "nombre_estado_tarea": "Cancelada", "protegido": true, "es_estado_finalizador": true, "cuenta_para_cierre_exitoso": false }
  ]
}
```

### Errores

- `DUPLICATE_VALUE` → ERR-02, `field: "nombre_estado_tarea"`.
- `PROTECTED_CATALOG_ITEM` → **ERR-11**, si `protegido: true`.
- `RESOURCE_IN_USE` → ERR-04, si tiene `Tarea` asociadas (y no está protegido).

---

## HU-TC-03. Actualizar estado de una tarea

- **Autenticación:** Requerida (Rol: Administrador de Finca o usuario con permiso `Tareas de campo`).
- Guard: mismo que ya existe en `PlanesAccionCronogramaController` — `JwtAuthGuard, AlcanceFincaPorPlanGuard, PermisoGuard` + `@RequirePermiso(PERMISO_FINCA.TAREAS_CAMPO)`. Sin cambios de guard, solo de shape.

`PUT /api/v1/planes-accion/:id_plan_accion/tareas/:id_tarea/estado`

```json
{ "id_estado_tarea": 3 }
```

> Reemplaza el `{ "estado": "Completado" }` de Épica 4. El selector del frontend deja de tener una lista fija de 3 valores (`ESTADOS_TAREA` hardcodeado en `CronogramaPlanAccion.tsx`) y pasa a poblarse con `GET /api/v1/estados-tarea` (HU-TC-02), sin restricción de secuencia entre estados.
> 

`200 OK`:

```json
{
  "message": "Estado de la tarea actualizado correctamente",
  "id_tarea": 501,
  "id_estado_tarea": 3,
  "nombre_estado_tarea": "Completado",
  "fecha_ejecucion_tarea": "2026-09-20T14:32:00Z",
  "todas_tareas_completadas": true,
  "registro_agroquimico_generado": true
}
```

> `fecha_ejecucion_tarea` se completa automáticamente solo si el nuevo estado tiene `cuenta_para_cierre_exitoso: true` (hoy, únicamente "Completado"); si no, viaja `null` — una tarea "Cancelada" no se ejecutó, no le corresponde esa fecha. `todas_tareas_completadas: true` únicamente si **todas** las tareas del plan están resueltas (`es_estado_finalizador: true` en cada una, nada queda planificado/en progreso) **y además al menos una** tiene `cuenta_para_cierre_exitoso: true`. Así, una tarea cancelada en el medio no bloquea el cierre exitoso del resto (se ignora al chequear), pero un plan donde absolutamente todo terminó cancelado tampoco dispara el modal de éxito — nada se completó de verdad ahí.
> 
> 
> `registro_agroquimico_generado` **siempre está presente en la respuesta**, para cualquier tarea — no se omite el campo según el caso. Vale `false` por defecto (tarea no agroquímica, o agroquímica pero el nuevo estado no cuenta como cierre exitoso); solo puede ser `true` cuando se generó el registro en ese mismo llamado. Así el tipo del frontend queda consistente sin tener que chequear si el campo existe.
> 
> **Disparo de agroquímico:** si `tipo_tarea.es_tipo_agroquimico` y el nuevo estado tiene `cuenta_para_cierre_exitoso: true` (no alcanza con `es_estado_finalizador` — pasar a "Cancelada" no genera ningún registro, no hay ninguna aplicación real que documentar), el backend genera automáticamente el registro en el módulo de agroquímicos (shape completo definido en Épica 6) trasladando `nombre_producto_aa`/`dosis_aa`/`fecha_hora_aplicacion_aa`/responsable ya cargados en la tarea. `registro_agroquimico_generado` indica si se generó (`true`) o si ya existía uno previo para esa tarea y no se duplicó (`false` — en ese caso `message` cambia a `"Ya existe un registro de agroquímico asociado a esta tarea. No se generó un nuevo registro."`, y el estado de la tarea se actualiza igual).
> 
> **Confirmación de fecha (solo agroquímico, 100% frontend, no toca el backend):** antes de llamar a este endpoint, si `tipo_tarea.es_tipo_agroquimico`, el nuevo estado elegido tiene `cuenta_para_cierre_exitoso: true`, y `fecha_hora_aplicacion_aa` (ya cargada en la tarea desde que se creó) no coincide con la fecha de hoy, el frontend muestra un modal de confirmación ("¿La aplicación se realizó el {fecha_hora_aplicacion_aa}? Si no, editá la tarea antes de continuar.") en vez de llamar directo al endpoint — evita que quede un registro de agroquímicos con una fecha vieja sin que nadie la haya revisado. El backend no valida esto ni lo rechaza; no hay ningún flag de confirmación en el request. Alcanza únicamente a tareas de tipo agroquímico que se están completando — las tareas normales no tienen ningún dato de fecha pre-cargado que pueda quedar desactualizado (`fecha_ejecucion_tarea` la pone el sistema en el momento exacto de completar, siempre exacta), y cancelar no necesita confirmar ninguna fecha.
> 

### Errores

- `TASK_NOT_EDITABLE` → ERR-08 transversal, si la tarea ya está en un estado `es_estado_finalizador: true`.

---

## HU-TC-04. Reprogramar una tarea atrasada

- **Autenticación:** igual que HU-TC-03.
- Endpoint liviano nuevo, separado de "editar tarea" completa (`PUT .../tareas/:id_tarea`) — reprogramar solo toca la fecha, no tiene sentido reenviar nombre/descripción/tipo/campos de agroquímico para esto.

`PUT /api/v1/planes-accion/:id_plan_accion/tareas/:id_tarea/fecha`

```json
{ "fecha_planificada_tarea": "2026-09-25" }
```

`200 OK`:

```json
{
  "message": "Fecha reprogramada correctamente",
  "id_tarea": 501,
  "fecha_planificada_tarea": "2026-09-25",
  "atrasada": false
}
```

> `atrasada` recalculada con la nueva fecha, para que el frontend no tenga que rehacer el cálculo ni pedir de nuevo el listado completo solo para saber si dejó de estar atrasada.
> 

### Errores

- `TASK_NOT_EDITABLE` → ERR-08, si la tarea ya está en un estado `es_estado_finalizador: true`.

---

## HU-TC-05. Capturar nota de campo con soporte offline

- **Autenticación:** Requerida (Rol: Administrador de Finca o usuario con permiso `Notas de campo`).

> `NotaCampo` (DC + resolución de finca vía `UsuarioFinca`, ver Pendiente #7): `id_nota_campo`, `contenido_nota_campo`, `fecha_captura_nc`, `estado` (`EstadoNotaCampo`). Relación con `Parcela` (0..1) y con `Tarea` (0..1, ver HU-TC-07).
> 
> 
> **Todo lo offline es responsabilidad exclusiva del frontend** (caché local de fincas/parcelas desde la última sincronización, cola de notas pendientes, reintento al reconectar). El backend expone un único endpoint, que se llama igual estando online desde el momento de guardar o en diferido al recuperar conexión — no hay ninguna ruta ni mecanismo especial para "sincronizar en lote". `estado: "Pendiente_sincronizacion"` del DC **nunca llega al backend** — es un estado puramente local del dispositivo antes de que la nota exista en el servidor; toda nota que el backend persiste nace en `"Sincronizada"`.
> 

`POST /api/v1/notas-campo`

```json
{
  "id_finca": 12,
  "id_parcela": null,
  "contenido_nota_campo": "Se observan manchas foliares en el sector norte.",
  "fecha_captura_nc": "2026-09-20T09:15:00Z"
}
```

> `id_finca`: obligatorio, la finca elegida en el desplegable (editable). `id_parcela`: opcional — `null` si la nota queda asociada solo a la finca en general. `fecha_captura_nc` es opcional — se manda SOLO cuando se reenvía una nota que estuvo en la cola offline (con la fecha real en que se escribió), nunca en una captura con conexión normal. El backend resuelve el `UsuarioFinca` vigente del usuario autenticado para ese `id_finca` (rechaza con `403 FINCA_NOT_AVAILABLE` si no tiene membresía vigente ahí — reutiliza ERR-10) y lo guarda como autor; si viene `id_parcela`, valida que pertenezca a esa misma finca.
> 

`201 Created`:

```json
{
  "message": "Nota guardada correctamente",
  "id_nota_campo": 88,
  "contenido_nota_campo": "Se observan manchas foliares en el sector norte.",
  "fecha_captura_nc": "2026-09-20T11:05:00Z",
  "estado": "Sincronizada",
  "id_finca": 12,
  "id_parcela": null,
  "id_usuario_finca": 34,
  "nombre_usuario": "Roberto Sánchez",
  "nombre_rol_finca": "Encargado"
}
```

> `id_usuario_finca`/`nombre_usuario`/`nombre_rol_finca` identifican quién capturó la nota y con qué rol — se resuelven solos del `UsuarioFinca` autenticado, no se mandan en el request. Se agregan también acá (antes solo estaban en el listado de HU-TC-06) para que el frontend no dependa de un refetch del listado para saber "quién la guardó" justo después de crearla.
> 

### Errores

- `FINCA_NOT_AVAILABLE` (403) → ERR-10 transversal, si el usuario no tiene membresía vigente en `id_finca`.
- `RESOURCE_NOT_FOUND` → ERR-05, si `id_parcela` no existe o no pertenece a `id_finca`.

---

## HU-TC-06. Listar notas de campo capturadas

- **Autenticación:** Requerida (Rol: Administrador de Finca o usuario con permiso `Notas de campo`). Notas por finca: `JwtAuthGuard, AdminFincaGuard, PermisoGuard` + `@RequirePermiso(PERMISO_FINCA.NOTAS_CAMPO)` — ya resuelto (ver Pendiente #9). Notas por parcela: mismo criterio, pero el guard todavía no existe (ver Pendiente #9).

### Notas de una finca (todas, tengan o no parcela)

`GET /api/v1/fincas/:id_finca/notas-campo`

```json
{
  "notas": [
    {
      "id_nota_campo": 88,
      "contenido_nota_campo": "Se observan manchas foliares en el sector norte.",
      "fecha_captura_nc": "2026-09-20T11:05:00Z",
      "estado": "Sincronizada",
      "id_parcela": null,
      "nombre_parcela": null,
      "nombre_usuario": "Roberto Sánchez",
      "nombre_rol_finca": "Encargado"
    }
  ]
}
```

> Orden por `fecha_captura_nc` descendente. Incluye las notas con y sin parcela asociada (se filtra por la finca del `UsuarioFinca` que capturó cada una, no por una columna `id_finca` directa en `NotaCampo`). `estado` acá nunca es `"Pendiente_sincronizacion"` (ver HU-TC-05). Sin notas → `notas: []`, el frontend muestra `"No hay notas capturadas para esta finca."`.
> 

### Notas de una parcela puntual

`GET /api/v1/parcelas/:id_parcela/notas-campo` — mismo shape, filtrado por `id_parcela` exacto (nunca incluye las notas generales de la finca). Sin notas → `notas: []`, mensaje `"No hay notas capturadas para esta parcela."`.

### Errores

Ninguno específico más allá de `RESOURCE_NOT_FOUND` (ERR-05) si la finca/parcela no existe.

---

## HU-TC-07. Convertir nota de campo en tarea estructurada

- **Autenticación:** igual que HU-TC-05.

> El modal precarga `descripcion_tarea` con el texto de la nota, pero **también necesita `nombre_tarea`** — la HU no lo menciona explícitamente pero es obligatorio en `Tarea` (mismo campo que ya pide `POST .../hitos/:id_hito_real/tareas` de Épica 4). Falta sumarlo al texto de la HU.
> 
> 
> Para poblar el desplegable de "Hito": no hace falta endpoint nuevo, se encadena `GET /api/v1/parcelas/:id_parcela` (trae el `id_plan_accion` activo en `cultivos[]`) + `GET /api/v1/planes-accion/:id_plan_accion` (trae sus hitos), ambos ya existentes.
> 
> Si `id_tipo_tarea` elegido tiene `es_tipo_agroquimico: true`, el modal se amplía con los mismos 4 campos condicionales de "Agregar tarea" (HU-BC-06): `nombre_producto_aa`, `dosis_aa`, `fecha_hora_aplicacion_aa` obligatorios, `id_responsable` opcional. Para cualquier otro tipo, no se muestran.
> 

`POST /api/v1/notas-campo/:id_nota_campo/convertir-en-tarea`

```json
{
  "id_parcela": 101,
  "id_hito_real": 201,
  "nombre_tarea": "Aplicación de fungicida preventivo",
  "descripcion_tarea": "Se observan manchas foliares en el sector norte.",
  "fecha_planificada_tarea": "2026-09-22",
  "id_tipo_tarea": 1,
  "nombre_producto_aa": "Fungicida XYZ",
  "dosis_aa": "2 L/ha",
  "fecha_hora_aplicacion_aa": "2026-09-22T09:00:00Z",
  "id_responsable": 88
}
```

`201 Created` con `message: "Nota convertida en tarea correctamente"` y el objeto `Tarea` completo creado (mismo shape que el listado de HU-TC-08). La nota pasa a `estado: "Convertida_a_tarea"` y guarda el `id_tarea` generado — deja de mostrar el botón "Convertir en tarea" (HU-TC-06).

### Errores

- `PARCEL_WITHOUT_ACTION_PLAN` (400) → **ERR-12**, si la parcela elegida no tiene plan de acción activo.
- `NOTE_ALREADY_CONVERTED` (409) → **ERR-13**, si la nota ya fue convertida antes.
- `REQUIRED_FIELD` → ERR-01, campos de agroquímico si `id_tipo_tarea` corresponde y faltan.

---

## HU-TC-08, HU-TC-09 y HU-TC-10. Listar y filtrar tareas de una parcela

- **Autenticación:** igual que HU-TC-03.
- **No son endpoints nuevos** — extienden `GET /api/v1/planes-accion/:id_plan_accion` (Épica 4, mismo controller `PlanesAccionCronogramaController`) con query params y un campo calculado nuevo.

`GET /api/v1/planes-accion/:id_plan_accion?estado=3&fecha=2026-09-22`

```json
{
  "id_plan_accion": 77,
  "fecha_inicio_pa": "2026-09-15",
  "fecha_fin_pa": null,
  "superficie_ocupada_pa": 12.5,
  "estado": "Activo",
  "hitos": [
    {
      "id_hito_real": 201,
      "nombre_hito": "Siembra",
      "orden_hito": 1,
      "tareas": [
        {
          "id_tarea": 501,
          "nombre_tarea": "Preparación de almácigo",
          "descripcion_tarea": "Preparación de almácigo en sector norte",
          "fecha_planificada_tarea": "2026-09-15",
          "fecha_ejecucion_tarea": null,
          "fecha_creacion_tarea": "2026-09-10T10:00:00Z",
          "id_tipo_tarea": 2,
          "nombre_tipo_tarea": "Siembra",
          "id_estado_tarea": 1,
          "nombre_estado_tarea": "Planificado",
          "atrasada": true,
          "nombre_producto_aa": null,
          "dosis_aa": null,
          "id_responsable": null,
          "nombre_responsable": null,
          "fecha_hora_aplicacion_aa": null
        }
      ]
    }
  ]
}
```

> **Query params (opcionales y combinables):** `estado` (`id_estado_tarea`, se puebla el selector con `GET /api/v1/estados-tarea` — HU-TC-02, accesible a cualquier usuario autenticado; se omite u omitido = "Todos"), `fecha` (`YYYY-MM-DD`, match exacto contra `fecha_planificada_tarea`).
> 
> 
> **`atrasada` (campo nuevo):** `fecha_planificada_tarea` ya transcurrida **y** `estado_tarea.es_estado_finalizador = false`. Nunca se calcula por nombre de estado — hoy excluye tanto "Completado" como "Cancelada" (ver Pendiente #5) solo por tener el flag en `true`, y si el día de mañana se agrega otro estado con `es_estado_finalizador: true`, el cálculo sigue funcionando sin tocar código.
> 
> `estado`/`id_tipo_tarea` pasan a viajar como par `id_*` + `nombre_*` (mismo patrón que ya usa `nombre_tipo_tarea` desde Épica 4), reemplazando el string plano `"estado": "Completado"` de la versión anterior.
> 
> Filtro sin resultados → cada hito queda con `tareas: []`; el frontend decide el mensaje (`"No hay tareas con el estado seleccionado."` / `"No hay tareas planificadas para la fecha seleccionada."`) según qué filtro esté activo, mismo criterio que otras épicas.
> 

### Errores

Ninguno específico — son consultas.

---

## Convención de naming

Snake_case minúscula estricta, sin casing crudo del DC — mismo estándar que Épicas 3 y 4. Los flags nuevos que no están en el DC (`protegido`, `es_tipo_agroquimico`, `es_estado_finalizador`, `cuenta_para_cierre_exitoso`) se documentan acá como extensiones, mismo mecanismo ya usado en Épica 4 para `forma_siembra`/`observaciones`/`imagen_url`.

---

## Endpoints y lógica de Épicas anteriores que esta Épica modifica

Ninguno de estos es un endpoint nuevo — es lo que hay que tocar en lo ya shippeado de Épica 4 para que la migración a catálogos reales (Pendiente #1) funcione de punta a punta. Se lista acá aparte para que quede claro antes de armar el prompt de implementación, ya que no es trabajo "de la HU" sino prerrequisito para que las HU de esta épica funcionen.

1. **`PUT /planes-accion/:id_plan_accion/tareas/:id_tarea/estado`** (HU-BC-06) — body pasa de `{ "estado": "Completado" }` a `{ "id_estado_tarea": 3 }`; la respuesta deja de traer `estado` como string plano y pasa a `id_estado_tarea` + `nombre_estado_tarea`; el disparo de agroquímico deja de comparar `id_tipo_tarea === 5` y pasa a comparar el flag `es_tipo_agroquimico`; se saca la validación de fecha del backend (ver nota de confirmación en HU-TC-03).
2. **`GET /planes-accion/:id_plan_accion`** (HU-BC-06) — suma query params `?estado=`/`?fecha=` (HU-TC-09/10) y el campo `atrasada` por tarea (HU-TC-08); `estado`/`id_tipo_tarea` de cada tarea dejan de salir del mock/enum y pasan a resolverse contra las tablas reales.
3. **`POST /planes-accion/:id_plan_accion/hitos/:id_hito_real/tareas`** (crear tarea, HU-BC-06) — `id_tipo_tarea` deja de aceptar cualquier número y pasa a validarse contra `TipoTarea` real (`RESOURCE_NOT_FOUND` si no existe o está dado de baja).
4. **`PUT /planes-accion/:id_plan_accion/tareas/:id_tarea`** (editar tarea completa, HU-BC-06) — misma validación real de `id_tipo_tarea`; deja de ser el endpoint que se usa para reprogramar solo la fecha (eso ahora es el endpoint liviano de HU-TC-04).
5. **`PlantillasBaseService`** (alta/edición de `TareaPlantilla` dentro de una plantilla base, Épica 4) — mismo cambio: `id_tipo_tarea` pasa a validarse contra la tabla real en vez de aceptar cualquier número.
6. **Seed de biblioteca demo** (Tomate, Ajo) — sus `TareaPlantilla` ya persistidas en la base de Demo 1 referencian los 7 `id_tipo_tarea` de prueba. Como la semilla de esta Épica es mínima (Pendiente #2, solo se siembra "Aplicación de agroquímico"), hay que cargar a mano los tipos reales que esa biblioteca necesita **antes** de que se vuelva a generar, o actualizar ese seed para que apunte a los tipos reales una vez que el equipo los defina — a resolver antes de tocar este punto, no es parte de las HU de esta épica.
7. **`DELETE /fincas/:id_finca` y `DELETE /fincas/:id_finca/parcelas/:id_parcela`** — el mensaje de éxito de los dos, ya en producción, promete cancelar las tareas pendientes (y, en el caso de parcela, inactivar el cultivo activo). Revisando `fincas.service.ts` y `parcelas.service.ts` ninguno de los dos hace eso en la práctica hoy — solo tocan fecha de baja, y en el caso de parcela, sus controladores/sensores. La cascada real (mover las tareas pendientes de esos planes a `Cancelada`, inactivar el plan de acción activo) no está implementada todavía y necesita el estado `Cancelada` de esta Épica para poder construirse — antes no existía ninguna fila a la que mover esas tareas.