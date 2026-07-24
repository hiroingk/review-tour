import { useState, type ReactNode } from 'react';
import heroBg from './assets/hero-bg.jpg';
import { LandingLanguageControl, useLandingI18n } from './i18n';

export const GITHUB_URL = 'https://github.com/hiroingk/review-tour';
const SKILL_COMMAND = 'npx skills add hiroingk/review-tour';
const CLI_COMMAND = 'npm install -g review-tour';

export function Nav() {
  const { t } = useLandingI18n();
  return (
    <header className="sticky top-0 z-40 border-b border-lp-line bg-lp-canvas/85 backdrop-blur-md">
      <div className="lp-container flex h-16 items-center justify-between">
        <a className="flex items-center gap-2.5" href="#top">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight text-lp-fg">Review Tour</span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          <a
            className="text-sm text-lp-fg-secondary transition-colors hover:text-lp-fg"
            href="#features"
          >
            {t('Features')}
          </a>
          <a
            className="text-sm text-lp-fg-secondary transition-colors hover:text-lp-fg"
            href="#demo"
          >
            {t('Demo')}
          </a>
          <a
            className="text-sm text-lp-fg-secondary transition-colors hover:text-lp-fg"
            href="#install"
          >
            {t('Install')}
          </a>
          <a
            className="text-sm text-lp-fg-secondary transition-colors hover:text-lp-fg"
            href={GITHUB_URL}
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <LandingLanguageControl />
          <a
            className="lp-pill lp-pill-outline hidden !px-4 !py-2.5 text-[13px] sm:inline-flex"
            href={GITHUB_URL}
            rel="noreferrer"
            target="_blank"
          >
            {t('Star on GitHub')}
          </a>
          <a
            className="lp-pill lp-pill-primary shrink-0 whitespace-nowrap !px-4 !py-2.5 text-[13px]"
            href="#install"
          >
            {t('Install')}
          </a>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg aria-hidden fill="none" height="22" viewBox="0 0 22 22" width="22">
      <rect fill="oklch(70% 0.15 145)" height="22" rx="5" width="22" />
      <path
        d="M6 7.5h10M6 11h7M6 14.5h4.5"
        stroke="oklch(15% 0.005 95)"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function Hero({ demo }: { demo: ReactNode }) {
  const { t } = useLandingI18n();
  return (
    <section className="lp-container pt-16 pb-10 md:pt-24" id="top">
      <h1 className="lp-heading lp-heading-hero max-w-[24ch] text-[38px] leading-[1.14] md:text-[54px]">
        {t('Review Tour turns pull requests into stories you can actually review.')}
      </h1>
      <div className="mt-8 flex flex-col items-start gap-3">
        <SkillInstallCommand />
        <p className="lp-copy text-sm text-lp-fg-muted">
          {t('Free and open source. No sign-up — everything runs on your machine.')}
        </p>
      </div>
      <div className="mt-14 scroll-mt-24 md:mt-16" id="demo">
        <div
          className="-mx-5 p-2 shadow-[inset_0_0_0_1px_oklch(100%_0_0_/_8%)] md:mx-0 md:rounded-2xl md:p-10"
          style={{
            backgroundImage: `url(${heroBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {demo}
        </div>
      </div>
    </section>
  );
}

function SkillInstallCommand() {
  const { t } = useLandingI18n();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(SKILL_COMMAND).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="flex max-w-full items-center gap-4 rounded-full bg-lp-panel py-2.5 pr-2.5 pl-6 shadow-[0_0_0_1px_oklch(100%_0_0_/_12%)]">
      <code className="flex min-w-0 gap-[1ch] font-mono text-[14px] text-lp-fg md:text-[15px]">
        <span className="select-none text-lp-fg-muted">$</span>
        <span className="min-w-0 break-all">{SKILL_COMMAND}</span>
      </code>
      <button
        className="lp-pill lp-pill-primary shrink-0 !px-5 !py-2.5 text-[13px]"
        onClick={copy}
        type="button"
      >
        {copied ? t('Copied') : t('Copy')}
      </button>
    </div>
  );
}

const surfaces = [
  { name: 'Claude Code', detail: '/review-tour' },
  { name: 'Codex', detail: '$review-tour' },
  { name: 'OpenCode', detail: '/review-tour' },
  { name: 'Terminal', detail: 'review-tour generate' },
];

export function SurfacesRow() {
  const { t } = useLandingI18n();
  return (
    <section className="lp-container pt-20 pb-6 md:pt-28">
      <p className="lp-copy text-center text-sm text-lp-fg-secondary">
        {t('Runs where your agents already work')}
      </p>
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {surfaces.map((surface) => (
          <div
            className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-lg bg-lp-panel"
            key={surface.name}
          >
            <p className="text-[15px] font-medium text-lp-fg">{surface.name}</p>
            <p className="font-mono text-xs text-lp-fg-muted">{surface.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FeaturePanel({
  heading,
  headingMuted,
  link,
  mock,
  reverse = false,
}: {
  heading: string;
  headingMuted: string;
  link?: { href: string; label: string };
  mock: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-lp-panel">
      <div
        className={`grid items-center gap-10 p-6 md:grid-cols-2 md:gap-14 md:p-14 ${
          reverse ? 'md:[&>*:first-child]:order-2' : ''
        }`}
      >
        <div>
          <h2 className="lp-heading lp-heading-feature text-[26px] leading-[1.3] md:text-[30px]">
            <span className="lp-heading-lead">{heading}</span>{' '}
            <span className="lp-heading-muted">{headingMuted}</span>
          </h2>
          {link ? (
            <a
              className="lp-link-accent mt-6 inline-flex items-center gap-1.5"
              href={link.href}
              rel="noreferrer"
              target="_blank"
            >
              {link.label}
              <ArrowRightIcon />
            </a>
          ) : null}
        </div>
        <div className="min-w-0">{mock}</div>
      </div>
    </div>
  );
}

export function InstallPanel() {
  const { t } = useLandingI18n();
  return (
    <div className="scroll-mt-24 rounded-2xl bg-lp-panel" id="install">
      <div className="grid items-center gap-10 p-6 md:grid-cols-2 md:gap-14 md:p-14">
        <div>
          <h2 className="lp-heading lp-heading-feature text-[26px] leading-[1.3] md:text-[30px]">
            <span className="lp-heading-lead">{t('Start with the skill.')}</span>{' '}
            <span className="lp-heading-muted">
              {t(
                'Add the agent skill from the GitHub source, then install the review-tour npm package for the local viewer and manual commands.',
              )}
            </span>
          </h2>
          <a
            className="lp-link-accent mt-6 inline-flex items-center gap-1.5"
            href={`${GITHUB_URL}#quick-start`}
            rel="noreferrer"
            target="_blank"
          >
            {t('Read the quick start')}
            <ArrowRightIcon />
          </a>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <CommandCard
            command={SKILL_COMMAND}
            description={t('Then ask for /review-tour in Claude Code or $review-tour in Codex.')}
            label={t('Agent skill')}
          />
          <CommandCard
            command={CLI_COMMAND}
            description={t('Provides the review-tour CLI used by the skill and manual commands.')}
            label={t('npm package')}
          />
        </div>
      </div>
    </div>
  );
}

function CommandCard({
  command,
  description,
  label,
}: {
  command: string;
  description: string;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-lp-canvas p-5 shadow-[0_0_0_1px_oklch(100%_0_0_/_8%)]">
      <p className="text-[11px] font-medium tracking-wide text-lp-fg-muted uppercase">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-lp-panel px-4 py-3">
        <code className="min-w-0 font-mono text-[13px] break-all text-lp-fg">{command}</code>
        <CopyButton text={command} />
      </div>
      <p className="lp-copy mt-3 text-[13px] leading-relaxed text-lp-fg-secondary">{description}</p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const { t } = useLandingI18n();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <button
      aria-label={copied ? t('Copied') : t('Copy command')}
      className="shrink-0 rounded-md px-2 py-1 text-xs text-lp-fg-secondary transition-colors hover:bg-lp-panel-strong hover:text-lp-fg"
      onClick={copy}
      type="button"
    >
      {copied ? t('Copied') : t('Copy')}
    </button>
  );
}

export function Statement() {
  const { t } = useLandingI18n();
  const statementCards = [
    {
      title: t('Agents ship faster than you can read'),
      body: t(
        'Parallel agents open five pull requests before lunch. The bottleneck has moved from writing code to understanding it — and understanding does not parallelize.',
      ),
    },
    {
      title: t('Free and open source'),
      body: t(
        'Apache-2.0, with no paid tier and no seat licenses. Read the code, open an issue, or send a pull request — ideally with a tour attached.',
      ),
    },
    {
      title: t('No sign-up'),
      body: t(
        'There is no account to create and no telemetry to opt out of. Install the skill or the CLI and you are reviewing a minute later — in any editor, with any agent.',
      ),
    },
  ];

  return (
    <section className="lp-container pt-24 pb-8 md:pt-32">
      <h2 className="lp-heading lp-heading-statement text-center text-[34px] leading-tight md:text-[48px]">
        {t('Code review did not scale. Now it has to.')}
      </h2>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {statementCards.map((card) => (
          <div className="rounded-xl bg-lp-panel p-7" key={card.title}>
            <h3 className="text-[16px] font-medium text-lp-fg">{card.title}</h3>
            <p className="lp-copy mt-3 text-sm leading-relaxed text-lp-fg-secondary">{card.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  const { t } = useLandingI18n();
  return (
    <section className="lp-container flex flex-col items-center pt-28 pb-32 md:pt-36">
      <h2 className="lp-heading lp-heading-cta text-center text-[40px] leading-tight md:text-[64px]">
        {t('Try Review Tour now.')}
      </h2>
      <p className="lp-copy mt-5 text-center text-[15px] text-lp-fg-secondary">
        {t('Free, open source, no sign-up — reviewing in under a minute.')}
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <SkillInstallCommand />
        <a className="lp-pill lp-pill-secondary" href={GITHUB_URL} rel="noreferrer" target="_blank">
          {t('Star on GitHub')}
          <ArrowRightIcon />
        </a>
      </div>
    </section>
  );
}

export function Footer() {
  const { t } = useLandingI18n();
  const footerColumns = [
    {
      title: t('Product'),
      links: [
        { label: t('Features'), href: '#features' },
        { label: t('Demo'), href: '#demo' },
        { label: t('Install'), href: '#install' },
      ],
    },
    {
      title: t('Resources'),
      links: [
        { label: t('Quick start'), href: `${GITHUB_URL}#quick-start` },
        { label: t('How it works'), href: `${GITHUB_URL}#how-it-works` },
        { label: t('CLI commands'), href: `${GITHUB_URL}#cli-commands` },
        { label: t('Releases'), href: `${GITHUB_URL}/releases` },
        { label: t('npm package'), href: 'https://www.npmjs.com/package/review-tour' },
      ],
    },
    {
      title: t('Project'),
      links: [
        { label: 'GitHub', href: GITHUB_URL },
        { label: t('Issues'), href: `${GITHUB_URL}/issues` },
        { label: t('Security'), href: `${GITHUB_URL}/blob/main/SECURITY.md` },
        { label: t('License'), href: `${GITHUB_URL}/blob/main/LICENSE` },
      ],
    },
  ];

  return (
    <footer className="border-t border-lp-line">
      <div className="lp-container py-14">
        <div className="grid gap-10 sm:grid-cols-3 md:max-w-2xl">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <p className="text-sm text-lp-fg-muted">{column.title}</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      className="text-sm text-lp-fg-secondary transition-colors hover:text-lp-fg"
                      href={link.href}
                      rel={link.href.startsWith('#') ? undefined : 'noreferrer'}
                      target={link.href.startsWith('#') ? undefined : '_blank'}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-lp-line pt-6">
          <p className="text-[13px] text-lp-fg-muted">
            © {new Date().getFullYear()} {t('Review Tour contributors')} · Apache-2.0
          </p>
          <p className="text-[13px] text-lp-fg-muted">
            {t('Guided code review for the agent era')}
          </p>
        </div>
      </div>
    </footer>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden fill="none" height="14" viewBox="0 0 14 14" width="14">
      <path
        d="M2.5 7h9m0 0L7.75 3.25M11.5 7l-3.75 3.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
