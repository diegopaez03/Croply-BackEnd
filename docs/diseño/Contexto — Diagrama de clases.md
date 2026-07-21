# Contexto — Diagrama de Clases (Croply)

> Documento de acompañamiento del diagrama UML de clases del dominio Croply.  
> Imagen de referencia: [`Diagrama UML - Diagrama de clases.jpg`](./Diagrama%20UML%20-%20Diagrama%20de%20clases.jpg)  
> Ubicación: `docs/diseño/`

Este archivo traduce el diagrama a lenguaje útil para backend, frontend y QA: qué modela cada clase, cómo se relacionan, qué enums existen y **qué decisiones de implementación** tomó el backend respecto del UML (especialmente en Épica 1).

---

## 1. Propósito del diagrama

El diagrama de clases es el **modelo de dominio conceptual** del sistema Croply: usuarios y roles, fincas y parcelas, cultivos, tareas de campo, clima, IoT, notificaciones, auditoría, etc.

No es un dump 1:1 de tablas TypeORM. En backend:

- Se implementan las entidades **necesarias por épica**.
- El contrato de API puede ajustar nombres JSON (`id_Usuario` vs `id_usuario`) y valores de enum.
- Campos o relaciones que el UML no detalla pero una HU exige (ej. token de invitación, `debe_cambiar_contrasena`) se documentan como **extensiones al modelo**.

---

## 2. Vista general del dominio

Bloques principales visibles en el diagrama:

| Bloque | Clases clave | Notas |
| --- | --- | --- |
| Acceso / identidad | `Usuario`, `Rol`, `RolSistema`, `RolFinca`, `UsuarioFinca`, `ResetsContrasena`, `InvitacionFinca`, `Permiso`, `RolPermiso` | Núcleo de Épica 1 |
| Onboarding | `SolicitudDigitalizacionFinca` | HU-AC-07 |
| Finca / terreno | `Finca`, parcelas, ubicaciones | Parcialmente en Épica 1 (stub `Finca`) |
| Producción | Cultivos, épocas, planes | Fuera de Épica 1 |
| Operación de campo | Tareas, notas, planes de acción | Fuera de Épica 1 |
| Clima / IoT | Condiciones, transmisiones, sensores | Fuera de este backend o épicas posteriores |
| Transversal | `LogOperaciones`, `Notificacion` | Fuera de Épica 1 |

---

## 3. Modelo de acceso (detalle Épica 1)

### 3.1 `Usuario`

| Atributo UML | Tipo (diagrama) | Notas de implementación |
| --- | --- | --- |
| `id_usuario` | Long | PK `bigint`; en JSON del contrato: `id_Usuario` |
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

### 3.3 `UsuarioFinca`

Asociación Usuario ↔ Finca con rol de finca.

| Atributo | Uso |
| --- | --- |
| `fecha_asociacion_rol` | Alta del vínculo |
| `fecha_fin_rol` | Si no es null y ya pasó, el vínculo no se incluye en el login |

El login arma el array `fincas[]` con `{ id_Finca, nombre_finca, rol_finca }` a partir de `UsuarioFinca` vigentes.

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
| `id_invitacion_finca` | PK; en API: `id_InvitacionFinca` |
| `email_invitado` | Precarga del formulario de registro |
| `fecha_envio`, `fecha_respuesta` | Ciclo de vida |
| `estado` | EstadoInvitacion |

Relaciones: composición desde `Finca`; `invitadoPor` (Usuario); `usuarioRegistrado` (0..1); `RolFinca` ofrecido.

**Extensiones (exigidas por HU-AC-03, ausentes en UML):**

| Campo | Uso |
| --- | --- |
| `token_hash` | Validar `GET /auth/validar-invitacion/:token` |
| `fecha_fin_vigencia` | Distinguir `INVITATION_EXPIRED` |

### 3.6 `SolicitudDigitalizacionFinca`

Campos del formulario de landing (nombre, correo, teléfono, ubicación, parcelas, superficie, comentario opcional, estado, fecha).

