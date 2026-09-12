# Contrato de API — Épica 3: Gestionar Fincas, Parcelas y Cultivos

Propietario: Paula Rodriguez

> Este contrato no repite las convenciones transversales ya definidas en épicas anteriores (ERR-01 a ERR-05, ERR-06 a ERR-08 de Épica 4, y la convención de `message` en éxitos). Solo se detallan acá endpoints, requests, responses y errores específicos de esta épica.
> 

---

## Pendientes (Decisiones tomadas en esta 1° version - no modificar)

**1. `motivo_finalizacion` queda descartado.**  
El estado de un `PlanAccion` será suficiente para distinguir su situación. `EstadoPlanAccion` tendrá los siguientes valores:

- `Activo`
- `Finalizado`
- `FinalizadoPorContingencia`
- `Inactivado`

Los estados `Finalizado`, `FinalizadoPorContingencia` e `Inactivado` son estados terminales. Un `PlanAccion` que alcance cualquiera de estos estados no puede volver a `Activo`. Si posteriormente se necesita asignar un plan de acción nuevamente a una parcela, deberá crearse un nuevo `PlanAccion` desde cero a partir de la plantilla correspondiente.

`Inactivado` se utilizará cuando el plan deje de estar vigente como consecuencia de una baja lógica, por ejemplo, por la baja de la finca/parcela a la que pertenece.

**2. HU-BC-06 (Épica 4) sigue retirada de este contrato hasta que Épica 3 esté cerrada.**

**3. `recomendacion_ia_resumen` en HU-FP-08 depende del contrato de `HU-NA-03`, que todavía no existe.** El campo queda en la respuesta como `null` hasta que ese contrato se escriba y se pueda definir el shape real.

**4. Integración con el simulador IoT postergada.**  
La infraestructura `Parcela` + `ControladorSensor` + `Sensor` se implementa en HU-FP-03, pero la integración real con la API del simulador IoT NO forma parte de la Etapa 1 de Épica 3.

En esta etapa se persisten los datos y estados iniciales de la infraestructura IoT. La sincronización real con el simulador, sus consultas, actualización de lecturas, reintentos y manejo de errores se implementará posteriormente al retomar Épica 7.

**5. `RESOURCE_IN_USE` de TipoSensor queda pendiente hasta que exista la entidad `Sensor`.**  
Actualmente `TiposSensorService.contar_sensores_activos_asociados()` mantiene su implementación stub que devuelve `0` de forma intencional. Cuando se retome Épica 7, deberá reemplazarse por un `count()` real sobre `Sensor` y habilitarse el test actualmente marcado como `it.skip`.

---

## Nota de integración con el simulador IoT (informativa — no expone endpoints al frontend)


La HU-FP-03 implementa en esta etapa la estructura de infraestructura IoT asociada a una parcela:

- `ControladorSensor`
- `Sensor`
- relación con `TipoSensor`

Esta etapa NO implementa la comunicación real con la API del simulador IoT.

El frontend se comunica exclusivamente con la API de Croply. La integración entre Croply y el simulador IoT será implementada posteriormente al retomar Épica 7.

Mientras esa integración no exista:

- un `Sensor` nuevo se crea con `estado_senal: "Sin_senal"`;
- `ultimo_valor` queda en `null`;
- `fecha_ultima_lectura` queda en `null`;
- `ip_sensor` se persiste como dato ingresado manualmente, sin utilizarse para comunicación;
- no se realizan llamadas HTTP al simulador;
- no se generan reintentos ni notificaciones relacionadas con la sincronización.

La implementación futura de esta integración deberá quedar registrada como pendiente en `CONTEXT.md`.

---

## Errores específicos que se agregan en esta Épica

Reutilizar siempre que aplique: `REQUIRED_FIELD` (ERR-01), `DUPLICATE_VALUE` (ERR-02), `RESOURCE_IN_USE` (ERR-04), `RESOURCE_NOT_FOUND` (ERR-05). Los "[ERR-01]" que las HU mencionan en su propio texto para nombres duplicados de finca/parcela son **`DUPLICATE_VALUE` (ERR-02) transversal**, no un código nuevo.

**ERR-09 — Superficie insuficiente (HU-FP-04)**

```json
{
  "statusCode": 400,
  "errorCode": "INSUFFICIENT_AREA",
  "field": "superficie_asignada",
  "message": "La superficie ingresada excede la superficie disponible en la parcela."
}
```

