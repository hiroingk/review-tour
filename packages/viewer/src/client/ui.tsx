import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import CircleCheckIcon from '@hugeicons/core-free-icons/CircleCheckIcon';
import CircleIcon from '@hugeicons/core-free-icons/CircleIcon';
import FileDiffIcon from '@hugeicons/core-free-icons/FileDiffIcon';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import type { ReviewChapter, ReviewTour, ReviewWarning } from 'review-tour/schema';
import { Badge, type BadgeProps } from '#/components/ui/badge';
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
  CommandShortcut,
} from '#/components/ui/command';
import type { ChapterStats } from '../reviewModel';
import { LanguageControl, type Translator, useI18n } from './i18n';
import { ThemeModeControl } from './theme';

export type CommandPaletteTarget =
  | { type: 'chapter'; chapterId: string }
  | { type: 'file'; path: string }
  | { type: 'question'; chapterId: string; questionIndex: number };

type CommandPaletteResult = {
  id: string;
  label: string;
  meta: string;
  target: CommandPaletteTarget;
};

type CommandPaletteGroup = {
  value: string;
  label: string;
  items: CommandPaletteResult[];
};

type IconButtonTone = 'accent' | 'neutral';
type IconButtonVariant = 'ghost' | 'raised';
const markIconLayerClass =
  'grid place-items-center transition-[opacity,filter,scale,color] duration-300 [transition-timing-function:var(--ease-polished)]';

export function ShellMessage({
  message,
  tone = 'neutral',
}: {
  message: string;
  tone?: 'neutral' | 'error';
}) {
  return (
    <main className="relative grid min-h-screen place-items-center bg-canvas px-6 text-fg">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageControl />
        <ThemeModeControl />
      </div>
      <p
        className={
          tone === 'error'
            ? 'surface-panel max-w-md rounded-[8px] bg-error-soft p-4 text-sm leading-[1.55] text-error'
            : 'surface max-w-md rounded-[8px] bg-panel px-5 py-4 text-sm leading-[1.55] text-fg-muted'
        }
        role={tone === 'error' ? 'alert' : undefined}
      >
        {message}
      </p>
    </main>
  );
}

