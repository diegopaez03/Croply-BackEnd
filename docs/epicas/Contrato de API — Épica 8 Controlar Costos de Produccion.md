# Contrato de API — Épica 8: Controlar Costos de Producción

Propietario: Paula Rodriguez

> Este contrato no repite las convenciones transversales ya definidas (ERR-01 a ERR-17, y la convención de `message` en éxitos). Solo se detallan acá endpoints, requests, responses y errores específicos de esta épica.
> 

---

## Decisiones tomadas en esta 1° versión

**1. Alcance por finca única, no multi-finca.** El texto original de HU-GC-03 ("Filtrar historial de gastos por finca", con la opción "Todas") queda sin efecto tal como está escrito. Todos los endpoints van explícitos bajo `/fincas/:id_finca/gastos`, mismo criterio que Agroquímicos — la finca la determina la pantalla (el mismo selector/mecanismo que ya usa Agroquímicos), no un filtro "Todas las fincas" dentro de la tabla ni del modal de exportar. Si el equipo arma el selector de finca compartido pendiente de Agroquímicos, esta pantalla lo va a usar igual que esa.

**2. Permisos separados por función: `Costos` para el ABM y el listado, `Reportes` para exportar.** Se agrega un permiso de finca nuevo, `Costos`, para HU-GC-01 a HU-GC-06 (crear, editar, dar de baja, listar, filtrar, el total del período y el gráfico de evolución). El permiso `Reportes` (ya existente en el catálogo) queda reservado específicamente para HU-GC-07 — exportar/descargar el PDF — y no se usa en ningún otro endpoint de esta épica. Esto deja un pendiente aparte, fuera del alcance de este contrato: Agroquímicos hoy exporta su propio PDF (HU-AQ-07) bajo el mismo permiso único que el resto de esa épica (`Registro de agroquímicos`), sin un permiso de `Reportes` separado para el export — si el equipo quiere el mismo criterio ahí, es un ajuste a futuro sobre el contrato de Épica 6, no algo a resolver acá.

**3. Baja lógica, no física.** El texto de HU-GC-01 dice "elimine el registro de forma definitiva", pero el DC ya modela `fecha_baja_gp` — se usa baja lógica (igual criterio que el resto del proyecto): la fila desaparece del listado y de los totales, pero el registro se conserva con su fecha de baja.

**4. Responsable vía `UsuarioFinca`, "quién registró" vía `LogOperaciones`.** Mismo patrón exacto que Agroquímicos: la única relación de `GastoProduccion` con una persona es el Responsable (`UsuarioFinca`, obligatorio, elegido en el modal). "Usuario que registró la operación" no es una columna propia — se resuelve por el log de auditoría transversal, sin agregar ningún campo nuevo a `GastoProduccion`.

**5. La Finca de un gasto no se puede reasignar al editar.** El texto original de HU-GC-01 listaba la Finca como editable, pero el equipo decidió no permitirlo por la complejidad que agrega (validar membresía en la finca nueva, resetear el responsable, etc.). Queda igual que Agroquímicos: la Finca es de solo lectura al editar, no viaja en el body de edición. El `id_responsable` elegido tiene que pertenecer siempre a la misma finca del gasto, sin ningún caso de reasignación que contemplar.

**6. Responsable inactivo: se sigue mostrando en el listado, pero no aparece en el desplegable de edición.** El nombre del responsable queda "congelado" en cada gasto ya creado (viaja como `nombre_responsable` en la respuesta, no se recalcula), pero si ese `UsuarioFinca` ya no está vigente, no es una opción elegible al editar un gasto (ni ese ni ningún otro).

**7. El orden es por `fecha_gp`, no por orden de creación.** El texto de HU-GC-01 dice que el gasto nuevo "aparece en la primera posición" al guardarlo — eso es cierto únicamente si su `fecha_gp` es la más reciente del listado. El orden real es siempre por `fecha_gp` descendente (desempatando por `fecha_alta_gp` descendente si dos gastos comparten la misma fecha), nunca por cuándo se cargó.

**8. No se agrega el estado "Cancelada" — ni existe ningún estado en `GastoProduccion`.** A diferencia de `Tarea`, un gasto no tiene una máquina de estados — solo existe o fue dado de baja (`fecha_baja_gp`), sin nada intermedio.

