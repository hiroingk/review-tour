import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Cancel02Icon from '@hugeicons/core-free-icons/Cancel02Icon';
import ChevronDownIcon from '@hugeicons/core-free-icons/ChevronDownIcon';
import Comment01Icon from '@hugeicons/core-free-icons/Comment01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon';
import PlusSignIcon from '@hugeicons/core-free-icons/PlusSignIcon';
import SaveIcon from '@hugeicons/core-free-icons/SaveIcon';
import Sent02Icon from '@hugeicons/core-free-icons/Sent02Icon';
import SquareArrowVerticalIcon from '@hugeicons/core-free-icons/SquareArrowVerticalIcon';
import type { LanguageInput } from 'shiki/types';
import type { DiffFile, DiffLine } from 'review-tour/schema';
import { Button } from '#/components/ui/button';
import {
  buildSplitRows,
  compactContextRowsWithExpansion,
  getFileStats,
  type ExpandableSplitFoldRow,
  type ExpandableSplitRow,
  type SplitLineRow,
} from '../reviewModel';
import type { DiffDisplaySettings } from './diffSettings';
import { fileDomId } from './dom';
import { getCollapsedFileScrollTop } from './collapseScroll';
import { useI18n } from './i18n';
import {
  createReviewComment,
  getReviewCommentLineKey,
  getReviewCommentLineLabel,
  getReviewCommentLocation,
  type ReviewComment,
  type ReviewCommentLineRef,
  type ReviewCommentRange,
  type ReviewCommentSide,
} from './reviewComments';
import { usePendingSymbolJump, useSymbolNavigation } from './SymbolNavigation';
import { splitSymbolSegments } from './symbolIndex';
import { AppIcon, FileViewedToggle } from './ui';

type SyntaxToken = {
  color?: string;
  content: string;
  fontStyle?: number;
};

type SyntaxLines = ReadonlyMap<string, SyntaxToken[]>;

type SyntaxHighlighter = {
  codeToTokens: (
    code: string,
    options: { lang: string; theme: string },
  ) => { tokens: SyntaxToken[][] };
};

type ResolvedSyntaxTheme = 'github-dark' | 'github-light' | 'plain';

type SyntaxLanguageModule = {
  default: LanguageInput;
};

type InlineRange = {
  end: number;
  start: number;
};

type LineSelection = {
  anchor: ReviewCommentLineRef;
  current: ReviewCommentLineRef;
};

type SplitPaneSide = 'left' | 'right';
type SplitPaneWidth = 'half' | 'full';

const syntaxHighlighterPromises = new Map<string, Promise<SyntaxHighlighter>>();

const supportedSyntaxLanguages = new Set([
  'bash',
  'css',
  'go',
  'html',
  'java',
  'javascript',
  'json',
  'kotlin',
  'markdown',
  'python',
  'rust',
  'sql',
  'swift',
  'toml',
  'typescript',
  'yaml',
]);

const COMMENT_EDITOR_ROW_HEIGHT = 176;
const COMMENT_CARD_HEIGHT = 108;
const COMMENT_CARD_EDIT_HEIGHT = 176;
const COMMENT_CARD_ROW_PADDING_Y = 16;
const COMMENT_CARD_ROW_GAP = 8;

type CollapseScrollTarget =
  | { element: HTMLElement; kind: 'element'; top: number }
  | { kind: 'window'; top: number };

export function DiffViewer({
  collapsedFileIds,
  comments,
  expandedFoldIds,
  files,
  onCommentAdd,
  onCommentDelete,
  onCommentUpdate,
  onFileCollapsedChange,
  onFoldExpand,
  onFoldsExpand,
  onFileViewedToggle,
  settings,
  viewedFileIds,
}: {
  collapsedFileIds: ReadonlySet<string>;
  comments: readonly ReviewComment[];
  expandedFoldIds: ReadonlySet<string>;
  files: DiffFile[];
  onCommentAdd: (comment: ReviewComment) => void;
  onCommentDelete: (commentId: string) => void;
  onCommentUpdate: (commentId: string, body: string) => void;
  onFileCollapsedChange: (fileId: string, collapsed: boolean) => void;
  onFoldExpand: (foldId: string) => void;
  onFoldsExpand: (foldIds: readonly string[]) => void;
  onFileViewedToggle: (fileId: string) => void;
  settings: DiffDisplaySettings;
  viewedFileIds: ReadonlySet<string>;
}) {
  const { t } = useI18n();
  if (files.length === 0) {
    return (
      <p className="surface rounded-[8px] bg-panel px-5 py-4 text-sm text-fg-muted">
        {t('No diff hunks for this chapter.')}
      </p>
    );
  }

  return files.map((file) => (
    <FileDiff
      collapsed={collapsedFileIds.has(file.id)}
      comments={comments.filter((comment) => comment.range.fileId === file.id)}
      expandedFoldIds={expandedFoldIds}
      file={file}
      key={file.path}
      onCommentAdd={onCommentAdd}
      onCommentDelete={onCommentDelete}
      onCommentUpdate={onCommentUpdate}
      onCollapsedChange={onFileCollapsedChange}
      onFoldExpand={onFoldExpand}
      onFoldsExpand={onFoldsExpand}
      onViewedToggle={onFileViewedToggle}
      settings={settings}
      viewed={viewedFileIds.has(file.id)}
    />
  ));
}

