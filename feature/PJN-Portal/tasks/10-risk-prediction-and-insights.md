# Predicción Inteligente de Riesgo e Insights de Casos PJN

## Objetivo

Usar los datos históricos del expediente y documentos del caso, combinados con análisis LLM, para **predecir riesgos procesales y sugerir próximas acciones**, según la sección **8. Predicción Inteligente de Estado de Casos y Alertas de Riesgo** de `docs/pjn-integration-features.md`.

## Alcance

- Análisis periódico de la línea de tiempo del caso (expediente + actividades internas).
- Detección de patrones inusuales (demoras, ráfagas de actividad, etc.).
- Generación de alertas de riesgo y recomendaciones accionables para el abogado.

## Flujo Técnico (resumen)

- Expediente + timeline del caso actualizados → módulo de análisis → llamada a LLM con contexto del caso y patrones históricos → respuesta estructurada con riesgos, plazos perdidos, próximas acciones sugeridas, estimación de resolución.

## Backend – Agregación de Datos del Caso

- [ ] **Construcción de la línea de tiempo enriquecida**
  - [ ] Unificar datos de:
    - [ ] `ACTIVITY_LOG` (movimientos PJN y acciones internas).
    - [ ] `DOCUMENTS` (tipos de documentos, decisiones, plazos).
    - [ ] `EVENTOS` (plazos y audiencias).
  - [ ] Agregar metadatos clave:
    - [ ] Fechas, tipos de movimiento, estado actual del caso.

## Backend – LLM de Análisis

- [ ] **Definir prompt y contrato de salida**
  - [ ] Basarse en el ejemplo de “Prompt de Análisis LLM” del documento:
    - [ ] Entradas:
      - [ ] Identificador de caso (FRE, tipo).
      - [ ] Línea de tiempo simplificada (lista de eventos relevantes).
      - [ ] Estado actual y fechas clave (último movimiento, hoy).
    - [ ] Salida esperada:
      - [ ] Riesgos procesales identificados.
      - [ ] Plazos perdidos o en riesgo.
      - [ ] Próximas acciones recomendadas.
      - [ ] Línea de tiempo estimada de resolución.
- [ ] **Implementar acción de análisis**
  - [ ] Action Convex que:
    - [ ] Ensambla el contexto del caso.
    - [ ] Llama al agente LLM.
    - [ ] Guarda resultado en una colección `CASE_INSIGHTS` o similar.

## Backend – Scheduling

- [ ] **Análisis periódico**
  - [ ] Cron (ej. diario o semanal) que:
    - [ ] Analice casos activos.
    - [ ] Priorice casos con:
      - [ ] Movimientos recientes importantes.
      - [ ] Largos períodos de inactividad.
- [ ] **Análisis on‑demand**
  - [ ] Permitir que el usuario dispare análisis desde la UI del caso.

## Frontend – UI de Insights

- [ ] **Panel de insights del caso**
  - [ ] Mostrar:
    - [ ] Lista de riesgos detectados con severidad.
    - [ ] Plazos próximos o ya vencidos identificados por el análisis.
    - [ ] Sugerencias de acción (texto claro, accionable).
    - [ ] Estimación de horizonte temporal del caso (si aplica).
- [ ] **Alertas**
  - [ ] Notificaciones cuando el análisis detecte:
    - [ ] Alto riesgo de plazo perdido.
    - [ ] Estancamiento del caso.

## Consideraciones de Calidad y Ética

- [ ] Incluir disclaimers visibles:
  - [ ] “Estas son sugerencias generadas por IA y no constituyen asesoramiento legal.”
- [ ] Permitir que el usuario:
  - [ ] Marque insights como útiles/no útiles para retroalimentación futura.

## Criterios de Aceptación

- [ ] Para casos con historial representativo, el sistema genera insights comprensibles y accionables.
- [ ] Los abogados pueden ver y revisar estos insights en la UI del caso.
- [ ] Los riesgos críticos (ej. plazos en riesgo) se destacan y notifican apropiadamente.