**ERR-10 — Finca no disponible (HU-FP-08)**

```json
{
  "statusCode": 403,
  "errorCode": "FINCA_NOT_AVAILABLE",
  "message": "La finca seleccionada no está disponible."
}
```

---

## HU-FP-01. ABM de fincas

- **Autenticación:** Requerida (Rol: Administrador Croply)

> `Finca` (DC) real: `id_finca`, `nombre_finca`, `superficie_finca`, `descripcion_finca`, `fecha_alta_finca`, `fecha_baja_finca`, `longitud`, `latitud`, `provincia`, `departamento`. No tiene `estado` como columna propia (se deriva de `fecha_baja_finca` — `null` = Activo), ni `cantidad_sensores` ni `nombre_propietario` (se calculan vía relaciones, no se guardan como texto plano redundante). Estos campos derivados sí viajan en las respuestas de la API como conveniencia para el frontend, solo que no son columnas físicas de `Finca`.
> 

### Listar fincas

`GET /api/v1/fincas?page=1&pageSize=10`

Query params:

- `page`: número de página. Default: `1`.
- `pageSize`: cantidad de elementos por página. Default: `10`.
- `estado`: opcional. Valores permitidos: `Activo | Inactivo`.

```json
{
  "fincas": [
    {
      "id_finca": 12,
      "nombre_finca": "Finca La Esperanza",
      "propietario": {
        "id_usuario": 55,
        "id_usuario_finca": 201,
        "nombre": "Roberto",
        "apellido": "Sánchez",
        "email": "roberto@mail.com",
        "estado": "Activo"
      },
      "provincia": "Mendoza",
      "departamento": "Capital",
      "longitud": "-68.8272",
      "latitud": "-32.8908",
      "cantidad_sensores": 4,
      "estado": "Activo"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 8,
    "totalPages": 1
  }
}
```

> `propietario`: `null` si todavía no tiene Administrador de Finca asignado (ver HU-FP-02).
> 

### Métricas de agregación (cards del listado — solo las que no se pueden derivar de la paginación)

`GET /api/v1/fincas/stats`

```json
{  
"sensores_totales": 1452,  
"superficie_gestionada_total": 8240.0
}
```

> Solo estos dos valores — `total_fincas` y `fincas_activas` **no** necesitan este endpoint: se obtienen reutilizando `GET /fincas?page=1&pageSize=1` (sin filtro para el total, con `?estado=Activo` para las activas) y leyendo `pagination.totalItems`, mismo patrón ya usado en `GestionClientesPage`. Este endpoint existe únicamente porque `sensores_totales`/`superficie_gestionada_total` son sumas de un atributo anidado a través de todas las fincas, algo que ningún truco de paginación puede resolver. `superficie_gestionada_total`/`sensores_totales` excluyen las fincas inactivas.
> 


### Crear finca

`POST /api/v1/fincas`

```json
{
  "nombre_finca": "Finca La Esperanza",
  "provincia": "Mendoza",
  "departamento": "Capital",
  "longitud": "-68.8272",
  "latitud": "-32.8908",
  "superficie_finca": 150.5,
  "descripcion_finca": "Finca dedicada al cultivo de maíz.",
  "id_usuario_propietario": null,
  "parcelas": []
}
```

> `provincia`/`departamento`: se cargan a mano por pantalla, sin autocompletado desde ningún otro lado (aunque el Admin Croply pueda estar mirando una `SolicitudDigitalizacionFinca` aprobada al mismo tiempo, este request no los toma de ahí automáticamente).
`id_usuario_propietario`: el `id_usuario` (no `id_usuario_finca` — ese todavía no existe en este momento, lo crea el backend al procesar este request). Opcional, ver HU-FP-02.
`parcelas`: opcional, array vacío si no se crea ninguna parcela durante el alta de la finca — el AC confirma que ambos flujos son válidos (crear finca sola y cargar parcelas después al editar, o cargarlas en el mismo alta). Mismo shape que el `POST` de HU-FP-03 (sin `id_finca`, que en este contexto todavía no existe).
> 

`201 Created` con `message: "Finca creada correctamente"` y el detalle completo (mismo shape que "Ver detalle").

### Ver detalle de finca

`GET /api/v1/fincas/:id_finca`

