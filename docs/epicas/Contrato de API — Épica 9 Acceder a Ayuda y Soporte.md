# Contrato de API — Épica 9: Acceder a Ayuda y Soporte

Propietario: Paula Rodriguez, Rodrigo Sanz

> Este contrato no repite las convenciones transversales ya definidas (ERR-01 a ERR-19, y la convención de `message` en éxitos). Solo se detallan acá endpoints, requests, responses y errores específicos de esta épica. Contrastado contra el código real de `Croply-BackEnd` y `Croply-FrontEnd`, en particular `TiposSensorController` / `TiposSensorService` (mismo patrón de ABM de catálogo de Admin Croply), `PERMISO_SISTEMA`, `permisos.seed.ts`, `RolesService.asegurar_permisos_roles_admin`, `PageSizePaginationQueryDto`, `AllExceptionsFilter`, `NavbarAdminCroply.tsx`, `App.tsx` y `auth-token.ts`.
> 

---

## Decisiones tomadas en esta 1° versión

**1. Baja lógica, no física.** El texto de HU-AS-01 dice "elimine el registro de forma definitiva", pero el DC modela `fecha_bajaPF` — se usa baja lógica (mismo criterio que el resto del proyecto): la pregunta desaparece de todos los listados, pero el registro se conserva con su fecha de baja. Para el usuario el resultado es idéntico.

**2. Permiso nuevo `Soporte` para el editor; la consulta es libre.** Se agrega un permiso de sistema nuevo, `Soporte` (`PERMISO_SISTEMA.SOPORTE`), que protege todo lo que usa el editor de HU-AS-01: crear, editar, eliminar y el listado paginado de gestión. La consulta de usuario (HU-AS-02, 03 y 04) solo exige sesión válida, sin ningún permiso: la HU habla de "usuario del sistema", y eso incluye Admin Croply, Admin de Finca y empleados con cualquier rol.

**3. Dos `GET` de preguntas, uno por pantalla, con el mismo shape de ítem.** Las dos pantallas necesitan los mismos campos por pregunta (`id_pregunta_frecuente`, `pregunta`, `respuesta`), pero no la misma envoltura: el editor de Admin Croply (cards, HU-AS-01) pagina y el acordeón de consulta (HU-AS-02) no. Por eso son dos endpoints distintos, cada uno con su guard explícito:

- `GET /api/v1/preguntas-frecuentes/gestion` → editor, **paginado**, requiere permiso `Soporte`.
- `GET /api/v1/preguntas-frecuentes` → consulta, **lista completa sin paginar**, solo sesión válida.

No se resuelve con un solo endpoint de paginación opcional: tener un response que cambia de forma según los query params complica el tipado del frontend. Un ítem del listado se tipa una sola vez y se reutiliza en ambos.

**4. Paginación solo en el editor (`/gestion`), `page` / `pageSize`, default 10.** Las cards ocupan mucho espacio en pantalla, por eso el editor pagina; el acordeón es compacto y muestra todo (decisión 3). Mismo envoltorio que Épicas 2, 6 y 8 (`pagination: { page, pageSize, totalItems, totalPages }`), reutilizando `PageSizePaginationQueryDto` (`pageSize` máximo 100). Un `page` mayor al último devuelve lista vacía con `pagination` correcto, no un error. Consecuencias para el frontend:

- Tras **crear** una pregunta, volver a la página 1 y volver a pedir el listado al backend (`GET .../gestion?page=1`): la nueva queda primera (decisión 5). El usuario **no** recarga la página: el frontend dispara ese nuevo `GET` automáticamente apenas el `POST` responde `201` (con React Query, invalidando la query del listado). **No armar la card a mano** con la respuesta del `POST` ni insertarla en el estado local.
- Tras **editar** una pregunta, volver a pedir la página actual de la misma forma (automático, sin recarga): la card conserva su lugar, porque el orden es por fecha de creación y no por fecha de modificación.
- Tras **dar de baja**, mismo mecanismo (nuevo `GET` automático). Si se dio de baja la última pregunta de la última página, el frontend retrocede una página (si no, quedaría una página vacía con `totalItems > 0`).
- El listado del acordeón (HU-AS-02) no tiene paginación: el frontend lo pide una sola vez al entrar a "Ayuda y soporte". No hay tope de filas del lado del backend; si el catálogo de FAQ creciera mucho más de lo esperado, habría que revisar esta decisión.

**5. Cada listado tiene su propio orden.**

