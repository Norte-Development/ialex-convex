'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CitationParserProps {
  text: string;
  onCitationClick?: (id: string, type: string) => void;
}

const CITATION_PATTERN = /\[CIT:([^:]+):([^\]]+)\]/g;

export function CitationParser({ text, onCitationClick }: CitationParserProps) {
  const parsedContent = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = CITATION_PATTERN.exec(text)) !== null) {
      const [fullMatch, citationId, citationType] = match;
      const startIndex = match.index;
      const endIndex = startIndex + fullMatch.length;

      // Add text before citation
      if (startIndex > lastIndex) {
        parts.push(text.slice(lastIndex, startIndex));
      }

      // Add citation badge
      parts.push(
        <CitationBadge
          key={`${citationId}-${citationType}-${startIndex}`}
          id={citationId}
          type={citationType}
          onClick={() => onCitationClick?.(citationId, citationType)}
        />
      );

      lastIndex = endIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  }, [text, onCitationClick]);

  return <>{parsedContent}</>;
}

function CitationBadge({ id, type, onClick }: { id: string; type: string; onClick?: () => void }) {
  const getLabel = () => {
    switch (type) {
      case 'leg': return 'Ley';
      case 'doc': return 'Doc';
      case 'fallo': return 'Fallo';
      default: return 'Fuente';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'leg': return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'doc': return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'fallo': return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  return (
    <Badge
      className={cn('ml-1 cursor-pointer transition-colors text-xs', getColor())}
      onClick={onClick}
    >
      {getLabel()} {id.slice(-4)}
    </Badge>
  );
}
