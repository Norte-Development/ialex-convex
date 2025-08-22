import { useMemo, useState } from "react";
import {
  Search,
  FileText,
  Code,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Dot,
} from "lucide-react";

type ToolState = "call" | "result" | "error" | string;

type ToolPart = {
  input?: unknown;
  output?: {
    type: string;
    value: unknown;
  };
  error?: string;
  toolCallId?: string;
  startedAt?: string | number | Date;
  completedAt?: string | number | Date;
  // Legacy support
  args?: unknown;
  result?: unknown;
};

const PREVIEW = {
  json: 600, // compact preview chars
  string: 240, // compact string preview
  arrayItems: 3, // few items only
};

function formatIdSuffix(id?: string) {
  if (!id) return "—";
  return id.slice(-6);
}

function isPlainObject(v: unknown) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeStringify(value: unknown, max = PREVIEW.json) {
  try {
    const s = JSON.stringify(value, null, 2);
    if (s.length <= max) return { text: s, truncated: false };
    return { text: s.slice(0, max) + "…", truncated: true };
  } catch {
    return { text: String(value), truncated: false };
  }
}

function getToolIcon(name: string) {
  switch (name.toLowerCase()) {
    case "searchlegislation":
    case "searchfallos":
      return <Search className="w-3.5 h-3.5" />;
    case "searchcasedocuments":
    case "searchCaseDocuments":
    case "readdocument":
    case "readDocument":
    case "querydocument":
    case "queryDocument":
    case "listcasedocuments":
    case "listCaseDocuments":
      return <FileText className="w-3.5 h-3.5" />;
    case "editescrito":
    case "getEscrito":
      return <Code className="w-3.5 h-3.5" />;
    default:
      return <Code className="w-3.5 h-3.5" />;
  }
}

function getToolDisplayName(name: string) {
  switch (name.toLowerCase()) {
    case "searchlegislation":
      return "Búsqueda Legislación";
    case "searchfallos":
      return "Búsqueda Fallos";
    case "searchcasedocuments":
      return "Búsqueda Documentos";
    case "readdocument":
      return "Leer Documento";
    case "querydocument":
      return "Consultar Documento";
    case "listcasedocuments":
      return "Listar Documentos";
    case "editescrito":
      return "Editar Escrito";
    case "getescrito":
      return "Obtener Escrito";
    default:
      return name;
  }
}

function StatusDot({ state }: { state: ToolState }) {
  const cls =
    state === "result"
      ? "text-emerald-600"
      : state === "error"
      ? "text-red-600"
      : "text-sky-600";
  return <Dot className={`w-4 h-4 ${cls}`} />;
}

function CollapseTiny({
  labelCollapsed,
  labelExpanded,
  children,
  defaultOpen = false,
}: {
  labelCollapsed: string;
  labelExpanded: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] text-sky-700 hover:text-sky-900 underline"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {open ? labelExpanded : labelCollapsed}
      </button>
      {open && <div className="mt-1.5">{children}</div>}
    </div>
  );
}

