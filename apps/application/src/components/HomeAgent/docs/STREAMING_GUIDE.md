# 🔄 Guía de Streaming - HomeAgent

## 📋 Resumen

El sistema de streaming permite que las respuestas del agente aparezcan **palabra por palabra** en tiempo real, mejorando la UX y dando feedback inmediato al usuario.

---

## 🏗️ Arquitectura

### Backend (Convex)

**Archivo:** `convex/agents/home/streaming.ts`

```typescript
export const listMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs, // ← Clave para streaming
  },
  handler: async (ctx, args) => {
    const paginated = await agent.listMessages(ctx, {
      threadId,
      paginationOpts,
    });

    const streams = await agent.syncStreams(ctx, {
      threadId,
      streamArgs,
      includeStatuses: ["aborted", "streaming"],
    });

    return {
      ...paginated,
      streams, // ← Deltas del streaming
    };
  },
});
```

**Configuración del workflow:**
```typescript
// convex/agents/home/workflow.ts
await thread.streamText(
  { /* ... */ },
  {
    saveStreamDeltas: {
      chunking: "word",    // ← Palabra por palabra
      throttleMs: 50,      // ← Cada 50ms
    },
  }
);
```

### Frontend (React)

**Hook principal:** `useThreadMessages` de `@convex-dev/agent/react`

```typescript
import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react";
import { api } from "../../../convex/_generated/api";

const messagesResult = useThreadMessages(
  api.agents.home.streaming.listMessages,
  threadId ? { threadId } : "skip",
  {
    initialNumItems: 50,
    stream: true, // ← Habilita streaming
  }
);

const messages = toUIMessages(messagesResult.results || []);
```

---

## 🚀 Uso del Componente

### Opción 1: Componente Reutilizable

```tsx
import { HomeAgentChat } from "@/components/HomeAgent/HomeAgentChat";

function MyPage() {
  const [threadId, setThreadId] = useState<string>();

  return (
    <HomeAgentChat 
      threadId={threadId}
      initialNumItems={50}
    />
  );
}
```

### Opción 2: Implementación Manual

```tsx
import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react";
import { api } from "../../../convex/_generated/api";

function MyChat({ threadId }: { threadId?: string }) {
  const messagesResult = useThreadMessages(
    api.agents.home.streaming.listMessages,
    threadId ? { threadId } : "skip",
    {
      initialNumItems: 50,
      stream: true,
    }
  );

  const messages = toUIMessages(messagesResult.results || []);

  return (
    <div>
      {messages.map((msg: any) => (
        <div key={msg._id}>
          {msg.text || "..."}
        </div>
      ))}
    </div>
  );
}
```

---

## ⚙️ Configuración

### Parámetros Importantes

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `initialNumItems` | `5-50` | Mensajes iniciales a cargar |
| `stream` | `true` | Habilita streaming |
| `chunking` | `"word"` | Streaming palabra por palabra |
| `throttleMs` | `50` | Frecuencia de actualización (ms) |

### Detección de Streaming

El mensaje está streameando si:
- `message.status === "streaming"` o `"pending"`
- Edad del mensaje < 5 segundos
- Es un mensaje del assistant

```typescript
const messageAge = Date.now() - (message._creationTime || 0);
const isStreaming = messageAge < 5000 && message.role === "assistant";
```

---

## 🎨 Indicadores Visuales

### Indicador de Streaming

```tsx
{isStreaming && (
  <span className="text-blue-600 text-xs animate-pulse">
    🔄 Escribiendo...
  </span>
)}
```

### Mensaje con Streaming

```tsx
<div className={`message ${isStreaming ? 'streaming' : ''}`}>
  <div className="content">
    {messageText || "..."}
  </div>
  {isStreaming && <LoadingDots />}
</div>
```

---

## 🧪 Testing

### Test Manual

1. Navega a `/test-homeagent`
2. Tab "Streaming"
3. Crea o pega un threadId
4. Click "Test Long Message"
5. Observa el texto aparecer gradualmente

### Verificación

✅ **Streaming OK:**
- Texto aparece palabra por palabra
- Indicador 🔄 visible
- Velocidad ~50-100 chars/sec

❌ **Streaming FAIL:**
- Todo el texto aparece de golpe
- No hay indicador visual
- Velocidad > 500 chars/sec

---

## 🐛 Troubleshooting

### Problema: No aparece streaming

**Causa:** `stream: true` no está configurado

**Solución:**
```typescript
useThreadMessages(api.agents.home.streaming.listMessages, args, {
  stream: true, // ← Asegúrate de tener esto
})
```

### Problema: Mensajes vacíos

**Causa:** No estás usando `toUIMessages()`

**Solución:**
```typescript
const messages = toUIMessages(messagesResult.results || []);
```

### Problema: `page` está vacío

**Causa:** `initialNumItems` muy bajo o 0

**Solución:**
```typescript
{
  initialNumItems: 50, // Aumenta este valor
  stream: true,
}
```

---

## 📊 Performance

### Métricas Esperadas

- **Latencia inicial:** < 500ms
- **Velocidad streaming:** 50-100 chars/sec
- **Actualización UI:** Cada 50-100ms
- **Memoria:** ~1-2MB por conversación

### Optimizaciones

1. **Lazy loading:** Usa `initialNumItems` bajo (5-10) para carga rápida
2. **Virtualización:** Para threads con 100+ mensajes
3. **Debouncing:** En scroll automático durante streaming

---

## 🔗 Referencias

- **CaseAgent:** `src/components/CaseAgent/ChatContent.tsx` (implementación de referencia)
- **Backend:** `convex/agents/home/streaming.ts`
- **Workflow:** `convex/agents/home/workflow.ts`
- **Tests:** `src/components/HomeAgent/__tests__/streaming.test.tsx`

---

## ✅ Checklist de Implementación

- [ ] Backend tiene `listMessages` con `syncStreams`
- [ ] Workflow usa `saveStreamDeltas`
- [ ] Frontend usa `useThreadMessages` con `stream: true`
- [ ] Usa `toUIMessages()` para convertir mensajes
- [ ] Indicador visual de streaming
- [ ] Tests manuales pasando
- [ ] Performance aceptable (< 100ms updates)

---

## 💡 Tips

1. **Siempre usa `toUIMessages()`** - Convierte al formato correcto
2. **`initialNumItems: 5`** - Para carga rápida inicial
3. **Detecta streaming por edad** - `messageAge < 5000`
4. **Scroll automático** - Durante streaming para mejor UX
5. **Indicador visual** - Feedback claro al usuario

---

**Última actualización:** 2025-10-09
