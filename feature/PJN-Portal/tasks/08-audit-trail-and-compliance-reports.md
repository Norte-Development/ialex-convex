# Pista de Auditoría PJN e Informes de Cumplimiento

## Objetivo

Implementar una **pista de auditoría completa** de todas las interacciones con el PJN y la generación de **informes de cumplimiento** (Acordada 31/2011, protección de datos), según la sección **10. Pista de Auditoría e Informes de Cumplimiento** de `docs/pjn-integration-features.md`.

## Alcance

- Registro detallado de logins, scrapes, descargas y presentaciones de escritos.
- Almacenamiento seguro y consultable de logs de auditoría.
- Generación de informes filtrables y exportables (PDF/CSV).

## Backend – Logging Estructurado

- [ ] **Definir modelo de auditoría**
  - [ ] Tabla/colección dedicada (si no se reutiliza `ACTIVITY_LOG`) con:
    - [ ] `userId`, `actionType`, `timestamp`, `ip`, `endpoint`, `caseFre`, `documentId`, `result`, `reason`.
- [ ] **Puntos de registro**
  - [ ] Login a PJN (manual y automático).
  - [ ] Scraping de eventos.
  - [ ] Scraping de expediente.
  - [ ] Descarga de documentos.
  - [ ] Presentación de escritos.
- [ ] **Estándares de logging**
  - [ ] No registrar contraseñas ni datos sensibles en claro.
  - [ ] Incluir identificadores suficientes para trazabilidad sin violar privacidad.

## Backend – Consultas e Informes

- [ ] **API de informes**
  - [ ] Queries filtrables por:
    - [ ] Rango de fechas.
    - [ ] Usuario.
    - [ ] Tipo de acción.
    - [ ] Caso / expediente FRE.
  - [ ] Paginar resultados para tablas de auditoría.
- [ ] **Generación de reporte**
  - [ ] Endpoint para exportar informe:
    - [ ] PDF (plantilla similar al ejemplo del documento).
    - [ ] CSV/Excel opcional.

## Frontend – UI de Auditoría

- [ ] **Página de auditoría**
  - [ ] Filtros por fecha, usuario, acción, caso.
  - [ ] Tabla de resultados:
    - [ ] Fecha/hora, acción, caso, resultado.
  - [ ] Acciones:
    - [ ] Exportar como PDF.
    - [ ] Exportar como CSV.
- [ ] **Resumen de cumplimiento**
  - [ ] Sección con check‑list tipo:
    - [ ] “Credenciales almacenadas de forma segura (AES‑256‑GCM)”.
    - [ ] “Accesos registrados y auditables”.
    - [ ] “Sin compartición de sesiones entre usuarios”.

## Integración con Otros Módulos

- [ ] Conectar con:
  - [ ] Gestión de credenciales (logins, fallos de auth).
  - [ ] Monitoreo de notificaciones y expediente (scrapes).
  - [ ] Presentación de escritos (acciones críticas).

## Criterios de Aceptación

- [ ] Cada interacción relevante con el PJN queda registrada con suficiente detalle para auditoría.
- [ ] Los administradores pueden generar informes por período y usuario.
- [ ] El reporte de cumplimiento refleja claramente cómo se cumplen los requisitos regulatorios clave.


