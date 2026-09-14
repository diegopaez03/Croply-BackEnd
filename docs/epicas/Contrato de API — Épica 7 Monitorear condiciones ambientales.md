# Contrato de API — Épica 7: Monitorear condiciones ambientales

Propietario: Rodrigo Sanz

> Se define lo que el backend debe implementar y lo que el frontend puede esperar recibir. Es un acuerdo entre ambas partes, no una imposición de un lado sobre el otro.
> 
> 
> Este contrato **no repite** las convenciones transversales ya definidas en las épicas anteriores (ERR-01, ERR-02, ERR-03, ERR-04, ERR-05 y la convención de `message` en respuestas exitosas). Antes de implementar cualquier manejo de errores o mensajes de éxito en esta épica, se debe revisar cómo ya están resueltos en el repositorio y **reutilizarlos tal cual están**. Solo se detallan acá los errores y casos **específicos** de los endpoints de esta épica.
> 

---

## Decisiones tomadas y notas de integración

1. **Atributo `codigo_tipo_sensor` como contrato de integración IoT:**
    - En el simulador IoT, los tipos corresponden a un Enum cerrado de 5 valores. En Croply, `TipoSensor` es una entidad persistida mediante ABM.
    - Se mantiene `codigo_tipo_sensor` como puente de comunicación. Al crear o editar un tipo de sensor en Croply, el backend debe validar obligatoriamente que `codigo_tipo_sensor` sea uno de los 5 valores soportados por el simulador: `TEMP_HUME_AMBIENTAL`, `HUMEDAD_SUELO`, `RADIACION_SOLAR`, `PRECIPITACION`, `PH`.
2. **Representación en Frontend (UX del Formulario):**
    - El formulario de creación/edición incluirá un selector obligatorio para `codigo_tipo_sensor` con los 5 valores del catálogo. Al seleccionar un código, el frontend precargará por omisión el `nombre_tipo_sensor` y la `unidad_medida_ts` sugeridos para agilizar la carga, permitiendo al usuario ajustarlos si lo desea.
3. **Auditoría de Creación y Edición (`id_usuario` y Modificaciones):**
    - El Diagrama de Clases (DC) de `TipoSensor` no incluye `id_usuario` ni `fecha_ultima_modificacion`. Dicha trazabilidad y el registro de usuario creador son responsabilidad exclusiva del servicio de auditoría **`LogOperaciones` (HU-GU-12)**. No se agregan campos adicionales a la entidad `TipoSensor`.

---

## HU-IoT-01. ABM de tipos de sensor

- **Autenticación:** Requerida (Rol: Administrador Croply)
- **Headers:** `Authorization: Bearer <JWT>`

### Listar tipos de sensor

`GET /api/v1/tipos-sensor`

```json
{
  "tipos_sensor": [
    {
      "id_tipo_sensor": 15,
      "codigo_tipo_sensor": "PH",
      "nombre_tipo_sensor": "Sensor de pH",
      "unidad_medida_ts": "pH"
    },
    {
      "id_tipo_sensor": 16,
      "codigo_tipo_sensor": "HUMEDAD_SUELO",
      "nombre_tipo_sensor": "Sensor de humedad del suelo",
      "unidad_medida_ts": "%"
    }
  ]
}
```

> El endpoint devuelve únicamente los tipos de sensor **activos**. Los registros con `fecha_baja` no deben aparecer en el listado.
> 
> 
> El `id_tipo_sensor` es necesario para las operaciones de edición y baja. `codigo_tipo_sensor` se incluye porque es el código de integración con el simulador IoT.
> 

Si no existen tipos de sensor activos:

```json
{
  "tipos_sensor": []
}
```

> **Comportamiento Frontend:** Renderiza un Empty State con el mensaje *"Aún no hay tipos de sensor cargados. Hacé clic en 'Nuevo Tipo de Sensor' para comenzar."*
> 

---

### Consultar catálogo de códigos de tipo de sensor

`GET /api/v1/tipos-sensor/codigos-disponibles`

