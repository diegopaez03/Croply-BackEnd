# Contrato de API — Épica 4: Planificar Cultivos

> Este documento define lo que el backend debe implementar y lo que el frontend puede esperar recibir. Es un acuerdo entre ambas partes, no una imposición de un lado sobre el otro.
>
> Este contrato **no repite** las convenciones transversales ya definidas en épicas anteriores (ERR-01 a ERR-05, y la convención de `message` en respuestas exitosas). Antes de implementar cualquier manejo de errores o mensajes de éxito, revisar cómo ya están resueltos en el repositorio y reutilizarlos tal cual están.

**Estado backend (Épica 4):** implementadas HU-BC-01 a HU-BC-06. Catálogo mock de `TipoTarea` en `src/modules/cultivos/tipo-tarea.catalog.ts` (el id `5` es “Aplicación de agroquímico”). El `estado` de la tarea real es un conjunto cerrado (`Planificado | En Progreso | Completado`) hasta HU-TC-02.

---

## Pendientes (no implementar hasta resolver)

**1. Campo "Forma de siembra"** — HU-BC-01 lo pide como desplegable obligatorio en el cultivo base, pero no existe en el diagrama de clases (`CultivoBase` no lo tiene). Falta definir si es un enum nuevo o texto libre. Por ahora se elimina del contrato hasta que se confirme lo contrario.

**Resuelto:** Se creó el atributo “forma_siembra” con enum FormaSiembra.

**2. Campo "Observaciones de cosecha" en Variedad** — el AC de HU-BC-01 lo pide explícitamente como campo de texto opcional al agregar/editar una variedad, pero la clase `Variedad` del DC no lo tiene (`id_Variedad`, `nombre_Variedad`, `distancia_plantacion`, `dias_a_cosecha`, `fecha_alta`, `fecha_baja` — nada de observaciones). Se decide que el DC no se va a actualizar para incluir este atributo. Por ahora el contrato no lo tiene.

**Resuelto:** Se creó el atributo “observaciones” de tipo String.

**4. Campo `imagen_url`** — no está en el UML original. Se agregó como `varchar(500)` nullable en `CultivoBase` y `Variedad`. El archivo se sube **antes** de guardar la ficha, vía `POST /api/v1/uploads/imagenes`; el CRUD de cultivos/variedades solo persiste la URL. El renderizado de esas imágenes en listados y otras pantallas queda fuera de esta entrega.

**3. HU-BC-06** — implementada sobre el plan real de Épica 3. No hay endpoints de alta/edición/baja de hitos: quedan fijos al generarse el plan (HU-FP-04). `AplicacionAgroquimico` como registro propio (más allá de los 3 campos embebidos en `Tarea`) sigue pendiente de Épica 6.

---



## Errores específicos que se agregan en esta Épica

**ERR-06 — Cronograma vacío (hito/plantilla sin tareas)**

*Backend debe:* si se intenta guardar una plantilla sin ningún hito con tareas, devolver:

```json
{
  "statusCode": 400,
  "errorCode": "EMPTY_SCHEDULE",
  "message": "<mensaje específico según el caso, ver detalle en cada HU>"
}
```

*Frontend debe:* mostrar el mensaje sin cerrar el modal/formulario, y sin guardar.

**ERR-07 — Variedad ya cubierta por otra plantilla específica**

*Backend debe:* al guardar una plantilla, si alguna variedad seleccionada ya está específicamente asociada a otra plantilla existente del mismo cultivo, devolver:

```json
{
  "statusCode": 409,
  "errorCode": "VARIETY_ALREADY_ASSIGNED",
  "message": "Esta variedad ya tiene una plantilla específica asignada.",
  "id_variedad": 12
}
```

*Frontend debe:* mostrar el mensaje sobre el selector de variedades, sin guardar. `id_variedad` viaja para resaltar puntualmente cuál variedad es la conflictiva si se seleccionó más de una.

**ERR-08 — Tarea no editable por su estado**

*Backend debe:* si se intenta editar, cambiar el estado o eliminar una tarea que ya está `Completado`, devolver:

```json
{
  "statusCode": 409,
  "errorCode": "TASK_NOT_EDITABLE",
  "message": "No se puede modificar una tarea que ya fue completada."
}
```

**INVALID_STATUS_TRANSITION (400)** — intento de setear `Inactivado` (u otra transición no permitida) en el plan desde el endpoint manual.

