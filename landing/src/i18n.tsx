import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { LocaleProvider, useI18n, type Locale } from '#/client/i18n';

const japaneseMessages = {
  'Add the agent skill from the GitHub source, then install the review-tour npm package for the local viewer and manual commands.':
    'エージェントスキルと、ローカルビューアーを含むnpmパッケージをインストールします。',
  'Agent skill': 'エージェントスキル',
  'Agents ship faster than you can read': 'レビューが開発のボトルネックに',
  'Apache-2.0, with no paid tier and no seat licenses. Read the code, open an issue, or send a pull request — ideally with a tour attached.':
    'Apache-2.0ライセンスで公開しています。料金プランやユーザー数による制限はありません。Issueやプルリクエストも歓迎します。',
  'CLI commands': 'CLIコマンド',
  'Code review did not scale. Now it has to.':
    'コードが次々と生まれる今、レビューをもっとわかりやすく。',
  Copied: 'コピー済み',
  Copy: 'コピー',
  'Copy command': 'コマンドをコピー',
  Demo: 'デモ',
  'Each chapter carries a risk level and concrete review questions, so high-stakes changes get your best attention first.':
    '各チャプターにリスクレベルと確認ポイントを表示します。影響の大きい変更から優先してレビューできます。',
  'Every pull request becomes a guided tour.': '変更内容を、レビューしやすい順番で確認できます。',
  'Explore the viewer': 'ビューアーを見る',
  Features: '機能',
  'Free and open source': '無料で使えるオープンソース',
  'Free and open source. No sign-up — everything runs on your machine.':
    '無料で使えるオープンソース。登録不要で、処理はすべてローカルで完結します。',
  'Free, open source, no sign-up — reviewing in under a minute.':
    '無料・オープンソース・登録不要。1分ほどで使い始められます。',
  'Guided code review for the agent era': 'AIエージェント時代のガイド付きコードレビュー',
  'How it works': '仕組み',
  Install: 'インストール',
  Issues: 'Issues',
  Language: '言語',
  'Learn how it works': '仕組みを見る',
  License: 'ライセンス',
  'No sign-up': 'アカウント登録は不要',
  'npm package': 'npmパッケージ',
  'Parallel agents open five pull requests before lunch. The bottleneck has moved from writing code to understanding it — and understanding does not parallelize.':
    '複数のエージェントが同時に変更を作ると、実装よりも内容の把握に時間がかかるようになります。',
  Product: '製品',
  Project: 'プロジェクト',
  'Provides the review-tour CLI used by the skill and manual commands.':
    'ローカルビューアーと手動操作用のreview-tour CLIが含まれます。',
  'Quick start': 'クイックスタート',
  'Read the quick start': 'クイックスタートを見る',
  Releases: 'リリース',
  Resources: 'リソース',
  'Review Tour desktop demo preview': 'Review Tour デスクトップデモのプレビュー',
  'Review Tour contributors': 'Review Tourコントリビューター',
  'Review Tour turns pull requests into stories you can actually review.':
    'プルリクエストの変更内容を、流れに沿ってレビューできます。',
  'Runs where your agents already work': 'いつもの開発環境から、そのまま使えます',
  Security: 'セキュリティ',
  'See what you get': '機能を見る',
  'Star on GitHub': 'GitHub',
  'Start where the risk is.': '重要な変更から確認できます。',
  'Start with the skill.': 'スキルを追加して始めましょう。',
  'Jump from a symbol to its definition.': 'シンボルの定義へ、すぐに移動できます。',
  'Click a symbol in the diff to follow it across files and chapters without losing your review context.':
    '差分内の関数名や型名をクリックすると、別ファイルや別チャプターにある定義を開けます。',
  Reference: '参照元',
  Definition: '定義',
  'Click the highlighted symbol': 'ハイライト部分をクリック',
  'Definition found': '定義を表示しました',
  'Go to definition': '定義へ移動',
  'There is no account to create and no telemetry to opt out of. Install the skill or the CLI and you are reviewing a minute later — in any editor, with any agent.':
    'アカウント登録は不要です。スキルまたはCLIをインストールすれば、普段のエディターやエージェントからすぐにレビューを始められます。利用状況を外部へ送信するテレメトリーもありません。',
  'Then ask for /review-tour in Claude Code or $review-tour in Codex.':
    '追加後、Claude Codeでは /review-tour、Codexでは $review-tour を実行します。',
  'Try Review Tour now.': 'Review Tourでレビューを始める',
  'Chapters order the diff by meaning instead of file path, so you review the change the way the author thought it.':
    '差分をファイル順ではなく変更の意図ごとにまとめるため、実装の流れを自然に追えます。',
  'Reviewing the diff against main — 5 files (+75 −2)':
    'mainとの差分を確認中 — 5ファイル（+75 −2）',
  'Writing chapters': 'レビュー手順を作成中',
  '1. Verify webhook signatures        high': '1. Webhook署名の検証             高リスク',
  '2. Idempotent event processing      medium': '2. イベントの重複処理を防止      中リスク',
  '3. Tests and configuration          low': '3. テストと環境設定              低リスク',
  'Opening the viewer': 'ビューアーを起動中',
  'Tour ready → http://localhost:4378': 'レビューの準備完了 → http://localhost:4378',
  'Review tour': 'レビューツアー',
  '{count} files': '{count}ファイル',
  '{count} questions': '{count}件の確認項目',
  'Chapter 1 of {count}': 'チャプター 1 / {count}',
  'Review questions': '確認ポイント',
} as const;