> Expone el catálogo cerrado de códigos soportados actualmente por el simulador
> IoT, para que el frontend no necesite mantener una copia hardcodeada
> desincronizada del backend. Es de solo lectura: no consulta la tabla
> `tipos_sensor`, devuelve el catálogo fijo definido en el backend.

```json
{
  "codigos_tipo_sensor": [
    "TEMP_HUME_AMBIENTAL",
    "HUMEDAD_SUELO",
    "RADIACION_SOLAR",
    "PRECIPITACION",
    "PH"
  ]
}
```

> Mismo requisito de autenticación que el resto de HU-IoT-01 (Rol: Administrador
> Croply). No introduce errores nuevos: solo aplica el 401/403 transversales.

---

### Crear tipo de sensor

`POST /api/v1/tipos-sensor`

```json
{
  "codigo_tipo_sensor": "PH",
  "nombre_tipo_sensor": "Sensor de pH",
  "unidad_medida_ts": "pH"
}
```

`201 Created`:

```json
{
  "message": "Tipo de sensor creado correctamente.",
  "id_tipo_sensor": 15,
  "codigo_tipo_sensor": "PH",
  "nombre_tipo_sensor": "Sensor de pH",
  "unidad_medida_ts": "pH",
  "fecha_alta": "2026-08-10",
  "fecha_baja": null
}
```

> `codigo_tipo_sensor` es obligatorio y debe ser uno de los cinco códigos soportados actualmente por el simulador:
> 
> 
> `TEMP_HUME_AMBIENTAL | HUMEDAD_SUELO | RADIACION_SOLAR | PRECIPITACION | PH`
> 
> El backend debe validar esta restricción independientemente de las validaciones realizadas por el frontend.
> 

---

### Editar tipo de sensor

`PUT /api/v1/tipos-sensor/:id_tipo_sensor`

Mismo shape que la creación en el request.

```json
{
  "codigo_tipo_sensor": "PH",
  "nombre_tipo_sensor": "Sensor de pH",
  "unidad_medida_ts": "pH"
}
```

`200 OK`:

```json
{
  "message": "Tipo de sensor actualizado correctamente.",
  "id_tipo_sensor": 15,
  "codigo_tipo_sensor": "PH",
  "nombre_tipo_sensor": "Sensor de pH",
  "unidad_medida_ts": "pH"
}
```

> `codigo_tipo_sensor` continúa sujeto a la validación del catálogo cerrado del simulador.
> 

---

### Dar de baja tipo de sensor

`DELETE /api/v1/tipos-sensor/:id_tipo_sensor`
Se ejecuta una **baja lógica**, asignando la fecha actual a `fecha_baja`

`200 OK`:

```json
{
  "message": "Tipo de sensor dado de baja correctamente.",
  "id_tipo_sensor": 15
}
```

> El registro no se elimina físicamente y deja de aparecer en `GET /api/v1/tipos-sensor`.
> 

---

### **Errores específicos y transversales**

- `REQUIRED_FIELD` / `DUPLICATE_VALUE`: **ERR-01 / ERR-02 transversales**
- `RESOURCE_NOT_FOUND` (`404`): **ERR-05 transversal** al intentar accionar sobre un `id_tipo_sensor` inexistente o dado de baja

`400 Bad Request` **— código de tipo de sensor no soportado por el simulador:**

```json
{
  "statusCode": 400,
  "errorCode": "INVALID_SENSOR_TYPE_CODE",
  "field": "codigo_tipo_sensor",
  "message": "El código de tipo de sensor no es válido."
}
```

`409 Conflict` **—— Recurso en uso (reutiliza ERR-04 transversal):  tipo de sensor asignado a sensores físicos activos:**

```json
{
  "statusCode": 409,
  "errorCode": "RESOURCE_IN_USE",
  "message": "No es posible dar de baja este tipo de sensor porque está asignado a una o más parcelas."
}


```

**Regla de validación para la baja:** El error `RESOURCE_IN_USE` se dispara únicamente si existe al menos un **sensor físico activo** asociado a este tipo de sensor. Si los sensores físicos vinculados fueron previamente dados de baja, se permite dar de baja el tipo de sensor sin inconvenientes.



