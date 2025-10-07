'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo } from 'react';
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
    const components = createMarkdownComponents(onCitationClick);
    
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
    prevProps.onCitationClick === nextProps.onCitationClick
);

Response.displayName = 'Response';
