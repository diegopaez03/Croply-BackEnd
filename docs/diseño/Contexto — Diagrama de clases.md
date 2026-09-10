# Contexto — Diagrama de Clases (Croply)

> Documento de acompañamiento del diagrama UML de clases del dominio Croply.  
> Imagen de referencia: [`Diagrama UML - Diagrama de clases.jpg`](./Diagrama%20UML%20-%20Diagrama%20de%20clases.jpg)  
> Ubicación: `docs/diseño/`

Este archivo traduce el diagrama a lenguaje útil para backend, frontend y QA: qué modela cada clase, cómo se relacionan, qué enums existen y **qué decisiones de implementación** tomó el backend respecto del UML (Épicas 1, 2 y 4).

---

## 1. Propósito del diagrama

El diagrama de clases es el **modelo de dominio conceptual** del sistema Croply: usuarios y roles, fincas y parcelas, cultivos, tareas de campo, clima, IoT, notificaciones, auditoría, etc.

No es un dump 1:1 de tablas TypeORM. En backend:

- Se implementan las entidades **necesarias por épica**.
- El contrato de API usa identificadores JSON en `snake_case` minúsculas (`id_usuario`, `id_rol`, …).
- Campos o relaciones que el UML no detalla pero una HU exige (ej. token de invitación, `debe_cambiar_contrasena`) se documentan como **extensiones al modelo**.

---

## 2. Vista general del dominio

Bloques principales visibles en el diagrama:

| Bloque | Clases clave | Notas |
| --- | --- | --- |
| Acceso / identidad | `Usuario`, `Rol`, `RolSistema`, `RolFinca`, `UsuarioFinca`, `ResetsContrasena`, `InvitacionFinca`, `Permiso`, `RolPermiso` | Épicas 1 y 2 |
| Onboarding | `SolicitudDigitalizacionFinca` | HU-AC-07 / HU-GU-13 |
| Finca / terreno | `Finca`, parcelas, ubicaciones | Stub `Finca` + roles/invitaciones Épica 2 |
| Producción | `CultivoBase`, `Variedad`, `PlantillaBase`, `PlantillaCultivoVariedad`, `HitoPlantilla`, `TareaPlantilla` | Épica 4 (HU-BC-01 a 05). `TipoTarea`/`Tarea` mock hasta Épica 5 |
| Operación de campo | Tareas reales, notas, planes de acción | HU-BC-06 diferida (Épicas 3 y 5) |
| Clima / IoT | Condiciones, transmisiones, sensores | Fuera de este backend o épicas posteriores |
| Transversal | `LogOperaciones`, `Notificacion` | `LogOperaciones` en Épica 2; notificaciones pendientes |

---

## 3. Modelo de acceso (detalle Épica 1)

### 3.1 `Usuario`

| Atributo UML | Tipo (diagrama) | Notas de implementación |
| --- | --- | --- |
| `id_usuario` | Long | PK `bigint`; JSON: `id_usuario` |
| `email` | String | Único, normalizado a minúsculas |
| `contrasena` | String | Hash bcrypt (nunca plain text) |
| `estado` | EstadoUsuario | Ver §5 — API usa `Activo` / `Inactivo` / `Pendiente` |
| `nombre`, `apellido` | String | |
| `telefono` | String | Nullable |
| `fecha_alta`, `fecha_baja` | Date | Soft-delete vía `fecha_baja` |

**Extensión (no está en el diagrama, exigida por contrato HU-AC-01 / HU-AC-06):**

| Campo | Tipo | Uso |
| --- | --- | --- |
| `debe_cambiar_contrasena` | boolean | `true` tras registro con contraseña temporal; dispara flujo de primer acceso |
| `token_version` | int | Invalidación de JWT al inactivar cuenta (HU-GU-06) |

### 3.2 Roles (herencia)

```
Rol <<abstract>>
├── RolSistema   (codigo, ej. ADMIN_CROPLY)
└── RolFinca     (codigo_rol_finca, ej. ADMIN_FINCA)
```

| UML | Backend TypeORM |
| --- | --- |
| Herencia JPA-style | STI: tabla `roles` + discriminator `tipo` (`sistema` \| `finca`) |
| `Usuario` → `RolSistema` multiplicidad **1** | Relación **opcional** (`null` si el usuario solo opera en fincas) — alineado al contrato (`rol_sistema: null`) |
| `Rol.descripcion` | Text nullable (Épica 2) |
| `RolFinca.id_finca` | Nullable: `null` = plantilla seed (`ADMIN_FINCA`); no null = rol custom de esa finca |

### 3.3 `UsuarioFinca`

Asociación Usuario ↔ Finca con rol de finca.

