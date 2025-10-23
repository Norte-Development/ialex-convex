# 🎨 Sistema de Skeletons

## 📖 Guía Rápida para Agregar Skeletons a Nuevas Páginas

### 1️⃣ Crear el Skeleton Component

```tsx
// src/components/[TuPagina]/Skeletons/TuPaginaSkeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

export function TuPaginaSkeleton() {
  return (
    <div className="tu-estructura-aqui">
      {/* Replica la estructura visual exacta de tu página */}
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-48" />
      {/* etc... */}
    </div>
  );
}
```

### 2️⃣ Registrar en AuthLoadingSkeleton

```tsx
// src/components/AuthLoadingSkeleton.tsx
import { TuPaginaSkeleton } from "@/components/[TuPagina]/Skeletons";

// Agregar en getSkeleton():
if (path === "/tu-ruta" || path.startsWith("/tu-ruta")) {
  return <TuPaginaSkeleton />;
}
```

### 3️⃣ Registrar en RouteSuspense

```tsx
// src/components/RouteSuspense.tsx
import { TuPaginaSkeleton } from "@/components/[TuPagina]/Skeletons";

// Agregar en getSkeleton():
if (path === "/tu-ruta" || path.startsWith("/tu-ruta")) {
  return <TuPaginaSkeleton />;
}
```

### 4️⃣ (Opcional) Skeleton para Datos Internos

Si tu componente carga datos con `useQuery`:

```tsx
// En tu componente:
const data = useQuery(api.functions.getData, {});
const isLoading = data === undefined;

if (isLoading) {
  return <TuComponenteSkeleton />;
}
```

---

## 🎯 Niveles de Loading

```
1. AuthLoading → AuthLoadingSkeleton  (Convex auth init)
2. RouteSuspense                      (React lazy loading)
3. Componente interno                 (Data loading con useQuery)
```

## 💡 Tips

- **Replica exactamente** la estructura HTML/Tailwind de tu página
- Usa `Skeleton` de shadcn: `<Skeleton className="h-[altura] w-[ancho]" />`
- Para listas: `{[1,2,3].map(i => <Skeleton key={i} ... />)}`
- Usa las mismas clases de layout: `grid`, `flex`, `gap`, etc.

## 📁 Estructura Recomendada

```
src/components/
├── MiPagina/
│   ├── Skeletons/
│   │   ├── index.ts              # exports
│   │   ├── MiPaginaSkeleton.tsx
│   │   └── MiComponenteSkeleton.tsx
│   └── MiComponente.tsx
```
