'use client';

import { Response } from './response';
import { memo } from 'react';

interface MessageTextProps {
  text: string;
  renderMarkdown?: boolean;
  onCitationClick?: (id: string, type: string) => void;
}

/**
 * MessageText component that handles markdown rendering and citation parsing.
 * 
 * Uses the Response component with a unified remark plugin pipeline to:
 * - Parse markdown (via remark-gfm)
 * - Parse citations in the format [CIT:type:id] (via remark-citation)
 * - Render citation badges inline as React components
 * 
 * This replaces the previous regex-based approach with a proper AST transformation.
 */
export const MessageText = memo(
  ({ text, renderMarkdown = true, onCitationClick }: MessageTextProps) => {
    // If markdown rendering is disabled, return plain text
    if (!renderMarkdown) {
      return <>{text}</>;
    }

    // Use the Response component which includes the remark citation plugin
    return (
      <Response onCitationClick={onCitationClick}>
        {text}
      </Response>
    );
  },
  (prevProps, nextProps) => 
    prevProps.text === nextProps.text &&
    prevProps.renderMarkdown === nextProps.renderMarkdown &&
    prevProps.onCitationClick === nextProps.onCitationClick
);

MessageText.displayName = 'MessageText';

