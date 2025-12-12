'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { BookIcon, ChevronDownIcon, LinkIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

export type SourcesProps = ComponentProps<typeof Collapsible>;

export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible
    className={cn('not-prose my-2 w-full group/sources border rounded-lg bg-card/30', className)}
    {...props}
  />
);

export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
};

export const SourcesTrigger = ({
  className,
  count,
  children,
  ...props
}: SourcesTriggerProps) => (
  <CollapsibleTrigger
    className={cn(
      "flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors rounded-t-lg data-[state=open]:border-b",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        <div className="flex items-center gap-2">
          <BookIcon className="h-3.5 w-3.5" />
          <span>
            {count} {count === 1 ? 'fuente' : 'fuentes'}
          </span>
        </div>
        <ChevronDownIcon className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/sources:rotate-180" />
      </>
    )}
  </CollapsibleTrigger>
);

export type SourcesContentProps = ComponentProps<typeof CollapsibleContent>;

export const SourcesContent = ({
  className,
  ...props
}: SourcesContentProps) => (
  <CollapsibleContent
    className={cn(
      'p-2 flex flex-col gap-1 overflow-hidden',
      'data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
      className
    )}
    {...props}
  />
);

export type SourceProps = ComponentProps<'a'> & {
  title?: string;
  index?: number;
};

export const Source = ({ href, title, index, children, className, ...props }: SourceProps) => (
  <a
    className={cn(
      "flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/80 transition-all duration-200 no-underline group/source",
      className
    )}
    href={href}
    rel="noreferrer"
    target="_blank"
    {...props}
  >
    {children ?? (
      <>
        <div className="flex items-center justify-center h-5 w-5 shrink-0 rounded-full bg-background border text-[10px] font-medium text-muted-foreground group-hover/source:text-foreground group-hover/source:border-primary/20">
            {index ? index : <LinkIcon className="h-3 w-3" />}
        </div>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-xs font-medium truncate text-foreground/90 group-hover/source:text-primary">
                {title || href}
            </span>
            <span className="text-[10px] text-muted-foreground truncate opacity-70">
                {href}
            </span>
        </div>
      </>
    )}
  </a>
);