**9. El gráfico de evolución mensual no vive en el mismo endpoint que el listado paginado.** Tienen necesidades distintas: el listado pagina de a 10 y se filtra por rango de fechas para la tabla; el gráfico necesita agregados por mes, sin paginar, y con una ventana de meses que no siempre coincide con el filtro de la tabla (ver punto 11). Van en un endpoint aparte.

**10. No existe ningún "Total" de cabecera junto a la tabla — solo la card "Total gastado este mes / en el período".** El texto original de HU-GC-02 mencionaba un campo "Total" separado, junto al título y el botón "Agregar gasto" — el equipo decidió no construirlo, la card de HU-GC-05 ya cubre esa necesidad. La respuesta del listado solo trae `monto_total_periodo` (y su `etiqueta_periodo`): si no hay ningún filtro de fecha activo, es el total del **mes calendario en curso**; si hay un rango de fechas filtrado, es el total de ese rango y el título de la card cambia a "Total gastado en el período".

**11. El endpoint del gráfico no tiene un "default" de 6 meses del lado del backend — el default lo decide quién lo llama.** El endpoint simplemente agrega por mes lo que caiga en el rango de fechas que se le pida; si no se le manda ningún rango, agrega **todo** el historial sin límite. La pantalla de Costos (HU-GC-06) es la que decide llamarlo pidiendo explícitamente "los últimos 6 meses" (calculando esas dos fechas del lado del cliente) como su comportamiento por defecto — el resaltado de qué barras corresponden al rango filtrado en pantalla se calcula del lado del cliente, comparando contra ese mismo rango, sin necesidad de que el backend marque nada especial.

**12. El gráfico del PDF exportado es una imagen que manda el frontend, no uno que redibuja el backend.** Como el objetivo es que el PDF muestre "los gráficos que se ven en pantalla" (no una versión recalculada con otra lógica de dibujo), el modal de exportar arma su **propio** gráfico (mismo componente, mismos colores, pero alimentado con los datos del rango elegido en el modal — no una captura de la pantalla de atrás, que puede tener un rango distinto), lo convierte a imagen del lado del cliente, y la manda en el cuerpo del request. Por eso el endpoint de exportar es `POST`, no `GET` — es el único `POST` de exportación de todo el proyecto hasta ahora, y es a propósito.

