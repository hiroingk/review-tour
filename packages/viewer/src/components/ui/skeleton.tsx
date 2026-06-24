import type React from 'react';
import { cn } from '#/lib/utils';

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn(
        'animate-skeleton rounded-sm [background:linear-gradient(120deg,transparent_40%,var(--skeleton-highlight),transparent_60%)_var(--skeleton-base)_0_0/200%_100%_fixed]',
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}
