interface LegacySummaryDisplayProps {
  summary: string;
}

export function LegacySummaryDisplay({ summary }: LegacySummaryDisplayProps) {
  // Extract content from <summary> tags if present
  const match = summary.match(/<summary>([\s\S]*)<\/summary>/);
  const content = match && match[1] ? match[1].trim() : summary;

  // Convert markdown-style headers to styled elements
  let formatted = content.replace(
    /^## (.+)$/gm,
    '<h3 class="text-lg font-semibold text-gray-900 mt-4 mb-2">$1</h3>',
  );
  formatted = formatted.replace(
    /^• (.+)$/gm,
    '<li class="ml-4 text-gray-700">$1</li>',
  );
  formatted = formatted.replace(
    /^\d+\. (.+)$/gm,
    '<li class="ml-4 text-gray-700 list-decimal">$1</li>',
  );
  formatted = formatted.replace(
    /^(?!<h3|<li)(.+)$/gm,
    '<p class="text-gray-700 mb-2">$1</p>',
  );

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
  );
}