| Atributo | Uso |
| --- | --- |
| `fecha_asociacion_rol` | Alta del vínculo |
| `fecha_fin_rol` | Si no es null y ya pasó, el vínculo no se incluye en el login |

El login arma el array `fincas[]` con `{ id_finca, nombre_finca, rol_finca }` a partir de `UsuarioFinca` vigentes.

### 3.4 `ResetsContrasena`

Única entidad de “token” en el UML para recuperación de clave.

| Atributo | Uso |
| --- | --- |
| `token_hash` | Hash del token enviado por mail (no guardar plain) |
| `fecha_fin_vigencia` | Expiración |
| `fecha_uso` | Si no es null → token ya usado |
| `fecha_alta` | Alta del reset |

**No hay** clase `Sesion` / `JwtToken` en el diagrama: el access token JWT es infraestructura, no dominio persistido.

### 3.5 `InvitacionFinca`

| Atributo UML | Uso |
| --- | --- |
| `id_invitacion_finca` | PK; en API: `id_invitacion_finca` |
| `email_invitado` | Precarga del formulario de registro |
| `fecha_envio`, `fecha_respuesta` | Ciclo de vida |
| `estado` | EstadoInvitacion |

Relaciones: composición desde `Finca`; `invitadoPor` (Usuario); `usuarioRegistrado` (0..1); `RolFinca` ofrecido.

**Extensiones (exigidas por HU-AC-03, ausentes en UML):**

| Campo | Uso |
| --- | --- |
| `token_hash` | Validar `GET /auth/validar-invitacion/:token` |
| `fecha_fin_vigencia` | Distinguir `INVITATION_EXPIRED` |
| `fecha_cancelacion` | Cancelación al inactivar usuario Pendiente (HU-GU-06) |

### 3.6 `SolicitudDigitalizacionFinca`

Campos del formulario de landing (nombre, correo, teléfono, ubicación, parcelas, superficie, comentario opcional, estado, fecha).

| UML | Backend |
| --- | --- |
| Relación a `Usuario` multiplicidad 1 | **`id_usuario` opcional** — el endpoint es público; si hay JWT se asocia, si no queda null |
| `id_solicitudDF` | En API: `id_solicitud_df` |

### 3.7 `Finca` (mínimo para login)

| UML | Backend Épica 1 |
| --- | --- |
| `id_finca: String` | **`bigint` numérico** (contrato muestra `12`) |
| Resto de atributos | Stub mínimo (`nombre_finca`, ubicación, superficie, fechas) |
| Nota “agregar longit y latitud” | Pendiente de épicas de finca |

---

## 4. Relaciones relevantes (multiplicidades)

| Relación | Multiplicidad (UML) | Comentario implementación |
| --- | --- | --- |
| Usuario — RolSistema | 1 — 0..\* | Relajado a 0..1 en Usuario |
| Usuario — UsuarioFinca | 1 — 0..\* | |
| Finca — UsuarioFinca | 1 — 0..\* | |
| RolFinca — UsuarioFinca | 1 — 0..\* | |
| Usuario — ResetsContrasena | 1 — 0..\* | |
| Finca ◆— InvitacionFinca | 1 — 0..\* | Composición |
| InvitacionFinca — RolFinca | * — 1 | Rol ofrecido |
| InvitacionFinca — Usuario (registrado) | * — 0..1 | |
| Rol — RolPermiso — Permiso | N:M | Implementado en Épica 2 |
| Usuario — LogOperaciones | 1 — 0..\* | Implementado en Épica 2 (side-effect) |
| Usuario — Notificacion | 1 — 0..\* | **No implementado** |
| CultivoBase ◆— Variedad | 1 — 0..\* | Épica 4; baja lógica |
| PlantillaBase — PlantillaCultivoVariedad — CultivoBase / Variedad | 1 — 0..\* | Variedad opcional (null = general) |
| PlantillaBase ◆— HitoPlantilla ◆— TareaPlantilla | 1 — 1..\* | ERR-06 si no hay tareas |

---

## 5. Enums (auth / acceso)

### En el diagrama

| Enum | Valores UML |
| --- | --- |
| `EstadoUsuario` | `Pendiente`, `Activa`, `Inactiva` |
| `EstadoInvitacion` | `Pendiente`, `Aceptada`, `Rechazada` (+ API: `Cancelada`) |
| `EstadoSolicitud` | `Pendiente`, `Contactado`, `Aprobada`, `Rechazada` |
| `TipoOperacion` | `Éxito`, `Fallo`, `Operacion_destructiva` |
| `TipoNotificacion` | varios (alerta climática, IA, etc.) |

### En la API / backend (contrato manda)

