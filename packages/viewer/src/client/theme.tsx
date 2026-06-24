import { useEffect, useState } from 'react';
import ComputerIcon from '@hugeicons/core-free-icons/ComputerIcon';
import Moon02Icon from '@hugeicons/core-free-icons/Moon02Icon';
import Sun01Icon from '@hugeicons/core-free-icons/Sun01Icon';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group';
import { cn } from '#/lib/utils';
import { THEME_STORAGE_KEY } from './themeInit';

type ThemePreference = 'system' | 'light' | 'dark';

const themeOptions: {
  value: ThemePreference;
  icon: IconSvgElement;
  label: string;
  title: string;
}[] = [
  {
    value: 'system',
    icon: ComputerIcon,
    label: 'System',
    title: 'Follow the system color scheme',
  },
  { value: 'light', icon: Sun01Icon, label: 'Light', title: 'Use light mode' },
  { value: 'dark', icon: Moon02Icon, label: 'Dark', title: 'Use dark mode' },
];

export function ThemeModeControl({ className }: { className?: string }) {
  const [preference, setPreference] = useState<ThemePreference>(() => readThemePreference());

  const handleValueChange = (values: string[]) => {
    const nextPreference = values[0];
    if (nextPreference === 'system' || nextPreference === 'light' || nextPreference === 'dark') {
      setPreference(nextPreference);
    }
  };

  useEffect(() => {
    applyThemePreference(preference);
    writeThemePreference(preference);

    if (preference !== 'system' || typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applySystemTheme = () => applyThemePreference('system');
    mediaQuery.addEventListener('change', applySystemTheme);
    return () => mediaQuery.removeEventListener('change', applySystemTheme);
  }, [preference]);

  return (
    <ThemeModeToggle className={className} onValueChange={handleValueChange} value={preference} />
  );
}

function ThemeModeToggle({
  className,
  onValueChange,
  value,
}: {
  className?: string;
  onValueChange: (values: string[]) => void;
  value: ThemePreference;
}) {
  return (
    <ToggleGroup
      aria-label="Theme"
      className={cn('h-9 rounded-[10px] bg-raised p-0.5 shadow-control', className)}
      onValueChange={onValueChange}
      size="sm"
      value={[value]}
    >
      {themeOptions.map((option) => (
        <ToggleGroupItem
          aria-label={option.label}
          className="min-h-0 size-8 rounded-[8px] px-0 data-pressed:bg-control data-pressed:shadow-control"
          key={option.value}
          title={option.title}
          value={option.value}
        >
          <HugeiconsIcon
            aria-hidden
            color="currentColor"
            icon={option.icon}
            size={16}
            strokeWidth={1.7}
          />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system';
  }

  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function writeThemePreference(preference: ThemePreference) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (preference === 'system') {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Ignore storage failures; the current document theme still applies.
  }
}

function applyThemePreference(preference: ThemePreference) {
  if (typeof document === 'undefined') {
    return;
  }

  const theme = preference === 'system' ? getSystemTheme() : preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function getSystemTheme(): Exclude<ThemePreference, 'system'> {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