> **Estado de implementación (a la fecha de cierre de Etapa 1 de EP-03):** esta
> validación está pendiente de completarse. La entidad `Sensor` recién se
> incorporó al backend como parte de HU-FP-03 (Épica 3); hasta ese momento,
> `TiposSensorService` no podía verificar sensores físicos activos y el
> `DELETE` nunca devolvía este error. **Esta es la primera tarea a resolver al
> retomar Épica 7**, antes de avanzar con cualquier otra HU de esta épica.
>
> **Detalle técnico de la resolución (solo backend):** el método a reemplazar es
> `TiposSensorService.contar_sensores_activos_asociados()` (hoy un stub que
> retorna `0` de forma documentada) — reemplazarlo por un `count()` real sobre
> la entidad `Sensor`, filtrando por `id_tipo_sensor` y `fecha_baja IS NULL`.
> Habilitar también el/los `it.skip` relacionados en
> `tipos-sensor.service.spec.ts`. No se toca el resto del flujo de baja
> (validación de existencia, baja lógica) ni el shape del error — solo ese
> método puntual.


## HU-IoT-02. Visualizar datos de sensores en tiempo real por parcela

- **Autenticación:** Requerida — cualquier usuario con UsuarioFinca activo vinculado a la finca de esa parcela. Guard: AdminFincaGuard variante "por parcela" (resuelve la finca desde Parcela.finca.id_finca, mismo guard nuevo creado para HU-FP-04/06/07)

> Los valores no se consultan en vivo contra el simulador en cada request — Croply
> los sincroniza en segundo plano de forma periódica y los deja persistidos. El
> frontend simplemente lee el último dato que Croply ya tiene guardado.

### Consultar monitoreo de sensores de una parcela

`GET /api/v1/parcelas/:id_parcela/monitoreo-sensores`

```json
{
  "estado_general": "Transmitiendo",
  "sensores": [
    {
      "id_sensor": 501,
      "nombre_tipo_sensor": "Sensor de pH",
      "unidad_medida_ts": "pH",
      "ultimo_valor": 6.45,
      "fecha_ultima_lectura": "2026-09-07T20:31:08.461603Z",
      "estado_senal": "Transmitiendo"
    },
    {
      "id_sensor": 502,
      "nombre_tipo_sensor": "Sensor de humedad del suelo",
      "unidad_medida_ts": "%",
      "ultimo_valor": 38.2,
      "fecha_ultima_lectura": "2026-09-07T19:05:11.000000Z",
      "estado_senal": "Sin_senal"
    }
  ]
}
```

> `estado_general`: `"Transmitiendo"` si al menos uno de los sensores tiene
> `estado_senal: "Transmitiendo"`; `"Sin_senal"` si todos están sin señal.
> `ultimo_valor`/`fecha_ultima_lectura` se conservan aunque el sensor esté en
> `Sin_senal` — nunca se limpian a `null` una vez que hubo una lectura real.

Si la parcela no tiene ningún sensor asociado:

```json
{
  "estado_general": null,
  "sensores": []
}
```

> **Comportamiento Frontend:** mostrar *"Esta parcela no tiene sensores asociados."*

### Errores

- `RESOURCE_NOT_FOUND` (`404`): **ERR-05 transversal** si `id_parcela` no existe o está dada de baja.

> No hay error específico de "simulador no disponible" en este endpoint — eso ya
> se refleja en `estado_senal: "Sin_senal"` de los sensores afectados.

---

### Detalle técnico de la resolución (solo backend)

**Entidad nueva — `LecturaSensor`:** histórico propio de Croply, independiente
del historial del simulador. Campos: `id_lectura_sensor` (PK),
`valor_lectura_sensor` (double precision), `fecha_hora_lectura` (timestamptz),
`ManyToOne` hacia `Sensor` con `onDelete: CASCADE`. **Orden de escritura
obligatorio:** insertar primero la fila con el valor VIEJO de
`Sensor.ultimo_valor`, recién después sobrescribir `Sensor.ultimo_valor`/
`fecha_ultima_lectura` con el dato nuevo — si se invierte, se pierde el rastro
del valor anterior.

