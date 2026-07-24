import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReviewChapter } from 'review-tour/schema';
import {
  addStringSetValues,
  createEmptyDiffFoldState,
  setStringSetValue,
  type DiffFoldState,
} from '#/client/diffFoldState';
import { defaultDiffDisplaySettings, type DiffDisplaySettings } from '#/client/diffSettings';
import type { ReviewComment } from '#/client/reviewComments';
import { ReviewWorkspace } from '#/client/ReviewWorkspace';
import { ToastProvider } from '#/components/ui/toast';
import { useLandingI18n } from '../i18n';
import { getDemoTour } from './demoTour';

const CHAPTER_DURATION_MS = 9000;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setInView(true);
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return inView;
}

export function ProductDemo() {
  const { locale } = useLandingI18n();
  const demoTour = useMemo(() => getDemoTour(locale), [locale]);
  const chapters = demoTour.tour.chapters;
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef);
  const reducedMotion = usePrefersReducedMotion();

  const [activeIndex, setActiveIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [comments, setComments] = useState<readonly ReviewComment[]>([]);
  const [diffFoldState, setDiffFoldState] = useState<DiffFoldState>(createEmptyDiffFoldState);
  const [diffSettings, setDiffSettings] = useState<DiffDisplaySettings>(defaultDiffDisplaySettings);
  const [viewedFileIds, setViewedFileIds] = useState<ReadonlySet<string>>(new Set());
  const [reviewedGroupIds, setReviewedGroupIds] = useState<ReadonlySet<string>>(new Set());
  const [completedChapterIds, setCompletedChapterIds] = useState<ReadonlySet<string>>(new Set());
  const [checkedReviewQuestionIds, setCheckedReviewQuestionIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [fileFilter, setFileFilter] = useState('');

  const chapter = chapters[activeIndex];
  const playing = autoplay && inView && !reducedMotion;

  useEffect(() => {
    if (!playing) return;

    const id = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % chapters.length);
    }, CHAPTER_DURATION_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  useEffect(() => {
    containerRef.current?.querySelector('[data-diff-scroll-root]')?.scrollTo({ top: 0, left: 0 });
  }, [activeIndex]);

  const selectChapter = (nextChapter: ReviewChapter) => {
    const index = chapters.findIndex((item) => item.id === nextChapter.id);
    if (index >= 0) setActiveIndex(index);
  };

  return (
    <div className="relative" onPointerDownCapture={() => setAutoplay(false)} ref={containerRef}>
      <div className="lp-demo-embed overflow-hidden rounded-xl bg-canvas shadow-[0_0_0_1px_oklch(100%_0_0_/_10%),0_24px_80px_-24px_rgb(0_0_0_/_70%)]">
        <div className="relative flex h-11 items-center justify-center border-b border-lp-line bg-panel">
          <div className="absolute left-4 flex items-center gap-2">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
          </div>
          <p className="text-xs text-fg-muted">Review Tour — localhost:4378</p>
        </div>

        <div className="h-[560px] overflow-hidden max-lg:overflow-y-auto md:h-[680px]">
          <ToastProvider>
            <ReviewWorkspace
              chapter={chapter}
              chapterCompleted={completedChapterIds.has(chapter.id)}
              checkedReviewQuestionIds={checkedReviewQuestionIds}
              comments={comments}
              diffFoldState={diffFoldState}
              diffSettings={diffSettings}
              fileFilter={fileFilter}
              onBack={() => setAutoplay(false)}
              onChapterCompletedToggle={() =>
                setCompletedChapterIds((current) =>
                  setStringSetValue(current, chapter.id, !current.has(chapter.id)),
                )
              }
              onChapterSelect={selectChapter}
              onCommentAdd={(comment) => setComments((current) => [...current, comment])}
              onCommentDelete={(commentId) =>
                setComments((current) => current.filter((comment) => comment.id !== commentId))
              }
              onCommentUpdate={(commentId, body) =>
                setComments((current) =>
                  current.map((comment) =>
                    comment.id === commentId ? { ...comment, body } : comment,
                  ),
                )
              }
              onDiffSettingsChange={setDiffSettings}
              onFileCollapsedChange={(fileId, collapsed) =>
                setDiffFoldState((current) => ({
                  ...current,
                  collapsedFileIds: setStringSetValue(current.collapsedFileIds, fileId, collapsed),
                }))
              }
              onFileFilter={setFileFilter}
              onFileViewedToggle={(fileId) =>
                setViewedFileIds((current) =>
                  setStringSetValue(current, fileId, !current.has(fileId)),
                )
              }
              onGroupReviewedToggle={(groupProgressId) =>
                setReviewedGroupIds((current) =>
                  setStringSetValue(current, groupProgressId, !current.has(groupProgressId)),
                )
              }
              onFoldExpand={(foldId) =>
                setDiffFoldState((current) => ({
                  ...current,
                  expandedFoldIds: addStringSetValues(current.expandedFoldIds, [foldId]),
                }))
              }
              onFoldsExpand={(foldIds) =>
                setDiffFoldState((current) => ({
                  ...current,
                  expandedFoldIds: addStringSetValues(current.expandedFoldIds, foldIds),
                }))
              }
              onNext={() => setActiveIndex((index) => Math.min(index + 1, chapters.length - 1))}
              onPrevious={() => setActiveIndex((index) => Math.max(index - 1, 0))}
              onReviewQuestionCheckedToggle={(questionId) =>
                setCheckedReviewQuestionIds((current) =>
                  setStringSetValue(current, questionId, !current.has(questionId)),
                )
              }
              onSearchOpen={() => {}}
              reviewedGroupIds={reviewedGroupIds}
              tour={demoTour}
              viewedFileIds={viewedFileIds}
            />
          </ToastProvider>
        </div>
      </div>

      <DemoTerminal play={inView} reducedMotion={reducedMotion} />
    </div>
  );
}

type TerminalStep = {
  id: string;
  kind: 'tool' | 'sub' | 'success';
  text: string;
};

const COMMAND_TEXT = '/review-tour';

function DemoTerminal({ play, reducedMotion }: { play: boolean; reducedMotion: boolean }) {
  const { t } = useLandingI18n();
  const terminalSteps = useMemo<TerminalStep[]>(
    () => [
      {
        id: 'collect',
        kind: 'tool',
        text: t('Reviewing the diff against main — 5 files (+75 −2)'),
      },
      { id: 'chapters', kind: 'tool', text: t('Writing chapters') },
      { id: 'ch1', kind: 'sub', text: t('1. Verify webhook signatures        high') },
      { id: 'ch2', kind: 'sub', text: t('2. Idempotent event processing      medium') },
      { id: 'ch3', kind: 'sub', text: t('3. Tests and configuration          low') },
      { id: 'open', kind: 'tool', text: t('Opening the viewer') },
      { id: 'ready', kind: 'success', text: t('Tour ready → http://localhost:4378') },
    ],
    [t],
  );
  const [typedChars, setTypedChars] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const commandTyped = typedChars >= COMMAND_TEXT.length;
  const finished = revealedCount >= terminalSteps.length;

  useEffect(() => {
    if (!play) return;
    if (reducedMotion) {
      setTypedChars(COMMAND_TEXT.length);
      setRevealedCount(terminalSteps.length);
      return;
    }

    if (!commandTyped) {
      // A little jitter between keystrokes reads as typed rather than revealed.
      const delay = typedChars === 0 ? 500 : 32 + Math.round(Math.random() * 30);
      const id = window.setTimeout(() => setTypedChars((count) => count + 1), delay);
      return () => window.clearTimeout(id);
    }

    if (finished) return;

    const nextStep = terminalSteps[revealedCount];
    const delay = revealedCount === 0 ? 420 : nextStep.kind === 'sub' ? 130 : 620;
    const id = window.setTimeout(() => setRevealedCount((count) => count + 1), delay);
    return () => window.clearTimeout(id);
  }, [play, reducedMotion, typedChars, commandTyped, finished, revealedCount, terminalSteps]);

  return (
    <div className="pointer-events-none absolute -right-3 -bottom-8 hidden w-[380px] overflow-hidden rounded-lg bg-[oklch(12%_0.004_95)] shadow-[0_0_0_1px_oklch(100%_0_0_/_12%),0_16px_48px_-12px_rgb(0_0_0_/_80%)] lg:block">
      <div className="relative flex h-8 items-center justify-center border-b border-lp-line">
        <div className="absolute left-3 flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#ff5f57]" />
          <span className="size-2 rounded-full bg-[#febc2e]" />
          <span className="size-2 rounded-full bg-[#28c840]" />
        </div>
        <p className="text-[10px] text-fg-faint">Claude Code</p>
      </div>
      <div className="min-h-40 px-4 py-3 font-mono text-[11px] leading-[1.8]">
        <p className="text-fg">
          <span className="select-none text-fg-muted">{'> '}</span>
          {COMMAND_TEXT.slice(0, typedChars)}
          {!commandTyped ? (
            <span className="lp-terminal-caret ml-px inline-block h-3.5 w-1.5 translate-y-0.5 bg-fg-muted" />
          ) : null}
        </p>
        {commandTyped
          ? terminalSteps.slice(0, revealedCount).map((step) => (
              <p
                className={`lp-terminal-line ${step.kind === 'success' ? 'lp-terminal-success text-diff-add-fg' : 'text-fg-muted'}`}
                key={step.id}
              >
                {step.kind === 'tool' ? (
                  <span className="lp-terminal-bullet mr-1.5 inline-block text-fg-faint">●</span>
                ) : null}
                {step.text}
              </p>
            ))
          : null}
        {commandTyped && finished ? (
          <p className="lp-terminal-line text-fg">
            <span className="select-none text-fg-muted">{'> '}</span>
            <span className="lp-terminal-caret inline-block h-3.5 w-1.5 translate-y-0.5 bg-fg-muted" />
          </p>
        ) : null}
      </div>
    </div>
  );
}