**TASKS_NOT_COMPLETED (400)** — intento de setear `Finalizado` en el plan sin que todas las tareas estén `Completado`.

> Nota: "cultivo en uso" y "variedad en uso" (no se pueden eliminar si tienen plantillas o parcelas asociadas) **reutilizan ERR-04 transversal** (`RESOURCE_IN_USE`, Épica 2) — no son códigos nuevos, aunque las HU los numeren distinto en su propio texto local (ERR-03/ERR-04 en HU-BC-01).

---



## HU-BC-01. ABM de cultivos base de la biblioteca

- **Autenticación:** Requerida (Rol: Administrador Croply)



### Flujo completo

1. **Creación de cultivo:** Se crea el cultivo (POST) enviando únicamente los datos generales de la ficha técnica — el formulario de creación no pide variedades.
2. **Transición fluida:** Al guardar con éxito el cultivo nuevo, el modal **NO** se cierra. Muestra el mensaje de éxito y revela automáticamente la sección inferior de "Variedades" con el botón "+ Agregar variedad" habilitado.
3. **Visualización y Edición desde la lista:** Hacer clic en cualquier fila o tarjeta de la lista principal abre este mismo modal unificado en modo lectura, con la ficha técnica y la lista de variedades visibles desde el inicio.
4. **Edición de Ficha Técnica General:** El botón "Editar" del bloque superior habilita únicamente los campos generales del cultivo de forma inline. Se guarda con `PUT /api/v1/cultivos/base/:id_cultivo_base`.
5. **Gestión de Variedades:** La sección inferior de variedades opera de forma independiente dentro del mismo modal. El botón "+ Agregar variedad" y los íconos de "Editar" y "Eliminar" en cada fila de variedad despliegan su edición inline dentro de la propia sección, pegando a los endpoints subrecurso de variedades.



### Listar cultivos (con búsqueda y filtro, comparte endpoint con HU-BC-03/04/05)

`GET /api/v1/cultivos/base`

**Query params:** `search` (nombre, case-insensitive, opcional), `epoca_cultivo` (opcional, uno de `Todo_el_anio | Primavera_verano | Otonio_invierno`), `forma_siembra` (opcional, `Directa | Almacigo` )

```json
{
  "cultivos": [
    {
      "id_cultivo_base": 1,
      "nombre_cultivo_base": "Tomate",
      "descripcion_cb": "Fruto nacional premium",
      "epoca_cultivo": "Primavera_verano",
      "cantidad_variedades": 15,
      "ciclo_productivo_cb": "70-90 días",
      "forma_siembra": "Almacigo",
      "imagen_url": null
    }
  ]
}
```

> Sin resultados por búsqueda/filtro: `cultivos: []` — se distingue "sin datos" de "sin resultados" mirando si la request llevaba `search`/`epoca_cultivo` / `forma_siembra` mismo criterio que en Épica 2.



### Crear cultivo

`POST /api/v1/cultivos/base`

```json
{
  "nombre_cultivo_base": "Tomate",
  "descripcion_cb": "Fruto nacional premium",
  "epoca_cultivo": "Primavera_verano",
  "mes_siembra": "Sep-Oct",
  "ciclo_productivo_cb": "70-90 días",
  "forma_siembra": "Almacigo",
  "imagen_url": "https://res.cloudinary.com/demo/image/upload/v1/croply/tomate.jpg"
}
```

> `ciclo_productivo_cb`: obligatorio SOLO al crear (todavía no hay variedades de donde calcularlo). Cuando se agregue la primera variedad, el backend recalcula este valor automáticamente como rango, y el valor manual queda sobreescrito de ahí en adelante.

> `imagen_url`: opcional (`string | null`). El frontend primero sube el archivo a `POST /uploads/imagenes` y luego envía la `url` acá. Si no hay imagen, se omite o se manda `null`.

> `fecha_alta_cb`: la pone el backend automáticamente al crear el cultivo

`201 Created`:

```json
{
  "message": "Cultivo creado correctamente",
  "id_cultivo_base": 45,
  "nombre_cultivo_base": "Tomate",
  "descripcion_cb": "Fruto nacional premium",
  "epoca_cultivo": "Primavera_verano",
  "mes_siembra": "Sep-Oct",
  "ciclo_productivo_cb": "70-90 días",
  "forma_siembra": "Almacigo",
  "imagen_url": "https://res.cloudinary.com/demo/image/upload/v1/croply/tomate.jpg"
}
```



