import { useEffect, useState } from 'react';
import type { ReviewChapter, ReviewTour } from 'review-tour/schema';
import { Card, CardPanel } from '#/components/ui/card';
import { Skeleton } from '#/components/ui/skeleton';
import { fetchTour } from './api';
import {
  type DiffDisplaySettings,
  readDiffDisplaySettings,
  writeDiffDisplaySettings,
} from './diffSettings';
import {
  addStringSetValues,
  createEmptyDiffFoldState,
  readDiffFoldState,
  setStringSetValue,
  writeDiffFoldState,
  type DiffFoldState,
} from './diffFoldState';
import { fileDomId } from './dom';
import { readReviewComments, writeReviewComments, type ReviewComment } from './reviewComments';
import { ReviewWorkspace } from './ReviewWorkspace';
import { SymbolNavigationProvider } from './SymbolNavigation';
import {
  createEmptyReviewProgress,
  readReviewProgress,
  toggleSetValue,
  writeReviewProgress,
  type ReviewProgress,
} from './reviewProgress';
import { CommandPalette, type CommandPaletteTarget, ShellMessage } from './ui';
import { TourOverview } from './TourOverview';

export type TourMode = 'overview' | 'review';

export type TourNavigationTarget =
  | { mode: 'overview' }
  | { chapterId: string; filePath?: string; mode: 'review' };

type TourState =
  | { status: 'loading' }
  | { status: 'ready'; tour: ReviewTour }
  | { status: 'error'; message: string };

const REVIEW_PROGRESS_STORAGE_PREFIX = 'review-tour:progress';
const REVIEW_COMMENTS_STORAGE_PREFIX = 'review-tour:comments';
const DIFF_FOLD_STATE_STORAGE_PREFIX = 'review-tour:diff-folds';
const LEGACY_CHAPTER_PROGRESS_STORAGE_PREFIX = 'review-tour:completed-chapters';

