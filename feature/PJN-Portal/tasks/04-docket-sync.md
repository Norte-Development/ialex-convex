# Sincronización Completa del Expediente del Caso (SCW)

## Objetivo

Implementar la **sincronización del expediente completo del caso desde SCW** y su representación como línea de tiempo unificada en iAlex, según la sección **3. Sincronización Completa del Expediente del Caso** de `docs/pjn-integration-features.md`.

## Alcance

- Scraping del expediente/movimientos desde SCW (HTML).
- Parseo y normalización de movimientos (fecha, descripción, enlaces, estado).
- Persistencia en `ACTIVITY_LOG` y actualización de metadatos del caso.
- Integración con la línea de tiempo de actividades en la UI del caso.

## Flujo Técnico (resumen)

- User abre detalle de caso → Convex verifica si el expediente está desactualizado → Convex llama a Cloud Run `/scrape/docket` → Cloud Run scrapear SCW → Convex actualiza DB → UI muestra línea de tiempo combinada.

## Backend – Convex

- [ ] **Trigger de sincronización**
  - [ ] Query de caso por ID para obtener:
    - [ ] `fre`, `scwUrl`, `lastDocketSync`.
  - [ ] Si `lastDocketSync` es mayor a N horas (ej. 24 h):
    - [ ] Llamar a Cloud Run `/scrape/docket` con `{ scwUrl, caseId }`.
- [ ] **Procesamiento de respuesta**
  - [ ] Recibir `{ movements: [...], parties: [...], status: "..." }`.
  - [ ] Insertar/actualizar en `ACTIVITY_LOG` registros `pjn_docket_movement`.
  - [ ] Actualizar:
    - [ ] `CASES.pjnStatus`.
    - [ ] `CASES.lastDocketSync`.
    - [ ] Reconciliar partes con `CLIENTS` (similar al módulo de descubrimiento de casos).

## Backend – Cloud Run Scraper

- [ ] **Endpoint `/scrape/docket`**
  - [ ] Recibe `{ scwUrl, caseId }`.
  - [ ] Usa `session_state.json` para navegar a la página de SCW correspondiente.
  - [ ] Obtiene el HTML de la tabla de expediente.
- [ ] **Parseo de HTML**
  - [ ] Extraer por línea:
    - [ ] Fecha del movimiento.
    - [ ] Descripción.
    - [ ] Enlaces a documentos asociados (si existen).
    - [ ] Estado/progreso del caso (cuando se infiera).
  - [ ] Normalizar formato de fecha (ISO).
  - [ ] Devolver array estructurado `movements`.

## DB / Modelo de Datos

- [ ] Confirmar o extender `ACTIVITY_LOG`:
  - [ ] Campos: `action`, `source`, `pjnMovementId`, `metadata`.
  - [ ] `source: "PJN-Portal"` y `action: "pjn_docket_movement"`.
- [ ] Campos adicionales en `CASES`:
  - [ ] `fre`, `scwUrl`, `pjnStatus`, `lastDocketSync`.

## Frontend – Línea de Tiempo de Caso

- [ ] **Unificación de timeline**
  - [ ] Query única sobre `ACTIVITY_LOG` por caso:
    - [ ] Combinar eventos PJN + actividades internas.
    - [ ] Ordenar por `timestamp DESC`.
  - [ ] UI con iconos diferenciados:
    - [ ] 🏛️ Movimiento PJN.
    - [ ] 📄 Documento interno.
    - [ ] ✍️ Escrito redactado.
- [ ] **Indicadores de actualización**
  - [ ] Mostrar fecha/hora de última sync de expediente.
  - [ ] Posible botón “Forzar actualización” con throttling.

## Integración con Otros Módulos

- [ ] Enlazar movimientos a documentos PJN e internos cuando haya enlaces de descarga.
- [ ] Alimentar datos al módulo de **predicción de riesgo e insights** (Fase 4).

## Criterios de Aceptación

- [ ] El expediente completo del caso se refleja en iAlex con los mismos movimientos que SCW.
- [ ] Los movimientos se muestran integrados en una sola línea de tiempo con actividades internas.
- [ ] La sync solo se dispara cuando el expediente está “desactualizado” según ventana configurable.