### Ver detalle de cultivo (ficha técnica + variedades)

`GET /api/v1/cultivos/base/:id_cultivo_base`

```json
{
  "id_cultivo_base": 45,
  "nombre_cultivo_base": "Tomate",
  "descripcion_cb": "Fruto nacional premium",
  "epoca_cultivo": "Primavera_verano",
  "mes_siembra": "Sep-Oct",
  "ciclo_productivo_cb": "70-90 días",
  "forma_siembra": "Almacigo",
  "imagen_url": "https://res.cloudinary.com/demo/image/upload/v1/croply/tomate.jpg",
  "variedades": [
    {
      "id_variedad": 12,
      "nombre_variedad": "Perita",
      "distancia_plantacion": "30x60cm",
			"observaciones": "Mas dulce, con menos semillas.",
      "dias_a_cosecha": 75,
      "fecha_alta": "2026-03-10",
      "en_uso": true,
      "imagen_url": null
    }
  ]
}
```

> `en_uso`: booleano calculado por el backend — si está asociada a alguna plantilla o a alguna asociación activa de parcela. El frontend lo usa para decidir si el ícono de eliminar va habilitado, sin intentar borrar para descubrirlo.
> `fecha_alta`: la pone el backend automáticamente al crear la variedad — no viaja en el request, solo en la respuesta.



### Editar cultivo (ficha técnica)

`PUT /api/v1/cultivos/base/:id_cultivo_base` — mismo shape que la creación. `200 OK` con `message: "Cultivo actualizado correctamente"`.

### Dar de baja cultivo

`DELETE /api/v1/cultivos/base/:id_cultivo_base` — baja lógica utilizando el atributo de `fecha_baja_cb`. `200 OK` con `message: "Cultivo eliminado correctamente"`.

### Variedades — subrecurso de cultivo

**Agregar variedad**

`POST /api/v1/cultivos/base/:id_cultivo_base/variedades`

```json
{
  "nombre_variedad": "Perita",
  "distancia_plantacion": "30x60cm",
  "observaciones": "Mas dulce, con menos semillas.",
  "dias_a_cosecha": 75,
  "imagen_url": null
}
```

`201 Created` con `message: "Variedad agregada correctamente"` 

```json
{
"message": "Variedad agregada correctamente",
"id_variedad": 12,
"nombre_variedad": "Perita",
"distancia_plantacion": "30x60cm",
"observaciones": "Mas dulce, con menos semillas.",
"dias_a_cosecha": 75,
"fecha_alta": "2026-03-10",
"en_uso": false,
"ciclo_productivo_cb": "68-75 días",
"imagen_url": null
}
```

(mismo shape que en el listado de variedades del detalle, incluyendo `fecha_alta`). La respuesta debe incluir también `ciclo_productivo_cb`  **actualizado** del cultivo padre, para que el frontend pueda refrescar la ficha técnica sin hacer un GET adicional.

**Editar variedad**

`PUT /api/v1/cultivos/base/:id_cultivo_base/variedades/:id_variedad` — mismo shape que crear (sin `fecha_alta`, que no se edita). `200 OK` con `message: "Variedad actualizada correctamente"`.

**Eliminar variedad**

`DELETE /api/v1/cultivos/base/:id_cultivo_base/variedades/:id_variedad` — baja lógica utilizando el atributo `fecha_baja` . `200 OK` con `message: "Variedad eliminada correctamente"`.

### Errores

- `REQUIRED_FIELD` / `DUPLICATE_VALUE` (nombre de cultivo repetido, `field: "nombre_cultivo_base"`) → ERR-01/ERR-02 transversales.
- `DUPLICATE_VALUE` (nombre de variedad repetido dentro del mismo cultivo, `field: "nombre_variedad"`) → ERR-02.
- `RESOURCE_IN_USE` (409) al eliminar variedad/cultivo en uso → **ERR-04 transversal** (Épica 2). Mensajes:
  - Variedad: `"Esta variedad no se puede eliminar porque está en uso."`
  - Cultivo: `"Este cultivo no se puede eliminar porque está en uso."`

### Subida de imágenes (transversal a ficha / variedad)

`POST /api/v1/uploads/imagenes` — autenticado (cualquier JWT válido). `multipart/form-data`, campo `archivo`.