```json
{
  "id_finca": 12,
  "nombre_finca": "Finca La Esperanza",
  "provincia": "Mendoza",
  "departamento": "Capital",
  "longitud": "-68.8272",
  "latitud": "-32.8908",
  "superficie_finca": 150.5,
  "descripcion_finca": "Finca dedicada al cultivo de maíz.",
  "propietario": {
    "id_usuario": 55,
    "id_usuario_finca": 201,
    "nombre": "Roberto",
    "apellido": "Sánchez",
    "email": "roberto@mail.com",
    "estado": "Activo"
  },
  "estado": "Activo",
  "cantidad_parcelas": 3,
  "cantidad_sensores": 4,
  "parcelas": [
    {
      "id_parcela": 101,
      "nombre_parcela": "Lote Norte",
      "estado_parcela": "Activa",
      "controladores": [
        {
          "id_controlador_sensor": 7,
          "nombre_controlador": "Controlador Norte",
          "ip_controlador": "192.168.1.10",
          "estado_controlador": "Transmitiendo",
          "sensores": [
            {
              "id_sensor": 501,
              "codigo_tipo_sensor": "PH",
              "nombre_tipo_sensor": "Sensor de pH",
              "ip_sensor": "192.168.1.11",
              "estado_senal": "Sin_senal",
              "ultimo_valor": null,
              "fecha_ultima_lectura": null
            }
          ]
        }
      ]
    }
  ]
}
```

> `propietario`: `null` si no tiene asignado. Ver la nota de integración arriba sobre `ultimo_valor`/`fecha_ultima_lectura`/`estado_senal` en `null`/`"Sin_senal"` recién creados.
> Cuando existe un propietario, la respuesta incluye `id_usuario`, `id_usuario_finca`, `nombre`, `apellido`, `email` y `estado`.
> 

### Editar finca

`PUT /api/v1/fincas/:id_finca` — solo `nombre_finca`, `superficie_finca`, `descripcion_finca` son editables (confirmado). `longitud`/`latitud`/`provincia`/`departamento` **no** se editan por acá — si hace falta corregir la ubicación de una finca ya creada, queda fuera de alcance de esta HU.

```json
{
  "nombre_finca": "Finca La Esperanza",
  "superficie_finca": 150.5,
  "descripcion_finca": "Finca dedicada al cultivo de maíz."
}
```

`200 OK` con `message: "Finca actualizada correctamente"`.

### Dar de baja finca

`DELETE /api/v1/fincas/:id_finca`

> Confirmado: baja lógica en cascada — cambia estado a Inactivo, inactiva parcelas asociadas, cancela tareas pendientes de esas parcelas, conserva histórico de agroquímicos sin modificar, inactiva cultivos activos, revoca accesos de usuarios invitados sin tocar el estado de cuenta del Administrador de Finca. **Dejar este mismo párrafo como comentario para el equipo de backend en el ticket/HU correspondiente**, para que quede claro que el contrato ya definió el alcance completo de la cascada y no falta nada por especificar acá.
> 

`200 OK` con `message: "Finca dada de baja correctamente. Las parcelas y datos asociados fueron actualizados."`

### Errores

- `DUPLICATE_VALUE` (nombre de finca repetido) → ERR-02, `field: "nombre_finca"`.

---

## HU-FP-02. Asignar Administrador de Finca a una finca

- **Autenticación:** Requerida (Rol: Administrador Croply)

### Listar usuarios disponibles como propietario

`GET /api/v1/usuarios/administradores-finca-disponibles`

```json
{
  "usuarios": [
    { "id_usuario": 55, "nombre": "Roberto", "apellido": "Sánchez", "email": "roberto@mail.com" }
  ]
}
```

> Usuarios registrados vía HU-AC-02. Devuelve `id_usuario` (no `id_usuario_finca`, ya que esta membresía todavía no existe para esta finca).

> Un mismo Administrador de Finca puede ser propietario de múltiples fincas. Por lo tanto, este endpoint NO debe excluir a un usuario por el hecho de que ya sea propietario de otra finca.

> El criterio de disponibilidad es que el usuario sea un candidato a Administrador de Finca: no debe ser un usuario con `rol_sistema` de Administrador Croply ni encontrarse dado de baja/inactivo.

> El endpoint no debe crear ni modificar `UsuarioFinca`; solamente devuelve los usuarios candidatos. La vinculación con la finca ocurre en `PUT /api/v1/fincas/:id_finca/propietario`.
> 

### Asignar/reasignar propietario

