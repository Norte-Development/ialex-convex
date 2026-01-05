# Popups (Marketing) — Guía rápida

## ¿Qué es?

Sistema de popups “marketing” administrables desde el dashboard (CRUD) y mostrados en la Home según reglas (audiencia, fechas, frecuencia, etc.).

## Dónde se guardan las cosas

### Tablas (Convex)

- `popups` (definida en `apps/application/convex/schema.ts`)
  - Contenido: `key`, `title`, `body`, `template` (hoy: `simple`), `enabled`
  - Targeting/reglas: `audience`, `startAt`, `endAt`, `showAfterDays`, `frequencyDays`, `maxImpressions`, `priority`
  - Auditoría: `createdAt/updatedAt`, `createdBy/updatedBy`

- `popupViews` (definida en `apps/application/convex/schema.ts`)
  - Un registro por `userId + popupId`
  - Tracking: `impressions`, `firstShownAt`, `lastShownAt`
  - Cierre: `dismissedAt` (si existe, ese usuario **no** vuelve a ver ese popup)

## Cómo decide cuál mostrar (cuando hay varios)

Esto se decide **en el backend**:

- `apps/application/convex/functions/popups.ts` → `getActivePopupForUser`
  - Filtra popups por:
    - `enabled`
    - `startAt/endAt` (vigencia)
    - `audience` (free/trial/all)
    - `showAfterDays` (antigüedad de cuenta)
    - `dismissedAt` (si lo cerraste, no vuelve)
    - `maxImpressions` (límite de impresiones)
    - `frequencyDays` (mínimo de días entre apariciones)
  - Si quedan varios elegibles: ordena por `priority` (desc) y luego `updatedAt` (desc) y devuelve **1 solo**.

## Dónde se muestra en el frontend

- Home:
  - `apps/application/src/pages/home/HomePage.tsx`
  - Monta:
    - `MarketingPopUp` (dinámico, viene de Convex)
    - legacy: `BlackFridayPopup` y `FreemiumUpgradePopup`

### Componente dinámico

- `apps/application/src/features/popups/MarketingPopUp.tsx`
  - Consulta `getActivePopupForUser`
  - Al abrir: llama `recordPopupImpression(popupId)`
  - Al cerrar: llama `dismissPopup(popupId)`

### Hook

- `apps/application/src/hooks/useMarketingPopup.ts`
  - Wrapper del query/mutations:
    - `getActivePopupForUser`
    - `recordPopupImpression`
    - `dismissPopup`

## “Solo uno a la vez” (evitar 2 popups juntos)

- `apps/application/src/features/popups/PopupGate.tsx`
  - `PopupGateProvider` + `usePopupGate()`
  - Es un “lock” en memoria (`activeKey`) para que **solo un Dialog** pueda estar abierto.
  - Los legacy y el marketing lo respetan.

## Panel admin (CRUD)

- Página:
  - `apps/application/src/pages/AdminPopupsPage.tsx`
- Componentes:
  - `apps/application/src/features/popups/PopupFormDialog.tsx`
  - `apps/application/src/features/popups/PopupsTable.tsx`
  - Confirmación de borrado:
    - `apps/application/src/features/popups/DeletePopupConfirmation.tsx`

- Backend (CRUD):
  - `apps/application/convex/functions/popups.ts`
    - `listPopupsAdmin`, `createPopupAdmin`, `updatePopupAdmin`, `setPopupEnabledAdmin`, `deletePopupAdmin`
  - Nota: la protección server-side por org está temporalmente desactivada en estas funciones (se confía en el guard del frontend).

## Cómo testear rápido

### Caso simple: quiero que aparezca sí o sí

1. En `/admin/popups` creá un popup con:

- `enabled = true`
- `audience = all`
- sin `startAt/endAt`
- `priority` alto

2. Entrá a Home.

### Resetear para volver a verlo

- En Convex Dashboard (Data):
  - Borra el registro en `popupViews` para tu `userId + popupId`, o
  - Setea `dismissedAt` vacío y ajusta `lastShownAt` si `frequencyDays` te lo bloquea.

## Troubleshooting (lo típico)

- “Se muestra 1 segundo y se cierra”: suele pasar si el popup deja de ser elegible tras registrar impresión (por `frequencyDays`). `MarketingPopUp` congela el popup una vez abierto para evitarlo.
- “No aparece ningún popup”:
  - Revisar `enabled`, `startAt/endAt`, `audience`
  - Revisar `popupViews.dismissedAt`, `maxImpressions`, `frequencyDays`
- “No aparece el legacy después del marketing”:
  - Los legacy reintentan abrir cuando el `PopupGate` queda libre (`activeKey` cambia).
