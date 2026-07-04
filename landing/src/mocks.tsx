import { RiskBadge } from '#/client/ui';
import { demoTour } from './demo/demoTour';

const chapters = demoTour.tour.chapters;
const stats = demoTour.diff.stats;

export function ChaptersMock() {
  return (
    <div className="overflow-hidden rounded-xl bg-lp-canvas shadow-[0_0_0_1px_oklch(100%_0_0_/_9%),0_16px_48px_-16px_rgb(0_0_0_/_60%)]">
      <div className="border-b border-lp-line px-5 py-4">
        <p className="text-[11px] font-medium tracking-wide text-fg-faint uppercase">Review tour</p>
        <p className="mt-1.5 text-sm leading-snug font-medium text-fg">{demoTour.tour.title}</p>
        <p className="mono-tabular mt-2 font-mono text-[11px] text-fg-muted">
          {stats.filesChanged} files <span className="text-diff-add-fg">+{stats.additions}</span>{' '}
          <span className="text-diff-delete-fg">−{stats.deletions}</span>
        </p>
      </div>
      <div className="flex flex-col gap-1 p-2.5">
        {chapters.map((chapter) => (
          <div className="rounded-lg px-3.5 py-3 transition-colors hover:bg-hover" key={chapter.id}>
            <div className="flex items-start gap-3">
              <span className="mono-tabular mt-0.5 font-mono text-[11px] text-fg-faint">
                {chapter.index}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug font-medium text-fg">{chapter.title}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <RiskBadge risk={chapter.risk} />
                  <span className="text-[11px] text-fg-faint">
                    {chapter.files.length} {chapter.files.length === 1 ? 'file' : 'files'} ·{' '}
                    {chapter.reviewQuestions.length} questions
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuestionsMock() {
  const chapter = chapters[0];

  return (
    <div className="overflow-hidden rounded-xl bg-lp-canvas shadow-[0_0_0_1px_oklch(100%_0_0_/_9%),0_16px_48px_-16px_rgb(0_0_0_/_60%)]">
      <div className="border-b border-lp-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <p className="mono-tabular font-mono text-[11px] text-fg-faint">
            Chapter 1 of {chapters.length}
          </p>
          <RiskBadge risk={chapter.risk} />
        </div>
        <p className="mt-1.5 text-sm leading-snug font-medium text-fg">{chapter.title}</p>
      </div>
      <div className="flex flex-col gap-1 p-2.5">
        <p className="px-3.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-fg-faint uppercase">
          Review questions
        </p>
        {chapter.reviewQuestions.map((question, index) => {
          const done = index === 0;
          return (
            <div className="flex items-start gap-3 rounded-lg px-3.5 py-2.5" key={question}>
              {done ? <CheckedCircle /> : <EmptyCircle />}
              <p
                className={`text-[13px] leading-relaxed ${done ? 'text-fg-muted line-through decoration-fg-faint' : 'text-fg-secondary'}`}
              >
                {question}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckedCircle() {
  return (
    <svg
      aria-hidden
      className="mt-0.5 shrink-0"
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <circle cx="8" cy="8" fill="oklch(58% 0.13 145 / 25%)" r="7" />
      <path
        d="M5 8.2l2 2L11 6"
        stroke="oklch(75% 0.15 145)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function EmptyCircle() {
  return (
    <svg
      aria-hidden
      className="mt-0.5 shrink-0"
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <circle cx="8" cy="8" r="6.5" stroke="oklch(100% 0 0 / 22%)" strokeWidth="1.2" />
    </svg>
  );
}