Tipos permitidos: `image/jpeg`, `image/png`, `image/webp`. Tamaño máximo: 5 MB.

`201 Created`:

```json
{
  "message": "Imagen subida correctamente",
  "url": "https://res.cloudinary.com/demo/image/upload/v1/croply/tomate.jpg",
  "public_id": "croply/tomate"
}
```

Errores propios:

- `REQUIRED_FIELD` (`field: "archivo"`) si no viaja el archivo.
- `INVALID_FILE_TYPE` (400) si el MIME no está permitido.
- `FILE_TOO_LARGE` (400) si supera 5 MB.

El frontend usa `url` como `imagen_url` al crear/editar cultivo o variedad. No hace falta persistir `public_id` en esta entrega.

---



## HU-BC-02. ABM de plantillas de planes base

- **Autenticación:** Requerida (Rol: Administrador Croply)

### Sobre plantillas generales vs específicas

`PlantillaCultivoVariedad → Variedad` es una relación **opcional**: si la fila tiene `id_variedad`, la plantilla es **específica** de esa variedad; si `id_variedad` es `null`, es **general** para el cultivo completo (aplica automáticamente a todas las variedades presentes y futuras que no tengan su propia plantilla específica). En el frontend, el selector de variedades no debe quedar vacío de forma ambigua — debe ofrecer una opción explícita **"Todas las variedades"**, que al guardar se traduce a `id_variedad: null`. No existe ninguna variedad real llamada "Todas".

**Prioridad al consultar (HU-BC-03):** primero buscar si existe una fila con la `id_variedad` específica; si no existe, usar la fila con `id_variedad: null` del mismo cultivo (la general), si existe.

### Listar plantillas (formato resumido para cards)

`GET /api/v1/cultivos/plantillas-base?page=1&pageSize=10`

```json
{
  "plantillas": [
    {
      "id_plantilla_base": 3,
      "nombre_pb": "Plan de Cultivo de Ajo",
      "cultivos": [
		    { "id_pbcv": 23, "id_cultivo_base": 45, "id_variedad": null },
		    { "id_pbcv": 24, "id_cultivo_base": 45, "id_variedad": 12 }
		  ],
      "cantidad_tareas": 28
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 24, "totalPages": 3 }
}
```



### Crear plantilla

`POST /api/v1/cultivos/plantillas-base`

```json
{
  "nombre_pb": "Plan de Cultivo de Tomate",
  "cultivos": [
    { "id_cultivo_base": 45, "id_variedad": null },
    { "id_cultivo_base": 45, "id_variedad": 12 }
  ],
  "hitos": [
    {
      "nombre_hpb": "Siembra",
      "orden_hpb": 1,
      "tareas": [
        {
          "dia_relativo_tp": 0,
          "id_tipo_tarea": 5,
          "descripcion_tp": "Preparación de almácigo",
          "nombre_producto": null,
          "dosis_aa": null
        }
      ]
    }
  ]
}
```

> `cultivos`: puede tener más de una fila (varios cultivos y/o varias variedades en la misma plantilla).
> `tareas`: los campos de agroquímico (`nombre_producto`, `dosis_aa`) solo son obligatorios si `id_tipo_tarea` es "Aplicación de agroquímico" — validación condicional.
> "Responsable" y "Fecha y hora" **no aplican a nivel plantilla** (son de la tarea real generada en una parcela, ver HU-BC-06) — no viajan acá.

> **Notas de implementación para Backend:**
> El objeto `cultivos` en la request/response representa las filas de la tabla intermedia `PlantillaCultivoVariedad` (PCV).
>
> - Si `id_variedad` es `null`, la plantilla se vincula únicamente a `CultivoBase` (plantilla general).
> - Si `id_variedad` tiene un ID, la fila de PCV guarda la relación explícita con la `Variedad` (plantilla específica).
>
> El ABM de `TipoTarea` se crea en la EP-05, por lo que puedes mockear esto con un enum y dejar documentado que se debe implementar al momento de hacer la EP-05. Lo mismo pasa con la entidad `Tarea.`

`201 Created` con `message: "Plantilla creada correctamente"` y el detalle completo (mismo shape que "Ver detalle").

### Ver detalle de plantilla

`GET /api/v1/cultivos/plantillas-base/:id_plantilla_base`