| UML | Backend |
| --- | --- |
| Relación a `Usuario` multiplicidad 1 | **`id_usuario` opcional** — el endpoint es público; si hay JWT se asocia, si no queda null |
| `id_solicitudDF` | En API: `id_Solicitud` |

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
| Rol — RolPermiso — Permiso | N:M | **No implementado** en Épica 1 |
| Usuario — LogOperaciones | 1 — 0..\* | **No implementado** |
| Usuario — Notificacion | 1 — 0..\* | **No implementado** |

---

## 5. Enums (auth / acceso)

### En el diagrama

| Enum | Valores UML |
| --- | --- |
| `EstadoUsuario` | `Pendiente`, `Activa`, `Inactiva` |
| `EstadoInvitacion` | `Pendiente`, `Aceptada`, `Rechazada` |
| `EstadoSolicitud` | `Pendiente`, `Contactado`, `Aprobada`, `Rechazada` |
| `TipoOperacion` | `Éxito`, `Fallo`, `Operacion_destructiva` |
| `TipoNotificacion` | varios (alerta climática, IA, etc.) |

### En la API / backend (contrato manda)

| Enum | Valores API |
| --- | --- |
| `EstadoUsuario` | `Pendiente`, **`Activo`**, **`Inactivo`** (masculino, como el contrato) |
| `EstadoInvitacion` | igual al UML |
| `EstadoSolicitud` | igual al UML |

Códigos de rol usados hoy:

- Sistema: `ADMIN_CROPLY`
- Finca: `ADMIN_FINCA`

---

## 6. Decisiones de alineación UML ↔ contrato ↔ código

Acordadas al implementar Épica 1:

1. **Naming JSON del contrato** (`id_Usuario`, `id_Finca`, `Activo`/`Inactivo`) sobre el naming literal del UML.
2. **`debe_cambiar_contrasena`** en `Usuario`.
3. **`token_hash` + vigencia** en `InvitacionFinca`.
4. **`RolSistema` opcional** en Usuario.
5. **`id_usuario` opcional** en solicitud de digitalización.
6. **`id_finca` numérico**.
7. **Solo entidades mínimas de Épica 1** — sin `Permiso`, `RolPermiso`, `LogOperaciones`, notificaciones ni dominio agrícola completo.
8. **Mailer stub** — no hay clase de correo en el UML; el envío de links se loguea en consola en desarrollo.

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
| Rol / RolSistema / RolFinca | `src/modules/roles` |
| Finca, UsuarioFinca, InvitacionFinca | `src/modules/fincas` |
| ResetsContrasena + endpoints auth | `src/modules/auth` |
| SolicitudDigitalizacionFinca | `src/modules/solicitudes-digitalizacion` |
| Seed admins desarrollo | `src/database/seed` |

---

## 8. Fuera del diagrama / fuera de Épica 1 (recordatorio)

No confundir “está en el diagrama” con “está implementado”:

- CRUD de fincas, parcelas, cultivos, reportes
- RBAC fino (`Permiso` / `RolPermiso`)
- `LogOperaciones`, notificaciones
- Refresh token persistido (vars en `.env` existen; contrato Épica 1 no lo exige)
- SMTP real, e2e Nest armado, CI/Railway

Detalle operativo: [`CONTEXT.md`](../../CONTEXT.md) y contrato en [`docs/epicas/`](../epicas/).

---

## 9. Cómo usar este documento

- Al **agregar una entidad** de una épica nueva: localizarla acá o en la imagen, decidir extensiones, actualizar esta sección y el contrato de la épica.
- Al **discutir naming**: si hay conflicto UML vs contrato API, documentar la decisión aquí (como en §6).
- Al **revisar PRs de dominio**: verificar que no se inventen atributos que contradigan el diagrama sin dejar rastro en este archivo.

---

*Documento vivo. Última actualización alineada a la implementación de Épica 1 (Gestionar el Acceso).*