export function TourPage({
  chapterId,
  filePath,
  mode,
  onNavigate,
  repoHash,
  tourId,
}: {
  chapterId?: string;
  filePath?: string;
  mode: TourMode;
  onNavigate: (target: TourNavigationTarget) => void;
  repoHash?: string;
  tourId: string;
}) {
  const [state, setState] = useState<TourState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [pendingFilePath, setPendingFilePath] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [reviewProgress, setReviewProgress] = useState<ReviewProgress>(createEmptyReviewProgress);
  const [diffFoldState, setDiffFoldState] = useState<DiffFoldState>(createEmptyDiffFoldState);
  const [diffSettings, setDiffSettings] = useState<DiffDisplaySettings>(readDiffDisplaySettings);

  useEffect(() => {
    if (!repoHash) {
      setState({ status: 'error', message: 'Missing repo query.' });
      setReviewComments([]);
      setReviewProgress(createEmptyReviewProgress());
      setDiffFoldState(createEmptyDiffFoldState());
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });
    setReviewProgress(
      readReviewProgress(
        getReviewProgressStorageKey({ repoHash, tourId }),
        getLegacyChapterProgressStorageKey({ repoHash, tourId }),
      ),
    );
    setDiffFoldState(readDiffFoldState(getDiffFoldStateStorageKey({ repoHash, tourId })));
    setReviewComments(readReviewComments(getReviewCommentsStorageKey({ repoHash, tourId })));
    fetchTour({ repoHash, tourId })
      .then((tour) => {
        if (!cancelled) {
          setSelectedId(tour.tour.chapters[0]?.id ?? '');
          setFileFilter('');
          setPendingFilePath('');
          setState({ status: 'ready', tour });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to load tour.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [repoHash, tourId]);

  const readyTour = state.status === 'ready' ? state.tour : null;

  useEffect(() => {
    if (!readyTour) return;

    if (mode === 'review') {
      setSelectedId(
        getRouteChapterId(readyTour, chapterId) ?? readyTour.tour.chapters[0]?.id ?? '',
      );
    }

    setFileFilter('');
    setPendingFilePath(filePath ?? '');
  }, [chapterId, filePath, mode, readyTour]);

  const updateReviewProgress = (updater: (current: ReviewProgress) => ReviewProgress) => {
    if (!repoHash) return;

    const storageKey = getReviewProgressStorageKey({ repoHash, tourId });
    setReviewProgress((current) => {
      const next = updater(current);
      writeReviewProgress(storageKey, next);
      return next;
    });
  };

  const updateReviewComments = (updater: (current: ReviewComment[]) => ReviewComment[]) => {
    if (!repoHash) return;

    const storageKey = getReviewCommentsStorageKey({ repoHash, tourId });
    setReviewComments((current) => {
      const next = updater(current);
      writeReviewComments(storageKey, next);
      return next;
    });
  };

  const updateDiffFoldState = (updater: (current: DiffFoldState) => DiffFoldState) => {
    if (!repoHash) return;

    const storageKey = getDiffFoldStateStorageKey({ repoHash, tourId });
    setDiffFoldState((current) => {
      const next = updater(current);
      writeDiffFoldState(storageKey, next);
      return next;
    });
  };

  const addReviewComment = (comment: ReviewComment) => {
    updateReviewComments((current) => [...current, comment]);
  };

  const deleteReviewComment = (commentId: string) => {
    updateReviewComments((current) => current.filter((comment) => comment.id !== commentId));
  };

  const updateReviewComment = (commentId: string, body: string) => {
    const nextBody = body.trim();
    if (!nextBody) return;

    updateReviewComments((current) =>
      current.map((comment) =>
        comment.id === commentId
          ? { ...comment, body: nextBody, updatedAt: new Date().toISOString() }
          : comment,
      ),
    );
  };

  const toggleChapterCompleted = (chapterId: string) => {
    updateReviewProgress((current) => ({
      ...current,
      chapterIds: toggleSetValue(current.chapterIds, chapterId),
    }));
  };

  const toggleFileViewed = (fileId: string) => {
    updateReviewProgress((current) => ({
      ...current,
      fileIds: toggleSetValue(current.fileIds, fileId),
    }));
  };

  const toggleReviewQuestionChecked = (questionId: string) => {
    updateReviewProgress((current) => ({
      ...current,
      questionIds: toggleSetValue(current.questionIds, questionId),
    }));
  };

  const updateFileCollapsed = (fileId: string, collapsed: boolean) => {
    updateDiffFoldState((current) => ({
      ...current,
      collapsedFileIds: setStringSetValue(current.collapsedFileIds, fileId, collapsed),
    }));
  };

  const expandFold = (foldId: string) => {
    updateDiffFoldState((current) => ({
      ...current,
      expandedFoldIds: setStringSetValue(current.expandedFoldIds, foldId, true),
    }));
  };

  const expandFolds = (foldIds: readonly string[]) => {
    updateDiffFoldState((current) => ({
      ...current,
      expandedFoldIds: addStringSetValues(current.expandedFoldIds, foldIds),
    }));
  };

  const updateDiffSettings = (settings: DiffDisplaySettings) => {
    setDiffSettings(settings);
    writeDiffDisplaySettings(settings);
  };

  if (state.status === 'loading') {
    return <TourPageSkeleton mode={mode} />;
  }

  if (state.status === 'error') {
    return <ShellMessage message={state.message} tone="error" />;
  }

  const resolvedSelectedId =
    mode === 'review' ? (getRouteChapterId(state.tour, chapterId) ?? selectedId) : selectedId;

  return (
    <>
      <ReadyTourPage
        diffFoldState={diffFoldState}
        diffSettings={diffSettings}
        fileFilter={fileFilter}
        mode={mode}
        onNavigate={onNavigate}
        onChapterCompletedToggle={toggleChapterCompleted}
        onCommentAdd={addReviewComment}
        onCommentDelete={deleteReviewComment}
        onCommentUpdate={updateReviewComment}
        onDiffSettingsChange={updateDiffSettings}
        onFileCollapsedChange={updateFileCollapsed}
        onFoldExpand={expandFold}
        onFoldsExpand={expandFolds}
        onFileViewedToggle={toggleFileViewed}
        onFileFilter={setFileFilter}
        onPendingFilePathChange={setPendingFilePath}
        onReviewQuestionCheckedToggle={toggleReviewQuestionChecked}
        onSearchOpen={() => setSearchOpen(true)}
        onSelectedIdChange={setSelectedId}
        pendingFilePath={pendingFilePath}
        reviewComments={reviewComments}
        reviewProgress={reviewProgress}
        selectedId={resolvedSelectedId}
        tour={state.tour}
      />
      <CommandPalette
        onOpenChange={setSearchOpen}
        onSelect={(target) => {
          setSearchOpen(false);
          handleCommandPaletteTarget({
            onFileFilter: setFileFilter,
            onNavigate,
            onPendingFilePathChange: setPendingFilePath,
            onSelectedIdChange: setSelectedId,
            target,
            tour: state.tour,
          });
        }}
        open={searchOpen}
        tour={state.tour}
      />
    </>
  );
}

function TourPageSkeleton({ mode }: { mode: TourMode }) {
  return mode === 'review' ? <ReviewWorkspaceSkeleton /> : <TourOverviewSkeleton />;
}

function TourOverviewSkeleton() {
  return (
    <main
      aria-busy="true"
      className="min-h-screen bg-canvas text-fg lg:grid lg:h-screen lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden"
    >
      <header className="grid min-h-[54px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-line px-6 py-2.5 max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-start max-sm:px-4">
        <div className="min-w-0">
          <Skeleton className="h-5 w-[min(240px,70%)] rounded-[5px]" />
          <div className="mt-2 flex items-center gap-1.5">
            <Skeleton className="size-3.5 shrink-0 rounded-[4px]" />
            <Skeleton className="h-3 w-[min(150px,40%)] rounded-[4px]" />
            <Skeleton className="h-3 w-3 shrink-0 rounded-[3px]" />
            <Skeleton className="h-3 w-[min(140px,34%)] rounded-[4px]" />
          </div>
        </div>
        <Skeleton className="size-9 rounded-[8px]" />
        <Skeleton className="h-11 w-[136px] rounded-full max-sm:col-span-2 max-sm:justify-self-start" />
      </header>

      <div className="grid gap-6 px-6 py-3 max-sm:px-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="min-w-0 lg:grid lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-y-1">
          <div className="flex min-h-10 items-center justify-between">
            <Skeleton className="h-3 w-20 rounded-[4px]" />
          </div>
          <Card className="min-h-0 overflow-auto rounded-[8px] border-0 bg-raised-strong p-6 text-fg shadow-[var(--shadow-panel)] before:rounded-[7px] before:shadow-[inset_0_1px_0_oklch(100%_0_0_/_4%)] max-lg:mt-1">
            <CardPanel className="min-h-full p-0">
              <Skeleton className="h-3 w-16 rounded-[4px]" />
              <div className="mt-4 grid gap-3">
                <Skeleton className="h-4 w-full rounded-[4px]" />
                <Skeleton className="h-4 w-[92%] rounded-[4px]" />
                <Skeleton className="h-4 w-[68%] rounded-[4px]" />
              </div>
              <div className="mt-6 grid grid-cols-2 border-y border-hairline">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    className="min-h-[72px] border-hairline px-4 py-4 odd:border-r [&:nth-child(-n+2)]:border-b"
                    key={index}
                  >
                    <Skeleton className="h-3 w-14 rounded-[4px]" />
                    <Skeleton className="mt-3 h-6 w-16 rounded-[5px]" />
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Skeleton className="h-3 w-24 rounded-[4px]" />
                <div className="mt-5 grid gap-4">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div className="grid grid-cols-[12px_minmax(0,1fr)] gap-3" key={index}>
                      <Skeleton className="mt-1 size-2.5 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-[min(280px,80%)] rounded-[4px]" />
                        <Skeleton className="mt-2 h-3 w-[min(360px,92%)] rounded-[4px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardPanel>
          </Card>
        </aside>
        <section className="min-w-0">
          <div className="flex min-h-10 items-center justify-between">
            <Skeleton className="h-3 w-20 rounded-[4px]" />
            <Skeleton className="h-4 w-24 rounded-[4px]" />
          </div>
          <section className="mt-1 max-h-[min(34rem,calc(100vh-220px))] overflow-hidden rounded-[8px] border border-hairline bg-transparent max-lg:max-h-none">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                className="grid min-h-[78px] grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-1.5 border-b border-hairline px-3.5 py-3 last:border-b-0 max-sm:grid-cols-[32px_minmax(0,1fr)] max-sm:px-3"
                key={index}
              >
                <Skeleton className="size-5 justify-self-center rounded-full" />
                <div className="grid min-w-0 grid-cols-[20px_minmax(0,1fr)] items-start gap-x-2 gap-y-1">
                  <Skeleton className="h-4 w-4 justify-self-end rounded-[4px]" />
                  <Skeleton className="h-5 w-[min(340px,76%)] rounded-[5px]" />
                  <span aria-hidden />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-20 rounded-full" />
                    <Skeleton className="h-4 w-10 rounded-[4px]" />
                    <Skeleton className="h-4 w-10 rounded-[4px]" />
                    <Skeleton className="h-4 w-7 rounded-[4px]" />
                  </div>
                </div>
                {index === 0 ? <Skeleton className="h-9 w-36 rounded-[9px]" /> : null}
              </div>
            ))}
          </section>
        </section>
      </div>
    </main>
  );
}

