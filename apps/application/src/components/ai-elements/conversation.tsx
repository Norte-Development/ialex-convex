'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowDownIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useCallback } from 'react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn('relative flex-1 overflow-y-auto', className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <StickToBottom.Content className={cn('p-4', className)} {...props} />
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        className={cn(
          'absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full',
          className
        )}
        onClick={handleScrollToBottom}
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    )
  );
};

export type ConversationEmptyStateProps = ComponentProps<'div'> & {
  icon?: ReactNode;
  title?: string;
  description?: string;
};

export const ConversationEmptyState = ({
  icon,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  className,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center h-full text-center text-muted-foreground',
      className
    )}
    {...props}
  >
    {icon && <div className="mb-4 text-muted-foreground/50">{icon}</div>}
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-sm">{description}</p>
    {children}
  </div>
);