- **Editor (`/gestion`): la última creada primero.** Por `fecha_altaPF` descendente; si dos preguntas comparten la misma marca de tiempo, desempata por `id_pregunta_frecuente` descendente, para que la paginación sea determinista. Editar una pregunta no cambia su lugar (se ordena por creación, no por modificación). Esto no cumple el orden alfabético que pide el texto de HU-AS-01 para las cards: es una decisión del equipo por comodidad de uso, así que no hay que construir orden alfabético en el editor.
- **Consulta (acordeón, `GET /preguntas-frecuentes`): alfabético, como pide HU-AS-02.** Por `pregunta` ascendente, sin distinguir mayúsculas ni acentos y **ignorando signos de puntuación iniciales** (`¿`, `¡`, comillas) — si no, las preguntas que empiezan con "¿" quedarían separadas de las que no. Desempate por `id_pregunta_frecuente` ascendente. Dado el volumen esperado (decenas de filas), el backend puede resolverlo en la base o en memoria, como le resulte más simple.

La clave de normalización de esta regla (sin mayúsculas, sin acentos, sin signos iniciales) es la misma que usa la unicidad de la decisión 6.

**6. Unicidad de `pregunta` (decisión del equipo, no figura en la HU).** No puede haber dos preguntas activas iguales. La comparación se hace sobre la **clave de normalización** de la decisión 5 (sin mayúsculas, sin acentos, sin signos iniciales, espacios de los extremos recortados), así que `"¿Cómo cargo un gasto?"` y `"Como cargo un gasto"` son duplicados. Al editar se excluye la propia fila. Las preguntas dadas de baja **no** cuentan: se puede volver a crear una que fue eliminada. Error: ERR-02 (`DUPLICATE_VALUE`) con `field: "pregunta"`.

**7. Formato del contenido: texto plano.** `pregunta` y `respuesta` son texto plano; los saltos de línea de `respuesta` se conservan. Sin HTML ni markdown. El frontend los renderiza siempre como texto (nunca con `dangerouslySetInnerHTML`; para respetar los saltos de línea usa `whitespace-pre-line`). El backend aplica `trim` a ambos campos antes de validar, así que un valor de solo espacios cuenta como vacío (`REQUIRED_FIELD`).

**8. Largos máximos, validados del lado del cliente.** `pregunta`: hasta **255** caracteres. `respuesta`: hasta **2000** caracteres. Mismo criterio que Épica 8 (decisión 14): validación estándar de formulario, sin `errorCode` propio. El DTO del backend igual lleva `@MaxLength` como defensa, pero no se define un shape de error específico para ese caso.

**9. Manual de usuario y email de soporte: configuración por variables de entorno del backend.** Dos variables, `MANUAL_USUARIO_URL` y `SOPORTE_EMAIL` (distinta de `MAIL_FROM`, que es el remitente `no-reply` de los correos del sistema). Se exponen juntas en un único endpoint de lectura. No existe ABM ni tabla para esto — queda fuera de alcance. Reglas de validación del backend al leerlas:

- vacía o solo espacios → `null`;
- `MANUAL_USUARIO_URL` debe empezar con `http://` o `https://`; si no, se trata como `null` y se deja un `warn` en el log del backend (evita que un valor mal cargado, por ejemplo `javascript:`, llegue a un `href`);
- `SOPORTE_EMAIL` debe tener formato básico de correo; si no, `null` con `warn`.

**10. Valor no configurado → `null`, y el frontend oculta la sección.** Si `manual_usuario_url` es `null`, no se muestra la sección "Manual de usuario"; si `email_soporte` es `null`, no se muestra la sección "Contacto". Si ambos son `null`, "Ayuda y soporte" muestra solo las preguntas frecuentes.

**11. Auditoría (`LogOperaciones`).** Crear y editar se registran con `TipoOperacion.EXITO`; la baja, con `TipoOperacion.OPERACION_DESTRUCTIVA`. `recurso: "PreguntaFrecuente:<id>"`. Mismo patrón que `TiposSensorService`. Si el log falla, la operación principal igual se completa (HU-GU-12). No cambia ningún request/response.

**12. Dos mensajes de estado vacío, uno por pantalla.** El backend no distingue: ambos casos devuelven `preguntas_frecuentes: []` (el de gestión, además, con `pagination.totalItems: 0`), y como no hay búsqueda ni filtros en esta épica no hay ambigüedad posible. Cada pantalla muestra su propio texto (HU-AS-01: "Aún no hay preguntas frecuentes cargadas. Usá el formulario para crear la primera." — HU-AS-02: "Por el momento no hay preguntas frecuentes disponibles.").

