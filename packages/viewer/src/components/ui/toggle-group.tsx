'use client';

import { Separator as SeparatorPrimitive } from '@base-ui/react/separator';
import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '#/lib/utils';

const toggleGroupVariants = cva(
  'inline-flex items-center gap-1 rounded-[12px] bg-control p-1 shadow-control outline-none data-[orientation=vertical]:flex-col',
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: '',
        lg: 'gap-1.5 p-1',
        sm: 'gap-0.5 p-0.5',
      },
      variant: {
        default: '',
        outline: 'bg-transparent shadow-control',
      },
    },
  },
);

const toggleGroupItemVariants = cva(
  'focus-ring inline-flex select-none items-center justify-center whitespace-nowrap rounded-[8px] text-fg-muted transition-[background-color,box-shadow,color,scale] duration-150 [transition-timing-function:var(--ease-polished)] hover:not-data-disabled:text-fg active:not-data-disabled:scale-[0.96] data-disabled:pointer-events-none data-disabled:opacity-45 data-pressed:bg-header data-pressed:text-fg data-pressed:shadow-control',
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: "min-h-9 px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "min-h-10 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-4.5",
        sm: "min-h-8 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-4",
      },
      variant: {
        default: '',
        outline: 'data-pressed:shadow-border',
      },
    },
  },
);

type ToggleGroupVariant = NonNullable<VariantProps<typeof toggleGroupVariants>['variant']>;
type ToggleGroupSize = NonNullable<VariantProps<typeof toggleGroupVariants>['size']>;

const ToggleGroupStyleContext = React.createContext<{
  size: ToggleGroupSize;
  variant: ToggleGroupVariant;
}>({
  size: 'default',
  variant: 'default',
});

export interface ToggleGroupProps
  extends
    Omit<React.ComponentProps<typeof ToggleGroupPrimitive>, 'className'>,
    VariantProps<typeof toggleGroupVariants> {
  className?: string;
}

export function ToggleGroup({
  className,
  size = 'default',
  variant = 'default',
  ...props
}: ToggleGroupProps): React.ReactElement {
  return (
    <ToggleGroupStyleContext.Provider
      value={{
        size: size ?? 'default',
        variant: variant ?? 'default',
      }}
    >
      <ToggleGroupPrimitive
        className={cn(toggleGroupVariants({ size, variant }), className)}
        {...props}
      />
    </ToggleGroupStyleContext.Provider>
  );
}

export interface ToggleGroupItemProps
  extends
    Omit<React.ComponentProps<typeof TogglePrimitive>, 'className'>,
    VariantProps<typeof toggleGroupItemVariants> {
  className?: string;
}

export function ToggleGroupItem({
  className,
  size,
  variant,
  ...props
}: ToggleGroupItemProps): React.ReactElement {
  const context = React.useContext(ToggleGroupStyleContext);

  return (
    <TogglePrimitive
      className={cn(
        toggleGroupItemVariants({
          size: size ?? context.size,
          variant: variant ?? context.variant,
        }),
        className,
      )}
      {...props}
    />
  );
}

export function ToggleGroupSeparator({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive>): React.ReactElement {
  return (
    <SeparatorPrimitive
      className={cn(
        'shrink-0 bg-line data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-4 data-[orientation=vertical]:h-4 data-[orientation=vertical]:w-px',
        className,
      )}
      orientation={orientation}
      {...props}
    />
  );
}

export { ToggleGroupPrimitive, TogglePrimitive };
