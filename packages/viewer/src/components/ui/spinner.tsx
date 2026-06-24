import Loading03Icon from '@hugeicons/core-free-icons/Loading03Icon';
import { HugeiconsIcon } from '@hugeicons/react';
import type React from 'react';
import { cn } from '#/lib/utils';

export function Spinner({
  className,
  ...props
}: Omit<React.ComponentProps<typeof HugeiconsIcon>, 'icon'>): React.ReactElement {
  return (
    <HugeiconsIcon
      aria-label="Loading"
      className={cn('animate-spin', className)}
      color="currentColor"
      icon={Loading03Icon}
      role="status"
      strokeWidth={1.7}
      {...props}
    />
  );
}
