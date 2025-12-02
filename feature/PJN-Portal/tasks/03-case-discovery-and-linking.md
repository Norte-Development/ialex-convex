# Descubrimiento Inteligente de Casos y Auto‑Vinculación

## Objetivo

Implementar el flujo de **descubrimiento de casos desde eventos PJN** y su **emparejamiento con casos y clientes internos**, según la sección **2. Descubrimiento Inteligente de Casos y Auto‑Vinculación** de `docs/pjn-integration-features.md`.

## Alcance

- Detectar casos PJN nuevos al procesar eventos.
- Crear casos en iAlex cuando no existan y/o vincularlos a `CASES` existentes por FRE.
- Emparejar partes del PJN con `CLIENTS` internos (por DNI y por similitud de nombre).
- Generar sugerencias para revisión manual cuando la confianza del emparejamiento sea baja.

## Flujo Técnico (resumen)

- Evento PJN → extracción de FRE, descripción, roles/partes → búsqueda/match en `CASES` y `CLIENTS` → creación/actualización de `CASES` y `CLIENT_CASES` → notificación al usuario.

## Backend – Algoritmo de Emparejamiento

- [ ] **Extracción de metadatos del evento**
  - [ ] A partir del payload del evento/documento PJN:
    - [ ] Extraer FRE completo (e.g. `FRE 7262/2025/CFC1`).
    - [ ] Extraer texto crudo de partes (por ejemplo “IMPUTADO: SOSA, ARIEL ALBERTO”).
- [ ] **Normalización de nombres**
  - [ ] Parsear: apellido, nombre(s).
  - [ ] Normalizar mayúsculas, tildes, espacios.
- [ ] **Búsqueda en `CLIENTS`**
  - [ ] Si hay DNI explícito → coincidencia exacta por DNI (confianza ALTA).
  - [ ] Si no hay DNI → coincidencia difusa por nombre:
    - [ ] Distancia Levenshtein o similar con umbral configurable (ej. < 3).
    - [ ] Ranking de candidatos y cálculo de score.
- [ ] **Decisión**
  - [ ] Si score ≥ umbral alto → auto‑vincular cliente.
  - [ ] Si score medio → generar sugerencias para aprobación manual.
  - [ ] Si score bajo → marcar como “requiere revisión”.

## Backend – Creación / Vinculación de Casos

- [ ] **Detección de casos existentes**
  - [ ] Buscar en `CASES` por `fre` o `externalCaseId` mapeado desde PJN.
  - [ ] Si existe → vincular evento/actividad al caso.
- [ ] **Creación de nuevo caso**
  - [ ] Si no existe caso:
    - [ ] Crear registro en `CASES` con:
      - [ ] `fre`, descripción básica, tribunal, URL SCW (si disponible).
      - [ ] Estado y prioridad inicial razonables.
    - [ ] Crear vínculos `CLIENT_CASES` con clientes emparejados.
    - [ ] Generar entrada en `ACTIVITY_LOG` indicando “pjn_case_discovered”.

## Frontend – UX de Emparejamiento

- [ ] **Sugerencias de clientes**
  - [ ] Pantalla/modal que muestre:
    - [ ] Partes PJN extraídas.
    - [ ] Lista de clientes candidatos con score y datos clave (nombre, DNI).
  - [ ] Acciones:
    - [ ] Confirmar vinculación a cliente existente.
     - [ ] Crear nuevo cliente desde la parte PJN.
- [ ] **Alertas de brechas de cobertura**
  - [ ] Listado de “Casos PJN no rastreados en iAlex” para que el usuario decida:
    - [ ] Crear caso interno.
    - [ ] Ignorar / posponer.

## DB / Modelo de Datos

- [ ] Campos adicionales recomendados:
  - [ ] En `CASES`: `fre`, `externalCaseId`, `pjnStatus`, `scwUrl`.
  - [ ] En `CLIENT_CASES`: metadatos de origen (`sourceSystem: "PJN-Portal"`).
  - [ ] En `ACTIVITY_LOG`: `action: "pjn_case_discovered"`, `pjnEventId`, `confidenceScore`.

## Integración con Otros Módulos

- [ ] Integrar con la **sync de notificaciones**:
  - [ ] Cada nuevo evento debe pasar por este pipeline de descubrimiento/emparejamiento cuando detecta FRE desconocido.
- [ ] Preparar datos para la **sync de expediente**:
  - [ ] Guardar `scwUrl` y claves necesarias para consulta posterior en SCW.

## Criterios de Aceptación

- [ ] Los casos PJN nuevos se detectan y aparecen en iAlex con FRE y metadatos básicos.
- [ ] Las partes relevantes se asocian automáticamente a clientes internos cuando hay coincidencia fuerte.
- [ ] La UI permite resolver manualmente los casos ambiguos (sugerencias y creación de nuevos clientes).
- [ ] Se mantiene un registro de qué casos y clientes fueron auto‑vinculados vs revisados manualmente.


