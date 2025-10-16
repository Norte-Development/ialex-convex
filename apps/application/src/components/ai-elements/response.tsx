'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo, useMemo } from 'react';
import { Streamdown } from 'streamdown';
import remarkCitation from '@/lib/remark-citation';
import type { MermaidConfig } from 'mermaid';
import remarkGfm from 'remark-gfm';
import { createMarkdownComponents } from '@/lib/markdown-components';

type ResponseProps = ComponentProps<typeof Streamdown> & {
  onCitationClick?: (id: string, type: string) => void;
};

const mermaidConfig: MermaidConfig = {
  theme: 'dark',
  flowchart: {
    curve: 'basis',
  },
};

export const Response = memo(
  ({ className, onCitationClick, ...props }: ResponseProps) => {
    // Memoize components to prevent recreation on every render
    const components = useMemo(
      () => createMarkdownComponents(onCitationClick),
      [onCitationClick]
    );
    
    return (
      <Streamdown
        className={cn(
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          className
        )}
        remarkPlugins={[remarkGfm, remarkCitation]}
        components={components}
        mermaidConfig={mermaidConfig}
        {...props}
      />
    );
  },
  (prevProps, nextProps) => 
    prevProps.children === nextProps.children &&
    prevProps.onCitationClick === nextProps.onCitationClick &&
    prevProps.className === nextProps.className
);

Response.displayName = 'Response';