**Cálculo de `estado_senal` — 100% lógica de Croply, nunca copiado del
simulador.** El simulador no envía ningún campo de estado en
`GET /parcelas/{id}/estado` (confirmado en su schema real). Dos condiciones
independientes determinan `Sin_senal`:
1. Falla de comunicación con el simulador (timeout, red, 5xx) → conservar
   último valor conocido, no actualizar nada más.
2. Respuesta 200 OK pero `fecha_ultima_lectura` más vieja que una ventana de
   tolerancia configurable (sugerido `N × intervalo_sincronizacion`, `N = 2`
   default).

Un `Sensor` recién creado nace en `Sin_senal`/`null`/`null`. Solo la primera
sincronización exitosa y reciente lo cambia.

**Pendiente de decisión de negocio, no bloquea esta HU:**
`ControladorSensor.estado_controlador` sigue naciendo en `Transmitiendo` por
defecto (definido en Épica 3, HU-FP-03). El estado "real" de transmisión
queda reflejado a nivel de `Sensor`, no de `ControladorSensor`, por ahora.

**Mapeo de `EstadoTransmision` — solo Croply → Simulador.** Los valores de
Croply (`Transmitiendo`/`Sin_senal`) no coinciden textualmente con los del
simulador (`TRANSMITIENDO`/`SIN_SEÑAL`, con Ñ). Se necesita mapeo explícito
únicamente al sincronizar estructura (`POST`/`PUT`/`PATCH` hacia el
simulador) — nunca al leer, porque el simulador no manda estados al leer.

**Origen de `latitud`/`longitud` para el simulador:** `Parcela` no tiene
columnas propias de ubicación. Se usa `parcela.finca.latitud`/`longitud`
(convertidas de `string` a `float`). Decisión confirmada: se asume ubicación
climática compartida dentro de una misma finca.

**Endpoint independiente:** `GET /parcelas/:id_parcela/monitoreo-sensores`
no reemplaza ni depende de `GET /fincas/:id_finca` (Épica 3) — son rutas
distintas para pantallas distintas, aunque lean campos de la misma entidad
`Sensor`.

**Sincronización estructural (POST/PUT/DELETE hacia el simulador):** se
dispara después de confirmar la operación en Croply. Si Croply falla al
persistir, no se sincroniza nada. Asíncrona respecto de la respuesta HTTP al
usuario. Hasta 3 reintentos ante falla de comunicación.

**Sincronización de lecturas (proceso periódico):** intervalo configurable
por variable de entorno (`SIMULADOR_SYNC_INTERVAL_MINUTES`, default `25`,
alineado con `SCHEDULER_INTERVAL_MINUTES` del simulador). Nunca hardcodear
un valor fijo en código — ni siquiera `2` para desarrollo. Fuente de lectura:
`GET /parcelas/{id}/estado`. Nunca `GET /parcelas/{id}/lecturas`.

**Múltiples controladores por parcela:** ya soportado en ambos sistemas
desde la corrección aplicada al simulador (commit `4fc08cd` en adelante).
Sin trabajo pendiente relacionado.

---

## HU-IoT-03. Seleccionar finca para visualizar pronóstico meteorológico

- **Autenticación:** Requerida — cualquier usuario con `UsuarioFinca` activo vinculado a esa finca. Guard: `AdminFincaGuard` (el original, `:id_finca` directo en la URL, no la variante por parcela).

> Clima en vivo contra Open-Meteo, sin caché ni persistencia — cada llamada consulta el servicio externo con `latitud`/`longitud` de la finca. El `weather_code` de Open-Meteo se traduce a `condicion` mediante un mapeo estático dentro del módulo backend (no tabla de BD, no se expone el código crudo al frontend).

### Consultar clima de una finca (actual + pronóstico de 4 días)

`GET /api/v1/fincas/:id_finca/clima`