```json
{
  "id_plantilla_base": 3,
  "nombre_pb": "Plan de Cultivo de Tomate",
  "cultivos_info": [
    { "id_cultivo_base": 45, 
		   "nombre_cultivo_base": "Tomate", 
		   "epoca_cultivo": "Primavera_verano", 
		   "mes_siembra": "Sep-Oct", 
		   "ciclo_productivo_cb": "70-90 días" }
  ],
  "cultivos": [
    { "id_pbcv": 23, 
	    "cultivo_base": { 
		    "id_cultivo_base": 45, 
			  "nombre_cultivo_base": "Tomate", 
			  "epoca_cultivo": "Primavera_verano", 
			  "mes_siembra": "Sep-Oct", 
			  "ciclo_productivo_cb": "70-90 días" }, 
			  "variedad": null },
    { "id_pbcv": 24, 
	    "cultivo_base": { 
		    "id_cultivo_base": 45, 
			  "nombre_cultivo_base": "Tomate", 
			  "epoca_cultivo": "Primavera_verano", 
			  "mes_siembra": "Sep-Oct", 
			  "ciclo_productivo_cb": "70-90 días" }, 
			  "variedad": null }, 
	    "variedad": {
				"id_variedad": 12,
				"nombre_variedad": "Perita",
				"distancia_plantacion": "30x60cm",
				"observaciones": "Mas dulce, con menos semillas.",
				"dias_a_cosecha": 75,
				"fecha_alta": "2026-03-10",
				"en_uso": false,
				"ciclo_productivo_cb": "68-75 días" } 
			}
  ],
  "hitos": [
    {
      "id_hito_plantilla": 10,
      "nombre_hpb": "Siembra",
      "orden_hpb": 1,
      "tareas": [
        { "id_tarea_plantilla": 33, 
	        "dia_relativo_tp": 0, 
	        "id_tipo_tarea": 5, 
	        "nombre_tipo_tarea": "Siembra", 
	        "descripcion_tp": "Preparación de almácigo" }
      ]
    }
  ]
}
```



### Editar plantilla

`PUT /api/v1/cultivos/plantillas-base/:id_plantilla_base` — mismo shape que crear. `200 OK` con `message: "Plantilla actualizada correctamente"`.

> Regla de negocio (no cambia el contrato, es responsabilidad exclusiva del backend): editar una plantilla no afecta los planes ya generados a partir de ella — esos copiaron los datos al momento de generarse. Los cambios solo aplican a futuras generaciones de planes de acción.



### Eliminar plantilla

`DELETE /api/v1/cultivos/plantillas-base/:id_plantilla_base` — baja lógica, permitida sin importar si fue usada antes (no aplica ERR-04 acá). `200 OK` con `message: "Plantilla eliminada correctamente"`.

### Errores

- `DUPLICATE_VALUE` (nombre repetido, `field: "nombre_pb"`) → ERR-02.
- `EMPTY_SCHEDULE` (400) sin ningún hito con tareas → **ERR-06**, mensaje: `"La plantilla debe tener al menos un hito con una tarea para poder guardarse."`
- `VARIETY_ALREADY_ASSIGNED` (409) → **ERR-07**.

---



## HU-BC-03. Consultar información agronómica de un cultivo

- **Autenticación:** Requerida (Rol: Administrador de Finca)

> **Nota de implementación para Backend (Resolución de Plantillas):**
> Los campos `id_plantilla_general` e `id_plantilla_especifica` no son columnas físicas de la tabla `CultivoBase` ni `Variedad`, sino **propiedades calculadas** mediante la consulta a `PlantillaCultivoVariedad` (PCV):
>
> - `id_plantilla_general`: ID de la `PlantillaBase` vinculada en PCV donde `id_cultivo_base = X` e `id_variedad IS NULL`.
> - `id_plantilla_especifica`: ID de la `PlantillaBase` vinculada en PCV donde `id_cultivo_base = X` e `id_variedad = Y`.



### Listar cultivos (vista simplificada para cards)

`GET /api/v1/cultivos/base` — mismo endpoint que HU-BC-01/04/05, ya trae todo lo necesario para la card.

### Ver detalle de cultivo + referencias de plantillas por variedad

`GET /api/v1/cultivos/base/:id_cultivo_base` — mismo endpoint que HU-BC-01, con `id_plantilla_general` y `id_plantilla_especifica` (por variedad) agregados:

```json
{
  "id_cultivo_base": 45,
  "nombre_cultivo_base": "Tomate",
  "epoca_cultivo": "Primavera_verano",
  "descripcion_cb": "Fruto nacional premium",
  "mes_siembra": "Sep-Oct",
  "ciclo_productivo_cb": "70-90 días",
  "forma_siembra": "Almacigo",
  "id_plantilla_general": 3,
  "variedades": [
    { 
      "id_variedad": 12, 
      "nombre_variedad": "Perita", 
      "dias_a_cosecha": 75, 
      "id_plantilla_especifica": 8 
    },
    { 
      "id_variedad": 13, 
      "nombre_variedad": "Redondo", 
      "dias_a_cosecha": 68, 
      "id_plantilla_especifica": null 
    }
  ]
}
```

> **Comportamiento del Frontend:**
>
> 1. Si la variedad tiene `id_plantilla_especifica`, el frontend consulta esa plantilla.
> 2. Si `id_plantilla_especifica` es `null`, recurre a `id_plantilla_general`.
> 3. Si ambos son `null`, muestra: *"Este cultivo no tiene un plan de acción predefinido disponible."* sin realizar llamadas adicionales.



### Ver cronograma de una plantilla puntual

`GET /api/v1/cultivos/plantillas-base/:id_plantilla_base` — mismo endpoint que HU-BC-02, reutilizado para mostrar el cronograma en el detalle de variedad.

### Errores

Ninguno específico — son consultas.

---



## HU-BC-04 y HU-BC-05. Buscar y filtrar cultivos en la biblioteca

- **Autenticación:** Requerida (Rol: Administrador de Finca o Administrador Croply)

> **Nota de arquitectura:**
> Ambas historias de usuario comparten el mismo endpoint `GET /api/v1/cultivos/base` definido en HU-BC-01. No existen endpoints dedicados para búsqueda o filtrado.



### Endpoint Unificado

`GET /api/v1/cultivos/base`

**Query Params (opcionales y combinables):**

- `search` (string, opcional): Búsqueda parcial e insensible a mayúsculas/minúsculas sobre `nombre_cultivo_base`.
- `epoca_cultivo` (enum, opcional): Uno de `Todo_el_anio` | `Primavera_verano` | `Otonio_invierno`. Si se envía `Todo_el_anio` o se omite, no se aplica filtro de época.

**Ejemplo de consulta combinada:**`GET /api/v1/cultivos/base?search=tom&epoca_cultivo=Primavera_verano`

### Respuesta Exitosa (`200 OK`)

```json
{
  "cultivos": [
    {
      "id_cultivo_base": 45,
      "nombre_cultivo_base": "Tomate",
      "epoca_cultivo": "Primavera_verano",
      "descripcion_cb": "Fruto nacional premium",
      "mes_siembra": "Sep-Oct",
      "ciclo_productivo_cb": "70-90 días",
      "forma_siembra": "Almacigo",
      "cantidad_variedades": 2
    }
  ]
}
```



### Manejo de Respuestas Vacías (`200 OK`)

Cuando no hay coincidencias en la base de datos, el backend devuelve `"cultivos": []`. El frontend determina el mensaje a mostrar según los filtros activos:

1. **Solo búsqueda activa:** *"No se encontraron cultivos que coincidan con la búsqueda."*
2. **Solo filtro de época activo:** *"No hay cultivos disponibles para la temporada seleccionada."*
3. **Sin datos registrados en el sistema:** *"Aún no hay cultivos cargados en la biblioteca."*



### Errores

Ninguno específico.

---



## HU-BC-06. ABM de hitos y tareas del plan de acción de un cultivo

> `AplicacionAgroquimico` sigue dependiendo del contrato de Épica 6 — ver Pendiente al final de esta sección.
>
- **Autenticación:** Requerida (Administrador de Finca o usuario con permiso `Tareas de campo` habilitado sobre la finca)

### Restricción de alcance

Los usuarios de finca **NO** pueden crear, editar ni eliminar hitos de un plan ya generado — los hitos quedan fijos tal como los copió la plantilla (HU-FP-04). Solo pueden crear, editar y eliminar **tareas** dentro de esos hitos, y cambiar el estado de una tarea o del plan completo. Este contrato no incluye `POST`/`PUT`/`DELETE` de hitos.

### Ver cronograma