`PUT /api/v1/fincas/:id_finca/propietario`

```json
{ "id_usuario_propietario": 55 }
```

> Se manda `id_usuario` (de `Usuario`), nunca `id_usuario_finca`. Este endpoint es el que **crea** la fila de `UsuarioFinca` (con su propio `id_usuario_finca` autogenerado) vinculando ese `id_usuario` a esta finca con el rol Administrador de Finca — o la actualiza si ya existía un propietario distinto (desvincula el anterior, vincula el nuevo). `id_usuario_propietario: null` para desvincular sin asignar uno nuevo.
> 
> 
> Por qué esto importa para flujos futuros: una vez creado el `UsuarioFinca`, su `id_usuario_finca` es el identificador que se necesita para otras operaciones ya existentes de Épica 2 sobre ese usuario dentro de esa finca (ej. `rolesFincaService.asignarRol(id_finca, id_usuario_finca, ...)` si en algún momento se le cambia el rol). Por eso la respuesta de "Ver detalle de finca" siempre incluye ambos IDs (`id_usuario` e `id_usuario_finca`) una vez que el propietario está asignado.
> 

`200 OK` con `message: "Finca actualizada correctamente"`.

### Errores

Ninguno específico.

---

## HU-FP-03. ABM de parcelas asociadas a una finca (incluye Controladores y Sensores IoT)

- **Autenticación:** Requerida (Rol: Administrador Croply)

> `ControladorSensor` (DC) real: `id_controlador_sensor`, `estado_controlador` (`EstadoTransmision`), `ip_controlador`, `nombre_controlador`, `fecha_alta`, `fecha_baja`. `ip_controlador` se carga a mano por pantalla; `nombre_controlador` también.
> 
> 
> "Ubicación" de la parcela: se reutiliza `longitud`/`latitud`/`provincia`/`departamento` de la finca directamente — `Parcela` no tiene atributo propio de ubicación en el DC, y no hace falta uno: el frontend simplemente muestra la ubicación de la finca padre como referencia visual, sin persistir nada nuevo a nivel parcela.
> 

### Crear parcela (con controladores y sensores anidados)

`POST /api/v1/fincas/:id_finca/parcelas`

```json
{
  "nombre_parcela": "Lote Norte",
  "superficie_parcela": 12.5,
  "controladores": [
    {
      "nombre_controlador": "Controlador Norte",
      "ip_controlador": "192.168.1.10",
      "sensores": [
        { "id_tipo_sensor": 15,
          "ip_sensor": "192.168.1.11"
        }
      ]
    }
  ]
}
```

> `controladores`: opcional, array vacío si no se asigna ningún dispositivo IoT al crear. Cada controlador puede tener cero o más `sensores` anidados. Un sensor solo necesita `id_tipo_sensor` al crearse — no tiene `ip_sensor` propia en el DC (la IP es del controlador, no del sensor individual). Al eliminar una fila de controlador en el frontend antes de guardar, simplemente se quita del array — no dispara ningún request individual.
> La creación de la parcela y su infraestructura IoT no realiza ninguna comunicación con el simulador durante esta etapa. La integración con el simulador IoT será implementada posteriormente al retomar Épica 7.
> 

`201 Created` con `message: "Parcela creada correctamente"` y el detalle completo (mismo shape que aparece anidado en "Ver detalle de finca").

### Editar parcela

`PUT /api/v1/fincas/:id_finca/parcelas/:id_parcela`

```json
{
  "nombre_parcela": "Lote Norte",
  "superficie_parcela": 12.5,
  "controladores": [
    {
      "id_controlador_sensor": 7,
      "nombre_controlador": "Controlador Norte",
      "ip_controlador": "192.168.1.10",
      "sensores": [
        { "id_sensor": 501, 
          "id_tipo_sensor": 15,
          "ip_sensor": "192.168.1.11"
        }
      ]
    }
  ]
}
```
> `ip_sensor` es un dato string ingresado manualmente por el Administrador Croply. Se persiste en la base de datos, pero durante esta etapa no se utiliza para establecer ninguna comunicación con el simulador IoT ni con otro servicio externo. No requiere validación de formato específica.