```json
{
  "provincia": "Mendoza",
  "departamento": "Capital",
  "clima_actual": {
    "temperatura": 24.5,
    "condicion": "Parcialmente nublado"
  },
  "pronostico": [
    { "fecha": "2026-08-27", "dia_semana": "Jueves", "es_hoy": true, "temperatura_max": 24, "temperatura_min": 14, "condicion": "Parcialmente nublado" },
    { "fecha": "2026-08-28", "dia_semana": "Viernes", "es_hoy": false, "temperatura_max": 19, "temperatura_min": 11, "condicion": "Lluvia" },
    { "fecha": "2026-08-29", "dia_semana": "Sábado", "es_hoy": false, "temperatura_max": 21, "temperatura_min": 12, "condicion": "Nublado" },
    { "fecha": "2026-08-30", "dia_semana": "Domingo", "es_hoy": false, "temperatura_max": 23, "temperatura_min": 13, "condicion": "Despejado" }
  ]
}
```

> `pronostico`: **4 entradas siempre** — hoy (`es_hoy: true`) + los 3 días posteriores. El frontend resalta el día actual usando `es_hoy`, no la posición en el array.
> `condicion`: uno de estos 11 valores cerrados, sin excepciones — `Despejado | Parcialmente nublado | Nublado | Niebla | Lluvia | Nieve | Tormenta | Tormenta eléctrica | Helada | Granizo | Temperatura elevada`. `Helada` y `Temperatura elevada` no se derivan únicamente del `weather_code` de Open-Meteo — el mapeo del backend también tiene que considerar la temperatura como parte de la misma lógica de traducción.
> **Sin caché.** **Polling cada 30 minutos:** responsabilidad exclusiva del frontend (`refetchInterval`).

### Errores

`503 Service Unavailable` — Open-Meteo no responde o devuelve error:

```json
{
  "statusCode": 503,
  "errorCode": "WEATHER_SERVICE_UNAVAILABLE",
  "message": "No se pudo obtener la información climática en este momento."
}
```

> El frontend muestra este mensaje de forma no bloqueante, sin ocultar el resto de la pantalla. Sin reintento automático del lado backend.

---

### Detalle técnico de la resolución (solo backend)

**Cliente HTTP nuevo:** agregar `@nestjs/axios` — el proyecto no tiene ningún cliente HTTP instalado todavía.

**Llamada real a Open-Meteo:** `GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`, con `lat`/`lon` parseadas de `finca.latitud`/`longitud` (`string` → `float`, mismo tipo de conversión que hacia el simulador IoT).

**Mapeo `weather_code` → `condicion`** (WMO Weather codes, estándar usado por Open-Meteo):

| weather_code | condicion base |
|---|---|
| 0 | Despejado |
| 1, 2 | Parcialmente nublado |
| 3 | Nublado |
| 45, 48 | Niebla |
| 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82 | Lluvia |
| 71, 73, 75, 77, 85, 86 | Nieve |
| 95 | Tormenta |
| 96, 99 | Tormenta eléctrica |

`Granizo` no tiene código WMO propio en Open-Meteo — pendiente definir si se deriva de algún código de tormenta con una condición adicional, o si por ahora queda sin mapeo automático.

**Override por temperatura (aplica después del mapeo base, puede reemplazarlo):**
- `Helada`: temperatura relevante `<= 0°C`.
- `Temperatura elevada`: temperatura relevante `>= 35°C`.

**Qué temperatura es "la relevante" en cada caso:**
- `clima_actual` → `current_weather.temperature`.
- Cada entrada de `pronostico` → `Helada` contra `temperatura_min` de ese día; `Temperatura elevada` contra `temperatura_max` de ese día.

**Sin persistencia ni caché** — cada request dispara una llamada real a Open-Meteo.

**Guard a reutilizar:** `AdminFincaGuard` original — esta ruta tiene `:id_finca` directo, no `:id_parcela`.

**Sin dependencia técnica de HU-FP-05:** aunque la card también se muestra en el detalle de parcela (AC de la HU funcional), el endpoint solo necesita `id_finca` — no tiene relación con `Parcela`. Puede implementarse sin esperar a esa HU.
>