`GET /api/v1/planes-accion/:id_plan_accion`

Respuesta: `id_plan_accion`, `fecha_inicio_pa`, `fecha_fin_pa`, `superficie_ocupada_pa`, `estado`, `hitos[]` (`id_hito_real`, `nombre_hito`, `orden_hito`, `tareas[]`).

Cada tarea: `id_tarea`, `nombre_tarea`, `descripcion_tarea`, `fecha_planificada_tarea` (`YYYY-MM-DD`), `fecha_ejecucion_tarea`, `fecha_creacion_tarea`, `id_tipo_tarea`, `nombre_tipo_tarea`, `estado` (`Planificado | En Progreso | Completado`), `nombre_producto_aa`, `dosis_aa`, `fecha_hora_aplicacion_aa`, `id_responsable` (`id_usuario_finca`), `nombre_responsable`.

Los 3 campos `_aa` solo tienen valor si `id_tipo_tarea` es “Aplicación de agroquímico”. `fecha_ejecucion_tarea` la completa el backend al pasar a `Completado`.

### Agregar tarea

`POST /api/v1/planes-accion/:id_plan_accion/hitos/:id_hito_real/tareas`

Body: `nombre_tarea`, `descripcion_tarea`, `fecha_planificada_tarea`, `id_tipo_tarea`; `nombre_producto_aa`, `dosis_aa` y `fecha_hora_aplicacion_aa` obligatorios solo si el tipo es agroquímico; `id_responsable` siempre opcional.

`201 Created` con `message: "Tarea agregada correctamente"` y el objeto `Tarea` completo.

### Editar tarea (datos, no estado)

`PUT /api/v1/planes-accion/:id_plan_accion/tareas/:id_tarea`

Mismo body que la creación. Se rechaza con `TASK_NOT_EDITABLE` (ERR-08) si la tarea está `Completado`.

### Cambiar estado de una tarea

`PUT /api/v1/planes-accion/:id_plan_accion/tareas/:id_tarea/estado`

```json
{ "estado": "Completado" }
```

`200 OK` con `message`, `id_tarea`, `estado`, `fecha_ejecucion_tarea` y `todas_tareas_completadas`. El frontend usa ese flag para el modal de cierre del cultivo. Se rechaza con `TASK_NOT_EDITABLE` si ya estaba `Completado`.

### Eliminar tarea

`DELETE /api/v1/planes-accion/:id_plan_accion/tareas/:id_tarea`

Se rechaza con `TASK_NOT_EDITABLE` si está `Completado`.

### Cambiar estado del plan

`PUT /api/v1/planes-accion/:id_plan_accion/estado`

```json
{ "estado": "Finalizado" }
```

Acepta únicamente `Finalizado | Cancelado | FinalizadoPorContingencia`. `Inactivado` se rechaza con `INVALID_STATUS_TRANSITION`. `Finalizado` exige todas las tareas `Completado` (`TASKS_NOT_COMPLETED` si no). `Cancelado` y `FinalizadoPorContingencia` se pueden setear en cualquier momento sobre un plan `Activo`.

Un plan en estado final deja de listarse en “Cultivos” (HU-FP-05) y pasa a “Historial de cultivos” (HU-FP-06).

### Pendiente

`AplicacionAgroquimico` como registro propio (más allá de los 3 campos embebidos en `Tarea`) sigue dependiendo de Épica 6.

---

## Convención de naming

Snake_case minúscula en todo el documento, sin excepciones — a diferencia de las versiones iniciales de los borradores, no se mantiene el casing crudo del Diagrama de Clases (DC).

Las abreviaturas que identifican a cada entidad (`_cb` para CultivoBase, `_tp` para TareaPlantilla, `_hpb` para HitoPlantilla, `_pb` para PlantillaBase, `_pa` para PlanAccion, `_aa` para AplicacionAgroquimico, y las abreviaturas generales de `_hito` y `_tarea`) se conservan en minúscula con guion bajo como separador (`descripcion_tp`, `nombre_hpb`, `fecha_inicio_pa`, `fecha_planificada_tarea`).

Cualquier discrepancia visual con el DC (como atributos que figuraban en CamelCase o con mayúsculas al final, ej. `ciclo_productivoCB`, `nombreHPB`, `fecha_inicioPA`) queda unificada desde el inicio bajo este estándar en minúscula estricto para evitar inconsistencias entre frontend y backend.