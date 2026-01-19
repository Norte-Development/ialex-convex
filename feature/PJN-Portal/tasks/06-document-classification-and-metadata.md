# Clasificación de Documentos PJN y Extracción de Metadatos

## Objetivo

Implementar la **clasificación automática de PDFs PJN** y la **extracción de metadatos clave** (tipo de documento, juez, fecha, partes, plazos) mediante `document-processor` + LLM, según la sección **4. Clasificación Inteligente de Documentos y Extracción de Metadatos** de `docs/pjn-integration-features.md`.

## Alcance

- Pipeline para clasificar documentos PJN (sentencia, providencia, notificación, cédula, otro).
- Extracción de metadatos estructurados relevantes para búsqueda y cumplimiento.
- Alimentación de módulos de búsqueda, plazos y auditoría.

## Flujo Técnico (resumen)

- PDF descargado del PJN → GCS → `document-processor` → OCR + extracción base → Convex llama a LLM para clasificación y metadatos → Convex actualiza `DOCUMENTS` y crea eventos de plazo cuando aplique.

## Backend – document-processor

- [ ] **Entrada desde Cloud Run**
  - [ ] Endpoint `/process` ya existente:
    - [ ] Asegurar que reciba metadatos `{ gcsPath, eventId, fre, type }`.
- [ ] **OCR y extracción base**
  - [ ] Ejecutar OCR (Tesseract / Cloud Vision) si el PDF no es texto.
  - [ ] Persistir:
    - [ ] Texto plano.
    - [ ] Metadatos básicos (número de páginas, tamaño).
  - [ ] Enviar webhook a Convex con:
    - [ ] `gcsPath`, `text`, `pages`, `size`, `sourceSystem: "PJN-Portal"`, `pjnEventId`.

## Backend – Convex + LLM

- [ ] **Clasificación y metadatos**
  - [ ] Implementar acción que:
    - [ ] Reciba el webhook de `document-processor`.
    - [ ] Llame a un agente LLM con prompt similar al definido en el documento:
      - [ ] Entrada: texto OCR, contexto PJN.
      - [ ] Salida JSON con: tipo, tribunal, juez, fecha, partes, plazo, resumen.
  - [ ] Mapear salida a campos de `DOCUMENTS`:
    - [ ] `type`, `judge`, `court`, `date`, `parties`, `deadline`, `summary`.
- [ ] **Integración con plazos**
  - [ ] Si `deadline` está presente:
    - [ ] Delegar a módulo de **Alertas de plazos** para crear el `EVENTO` correspondiente.

## DB / Modelo de Datos

- [ ] Extender `DOCUMENTS` con campos específicos para PJN:
  - [ ] `sourceSystem: "PJN-Portal"`.
  - [ ] `pjnEventId`.
  - [ ] `documentType` (sentencia, providencia, notificación, cédula, otro).
  - [ ] `judge`, `court`, `decisionDate`, `deadline`, `summary`, `parties`.

## Frontend – Búsqueda y Filtros

- [ ] **Búsqueda avanzada**
  - [ ] Permitir filtros sobre:
    - [ ] Tipo de documento.
    - [ ] Juez.
    - [ ] Tribunal.
    - [ ] Rango de fechas.
  - [ ] Soporte para queries del tipo:
    - [ ] “Todas las resoluciones del Juez X en 2024”.
- [ ] **Detalle del documento**
  - [ ] Mostrar metadatos extraídos de forma clara:
    - [ ] Tipo, tribunal, juez, fecha, partes.
    - [ ] Plazos asociados y link al evento si existe.

## Integración con Otros Módulos

- [ ] Alimentar:
  - [ ] Módulo de plazos (Fase 2).
  - [ ] Módulo de auditoría (Fase 3).
  - [ ] Módulo de insights y riesgo (Fase 4).

## Criterios de Aceptación

- [ ] Los nuevos documentos PJN se clasifican automáticamente con un tipo coherente.
- [ ] Los metadatos clave están presentes y permiten filtros útiles en la UI.
- [ ] Cuando hay plazos en el documento, se crean eventos correctos en el calendario interno.


