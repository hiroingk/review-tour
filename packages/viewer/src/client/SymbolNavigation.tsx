import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import LinkSquare02Icon from '@hugeicons/core-free-icons/LinkSquare02Icon';
import type { ReviewChapter, ReviewTour } from 'review-tour/schema';
import { buildSymbolIndex, type SymbolDefinition } from './symbolIndex';
import { fileDomId } from './dom';
import { useI18n } from './i18n';
import { AppIcon } from './ui';

export type SymbolNavigationValue = {
  hasSymbol: (name: string) => boolean;
  openSymbol: (name: string, position: { x: number; y: number }) => void;
};

const SymbolNavigationContext = createContext<SymbolNavigationValue | null>(null);
const PendingSymbolJumpContext = createContext<SymbolDefinition | null>(null);

export function useSymbolNavigation(): SymbolNavigationValue | null {
  return useContext(SymbolNavigationContext);
}

export function usePendingSymbolJump(): SymbolDefinition | null {
  return useContext(PendingSymbolJumpContext);
}

type SymbolPopoverState = {
  definitions: readonly SymbolDefinition[];
  name: string;
  x: number;
  y: number;
};

const POPOVER_WIDTH = 384;
const JUMP_SCROLL_ATTEMPTS = 30;

export function SymbolNavigationProvider({
  chapter,
  children,
  onChapterSelect,
  tour,
}: {
  chapter: ReviewChapter;
  children: ReactNode;
  onChapterSelect: (chapter: ReviewChapter) => void;
  tour: ReviewTour;
}) {
  const { t } = useI18n();
  const [popover, setPopover] = useState<SymbolPopoverState | null>(null);
  const [pendingJump, setPendingJump] = useState<SymbolDefinition | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const index = useMemo(() => buildSymbolIndex(tour.diff.files), [tour.diff.files]);
  const chaptersByHunkId = useMemo(() => {
    const map = new Map<string, ReviewChapter>();
    for (const tourChapter of tour.tour.chapters) {
      for (const hunkId of tourChapter.hunkIds) {
        if (!map.has(hunkId)) {
          map.set(hunkId, tourChapter);
        }
      }
    }
    return map;
  }, [tour.tour.chapters]);

  const jumpToDefinition = useCallback(
    (definition: SymbolDefinition) => {
      setPopover(null);

      const targetChapter = chaptersByHunkId.get(definition.hunkId);
      if (targetChapter && targetChapter.id !== chapter.id) {
        onChapterSelect(targetChapter);
      }
      setPendingJump(definition);
    },
    [chapter.id, chaptersByHunkId, onChapterSelect],
  );

  const value = useMemo<SymbolNavigationValue>(
    () => ({
      hasSymbol: (name) => index.has(name),
      openSymbol: (name, position) => {
        const definitions = index.get(name);
        const firstDefinition = definitions?.[0];
        if (!definitions || !firstDefinition) return;

        if (definitions.length === 1) {
          jumpToDefinition(firstDefinition);
          return;
        }

        setPopover({ definitions, name, x: position.x, y: position.y });
      },
    }),
    [index, jumpToDefinition],
  );

  useEffect(() => {
    if (!pendingJump || typeof window === 'undefined') return;

    let cancelled = false;
    let attempts = 0;
    let frame = 0;

    const tryScroll = () => {
      if (cancelled) return;

      const element = findDefinitionElement(pendingJump);
      if (element) {
        scrollToDefinitionElement(element);
        setPendingJump(null);
        return;
      }

      attempts += 1;
      if (attempts < JUMP_SCROLL_ATTEMPTS) {
        frame = window.requestAnimationFrame(tryScroll);
        return;
      }

      const fallback = document.getElementById(fileDomId(pendingJump.filePath));
      fallback?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingJump(null);
    };

    frame = window.requestAnimationFrame(tryScroll);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [chapter.id, pendingJump]);

  useEffect(() => {
    if (!popover || typeof window === 'undefined') return;

    const onPointerDown = (event: PointerEvent) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      setPopover(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setPopover(null);
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [popover]);

  return (
    <SymbolNavigationContext.Provider value={value}>
      <PendingSymbolJumpContext.Provider value={pendingJump}>
        {children}
      </PendingSymbolJumpContext.Provider>
      {popover ? (
        <div
          className="surface-panel fixed z-50 w-96 max-w-[calc(100vw-24px)] rounded-[8px] border border-hairline bg-panel shadow-lg"
          ref={popoverRef}
          role="dialog"
          style={{
            left: clampPopoverX(popover.x),
            top: clampPopoverY(popover.y + 10),
          }}
        >
          <header className="flex items-baseline gap-2 border-b border-hairline px-3 py-2">
            <span className="font-mono text-xs font-semibold text-fg">{popover.name}</span>
            <span className="text-[11px] text-fg-muted">
              {t('{count} definitions', { count: popover.definitions.length })}
            </span>
          </header>
          <ul className="max-h-72 overflow-y-auto py-1">
            {popover.definitions.map((definition) => (
              <li
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 px-1"
                key={`${definition.fileId}:${definition.lineNumber}`}
              >
                <button
                  className="focus-ring grid min-w-0 gap-0.5 rounded-[6px] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-hover"
                  onClick={() => jumpToDefinition(definition)}
                  type="button"
                >
                  <span className="mono-tabular truncate font-mono text-[11px] text-fg-muted">
                    {definition.filePath}:{definition.lineNumber}
                  </span>
                  <code className="truncate font-mono text-xs text-fg-secondary">
                    {definition.content.trim()}
                  </code>
                </button>
                <a
                  aria-label={t('Open {location} in editor', {
                    location: `${definition.filePath}:${definition.lineNumber}`,
                  })}
                  className="focus-ring grid size-7 place-items-center rounded-[6px] text-fg-faint transition-colors duration-150 hover:bg-hover hover:text-fg"
                  href={getEditorUrl(tour.repository.root, definition)}
                  title={t('Open in editor')}
                >
                  <AppIcon icon={LinkSquare02Icon} size={14} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SymbolNavigationContext.Provider>
  );
}

function clampPopoverX(x: number) {
  if (typeof window === 'undefined') return x;
  return Math.max(12, Math.min(x, window.innerWidth - POPOVER_WIDTH - 12));
}

function clampPopoverY(y: number) {
  if (typeof window === 'undefined') return y;
  return Math.max(12, Math.min(y, window.innerHeight - 340));
}

function getEditorUrl(repositoryRoot: string, definition: SymbolDefinition) {
  const root = repositoryRoot.endsWith('/') ? repositoryRoot.slice(0, -1) : repositoryRoot;
  return `vscode://file${root}/${definition.filePath}:${definition.lineNumber}`;
}

function findDefinitionElement(definition: SymbolDefinition): HTMLElement | null {
  if (typeof document === 'undefined' || typeof CSS === 'undefined') return null;

  return document.querySelector<HTMLElement>(
    `[data-diff-line-file="${CSS.escape(definition.fileId)}"][data-diff-line-new="${definition.lineNumber}"]`,
  );
}

function scrollToDefinitionElement(element: HTMLElement) {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.classList.remove('symbol-jump-flash');
  // Force a reflow so re-adding the class restarts the animation.
  void element.offsetWidth;
  element.classList.add('symbol-jump-flash');
  window.setTimeout(() => element.classList.remove('symbol-jump-flash'), 1400);
}
