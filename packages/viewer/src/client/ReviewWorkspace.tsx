import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import ArrowRight02Icon from '@hugeicons/core-free-icons/ArrowRight02Icon';
import ChevronDownIcon from '@hugeicons/core-free-icons/ChevronDownIcon';
import ChevronLeftIcon from '@hugeicons/core-free-icons/ChevronLeftIcon';
import ChatGptIcon from '@hugeicons/core-free-icons/ChatGptIcon';
import ClaudeIcon from '@hugeicons/core-free-icons/ClaudeIcon';
import Comment01Icon from '@hugeicons/core-free-icons/Comment01Icon';
import CursorRemoveSelection02Icon from '@hugeicons/core-free-icons/CursorRemoveSelection02Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import FileDiffIcon from '@hugeicons/core-free-icons/FileDiffIcon';
import GitBranchIcon from '@hugeicons/core-free-icons/GitBranchIcon';
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon';
import SaveIcon from '@hugeicons/core-free-icons/SaveIcon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import SlidersHorizontalIcon from '@hugeicons/core-free-icons/SlidersHorizontalIcon';
import type { GitStatusEntry } from '@pierre/trees';
import { FileTree as PierreFileTree, useFileTree } from '@pierre/trees/react';
import type { DiffFile, ReviewChapter, ReviewTour } from '@review-tour/schema';
import { Button } from '#/components/ui/button';
import { Checkbox } from '#/components/ui/checkbox';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { Popover, PopoverPopup, PopoverTrigger } from '#/components/ui/popover';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select';
import { Switch } from '#/components/ui/switch';
import { toastManager } from '#/components/ui/toast';
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group';
import { getChapterDiffFiles, getChapterStats, getFileStats } from '../reviewModel';
import type { DiffDisplaySettings } from './diffSettings';
import type { DiffFoldState } from './diffFoldState';
import { fileDomId } from './dom';
import { DiffViewer } from './DiffViewer';
import { MarkdownInlineText, MarkdownText } from './MarkdownText';
import {
  formatReviewCommentsForCodex,
  getReviewCommentLineLabel,
  getReviewCommentLocation,
  getReviewCommentSnippet,
  type ReviewComment,
} from './reviewComments';
import { ThemeModeControl } from './theme';
import { AppIcon, ChapterReviewedToggle, IconButton, RiskBadge, SideBlock } from './ui';

const REVIEW_PANE_WIDTH_STORAGE_KEY = 'review-tour:review-pane-width';
const DEFAULT_REVIEW_PANE_WIDTH = 376;
const MIN_REVIEW_PANE_WIDTH = 304;
const MAX_REVIEW_PANE_WIDTH = 640;
const MIN_DIFF_PANE_WIDTH = 560;
const FILE_TREE_ITEM_HEIGHT = 24;
const FILE_TREE_MIN_HEIGHT = 160;
const FILE_TREE_VERTICAL_PADDING = 12;
type ReviewWorkspaceTab = 'chapters' | 'comments';