function ReviewWorkspaceSkeleton() {
  return (
    <main
      aria-busy="true"
      className="grid h-screen min-h-screen grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-canvas text-fg max-lg:block max-lg:h-auto max-lg:overflow-visible"
    >
      <header className="grid min-h-[58px] grid-cols-[376px_minmax(0,1fr)] border-b border-line bg-panel max-lg:grid-cols-1">
        <div className="grid min-h-[58px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-r border-line px-4 py-2.5 max-lg:border-r-0">
          <Skeleton className="size-9 rounded-[8px]" />
          <div className="min-w-0">
            <Skeleton className="h-4 w-[min(180px,72%)] rounded-[4px]" />
            <div className="mt-2 flex items-center gap-1.5">
              <Skeleton className="size-3.5 shrink-0 rounded-[4px]" />
              <Skeleton className="h-3 w-[min(128px,38%)] rounded-[4px]" />
              <Skeleton className="h-3 w-3 shrink-0 rounded-[3px]" />
              <Skeleton className="h-3 w-[min(120px,34%)] rounded-[4px]" />
            </div>
          </div>
          <Skeleton className="size-9 rounded-[8px]" />
        </div>
        <div className="flex min-h-[58px] items-center px-4 py-2.5 max-lg:border-t max-lg:border-line">
          <div className="flex items-center gap-1 rounded-[10px] bg-control p-0.5 shadow-control">
            <Skeleton className="h-8 w-24 rounded-[8px]" />
            <Skeleton className="h-8 w-28 rounded-[8px]" />
          </div>
        </div>
      </header>
      <div className="grid min-h-0 grid-cols-[376px_minmax(0,1fr)] max-lg:block">
        <aside className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-r border-line bg-panel max-lg:block max-lg:h-auto max-lg:border-b max-lg:border-r-0">
          <div className="border-b border-line px-4 py-3">
            <div className="grid min-h-9 grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="size-9 rounded-[8px]" />
              <Skeleton className="mx-auto h-8 w-36 rounded-[8px]" />
              <Skeleton className="size-9 rounded-[8px]" />
              <Skeleton className="size-9 rounded-[8px]" />
            </div>
          </div>
          <div className="flex min-h-0 flex-col px-6 pt-7 pb-0 max-lg:block max-lg:px-5 max-lg:py-6">
            <Skeleton className="h-6 w-[min(280px,84%)] rounded-[6px]" />
            <div className="mt-4 flex items-center justify-between gap-4">
              <Skeleton className="h-6 w-24 rounded-full" />
              <div className="flex gap-3">
                <Skeleton className="h-5 w-10 rounded-[4px]" />
                <Skeleton className="h-5 w-10 rounded-[4px]" />
              </div>
            </div>
            <div className="mt-8 grid gap-3">
              <Skeleton className="h-4 w-full rounded-[4px]" />
              <Skeleton className="h-4 w-[88%] rounded-[4px]" />
              <Skeleton className="h-4 w-[64%] rounded-[4px]" />
            </div>
            <Skeleton className="mt-8 h-px w-full rounded-none" />
            <Skeleton className="mt-5 h-3 w-32 rounded-[4px]" />
            <div className="mt-4 grid gap-3">
              {Array.from({ length: 2 }, (_, index) => (
                <div className="flex items-start gap-2" key={index}>
                  <Skeleton className="mt-0.5 size-4 rounded-[4px]" />
                  <Skeleton className="h-4 flex-1 rounded-[4px]" />
                </div>
              ))}
            </div>
            <Skeleton className="mt-8 h-px w-full rounded-none" />
            <Skeleton className="mt-5 h-3 w-20 rounded-[4px]" />
            <Skeleton className="mt-4 h-7 w-full rounded-[6px]" />
            <div className="mt-5 grid gap-3">
              {Array.from({ length: 9 }, (_, index) => (
                <div className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-2" key={index}>
                  <Skeleton className="size-4 rounded-[4px]" />
                  <Skeleton
                    className={`h-4 rounded-[4px] ${
                      index % 3 === 0 ? 'w-[82%]' : index % 3 === 1 ? 'w-[68%]' : 'w-[92%]'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        </aside>
        <section className="h-full min-h-0 overflow-hidden bg-canvas px-8 pb-7 max-lg:h-auto max-lg:px-5">
          <div className="pt-7">
            {Array.from({ length: 3 }, (_, fileIndex) => (
              <section
                className="surface-panel mb-7 overflow-hidden rounded-[8px] bg-panel"
                key={fileIndex}
              >
                <header className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-3 border-b border-line px-4">
                  <Skeleton className="size-5 rounded-[4px]" />
                  <Skeleton className="h-4 w-[min(460px,74%)] rounded-[4px]" />
                  <Skeleton className="size-7 rounded-[6px]" />
                  <Skeleton className="h-4 w-14 rounded-[4px]" />
                  <Skeleton className="size-5 rounded-full" />
                </header>
                <div className="grid gap-px p-3">
                  {Array.from({ length: fileIndex === 0 ? 14 : 9 }, (_, lineIndex) => (
                    <div
                      className="grid min-h-6 grid-cols-[52px_52px_minmax(0,1fr)] items-center gap-3"
                      key={lineIndex}
                    >
                      <Skeleton className="h-3 w-8 justify-self-end rounded-[3px]" />
                      <Skeleton className="h-3 w-8 justify-self-end rounded-[3px]" />
                      <Skeleton
                        className={`h-3 rounded-[3px] ${
                          lineIndex % 4 === 0
                            ? 'w-[92%]'
                            : lineIndex % 4 === 1
                              ? 'w-[74%]'
                              : lineIndex % 4 === 2
                                ? 'w-[58%]'
                                : 'w-[84%]'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function ReadyTourPage({
  diffFoldState,
  diffSettings,
  fileFilter,
  mode,
  onNavigate,
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
  onPendingFilePathChange,
  onReviewQuestionCheckedToggle,
  onSearchOpen,
  onSelectedIdChange,
  pendingFilePath,
  reviewComments,
  reviewProgress,
  selectedId,
  tour,
}: {
  diffFoldState: DiffFoldState;
  diffSettings: DiffDisplaySettings;
  fileFilter: string;
  mode: TourMode;
  onNavigate: (target: TourNavigationTarget) => void;
  onChapterCompletedToggle: (chapterId: string) => void;
  onCommentAdd: (comment: ReviewComment) => void;
  onCommentDelete: (commentId: string) => void;
  onCommentUpdate: (commentId: string, body: string) => void;
  onDiffSettingsChange: (settings: DiffDisplaySettings) => void;
  onFileCollapsedChange: (fileId: string, collapsed: boolean) => void;
  onFoldExpand: (foldId: string) => void;
  onFoldsExpand: (foldIds: readonly string[]) => void;
  onFileViewedToggle: (fileId: string) => void;
  onFileFilter: (value: string) => void;
  onPendingFilePathChange: (path: string) => void;
  onReviewQuestionCheckedToggle: (questionId: string) => void;
  onSearchOpen: () => void;
  onSelectedIdChange: (value: string) => void;
  pendingFilePath: string;
  reviewComments: readonly ReviewComment[];
  reviewProgress: ReviewProgress;
  selectedId: string;
  tour: ReviewTour;
}) {
  const selectedChapter =
    tour.tour.chapters.find((chapter) => chapter.id === selectedId) ??
    tour.tour.chapters[0] ??
    null;

  useEffect(() => {
    if (mode !== 'review' || pendingFilePath || typeof window === 'undefined') return;

    resetReviewScrollPositions();
    const frame = window.requestAnimationFrame(resetReviewScrollPositions);

    return () => window.cancelAnimationFrame(frame);
  }, [mode, pendingFilePath, selectedId]);

  useEffect(() => {
    if (mode !== 'review' || !pendingFilePath || typeof window === 'undefined') return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(fileDomId(pendingFilePath))?.scrollIntoView({
        block: 'start',
        behavior: 'smooth',
      });
      onPendingFilePathChange('');
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mode, onPendingFilePathChange, pendingFilePath, selectedId]);

  if (!selectedChapter) {
    return <ShellMessage message="No chapters in this tour." />;
  }

  const selectReviewChapter = (chapterId: string) => {
    resetReviewScrollPositions();
    onSelectedIdChange(chapterId);
    onFileFilter('');
    onPendingFilePathChange('');
    onNavigate({ chapterId, mode: 'review' });
  };

  const openReview = (chapter: ReviewChapter) => {
    selectReviewChapter(chapter.id);
  };

  return mode === 'overview' ? (
    <TourOverview
      activeChapter={selectedChapter}
      completedChapterIds={reviewProgress.chapterIds}
      onOpenReview={openReview}
      onSearchOpen={onSearchOpen}
      onToggleChapterCompleted={(chapter) => onChapterCompletedToggle(chapter.id)}
      tour={tour}
    />
  ) : (
    <SymbolNavigationProvider chapter={selectedChapter} onChapterSelect={openReview} tour={tour}>
      <ReviewWorkspace
        chapter={selectedChapter}
        chapterCompleted={reviewProgress.chapterIds.has(selectedChapter.id)}
        checkedReviewQuestionIds={reviewProgress.questionIds}
        comments={reviewComments}
        diffFoldState={diffFoldState}
        diffSettings={diffSettings}
        fileFilter={fileFilter}
        onBack={() => onNavigate({ mode: 'overview' })}
        onChapterCompletedToggle={() => onChapterCompletedToggle(selectedChapter.id)}
        onDiffSettingsChange={onDiffSettingsChange}
        onFileCollapsedChange={onFileCollapsedChange}
        onFoldExpand={onFoldExpand}
        onFoldsExpand={onFoldsExpand}
        onFileViewedToggle={onFileViewedToggle}
        onFileFilter={onFileFilter}
        onChapterSelect={openReview}
        onCommentAdd={onCommentAdd}
        onCommentDelete={onCommentDelete}
        onCommentUpdate={onCommentUpdate}
        onNext={() => {
          const chapters = tour.tour.chapters;
          const index = chapters.findIndex((chapter) => chapter.id === selectedChapter.id);
          const next = index >= 0 ? chapters[index + 1] : undefined;
          if (!next) return;

          selectReviewChapter(next.id);
        }}
        onPrevious={() => {
          const chapters = tour.tour.chapters;
          const index = chapters.findIndex((chapter) => chapter.id === selectedChapter.id);
          const previous = index > 0 ? chapters[index - 1] : undefined;
          if (!previous) return;

          selectReviewChapter(previous.id);
        }}
        onReviewQuestionCheckedToggle={onReviewQuestionCheckedToggle}
        onSearchOpen={onSearchOpen}
        tour={tour}
        viewedFileIds={reviewProgress.fileIds}
      />
    </SymbolNavigationProvider>
  );
}

function getReviewProgressStorageKey({ repoHash, tourId }: { repoHash: string; tourId: string }) {
  return `${REVIEW_PROGRESS_STORAGE_PREFIX}:${repoHash}:${tourId}`;
}

function getReviewCommentsStorageKey({ repoHash, tourId }: { repoHash: string; tourId: string }) {
  return `${REVIEW_COMMENTS_STORAGE_PREFIX}:${repoHash}:${tourId}`;
}

function getDiffFoldStateStorageKey({ repoHash, tourId }: { repoHash: string; tourId: string }) {
  return `${DIFF_FOLD_STATE_STORAGE_PREFIX}:${repoHash}:${tourId}`;
}

function getLegacyChapterProgressStorageKey({
  repoHash,
  tourId,
}: {
  repoHash: string;
  tourId: string;
}) {
  return `${LEGACY_CHAPTER_PROGRESS_STORAGE_PREFIX}:${repoHash}:${tourId}`;
}

function resetReviewScrollPositions() {
  if (typeof window === 'undefined') return;

  window.scrollTo({ left: 0, top: 0, behavior: 'auto' });

  for (const element of document.querySelectorAll<HTMLElement>(
    '[data-left-pane-scroll], [data-diff-scroll-root]',
  )) {
    element.scrollTo({ left: 0, top: 0, behavior: 'auto' });
  }
}

function handleCommandPaletteTarget({
  onFileFilter,
  onNavigate,
  onPendingFilePathChange,
  onSelectedIdChange,
  target,
  tour,
}: {
  onFileFilter: (value: string) => void;
  onNavigate: (target: TourNavigationTarget) => void;
  onPendingFilePathChange: (path: string) => void;
  onSelectedIdChange: (value: string) => void;
  target: CommandPaletteTarget;
  tour: ReviewTour;
}) {
  if (target.type === 'chapter') {
    resetReviewScrollPositions();
    onSelectedIdChange(target.chapterId);
    onFileFilter('');
    onPendingFilePathChange('');
    onNavigate({ chapterId: target.chapterId, mode: 'review' });
    return;
  }

  if (target.type === 'question') {
    resetReviewScrollPositions();
    onSelectedIdChange(target.chapterId);
    onFileFilter('');
    onPendingFilePathChange('');
    onNavigate({ chapterId: target.chapterId, mode: 'review' });
    return;
  }

  const chapter =
    tour.tour.chapters.find((item) => item.files.some((file) => file.path === target.path)) ??
    tour.tour.chapters[0];

  if (!chapter) return;

  onSelectedIdChange(chapter.id);
  onFileFilter('');
  onPendingFilePathChange(target.path);
  onNavigate({ chapterId: chapter.id, filePath: target.path, mode: 'review' });
}

function getRouteChapterId(tour: ReviewTour, chapterId?: string) {
  if (!chapterId) return undefined;
  return tour.tour.chapters.some((chapter) => chapter.id === chapterId) ? chapterId : undefined;
}