> El array `controladores` se reemplaza completo en cada `PUT` (mismo patrón que `permisos` en Épica 2 y `asociaciones` en Épica 4): un controlador presente en la carga inicial pero ausente en el array enviado se interpreta como dado de baja (backend le setea `fecha_baja` a él y a todos sus sensores anidados). Un controlador **sin** `id_controlador_sensor` en el array se interpreta como nuevo. Mismo criterio a nivel sensor. 
> Los cambios estructurales se persisten únicamente en Croply durante esta etapa. La sincronización con el simulador IoT será implementada posteriormente al retomar Épica 7.
> 

`200 OK` con `message: "Parcela actualizada correctamente"`.

### Dar de baja parcela

`DELETE /api/v1/fincas/:id_finca/parcelas/:id_parcela` — baja lógica en cascada (confirmado, mismo criterio que finca: cancela tareas pendientes, inactiva cultivo activo, conserva histórico de agroquímicos). 
`200 OK` con `message: "Parcela dada de baja correctamente. Las tareas pendientes fueron canceladas y el cultivo activo fue inactivado."`

> La baja del lado del simulador IoT queda fuera del alcance de esta etapa y será implementada posteriormente al retomar Épica 7.

### Errores

- `DUPLICATE_VALUE` (nombre de parcela repetido dentro de la misma finca) → ERR-02, `field: "nombre_parcela"`.

---

## HU-FP-04. Asociar plan de acción con cultivo en parcela

### Estado de PlanAccion

`PlanAccion` utiliza el enum `EstadoPlanAccion` con los siguientes valores:

- `Activo`
- `Finalizado`
- `FinalizadoPorContingencia`
- `Inactivado`

Al crearse un nuevo `PlanAccion`, su estado inicial es `Activo`.

Los estados `Finalizado`, `FinalizadoPorContingencia` e `Inactivado` son terminales. Un `PlanAccion` que alcance cualquiera de estos estados no puede volver a `Activo`.

Si posteriormente se necesita volver a asignar un plan de acción a una parcela, se debe crear un nuevo `PlanAccion` desde cero a partir de la plantilla correspondiente.

No existe un campo `motivo_finalizacion`. La causa del estado se representa mediante `EstadoPlanAccion`.

- **Autenticación:** Requerida (Rol: Administrador de Finca)

### Ver cronograma previo a confirmar (previsualización, sin guardar nada)

`GET /api/v1/cultivos-base/:id_cultivo_base/plan-preview?id_parcela=:id_parcela`

```json
{
  "superficie_disponible_parcela": 8.3,
  "plantillas": [
    {
      "id_plantilla_base": 3,
      "variedades": [
        { "id_variedad": 12, "nombre_variedad": "Perita" },
        { "id_variedad": 13, "nombre_variedad": "Redondo" }
      ],
      "hitos": [
        { "nombre_hpb": "Siembra", "orden_hpb": 1, "tareas": [{ "descripcion_tp": "Preparación de almácigo", "dia_relativo_tp": 0 }] }
      ]
    }
  ]
}
```

> `variedades`: array, no un único `id_variedad` — si tiene más de un elemento, esas variedades comparten la misma plantilla y el frontend las agrupa en un solo bloque visual con una única "Fecha de inicio" compartida (según AC), pero un campo de "Superficie a asignar" independiente por cada variedad del array. Si el frontend cambia la fecha de inicio, recalcula `dia_relativo_tp` + esa fecha en el cliente para la previsualización del cronograma (no hace falta volver a pegarle al backend por cada cambio de fecha, ya que `dia_relativo_tp` no cambia).
> 

### Confirmar y crear el plan de acción real

`POST /api/v1/parcelas/:id_parcela/planes-accion`

```json
{
  "id_cultivo_base": 45,
  "asignaciones": [
    { "id_variedad": 12, "superficie_asignada": 5.0, "fecha_inicio": "2026-09-15" },
    { "id_variedad": 13, "superficie_asignada": 3.0, "fecha_inicio": "2026-09-15" }
  ]
}
```
> La materialización de las tareas utiliza provisoriamente el catálogo `src/modules/cultivos/tipo-tarea.catalog.ts`. No se implementa en esta etapa el ABM real de `TipoTarea` ni de `Tarea`. El catálogo es temporal y será reemplazado cuando se implemente Épica 5.

> `PlanAccion` es una instancia independiente de la plantilla. Al crearse se copian los datos necesarios de `PlantillaBase`, `HitoPlantilla` y `TareaPlantilla`. Los cambios posteriores realizados sobre una plantilla no modifican un `PlanAccion` ya creado.

`201 Created` con `message: "Cultivo y plan de acción asignados correctamente"` y el/los `id_plan_accion` generados.