export function CommandPalette({
  onOpenChange,
  onSelect,
  open,
  tour,
}: {
  onOpenChange: (open: boolean) => void;
  onSelect: (target: CommandPaletteTarget) => void;
  open: boolean;
  tour: ReviewTour;
}) {
  const [query, setQuery] = useState('');
  const { t } = useI18n();
  const groups = useMemo(() => getCommandPaletteGroups(tour, t), [t, tour]);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  return (
    <CommandDialog onOpenChange={onOpenChange} open={open}>
      <CommandDialogPopup
        aria-label={t('Search chapters, files, and questions')}
        className="max-w-[40rem]"
      >
        <Command
          itemToStringValue={(item) => getCommandPaletteValue(item, t)}
          items={groups}
          onValueChange={setQuery}
          value={query}
        >
          <CommandInput placeholder={t('Search chapters, files, questions...')} type="search" />
          <CommandPanel>
            <CommandEmpty>{t('No results.')}</CommandEmpty>
            <CommandList className="max-h-[52vh]">
              {(group: CommandPaletteGroup) => (
                <Fragment key={group.value}>
                  <CommandGroup items={group.items}>
                    <CommandGroupLabel>{group.label}</CommandGroupLabel>
                    <CommandCollection>
                      {(result: CommandPaletteResult) => (
                        <CommandItem
                          className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2"
                          key={result.id}
                          onClick={() => onSelect(result.target)}
                          value={result}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-fg">
                              {result.label}
                            </span>
                            <span className="block truncate text-xs text-fg-muted">
                              {result.meta}
                            </span>
                          </span>
                          <CommandShortcut className="tracking-normal">
                            {getCommandPaletteKindLabel(result.target, t)}
                          </CommandShortcut>
                        </CommandItem>
                      )}
                    </CommandCollection>
                  </CommandGroup>
                  <CommandSeparator />
                </Fragment>
              )}
            </CommandList>
          </CommandPanel>
          <CommandFooter>
            <div className="flex items-center gap-4">
              <CommandPaletteFooterHint keys={['↑', '↓']} label={t('Navigate')} />
              <CommandPaletteFooterHint keys={['Enter']} label={t('Open')} />
            </div>
            <CommandPaletteFooterHint keys={['Esc']} label={t('Close')} />
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}

export function PanelHeading({
  children,
  label,
  value,
}: {
  children?: ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <header className="flex min-h-10 items-center justify-between gap-4 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
      <span>{label}</span>
      {children ??
        (value ? (
          <strong className="truncate text-xs font-medium normal-case tracking-normal text-fg-secondary">
            {value}
          </strong>
        ) : null)}
    </header>
  );
}

function getCommandPaletteGroups(tour: ReviewTour, t: Translator): CommandPaletteGroup[] {
  const chapters: CommandPaletteResult[] = [];
  const questions: CommandPaletteResult[] = [];
  const files: CommandPaletteResult[] = [];

  for (const chapter of tour.tour.chapters) {
    chapters.push({
      id: `chapter:${chapter.id}`,
      label: chapter.title,
      meta: t('Chapter {index}', { index: chapter.index }),
      target: { type: 'chapter', chapterId: chapter.id },
    });

    chapter.reviewQuestions.forEach((question, index) => {
      questions.push({
        id: `question:${chapter.id}:${index}`,
        label: question,
        meta: t('Question · Chapter {index}', { index: chapter.index }),
        target: { type: 'question', chapterId: chapter.id, questionIndex: index },
      });
    });
  }

  for (const file of tour.diff.files) {
    files.push({
      id: `file:${file.id}`,
      label: file.path,
      meta: t('{additions} additions, {deletions} deletions', {
        additions: file.additions,
        deletions: file.deletions,
      }),
      target: { type: 'file', path: file.path },
    });
  }

  return [
    { value: 'chapters', label: t('Chapters'), items: chapters },
    { value: 'files', label: t('Files'), items: files },
    { value: 'questions', label: t('Review questions'), items: questions },
  ].filter((group) => group.items.length > 0);
}

function getCommandPaletteKindLabel(target: CommandPaletteTarget, t: Translator) {
  if (target.type === 'chapter') return t('Chapter');
  if (target.type === 'question') return t('Question');
  return t('File');
}

function getCommandPaletteValue(item: unknown, t: Translator) {
  if (isCommandPaletteGroup(item)) {
    return `${item.label} ${item.items.map((result) => getCommandPaletteResultValue(result, t)).join(' ')}`;
  }

  return getCommandPaletteResultValue(item, t);
}

function getCommandPaletteResultValue(result: unknown, t: Translator) {
  const commandResult = result as CommandPaletteResult;
  return `${getCommandPaletteKindLabel(commandResult.target, t)} ${commandResult.label} ${commandResult.meta}`;
}

function isCommandPaletteGroup(item: unknown): item is CommandPaletteGroup {
  return Boolean(
    item &&
    typeof item === 'object' &&
    'items' in item &&
    Array.isArray((item as CommandPaletteGroup).items),
  );
}

function CommandPaletteFooterHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex items-center gap-1">
        {keys.map((key) => (
          <kbd
            className="grid min-h-5 min-w-5 place-items-center rounded-[4px] bg-control px-1.5 font-medium text-[10px] leading-5 text-fg-secondary shadow-control"
            key={key}
          >
            {key}
          </kbd>
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-medium uppercase leading-none tracking-wider text-fg-muted">
      {children}
    </h2>
  );
}

export function SideBlock({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <section className={['mt-7 border-t border-line pt-5', className].filter(Boolean).join(' ')}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}

export function AppIcon({
  className,
  icon,
  size = 16,
}: {
  className?: string;
  icon: IconSvgElement;
  size?: number;
}) {
  return (
    <HugeiconsIcon
      className={className}
      color="currentColor"
      icon={icon}
      size={size}
      strokeWidth={1.7}
    />
  );
}

export function IconButton({
  active = false,
  className,
  disabled = false,
  expanded,
  icon,
  label,
  onClick,
  tone = 'neutral',
  variant = 'raised',
}: {
  active?: boolean;
  className?: string;
  disabled?: boolean;
  expanded?: boolean;
  icon: IconSvgElement;
  label: string;
  onClick: () => void;
  tone?: IconButtonTone;
  variant?: IconButtonVariant;
}) {
  const activeClass =
    tone === 'accent' && active
      ? 'bg-add-soft text-add hover:bg-add-soft'
      : active
        ? 'bg-hover text-fg'
        : variant === 'ghost'
          ? 'bg-transparent text-fg-muted hover:bg-hover hover:text-fg'
          : 'bg-control text-fg-muted hover:bg-hover hover:text-fg';
  const variantClass =
    variant === 'ghost'
      ? 'disabled:hover:bg-transparent'
      : 'button-raised disabled:hover:bg-control';

  return (
    <button
      aria-expanded={expanded}
      aria-label={label}
      aria-pressed={active || undefined}
      className={[
        'focus-ring pressable hit-area-40 grid size-9 shrink-0 place-items-center rounded-[8px] disabled:cursor-default disabled:opacity-45 disabled:hover:text-fg-muted',
        variantClass,
        activeClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <AppIcon icon={icon} />
    </button>
  );
}

export function MarkToggle({
  checked,
  className,
  onToggle,
  title,
}: {
  checked: boolean;
  className?: string;
  onToggle: () => void;
  title: string;
}) {
  return (
    <button
      aria-label={title}
      aria-pressed={checked}
      className={[
        'focus-ring hit-area-40 relative grid size-9 place-items-center transition-[color,scale] duration-150 [transition-timing-function:var(--ease-polished)] active:scale-[0.96]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onToggle}
      title={title}
      type="button"
    >
      <span className="relative grid size-4 place-items-center">
        <span
          aria-hidden
          className={[
            'absolute inset-0 text-add',
            markIconLayerClass,
            checked ? 'scale-100 opacity-100 blur-0' : 'scale-[0.25] opacity-0 blur-[4px]',
          ].join(' ')}
        >
          <AppIcon icon={CircleCheckIcon} />
        </span>
        <span
          aria-hidden
          className={[
            markIconLayerClass,
            checked ? 'scale-[0.25] opacity-0 blur-[4px]' : 'scale-100 opacity-100 blur-0',
          ].join(' ')}
        >
          <AppIcon icon={CircleIcon} />
        </span>
      </span>
    </button>
  );
}

export function ChapterReviewedToggle({
  className,
  completed,
  onToggle,
  title,
  variant = 'button',
}: {
  className?: string;
  completed: boolean;
  onToggle: () => void;
  title: string;
  variant?: 'button' | 'icon';
}) {
  const activeClass =
    variant === 'icon'
      ? completed
        ? 'text-add hover:text-add'
        : 'text-fg-faint hover:text-fg-secondary'
      : completed
        ? 'bg-add-soft text-add hover:bg-add-soft'
        : 'bg-control text-fg-faint hover:bg-hover hover:text-fg-secondary';
  const variantClass =
    variant === 'icon' ? 'shrink-0' : 'pressable button-raised shrink-0 rounded-[8px]';

  return (
    <MarkToggle
      checked={completed}
      className={[variantClass, activeClass, className].filter(Boolean).join(' ')}
      onToggle={onToggle}
      title={title}
    />
  );
}

export function FileViewedToggle({
  completed,
  onToggle,
  title,
}: {
  completed: boolean;
  onToggle: () => void;
  title: string;
}) {
  return (
    <MarkToggle
      checked={completed}
      className="justify-self-end text-fg-faint hover:text-fg-secondary"
      onToggle={onToggle}
      title={title}
    />
  );
}

export function Metric({
  label,
  value,
  valueClass = 'text-fg',
}: {
  label: string;
  value: number | string;
  valueClass?: string;
}) {
  return (
    <div className="grid gap-1 border-b border-hairline py-3 last:border-b-0 [&:nth-last-child(2)]:border-b-0">
      <span className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">
        {label}
      </span>
      <strong className={`mono-tabular truncate text-sm font-semibold ${valueClass}`}>
        {value}
      </strong>
    </div>
  );
}

export function ChapterMeta({ risk, stats }: { risk: ReviewChapter['risk']; stats: ChapterStats }) {
  return (
    <div className="mono-tabular mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
      <RiskBadge risk={risk} size="sm" />
      {stats.additions > 0 ? (
        <span className="font-semibold text-add">+{stats.additions}</span>
      ) : null}
      {stats.deletions > 0 ? (
        <span className="font-semibold text-delete">-{stats.deletions}</span>
      ) : null}
      <span className="inline-flex items-center gap-1 text-fg-muted">
        <AppIcon icon={FileDiffIcon} size={14} />
        {stats.files}
      </span>
    </div>
  );
}

export function RiskBadge({
  risk,
  size,
}: {
  risk: ReviewChapter['risk'];
  size?: BadgeProps['size'];
}) {
  const { t } = useI18n();
  const label =
    risk === 'high' ? t('High risk') : risk === 'medium' ? t('Medium risk') : t('Low risk');
  const variant = risk === 'high' ? 'error' : risk === 'medium' ? 'warning' : 'success';

  return (
    <Badge className="font-mono" size={size} variant={variant}>
      {label}
    </Badge>
  );
}

export function Warnings({ warnings }: { warnings: ReviewWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <section className="surface mt-7 grid gap-2 rounded-[8px] bg-warning-panel p-4">
      {warnings.map((warning) => (
        <div className="grid gap-1 text-xs text-warning-fg" key={warning.code}>
          <strong>{warning.code}</strong>
          <span>{warning.message}</span>
        </div>
      ))}
    </section>
  );
}