| Enum | Valores API |
| --- | --- |
| `EstadoUsuario` | `Pendiente`, **`Activo`**, **`Inactivo`** (masculino, como el contrato) |
| `EstadoInvitacion` | UML + `Cancelada` |
| `EstadoSolicitud` | igual al UML |

### Épica 4 (producción)

| Enum | Valores API |
| --- | --- |
| `EpocaCultivo` | `Todo_el_anio`, `Primavera_verano`, `Otonio_invierno` |
| `FormaSiembra` | `Directa`, `Almacigo` |

Códigos de rol usados hoy:

- Sistema: `ADMIN_CROPLY`
- Finca: `ADMIN_FINCA`

---

## 6. Decisiones de alineación UML ↔ contrato ↔ código

Acordadas al implementar Épicas 1 y 2:

1. **Naming JSON** en minúsculas (`id_usuario`, `id_finca`, `id_solicitud_df`) + `Activo`/`Inactivo`.
2. **`debe_cambiar_contrasena`** y **`token_version`** en `Usuario`.
3. **`token_hash` + vigencia + `fecha_cancelacion`** en `InvitacionFinca`.
4. **`RolSistema` opcional** en Usuario.
5. **`id_usuario` opcional** en solicitud de digitalización.
6. **`id_finca` numérico**; **`RolFinca.id_finca` nullable** (plantilla vs custom).
7. **Épica 2:** `Permiso`, `RolPermiso`, `LogOperaciones` + seed de catálogo (7 sistema / 3 finca).
8. **Mail según entorno** — `MailerService`: log en consola fuera de production; Resend en production.
9. **AuthZ HTTP por rol** (Admin Croply / Admin Finca); permisos como dato de ABM, no middleware granular.
10. **Épica 4:** `CultivoBase`, `Variedad`, `PlantillaBase`, `PlantillaCultivoVariedad`, `HitoPlantilla`, `TareaPlantilla`. Extensiones al UML: `forma_siembra` (enum) en cultivo base; `observaciones` (string nullable) en variedad; `imagen_url` (varchar 500 nullable) en cultivo base y variedad.
11. **`TipoTarea` mock** — catálogo constante `TIPO_TAREA_CATALOG` (`src/modules/cultivos/tipo-tarea.catalog.ts`). El id `5` es “Aplicación de agroquímico” (valida `nombre_producto` y `dosis_aa`). Se reemplaza por entidad + ABM en Épica 5.
12. **`en_uso`** de cultivo/variedad se calcula por filas activas de `PlantillaCultivoVariedad`. Cuando exista `Parcela` (Épica 3) hay que sumar asociaciones activas de parcela.
13. **HU-BC-06 diferida** — no hay `PlanAccion` / `Tarea` real / ERR-08 (`TASK_NOT_EDITABLE`) hasta Épicas 3 y 5.

### Regla de login vs estados (aclaración al contrato)

El contrato dice 403 si el estado es `Inactivo` o `Pendiente`, pero HU-AC-06 requiere JWT tras login con contraseña temporal (usuario típicamente `Pendiente` + `debe_cambiar_contrasena: true`).

**Comportamiento implementado:**

- `Inactivo` → siempre `ACCOUNT_NOT_ACTIVE` (403)
- `Pendiente` **sin** `debe_cambiar_contrasena` → 403
- `Pendiente` **con** `debe_cambiar_contrasena: true` → login OK (flujo primer acceso)
- `Activo` → login OK

Ver nota actualizada en el contrato de Épica 1.

---

## 7. Mapeo a módulos NestJS

| Concepto UML | Módulo / ubicación |
| --- | --- |
| Usuario | `src/modules/usuarios` |
| Rol / RolSistema / RolFinca / Permiso / RolPermiso | `src/modules/roles` |
| Finca, UsuarioFinca, InvitacionFinca | `src/modules/fincas` |
| ResetsContrasena + endpoints auth | `src/modules/auth` |
| SolicitudDigitalizacionFinca | `src/modules/solicitudes-digitalizacion` |
| LogOperaciones | `src/modules/log-operaciones` |
| Seed admins / permisos / biblioteca demo | `src/database/seed` + `RolesService` / `CultivosBaseService` |
| CultivoBase, Variedad | `src/modules/cultivos` (`CultivosBaseService`) |
| Subida de imágenes | `src/modules/uploads` + `src/common/cloudinary` |
| PlantillaBase, PCV, HitoPlantilla, TareaPlantilla | `src/modules/cultivos` (`PlantillasBaseService`) |

---

## 8. Modelo de producción (Épica 4)

Biblioteca agronómica global (no scoped a finca). Mutaciones: Admin Croply. Lecturas: Admin Croply **o** Admin de Finca vigente (`AdminCroplyOAdminFincaGuard`).