type LandingMessageKey = keyof typeof japaneseMessages;
type LandingMessageValues = Record<string, number | string>;

export function LandingLocaleProvider({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <LandingLocaleMetadata />
      {children}
    </LocaleProvider>
  );
}

export function useLandingI18n() {
  const { locale, setLocale } = useI18n();
  const t = useCallback(
    (key: LandingMessageKey, values: LandingMessageValues = {}) => {
      const message = locale === 'ja' ? japaneseMessages[key] : key;
      return message.replace(/\{(\w+)\}/g, (match, name: string) =>
        Object.hasOwn(values, name) ? String(values[name]) : match,
      );
    },
    [locale],
  );

  return {
    locale,
    setLocale,
    t,
  };
}

export function LandingLanguageControl() {
  const { locale, setLocale, t } = useLandingI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mobileOptionsId = useId();

  useEffect(() => {
    if (!mobileOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (controlRef.current?.contains(event.target as Node)) return;
      setMobileOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMobileOpen(false);
      triggerRef.current?.focus();
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    const desktopMedia = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };

    desktopMedia.addEventListener('change', closeOnDesktop);
    return () => desktopMedia.removeEventListener('change', closeOnDesktop);
  }, []);

  const selectMobileLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    setMobileOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="relative shrink-0" ref={controlRef}>
      <div
        aria-label={t('Language')}
        className="hidden h-9 items-center rounded-full border border-lp-line bg-lp-panel p-0.5 md:flex"
        role="group"
      >
        <LanguageButton active={locale === 'en'} label="EN" locale="en" onSelect={setLocale} />
        <LanguageButton active={locale === 'ja'} label="日本語" locale="ja" onSelect={setLocale} />
      </div>

      <button
        aria-controls={mobileOptionsId}
        aria-expanded={mobileOpen}
        aria-label={t('Language')}
        className={`flex size-10 items-center justify-center rounded-full text-lp-fg-secondary transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96] md:hidden ${
          mobileOpen ? 'bg-lp-panel-strong text-lp-fg' : 'bg-lp-panel hover:text-lp-fg'
        }`}
        onClick={() => setMobileOpen((open) => !open)}
        ref={triggerRef}
        type="button"
      >
        <LanguageIcon />
      </button>

      <div
        aria-hidden={!mobileOpen}
        aria-label={t('Language')}
        className={`absolute top-full right-0 z-50 mt-2 w-36 origin-top-right rounded-xl bg-lp-panel-strong p-1 shadow-[0_0_0_1px_oklch(100%_0_0_/_8%),0_12px_32px_oklch(0%_0_0_/_35%)] transition-[opacity,translate,scale] duration-150 ease-out md:hidden ${
          mobileOpen
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0'
        }`}
        id={mobileOptionsId}
        role="group"
      >
        <MobileLanguageButton
          active={locale === 'en'}
          label="English"
          locale="en"
          menuOpen={mobileOpen}
          onSelect={selectMobileLocale}
        />
        <MobileLanguageButton
          active={locale === 'ja'}
          label="日本語"
          locale="ja"
          menuOpen={mobileOpen}
          onSelect={selectMobileLocale}
        />
      </div>
    </div>
  );
}

function LanguageIcon() {
  return (
    <svg aria-hidden fill="none" height="20" viewBox="0 0 20 20" width="20">
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2.9 10h14.2M10 2.75c1.8 1.95 2.75 4.36 2.75 7.25S11.8 15.3 10 17.25C8.2 15.3 7.25 12.89 7.25 10S8.2 4.7 10 2.75Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function LanguageButton({
  active,
  label,
  locale,
  onSelect,
}: {
  active: boolean;
  label: string;
  locale: Locale;
  onSelect: (locale: Locale) => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`h-7 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold transition-colors ${
        active ? 'bg-lp-panel-strong text-lp-fg' : 'text-lp-fg-muted hover:text-lp-fg'
      }`}
      onClick={() => onSelect(locale)}
      type="button"
    >
      {label}
    </button>
  );
}

function MobileLanguageButton({
  active,
  label,
  locale,
  menuOpen,
  onSelect,
}: {
  active: boolean;
  label: string;
  locale: Locale;
  menuOpen: boolean;
  onSelect: (locale: Locale) => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-xs font-semibold transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96] ${
        active
          ? 'bg-lp-panel text-lp-fg'
          : 'text-lp-fg-secondary hover:bg-lp-panel hover:text-lp-fg'
      }`}
      onClick={() => onSelect(locale)}
      tabIndex={menuOpen ? 0 : -1}
      type="button"
    >
      <span>{label}</span>
      <span aria-hidden className="text-[10px] text-lp-fg-muted">
        {locale.toUpperCase()}
      </span>
    </button>
  );
}

function LandingLocaleMetadata() {
  const { locale } = useI18n();

  useEffect(() => {
    const title =
      locale === 'ja'
        ? 'Review Tour — AIエージェント時代のコードレビュー'
        : 'Review Tour — Guided code review for the agent era';
    const description =
      locale === 'ja'
        ? 'Review Tourは、プルリクエストの差分を意味のあるチャプターに整理し、変更の流れに沿ったコードレビューを支援します。'
        : 'Review Tour turns pull requests into guided, chapter-by-chapter review tours. Built for reviewing code written by AI agents.';

    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  }, [locale]);

  return null;
}