**13. El export, al no tener nunca "Todas las fincas" (por la decisión #1), siempre muestra el nombre de una finca puntual en el PDF** — la condicionalidad "si corresponde" que menciona el texto original de HU-GC-07 no aplica acá, siempre corresponde.

**14. Reglas de los campos, del lado del cliente (no ameritan un `errorCode` propio, son validación estándar de formulario):** `monto_gp` mayor a 0, hasta 2 decimales, sin tope máximo. `fecha_gp` no puede ser una fecha futura (con `max` dinámico en el selector, mismo criterio que ya se usa en otros lados del proyecto para evitar que el estado inválido llegue a existir). `nombre_insumo_gp` hasta 150 caracteres.

**15. Librería de gráficos: no hay ninguna instalada todavía en el frontend.** Hace falta sumar `recharts` (la que shadcn/ui integra oficialmente con su propio componente wrapper) — el design system ya tiene los tokens `chart-1` a `chart-5` preparados para esto, no hay que definir paleta nueva.

---

## Errores nuevos que se agregan en esta Épica

Reutilizar siempre que aplique: `REQUIRED_FIELD` (ERR-01), `RESOURCE_NOT_FOUND` (ERR-05), `FINCA_NOT_AVAILABLE` (ERR-10).

**ERR-18 — Rango de fechas inválido**

```json
{
  "statusCode": 400,
  "errorCode": "INVALID_DATE_RANGE",
  "message": "La fecha de fin debe ser igual o posterior a la fecha de inicio."
}
```

**ERR-19 — Sin datos para exportar**

```json
{
  "statusCode": 400,
  "errorCode": "EMPTY_EXPORT_RESULT",
  "message": "No hay gastos para exportar con los filtros seleccionados. Ajustá la configuración del reporte."
}
```

---

## HU-GC-01. ABM gasto de producción

- **Autenticación:** Requerida (Rol: Administrador de Finca o usuario con permiso `Costos`). Guard: `JwtAuthGuard, AdminFincaGuard, PermisoGuard` + `@RequirePermiso(PERMISO_FINCA.COSTOS)` — (ver Decisión #2).

> `GastoProduccion` (DC + extensión): `id_gasto_produccion`, `nombre_insumo_gp`, `monto_gp`, `fecha_gp`, `fecha_alta_gp`, `fecha_baja_gp` (DC), más `fecha_modificacion_gp` (extensión, igual mecanismo ya usado varias veces en épicas anteriores). Relación con `Finca` (obligatoria, editable) y con `UsuarioFinca` como Responsable (obligatoria).
> 

### Crear gasto

`POST /api/v1/fincas/:id_finca/gastos`

```json
{
  "nombre_insumo_gp": "Fertilizante NPK",
  "monto_gp": 45000.50,
  "id_responsable": 34,
  "fecha_gp": "2026-09-20"
}
```

`201 Created`:

```json
{
  "message": "Gasto registrado correctamente",
  "id_gasto_produccion": 88,
  "nombre_insumo_gp": "Fertilizante NPK",
  "monto_gp": 45000.50,
  "fecha_gp": "2026-09-20",
  "id_finca": 12,
  "nombre_finca": "Finca La Esperanza",
  "id_responsable": 34,
  "nombre_responsable": "Roberto Sánchez",
  "fecha_alta_gp": "2026-09-22T09:03:10Z"
}
```

### Editar gasto

`PUT /api/v1/fincas/:id_finca/gastos/:id_gasto_produccion`

```json
{
  "nombre_insumo_gp": "Fertilizante NPK Plus",
  "monto_gp": 47000,
  "id_responsable": 34,
  "fecha_gp": "2026-09-21"
}
```

> `id_finca` no se manda — de solo lectura, no se puede reasignar (ver Decisión #5). El `id_responsable` tiene que pertenecer a la misma finca del gasto.
> 

`200 OK` con `message: "Gasto actualizado correctamente"`, el detalle completo actualizado y `fecha_modificacion_gp` seteada.

### Dar de baja gasto

`DELETE /api/v1/fincas/:id_finca/gastos/:id_gasto_produccion` — baja lógica.

`200 OK` con `message: "Gasto eliminado correctamente"`.

### Errores

- `RESOURCE_NOT_FOUND` → ERR-05, si el gasto, la finca o el responsable no existen.

---

## HU-GC-02, HU-GC-03 y HU-GC-04. Listar y filtrar gastos

- **Autenticación:** igual que HU-GC-01.
- Un único endpoint para las tres — HU-GC-03 queda resuelta por la Decisión #1 (no hay filtro "Todas las fincas" dentro de esta pantalla, la finca la da la URL).

`GET /api/v1/fincas/:id_finca/gastos?page=1&pageSize=10&fecha_desde=2026-09-01&fecha_hasta=2026-09-30`

```json
{
  "gastos": [
    {
      "id_gasto_produccion": 88,
      "nombre_insumo_gp": "Fertilizante NPK",
      "monto_gp": 45000.50,
      "fecha_gp": "2026-09-20",
      "id_responsable": 34,
      "nombre_responsable": "Roberto Sánchez"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10,
  "monto_total": 45000.50,
  "monto_total_periodo": 45000.50,
  "etiqueta_periodo": "mes_actual"
}
```

> Paginado de a 10, orden por `fecha_gp` descendente (ver Decisión #7). `fecha_desde`/`fecha_hasta` opcionales y combinables, inclusive en ambos extremos.
> 
> 
> `monto_total`: suma de `monto_gp` de todo lo que matchea los filtros actuales (todo el historial si no hay filtro de fecha).
> 
> `monto_total_periodo` / `etiqueta_periodo`: el valor de la card de HU-GC-05 — ver Decisión #10. Si no se mandó `fecha_desde`/`fecha_hasta`, el backend calcula la suma del mes calendario en curso y devuelve `etiqueta_periodo: "mes_actual"` (el frontend muestra "Total gastado este mes"). Si se mandó un rango, la suma es la de ese rango y `etiqueta_periodo: "rango_filtrado"` (el frontend muestra "Total gastado en el período").
> 
> Sin gastos en la finca (sin filtro) → `gastos: []`, mensaje "Aún no hay gastos registrados. Hacé clic en 'Agregar gasto' para comenzar.", `monto_total` y `monto_total_periodo` en `0`. Sin resultados por el filtro de fecha → `gastos: []`, mensaje "No hay gastos registrados en el período seleccionado.", mismos totales en `0`.
> 

### Errores

- `INVALID_DATE_RANGE` → **ERR-18**, si `fecha_hasta` es anterior a `fecha_desde`.

---

## HU-GC-05. Visualizar total gastado en el mes en el dashboard

Cubierta enteramente por el shape de arriba (`monto_total_periodo`/`etiqueta_periodo`) — no es un endpoint aparte, es parte de la misma respuesta de HU-GC-02/03/04.

---

## HU-GC-06. Visualizar gráfico de evolución de gastos por mes

- **Autenticación:** igual que HU-GC-01.

`GET /api/v1/fincas/:id_finca/gastos/evolucion-mensual?fecha_desde=2026-04-01&fecha_hasta=2026-09-30`

```json
{
  "meses": [
    { "mes": "2026-04", "monto": 12000.00 },
    { "mes": "2026-05", "monto": 8500.00 },
    { "mes": "2026-06", "monto": 0 },
    { "mes": "2026-07", "monto": 15200.00 },
    { "mes": "2026-08", "monto": 9800.50 },
    { "mes": "2026-09", "monto": 45000.50 }
  ]
}
```

> `fecha_desde`/`fecha_hasta` opcionales — ver Decisión #11: sin ellos, el backend agrega **todo** el historial sin límite (no hay ningún default de "6 meses" acá). La pantalla de Costos siempre llama a este endpoint pidiendo explícitamente los últimos 6 meses (calculados del lado del cliente) para su vista por defecto; el modal de exportar lo llama con el rango que el usuario haya elegido ahí, o sin rango (todo el historial) si no eligió ninguno.
> 
> 
> Los meses sin ningún gasto dentro del rango pedido igual aparecen, con `monto: 0` — nunca se saltean (Decisión ya confirmada).
> 
> El resaltado de qué barras corresponden al rango filtrado en la pantalla principal (cuando el usuario tiene HU-GC-04 activo) se resuelve 100% del lado del cliente, comparando el mes de cada barra contra ese rango — no hace falta ningún campo adicional en esta respuesta para eso.
> 
> Sin ningún gasto en toda la finca → `meses: []`, el frontend muestra "No hay datos suficientes para mostrar la evolución de gastos."
> 

---

## HU-GC-07. Exportar reporte de costos de producción a PDF

- **Autenticación:** Requerida (Rol: Administrador de Finca o usuario con permiso `Reportes`). Guard: `JwtAuthGuard, AdminFincaGuard, PermisoGuard` + `@RequirePermiso(PERMISO_FINCA.REPORTES)` — distinto al resto de la épica (ver Decisión #2), este endpoint puntual no usa `Costos`.

`POST /api/v1/fincas/:id_finca/gastos/exportar`

```json
{
  "fecha_desde": "2026-04-01",
  "fecha_hasta": "2026-09-30",
  "imagen_grafico": "data:image/png;base64,iVBORw0KGgoAAAANSU..."
}
```

> `fecha_desde`/`fecha_hasta`: opcionales, igual criterio que el resto de la épica. `imagen_grafico`: obligatoria — el PNG (como data URI) del gráfico de evolución que el modal ya armó y mostró en su Vista Previa, con el mismo rango que se está exportando (ver Decisión #12). El backend no dibuja ningún gráfico, solo inserta esta imagen en el PDF tal cual llega.
> 

`200 OK`, `Content-Type: application/pdf`, binario. Nombre de archivo (`Content-Disposition`): `costos_[nombre-finca]_[fecha-generacion].pdf` — siempre lleva el nombre de una finca puntual (Decisión #13, nunca "todas").

> Encabezado del PDF: "Croply", identificador único de reporte, fecha y hora de generación, título "Historial de Costos", rango de fechas (o "Todo el historial" si no se filtró) y nombre de la finca. Tabla: Fecha, Insumo, Precio, Responsable, ordenada por fecha descendente — mismos gastos que devuelve HU-GC-02/03/04 con ese mismo rango, sin paginar (todos, no solo los primeros 10). Card con el total del período. La imagen del gráfico, tal como llegó en el request.
> 
> 
> La "Vista Previa" del modal (HTML/CSS armando el boceto, más el gráfico real ya renderizado con el rango elegido) es 100% frontend — no pega contra este endpoint hasta que se confirma "Descargar PDF".
> 

### Errores

- `INVALID_DATE_RANGE` → **ERR-18**.
- `EMPTY_EXPORT_RESULT` → **ERR-19**, si los filtros no arrojan ningún gasto — no se genera el archivo.

---

## Convención de naming

Snake_case minúscula estricta, sin casing crudo del DC. El campo nuevo que no está en el DC (`fecha_modificacion_gp`) se documenta acá como extensión, mismo mecanismo ya usado en épicas anteriores.