**13. `fecha_altaPF` la setea el backend al crear.** Al crear una pregunta, el backend persiste siempre `fecha_altaPF` con la fecha y hora actual (mismo mecanismo que `fecha_alta` en `TipoSensor`: `default CURRENT_TIMESTAMP`, nunca viaja en el request). Al editar no se modifica; al dar de baja se setea `fecha_bajaPF` (decisión 1). Ninguna pantalla muestra estas fechas, por eso no viajan en ningún response (ver "Convención de naming"), pero la columna nunca puede quedar vacía en una fila nueva: `fecha_altaPF` es además la clave de orden del listado del editor (decisión 5).

**14. Sin errores nuevos.** Esta épica reutiliza `REQUIRED_FIELD` (ERR-01), `DUPLICATE_VALUE` (ERR-02), `UNEXPECTED_ERROR` (ERR-03), `RESOURCE_NOT_FOUND` (ERR-05) y los `401 UNAUTHORIZED` / `403 FORBIDDEN` transversales. El próximo número libre es **ERR-20**.

---

## Pendientes

| Pendiente | Detalle | Cuándo se resuelve |
| --- | --- | --- |
| Valor real de `MANUAL_USUARIO_URL` | URL del manual de usuario publicado. | Cuando el equipo tenga el manual publicado. |
| Confirmar `SOPORTE_EMAIL` | Hoy es `croplyagronomia@gmail.com` (provisorio, ver tabla de variables). | Cuando el equipo confirme que esa es la casilla oficial definitiva. |
| Pantalla de la vista de usuario | `Pantallas-definidas` solo tiene PAN-AC-09 (editor de Admin Croply). HU-AS-02, 03 y 04 no tienen pantalla asociada. | Antes de implementar el frontend de esas HU, definir el diseño de "Ayuda y soporte" (acordeón de FAQ + sección "Manual de usuario" + sección "Contacto"). |

> `.env.example` lleva `SOPORTE_EMAIL=croplyagronomia@gmail.com` y deja `MANUAL_USUARIO_URL=` **vacía**. Con esa variable vacía todo funciona: el endpoint devuelve `manual_usuario_url: null` y el frontend oculta la sección "Manual de usuario" (decisión 10); la sección "Contacto" se muestra con el email. Ojo: `.env.example` es solo la plantilla — el email hay que cargarlo también en el `.env` real de cada entorno (local, demo y producción), si no ahí devuelve `null`.
> 

---

## HU-AS-01. ABM de preguntas frecuentes

- **Autenticación:** Requerida (Rol: Administrador Croply)
- **Guards (backend):** `JwtAuthGuard` + `AdminCroplyGuard` + `PermisoGuard` con `@RequirePermiso(PERMISO_SISTEMA.SOPORTE)` — mismo patrón que `TiposSensorController`. Aplica a los cuatro endpoints de esta sección (listado de gestión, crear, editar y eliminar).
- **Headers:** `Authorization: Bearer <JWT>`
- **Pantalla:** PAN-AC-09 — Sección Soporte ("Centro de Ayuda").

### Listar preguntas frecuentes (editor)

`GET /api/v1/preguntas-frecuentes/gestion?page=1&pageSize=10`

**Query params:** `page` (default 1), `pageSize` (default 10, máximo 100). Sin búsqueda ni filtros. Orden: la última creada primero (decisión 5).

`200 OK`:

```json
{
  "preguntas_frecuentes": [
    {
      "id_pregunta_frecuente": 7,
      "pregunta": "¿Cómo registro una aplicación de agroquímico?",
      "respuesta": "Ingresá a la sección Agroquímicos y presioná \"Registrar Aplicación\"."
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 23,
    "totalPages": 3
  }
}
```

> Alimenta las cards de PAN-AC-09. Cada ítem trae la `respuesta` completa, así la card la muestra sin ningún request adicional.
> 
> 
> Sin preguntas cargadas: `preguntas_frecuentes: []` con `pagination.totalItems: 0`; el frontend muestra "Aún no hay preguntas frecuentes cargadas. Usá el formulario para crear la primera."
> 

### Crear pregunta frecuente

`POST /api/v1/preguntas-frecuentes`

```json
{
  "pregunta": "¿Cómo registro una aplicación de agroquímico?",
  "respuesta": "Ingresá a la sección Agroquímicos y presioná \"Registrar Aplicación\"."
}
```