function Row({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded border ${
        muted ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"
      } p-2`}
    >
      {children}
    </div>
  );
}

export function ToolCallDisplay({
  toolName,
  state,
  part,
}: {
  toolName: string;
  state: ToolState;
  part: ToolPart;
}) {
  const idSuffix = useMemo(
    () => formatIdSuffix(part.toolCallId),
    [part.toolCallId]
  );

  const title = getToolDisplayName(toolName);
  const icon = getToolIcon(toolName);

  const headerRight =
    state === "call" ? (
      <div className="flex items-center gap-1 text-[11px] text-sky-700">
        <Loader2 className="w-3 h-3 animate-spin" />
        En curso
      </div>
    ) : state === "result" ? (
      <div className="text-[11px] text-emerald-700">Listo</div>
    ) : state === "error" ? (
      <div className="flex items-center gap-1 text-[11px] text-red-700">
        <AlertTriangle className="w-3 h-3" />
        Error
      </div>
    ) : (
      <div className="text-[11px] text-gray-600">{state}</div>
    );

  return (
    <div className="mt-1.5 rounded-md border border-gray-200 bg-white">
      {/* Header: ultra-compact */}
      <div className="px-2 py-1.5 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <StatusDot state={state} />
          <div className="text-[12px] font-medium text-gray-900 flex items-center gap-1.5">
            <span className="text-gray-700">{icon}</span>
            {title}
          </div>
        </div>
        {headerRight}
      </div>

      {/* Body: collapsed by default, minimal previews */}
      <div className="p-2 space-y-1.5 text-[12px] text-gray-800">
        {state === "error" && part.error && (
          <Row muted>
            <div className="text-red-800 whitespace-pre-wrap">{part.error}</div>
          </Row>
        )}

        {(part.input !== undefined || part.args !== undefined) && (
          <MiniJsonPreview
            label="Parámetros"
            value={part.input || part.args}
            muted
            collapsed
          />
        )}

        {state === "result" && (part.output?.value !== undefined || part.result !== undefined) && (
          <MiniResultPreview result={part.output?.value || part.result} />
        )}

        {state === "call" && (
          <div className="text-[11px] text-gray-600">Ejecutando…</div>
        )}
      </div>
    </div>
  );
}

function MiniResultPreview({ result }: { result: unknown }) {
  // Strings
  if (typeof result === "string") {
    const long = result.length > PREVIEW.string;
    const preview = long ? result.slice(0, PREVIEW.string) + "…" : result;
    return (
      <Row>
        <div className="whitespace-pre-wrap break-words">{preview}</div>
        {long && (
          <div className="mt-1">
            <CollapseTiny
              labelCollapsed="Ver más"
              labelExpanded="Ocultar"
            >
              <pre className="text-[12px] whitespace-pre-wrap break-words">
                {result}
              </pre>
            </CollapseTiny>
          </div>
        )}
      </Row>
    );
  }

  // Arrays
  if (Array.isArray(result)) {
    const previewItems = result.slice(0, PREVIEW.arrayItems);
    const remaining = Math.max(0, result.length - previewItems.length);
    return (
      <Row>
        <div className="space-y-1">
          {previewItems.map((item, i) => (
            <div
              key={i}
              className="rounded border border-gray-100 bg-gray-50 p-1.5"
            >
              <MiniInline value={item} />
            </div>
          ))}
          {remaining > 0 && (
            <div className="text-[11px] text-gray-600">
              … y {remaining} más
            </div>
          )}
          {result.length > PREVIEW.arrayItems && (
            <CollapseTiny
              labelCollapsed="Ver todos"
              labelExpanded="Ocultar"
            >
              <div className="mt-1 space-y-1">
                {result.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-gray-100 bg-white p-1.5"
                  >
                    <MiniInline value={item} />
                  </div>
                ))}
              </div>
            </CollapseTiny>
          )}
        </div>
      </Row>
    );
  }

  // Objects
  if (isPlainObject(result)) {
    return <MiniJsonPreview label="Resultado" value={result} collapsed />;
  }

  // Fallback
  return (
    <Row>
      <div className="whitespace-pre-wrap break-words">{String(result)}</div>
    </Row>
  );
}

function MiniInline({ value }: { value: unknown }) {
  if (typeof value === "string") {
    const long = value.length > 200;
    const text = long ? value.slice(0, 200) + "…" : value;
    return (
      <pre className="text-[12px] whitespace-pre-wrap break-words">{text}</pre>
    );
  }
  if (isPlainObject(value) || Array.isArray(value)) {
    const { text, truncated } = safeStringify(value, 300);
    return (
      <pre className="text-[11px] whitespace-pre-wrap break-words">
        {text}
        {truncated && " (…)"}
      </pre>
    );
  }
  return (
    <pre className="text-[12px] whitespace-pre-wrap break-words">
      {String(value)}
    </pre>
  );
}

function MiniJsonPreview({
  label,
  value,
  muted,
  collapsed = true,
}: {
  label: string;
  value: unknown;
  muted?: boolean;
  collapsed?: boolean;
}) {
  const { text, truncated } = useMemo(
    () => safeStringify(value, PREVIEW.json),
    [value]
  );

  const body = (
    <div className="text-[11px]">
      <pre className="whitespace-pre-wrap break-words">{text}</pre>
    </div>
  );

  return (
    <Row muted={muted}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] font-medium text-gray-700">{label}</div>
        <div className="ml-2">
          {(truncated || collapsed) && (
            <CollapseTiny
              labelCollapsed="Ver más"
              labelExpanded="Ocultar"
              defaultOpen={!collapsed && !truncated}
            >
              <pre className="text-[11px] whitespace-pre-wrap break-words">
                {JSON.stringify(value, null, 2)}
              </pre>
            </CollapseTiny>
          )}
        </div>
      </div>
      {body}
    </Row>
  );
}