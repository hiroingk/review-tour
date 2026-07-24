import Loading03Icon from '@hugeicons/core-free-icons/Loading03Icon';
import { HugeiconsIcon } from '@hugeicons/react';
import type React from 'react';
import { useI18n } from '#/client/i18n';
import { cn } from '#/lib/utils';

export function Spinner({
  className,
  ...props
}: Omit<React.ComponentProps<typeof HugeiconsIcon>, 'icon'>): React.ReactElement {
  const { t } = useI18n();
  return (
    <HugeiconsIcon
      aria-label={t('Loading')}
      className={cn('animate-spin', className)}
      color="currentColor"
      icon={Loading03Icon}
      role="status"
      strokeWidth={1.7}
      {...props}
    />
  );
}
