# 📅 Guía de Uso: CreateEventDialog

## 🎯 Diferentes formas de crear eventos

### **1. Evento Personal (desde /eventos)**
```tsx
// En EventosPage.tsx
<CreateEventDialog showCaseSelector showTeamSelector />
```
**Resultado:** El usuario puede elegir vincular a un caso o equipo, o dejarlo como evento personal.

---

### **2. Evento de Caso (desde CaseSideBar o CaseDetailPage)**
```tsx
// En CaseSideBar.tsx o cualquier página de caso
import CreateEventDialog from "@/components/eventos/CreateEventDialog";
import { useCase } from "@/context/CaseContext";

const { currentCase } = useCase();

<CreateEventDialog caseId={currentCase?._id} />
```
**Resultado:** El evento se crea automáticamente vinculado al caso actual. No muestra selector.

---

### **3. Evento de Equipo (desde TeamManagePage)**
```tsx
// En TeamManagePage.tsx
import CreateEventDialog from "@/components/eventos/CreateEventDialog";

const { id } = useParams(); // teamId

<CreateEventDialog teamId={id} />
```
**Resultado:** El evento se crea automáticamente vinculado al equipo. No muestra selector.

---

### **4. Evento Flexible (con selectores opcionales)**
```tsx
// Desde cualquier página donde quieras dar opciones
<CreateEventDialog showCaseSelector showTeamSelector />
```
**Resultado:** Muestra selectores para elegir caso y/o equipo. El usuario puede:
- Vincular a un caso
- Vincular a un equipo
- Dejarlo como personal (sin vincular)

---

## 📋 Props del componente

```typescript
interface CreateEventDialogProps {
  caseId?: string;              // ID del caso (pre-seleccionado)
  teamId?: string;              // ID del equipo (pre-seleccionado)
  showCaseSelector?: boolean;   // Mostrar selector de casos
  showTeamSelector?: boolean;   // Mostrar selector de equipos
}
```

---

## 🎨 Ejemplos de implementación

### **Ejemplo 1: Agregar a CaseSideBar**

```tsx
// En CaseSideBar.tsx, agregar sección de eventos

import CreateEventDialog from "@/components/eventos/CreateEventDialog";
import { useCase } from "@/context/CaseContext";

const { currentCase } = useCase();

// Dentro del componente, agregar:
<Collapsible>
  <CollapsibleTrigger className="flex items-center gap-2 w-full">
    <Calendar size={16} />
    <span>Eventos del Caso</span>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="pl-4 py-2">
      <CreateEventDialog caseId={currentCase?._id} />
    </div>
  </CollapsibleContent>
</Collapsible>
```

---

### **Ejemplo 2: Agregar a CaseDetailPage**

```tsx
// En CaseDetailPage.tsx

import CreateEventDialog from "@/components/eventos/CreateEventDialog";
import { useCase } from "@/context/CaseContext";

const { currentCase } = useCase();

// Agregar botón en el header o en una sección
<div className="flex gap-2">
  <CreateEventDialog caseId={currentCase?._id} />
  {/* Otros botones */}
</div>
```

---

### **Ejemplo 3: Agregar a TeamManagePage**

```tsx
// En TeamManagePage.tsx

import CreateEventDialog from "@/components/eventos/CreateEventDialog";
import { useParams } from "react-router-dom";

const { id } = useParams(); // teamId

// Agregar en la sección de acciones
<div className="flex gap-2">
  <CreateEventDialog teamId={id} />
  <Button>Agregar Miembro</Button>
</div>
```

---

## 🔄 Flujo de creación

1. **Usuario abre el dialog**
2. **Llena el formulario:**
   - Título (requerido)
   - Tipo de evento (requerido)
   - Fechas y horarios (requeridos)
   - Caso/Equipo (si aplica)
   - Ubicación, URL, notas (opcionales)
3. **Click en "Crear Evento"**
4. **Backend valida permisos:**
   - Si es evento de caso → verifica acceso "basic" al caso
   - Si es evento de equipo → verifica membership
   - Si es personal → solo verifica autenticación
5. **Evento creado exitosamente**
6. **Usuario agregado como organizador automáticamente**

---

## ✅ Permisos automáticos

Cuando se crea un evento:
- El creador se agrega automáticamente como **organizador**
- El organizador puede:
  - Editar el evento
  - Cambiar estado
  - Agregar/remover participantes
  - Eliminar el evento

---

## 🎯 Próximas mejoras sugeridas

1. **Agregar participantes al crear** - Selector de usuarios para invitar
2. **Templates de eventos** - Eventos predefinidos (audiencia, plazo, etc.)
3. **Duplicar evento** - Crear evento basado en uno existente
4. **Eventos recurrentes** - Repetir eventos semanalmente/mensualmente
