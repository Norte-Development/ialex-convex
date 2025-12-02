# Monitoreo de Notificaciones PJN – Ingesta Automática

## Objetivo

Implementar un **pipeline de ingesta automática de notificaciones PJN** hacia iAlex, basado en el flujo del apartado **1. Monitoreo e Ingesta Automática de Notificaciones** de `docs/pjn-integration-features.md`, incluyendo cron jobs, scraping en Cloud Run, almacenamiento en GCS y sincronización con Convex.

## Alcance

- Sincronizar periódicamente eventos PJN (`/eventos`) por usuario.
- Descargar PDFs asociados a eventos y guardarlos en GCS.
- Invocar `document-processor` para procesar PDFs.
- Crear entradas en `ACTIVITY_LOG` y `DOCUMENTS` y vincularlas a `CASES` usando FRE.
- Manejar expiración de sesión PJN y re‑autenticación automática.

## Flujo Técnico (resumen)

- Convex cron → Convex action → Cloud Run scraper → PJN API → GCS → document-processor → Convex webhook → Convex DB.
- Referencia visual: diagrama en la sección “Monitoreo e Ingesta Automática de Notificaciones”.

## Backend – Convex

- [ ] **Cron de sincronización**
  - [ ] Definir cron job (cada 15–30 min) para disparar la sync por usuario con cuenta PJN.
  - [ ] Query Convex para listar usuarios con credenciales PJN activas.
- [ ] **Action de orquestación**
  - [ ] Crear action `pjn.syncNotificationsForUser` (nombre tentativo) que:
    - [ ] Obtenga `lastSyncedAt` y/o `lastEventId` por usuario.
    - [ ] Llame al endpoint de Cloud Run `/scrape/events` con `{ userId, since }`.
    - [ ] Persista los resultados recibidos (eventos, metadatos).
  - [ ] Manejar estados: OK, AUTH_REQUIRED, errores de red/timeout.
- [ ] **Persistencia de eventos**
  - [ ] Diseñar/ajustar esquema de `ACTIVITY_LOG` para `pjn_notification_received` (ver sección de modelo de datos del expediente).
  - [ ] Insertar eventos nuevos con referencias a:
    - [ ] Usuario.
    - [ ] Caso (por FRE).
    - [ ] IDs PJN (`pjnEventId`, etc.).
  - [ ] Actualizar `CASES.lastSyncedAt` / `lastPjnNotificationSync`.

## Backend – Cloud Run Scraper

- [ ] **Endpoint `/scrape/events`**
  - [ ] Recibir `{ userId, since }`.
  - [ ] Leer `session_state.json` del bucket correspondiente.
  - [ ] Llamar a `api.pjn.gov.ar/eventos` paginado hasta no encontrar eventos nuevos.
- [ ] **Descarga de PDFs**
  - [ ] Por cada evento nuevo, llamar `GET /eventos/{eventId}/pdf`.
  - [ ] Subir el PDF a bucket GCS `pjn-documents` con una convención de path (`pjn/{userId}/{eventId}.pdf`).
  - [ ] Notificar a `document-processor` con `{ gcsPath, metadata }`.
- [ ] **Manejo de sesión**
  - [ ] Detectar redirecciones a login SSO → marcar `AUTH_REQUIRED`.
  - [ ] Para re‑auth, aceptar credenciales desde Convex y guardar nuevo `session_state.json`.

## Backend – document-processor

- [ ] Reutilizar pipeline actual de procesamiento de PDF:
  - [ ] Descargar PDF desde GCS.
  - [ ] Ejecutar OCR si es necesario.
  - [ ] Extraer texto/estructura básica.
  - [ ] Enviar webhook a Convex (`/webhooks/document-processed`) con:
    - [ ] `gcsPath`, `size`, `pages`, `sourceSystem: "PJN-Portal"`, `pjnEventId`.

## DB / Modelo de Datos

- [ ] Actualizar/confirmar esquema:
  - [ ] `DOCUMENTS.sourceSystem = "PJN-Portal"`.
  - [ ] Campo `pjnEventId` en `DOCUMENTS` y/o `ACTIVITY_LOG`.
  - [ ] Campo `fre` o `externalCaseId` en `CASES` para vinculación.
- [ ] Implementar mapeo:
  - [ ] Evento PJN → `ACTIVITY_LOG` (`action: "pjn_notification_received"`).
  - [ ] PDF PJN → `DOCUMENTS` con referencia al caso mediante FRE.

## Frontend / UX

- [ ] Añadir a la UI de casos:
  - [ ] Indicador de sincronización PJN por caso (última sync, estado).
  - [ ] Visualización de documentos PJN en la línea de tiempo del caso.
  - [ ] Diferenciar iconográficamente documentos PJN vs internos.
- [ ] Añadir notificaciones:
  - [ ] Toast / banner al llegar nuevas notificaciones PJN relevantes para el usuario actual.

## Monitoreo y Observabilidad

- [ ] Logs estructurados en Cloud Run con:
  - [ ] userId, cantidad de eventos procesados, errores de scraping.
- [ ] Métricas básicas:
  - [ ] Tiempo medio de sync por usuario.
  - [ ] Ratio de errores de autenticación vs syncs exitosos.

## Criterios de Aceptación

- [ ] Las notificaciones PJN nuevas aparecen en iAlex sin intervención manual dentro del intervalo de cron definido.
- [ ] Los PDFs PJN se almacenan en GCS y se reflejan como `DOCUMENTS` con `sourceSystem: "PJN-Portal"`.
- [ ] Los eventos se vinculan correctamente a los casos por FRE.
- [ ] La expiración de sesión PJN se maneja automáticamente y/o con feedback claro al usuario.