function FileDiff({
  collapsed,
  comments,
  expandedFoldIds,
  file,
  onCommentAdd,
  onCommentDelete,
  onCommentUpdate,
  onCollapsedChange,
  onFoldExpand,
  onFoldsExpand,
  onViewedToggle,
  settings,
  viewed,
}: {
  collapsed: boolean;
  comments: readonly ReviewComment[];
  expandedFoldIds: ReadonlySet<string>;
  file: DiffFile;
  onCommentAdd: (comment: ReviewComment) => void;
  onCommentDelete: (commentId: string) => void;
  onCommentUpdate: (commentId: string, body: string) => void;
  onCollapsedChange: (fileId: string, collapsed: boolean) => void;
  onFoldExpand: (foldId: string) => void;
  onFoldsExpand: (foldIds: readonly string[]) => void;
  onViewedToggle: (fileId: string) => void;
  settings: DiffDisplaySettings;
  viewed: boolean;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const syntaxTheme = useResolvedSyntaxTheme(settings.syntaxTheme);
  const syntaxLines = useSyntaxLines(file, syntaxTheme);
  const pendingSymbolJump = usePendingSymbolJump();
  const [headerStuck, setHeaderStuck] = useState(false);
  const [activeSelection, setActiveSelection] = useState<LineSelection | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [draftRange, setDraftRange] = useState<ReviewCommentRange | null>(null);
  const hunkRows = useMemo(
    () =>
      file.hunks.map((hunk) => ({
        header: hunk.header,
        id: hunk.id,
        rows: compactContextRowsWithExpansion(buildSplitRows(hunk.lines), hunk.id),
      })),
    [file.hunks],
  );
  const foldIds = useMemo(
    () =>
      hunkRows.flatMap((hunk) => hunk.rows.flatMap((row) => (row.kind === 'fold' ? [row.id] : []))),
    [hunkRows],
  );
  const stats = getFileStats(file);
  const visibleLineRefs = useMemo(
    () => buildVisibleLineRefs(file, hunkRows, expandedFoldIds, settings.layout),
    [expandedFoldIds, file, hunkRows, settings.layout],
  );
  const selectionRange = activeSelection
    ? createSelectionRange(activeSelection.anchor, activeSelection.current, visibleLineRefs)
    : draftRange;

  const expandFold = (foldId: string) => {
    if (!expandedFoldIds.has(foldId)) {
      onFoldExpand(foldId);
    }
  };

  const expandFullFile = () => {
    onCollapsedChange(file.id, false);
    onFoldsExpand(foldIds);
  };

  const getCollapseScrollTarget = (): CollapseScrollTarget | null => {
    const article = fileRef.current;
    if (!article || typeof window === 'undefined') return null;

    const scrollRoot = article.closest<HTMLElement>('[data-diff-scroll-root]');

    if (
      scrollRoot &&
      (scrollRoot.scrollTop > 0 || scrollRoot.scrollHeight > scrollRoot.clientHeight + 1)
    ) {
      const top = getCollapsedFileScrollTop({
        currentScrollTop: scrollRoot.scrollTop,
        fileTop: article.getBoundingClientRect().top,
        rootTop: scrollRoot.getBoundingClientRect().top,
      });

      return top === null ? null : { element: scrollRoot, kind: 'element', top };
    }

    const top = getCollapsedFileScrollTop({
      currentScrollTop: window.scrollY,
      fileTop: article.getBoundingClientRect().top,
      rootTop: 0,
    });

    return top === null ? null : { kind: 'window', top };
  };

  const restoreCollapseScrollTarget = (target: CollapseScrollTarget | null) => {
    if (!target || typeof window === 'undefined') return;

    window.requestAnimationFrame(() => {
      if (target.kind === 'element') {
        target.element.scrollTo({ top: target.top });
        return;
      }

      window.scrollTo({ top: target.top });
    });
  };

  const collapseFile = () => {
    const target = getCollapseScrollTarget();
    onCollapsedChange(file.id, true);
    restoreCollapseScrollTarget(target);
  };

  const toggleCollapsed = () => {
    if (collapsed) {
      onCollapsedChange(file.id, false);
      return;
    }

    collapseFile();
  };

  const toggleViewed = () => {
    if (!viewed && !collapsed) {
      collapseFile();
    }

    onViewedToggle(file.id);
  };

  const startLineSelection = (
    line: ReviewCommentLineRef,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    setDraftBody('');
    setDraftRange(null);
    setActiveSelection({ anchor: line, current: line });
  };

  const updateLineSelection = (line: ReviewCommentLineRef) => {
    setActiveSelection((current) => {
      if (!current || !isSameSelectionSurface(current.anchor, line)) return current;
      if (getReviewCommentLineKey(current.current) === getReviewCommentLineKey(line)) {
        return current;
      }

      return { ...current, current: line };
    });
  };

  const saveDraftComment = () => {
    if (!draftRange || draftBody.trim().length === 0) return;

    onCommentAdd(createReviewComment(draftRange, draftBody));
    setDraftBody('');
    setDraftRange(null);
  };

  const cancelDraftComment = () => {
    setDraftBody('');
    setDraftRange(null);
    setActiveSelection(null);
  };

  useEffect(() => {
    setActiveSelection(null);
    setDraftBody('');
    setDraftRange(null);
  }, [file.id, settings.layout]);

  useEffect(() => {
    if (!pendingSymbolJump || pendingSymbolJump.fileId !== file.id) return;

    if (collapsed) {
      onCollapsedChange(file.id, false);
    }

    const foldId = findFoldIdForNewLine(hunkRows, pendingSymbolJump.lineNumber);
    if (foldId && !expandedFoldIds.has(foldId)) {
      onFoldExpand(foldId);
    }
  }, [
    collapsed,
    expandedFoldIds,
    file.id,
    hunkRows,
    onCollapsedChange,
    onFoldExpand,
    pendingSymbolJump,
  ]);

  useEffect(() => {
    if (!activeSelection || typeof window === 'undefined') return;

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const onPointerUp = () => {
      const nextRange = createSelectionRange(
        activeSelection.anchor,
        activeSelection.current,
        visibleLineRefs,
      );
      setDraftRange(nextRange);
      setActiveSelection(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      cancelDraftComment();
    };

    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerUp, { once: true });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeSelection, visibleLineRefs]);

  useEffect(() => {
    const root = fileRef.current;
    if (!root) return;

    const panes = Array.from(root.querySelectorAll<HTMLElement>('[data-diff-scroll-pane]'));
    let syncing = false;

    const syncScroll = (event: Event) => {
      if (syncing) return;

      const source = event.currentTarget as HTMLElement;
      syncing = true;

      for (const pane of panes) {
        if (pane !== source && pane.scrollLeft !== source.scrollLeft) {
          pane.scrollLeft = source.scrollLeft;
        }
      }

      requestAnimationFrame(() => {
        syncing = false;
      });
    };

    for (const pane of panes) {
      pane.addEventListener('scroll', syncScroll, { passive: true });
    }

    return () => {
      for (const pane of panes) {
        pane.removeEventListener('scroll', syncScroll);
      }
    };
  }, [file.hunks]);

  useEffect(() => {
    const article = fileRef.current;
    const header = headerRef.current;
    if (!article || !header) return;

    const scrollRoot = article.closest<HTMLElement>('[data-diff-scroll-root]');
    let frame = 0;

    const measure = () => {
      frame = 0;

      const articleRect = article.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const rootTop = scrollRoot ? scrollRoot.getBoundingClientRect().top : 0;
      const nextStuck =
        articleRect.top < rootTop - 0.5 &&
        headerRect.top <= rootTop + 0.5 &&
        articleRect.bottom > rootTop + headerRect.height + 0.5;

      setHeaderStuck((current) => (current === nextStuck ? current : nextStuck));
    };

    const requestMeasure = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    const scrollTarget: HTMLElement | Window = scrollRoot ?? window;
    requestMeasure();
    scrollTarget.addEventListener('scroll', requestMeasure, { passive: true });
    window.addEventListener('resize', requestMeasure);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      scrollTarget.removeEventListener('scroll', requestMeasure);
      window.removeEventListener('resize', requestMeasure);
    };
  }, [file.id]);

  return (
    <article
      className={`mb-7 overflow-visible rounded-[8px] bg-panel [content-visibility:auto] [contain-intrinsic-size:0_520px] ${
        settings.layout === 'split' ? 'max-sm:min-w-[760px]' : ''
      }`}
      ref={fileRef}
    >
      <header
        className={`group/file-header relative isolate sticky top-0 z-10 transition-[background-color] duration-150 [transition-timing-function:var(--ease-polished)] ${
          headerStuck ? 'bg-canvas' : 'bg-transparent'
        }`}
        id={fileDomId(file.path)}
        ref={headerRef}
      >
        <div
          className={`relative z-[1] grid min-h-[42px] grid-cols-[40px_minmax(0,1fr)_auto_40px] items-center overflow-hidden border-x border-t border-b border-hairline bg-header px-2 font-mono text-xs text-fg-secondary ${
            collapsed ? 'rounded-[8px]' : 'rounded-t-[8px]'
          }`}
        >
          <FileHeaderIconAction
            ariaLabel={collapsed ? t('Expand file') : t('Collapse file')}
            onClick={toggleCollapsed}
            title={collapsed ? t('Expand file') : t('Collapse file')}
          >
            <AppIcon
              className={`transition-transform duration-150 [transition-timing-function:var(--ease-polished)] ${
                collapsed ? '-rotate-90' : 'rotate-0'
              }`}
              icon={ChevronDownIcon}
            />
          </FileHeaderIconAction>
          <span className="truncate pr-3">{file.path}</span>
          <div className="flex min-w-0 items-center justify-end gap-1">
            <FileHeaderIconAction
              ariaLabel={t('Expand full file')}
              className="opacity-0 scale-[0.96] transition-[opacity,scale,color] duration-150 [transition-timing-function:var(--ease-polished)] group-hover/file-header:opacity-100 group-hover/file-header:scale-100 group-focus-within/file-header:opacity-100 group-focus-within/file-header:scale-100 disabled:pointer-events-none disabled:opacity-0"
              disabled={foldIds.length === 0}
              display="icon"
              onClick={expandFullFile}
              title={t('Expand full file')}
            >
              <AppIcon icon={SquareArrowVerticalIcon} />
            </FileHeaderIconAction>
            <span className="mono-tabular flex gap-3 px-2">
              <span className="font-semibold text-add">+{stats.additions}</span>
              <span className="font-semibold text-delete">-{stats.deletions}</span>
            </span>
          </div>
          <FileViewedToggle
            completed={viewed}
            onToggle={toggleViewed}
            title={viewed ? t('Mark file as not viewed') : t('Mark file as viewed')}
          />
        </div>
      </header>
      {!collapsed ? (
        <div className="overflow-hidden rounded-b-[8px] border-x border-b border-hairline">
          {hunkRows.map((hunk) => (
            <HunkDiff
              comments={comments}
              draftBody={draftBody}
              draftRange={draftRange}
              expandedFolds={expandedFoldIds}
              header={hunk.header}
              hunkId={hunk.id}
              key={hunk.id}
              onDraftBodyChange={setDraftBody}
              onDraftCancel={cancelDraftComment}
              onDraftSave={saveDraftComment}
              onExpandFold={expandFold}
              onCommentDelete={onCommentDelete}
              onCommentUpdate={onCommentUpdate}
              onLinePointerEnter={updateLineSelection}
              onLineSelectionStart={startLineSelection}
              rows={hunk.rows}
              selectionRange={selectionRange}
              settings={settings}
              syntaxLines={syntaxLines}
              file={file}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function FileHeaderIconAction({
  ariaLabel,
  children,
  className,
  disabled = false,
  display = 'control',
  onClick,
  title,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  display?: 'control' | 'icon';
  onClick: () => void;
  title: string;
}) {
  const displayClass =
    display === 'icon'
      ? 'size-4 text-fg-faint hover:text-fg-secondary'
      : 'size-9 text-fg-muted hover:text-fg';

  return (
    <button
      aria-label={ariaLabel}
      className={[
        'focus-ring hit-area-40 grid place-items-center transition-[color,scale] duration-150 [transition-timing-function:var(--ease-polished)] active:scale-[0.96] disabled:cursor-default disabled:text-fg-faint',
        displayClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function HunkDiff({
  comments,
  draftBody,
  draftRange,
  expandedFolds,
  file,
  header,
  hunkId,
  onDraftBodyChange,
  onDraftCancel,
  onDraftSave,
  onExpandFold,
  onCommentDelete,
  onCommentUpdate,
  onLinePointerEnter,
  onLineSelectionStart,
  rows,
  selectionRange,
  settings,
  syntaxLines,
}: {
  comments: readonly ReviewComment[];
  draftBody: string;
  draftRange: ReviewCommentRange | null;
  expandedFolds: ReadonlySet<string>;
  file: DiffFile;
  header: string;
  hunkId: string;
  onDraftBodyChange: (value: string) => void;
  onDraftCancel: () => void;
  onDraftSave: () => void;
  onExpandFold: (foldId: string) => void;
  onCommentDelete: (commentId: string) => void;
  onCommentUpdate: (commentId: string, body: string) => void;
  onLinePointerEnter: (line: ReviewCommentLineRef) => void;
  onLineSelectionStart: (
    line: ReviewCommentLineRef,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  rows: ExpandableSplitRow[];
  selectionRange: ReviewCommentRange | null;
  settings: DiffDisplaySettings;
  syntaxLines: SyntaxLines;
}) {
  const visibleRows = rows.flatMap((row) =>
    row.kind === 'fold' && expandedFolds.has(row.id) ? row.rows : [row],
  );
  const typographyStyle = getDiffTypographyStyle(settings);

  if (settings.layout === 'unified') {
    return (
      <UnifiedPane
        ariaLabel={header}
        comments={comments}
        draftBody={draftBody}
        draftRange={draftRange}
        file={file}
        hunkId={hunkId}
        onDraftBodyChange={onDraftBodyChange}
        onDraftCancel={onDraftCancel}
        onDraftSave={onDraftSave}
        onExpandFold={onExpandFold}
        onCommentDelete={onCommentDelete}
        onCommentUpdate={onCommentUpdate}
        onLinePointerEnter={onLinePointerEnter}
        onLineSelectionStart={onLineSelectionStart}
        rows={visibleRows}
        selectionRange={selectionRange}
        settings={settings}
        style={typographyStyle}
        syntaxLines={syntaxLines}
      />
    );
  }

  const singleSidedPane = getSingleSidedSplitPane(visibleRows);
  const paneWidth: SplitPaneWidth = singleSidedPane ? 'full' : 'half';

  return (
    <div
      aria-label={header}
      className={`grid min-w-full font-mono text-xs leading-[18px] ${
        singleSidedPane ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
      }`}
      style={typographyStyle}
    >
      {singleSidedPane !== 'right' ? (
        <SplitPane
          comments={comments}
          draftBody={draftBody}
          draftRange={draftRange}
          file={file}
          hunkId={hunkId}
          onDraftBodyChange={onDraftBodyChange}
          onDraftCancel={onDraftCancel}
          onDraftSave={onDraftSave}
          onExpandFold={onExpandFold}
          onCommentDelete={onCommentDelete}
          onCommentUpdate={onCommentUpdate}
          onLinePointerEnter={onLinePointerEnter}
          onLineSelectionStart={onLineSelectionStart}
          rows={visibleRows}
          selectionRange={selectionRange}
          settings={settings}
          side="left"
          syntaxLines={syntaxLines}
          width={paneWidth}
        />
      ) : null}
      {singleSidedPane !== 'left' ? (
        <SplitPane
          comments={comments}
          draftBody={draftBody}
          draftRange={draftRange}
          file={file}
          hunkId={hunkId}
          onDraftBodyChange={onDraftBodyChange}
          onDraftCancel={onDraftCancel}
          onDraftSave={onDraftSave}
          onExpandFold={onExpandFold}
          onCommentDelete={onCommentDelete}
          onCommentUpdate={onCommentUpdate}
          onLinePointerEnter={onLinePointerEnter}
          onLineSelectionStart={onLineSelectionStart}
          rows={visibleRows}
          selectionRange={selectionRange}
          settings={settings}
          side="right"
          syntaxLines={syntaxLines}
          width={paneWidth}
        />
      ) : null}
    </div>
  );
}

function SplitPane({
  comments,
  draftBody,
  draftRange,
  file,
  hunkId,
  onCommentDelete,
  onCommentUpdate,
  onDraftBodyChange,
  onDraftCancel,
  onDraftSave,
  onExpandFold,
  onLinePointerEnter,
  onLineSelectionStart,
  rows,
  selectionRange,
  settings,
  side,
  syntaxLines,
  width,
}: {
  comments: readonly ReviewComment[];
  draftBody: string;
  draftRange: ReviewCommentRange | null;
  file: DiffFile;
  hunkId: string;
  onCommentDelete: (commentId: string) => void;
  onCommentUpdate: (commentId: string, body: string) => void;
  onDraftBodyChange: (value: string) => void;
  onDraftCancel: () => void;
  onDraftSave: () => void;
  onExpandFold: (foldId: string) => void;
  onLinePointerEnter: (line: ReviewCommentLineRef) => void;
  onLineSelectionStart: (
    line: ReviewCommentLineRef,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  rows: ExpandableSplitRow[];
  selectionRange: ReviewCommentRange | null;
  settings: DiffDisplaySettings;
  side: SplitPaneSide;
  syntaxLines: SyntaxLines;
  width: SplitPaneWidth;
}) {
  const commentsLayout = width === 'full' ? 'unified' : 'split';

  return (
    <div
      data-diff-scroll-pane
      className={`overflow-x-auto overflow-y-hidden ${
        side === 'left' && width === 'half' ? 'border-r border-r-line' : ''
      }`}
    >
      <div className={settings.wrapping ? 'min-w-full' : 'w-max min-w-full'}>
        {rows.map((row, index) => {
          if (row.kind === 'fold') {
            return (
              <FoldCell count={row.count} foldId={row.id} key={row.id} onExpand={onExpandFold} />
            );
          }

          const line = side === 'left' ? row.left : row.right;
          const pairedLine = side === 'left' ? row.right : row.left;
          const position = index;
          const lineRef = line ? createLineRef(file, hunkId, side, line, position) : null;
          const lineCommentCount = lineRef ? countCommentsForLine(lineRef, comments) : 0;
          const lineComments = lineRef ? getCommentsEndingAtLine(lineRef, comments) : [];
          const oppositeCommentCount = countCommentsEndingAtPosition({
            comments,
            hunkId,
            position,
            side: side === 'left' ? 'right' : 'left',
          });
          const savedCommentSpacerCount = Math.max(0, oppositeCommentCount - lineComments.length);
          const renderDraftEditor = lineRef && draftRange && isRangeEndLine(lineRef, draftRange);
          const renderDraftSpacer =
            !renderDraftEditor && draftRange
              ? shouldRenderSplitDraftSpacer({ draftRange, position, side })
              : false;

          return (
            <div key={`${side}:${index}`}>
              <SplitCell
                commentCount={lineCommentCount}
                line={line}
                lineRef={lineRef}
                onLinePointerEnter={onLinePointerEnter}
                onLineSelectionStart={onLineSelectionStart}
                pairedLine={pairedLine}
                selected={lineRef ? isLineInRange(lineRef, selectionRange) : false}
                settings={settings}
                side={side}
                syntaxLines={syntaxLines}
              />
              {lineComments.length ? (
                <InlineCommentRows
                  comments={lineComments}
                  layout={commentsLayout}
                  onCommentDelete={onCommentDelete}
                  onCommentUpdate={onCommentUpdate}
                />
              ) : null}
              {savedCommentSpacerCount > 0 ? (
                <InlineCommentSpacer count={savedCommentSpacerCount} />
              ) : null}
              {renderDraftEditor ? (
                <DraftCommentRow
                  layout={commentsLayout}
                  range={draftRange}
                  onCancel={onDraftCancel}
                  onChange={onDraftBodyChange}
                  onSave={onDraftSave}
                  value={draftBody}
                />
              ) : null}
              {renderDraftSpacer ? <DraftCommentSpacer /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FoldCell({
  count,
  foldId,
  onExpand,
}: {
  count: number;
  foldId: ExpandableSplitFoldRow['id'];
  onExpand: (foldId: string) => void;
}) {
  return (
    <button
      aria-label={`Expand ${count} unmodified lines`}
      className="group sticky left-0 z-[2] flex min-h-10 min-w-full items-stretch border-0 bg-diff-line px-2 py-1 text-xs text-line-number focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
      data-expand-index={foldId}
      data-separator="line-info"
      onClick={() => onExpand(foldId)}
      type="button"
    >
      <span
        className="grid min-w-0 flex-1 grid-cols-[34px_minmax(0,1fr)] overflow-hidden rounded-[4px] bg-diff-fold"
        data-separator-wrapper
      >
        <span
          className="flex items-center justify-center border-r-2 border-r-diff-line text-line-number transition-colors duration-150 group-hover:text-fg"
          data-expand-both
          data-expand-button
        >
          <ExpandAllIcon />
        </span>
        <span
          className="mono-tabular flex min-w-0 items-center px-[1ch] transition-colors duration-150 group-hover:text-fg-secondary group-hover:underline"
          data-separator-content
        >
          <span className="truncate" data-unmodified-lines>
            {count} unmodified lines
          </span>
        </span>
      </span>
    </button>
  );
}

function getSingleSidedSplitPane(rows: readonly ExpandableSplitRow[]): SplitPaneSide | null {
  let hasLeftLines = false;
  let hasRightLines = false;

  for (const row of rows) {
    if (row.kind === 'fold') continue;

    hasLeftLines ||= row.left !== null;
    hasRightLines ||= row.right !== null;

    if (hasLeftLines && hasRightLines) return null;
  }

  if (hasLeftLines === hasRightLines) return null;
  return hasLeftLines ? 'left' : 'right';
}

function ExpandAllIcon() {
  return (
    <span aria-hidden="true" className="relative block h-4 w-4">
      <span className="absolute left-1/2 top-[3px] h-[6px] w-[6px] -translate-x-1/2 rotate-45 border-l border-t border-current" />
      <span className="absolute bottom-[3px] left-1/2 h-[6px] w-[6px] -translate-x-1/2 rotate-45 border-r border-b border-current" />
    </span>
  );
}

function SplitCell({
  commentCount,
  line,
  lineRef,
  onLinePointerEnter,
  onLineSelectionStart,
  pairedLine,
  selected,
  settings,
  side,
  syntaxLines,
}: {
  commentCount: number;
  line: DiffLine | null;
  lineRef: ReviewCommentLineRef | null;
  onLinePointerEnter: (line: ReviewCommentLineRef) => void;
  onLineSelectionStart: (
    line: ReviewCommentLineRef,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  pairedLine: DiffLine | null;
  selected: boolean;
  settings: DiffDisplaySettings;
  side: 'left' | 'right';
  syntaxLines: SyntaxLines;
}) {
  const type = line?.type ?? 'blank';
  const lineNumber = line ? (side === 'left' ? line.oldLine : line.newLine) : '';
  const prefix =
    settings.indicators === 'classic'
      ? !line
        ? ''
        : line.type === 'add'
          ? '+'
          : line.type === 'delete'
            ? '-'
            : ' '
      : '';
  const content = line ? (line.content === '' ? ' ' : line.content) : '';
  const tokens = line ? syntaxLines.get(getSyntaxLineKey(line)) : undefined;
  const inlineRange =
    settings.inlineDiffs === 'word' && line && pairedLine
      ? getInlineDiffRange(line, pairedLine)
      : null;

  const background =
    settings.backgrounds && type === 'add'
      ? 'bg-diff-add'
      : settings.backgrounds && type === 'delete'
        ? 'bg-diff-delete'
        : 'bg-diff-line';
  const textColor =
    type === 'add' ? 'text-code-add' : type === 'delete' ? 'text-code-delete' : 'text-code';
  const gridTemplateColumns = getSplitLineColumns(settings);
  const contentWhitespace = settings.wrapping
    ? 'whitespace-pre-wrap break-words'
    : 'whitespace-pre';
  const selectedStyle = selected
    ? {
        boxShadow: 'inset 0 0 0 999px color-mix(in srgb, var(--color-accent) 14%, transparent)',
      }
    : commentCount > 0
      ? {
          boxShadow: 'inset 0 0 0 999px color-mix(in srgb, var(--color-accent) 8%, transparent)',
        }
      : undefined;
  const rowStyle = {
    '--diff-sticky-bg': getDiffStickyBackground(type, settings),
    gridTemplateColumns,
    ...selectedStyle,
  } as CSSProperties;

  return (
    <div
      className={`group/diff-line grid min-h-5 min-w-full ${background}`}
      data-diff-line-file={
        side === 'right' && line?.newLine !== undefined ? lineRef?.fileId : undefined
      }
      data-diff-line-new={side === 'right' && lineRef ? line?.newLine : undefined}
      onPointerEnter={() => {
        if (lineRef) onLinePointerEnter(lineRef);
      }}
      style={rowStyle}
    >
      <CommentGutter
        commentCount={commentCount}
        lineRef={lineRef}
        onLineSelectionStart={onLineSelectionStart}
        selected={selected}
      />
      {settings.lineNumbers ? (
        <span className="mono-tabular sticky left-[8px] z-[1] select-none bg-[var(--diff-sticky-bg)] px-2 text-right text-line-number">
          {lineNumber ?? ''}
        </span>
      ) : null}
      {settings.indicators === 'classic' ? (
        <span
          className={`sticky ${
            settings.lineNumbers ? 'left-[52px]' : 'left-[8px]'
          } z-[1] select-none bg-[var(--diff-sticky-bg)] text-center text-line-number`}
        >
          {prefix}
        </span>
      ) : null}
      <span className={`${contentWhitespace} px-3 pl-1 ${textColor}`}>
        <CodeContent content={content} inlineRange={inlineRange} tokens={tokens} />
      </span>
    </div>
  );
}

function UnifiedPane({
  ariaLabel,
  comments,
  draftBody,
  draftRange,
  file,
  hunkId,
  onCommentDelete,
  onCommentUpdate,
  onDraftBodyChange,
  onDraftCancel,
  onDraftSave,
  onExpandFold,
  onLinePointerEnter,
  onLineSelectionStart,
  rows,
  selectionRange,
  settings,
  style,
  syntaxLines,
}: {
  ariaLabel: string;
  comments: readonly ReviewComment[];
  draftBody: string;
  draftRange: ReviewCommentRange | null;
  file: DiffFile;
  hunkId: string;
  onCommentDelete: (commentId: string) => void;
  onCommentUpdate: (commentId: string, body: string) => void;
  onDraftBodyChange: (value: string) => void;
  onDraftCancel: () => void;
  onDraftSave: () => void;
  onExpandFold: (foldId: string) => void;
  onLinePointerEnter: (line: ReviewCommentLineRef) => void;
  onLineSelectionStart: (
    line: ReviewCommentLineRef,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  rows: ExpandableSplitRow[];
  selectionRange: ReviewCommentRange | null;
  settings: DiffDisplaySettings;
  style: CSSProperties;
  syntaxLines: SyntaxLines;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="min-w-full overflow-x-auto overflow-y-hidden font-mono text-xs"
      data-diff-scroll-pane
      style={style}
    >
      <div className={settings.wrapping ? 'min-w-full' : 'w-max min-w-full'}>
        {rows.map((row, index) => {
          if (row.kind === 'fold') {
            return (
              <FoldCell count={row.count} foldId={row.id} key={row.id} onExpand={onExpandFold} />
            );
          }

          return getUnifiedLines(row).map(({ line, pairedLine }, lineIndex) => {
            const lineRef = createLineRef(file, hunkId, 'unified', line, index * 2 + lineIndex);
            const lineCommentCount = countCommentsForLine(lineRef, comments);
            const lineComments = getCommentsEndingAtLine(lineRef, comments);
            const renderDraftEditor = draftRange && isRangeEndLine(lineRef, draftRange);

            return (
              <div key={`${index}:${line.type}:${line.oldLine ?? ''}:${line.newLine ?? ''}`}>
                <UnifiedCell
                  commentCount={lineCommentCount}
                  line={line}
                  lineRef={lineRef}
                  onLinePointerEnter={onLinePointerEnter}
                  onLineSelectionStart={onLineSelectionStart}
                  pairedLine={pairedLine}
                  selected={isLineInRange(lineRef, selectionRange)}
                  settings={settings}
                  syntaxLines={syntaxLines}
                />
                {lineComments.length ? (
                  <InlineCommentRows
                    comments={lineComments}
                    layout="unified"
                    onCommentDelete={onCommentDelete}
                    onCommentUpdate={onCommentUpdate}
                  />
                ) : null}
                {renderDraftEditor ? (
                  <DraftCommentRow
                    layout="unified"
                    range={draftRange}
                    onCancel={onDraftCancel}
                    onChange={onDraftBodyChange}
                    onSave={onDraftSave}
                    value={draftBody}
                  />
                ) : null}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}

function UnifiedCell({
  commentCount,
  line,
  lineRef,
  onLinePointerEnter,
  onLineSelectionStart,
  pairedLine,
  selected,
  settings,
  syntaxLines,
}: {
  commentCount: number;
  line: DiffLine;
  lineRef: ReviewCommentLineRef;
  onLinePointerEnter: (line: ReviewCommentLineRef) => void;
  onLineSelectionStart: (
    line: ReviewCommentLineRef,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  pairedLine: DiffLine | null;
  selected: boolean;
  settings: DiffDisplaySettings;
  syntaxLines: SyntaxLines;
}) {
  const prefix =
    settings.indicators === 'classic'
      ? line.type === 'add'
        ? '+'
        : line.type === 'delete'
          ? '-'
          : ' '
      : '';
  const content = line.content === '' ? ' ' : line.content;
  const tokens = syntaxLines.get(getSyntaxLineKey(line));
  const inlineRange =
    settings.inlineDiffs === 'word' && pairedLine ? getInlineDiffRange(line, pairedLine) : null;
  const background =
    settings.backgrounds && line.type === 'add'
      ? 'bg-diff-add'
      : settings.backgrounds && line.type === 'delete'
        ? 'bg-diff-delete'
        : 'bg-diff-line';
  const textColor =
    line.type === 'add'
      ? 'text-code-add'
      : line.type === 'delete'
        ? 'text-code-delete'
        : 'text-code';
  const contentWhitespace = settings.wrapping
    ? 'whitespace-pre-wrap break-words'
    : 'whitespace-pre';
  const selectedStyle = selected
    ? {
        boxShadow: 'inset 0 0 0 999px color-mix(in srgb, var(--color-accent) 14%, transparent)',
      }
    : commentCount > 0
      ? {
          boxShadow: 'inset 0 0 0 999px color-mix(in srgb, var(--color-accent) 8%, transparent)',
        }
      : undefined;
  const rowStyle = {
    '--diff-sticky-bg': getDiffStickyBackground(line.type, settings),
    gridTemplateColumns: getUnifiedLineColumns(settings),
    ...selectedStyle,
  } as CSSProperties;

  return (
    <div
      className={`group/diff-line grid min-h-5 min-w-full ${background}`}
      data-diff-line-file={line.newLine !== undefined ? lineRef.fileId : undefined}
      data-diff-line-new={line.newLine}
      onPointerEnter={() => onLinePointerEnter(lineRef)}
      style={rowStyle}
    >
      <CommentGutter
        commentCount={commentCount}
        lineRef={lineRef}
        onLineSelectionStart={onLineSelectionStart}
        selected={selected}
      />
      {settings.lineNumbers ? (
        <>
          <span className="mono-tabular sticky left-[8px] z-[1] select-none bg-[var(--diff-sticky-bg)] px-2 text-right text-line-number">
            {line.oldLine ?? ''}
          </span>
          <span className="mono-tabular sticky left-[52px] z-[1] select-none bg-[var(--diff-sticky-bg)] px-2 text-right text-line-number">
            {line.newLine ?? ''}
          </span>
        </>
      ) : null}
      {settings.indicators === 'classic' ? (
        <span
          className={`sticky ${
            settings.lineNumbers ? 'left-[96px]' : 'left-[8px]'
          } z-[1] select-none bg-[var(--diff-sticky-bg)] text-center text-line-number`}
        >
          {prefix}
        </span>
      ) : null}
      <span className={`${contentWhitespace} px-3 pl-1 ${textColor}`}>
        <CodeContent content={content} inlineRange={inlineRange} tokens={tokens} />
      </span>
    </div>
  );
}

function CommentGutter({
  commentCount,
  lineRef,
  onLineSelectionStart,
  selected,
}: {
  commentCount: number;
  lineRef: ReviewCommentLineRef | null;
  onLineSelectionStart: (
    line: ReviewCommentLineRef,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  selected: boolean;
}) {
  const { t } = useI18n();
  const commented = commentCount > 0;
  const visibleClass = selected
    ? 'pointer-events-none scale-[0.25] opacity-0'
    : commented
      ? 'pointer-events-none scale-[0.25] opacity-0'
      : 'bg-control text-fg-muted opacity-0 group-hover/diff-line:opacity-100 group-focus-within/diff-line:opacity-100 hover:bg-accent hover:text-accent-fg';
  const indicatorClass = selected || commented ? 'bg-add' : '';

  return (
    <span className="pointer-events-none sticky left-0 z-[3] block h-full min-h-0 w-2 select-none overflow-visible bg-[var(--diff-sticky-bg)]">
      {selected || commented ? (
        <span
          aria-hidden="true"
          className={`absolute left-0 top-0 h-full w-1 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-add)_22%,transparent)] ${indicatorClass}`}
        />
      ) : null}
      {lineRef ? (
        <button
          aria-label={t('Add comment on {path} line {line}', {
            line: lineRef.lineNumber,
            path: lineRef.filePath,
          })}
          className={[
            'button-raised focus-ring pressable pointer-events-auto absolute left-1 top-1/2 -mt-2.5 grid size-5 place-items-center rounded-[7px] transition-[background-color,box-shadow,color,opacity,scale,translate] duration-150 [transition-timing-function:var(--ease-polished)]',
            visibleClass,
          ].join(' ')}
          onPointerDown={(event) => onLineSelectionStart(lineRef, event)}
          title={t('Add comment')}
          type="button"
        >
          <AppIcon icon={PlusSignIcon} size={12} />
        </button>
      ) : null}
    </span>
  );
}

function InlineCommentRows({
  comments,
  layout,
  onCommentDelete,
  onCommentUpdate,
}: {
  comments: readonly ReviewComment[];
  layout: 'split' | 'unified';
  onCommentDelete: (commentId: string) => void;
  onCommentUpdate: (commentId: string, body: string) => void;
}) {
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const cardHeights = comments.map((comment) =>
    comment.id === editingCommentId ? COMMENT_CARD_EDIT_HEIGHT : COMMENT_CARD_HEIGHT,
  );

  useEffect(() => {
    if (editingCommentId && !comments.some((comment) => comment.id === editingCommentId)) {
      setEditingCommentId(null);
    }
  }, [comments, editingCommentId]);

  return (
    <div
      className={`sticky left-0 z-[2] grid gap-2 bg-transparent py-2 pr-0 pl-2 transition-[height] duration-150 [transition-timing-function:var(--ease-polished)] max-lg:w-[min(42rem,calc(100vw_-_40px))] max-lg:max-w-[calc(100vw_-_40px)] ${getCommentRowWidthClass(
        layout,
      )}`}
      style={{ height: getCommentRowsHeight(cardHeights) }}
    >
      {comments.map((comment) => (
        <InlineCommentCard
          comment={comment}
          editing={comment.id === editingCommentId}
          key={comment.id}
          onEditingChange={(editing) => {
            setEditingCommentId(editing ? comment.id : null);
          }}
          onDelete={() => onCommentDelete(comment.id)}
          onUpdate={(body) => onCommentUpdate(comment.id, body)}
        />
      ))}
    </div>
  );
}

function InlineCommentCard({
  comment,
  editing,
  onDelete,
  onEditingChange,
  onUpdate,
}: {
  comment: ReviewComment;
  editing: boolean;
  onDelete: () => void;
  onEditingChange: (editing: boolean) => void;
  onUpdate: (body: string) => void;
}) {
  const { t } = useI18n();
  const [draftBody, setDraftBody] = useState(comment.body);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trimmedDraftBody = draftBody.trim();
  const saveDisabled = !trimmedDraftBody || trimmedDraftBody === comment.body;

  useEffect(() => {
    if (!editing) {
      setDraftBody(comment.body);
    }
  }, [comment.body, editing]);

  useEffect(() => {
    if (!editing) return;

    const textarea = textareaRef.current;
    textarea?.focus();
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [editing]);

  const cancelEdit = () => {
    setDraftBody(comment.body);
    onEditingChange(false);
  };

  const saveEdit = () => {
    if (saveDisabled) return;

    onUpdate(trimmedDraftBody);
    setDraftBody(trimmedDraftBody);
    onEditingChange(false);
  };

  return (
    <section
      className="surface-panel grid grid-rows-[auto_minmax(0,1fr)] rounded-[8px] bg-panel p-3 transition-[height] duration-150 [transition-timing-function:var(--ease-polished)]"
      style={{ height: editing ? COMMENT_CARD_EDIT_HEIGHT : COMMENT_CARD_HEIGHT }}
    >
      <header className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2 text-[11px] leading-4 text-fg-muted">
          <AppIcon className="shrink-0 text-add" icon={Comment01Icon} size={14} />
          <span className="font-medium text-fg-secondary">{t('Review comment')}</span>
          <span className="mono-tabular min-w-0 truncate">
            {getReviewCommentLineLabel(comment.range)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label={t('Edit review comment')}
            aria-pressed={editing}
            className={`focus-ring hit-area-40 grid size-7 place-items-center rounded-[7px] transition-[background-color,color,scale] duration-150 [transition-timing-function:var(--ease-polished)] hover:bg-hover hover:text-fg active:scale-[0.96] ${
              editing ? 'bg-hover text-fg' : 'text-fg-faint'
            }`}
            onClick={() => onEditingChange(!editing)}
            title={t('Edit comment')}
            type="button"
          >
            <AppIcon icon={PencilEdit02Icon} size={14} />
          </button>
          <button
            aria-label={t('Delete review comment')}
            className="focus-ring hit-area-40 grid size-7 place-items-center rounded-[7px] text-fg-faint transition-[background-color,color,scale] duration-150 [transition-timing-function:var(--ease-polished)] hover:bg-hover hover:text-error active:scale-[0.96]"
            onClick={onDelete}
            title={t('Delete comment')}
            type="button"
          >
            <AppIcon icon={Delete02Icon} size={14} />
          </button>
        </div>
      </header>
      {editing ? (
        <div className="mt-2 grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2">
          <textarea
            aria-label={t('Edit review comment')}
            className="min-h-0 resize-none rounded-[6px] bg-control px-2.5 py-2 text-sm leading-[1.4] text-fg shadow-control outline-none transition-[box-shadow] duration-150 [transition-timing-function:var(--ease-polished)] placeholder:text-fg-faint focus:shadow-[var(--shadow-focus)]"
            onChange={(event) => setDraftBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelEdit();
              }
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                saveEdit();
              }
            }}
            ref={textareaRef}
            value={draftBody}
          />
          <div className="flex justify-end gap-1.5">
            <Button onClick={cancelEdit} size="xs" variant="ghost">
              <AppIcon icon={Cancel02Icon} />
              {t('Cancel')}
            </Button>
            <Button disabled={saveDisabled} onClick={saveEdit} size="xs" variant="success">
              <AppIcon icon={SaveIcon} />
              {t('Save')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 line-clamp-3 whitespace-pre-line text-pretty text-sm leading-[1.45] text-fg-secondary">
          {comment.body}
        </p>
      )}
    </section>
  );
}

function InlineCommentSpacer({ count }: { count: number }) {
  return (
    <div
      aria-hidden="true"
      className="min-w-full bg-diff-line"
      style={{ height: getCommentRowsHeight(count) }}
    />
  );
}

function DraftCommentRow({
  layout,
  onCancel,
  onChange,
  onSave,
  range,
  value,
}: {
  layout: 'split' | 'unified';
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  range: ReviewCommentRange;
  value: string;
}) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSave = value.trim().length > 0;

  useEffect(() => {
    textareaRef.current?.focus();
  }, [range]);

  return (
    <div
      className={`sticky left-0 z-[3] bg-transparent py-2 pr-0 pl-2 max-lg:w-[min(42rem,calc(100vw_-_40px))] max-lg:max-w-[calc(100vw_-_40px)] ${getCommentRowWidthClass(
        layout,
      )}`}
      style={{ height: COMMENT_EDITOR_ROW_HEIGHT }}
    >
      <form
        className="surface-panel grid h-full grid-rows-[auto_minmax(0,1fr)_auto] rounded-[8px] bg-panel p-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) onSave();
        }}
      >
        <div className="flex min-w-0 items-center gap-2 px-1 pb-2 text-[11px] text-fg-muted">
          <AppIcon className="shrink-0 text-add" icon={Comment01Icon} size={14} />
          <span className="mono-tabular min-w-0 truncate">{getReviewCommentLocation(range)}</span>
          <span className="shrink-0 text-fg-faint">{getReviewCommentLineLabel(range)}</span>
        </div>
        <textarea
          aria-label={t('Review comment')}
          className="min-h-0 resize-none rounded-[6px] bg-control px-2.5 py-2 text-sm leading-[1.4] text-fg shadow-control outline-none transition-[box-shadow] duration-150 [transition-timing-function:var(--ease-polished)] placeholder:text-fg-faint focus:shadow-[var(--shadow-focus)]"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && canSave) {
              event.preventDefault();
              onSave();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
          placeholder={t('Leave a review comment...')}
          ref={textareaRef}
          value={value}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button onClick={onCancel} size="xs" variant="ghost">
            <AppIcon icon={Cancel02Icon} />
            {t('Cancel')}
          </Button>
          <Button disabled={!canSave} size="xs" type="submit">
            <AppIcon icon={Sent02Icon} />
            {t('Add comment')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function DraftCommentSpacer() {
  return (
    <div
      aria-hidden="true"
      className="min-w-full bg-diff-line"
      style={{ height: COMMENT_EDITOR_ROW_HEIGHT }}
    />
  );
}

function getCommentRowWidthClass(layout: 'split' | 'unified') {
  return layout === 'split'
    ? 'w-[min(34rem,calc((100vw_-_var(--review-pane-width,376px)_-_96px)_/_2))] max-w-[calc((100vw_-_var(--review-pane-width,376px)_-_96px)_/_2)]'
    : 'w-[min(42rem,calc(100vw_-_var(--review-pane-width,376px)_-_96px))] max-w-[calc(100vw_-_var(--review-pane-width,376px)_-_96px)]';
}

function getCommentRowsHeight(cards: number | readonly number[]) {
  const cardHeights =
    typeof cards === 'number' ? Array.from({ length: cards }, () => COMMENT_CARD_HEIGHT) : cards;

  if (cardHeights.length <= 0) return 0;
  return (
    COMMENT_CARD_ROW_PADDING_Y +
    cardHeights.reduce((total, height) => total + height, 0) +
    (cardHeights.length - 1) * COMMENT_CARD_ROW_GAP
  );
}

function CodeContent({
  content,
  inlineRange,
  tokens,
}: {
  content: string;
  inlineRange: InlineRange | null;
  tokens?: SyntaxToken[];
}) {
  if (!tokens?.length) {
    return renderInlineDiffText(content, inlineRange);
  }

  let offset = 0;
  return tokens.map((token, index) => {
    const start = offset;
    const end = start + token.content.length;
    offset = end;

    return (
      <SyntaxTokenContent
        inlineRange={inlineRange}
        key={index}
        token={token}
        tokenEnd={end}
        tokenStart={start}
      />
    );
  });
}

function SyntaxTokenContent({
  inlineRange,
  token,
  tokenEnd,
  tokenStart,
}: {
  inlineRange: InlineRange | null;
  token: SyntaxToken;
  tokenEnd: number;
  tokenStart: number;
}) {
  const style = getSyntaxTokenStyle(token);
  if (!inlineRange || inlineRange.end <= tokenStart || inlineRange.start >= tokenEnd) {
    return (
      <span style={style}>
        <SymbolText text={token.content} />
      </span>
    );
  }

  const highlightStart = Math.max(inlineRange.start, tokenStart) - tokenStart;
  const highlightEnd = Math.min(inlineRange.end, tokenEnd) - tokenStart;

  return (
    <span style={style}>
      <SymbolText text={token.content.slice(0, highlightStart)} />
      <span
        style={{
          ...style,
          backgroundColor: 'color-mix(in srgb, var(--color-warning) 24%, transparent)',
        }}
      >
        <SymbolText text={token.content.slice(highlightStart, highlightEnd)} />
      </span>
      <SymbolText text={token.content.slice(highlightEnd)} />
    </span>
  );
}

function SymbolText({ text }: { text: string }) {
  const { t } = useI18n();
  const navigation = useSymbolNavigation();
  if (!navigation || !text) return text;

  const segments = splitSymbolSegments(text, navigation.hasSymbol);
  if (!segments.some((segment) => segment.symbol)) return text;

  return segments.map((segment, index) => {
    if (!segment.symbol) return segment.text;

    return (
      <span
        className="symbol-ref"
        key={index}
        onClick={(event) => {
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed) return;

          event.stopPropagation();
          navigation.openSymbol(segment.text, { x: event.clientX, y: event.clientY });
        }}
        title={t('Go to definition')}
      >
        {segment.text}
      </span>
    );
  });
}

function renderInlineDiffText(content: string, inlineRange: InlineRange | null) {
  if (!inlineRange) return <SymbolText text={content} />;

  return (
    <>
      <SymbolText text={content.slice(0, inlineRange.start)} />
      <span
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-warning) 24%, transparent)' }}
      >
        <SymbolText text={content.slice(inlineRange.start, inlineRange.end)} />
      </span>
      <SymbolText text={content.slice(inlineRange.end)} />
    </>
  );
}

function getSyntaxTokenStyle(token: SyntaxToken): CSSProperties {
  const style: CSSProperties = {};
  if (token.color) {
    style.color = token.color;
  }
  if (token.fontStyle !== undefined && token.fontStyle > 0) {
    if ((token.fontStyle & 1) === 1) {
      style.fontStyle = 'italic';
    }
    if ((token.fontStyle & 2) === 2) {
      style.fontWeight = 700;
    }
    if ((token.fontStyle & 4) === 4) {
      style.textDecoration = 'underline';
    }
  }
  return style;
}

const DIFF_LINE_HEIGHTS_BY_FONT_SIZE: Record<
  DiffDisplaySettings['fontSize'],
  Record<DiffDisplaySettings['lineHeight'], string>
> = {
  12: { compact: '18px', normal: '21px', relaxed: '24px' },
  13: { compact: '19px', normal: '22px', relaxed: '26px' },
  14: { compact: '21px', normal: '24px', relaxed: '28px' },
};

function getDiffTypographyStyle(settings: DiffDisplaySettings): CSSProperties {
  const lineHeight = DIFF_LINE_HEIGHTS_BY_FONT_SIZE[settings.fontSize][settings.lineHeight];

  return {
    fontFamily:
      settings.fontFamily === 'system-mono'
        ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
        : undefined,
    fontSize: `${settings.fontSize}px`,
    fontVariantLigatures: settings.ligatures ? 'normal' : 'none',
    lineHeight,
  };
}

function getDiffStickyBackground(type: DiffLine['type'] | 'blank', settings: DiffDisplaySettings) {
  if (!settings.backgrounds) {
    return 'var(--color-diff-line)';
  }
  if (type === 'add') {
    return 'var(--color-diff-add-sticky)';
  }
  if (type === 'delete') {
    return 'var(--color-diff-delete-sticky)';
  }
  return 'var(--color-diff-line)';
}

function getSplitLineColumns(settings: DiffDisplaySettings) {
  const contentColumn = settings.wrapping ? 'minmax(0,1fr)' : 'max-content';
  if (settings.lineNumbers && settings.indicators === 'classic') {
    return `8px 44px 24px ${contentColumn}`;
  }
  if (settings.lineNumbers) {
    return `8px 44px ${contentColumn}`;
  }
  if (settings.indicators === 'classic') {
    return `8px 24px ${contentColumn}`;
  }
  return `8px ${contentColumn}`;
}

function getUnifiedLineColumns(settings: DiffDisplaySettings) {
  const contentColumn = settings.wrapping ? 'minmax(0,1fr)' : 'max-content';
  if (settings.lineNumbers && settings.indicators === 'classic') {
    return `8px 44px 44px 24px ${contentColumn}`;
  }
  if (settings.lineNumbers) {
    return `8px 44px 44px ${contentColumn}`;
  }
  if (settings.indicators === 'classic') {
    return `8px 24px ${contentColumn}`;
  }
  return `8px ${contentColumn}`;
}

function getUnifiedLines(
  row: SplitLineRow,
): Array<{ line: DiffLine; pairedLine: DiffLine | null }> {
  if (row.left && row.right && row.left === row.right) {
    return [{ line: row.left, pairedLine: null }];
  }

  const lines: Array<{ line: DiffLine; pairedLine: DiffLine | null }> = [];
  if (row.left) {
    lines.push({ line: row.left, pairedLine: row.right });
  }
  if (row.right && row.right !== row.left) {
    lines.push({ line: row.right, pairedLine: row.left });
  }
  return lines;
}

function findFoldIdForNewLine(
  hunkRows: ReadonlyArray<{ id: string; rows: ExpandableSplitRow[] }>,
  lineNumber: number,
): string | null {
  for (const hunk of hunkRows) {
    for (const row of hunk.rows) {
      if (row.kind !== 'fold') continue;

      const containsLine = row.rows.some(
        (hidden) => hidden.right?.newLine === lineNumber || hidden.left?.newLine === lineNumber,
      );
      if (containsLine) return row.id;
    }
  }

  return null;
}

function buildVisibleLineRefs(
  file: DiffFile,
  hunkRows: Array<{ id: string; rows: ExpandableSplitRow[] }>,
  expandedFolds: ReadonlySet<string>,
  layout: DiffDisplaySettings['layout'],
) {
  const refs: ReviewCommentLineRef[] = [];

  for (const hunk of hunkRows) {
    const rows = hunk.rows.flatMap((row) =>
      row.kind === 'fold' && expandedFolds.has(row.id) ? row.rows : [row],
    );

    rows.forEach((row, rowIndex) => {
      if (row.kind === 'fold') return;

      if (layout === 'unified') {
        getUnifiedLines(row).forEach(({ line }, lineIndex) => {
          refs.push(createLineRef(file, hunk.id, 'unified', line, rowIndex * 2 + lineIndex));
        });
        return;
      }

      if (row.left) {
        refs.push(createLineRef(file, hunk.id, 'left', row.left, rowIndex));
      }
      if (row.right) {
        refs.push(createLineRef(file, hunk.id, 'right', row.right, rowIndex));
      }
    });
  }

  return refs;
}

function createLineRef(
  file: DiffFile,
  hunkId: string,
  side: ReviewCommentSide,
  line: DiffLine,
  position: number,
): ReviewCommentLineRef {
  return {
    content: line.content,
    fileId: file.id,
    filePath: file.path,
    hunkId,
    lineNumber: getCommentLineNumber(line, side),
    newLine: line.newLine,
    oldLine: line.oldLine,
    position,
    side,
    type: line.type,
  };
}

function getCommentLineNumber(line: DiffLine, side: ReviewCommentSide) {
  if (side === 'left') return line.oldLine ?? line.newLine ?? 0;
  if (side === 'right') return line.newLine ?? line.oldLine ?? 0;
  if (line.type === 'delete') return line.oldLine ?? line.newLine ?? 0;
  return line.newLine ?? line.oldLine ?? 0;
}

function createSelectionRange(
  anchor: ReviewCommentLineRef,
  current: ReviewCommentLineRef,
  visibleLineRefs: readonly ReviewCommentLineRef[],
): ReviewCommentRange | null {
  if (!isSameSelectionSurface(anchor, current)) {
    return createSelectionRange(anchor, anchor, visibleLineRefs);
  }

  const startPosition = Math.min(anchor.position, current.position);
  const endPosition = Math.max(anchor.position, current.position);
  const lines = visibleLineRefs.filter(
    (line) =>
      isSameSelectionSurface(anchor, line) &&
      line.position >= startPosition &&
      line.position <= endPosition,
  );

  if (lines.length === 0) return null;

  return {
    end: lines[lines.length - 1],
    fileId: anchor.fileId,
    filePath: anchor.filePath,
    hunkId: anchor.hunkId,
    lines,
    side: anchor.side,
    start: lines[0],
  };
}

function isSameSelectionSurface(left: ReviewCommentLineRef, right: ReviewCommentLineRef) {
  return left.fileId === right.fileId && left.hunkId === right.hunkId && left.side === right.side;
}

function isLineInRange(line: ReviewCommentLineRef, range: ReviewCommentRange | null) {
  if (!range || !isSameSelectionSurface(line, range.start)) return false;

  return line.position >= range.start.position && line.position <= range.end.position;
}

function isRangeEndLine(line: ReviewCommentLineRef, range: ReviewCommentRange) {
  return getReviewCommentLineKey(line) === getReviewCommentLineKey(range.end);
}

function countCommentsForLine(line: ReviewCommentLineRef, comments: readonly ReviewComment[]) {
  return comments.filter((comment) => isLineInRange(line, comment.range)).length;
}

function getCommentsEndingAtLine(line: ReviewCommentLineRef, comments: readonly ReviewComment[]) {
  return comments.filter((comment) => isRangeEndLine(line, comment.range));
}

function countCommentsEndingAtPosition({
  comments,
  hunkId,
  position,
  side,
}: {
  comments: readonly ReviewComment[];
  hunkId: string;
  position: number;
  side: 'left' | 'right';
}) {
  return comments.filter(
    (comment) =>
      comment.range.hunkId === hunkId &&
      comment.range.side === side &&
      comment.range.end.position === position,
  ).length;
}

function shouldRenderSplitDraftSpacer({
  draftRange,
  position,
  side,
}: {
  draftRange: ReviewCommentRange;
  position: number;
  side: 'left' | 'right';
}) {
  if (draftRange.side === 'unified' || draftRange.side === side) return false;

  return draftRange.end.position === position;
}

function getInlineDiffRange(line: DiffLine, pairedLine: DiffLine): InlineRange | null {
  if (line.type === 'context' || pairedLine.type === 'context') return null;

  const content = line.content;
  const pairedContent = pairedLine.content;
  let start = 0;
  while (
    start < content.length &&
    start < pairedContent.length &&
    content[start] === pairedContent[start]
  ) {
    start += 1;
  }

  let end = content.length;
  let pairedEnd = pairedContent.length;
  while (end > start && pairedEnd > start && content[end - 1] === pairedContent[pairedEnd - 1]) {
    end -= 1;
    pairedEnd -= 1;
  }

  return start < end ? { end, start } : null;
}

function useSyntaxLines(file: DiffFile, syntaxTheme: ResolvedSyntaxTheme): SyntaxLines {
  const [syntaxLines, setSyntaxLines] = useState<SyntaxLines>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    const lines = file.hunks.flatMap((hunk) => hunk.lines);
    setSyntaxLines(new Map());

    if (syntaxTheme === 'plain' || !file.language || lines.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    highlightLines(lines, file.language, syntaxTheme)
      .then((next) => {
        if (!cancelled) {
          setSyntaxLines(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSyntaxLines(new Map());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file.hunks, file.language, syntaxTheme]);

  return syntaxLines;
}

function useResolvedSyntaxTheme(
  syntaxTheme: DiffDisplaySettings['syntaxTheme'],
): ResolvedSyntaxTheme {
  const [colorTheme, setColorTheme] = useState(() => getDocumentColorTheme());

  useEffect(() => {
    if (syntaxTheme !== 'auto' || typeof document === 'undefined') {
      return;
    }

    const updateColorTheme = () => setColorTheme(getDocumentColorTheme());
    updateColorTheme();

    const observer = new MutationObserver(updateColorTheme);
    observer.observe(document.documentElement, {
      attributeFilter: ['data-theme'],
      attributes: true,
    });

    const mediaQuery =
      typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery?.addEventListener('change', updateColorTheme);

    return () => {
      observer.disconnect();
      mediaQuery?.removeEventListener('change', updateColorTheme);
    };
  }, [syntaxTheme]);

  if (syntaxTheme === 'auto') {
    return colorTheme === 'light' ? 'github-light' : 'github-dark';
  }

  return syntaxTheme;
}

function getDocumentColorTheme(): 'dark' | 'light' {
  if (typeof document === 'undefined') {
    return 'light';
  }

  if (document.documentElement.dataset.theme === 'dark') {
    return 'dark';
  }

  if (document.documentElement.dataset.theme === 'light') {
    return 'light';
  }

  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

async function highlightLines(
  lines: DiffLine[],
  language: string,
  syntaxTheme: Exclude<ResolvedSyntaxTheme, 'plain'>,
): Promise<SyntaxLines> {
  const lang = normalizeShikiLanguage(language);
  if (!lang) {
    return new Map();
  }

  const highlighter = await getSyntaxHighlighter(lang);

  const result = highlighter.codeToTokens(lines.map((line) => line.content).join('\n'), {
    lang,
    theme: syntaxTheme,
  });
  const next = new Map<string, SyntaxToken[]>();
  lines.forEach((line, index) => {
    next.set(getSyntaxLineKey(line), result.tokens[index] ?? []);
  });
  return next;
}

function normalizeShikiLanguage(language: string) {
  if (language === 'shell') return 'bash';
  if (language === 'yml') return 'yaml';
  return supportedSyntaxLanguages.has(language) ? language : null;
}

function getSyntaxLineKey(line: DiffLine) {
  return [line.type, line.oldLine ?? '', line.newLine ?? '', line.content].join(':');
}

function getSyntaxHighlighter(language: string): Promise<SyntaxHighlighter> {
  const existing = syntaxHighlighterPromises.get(language);
  if (existing) {
    return existing;
  }

  const next = createSyntaxHighlighter(language);
  syntaxHighlighterPromises.set(language, next);
  return next;
}

async function createSyntaxHighlighter(language: string): Promise<SyntaxHighlighter> {
  const [
    { createHighlighterCore },
    { createJavaScriptRegexEngine },
    githubDark,
    githubLight,
    syntaxLanguage,
  ] = await Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
    import('shiki/themes/github-dark.mjs'),
    import('shiki/themes/github-light.mjs'),
    importSyntaxLanguage(language),
  ]);

  return createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    langs: [syntaxLanguage.default],
    themes: [githubDark.default, githubLight.default],
  }) as Promise<SyntaxHighlighter>;
}

function importSyntaxLanguage(language: string): Promise<SyntaxLanguageModule> {
  switch (language) {
    case 'bash':
      return import('shiki/langs/sh.mjs');
    case 'css':
      return import('shiki/langs/css.mjs');
    case 'go':
      return import('shiki/langs/go.mjs');
    case 'html':
      return import('shiki/langs/html.mjs');
    case 'java':
      return import('shiki/langs/java.mjs');
    case 'javascript':
      return import('shiki/langs/javascript.mjs');
    case 'json':
      return import('shiki/langs/json.mjs');
    case 'kotlin':
      return import('shiki/langs/kotlin.mjs');
    case 'markdown':
      return import('shiki/langs/markdown.mjs');
    case 'python':
      return import('shiki/langs/python.mjs');
    case 'rust':
      return import('shiki/langs/rust.mjs');
    case 'sql':
      return import('shiki/langs/sql.mjs');
    case 'swift':
      return import('shiki/langs/swift.mjs');
    case 'toml':
      return import('shiki/langs/toml.mjs');
    case 'typescript':
      return import('shiki/langs/typescript.mjs');
    case 'yaml':
      return import('shiki/langs/yaml.mjs');
    default:
      throw new Error(`Unsupported syntax language: ${language}`);
  }
}