```json
{
  "message": "Cultivo y plan de acción asignados correctamente",
  "ids_plan_accion": [88, 89]
}
```

### Errores

- `INSUFFICIENT_AREA` (400) → **ERR-09**. Aplica a la superficie individual y a la suma total de todas las asignaciones.

---

## HU-FP-05. Visualizar estado actual de parcelas

- **Autenticación:** Requerida (Rol: Administrador de Finca)

`GET /api/v1/parcelas/:id_parcela`

```json
{
  "id_parcela": 101,
  "id_finca": 12,
  "nombre_parcela": "Lote Norte",
  "estado_parcela": "Activa",
  "fecha_generacion_qr": null,
  "cultivos": [
    { "id_plan_accion": 77, "nombre_cultivo_base": "Tomate", "nombre_variedad": "Perita", "superficie_ocupada_pa": 5.0, "estado": "Activo" }
  ],
  "sensores": [
    { "id_sensor": 501, "codigo_tipo_sensor": "PH", "nombre_tipo_sensor": "Sensor de pH", "estado_senal": "Transmitiendo" }
  ]
}

```
> **Regla especial de este endpoint (única excepción del proyecto):** `RESOURCE_NOT_FOUND`
> se dispara únicamente si el `id_parcela` no existe en absoluto. A diferencia de todos
> los demás endpoints de la Etapa 1, **una parcela dada de baja SÍ debe devolver 200**
> con sus datos completos — el AC de HU-FP-05 exige poder mostrar el detalle de una
> parcela inactiva, con los cultivos y sensores que tenía al momento de la baja. El
> frontend decide, a partir de `estado_parcela`, si deshabilita las acciones de edición
> (asociar cultivo, generar QR) — el backend nunca oculta esta información por estar
> de baja.

> **El clima ya no viaja embebido acá.** El frontend, al mostrar el detalle de una parcela, hace una segunda llamada aparte a `GET /api/v1/fincas/:id_finca/clima` (Épica 7, HU-IoT-03) usando el `id_finca` que viene en esta misma respuesta. Ese endpoint ya resuelve el mensaje no bloqueante si el servicio meteorológico externo falla — no hay que reimplementar ese manejo acá.
`cultivos: []` → frontend muestra la card punteada con "Asociar cultivo".
> 

### Errores

`RESOURCE_NOT_FOUND` (ERR-05 transversal) — únicamente si `id_parcela` no existe en
absoluto. **No se dispara por estar dada de baja** (ver nota de comportamiento arriba).

---

## HU-FP-06. Consultar historial de cultivos por parcela

- **Autenticación:** Requerida (Rol: Administrador de Finca)

`GET /api/v1/parcelas/:id_parcela/historial-cultivos`

```json
{
  "historial": [
    {
      "id_plan_accion": 60,
		  "nombre_cultivo_base": "Ajo",
		  "nombre_variedad": "Morado",
		  "superficie_ocupada_pa": 4.2,
		  "fecha_inicio_pa": "2025-04-01",
		  "fecha_fin_pa": "2025-08-15",
		  "estado": "Finalizado"
    }
  ]
}
```

> Nombres de campo corregidos según el DC real (`superficie_ocupada_pa`, `fecha_inicio_pa`, `fecha_fin_pa` de `PlanAccion`). > Nombres de campo corregidos según el DC real (`superficie_ocupada_pa`, `fecha_inicio_pa`, `fecha_fin_pa` de `PlanAccion`).

> No incluye `motivo_finalizacion`. La situación final del plan se determina mediante `EstadoPlanAccion`, cuyos estados terminales son `Finalizado`, `FinalizadoPorContingencia` e `Inactivado`.

> `Finalizado` representa la finalización normal del plan. `FinalizadoPorContingencia` representa la finalización provocada por una contingencia, por ejemplo una contingencia climática. `Inactivado` representa la baja lógica del plan como consecuencia de la baja de la finca/parcela correspondiente.

> Un `PlanAccion` en cualquiera de estos estados no puede volver a `Activo`. Si se necesita volver a asignar un cultivo/plan a la parcela, se crea un nuevo `PlanAccion`.

> Ordenado por `fecha_inicio_pa` descendente. Sin historial → `historial: []`.
> 

### Errores

Ninguno específico.

---

## HU-FP-07. Generar código QR de parcela

- **Autenticación:** Requerida (Rol: Administrador de Finca)

