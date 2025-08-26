import { ToolInput, ToolOutput } from "../ai-elements/tool";
import { CodeBlock } from "../ai-elements/code-block";

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

export function ToolCallDisplay({
  state,
  part,
}: {
  state: ToolState;
  part: ToolPart;
}) {
  console.log("ToolCallDisplay render", { state, part });
  // Get input (either from input field or legacy args field)
  const input = part.input || part.args;

  // Get output/result
  const output = part.output?.value || part.result;

  // Get error text
  const errorText = part.error;

  return (
    <div className="space-y-2">
      {/* Show input/parameters if available */}
      {input !== undefined && <ToolInput input={input} />}

      {/* Show output/result for successful calls */}
      {state === "result" && output !== undefined && (
        <ToolOutput output={formatOutput(output)} errorText={undefined} />
      )}

      {/* Show error for failed calls */}
      {state === "error" && errorText && (
        <ToolOutput output={null} errorText={errorText} />
      )}

      {/* Show loading state for ongoing calls */}
      {state === "call" && (
        <div className="p-4 text-xs text-muted-foreground">Ejecutando...</div>
      )}
    </div>
  );
}

// Helper function to format output in a user-friendly way
function formatOutput(output: unknown): React.ReactNode {
  if (typeof output === "string") {
    return (
      <div className="whitespace-pre-wrap break-words text-xs p-3">
        {output}
      </div>
    );
  }

  if (Array.isArray(output)) {
    return (
      <div className="space-y-2 p-3">
        {output.map((item, index) => (
          <div key={index} className="rounded border bg-background p-2 text-xs">
            {typeof item === "string" ? item : JSON.stringify(item, null, 2)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof output === "object" && output !== null) {
    return <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />;
  }

  return (
    <div className="whitespace-pre-wrap break-words text-xs p-3">
      {String(output)}
    </div>
  );
}
