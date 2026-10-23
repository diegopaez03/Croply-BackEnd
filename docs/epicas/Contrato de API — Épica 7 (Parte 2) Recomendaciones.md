# Contrato de API — Épica 7 (Parte 2): Recomendaciones y Alertas Automáticas

Propietario: Diego Paez

Propietario: Diego Paez

> Este contrato complementa la primera parte de la Épica 7 (Sensores y Clima). Se definen exclusivamente los endpoints expuestos por el **Backend NestJS** hacia el Frontend para resolver las recomendaciones de Inteligencia Artificial y las Alertas Climáticas, incorporando las estrategias de optimización de llamadas y caché acordadas por el equipo.
> 

## Decisiones tomadas y Reglas de Negocio (Backend)

**1. Vigencia y Caché de Recomendaciones (1 hora):**
Para garantizar coherencia entre los usuarios de una misma finca y evitar saturar el microservicio de IA, la evaluación agronómica se cachea en la base de datos de NestJS. Cuando el primer usuario solicita la recomendación de una parcela, se evalúa y se guarda con una fecha de caducidad de **1 hora**. Durante ese lapso, cualquier usuario que consulte la misma parcela recibirá la recomendación persistida sin activar una nueva petición a la IA.

**2. Regla de Conservación de Mensaje (Bypass del LLM):**
Cuando caduca la vigencia y se requiere una nueva evaluación, el Backend NestJS consulta al servicio de ML (`/evaluate-parcel`). Si la `accion_recomendada` devuelta por el clasificador LightGBM es **exactamente la misma** que la recomendación anterior vigente en la base de datos, el backend **omite la redacción del LLM** (sobreescribiendo el `requiere_intervencion_llm: false` si fuera necesario) y simplemente renueva la vigencia por otra hora utilizando los textos generados previamente.

**3. Alertas Climáticas 100% Deterministas (Sin LLM):**
La detección de alertas climáticas (HU-NA-01) se delega exclusivamente al motor de reglas deterministas del `croply-ai-service` (evaluación de Open-Meteo vs. límites fenológicos). Si el motor detecta una alerta, el backend de NestJS genera la entidad `AlertaClimatica` y su respectiva `Notificacion` utilizando mensajes predefinidos y estructurados, **sin pasar por Gemma 4**.

## Errores específicos que se agregan en esta fase

**ERR-14 — Servicio de IA Inaccesible**

JSON

```
{
  "statusCode": 503,
  "errorCode": "AI_SERVICE_UNAVAILABLE",
  "message": "El motor de recomendaciones no se encuentra disponible en este momento. Mostrando última información conocida."
}
```

*Frontend debe:* Mostrar la última recomendación cacheada (si existe) con un indicador visual de "Sin conexión", o el estado vacío predeterminado sin bloquear la navegación.

## HU-NA-03. Visualizar recomendaciones agrícolas generadas por IA

- **Autenticación:** Requerida.
- **Guard:** `JwtAuthGuard, AdminFincaPorParcelaGuard`

### Obtener recomendación vigente de una parcela

Este endpoint actúa como un *Proxy Inteligente*. El frontend realiza un `GET` simple; el backend de NestJS decide internamente si devuelve la caché de la base de datos o si consulta al microservicio Python, actualiza la base de datos y luego responde.

`GET /api/v1/parcelas/:id_parcela/recomendacion-ia`

**Respuesta Exitosa (200 OK):**

JSON

```
{
  "id_recomendacion": 412,
  "id_parcela": 101,
  "accion_recomendada": "REGAR_URGENTE",
  "severidad": "Alta",
  "sensor_origen_principal": "humedad_suelo_pct",
  "factores_clave": [
    { "sensor_ui": "humedad_suelo_pct", "valor": 14.8 }
  ],
  "titulo_corto": "Riego urgente recomendado",
  "texto_breve": "Humedad del suelo (14.8%) bajo umbral crítico en floración.",
  "texto_explicativo_extendido": "El cultivo de Tomate en etapa media presenta un déficit hídrico severo detectado por humedad_suelo_pct (14.8%). Se aconseja activar inmediatamente el turno de riego para prevenir estrés irreversible y pérdida de rendimiento.",
  "fecha_generacion": "2026-10-23T16:15:00Z",
  "valida_hasta": "2026-10-23T17:15:00Z",
  "origen_datos": "CACHE_LLM"
}
```

> **Notas para el Frontend:**
> 
> - Si la parcela está en `ESTADO_OPTIMO_SIN_ACCION` sin alertas, el backend devolverá un **204 No Content** o un objeto con todos los textos en `null`, lo que el frontend interpreta para mostrar el *Empty State*: "No hay recomendaciones activas en este momento."
> - `origen_datos` es informativo (puede ser `NUEVA_EVALUACION_LLM`, `CACHE_VIGENTE`, `CACHE_RENOVADA_SIN_LLM`, o `FALLBACK_INTA`).

## HU-NA-01. Recibir alertas climáticas automáticas

- **Nota Arquitectónica (Backend):** La creación de la alerta **no la dispara el frontend**. La genera un Cron Job interno del servidor NestJS que, cada 1 hora, corre un lote evaluando el clima de las fincas contra el microservicio Python. Si detecta una alerta, persiste un registro en la tabla `AlertaClimatica` e inserta filas en `Notificacion` para los usuarios correspondientes.

### Consultar alertas climáticas vigentes por finca (Para el Header / Dashboard)

- **Autenticación:** Requerida.
- **Guard:** `AdminFincaGuard`

`GET /api/v1/fincas/:id_finca/alertas-climaticas?estado=Vigente`

**Respuesta Exitosa (200 OK):**

JSON

```
{
  "alertas": [
    {
      "id_alerta": 89,
      "codigo_alerta": "ALERTA_HELADA",
      "severidad": "Alta",
      "fecha_deteccion": "2026-10-23T05:00:00Z",
      "descripcion": "Helada severa pronosticada. Temperatura mínima de -2.0°C esperada en las próximas 24 horas.",
      "estado": "Vigente"
    }
  ]
}
```

> Si la alerta caduca porque el pronóstico mejora, el Cron Job interno la pasa a `estado: "Resuelta"`. El frontend utiliza este endpoint para mostrar los *banners* rojos de contingencia en la sección `PAN-AF-01 - Mi Finca`.
>