> `CodigoQR` (DC): `id_codigo_qr`, `codigo_qr`, `url_acceso_qr`, `fecha_generacion_qr`. Decisión: el backend genera y persiste `codigo_qr` (token opaco) y arma `url_acceso_qr` a partir de él — **no genera ninguna imagen**. El frontend renderiza la imagen del QR client-side a partir de `url_acceso_qr` con una librería (ej. `qrcode.react`), evitando que el backend tenga que generar/guardar binarios.
> La generación del QR no depende de la integración con el simulador IoT y puede implementarse completamente durante esta etapa.
> 
> 
> `fecha_generacion_qr` (`null` = no generado todavía, con valor = ya existe) es la única fuente de verdad para decidir el texto del botón ("Generar código QR" vs "Ver código QR") — por eso ya viaja como parte de `GET /api/v1/parcelas/:id_parcela` (HU-FP-05), sin necesidad de una llamada aparte solo para decidir qué texto mostrar. Los dos endpoints de acá abajo son las acciones explícitas que dispara cada botón.
> 

### Generar código QR (botón "Generar código QR", solo si `fecha_generacion_qr` es `null`)

`POST /api/v1/parcelas/:id_parcela/codigo-qr`

`201 Created`:

json

```json
{  
"message": "Código QR generado correctamente",  
"url_acceso_qr": "https://app.croply.com/parcelas/101?qr=a1b2c3d4",  
"fecha_generacion_qr": "2026-08-27"
}
```

> Si ya existía uno generado (doble click, o el frontend quedó desactualizado), el backend **no genera uno nuevo** — devuelve `200` con los datos del ya existente, para que la operación sea segura de repetir sin efectos secundarios raros.
> 

### Consultar código QR existente (botón "Ver código QR", solo si `fecha_generacion_qr` ya tiene valor)

`GET /api/v1/parcelas/:id_parcela/codigo-qr`

json

```json
{  
"url_acceso_qr": "https://app.croply.com/parcelas/101?qr=a1b2c3d4",  
"fecha_generacion_qr": "2026-08-27"
}
```

> `404 RESOURCE_NOT_FOUND` (ERR-05) si todavía no fue generado — no debería pasar en un uso normal (el botón "Ver" solo aparece cuando ya existe), pero el backend lo valida igual.
"Descargar" es una operación 100% client-side sobre el QR ya renderizado en el DOM, no requiere ningún endpoint adicional.
> 

### Errores

Ninguno específico más allá de `RESOURCE_NOT_FOUND` (ERR-05) en el `GET`.

---

## HU-FP-08. Visualizar estado actual de finca

- **Autenticación:** Requerida (Rol: Administrador de Finca)

