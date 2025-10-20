import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Props for the CitationBadge component
 */
export interface CitationBadgeProps {
  id: string;
  citationType: string;
  onClick?: (id: string, type: string) => void;
}

/**
 * CitationBadge component that renders a clickable badge for citations
 * Displays different colors and labels based on citation type
 */
export function CitationBadge({ id, citationType, onClick }: CitationBadgeProps) {
  const getLabel = () => {
    switch (citationType) {
      case 'leg':
        return 'Ley';
      case 'doc':
        return 'Doc';
      case 'case-doc':
        return 'Caso';
      case 'fallo':
        return 'Fallo';
      default:
        return 'Fuente';
    }
  };

  const getColor = () => {
    switch (citationType) {
      case 'leg':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'doc':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'case-doc':
        return 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200';
      case 'fallo':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  return (
    <Badge
      className={cn(
        'ml-1 cursor-pointer transition-colors text-xs',
        getColor(),
        !onClick && 'cursor-default'
      )}
      onClick={onClick ? () => onClick(id, citationType) : undefined}
    >
      {getLabel()} {id.slice(-4)}
    </Badge>
  );
}

/**
 * Props for custom span elements that might be citations
 */
interface CustomSpanProps extends React.HTMLAttributes<HTMLSpanElement> {
  'data-citation-id'?: string;
  'data-citation-type'?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Creates custom React components for markdown rendering
 * Maps citation nodes (rendered as spans) to CitationBadge components
 * 
 * @param onCitationClick - Optional callback when a citation is clicked
 * @returns Component mapping object for use with markdown renderers
 */
export const createMarkdownComponents = (
  onCitationClick?: (id: string, type: string) => void
) => ({
  /**
   * Custom span renderer that checks for citation data attributes
   * If it's a citation span, render as CitationBadge
   * Otherwise, render as normal span
   */
  span: ({
    'data-citation-id': citationId,
    'data-citation-type': citationType,
    className,
    children,
    ...props
  }: CustomSpanProps) => {
    // Check if this span is a citation by looking for our data attributes
    const isCitation = className?.includes('citation') && citationId && citationType;

    if (isCitation) {
      return (
        <CitationBadge
          id={citationId}
          citationType={citationType}
          onClick={onCitationClick}
        />
      );
    }

    // Not a citation, render as regular span
    return (
      <span className={className} {...props}>
        {children}
      </span>
    );
  },
});
