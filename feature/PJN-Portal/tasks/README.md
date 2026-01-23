PJN Portal Integration – Task Breakdown
======================================

This directory contains the **implementation task breakdown** for the PJN Portal integration, split out from `docs/pjn-integration-features.md`.

The original document defines 10 major capabilities plus an overall architecture and phased roadmap. Here we map those into concrete, implementation-ready task documents grouped by phase.

Source document:
- `docs/pjn-integration-features.md`

Phases and Task Files
---------------------

**Fase 1 (MVP – 4‑6 semanas)**
- `01-monitoring-notifications.md` – Monitoreo e ingesta automática de notificaciones (Feature #1)
- `02-credentials-management.md` – Gestión segura de credenciales y salud de sesión (Feature #9)
- `03-case-discovery-and-linking.md` – Descubrimiento inteligente de casos y auto‑vinculación (Feature #2)

**Fase 2 (Funcionalidades Core – 6‑8 semanas)**
- `04-docket-sync.md` – Sincronización completa del expediente del caso (Feature #3)
- `05-deadlines-and-hearings-alerts.md` – Alertas proactivas de plazos y audiencias (Feature #5)
- `06-document-classification-and-metadata.md` – Clasificación de documentos y extracción de metadatos (Feature #4)

**Fase 3 (Avanzadas – 8‑10 semanas)**
- `07-multi-account-and-team-aggregation.md` – Agregación multi‑cuenta y de casos de equipo (Feature #7)
- `08-audit-trail-and-compliance-reports.md` – Pista de auditoría e informes de cumplimiento (Feature #10)
- `09-escritos-filing-integration.md` – Integración bidireccional de presentación de escritos (Feature #6)

**Fase 4 (Potenciadas por IA – 10‑12 semanas)**
- `10-risk-prediction-and-insights.md` – Predicción inteligente de estado de casos y alertas de riesgo (Feature #8)

How to Use This Directory
-------------------------

- Cada archivo describe:
  - **Objetivo y alcance concreto** de la funcionalidad.
  - **Flujos técnicos** relevantes (resumidos del documento original).
  - **Tareas backend (Convex, Cloud Run, GCS, document-processor)**.
  - **Tareas frontend / UI** en la aplicación principal.
  - **Dependencias y riesgos**.
  - **Criterios de aceptación**.
- A medida que se implementa cada funcionalidad, los checklists dentro de cada archivo se pueden ir marcando y extendiendo según sea necesario.