> El clima se consulta con `GET /api/v1/fincas/:id_finca/clima` (Épica 7, HU-IoT-03) — no se repite acá. `recomendacion_ia_resumen` depende de `HU-NA-03` (ver Pendiente #3), queda `null` hasta que exista ese contrato.
> 
> **Por qué esta HU no reutiliza `GET /api/v1/fincas/:id_finca` (HU-FP-01):**
> ese endpoint es exclusivo del Administrador Croply (`AdminCroplyGuard`) y expone
> datos de gestión interna que no le corresponden a un Administrador de Finca —
> email/estado del propietario, IPs de controladores y sensores. Los tres
> endpoints nuevos de esta HU (`mi-finca/fincas`, `:id_finca/resumen`,
> `:id_parcela/resumen`) usan `AdminFincaGuard`/`AdminFincaPorParcelaGuard` y
> devuelven únicamente los campos que el AC de esta HU necesita — no ensanchar
> el guard del endpoint de HU-FP-01 para intentar resolver esto, sería exponer
> datos que no le corresponden ver a un Administrador de Finca.

### Listar fincas activas asignadas al usuario logueado (para el selector)

`GET /api/v1/mi-finca/fincas`

> No confundir con `/mi-perfil` (Épica 2 — datos personales del usuario, sección del ícono de usuario en el header). Esta ruta vive bajo el namespace de la sección "Mi finca", que es donde corresponde.
> 

```json
{
  "fincas": [
    { "id_finca": 12, "nombre_finca": "Finca La Esperanza" },
    { "id_finca": 18, "nombre_finca": "Finca Los Álamos" }
  ]
}
```

> Solo fincas con `estado: "Activo"` — a diferencia de `usuario.fincas[]` del JWT (que puede quedar desactualizado si la finca se inactiva después del login), este endpoint consulta el estado real al momento de cargar la pantalla. Si devuelve un único elemento, el frontend carga esa finca directo sin mostrar el selector (según AC). Si devuelve `fincas: []` (todas las fincas asignadas fueron inactivadas), el frontend cae al mismo mensaje que `ERR-10` de abajo.
> 

### Ver resumen de finca (grilla de parcelas)

`GET /api/v1/fincas/:id_finca/resumen`

```json
{
  "id_finca": 12,
  "nombre_finca": "Finca La Esperanza",
  "parcelas": [
    { "id_parcela": 101, "nombre_parcela": "Lote Norte", "estado_parcela": "Activa" }
  ]
}
```

> Si la finca fue inactivada por el Admin Croply, este endpoint devuelve `403 FINCA_NOT_AVAILABLE` (ver Errores) en vez de `200` — el frontend muestra el mensaje fijo sin cargar nada más de la pantalla, según el AC.
> 

### Ver detalle resumido de una parcela puntual (card dinámica, sin navegar)

`GET /api/v1/parcelas/:id_parcela/resumen`

```json
{
  "id_parcela": 101,
  "nombre_parcela": "Lote Norte",
  "estado_parcela": "Activa",
  "cultivo": {
    "nombre_cultivo_base": "Tomate",
    "nombre_variedad": "Perita",
    "superficie_ocupada_pa": 5.0
  },
  "recomendacion_ia_resumen": null
}
```

> `cultivo: null` si la parcela no tiene ningún cultivo asociado — el frontend muestra `"---"` en variedad/superficie/recomendación sin mensaje extendido, según el AC.
> 

### Errores

**`403 Forbidden` — Finca no disponible:**

```json
{
  "statusCode": 403,
  "errorCode": "FINCA_NOT_AVAILABLE",
  "message": "La finca seleccionada no está disponible."
}
```

Ver **ERR-10** arriba.

---

## Alcance cerrado de la Etapa 1

La Etapa 1 de Épica 3 comprende exclusivamente:

- HU-FP-01 — ABM de Fincas.
- HU-FP-02 — Asignar Administrador de Finca.
- HU-FP-03 — ABM de Parcelas e infraestructura IoT.
- HU-FP-04 — Asociar PlanAccion con cultivo en parcela.
- HU-FP-06 — Consultar historial de cultivos.
- HU-FP-07 — Generar código QR de parcela.

Quedan fuera de esta etapa:

- HU-FP-05.
- HU-FP-08.
- Integración real con el simulador IoT.
- Integración con la API de clima.
- Recomendaciones de IA.
- ABM real de `TipoTarea`.
- ABM real de `Tarea`.
- Implementación de `RESOURCE_IN_USE` real de `TipoSensor`.

La infraestructura `Sensor`, `ControladorSensor`, `Parcela`, `CodigoQR`, `PlanAccion`, `Hito` y `Tarea` sí se implementa cuando corresponde dentro de las HU de esta etapa, pero las integraciones externas y funcionalidades explícitamente postergadas permanecen fuera del alcance.

La integración real con el simulador IoT y la resolución definitiva de `RESOURCE_IN_USE` de `TipoSensor` deberán retomarse al volver a Épica 7.

El ABM real de `TipoTarea` y `Tarea` deberá resolverse posteriormente en Épica 5.

## Alcance de esta etapa (HU-FP-05 y HU-FP-08)

Con Épica 7 ya resuelta (HU-IoT-02 y HU-IoT-03 implementadas), esta etapa retoma
las dos HU que quedaban pendientes de EP-03:

- HU-FP-05 — Visualizar estado actual de parcelas (ya implementada).
- HU-FP-08 — Visualizar estado actual de finca.

Ninguna de las dos requiere infraestructura nueva — ambas combinan datos ya
persistidos por HU-FP-03, HU-FP-04, HU-IoT-02 e HU-IoT-03. El botón "Solicitar
digitalización de finca" del AC de HU-FP-08 reutiliza
`POST /api/v1/solicitudes-digitalizacion` (Épica 1) sin cambios.

`recomendacion_ia_resumen` sigue en `null` — depende de HU-NA-03, que todavía no
tiene contrato (ver Pendiente #3).

## Convención de naming

Snake_case minúscula estricta en todo el documento, sin casing crudo del DC.