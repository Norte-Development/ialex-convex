# Agregación Multi‑Cuenta PJN y Casos de Equipo

## Objetivo

Implementar la **agregación de notificaciones y casos a través de múltiples cuentas PJN** dentro de un mismo estudio, con control de acceso basado en equipos, según la sección **7. Agregación Multi‑Cuenta y de Casos de Equipo** de `docs/pjn-integration-features.md`.

## Alcance

- Soporte para múltiples credenciales PJN por estudio (uno por abogado).
- Scraping paralelo de cuentas y consolidación de eventos/casos.
- Reglas de asignación de casos a equipos y abogados.
- Dashboard administrativo con vistas por abogado, equipo y tribunal.

## Backend – Cuentas y Sincronización

- [ ] **Modelo de cuentas PJN**
  - [ ] Asegurar que la estructura soporte múltiples cuentas por organización:
    - [ ] Relación usuario ↔ credenciales PJN.
  - [ ] Asociar cada cuenta a:
    - [ ] Usuario.
    - [ ] Equipos relevantes (si aplica).
- [ ] **Scraping paralelo**
  - [ ] El cron de notificaciones debe:
    - [ ] Iterar sobre todas las cuentas PJN activas.
    - [ ] Ejecutar sync en paralelo (con límites de concurrencia).
  - [ ] Consolidar resultados en:
    - [ ] `ACTIVITY_LOG`.
    - [ ] `DOCUMENTS`.
    - [ ] `CASES`.

## Backend – Reglas de Acceso y Asignación

- [ ] **Casos compartidos entre cuentas PJN**
  - [ ] Detectar cuando un mismo FRE aparece en más de una cuenta.
  - [ ] Aplicar reglas:
    - [ ] Múltiples abogados con acceso al mismo caso.
    - [ ] Herencia de acceso a través de `TEAM_CASE_ACCESS`.
- [ ] **Asignación de dueño del caso**
  - [ ] Para casos nuevos:
    - [ ] Asignar inicialmente al dueño de la cuenta PJN que lo descubrió.
    - [ ] Permitir reasignación manual en la UI.

## Frontend – Dashboard de Administración

- [ ] **Vistas principales**
  - [ ] Vista por abogado:
    - [ ] Casos activos por abogado.
    - [ ] Plazos próximos por abogado.
  - [ ] Vista por equipo:
    - [ ] Casos por equipo (Corporate, Penal, etc.).
    - [ ] Plazos próximos por equipo.
  - [ ] Vista por tribunal:
    - [ ] Casos agrupados por tribunal/cámara.
  - [ ] Vista de alertas:
    - [ ] Plazos esta semana.
    - [ ] Acciones vencidas.
    - [ ] Fallos de autenticación.
- [ ] **Casos no asignados**
  - [ ] Listado de casos PJN detectados que aún no fueron asignados a un equipo/abogado interno.

## Integración con Equipos y Permisos

- [ ] Revisar/usar las tablas existentes:
  - [ ] `TEAMS`, `TEAM_MEMBERSHIPS`, `TEAM_CASE_ACCESS`.
- [ ] Asegurar que:
  - [ ] El acceso a casos PJN respete los mismos modelos de permisos que otros casos.
  - [ ] Los dashboards solo muestren datos a usuarios con privilegios adecuados (ej. admin del estudio).

## Criterios de Aceptación

- [ ] Un estudio con múltiples abogados y credenciales PJN ve en un solo lugar todos los casos y notificaciones agregados.
- [ ] El dashboard permite identificar carga de trabajo por abogado/equipo y plazos críticos.
- [ ] Los permisos de acceso respetan la configuración de equipos existente en iAlex.


