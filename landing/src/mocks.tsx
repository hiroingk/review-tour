import { useState } from 'react';
import { RiskBadge } from '#/client/ui';
import { getDemoTour } from './demo/demoTour';
import { useLandingI18n } from './i18n';

export function ChaptersMock() {
  const { locale, t } = useLandingI18n();
  const demoTour = getDemoTour(locale);
  const chapters = demoTour.tour.chapters;
  const stats = demoTour.diff.stats;

  return (
    <div className="overflow-hidden rounded-xl bg-lp-canvas shadow-[0_0_0_1px_oklch(100%_0_0_/_9%),0_16px_48px_-16px_rgb(0_0_0_/_60%)]">
      <div className="border-b border-lp-line px-5 py-4">
        <p className="text-[11px] font-medium tracking-wide text-fg-faint uppercase">
          {t('Review tour')}
        </p>
        <p className="mt-1.5 text-sm leading-snug font-medium text-fg">{demoTour.tour.title}</p>
        <p className="mono-tabular mt-2 font-mono text-[11px] text-fg-muted">
          {t('{count} files', { count: stats.filesChanged })}{' '}
          <span className="text-diff-add-fg">+{stats.additions}</span>{' '}
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
                    {t('{count} files', { count: chapter.files.length })} ·{' '}
                    {t('{count} questions', { count: chapter.reviewQuestions.length })}
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
  const { locale, t } = useLandingI18n();
  const demoTour = getDemoTour(locale);
  const chapters = demoTour.tour.chapters;
  const chapter = chapters[0];

  return (
    <div className="overflow-hidden rounded-xl bg-lp-canvas shadow-[0_0_0_1px_oklch(100%_0_0_/_9%),0_16px_48px_-16px_rgb(0_0_0_/_60%)]">
      <div className="border-b border-lp-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <p className="mono-tabular font-mono text-[11px] text-fg-faint">
            {t('Chapter 1 of {count}', { count: chapters.length })}
          </p>
          <RiskBadge risk={chapter.risk} />
        </div>
        <p className="mt-1.5 text-sm leading-snug font-medium text-fg">{chapter.title}</p>
      </div>
      <div className="flex flex-col gap-1 p-2.5">
        <p className="px-3.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-fg-faint uppercase">
          {t('Review questions')}
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

export function CodeJumpMock() {
  const { t } = useLandingI18n();
  const [jumpCount, setJumpCount] = useState(0);
  const jumped = jumpCount > 0;

  return (
    <div className="overflow-hidden rounded-xl bg-lp-canvas shadow-[0_0_0_1px_oklch(100%_0_0_/_9%),0_16px_48px_-16px_rgb(0_0_0_/_60%)]">
      <div className="flex items-end justify-between gap-3 border-b border-lp-line px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-wide text-fg-faint uppercase">
            {t('Reference')}
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-fg-secondary">
            src/server/webhooks/stripe.ts
          </p>
        </div>
        <span className="mono-tabular shrink-0 font-mono text-[10px] text-fg-faint">:15</span>
      </div>

      <div className="p-3.5 sm:p-4">
        <div className="overflow-hidden rounded-lg bg-panel shadow-[0_0_0_1px_oklch(100%_0_0_/_7%)]">
          <CodeLine number={14}>const check =</CodeLine>
          <CodeLine number={15}>
            <button
              aria-label={t('Go to definition')}
              className="focus-ring rounded-[3px] bg-[color-mix(in_srgb,var(--color-add)_18%,transparent)] px-1 text-lp-accent underline decoration-lp-accent/70 underline-offset-2 transition-[background-color,scale] duration-150 ease-out hover:bg-[color-mix(in_srgb,var(--color-add)_30%,transparent)] active:scale-[0.96]"
              onClick={() => setJumpCount((count) => count + 1)}
              title={t('Go to definition')}
              type="button"
            >
              verifyStripeSignature
            </button>
            (
          </CodeLine>
          <CodeLine number={16}> payload, signature, secret,</CodeLine>
          <CodeLine number={17}>);</CodeLine>
        </div>

        <div className="grid grid-cols-[20px_minmax(0,1fr)] items-center gap-3 py-2">
          <div className="relative mx-auto h-9 w-px bg-lp-line">
            {jumped ? (
              <span className="lp-code-jump-tracer" key={jumpCount} />
            ) : (
              <span className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-lp-fg-muted" />
            )}
          </div>
          <p
            aria-live="polite"
            className={`text-[10px] font-medium tracking-wide uppercase transition-colors duration-150 ${
              jumped ? 'text-lp-accent' : 'text-fg-faint'
            }`}
          >
            {jumped ? t('Definition found') : t('Click the highlighted symbol')}
          </p>
        </div>

        <div
          className={`overflow-hidden rounded-lg bg-panel shadow-[0_0_0_1px_oklch(100%_0_0_/_7%)] ${
            jumped ? 'lp-code-jump-target-active' : ''
          }`}
          key={jumpCount}
        >
          <div className="flex items-end justify-between gap-3 border-b border-lp-line px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[9px] font-medium tracking-wide text-fg-faint uppercase">
                {t('Definition')}
              </p>
              <p className="mt-0.5 truncate font-mono text-[10px] text-fg-secondary">
                src/server/webhooks/verifySignature.ts
              </p>
            </div>
            <span className="mono-tabular shrink-0 font-mono text-[9px] text-fg-faint">:9</span>
          </div>
          <CodeLine number={9}>
            <span className="text-fg-muted">export function</span>{' '}
            <span className="text-lp-accent">verifyStripeSignature</span>(
          </CodeLine>
          <CodeLine number={10}> payload: string,</CodeLine>
          <CodeLine number={11}> signature: string,</CodeLine>
        </div>
      </div>
    </div>
  );
}

function CodeLine({ children, number }: { children: React.ReactNode; number: number }) {
  return (
    <div className="grid min-h-7 grid-cols-[28px_minmax(0,1fr)] items-center font-mono text-[10px] leading-5">
      <span className="mono-tabular pr-2 text-right text-fg-faint select-none">{number}</span>
      <code className="min-w-0 overflow-x-auto pr-3 whitespace-pre text-fg-secondary">
        {children}
      </code>
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
