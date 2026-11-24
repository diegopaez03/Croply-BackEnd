# Contrato de API — Tablero Global del Admin Croply

> Este contrato no repite las convenciones transversales ya definidas (ERR-01 a ERR-19, y la convención de `message` en éxitos). Solo se detallan acá el endpoint, la respuesta y las definiciones de cada métrica.
>

---

## Decisiones tomadas en esta 1° versión

**1. Módulo propio, solo lectura.** El endpoint vive en `src/modules/tablero-global/` (no en el placeholder `reportes` ni en `FincasService`). No escribe nada ni registra log de operaciones.

**2. Respuesta anidada, la misma que ya consume el frontend.** No se devuelven `clientes.crecimiento_porcentaje` ni `sensores.estado` (en el frontend quedan como opcionales).

**3. `sensores.activos` y `sensores.total_activos` son el mismo valor.** Se mantienen los dos campos porque la card superior y el gráfico circular los leen por separado.

**4. Estado del sensor = `sensores.estado_senal`.** `Transmitiendo` cuenta como activo y `Sin_senal` como inactivo. No se usa `ControladorSensor.estado_controlador`.

**5. Zona horaria `America/Argentina/Buenos_Aires`** para "mes actual" (clientes nuevos) y para agrupar la evolución de fincas.

**6. La evolución de fincas es historial de altas.** Incluye fincas que hoy están dadas de baja.

---

## Tablero global

- **Autenticación:** Requerida (Rol: Admin Croply). Guard: `JwtAuthGuard, AdminCroplyGuard`.
- **Swagger:** tag `Reportes`, schema `TableroGlobalResponseDto`.

`GET /api/v1/admin/tablero-global`

```json
{
  "clientes": { "total": 128, "nuevos_este_mes": 7 },
  "sensores": {
    "activos": 23030,
    "porcentaje_parque_total": 92.4,
    "total_activos": 23030,
    "total_inactivos": 1894
  },
  "hectareas": { "total": 15420.5, "provincias": 9 },
  "evolucion_fincas": [
    { "mes": "2026-05", "nuevas_fincas": 4 },
    { "mes": "2026-06", "nuevas_fincas": 0 },
    { "mes": "2026-07", "nuevas_fincas": 2 },
    { "mes": "2026-08", "nuevas_fincas": 1 },
    { "mes": "2026-09", "nuevas_fincas": 3 },
    { "mes": "2026-10", "nuevas_fincas": 0 }
  ]
}
```

### Definición de cada métrica

| Campo | Definición |
| --- | --- |
| `clientes.total` | `COUNT(DISTINCT usuario)` de usuarios con un `UsuarioFinca` vigente (`fecha_fin_rol IS NULL`) con rol `ADMIN_FINCA` (`CODIGO_ADMIN_FINCA`), sobre una finca activa (`fecha_baja_finca IS NULL`) y con el usuario no dado de baja (`usuario.fecha_baja IS NULL`). |
| `clientes.nuevos_este_mes` | De esos clientes, los que tienen `MIN(fecha_asociacion_rol)` (primer vínculo `ADMIN_FINCA`) dentro del mes calendario actual, en zona de Buenos Aires. |
| `sensores.total_activos` / `sensores.activos` | Sensores vivos con `estado_senal = Transmitiendo`. |
| `sensores.total_inactivos` | Sensores vivos con `estado_senal = Sin_senal`. |
| `sensores.porcentaje_parque_total` | `total_activos / (total_activos + total_inactivos) * 100`, redondeado a 1 decimal. Si no hay sensores vivos, `0`. |
| `hectareas.total` | `COALESCE(SUM(superficie_finca), 0)` de fincas activas. |
| `hectareas.provincias` | `COUNT(DISTINCT LOWER(TRIM(provincia)))` de fincas activas, ignorando provincia `NULL` o vacía. |
| `evolucion_fincas` | Altas de `Finca` por `fecha_alta_finca`, agrupadas por mes (`YYYY-MM`), últimos 6 meses incluyendo el actual, orden ascendente. Los meses sin altas aparecen con `nuevas_fincas: 0` (siempre hay 6 elementos). |

> **Sensor vivo** = mismo criterio que `GET /fincas/stats`: `sensor.fecha_baja`, `controlador.fecha_baja`, `parcela.fecha_baja_parcela` y `finca.fecha_baja_finca` en `NULL`.
>
> El frontend muestra `mes` en el eje X como abreviatura en mayúsculas (`2026-05` → `MAY`) y en el tooltip con mes y año (`Mayo 2026`), porque la ventana de 6 meses puede cruzar de año.

### Errores

| Caso | Código |
| --- | --- |
| Sin token, token inválido o expirado | `401 UNAUTHORIZED` (ERR transversal) |
| Usuario autenticado sin rol de sistema (no Admin Croply) | `403 FORBIDDEN` |