`201 Created`:

```json
{
  "message": "Pregunta frecuente creada correctamente.",
  "id_pregunta_frecuente": 7,
  "pregunta": "¿Cómo registro una aplicación de agroquímico?",
  "respuesta": "Ingresá a la sección Agroquímicos y presioná \"Registrar Aplicación\"."
}
```

> El request solo lleva `pregunta` y `respuesta`: `fecha_altaPF` la setea el backend automáticamente (decisión 13) y no viaja ni en el request ni en el response.
> 
> 
> El formulario "Redactar Nueva FAQ" se vacía en el frontend tras el éxito. La card nueva aparece primera al volver a la página 1 y refrescar el listado de gestión (decisión 4), no insertándola a mano.
> 

### Editar pregunta frecuente

`PUT /api/v1/preguntas-frecuentes/:id_pregunta_frecuente`

Mismo body que la creación (ambos campos obligatorios, edición completa).

`200 OK`:

```json
{
  "message": "Pregunta frecuente actualizada correctamente.",
  "id_pregunta_frecuente": 7,
  "pregunta": "¿Cómo registro una aplicación de agroquímico?",
  "respuesta": "Texto actualizado."
}
```

### Eliminar pregunta frecuente

`DELETE /api/v1/preguntas-frecuentes/:id_pregunta_frecuente`

Baja lógica (decisión 1): setea `fecha_bajaPF`.

`200 OK`:

```json
{
  "message": "Pregunta frecuente eliminada correctamente.",
  "id_pregunta_frecuente": 7
}
```

### Botones sin endpoint

"Descartar" (vacía el formulario) y "Cancelar" de los modales de edición y eliminación se resuelven 100% en el frontend, sin ningún request.

### Errores

- `REQUIRED_FIELD` → ERR-01, con `field: "pregunta"` o `field: "respuesta"` (vacíos o solo espacios).
- `DUPLICATE_VALUE` → ERR-02, `field: "pregunta"` (decisión 6). Aplica a crear y a editar:

```json
{
  "statusCode": 409,
  "errorCode": "DUPLICATE_VALUE",
  "field": "pregunta",
  "message": "El valor ingresado ya existe"
}
```

- `RESOURCE_NOT_FOUND` → ERR-05, en `PUT` / `DELETE`, si `:id_pregunta_frecuente` no existe o ya fue dada de baja (otro Admin Croply la eliminó entre tanto). El frontend refresca el listado para limpiar la card fantasma.

---

## HU-AS-02. Consultar preguntas frecuentes

- **Autenticación:** Requerida (cualquier usuario autenticado — solo `JwtAuthGuard`, sin `PermisoGuard`)
- **Headers:** `Authorization: Bearer <JWT>`

`GET /api/v1/preguntas-frecuentes`

Sin query params: **devuelve todas las preguntas activas, sin paginar** (decisión 4).

`200 OK`:

```json
{
  "preguntas_frecuentes": [
    {
      "id_pregunta_frecuente": 7,
      "pregunta": "¿Cómo registro una aplicación de agroquímico?",
      "respuesta": "Ingresá a la sección Agroquímicos y presioná \"Registrar Aplicación\"."
    }
  ]
}
```

> Sin envoltura `pagination`. Orden alfabético (decisión 5), responsabilidad del backend. Cada ítem trae la `respuesta` completa, así el acordeón expande y contrae sin ningún request adicional (lo pide el AC: "sin recargar la pantalla").
> 
> 
> No se exponen `fecha_altaPF` ni `fecha_bajaPF`: ninguna pantalla las muestra.
> 
> Este endpoint es solo para la vista de usuario. El editor de Admin Croply (HU-AS-01) usa `GET /api/v1/preguntas-frecuentes/gestion`, paginado.
> 

### Sin preguntas cargadas

`preguntas_frecuentes: []`. El frontend muestra "Por el momento no hay preguntas frecuentes disponibles." (decisión 12).

### Errores

Ninguno específico. Solo los transversales (`401 UNAUTHORIZED`, ERR-03).

---

## HU-AS-03 y HU-AS-04. Manual de usuario y canal de contacto

Las dos HU comparten un único endpoint de lectura (decisión 9).

- **Autenticación:** Requerida (cualquier usuario autenticado — solo `JwtAuthGuard`, sin `PermisoGuard`)
- **Headers:** `Authorization: Bearer <JWT>`

`GET /api/v1/soporte/configuracion`

`200 OK`:

```json
{
  "manual_usuario_url": "https://ejemplo.com/manual-croply",
  "email_soporte": "soporte@ejemplo.com"
}
```

Cualquiera de los dos campos puede venir `null` (decisión 10):

```json
{
  "manual_usuario_url": null,
  "email_soporte": "croplyagronomia@gmail.com"
}
```

> Este último es el estado esperado hoy: el manual todavía no existe, así que el frontend muestra solo la sección "Contacto".
> 

> No lleva `message`: es una consulta, no una acción del usuario.
> 
> 
> **Frontend, HU-AS-03:** el botón "Ver manual" abre `manual_usuario_url` en una pestaña nueva (`target="_blank"`, `rel="noopener noreferrer"`) sin abandonar ni recargar "Ayuda y soporte".
> 
> **Frontend, HU-AS-04:** el correo se muestra como texto y como enlace `mailto:<email_soporte>`.
> 

### Variables de entorno (backend)

| Variable | Descripción | Valor | Estado |
| --- | --- | --- | --- |
| `MANUAL_USUARIO_URL` | URL externa del manual de usuario. | — | **Pendiente** |
| `SOPORTE_EMAIL` | Correo oficial de soporte. | `croplyagronomia@gmail.com` | Definido (provisorio) |

### Errores

Ninguno específico. Solo los transversales (`401 UNAUTHORIZED`, ERR-03).

---

## Convención de naming

Snake_case minúscula estricta, sin casing crudo del DC. De `PreguntaFrecuente` se exponen `id_pregunta_frecuente`, `pregunta` y `respuesta`, literales del DC. Las fechas del DC (`fecha_altaPF`, `fecha_bajaPF`) se persisten (la primera se setea sola al crear, decisión 13) pero no viajan en la API; las columnas físicas las nombra el backend en snake_case minúscula, como hizo en el resto de las entidades.

`manual_usuario_url` y `email_soporte` **no están en el DC**: no son atributos de ninguna entidad, sino valores de configuración, y se documentan acá como extensión (mismo mecanismo que usaron épicas anteriores para campos que no están en el DC). La clave de la lista es `preguntas_frecuentes`.

---

## Endpoints y lógica de Épicas anteriores que esta Épica toca

**1. Catálogo de permisos de sistema (Épica 2, HU-GU-05).** `PERMISO_SISTEMA` y `PERMISOS_SISTEMA_SEED` suman `Soporte`, y `GET /api/v1/roles/permisos?ambito=sistema` pasa a devolver 5 permisos en vez de 4. El modal de permisos de HU-GU-05 lee esa lista del backend, así que el checkbox nuevo aparece solo. Al arrancar, `asegurar_permisos_roles_admin` le asigna automáticamente el permiso al rol Admin Croply. Los roles de sistema **personalizados** no lo tienen hasta que un Admin Croply se lo asigne desde HU-GU-05.

**2. Frontend: constantes y sesión.** `src/constants/permisos.ts` agrega `SOPORTE: 'Soporte'` a `PERMISO_SISTEMA` (y por lo tanto a `PERMISOS_SISTEMA`). Ojo: el frontend decide qué mostrar con los `permisos` del JWT (`permisosDesdePayload` en `auth-token.ts` los prioriza), mientras que el backend valida contra la base. Una sesión de Admin Croply iniciada **antes** del deploy no tiene `Soporte` en su token hasta volver a iniciar sesión — hay que avisarlo al probar.

**3. Frontend: navegación.**

- `NavbarAdminCroply.tsx`: el ítem "Soporte" hoy es un placeholder deshabilitado; pasa a ser un link gateado con `tienePermiso(PERMISO_SISTEMA.SOPORTE)`. `ROUTES.CROPLY` no tiene ruta de soporte todavía: hay que agregarla, protegida con `RequirePermiso permisos={[PERMISO_SISTEMA.SOPORTE]}`, igual que Catálogos Base.
- `App.tsx`: la ruta `ROUTES.FINCA.SOPORTE` (`/finca/soporte`) hoy renderiza `PlaceholderAdminFinca title="Ayuda y soporte"`; se reemplaza por la pantalla real, **sin** `RequirePermiso` (lectura libre, decisión 2).

**4. Backend: configuración.** `.env.example` suma `SOPORTE_EMAIL=croplyagronomia@gmail.com` y `MANUAL_USUARIO_URL=` (vacía hasta tener el manual, ver Pendientes). Módulo nuevo `preguntas-frecuentes` y tag Swagger nuevo, siguiendo `swagger-guidelines.md`.