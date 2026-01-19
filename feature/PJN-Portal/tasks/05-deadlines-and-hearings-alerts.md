# Alertas Proactivas de Plazos y Audiencias

## Objetivo

Implementar la **extracción de plazos y fechas de audiencias** desde documentos PJN y expediente SCW, y la creación automática de eventos de calendario con recordatorios, según la sección **5. Alertas Proactivas de Plazos y Audiencias** de `docs/pjn-integration-features.md`.

## Alcance

- Detección de plazos y audiencias en textos procesados por `document-processor` y movimientos de SCW.
- Creación de eventos en el sistema de calendario/eventos interno.
- Recordatorios automáticos (cron diario) y alertas de plazos vencidos.

## Flujo Técnico (resumen)

- `document-processor` → webhook a Convex con documento PJN → LLM extrae plazo/tipo de acción → Convex crea `EVENTO` ligado a `CASE` y abogado → cron diario ejecuta recordatorios por email/WhatsApp/in‑app.

## Backend – Extracción de Plazos

- [ ] **Procesamiento inicial de documento**
  - [ ] A partir del webhook de `document-processor`, recuperar:
    - [ ] Texto OCR.
    - [ ] Metadatos del documento (tipo, fecha, partes, etc.) si ya existen.
- [ ] **Patrones determinísticos**
  - [ ] Implementar detección por regex:
    - [ ] “plazo de X días”.
    - [ ] “hasta el DD/MM/YYYY”.
    - [ ] “audiencia fijada el …”.
  - [ ] Calcular fechas:
    - [ ] Hoy + X días.
    - [ ] Parsear fecha explícita.
- [ ] **Fallback con LLM**
  - [ ] Integrar con agente LLM para extracción semántica:
    - [ ] Enviar prompt similar al de la sección “Patrones de Detección de Plazos”.
    - [ ] Recibir `{ plazo, tipo, confianza }`.

## Backend – Creación y Gestión de Eventos

- [ ] **Modelo de eventos**
  - [ ] Confirmar/definir tabla `EVENTOS` con:
    - [ ] `caseId`, `title`, `date`, `type` (plazo/audiencia), `sourceSystem`, `deadlineType`, `confidence`.
    - [ ] `diasRecordatorio`: lista de días antes del evento (ej. [7, 3, 1]).
- [ ] **Creación de eventos**
  - [ ] Crear evento cuando:
    - [ ] `confianza ≥ umbral` (ej. 0.8) → auto‑crear.
    - [ ] `confianza < umbral` → marcar para revisión manual (no notificar todavía).
- [ ] **Recordatorios periódicos**
  - [ ] Cron diario:
    - [ ] Buscar eventos donde `date - hoy` ∈ `diasRecordatorio`.
    - [ ] Enviar notificaciones:
      - [ ] Email.
      - [ ] WhatsApp (vía servicio existente).
      - [ ] Notificación in‑app.
- [ ] **Plazos vencidos**
  - [ ] Detectar eventos con `date < hoy` sin acción registrada:
    - [ ] Marcar como `vencido`.
    - [ ] Enviar alerta urgente a abogado y/o admin.

## Frontend – Calendario y Notificaciones

- [ ] **Calendario de caso y global**
  - [ ] Mostrar eventos PJN:
    - [ ] Diferenciar plazos judiciales vs eventos internos.
    - [ ] Iconografía y colores claros.
- [ ] **Bandeja de alertas**
  - [ ] Listado de:
    - [ ] Plazos próximos (ej. próximos 7 días).
    - [ ] Plazos vencidos.
    - [ ] Audiencias próximas.
- [ ] **Detalle de evento**
  - [ ] Mostrar origen (PJN / documento / expediente).
  - [ ] Link al documento o movimiento que generó el evento.

## Integración con Documentos y Expediente

- [ ] A nivel de documento:
  - [ ] Vincular el evento a `DOCUMENTS` cuando se origina en una providencia/auto.
- [ ] A nivel de expediente:
  - [ ] Permitir que ciertos tipos de movimientos SCW también creen eventos (ej. fijación de audiencia).

## Criterios de Aceptación

- [ ] Los plazos importantes detectados en documentos PJN generan eventos en el calendario interno.
- [ ] Los usuarios reciben recordatorios en los canales configurados según la anticipación deseada.
- [ ] Se evitan falsos positivos mediante umbral de confianza y flujo de revisión manual cuando es necesario.


