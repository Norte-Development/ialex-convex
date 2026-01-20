# Integración Bidireccional de Presentación de Escritos

## Objetivo

Permitir que los abogados **redacten escritos en iAlex y los presenten directamente al Sistema de Escritos Web del PJN**, rastreando su estado, según la sección **6. Integración Bidireccional de Presentación de Escritos** de `docs/pjn-integration-features.md`.

## Alcance

- Conversión de escritos (JSON Tiptap) a PDF listo para presentar.
- Orquestación de subida y presentación en el Sistema de Escritos Web vía Cloud Run.
- Tracking de estado de presentación (filed, accepted, rejected, failedToFile).

## Flujo Técnico (resumen)

- Usuario marca escrito como “listo para presentar” → Convex genera PDF y lo sube a GCS → Convex llama a Cloud Run `/file-escrito` → Cloud Run automatiza presentación en PJN → devuelve número de recibo → Convex actualiza `ESCRITOS` y `ACTIVITY_LOG` → proceso periódico de verificación de estado.

## Backend – Convex

- [ ] **Estado del escrito**
  - [ ] Implementar máquina de estados:
    - [ ] `Borrador` → `PendingFiling` → `Filing` → `Filed` → (`Accepted` | `Rejected`) con `FailedToFile` como estado de error.
- [ ] **Generación de PDF**
  - [ ] Acción que:
    - [ ] Recibe ID del escrito y `caseId`.
    - [ ] Convierte JSON Tiptap a PDF (usando infraestructura existente).
    - [ ] Sube PDF a bucket GCS `ialex-escritos`.
  - [ ] Al completar, llama a Cloud Run `/file-escrito` con `{ escritoId, caseId, fre, gcsPath }`.
- [ ] **Actualización de estado**
  - [ ] Al recibir respuesta de Cloud Run con `{ status, pjnReceiptId }`:
    - [ ] Actualizar `ESCRITOS` con:
      - [ ] `status`, `pjnReceiptId`.
    - [ ] Registrar entrada en `ACTIVITY_LOG`.

## Backend – Cloud Run

- [ ] **Endpoint `/file-escrito`**
  - [ ] Recibe `{ escritoId, caseId, fre, gcsPath }`.
  - [ ] Descarga PDF de GCS.
  - [ ] Navega al Sistema de Escritos Web:
    - [ ] Selecciona caso por FRE.
    - [ ] Sube PDF.
    - [ ] Completa formulario de metadatos.
    - [ ] Envía presentación.
  - [ ] Extrae número de recibo/confirmación.
  - [ ] Devuelve `{ status: "filed" | "failed", pjnReceiptId?, error? }` a Convex.
- [ ] **Verificación periódica de estado**
  - [ ] Endpoint dedicado para consultar estado de recibo:
    - [ ] Dado `pjnReceiptId`, consultar si fue aceptado o rechazado.

## Backend – Verificación Programada

- [ ] Cron (ej. cada 6 horas):
  - [ ] Buscar escritos `status = Filed` sin estado final.
  - [ ] Llamar a Cloud Run para verificar estado.
  - [ ] Actualizar `ESCRITOS` a `Accepted` o `Rejected`.
  - [ ] Notificar al abogado cuando haya cambios.

## Frontend – UX de Presentación

- [ ] **Flujo en UI de escritos**
  - [ ] Botón “Marcar como listo para presentar”.
  - [ ] Botón “Presentar al PJN”.
  - [ ] Indicadores de estado:
    - [ ] Borrador / Pendiente de presentación / Presentando / Presentado / Aceptado / Rechazado / Error.
- [ ] **Detalle de presentación**
  - [ ] Mostrar:
    - [ ] FRE y caso asociado.
    - [ ] Número de recibo PJN.
    - [ ] Historial de cambios de estado.

## Integración con Otros Módulos

- [ ] Registrar en auditoría todas las presentaciones y cambios de estado.
- [ ] Vincular el PDF final presentado al caso y a la línea de tiempo de actividades.

## Criterios de Aceptación

- [ ] Un abogado puede redactar un escrito en iAlex y presentarlo al PJN sin salir de la plataforma.
- [ ] El estado del escrito se actualiza automáticamente desde el momento de envío hasta aceptación/rechazo.
- [ ] Los errores de presentación se informan claramente y permiten reintentos controlados.


