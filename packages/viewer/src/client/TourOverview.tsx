import AlertDiamondIcon from '@hugeicons/core-free-icons/AlertDiamondIcon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import ArrowRight02Icon from '@hugeicons/core-free-icons/ArrowRight02Icon';
import GitBranchIcon from '@hugeicons/core-free-icons/GitBranchIcon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import type { ReviewChapter, ReviewPrologue, ReviewTour } from 'review-tour/schema';
import { Button } from '#/components/ui/button';
import { Card, CardPanel } from '#/components/ui/card';
import { getChapterStats } from '../reviewModel';
import { LanguageControl, type Translator, useI18n } from './i18n';
import { MarkdownInlineText, MarkdownText } from './MarkdownText';
import { ThemeModeControl } from './theme';
import {
  AppIcon,
  ChapterMeta,
  ChapterReviewedToggle,
  IconButton,
  PanelHeading,
  SectionLabel,
  Warnings,
} from './ui';

export function TourOverview({
  activeChapter,
  completedChapterIds,
  onOpenReview,
  onSearchOpen,
  onToggleChapterCompleted,
  tour,
}: {
  activeChapter: ReviewChapter;
  completedChapterIds: ReadonlySet<string>;
  onOpenReview: (chapter: ReviewChapter) => void;
  onSearchOpen: () => void;
  onToggleChapterCompleted: (chapter: ReviewChapter) => void;
  tour: ReviewTour;
}) {
  const { t } = useI18n();
  const completedCount = tour.tour.chapters.filter((chapter) =>
    completedChapterIds.has(chapter.id),
  ).length;
  const firstUncompletedChapterId = tour.tour.chapters.find(
    (chapter) => !completedChapterIds.has(chapter.id),
  )?.id;
  const visibleWarnings = tour.warnings.filter((warning) => warning.code !== 'BASE_BRANCH_GUESSED');
  const prologue = getOverviewPrologue(tour, t);

  return (
    <main className="min-h-screen bg-canvas text-fg lg:grid lg:h-screen lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden">
      <header className="grid min-h-[54px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-line px-6 py-2.5 max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-start max-sm:px-4">
        <div
          className="min-w-0"
          title={`${tour.repository.name} - ${tour.repository.currentBranch} -> ${tour.repository.baseBranch}`}
        >
          <strong className="block truncate text-base font-semibold leading-6 text-fg">
            {tour.repository.name}
          </strong>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-fg-muted">
            <AppIcon className="shrink-0 text-fg-muted" icon={GitBranchIcon} size={13} />
            <span className="min-w-0 truncate font-mono text-fg-secondary">
              {tour.repository.currentBranch}
            </span>
            <AppIcon className="shrink-0 text-fg-faint" icon={ArrowRight02Icon} size={12} />
            <span className="min-w-0 truncate font-mono text-fg-secondary">
              {tour.repository.baseBranch}
            </span>
          </span>
        </div>
        <IconButton icon={Search01Icon} label={t('Search')} onClick={onSearchOpen} />
        <div className="flex items-center gap-2 max-sm:col-span-2 max-sm:justify-self-start">
          <LanguageControl />
          <ThemeModeControl />
        </div>
      </header>

      <div className="grid gap-6 px-6 py-3 max-sm:px-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="min-w-0 lg:grid lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-y-1">
          <PanelHeading label={t('Prologue')} />
          <Card className="min-h-0 overflow-auto rounded-[8px] border-0 bg-raised-strong p-6 text-fg shadow-[var(--shadow-panel)] before:rounded-[7px] before:shadow-[inset_0_1px_0_oklch(100%_0_0_/_4%)] max-lg:mt-1">
            <CardPanel className="min-h-full p-0">
              <section>
                <SectionLabel>{t('Why this PR?')}</SectionLabel>
                <MarkdownText
                  className="mt-3 grid gap-3 text-sm leading-[1.55] text-fg-secondary"
                  text={prologue.whyThisPr}
                />
              </section>

              <section className="mt-6">
                <SectionLabel>{t('What it does')}</SectionLabel>
                <MarkdownText
                  className="mt-3 grid gap-3 text-sm leading-[1.55] text-fg-secondary"
                  text={prologue.whatItDoes}
                />
              </section>

              <section className="mt-6">
                <SectionLabel>{t('Key changes')}</SectionLabel>
                <ul className="mt-5 grid gap-4">
                  {tour.tour.chapters.slice(0, 4).map((chapter) => (
                    <li
                      className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-2.5 text-fg-secondary"
                      key={chapter.id}
                    >
                      <span
                        aria-hidden
                        className="mt-[0.48rem] size-1.5 rounded-full bg-fg-muted"
                      />
                      <span className="min-w-0">
                        <strong className="block text-sm font-semibold leading-5">
                          {chapter.title}
                        </strong>
                        <span className="mt-1 block text-[13px] leading-[1.45] text-fg-muted">
                          <MarkdownInlineText text={chapter.summary} />
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <Warnings warnings={visibleWarnings} />
              <ReviewFocus items={prologue.reviewFocus} />
            </CardPanel>
          </Card>
        </aside>

        <section className="min-w-0">
          <PanelHeading label={t('Chapters')}>
            <ChapterOverviewStats
              additions={tour.diff.stats.additions}
              completedCount={completedCount}
              deletions={tour.diff.stats.deletions}
              totalCount={tour.tour.chapters.length}
            />
          </PanelHeading>
          <section className="mt-1 max-h-[min(34rem,calc(100vh-220px))] overflow-auto rounded-[8px] border border-hairline bg-transparent max-lg:max-h-none">
            {tour.tour.chapters.map((chapter) => (
              <ChapterRow
                active={chapter.id === activeChapter.id}
                chapter={chapter}
                completed={completedChapterIds.has(chapter.id)}
                key={chapter.id}
                onOpenReview={onOpenReview}
                onToggleCompleted={onToggleChapterCompleted}
                showStartButton={chapter.id === firstUncompletedChapterId}
                stats={getChapterStats(tour, chapter)}
              />
            ))}
          </section>
        </section>
      </div>
    </main>
  );
}

function ReviewFocus({ items }: { items: ReviewPrologue['reviewFocus'] }) {
  const { t } = useI18n();
  if (items.length === 0) return null;

  return (
    <section className="mt-6 pb-3">
      <SectionLabel>{t('Review Focus')}</SectionLabel>
      <div className="mt-4 grid gap-4">
        {items.map((item, index) => (
          <article className="grid min-w-0 gap-1.5" key={`${item.title}:${item.path ?? index}`}>
            <div className="flex min-w-0 items-start gap-1.5">
              <AppIcon
                className="mt-[3px] shrink-0 text-warning"
                icon={AlertDiamondIcon}
                size={14}
              />
              <h3 className="min-w-0 text-sm font-semibold leading-5 text-fg">{item.title}</h3>
            </div>
            {item.path ? (
              <span
                className="block truncate font-mono text-xs leading-4 text-fg-muted"
                title={item.path}
              >
                {getFileName(item.path)}
              </span>
            ) : null}
            <MarkdownText
              className="grid gap-2 text-[13px] leading-[1.45] text-fg-secondary"
              text={item.summary}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function ChapterOverviewStats({
  additions,
  completedCount,
  deletions,
  totalCount,
}: {
  additions: number;
  completedCount: number;
  deletions: number;
  totalCount: number;
}) {
  const { t } = useI18n();
  const reviewed = `${completedCount}/${totalCount}`;
  return (
    <div
      aria-label={t('{additions} additions, {deletions} deletions, {reviewed} reviewed', {
        additions,
        deletions,
        reviewed,
      })}
      className="mono-tabular flex min-w-0 items-center gap-2 text-[11px] font-semibold normal-case tracking-normal"
      title={t('{additions} additions, {deletions} deletions, {reviewed} reviewed', {
        additions,
        deletions,
        reviewed,
      })}
    >
      <span className="font-mono text-add">+{additions}</span>
      <span className="font-mono text-delete">-{deletions}</span>
      <strong className="ml-1 truncate text-xs font-medium text-fg-secondary">
        {t('{reviewed} reviewed', { reviewed })}
      </strong>
    </div>
  );
}

function getFileName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function getOverviewPrologue(tour: ReviewTour, t: Translator): ReviewPrologue {
  if (tour.tour.prologue) {
    return tour.tour.prologue;
  }

  const topChapters = [...tour.tour.chapters]
    .sort((a, b) => getRiskWeight(b.risk) - getRiskWeight(a.risk))
    .slice(0, 3);

  return {
    whyThisPr: tour.tour.summary,
    whatItDoes:
      tour.tour.chapters
        .slice(0, 3)
        .map((chapter) => chapter.summary)
        .join('\n\n') ||
      t('Review the changed files and confirm each chapter matches the diff intent.'),
    reviewFocus: topChapters.map((chapter) => ({
      title: chapter.title,
      path: chapter.files[0]?.path,
      summary: chapter.rationale || chapter.summary,
      hunkIds: chapter.hunkIds,
    })),
  };
}

function getRiskWeight(risk: ReviewChapter['risk']) {
  if (risk === 'high') return 3;
  if (risk === 'medium') return 2;
  return 1;
}

function ChapterRow({
  active,
  chapter,
  completed,
  onOpenReview,
  onToggleCompleted,
  showStartButton,
  stats,
}: {
  active: boolean;
  chapter: ReviewChapter;
  completed: boolean;
  onOpenReview: (chapter: ReviewChapter) => void;
  onToggleCompleted: (chapter: ReviewChapter) => void;
  showStartButton: boolean;
  stats: ReturnType<typeof getChapterStats>;
}) {
  const { t } = useI18n();
  return (
    <article
      aria-current={active ? 'true' : undefined}
      className="grid min-h-[78px] cursor-pointer grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-1.5 border-b border-hairline px-3.5 py-3 text-left transition-[background-color,box-shadow] duration-150 [transition-timing-function:var(--ease-polished)] last:border-b-0 hover:bg-hover/25 max-sm:grid-cols-[32px_minmax(0,1fr)] max-sm:px-3"
      onClick={() => onOpenReview(chapter)}
    >
      <div className="justify-self-center" onClick={(event) => event.stopPropagation()}>
        <ChapterReviewedToggle
          completed={completed}
          onToggle={() => onToggleCompleted(chapter)}
          title={completed ? t('Mark chapter as not reviewed') : t('Mark chapter as reviewed')}
          variant="icon"
        />
      </div>
      <button
        className="focus-ring grid min-w-0 grid-cols-[20px_minmax(0,1fr)] items-start gap-x-2 gap-y-1 bg-transparent text-left"
        onClick={(event) => {
          event.stopPropagation();
          onOpenReview(chapter);
        }}
        type="button"
      >
        <span className="mono-tabular text-right font-mono text-[13px] leading-5 text-fg-muted">
          {chapter.index}
        </span>
        <strong className="block min-w-0 truncate text-[15px] font-semibold leading-5 text-fg">
          {chapter.title}
        </strong>
        <span aria-hidden />
        <ChapterMeta risk={chapter.risk} stats={stats} />
      </button>
      <div className="flex items-center max-sm:col-start-2 max-sm:justify-self-start">
        {showStartButton ? (
          <Button
            className="h-9 rounded-[9px] pl-4 pr-3.5 text-sm before:rounded-[8px] max-sm:h-8 max-sm:px-3 max-sm:pr-2.5 max-sm:text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onOpenReview(chapter);
            }}
            variant="success"
          >
            {t('Start reviewing')}
            <AppIcon className="-mr-0.5" icon={ArrowRight01Icon} size={17} />
          </Button>
        ) : null}
      </div>
    </article>
  );
}