export function ReviewWorkspace({
  chapter,
  chapterCompleted,
  checkedReviewQuestionIds,
  comments,
  diffFoldState,
  diffSettings,
  fileFilter,
  onBack,
  onChapterCompletedToggle,
  onCommentAdd,
  onCommentDelete,
  onCommentUpdate,
  onDiffSettingsChange,
  onFileCollapsedChange,
  onFoldExpand,
  onFoldsExpand,
  onFileViewedToggle,
  onFileFilter,
  onNext,
  onPrevious,
  onChapterSelect,
  onReviewQuestionCheckedToggle,
  onSearchOpen,
  tour,
  viewedFileIds,
}: {
  chapter: ReviewChapter;
  chapterCompleted: boolean;
  checkedReviewQuestionIds: ReadonlySet<string>;
  comments: readonly ReviewComment[];
  diffFoldState: DiffFoldState;
  diffSettings: DiffDisplaySettings;
  fileFilter: string;
  onBack: () => void;
  onChapterCompletedToggle: () => void;
  onCommentAdd: (comment: ReviewComment) => void;
  onCommentDelete: (commentId: string) => void;
  onCommentUpdate: (commentId: string, body: string) => void;
  onDiffSettingsChange: (settings: DiffDisplaySettings) => void;
  onFileCollapsedChange: (fileId: string, collapsed: boolean) => void;
  onFoldExpand: (foldId: string) => void;
  onFoldsExpand: (foldIds: readonly string[]) => void;
  onFileViewedToggle: (fileId: string) => void;
  onFileFilter: (value: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onChapterSelect: (chapter: ReviewChapter) => void;
  onReviewQuestionCheckedToggle: (questionId: string) => void;
  onSearchOpen: () => void;
  tour: ReviewTour;
  viewedFileIds: ReadonlySet<string>;
}) {
  const workspaceRef = useRef<HTMLElement>(null);
  const files = useMemo(() => getChapterDiffFiles(tour, chapter), [tour, chapter]);
  const visibleFiles = useMemo(() => {
    const query = fileFilter.trim().toLowerCase();
    if (!query) return files;
    return files.filter((file) => file.path.toLowerCase().includes(query));
  }, [fileFilter, files]);
  const stats = getChapterStats(tour, chapter);
  const [reviewPaneWidth, setReviewPaneWidth] = useState(readReviewPaneWidth);
  const [resizingReviewPane, setResizingReviewPane] = useState(false);
  const [activeTab, setActiveTab] = useState<ReviewWorkspaceTab>('chapters');
  const workspaceStyle = {
    '--review-pane-width': `${reviewPaneWidth}px`,
  } as CSSProperties;

  const updateReviewPaneWidth = useCallback((clientX: number) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const rect = workspace.getBoundingClientRect();
    const nextWidth = clampReviewPaneWidth(clientX - rect.left, rect.width);
    setReviewPaneWidth(nextWidth);
    writeReviewPaneWidth(nextWidth);
  }, []);

  const resizeReviewPaneBy = useCallback((delta: number) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    setReviewPaneWidth((currentWidth) => {
      const nextWidth = clampReviewPaneWidth(
        currentWidth + delta,
        workspace.getBoundingClientRect().width,
      );
      writeReviewPaneWidth(nextWidth);
      return nextWidth;
    });
  }, []);

  useEffect(() => {
    if (!resizingReviewPane || typeof window === 'undefined') return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onPointerMove = (event: PointerEvent) => {
      event.preventDefault();
      updateReviewPaneWidth(event.clientX);
    };

    const onPointerUp = () => {
      setResizingReviewPane(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [resizingReviewPane, updateReviewPaneWidth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onResize = () => {
      const workspace = workspaceRef.current;
      if (!workspace) return;

      setReviewPaneWidth((currentWidth) => {
        const nextWidth = clampReviewPaneWidth(
          currentWidth,
          workspace.getBoundingClientRect().width,
        );
        writeReviewPaneWidth(nextWidth);
        return nextWidth;
      });
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <main
      className={`grid h-screen min-h-screen grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-canvas text-fg max-lg:block max-lg:h-auto max-lg:overflow-visible ${
        resizingReviewPane ? 'cursor-col-resize' : ''
      }`}
      ref={workspaceRef}
      style={workspaceStyle}
    >
      <ReviewWorkspaceHeader
        activeTab={activeTab}
        comments={comments}
        commentsCount={comments.length}
        diffSettings={diffSettings}
        onActiveTabChange={setActiveTab}
        onBack={onBack}
        onDiffSettingsChange={onDiffSettingsChange}
        onSearchOpen={onSearchOpen}
        repository={tour.repository}
      />
      <div className="relative grid min-h-0 grid-cols-[var(--review-pane-width)_minmax(0,1fr)] max-lg:block">
        <aside className="relative grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-r border-line bg-panel max-lg:block max-lg:h-auto max-lg:overflow-visible max-lg:border-b max-lg:border-r-0">
          <ReviewToolbar
            chapterCompleted={chapterCompleted}
            chapter={chapter}
            chapters={tour.tour.chapters}
            onChapterCompletedToggle={onChapterCompletedToggle}
            onChapterSelect={onChapterSelect}
            onNext={onNext}
            onPrevious={onPrevious}
            tour={tour}
          />

          <div
            className="min-h-0 overflow-y-auto px-6 pt-7 pb-7 max-lg:overflow-visible max-lg:px-5 max-lg:py-6"
            data-left-pane-scroll
          >
            <h1 className="text-xl font-semibold leading-snug tracking-tight">{chapter.title}</h1>
            <div className="mt-4 flex items-center justify-between gap-4">
              <RiskBadge risk={chapter.risk} />
              <div className="mono-tabular flex gap-3 font-mono text-sm">
                <span className="font-semibold text-add">+{stats.additions}</span>
                <span className="font-semibold text-delete">-{stats.deletions}</span>
              </div>
            </div>

            <MarkdownText
              className="mt-8 grid gap-3 text-sm leading-[1.55] text-fg-muted"
              text={chapter.summary}
            />

            <SideBlock title="Review questions">
              {chapter.reviewQuestions.length ? (
                <ul className="mt-4 grid gap-1.5 text-sm leading-[1.45] text-fg-secondary">
                  {chapter.reviewQuestions.map((question, index) => {
                    const questionId = getReviewQuestionId(chapter.id, index);
                    return (
                      <li key={questionId}>
                        <Label className="flex cursor-pointer items-start gap-2 rounded-[4px] py-1 text-sm font-normal leading-[1.45] text-fg-secondary transition-colors hover:text-fg">
                          <Checkbox
                            checked={checkedReviewQuestionIds.has(questionId)}
                            className="mt-0.5 border-line bg-control data-checked:border-add data-checked:bg-add"
                            onCheckedChange={() => onReviewQuestionCheckedToggle(questionId)}
                          />
                          <span className="min-w-0">
                            <MarkdownInlineText text={question} />
                          </span>
                        </Label>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-fg-muted">No review questions.</p>
              )}
            </SideBlock>

            <SideBlock title={`Files (${stats.files})`}>
              <Input
                aria-label="Filter files"
                className="mt-4 rounded-[6px] bg-control text-xs [&_[data-slot=input]]:text-xs"
                onChange={(event) => onFileFilter(event.target.value)}
                placeholder="Filter files..."
                size="sm"
                type="search"
                value={fileFilter}
              />
              <div className="mt-4 min-h-[160px]" data-left-pane-files>
                <FileList
                  files={visibleFiles}
                  onFileSelect={() => setActiveTab('chapters')}
                  treeKey={visibleFiles.map((file) => file.path).join('\n')}
                  viewedFileIds={viewedFileIds}
                />
              </div>
            </SideBlock>
          </div>
          <div
            aria-label="Resize review pane"
            aria-orientation="vertical"
            aria-valuemax={MAX_REVIEW_PANE_WIDTH}
            aria-valuemin={MIN_REVIEW_PANE_WIDTH}
            aria-valuenow={reviewPaneWidth}
            className={`group absolute inset-y-0 right-0 z-20 hidden w-10 translate-x-1/2 cursor-col-resize touch-none items-stretch justify-center outline-none transition-[opacity] duration-150 [transition-timing-function:var(--ease-polished)] lg:flex ${
              resizingReviewPane
                ? 'opacity-100'
                : 'opacity-0 hover:opacity-100 focus-visible:opacity-100'
            }`}
            onPointerDown={(event) => {
              event.preventDefault();
              updateReviewPaneWidth(event.clientX);
              setResizingReviewPane(true);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

              event.preventDefault();
              resizeReviewPaneBy(event.key === 'ArrowLeft' ? -16 : 16);
            }}
            role="separator"
            tabIndex={0}
            title="Resize review pane"
          >
            <span
              aria-hidden="true"
              className={`my-2 w-px rounded-full transition-[background-color,box-shadow] duration-150 [transition-timing-function:var(--ease-polished)] ${
                resizingReviewPane
                  ? 'bg-accent shadow-[0_0_0_1px_var(--color-accent)]'
                  : 'bg-line-strong group-hover:bg-accent group-focus-visible:bg-accent'
              }`}
            />
          </div>
        </aside>

        <section
          className="h-full min-h-0 overflow-auto bg-canvas px-8 pb-7 max-lg:h-auto max-lg:px-5"
          data-diff-scroll-root={activeTab === 'chapters' ? '' : undefined}
        >
          {activeTab === 'chapters' ? (
            <DiffViewer
              collapsedFileIds={diffFoldState.collapsedFileIds}
              comments={comments}
              expandedFoldIds={diffFoldState.expandedFoldIds}
              files={visibleFiles}
              onCommentAdd={onCommentAdd}
              onCommentDelete={onCommentDelete}
              onCommentUpdate={onCommentUpdate}
              onFileCollapsedChange={onFileCollapsedChange}
              onFoldExpand={onFoldExpand}
              onFoldsExpand={onFoldsExpand}
              onFileViewedToggle={onFileViewedToggle}
              settings={diffSettings}
              viewedFileIds={viewedFileIds}
            />
          ) : (
            <ReviewCommentsView
              comments={comments}
              onCommentDelete={onCommentDelete}
              onCommentUpdate={onCommentUpdate}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function ReviewWorkspaceHeader({
  activeTab,
  comments,
  commentsCount,
  diffSettings,
  onActiveTabChange,
  onBack,
  onDiffSettingsChange,
  onSearchOpen,
  repository,
}: {
  activeTab: ReviewWorkspaceTab;
  comments: readonly ReviewComment[];
  commentsCount: number;
  diffSettings: DiffDisplaySettings;
  onActiveTabChange: (tab: ReviewWorkspaceTab) => void;
  onBack: () => void;
  onDiffSettingsChange: (settings: DiffDisplaySettings) => void;
  onSearchOpen: () => void;
  repository: ReviewTour['repository'];
}) {
  return (
    <header className="grid min-h-[56px] grid-cols-[var(--review-pane-width)_minmax(0,1fr)] border-b border-line bg-panel max-lg:grid-cols-1">
      <ReviewRepositoryHeader onBack={onBack} repository={repository} />
      <div className="flex min-h-[56px] items-center justify-between gap-4 px-4 py-2 max-lg:border-t max-lg:border-line max-sm:flex-wrap">
        <ReviewWorkspaceTabs
          activeTab={activeTab}
          commentsCount={commentsCount}
          onActiveTabChange={onActiveTabChange}
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <CopyReviewPromptButton comments={comments} repository={repository} />
          <IconButton icon={Search01Icon} label="Search" onClick={onSearchOpen} />
          <DisplaySettingsButton settings={diffSettings} onSettingsChange={onDiffSettingsChange} />
        </div>
      </div>
    </header>
  );
}

function ReviewRepositoryHeader({
  onBack,
  repository,
}: {
  onBack: () => void;
  repository: ReviewTour['repository'];
}) {
  return (
    <div className="grid min-h-[56px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-r border-line px-4 py-2 max-lg:border-r-0">
      <IconButton icon={ChevronLeftIcon} label="Back to list" onClick={onBack} variant="ghost" />
      <div
        className="min-w-0"
        title={`${repository.name} - ${repository.currentBranch} -> ${repository.baseBranch}`}
      >
        <strong className="block truncate text-sm font-semibold leading-5 text-fg">
          {repository.name}
        </strong>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-fg-muted">
          <AppIcon className="shrink-0 text-fg-muted" icon={GitBranchIcon} size={13} />
          <span className="min-w-0 truncate font-mono text-fg-secondary">
            {repository.currentBranch}
          </span>
          <AppIcon className="shrink-0 text-fg-faint" icon={ArrowRight02Icon} size={12} />
          <span className="min-w-0 truncate font-mono text-fg-secondary">
            {repository.baseBranch}
          </span>
        </span>
      </div>
    </div>
  );
}

function ReviewWorkspaceTabs({
  activeTab,
  commentsCount,
  onActiveTabChange,
}: {
  activeTab: ReviewWorkspaceTab;
  commentsCount: number;
  onActiveTabChange: (tab: ReviewWorkspaceTab) => void;
}) {
  const handleValueChange = (values: string[]) => {
    const nextTab = values[0];
    if (nextTab === 'chapters' || nextTab === 'comments') {
      onActiveTabChange(nextTab);
    }
  };

  return (
    <ToggleGroup
      aria-label="Review content"
      className="rounded-[10px] bg-control p-0.5 shadow-control"
      onValueChange={handleValueChange}
      size="sm"
      value={[activeTab]}
    >
      <ToggleGroupItem
        className="min-h-8 gap-1.5 rounded-[8px] px-2.5"
        title="Show chapter diffs"
        value="chapters"
      >
        <AppIcon icon={FileDiffIcon} size={14} />
        <span>Chapters</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        className="min-h-8 gap-1.5 rounded-[8px] px-2.5"
        title="Show review comments"
        value="comments"
      >
        <AppIcon icon={Comment01Icon} size={14} />
        <span>Comments</span>
        <span className="mono-tabular min-w-4 rounded-full bg-raised px-1.5 text-[10px] leading-4 text-fg-muted shadow-control">
          {commentsCount}
        </span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

function CopyReviewPromptButton({
  comments,
  repository,
}: {
  comments: readonly ReviewComment[];
  repository: ReviewTour['repository'];
}) {
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const prompt = useMemo(
    () => formatReviewPromptForCodingTool(comments, repository),
    [comments, repository],
  );

  useEffect(() => {
    if (copyState === 'idle') return;

    const timeout = window.setTimeout(() => setCopyState('idle'), 1400);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const showCopyToast = useCallback((copied: boolean) => {
    toastManager.add({
      description: copied
        ? 'Review prompt copied to clipboard.'
        : 'Could not copy the review prompt.',
      id: 'review-prompt-copy-status',
      title: copied ? 'Copied as prompt' : 'Copy failed',
      type: copied ? 'success' : 'error',
    });
  }, []);

  const copyPrompt = useCallback(async () => {
    if (comments.length === 0 || typeof navigator === 'undefined') return false;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState('copied');
      showCopyToast(true);
      return true;
    } catch {
      setCopyState('failed');
      showCopyToast(false);
      return false;
    }
  }, [comments.length, prompt, showCopyToast]);

  const openTool = async (scheme: ReviewPromptToolScheme) => {
    if (comments.length === 0 || typeof window === 'undefined') return;

    const toolUrl = createReviewPromptToolUrl({
      prompt,
      repositoryRoot: repository.root,
      scheme,
    });

    await copyPrompt();
    setOpen(false);
    window.setTimeout(() => {
      window.location.href = toolUrl;
    }, 40);
  };

  const label =
    copyState === 'copied'
      ? 'Copied review prompt'
      : copyState === 'failed'
        ? 'Failed to copy review prompt'
        : 'Copy review prompt';

  return (
    <Popover onOpenChange={(nextOpen: boolean) => setOpen(nextOpen)} open={open}>
      <div
        className={`button-raised inline-grid h-9 grid-cols-[38px_28px] items-center overflow-hidden rounded-[8px] bg-control text-fg-muted hover:text-fg ${
          open ? 'text-fg' : ''
        } ${comments.length === 0 ? 'opacity-45 hover:text-fg-muted' : ''}`}
      >
        <button
          aria-label={label}
          className="focus-ring hit-area-40 grid h-full place-items-center transition-colors duration-150 [transition-timing-function:var(--ease-polished)] disabled:cursor-default disabled:hover:text-fg-muted"
          disabled={comments.length === 0}
          onClick={() => {
            void copyPrompt();
          }}
          title={label}
          type="button"
        >
          <AppIcon icon={CursorRemoveSelection02Icon} size={15} />
        </button>
        <PopoverTrigger
          aria-label="Open prompt actions"
          render={
            <button
              className="focus-ring hit-area-40 grid h-full place-items-center border-l border-line transition-colors duration-150 [transition-timing-function:var(--ease-polished)] disabled:cursor-default disabled:hover:text-fg-muted"
              disabled={comments.length === 0}
              title="Open prompt actions"
              type="button"
            />
          }
        >
          <AppIcon
            className={`transition-transform duration-150 [transition-timing-function:var(--ease-polished)] ${
              open ? 'rotate-180' : copyState === 'copied' ? 'scale-90' : 'scale-100'
            }`}
            icon={ChevronDownIcon}
            size={14}
          />
        </PopoverTrigger>
      </div>
      <PopoverPopup
        align="end"
        className="w-[238px] rounded-[8px] border-[0.5px] border-line bg-panel text-fg-secondary before:rounded-[7px] before:shadow-none dark:before:shadow-none"
        sideOffset={6}
        viewportClassName="py-0 [--viewport-inline-padding:0px]"
      >
        <div className="grid gap-0.5 p-2">
          <ReviewPromptMenuItem
            icon={CursorRemoveSelection02Icon}
            label="Copy as prompt"
            onClick={() => {
              void copyPrompt().then(() => setOpen(false));
            }}
          />
          <div className="-mx-2 h-px bg-line" />
          <p className="mt-1 px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 tracking-[0.08em] text-fg-faint">
            Open in
          </p>
          {reviewPromptTools.map((tool) => (
            <ReviewPromptMenuItem
              icon={tool.icon}
              key={tool.scheme}
              label={tool.label}
              onClick={() => {
                void openTool(tool.scheme);
              }}
            />
          ))}
        </div>
      </PopoverPopup>
    </Popover>
  );
}

type ReviewPromptToolScheme = 'codex' | 'claude';

function formatReviewPromptForCodingTool(
  comments: readonly ReviewComment[],
  repository: ReviewTour['repository'],
) {
  const commentsPrompt = formatReviewCommentsForCodex(comments);
  if (!commentsPrompt) return '';

  return [
    'Review Tour generated the following review prompt.',
    '',
    'Repository context:',
    `- Repository: ${repository.name}`,
    `- Current branch: ${repository.currentBranch}`,
    `- Base branch: ${repository.baseBranch}`,
    `- Local path: ${repository.root}`,
    '',
    commentsPrompt,
  ].join('\n');
}

function createReviewPromptToolUrl({
  prompt,
  repositoryRoot,
  scheme,
}: {
  prompt: string;
  repositoryRoot: string;
  scheme: ReviewPromptToolScheme;
}) {
  const encodedPrompt = encodeURIComponent(prompt);
  const encodedRepositoryRoot = encodeURIComponent(repositoryRoot);

  if (scheme === 'codex') {
    return `codex://threads/new?prompt=${encodedPrompt}&path=${encodedRepositoryRoot}`;
  }

  return `claude://code/new?q=${encodedPrompt}&folder=${encodedRepositoryRoot}`;
}

const reviewPromptTools: Array<{
  icon: typeof ChatGptIcon;
  label: string;
  scheme: ReviewPromptToolScheme;
}> = [
  { icon: ChatGptIcon, label: 'Codex desktop', scheme: 'codex' },
  { icon: ClaudeIcon, label: 'Claude Code', scheme: 'claude' },
];

function ReviewPromptMenuItem({
  icon,
  label,
  onClick,
}: {
  icon: typeof ChatGptIcon;
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className="focus-ring hit-area-40 group grid min-h-9 w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-1.5 rounded-[6px] px-2 text-left text-[13px] font-medium leading-4 text-fg-secondary transition-[background-color,color] duration-150 [transition-timing-function:var(--ease-polished)] hover:bg-hover hover:text-fg active:bg-hover"
      onClick={onClick}
      type="button"
    >
      <AppIcon
        className="justify-self-center text-fg-faint transition-colors duration-150 [transition-timing-function:var(--ease-polished)] group-hover:text-fg-muted"
        icon={icon}
        size={15}
      />
      <span className="truncate">{label}</span>
    </button>
  );
}

function ReviewToolbar({
  chapterCompleted,
  chapter,
  chapters,
  onChapterCompletedToggle,
  onChapterSelect,
  onNext,
  onPrevious,
  tour,
}: {
  chapterCompleted: boolean;
  chapter: ReviewChapter;
  chapters: ReviewChapter[];
  onChapterCompletedToggle: () => void;
  onChapterSelect: (chapter: ReviewChapter) => void;
  onNext: () => void;
  onPrevious: () => void;
  tour: ReviewTour;
}) {
  const chapterIndex = chapters.findIndex((item) => item.id === chapter.id);
  const hasPreviousChapter = chapterIndex > 0;
  const hasNextChapter = chapterIndex >= 0 && chapterIndex < chapters.length - 1;

  return (
    <div className="border-b border-line px-4 py-3">
      <div className="grid min-h-9 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3">
        <ChapterReviewedToggle
          completed={chapterCompleted}
          onToggle={onChapterCompletedToggle}
          title={
            chapterCompleted
              ? 'Mark current chapter as not reviewed'
              : 'Mark current chapter as reviewed'
          }
          variant="icon"
        />
        <IconButton
          disabled={!hasPreviousChapter}
          icon={ArrowLeft01Icon}
          label="Previous chapter"
          onClick={onPrevious}
        />
        <ChapterPicker
          activeChapter={chapter}
          chapters={chapters}
          onChapterSelect={onChapterSelect}
          tour={tour}
        />
        <IconButton
          disabled={!hasNextChapter}
          icon={ArrowRight01Icon}
          label="Next chapter"
          onClick={onNext}
        />
      </div>
    </div>
  );
}

function ChapterPicker({
  activeChapter,
  chapters,
  onChapterSelect,
  tour,
}: {
  activeChapter: ReviewChapter;
  chapters: ReviewChapter[];
  onChapterSelect: (chapter: ReviewChapter) => void;
  tour: ReviewTour;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={(nextOpen: boolean) => setOpen(nextOpen)} open={open}>
      <PopoverTrigger
        aria-label="Select chapter"
        render={
          <button
            className={`focus-ring pressable hit-area-40 mx-auto inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-[8px] px-2 text-sm font-medium text-fg transition-[background-color,color,scale] ${
              open ? 'bg-hover' : 'hover:bg-hover'
            }`}
            title="Select chapter"
            type="button"
          />
        }
      >
        <span className="mono-tabular truncate">Chapter {activeChapter.index}</span>
        <AppIcon
          className={`shrink-0 text-fg-muted transition-transform duration-150 [transition-timing-function:var(--ease-polished)] ${
            open ? 'rotate-180' : 'rotate-0'
          }`}
          icon={ChevronDownIcon}
        />
      </PopoverTrigger>
      <PopoverPopup
        align="center"
        className="w-[min(460px,calc(100vw-32px))] border-[0.5px] border-line bg-panel text-fg-secondary before:shadow-none [--viewport-inline-padding:0px] dark:before:shadow-none"
        sideOffset={8}
      >
        <div className="grid max-h-[min(420px,calc(100vh-112px))] gap-1 overflow-auto p-1">
          {chapters.map((chapter) => (
            <ChapterPickerItem
              active={chapter.id === activeChapter.id}
              chapter={chapter}
              key={chapter.id}
              onSelect={() => {
                setOpen(false);
                onChapterSelect(chapter);
              }}
              stats={getChapterStats(tour, chapter)}
            />
          ))}
        </div>
      </PopoverPopup>
    </Popover>
  );
}

function ChapterPickerItem({
  active,
  chapter,
  onSelect,
  stats,
}: {
  active: boolean;
  chapter: ReviewChapter;
  onSelect: () => void;
  stats: ReturnType<typeof getChapterStats>;
}) {
  return (
    <button
      aria-current={active ? 'true' : undefined}
      className={`focus-ring grid min-h-[72px] w-full grid-cols-[42px_minmax(0,1fr)] items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-[background-color,color,scale] duration-150 [transition-timing-function:var(--ease-polished)] active:scale-[0.96] ${
        active ? 'bg-raised-strong text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg'
      }`}
      onClick={onSelect}
      type="button"
    >
      <span
        className={`mono-tabular grid size-8 place-items-center rounded-full text-sm font-semibold ${
          active ? 'bg-add text-white' : 'bg-control text-fg-muted'
        }`}
      >
        {chapter.index}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium leading-5">{chapter.title}</span>
        <span className="mono-tabular mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
          <RiskBadge risk={chapter.risk} />
          <span className="font-semibold text-add">+{stats.additions}</span>
          <span className="font-semibold text-delete">-{stats.deletions}</span>
          <span className="text-fg-muted">{stats.files} files</span>
        </span>
      </span>
    </button>
  );
}

function DisplaySettingsButton({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: DiffDisplaySettings) => void;
  settings: DiffDisplaySettings;
}) {
  const [open, setOpen] = useState(false);

  const updateSetting = <Key extends keyof DiffDisplaySettings>(
    key: Key,
    value: DiffDisplaySettings[Key],
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Popover onOpenChange={(nextOpen: boolean) => setOpen(nextOpen)} open={open}>
      <PopoverTrigger
        aria-label="Display settings"
        render={
          <button
            className={`focus-ring pressable button-raised hit-area-40 grid size-9 shrink-0 place-items-center rounded-[8px] ${
              open ? 'bg-hover text-fg' : 'bg-control text-fg-muted hover:bg-hover hover:text-fg'
            }`}
            title="Display settings"
            type="button"
          />
        }
      >
        <AppIcon icon={SlidersHorizontalIcon} />
      </PopoverTrigger>
      <PopoverPopup
        align="end"
        className="w-[292px] border-[0.5px] border-line bg-panel text-xs text-fg-secondary before:shadow-none [--viewport-inline-padding:--spacing(3)] dark:before:shadow-none"
        sideOffset={4}
      >
        <div className="grid gap-2">
          <SettingControlRow label="Theme">
            <ThemeModeControl />
          </SettingControlRow>
          <div className="-mx-3 h-px bg-line" />
          <SettingSelect
            label="Syntax theme"
            onChange={(value) =>
              updateSetting('syntaxTheme', value as DiffDisplaySettings['syntaxTheme'])
            }
            options={[
              ['auto', 'Auto'],
              ['github-light', 'GitHub Light'],
              ['github-dark', 'GitHub Dark'],
              ['plain', 'Plain'],
            ]}
            value={settings.syntaxTheme}
          />
          <SettingSelect
            label="Font"
            onChange={(value) =>
              updateSetting('fontFamily', value as DiffDisplaySettings['fontFamily'])
            }
            options={[
              ['geist-mono', 'Geist Mono'],
              ['system-mono', 'System Mono'],
            ]}
            value={settings.fontFamily}
          />
          <SettingSelect
            label="Font size"
            onChange={(value) =>
              updateSetting('fontSize', Number(value) as DiffDisplaySettings['fontSize'])
            }
            options={[
              ['12', '12px'],
              ['13', '13px'],
              ['14', '14px'],
            ]}
            value={String(settings.fontSize)}
          />
          <SettingSelect
            label="Line height"
            onChange={(value) =>
              updateSetting('lineHeight', value as DiffDisplaySettings['lineHeight'])
            }
            options={[
              ['compact', 'Compact'],
              ['normal', 'Normal'],
              ['relaxed', 'Relaxed'],
            ]}
            value={settings.lineHeight}
          />
          <div className="-mx-3 h-px bg-line" />
          <SettingSelect
            label="Layout"
            onChange={(value) => updateSetting('layout', value as DiffDisplaySettings['layout'])}
            options={[
              ['split', 'Split'],
              ['unified', 'Unified'],
            ]}
            value={settings.layout}
          />
          <SettingSelect
            label="Indicators"
            onChange={(value) =>
              updateSetting('indicators', value as DiffDisplaySettings['indicators'])
            }
            options={[
              ['classic', 'Classic (+/-)'],
              ['none', 'None'],
            ]}
            value={settings.indicators}
          />
          <SettingSelect
            label="Inline diffs"
            onChange={(value) =>
              updateSetting('inlineDiffs', value as DiffDisplaySettings['inlineDiffs'])
            }
            options={[
              ['word', 'Word'],
              ['none', 'None'],
            ]}
            value={settings.inlineDiffs}
          />
          <div className="-mx-3 h-px bg-line" />
          <SettingSwitch
            checked={settings.ligatures}
            label="Ligatures"
            onChange={(checked) => updateSetting('ligatures', checked)}
          />
          <SettingSwitch
            checked={settings.backgrounds}
            label="Backgrounds"
            onChange={(checked) => updateSetting('backgrounds', checked)}
          />
          <SettingSwitch
            checked={settings.wrapping}
            label="Wrapping"
            onChange={(checked) => updateSetting('wrapping', checked)}
          />
          <SettingSwitch
            checked={settings.lineNumbers}
            label="Line numbers"
            onChange={(checked) => updateSetting('lineNumbers', checked)}
          />
        </div>
      </PopoverPopup>
    </Popover>
  );
}

function SettingControlRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="grid min-h-9 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <span className="truncate text-[11px] font-medium uppercase leading-4 tracking-wider text-fg-muted">
        {label}
      </span>
      <div className="min-w-0 justify-self-end">{children}</div>
    </div>
  );
}

function SettingSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  const items = options.map(([optionValue, optionLabel]) => ({
    label: optionLabel,
    value: optionValue,
  }));

  return (
    <SettingControlRow label={label}>
      <Select
        aria-label={label}
        items={items}
        onValueChange={(nextValue) => {
          if (nextValue !== null) onChange(String(nextValue));
        }}
        value={value}
      >
        <SelectTrigger className="w-36 min-w-0 rounded-[8px] bg-control text-xs" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup alignItemWithTrigger={false}>
          {items.map(({ value: optionValue, label: optionLabel }) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </SettingControlRow>
  );
}

function SettingSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Label className="grid min-h-9 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
      <span className="truncate text-[11px] font-medium uppercase leading-4 tracking-wider text-fg-muted">
        {label}
      </span>
      <Switch
        checked={checked}
        className="[--thumb-size:--spacing(4)] sm:[--thumb-size:--spacing(4)]"
        onCheckedChange={onChange}
      />
    </Label>
  );
}

function ReviewCommentsView({
  comments,
  onCommentDelete,
  onCommentUpdate,
}: {
  comments: readonly ReviewComment[];
  onCommentDelete: (commentId: string) => void;
  onCommentUpdate: (commentId: string, body: string) => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4 py-7 max-lg:py-6">
      <div className="flex min-h-9 items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-6 tracking-tight text-fg">
            Review comments
          </h2>
          <p className="mt-1 text-sm leading-[1.45] text-fg-muted">
            All comments added while reviewing this tour.
          </p>
        </div>
        <span className="mono-tabular shrink-0 pt-0.5 text-xs text-fg-muted">
          {comments.length} total
        </span>
      </div>
      <ReviewCommentsPanel
        comments={comments}
        onCommentDelete={onCommentDelete}
        onCommentUpdate={onCommentUpdate}
      />
    </div>
  );
}

function ReviewCommentsPanel({
  comments,
  onCommentDelete,
  onCommentUpdate,
}: {
  comments: readonly ReviewComment[];
  onCommentDelete: (commentId: string) => void;
  onCommentUpdate: (commentId: string, body: string) => void;
}) {
  return (
    <div className="surface-panel rounded-[8px] bg-panel p-4">
      {comments.length ? (
        <ul className="grid gap-2">
          {comments.map((comment) => (
            <ReviewCommentListItem
              comment={comment}
              key={comment.id}
              onCommentDelete={onCommentDelete}
              onCommentUpdate={onCommentUpdate}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-[1.45] text-fg-muted">
          Hover a code line and drag the + button to add a comment.
        </p>
      )}
    </div>
  );
}

function ReviewCommentListItem({
  comment,
  onCommentDelete,
  onCommentUpdate,
}: {
  comment: ReviewComment;
  onCommentDelete: (commentId: string) => void;
  onCommentUpdate: (commentId: string, body: string) => void;
}) {
  const [editing, setEditing] = useState(false);
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

  const saveEdit = () => {
    if (saveDisabled) return;

    onCommentUpdate(comment.id, trimmedDraftBody);
    setDraftBody(trimmedDraftBody);
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraftBody(comment.body);
    setEditing(false);
  };

  return (
    <li className="surface grid gap-2 rounded-[7px] bg-control px-3 py-2 text-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-fg-muted">
            <AppIcon className="shrink-0 text-add" icon={Comment01Icon} size={13} />
            <span
              className="mono-tabular min-w-0 truncate"
              title={getReviewCommentLocation(comment.range)}
            >
              {comment.range.filePath}:{getReviewCommentLineLabel(comment.range)}
            </span>
          </div>
          {editing ? (
            <div className="mt-2 grid gap-2">
              <textarea
                aria-label="Edit review comment"
                className="min-h-24 w-full resize-y rounded-[7px] bg-diff-line px-3 py-2 text-sm leading-[1.45] text-fg shadow-control outline-none transition-[box-shadow] duration-150 [transition-timing-function:var(--ease-polished)] placeholder:text-fg-faint focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                onChange={(event) => setDraftBody(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelEdit();
                  }

                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    saveEdit();
                  }
                }}
                ref={textareaRef}
                value={draftBody}
              />
              <div className="flex justify-end gap-1.5">
                <Button onClick={cancelEdit} size="xs" variant="ghost">
                  <AppIcon icon={Cancel01Icon} size={14} />
                  Cancel
                </Button>
                <Button disabled={saveDisabled} onClick={saveEdit} size="xs" variant="success">
                  <AppIcon icon={SaveIcon} size={14} />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm leading-[1.4] text-fg-secondary">
              {comment.body}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Edit review comment"
            aria-pressed={editing}
            className={`focus-ring hit-area-40 grid size-7 place-items-center rounded-[7px] transition-[background-color,color,scale] duration-150 [transition-timing-function:var(--ease-polished)] hover:bg-hover hover:text-fg active:scale-[0.96] ${
              editing ? 'bg-hover text-fg' : 'text-fg-faint'
            }`}
            onClick={() => setEditing((current) => !current)}
            title="Edit comment"
            type="button"
          >
            <AppIcon icon={PencilEdit02Icon} size={14} />
          </button>
          <button
            aria-label="Delete review comment"
            className="focus-ring hit-area-40 grid size-7 place-items-center rounded-[7px] text-fg-faint transition-[background-color,color,scale] duration-150 [transition-timing-function:var(--ease-polished)] hover:bg-hover hover:text-error active:scale-[0.96]"
            onClick={() => onCommentDelete(comment.id)}
            title="Delete comment"
            type="button"
          >
            <AppIcon icon={Delete02Icon} size={14} />
          </button>
        </div>
      </div>
      <code className="truncate rounded-[5px] bg-diff-line px-2 py-1 font-mono text-[11px] leading-4 text-code shadow-control">
        {getReviewCommentSnippet(comment.range)}
      </code>
    </li>
  );
}

function FileList({
  files,
  onFileSelect,
  treeKey,
  viewedFileIds,
}: {
  files: DiffFile[];
  onFileSelect: (path: string) => void;
  treeKey: string;
  viewedFileIds: ReadonlySet<string>;
}) {
  if (files.length === 0) {
    return <p className="mt-4 text-sm text-fg-muted">No files match.</p>;
  }

  return (
    <FileTreeList
      files={files}
      key={treeKey}
      onFileSelect={onFileSelect}
      viewedFileIds={viewedFileIds}
    />
  );
}

function FileTreeList({
  files,
  onFileSelect,
  viewedFileIds,
}: {
  files: DiffFile[];
  onFileSelect: (path: string) => void;
  viewedFileIds: ReadonlySet<string>;
}) {
  const statsByPath = useMemo(() => {
    const next = new Map<string, ReturnType<typeof getFileStats>>();
    for (const file of files) {
      next.set(file.path, getFileStats(file));
    }
    return next;
  }, [files]);

  const gitStatus = useMemo<GitStatusEntry[]>(
    () =>
      files.map((file) => ({
        path: file.path,
        status: toTreeGitStatus(file.status),
      })),
    [files],
  );

  const fileTreeHeight = useMemo(
    () =>
      Math.max(
        FILE_TREE_MIN_HEIGHT,
        getFileTreeRowCount(files.map((file) => file.path)) * FILE_TREE_ITEM_HEIGHT +
          FILE_TREE_VERTICAL_PADDING,
      ),
    [files],
  );

  const treeStyle = useMemo<CSSProperties>(
    () => ({ ...fileTreeStyle, height: fileTreeHeight }),
    [fileTreeHeight],
  );

  const { model } = useFileTree({
    density: 'compact',
    flattenEmptyDirectories: true,
    gitStatus,
    initialExpansion: 'open',
    itemHeight: FILE_TREE_ITEM_HEIGHT,
    onSelectionChange: (paths) => {
      const selectedPath = paths.at(-1);
      if (!selectedPath || !statsByPath.has(selectedPath)) {
        return;
      }

      onFileSelect(selectedPath);

      const scrollToFile = () => {
        document.getElementById(fileDomId(selectedPath))?.scrollIntoView({
          block: 'start',
          behavior: 'smooth',
        });
      };

      if (typeof window === 'undefined') {
        scrollToFile();
      } else {
        window.requestAnimationFrame(scrollToFile);
      }
    },
    paths: files.map((file) => file.path),
    renderRowDecoration: ({ item }) => {
      const stats = statsByPath.get(item.path);
      if (!stats) {
        return null;
      }
      const file = files.find((candidate) => candidate.path === item.path);
      const prefix = file && viewedFileIds.has(file.id) ? '✓ ' : '';
      return {
        text: `${prefix}+${stats.additions} -${stats.deletions}`,
        title: `${stats.additions} additions, ${stats.deletions} deletions`,
      };
    },
    unsafeCSS: fileTreeCss,
  });

  return (
    <PierreFileTree
      aria-label="Changed files"
      className="block min-h-0 bg-panel"
      model={model}
      style={treeStyle}
    />
  );
}

type FileTreeRowNode = {
  children: Map<string, FileTreeRowNode>;
  isFile: boolean;
};

function getFileTreeRowCount(paths: string[]) {
  const root: FileTreeRowNode = { children: new Map(), isFile: false };

  for (const path of paths) {
    const parts = path.split('/').filter(Boolean);
    let current = root;

    for (const [index, part] of parts.entries()) {
      let next = current.children.get(part);
      if (!next) {
        next = { children: new Map(), isFile: false };
        current.children.set(part, next);
      }

      if (index === parts.length - 1) {
        next.isFile = true;
      }

      current = next;
    }
  }

  return Array.from(root.children.values()).reduce(
    (count, child) => count + countFileTreeRows(child),
    0,
  );
}

function countFileTreeRows(node: FileTreeRowNode): number {
  if (node.isFile) {
    return 1;
  }

  let visibleNode = node;
  while (visibleNode.children.size === 1) {
    const [onlyChild] = visibleNode.children.values();
    if (!onlyChild || onlyChild.isFile) {
      break;
    }

    visibleNode = onlyChild;
  }

  return (
    1 +
    Array.from(visibleNode.children.values()).reduce(
      (count, child) => count + countFileTreeRows(child),
      0,
    )
  );
}

function toTreeGitStatus(status: DiffFile['status']): GitStatusEntry['status'] {
  if (status === 'added') return 'added';
  if (status === 'deleted') return 'deleted';
  if (status === 'renamed') return 'renamed';
  return 'modified';
}

function getReviewQuestionId(chapterId: string, questionIndex: number) {
  return `${chapterId}:question:${questionIndex}`;
}

function readReviewPaneWidth() {
  if (typeof window === 'undefined') return DEFAULT_REVIEW_PANE_WIDTH;

  try {
    const stored = window.localStorage.getItem(REVIEW_PANE_WIDTH_STORAGE_KEY);
    const parsed = stored ? Number.parseInt(stored, 10) : DEFAULT_REVIEW_PANE_WIDTH;
    return clampReviewPaneWidth(parsed, window.innerWidth);
  } catch {
    return DEFAULT_REVIEW_PANE_WIDTH;
  }
}

function writeReviewPaneWidth(width: number) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(REVIEW_PANE_WIDTH_STORAGE_KEY, String(Math.round(width)));
  } catch {
    // Ignore storage failures; the current drag session still uses the selected width.
  }
}

function clampReviewPaneWidth(width: number, workspaceWidth: number) {
  const maxWidth = Math.min(
    MAX_REVIEW_PANE_WIDTH,
    Math.max(MIN_REVIEW_PANE_WIDTH, workspaceWidth - MIN_DIFF_PANE_WIDTH),
  );

  return Math.round(Math.min(Math.max(width, MIN_REVIEW_PANE_WIDTH), maxWidth));
}

const fileTreeStyle = {
  '--trees-accent-override': 'var(--color-accent)',
  '--trees-bg-override': 'var(--color-panel)',
  '--trees-bg-muted-override': 'var(--color-hover)',
  '--trees-border-color-override': 'var(--color-line)',
  '--trees-fg-muted-override': 'var(--color-fg-muted)',
  '--trees-fg-override': 'var(--color-fg-secondary)',
  '--trees-focus-ring-color-override': 'var(--color-focus)',
  '--trees-font-family-override':
    'Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  '--trees-font-size-override': '12px',
  '--trees-git-added-color-override': 'var(--color-add)',
  '--trees-git-deleted-color-override': 'var(--color-delete)',
  '--trees-git-modified-color-override': 'var(--color-fg-secondary)',
  '--trees-git-renamed-color-override': 'var(--color-warning)',
  '--trees-item-margin-x-override': '4px',
  '--trees-padding-inline-override': '6px',
  '--trees-scrollbar-gutter-override': '7px',
  '--trees-selected-bg-override': 'var(--color-tree-selected)',
  '--trees-selected-fg-override': 'var(--color-fg)',
} as CSSProperties;

const fileTreeCss = `
  [data-type='item'] {
    cursor: pointer;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  [data-type='item']:hover {
    background-color: var(--color-hover);
  }

  [data-item-section='decoration'] {
    flex: 0 0 auto;
    margin-left: 10px;
    font-family:
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Monaco,
      Consolas,
      "Liberation Mono",
      monospace;
    font-size: 11px;
    font-weight: 700;
    color: var(--color-fg-muted);
  }
`;