### 8.1 `CultivoBase`

| Atributo | Notas |
| --- | --- |
| `id_cultivo_base` | PK bigint |
| `nombre_cultivo_base` | Único entre activos (trim) |
| `descripcion_cb`, `epoca_cultivo`, `mes_siembra`, `ciclo_productivo_cb` | Ficha técnica |
| `forma_siembra` | **Extensión al UML** — enum `FormaSiembra` |
| `imagen_url` | **Extensión al UML** — URL de Cloudinary, nullable |
| `fecha_alta_cb` / `fecha_baja_cb` | Alta automática; baja lógica |

`ciclo_productivo_cb` es manual al crear. Al agregar/editar/eliminar variedades se recalcula como rango de `dias_a_cosecha` (`"75 días"` o `"68-75 días"`). Si ya hay variedades, el PUT de ficha ignora el ciclo del body.

### 8.2 `Variedad`

Composición desde `CultivoBase`. Nombre único **dentro del mismo cultivo** activo. `observaciones` e `imagen_url` son **extensiones al UML** (string nullable). `fecha_alta` en JSON: `YYYY-MM-DD`.

### 8.3 `PlantillaBase` y `PlantillaCultivoVariedad`

- `id_variedad` null = plantilla **general** del cultivo (a lo sumo una activa por cultivo).
- `id_variedad` seteado = plantilla **específica**. Una variedad no puede estar en dos plantillas específicas activas (ERR-07 `VARIETY_ALREADY_ASSIGNED`).
- Baja lógica siempre permitida (no aplica ERR-04). Editar no afecta planes reales (aún no existen).

Prioridad al consultar (HU-BC-03): específica de la variedad, si no la general del cultivo. Campos `id_plantilla_general` / `id_plantilla_especifica` son **calculados**, no columnas.

### 8.4 Hitos y tareas de plantilla

`HitoPlantilla` (`nombre_hpb`, `orden_hpb`) → `TareaPlantilla` (`dia_relativo_tp`, `id_tipo_tarea`, `descripcion_tp`, `nombre_producto`, `dosis_aa`). Guardar sin ningún hito con tareas → ERR-06 `EMPTY_SCHEDULE`.

`nombre_producto` / `dosis_aa` se persisten en `TareaPlantilla` hasta que Épica 5 modele `AplicacionAgroquimico`.

### 8.5 Catálogo mock `TipoTarea` (deuda Épica 5)

| `id_tipo_tarea` | `nombre_tipo_tarea` |
| --- | --- |
| 1 | Preparación del terreno |
| 2 | Siembra |
| 3 | Riego |
| 4 | Fertilización |
| 5 | Aplicación de agroquímico |
| 6 | Control de malezas |
| 7 | Cosecha |

No hay endpoint de catálogo: el frontend puede hardcodear estos IDs hasta el ABM de Épica 5.

### 8.6 HU-BC-06 diferida (Épicas 3 y 5)

No implementar hasta existir `Parcela` / `PlanAccion` (Épica 3) y `TipoTarea` / `Tarea` reales (Épica 5):

- Generar un plan de acción a partir de plantilla sobre una parcela
- Editar/eliminar tareas de un plan real
- ERR-08 `TASK_NOT_EDITABLE` (409) si la tarea no está `Pendiente`
- `en_uso` por asociación activa de parcela

Los cambios de plantilla **no** deben retroactivarse a planes ya copiados (regla a respetar cuando se implemente).

---

## 9. Fuera del diagrama / fuera de alcance actual (recordatorio)

No confundir “está en el diagrama” con “está implementado”:

- CRUD de fincas, parcelas, reportes
- HU-BC-06 y entidad `Tarea` / ABM `TipoTarea`
- RBAC middleware por permiso individual
- Notificaciones
- Refresh token persistido (vars en `.env` existen; contrato no lo exige)
- e2e Nest armado, CI/Railway (el envío de mail real ya está: Resend en production)

Detalle operativo: [`CONTEXT.md`](../../CONTEXT.md) y contratos en [`docs/epicas/`](../epicas/).

---

## 10. Cómo usar este documento

- Al **agregar una entidad** de una épica nueva: localizarla acá o en la imagen, decidir extensiones, actualizar esta sección y el contrato de la épica.
- Al **discutir naming**: si hay conflicto UML vs contrato API, documentar la decisión aquí (como en §6).
- Al **revisar PRs de dominio**: verificar que no se inventen atributos que contradigan el diagrama sin dejar rastro en este archivo.

---

*Documento vivo. Última actualización alineada a la implementación de Épica 4 (Planificar Cultivos, HU-BC-01 a HU-BC-05).*
