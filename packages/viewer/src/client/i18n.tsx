import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group';
import { cn } from '#/lib/utils';

export type Locale = 'en' | 'ja';

const LOCALE_STORAGE_KEY = 'review-tour:locale';

const japaneseMessages = {
  Additions: '追加',
  'Add comment': 'コメントを追加',
  'Add comment on {path} line {line}': '{path} の {line} 行目にコメントを追加',
  Auto: '自動',
  Back: '戻る',
  'Back to list': '一覧に戻る',
  Backgrounds: '背景色',
  'Blank line': '空行',
  Cancel: 'キャンセル',
  Chapter: 'チャプター',
  'Chapter {index}': 'チャプター {index}',
  'Chapter {index} of {total}': 'チャプター {index} / {total}',
  Chapters: 'チャプター',
  'Changed files': '変更ファイル',
  'Classic (+/-)': 'クラシック（+/-）',
  Close: '閉じる',
  'Collapse file': 'ファイルを折りたたむ',
  Comment: 'コメント',
  Comments: 'コメント',
  Compact: 'コンパクト',
  'Copy as prompt': 'プロンプトとしてコピー',
  'Copy failed': 'コピーに失敗',
  'Copy review prompt': 'レビュープロンプトをコピー',
  'Copied as prompt': 'プロンプトとしてコピーしました',
  'Copied review prompt': 'レビュープロンプトをコピーしました',
  Dark: 'ダーク',
  'Delete comment': 'コメントを削除',
  'Delete review comment': 'レビューコメントを削除',
  Deletions: '削除',
  'Display settings': '表示設定',
  'Edit comment': 'コメントを編集',
  'Edit review comment': 'レビューコメントを編集',
  'Expand file': 'ファイルを展開',
  'Expand full file': 'ファイル全体を展開',
  'Failed to copy review prompt': 'レビュープロンプトをコピーできませんでした',
  File: 'ファイル',
  Files: 'ファイル',
  'Files ({count})': 'ファイル（{count}）',
  'Filter files': 'ファイルを絞り込む',
  'Filter files...': 'ファイルを絞り込む...',
  Font: 'フォント',
  'Font size': '文字サイズ',
  'Follow the system color scheme': 'システムのカラーモードに合わせる',
  'Generated tours': '生成されたツアー',
  'Go to definition': '定義へ移動',
  'High risk': '高リスク',
  Indicators: '差分記号',
  'Inline diffs': '行内差分',
  'Key changes': '主な変更',
  Language: '言語',
  Layout: 'レイアウト',
  'Leave a review comment...': 'レビューコメントを入力...',
  Ligatures: '合字',
  Light: 'ライト',
  Loading: '読み込み中',
  'Line height': '行の高さ',
  'Line numbers': '行番号',
  'Low risk': '低リスク',
  'Mark chapter as not reviewed': 'チャプターを未レビューに戻す',
  'Mark chapter as reviewed': 'チャプターをレビュー済みにする',
  'Mark current chapter as not reviewed': '現在のチャプターを未レビューに戻す',
  'Mark current chapter as reviewed': '現在のチャプターをレビュー済みにする',
  'Mark file as not viewed': 'ファイルを未確認に戻す',
  'Mark file as viewed': 'ファイルを確認済みにする',
  'Medium risk': '中リスク',
  Navigate: '移動',
  Next: '次へ',
  'Next chapter': '次のチャプター',
  'No branches with review tour artifacts found.':
    'レビューツアーが生成されたブランチはありません。',
  'No chapters in this tour.': 'このツアーにはチャプターがありません。',
  'No diff hunks for this chapter.': 'このチャプターには差分がありません。',
  'No files match.': '一致するファイルはありません。',
  'No results.': '結果がありません。',
  'No review questions.': 'レビュー観点はありません。',
  None: 'なし',
  Normal: '標準',
  Open: '開く',
  'Open in': '次のアプリで開く',
  'Open in editor': 'エディターで開く',
  'Open prompt actions': 'プロンプト操作を開く',
  Plain: 'プレーン',
  Previous: '前へ',
  'Previous chapter': '前のチャプター',
  Prologue: '概要',
  Question: '質問',
  'Question · Chapter {index}': '質問 · チャプター {index}',
  Relaxed: 'ゆったり',
  'Resize review pane': 'レビューペインの幅を変更',
  'Review comment': 'レビューコメント',
  'Review comments': 'レビューコメント',
  'Review content': 'レビュー内容',
  'Review Focus': 'レビューの焦点',
  'Review questions': 'レビュー観点',
  Save: '保存',
  Search: '検索',
  'Search chapters, files, and questions': 'チャプター、ファイル、質問を検索',
  'Search chapters, files, questions...': 'チャプター、ファイル、質問を検索...',
  'Select chapter': 'チャプターを選択',
  'Show chapter diffs': 'チャプターの差分を表示',
  'Show review comments': 'レビューコメントを表示',
  Split: '分割',
  'Start reviewing': 'レビューを開始',
  Syntax: 'シンタックス',
  'Syntax theme': 'シンタックステーマ',
  System: 'システム',
  Theme: 'テーマ',
  Unified: '統合',
  'Use dark mode': 'ダークモードを使用',
  'Use light mode': 'ライトモードを使用',
  'What it does': '変更内容',
  'Why this PR?': 'このPRの目的',
  Word: '単語',
  Wrapping: '折り返し',
  '{additions} additions, {deletions} deletions': '追加 {additions}、削除 {deletions}',
  '{additions} additions, {deletions} deletions, {reviewed} reviewed':
    '追加 {additions}、削除 {deletions}、{reviewed} レビュー済み',
  '{count} branches': '{count} ブランチ',
  '{count} branch': '{count} ブランチ',
  '{count} definitions': '{count} 件の定義',
  '{count} files': '{count} ファイル',
  '{count} total': '合計 {count}',
  '{reviewed} reviewed': '{reviewed} レビュー済み',
  'All comments added while reviewing this tour.':
    'このツアーのレビュー中に追加したすべてのコメントです。',
  'Could not copy the review prompt.': 'レビュープロンプトをコピーできませんでした。',
  'Hover a code line and drag the + button to add a comment.':
    'コード行にカーソルを合わせ、+ ボタンをドラッグしてコメントを追加できます。',
  'Latest artifact': '最新の成果物',
  'Open {location} in editor': '{location} をエディターで開く',
  'Missing repo query.': 'リポジトリのクエリがありません。',
  'Failed to load tour.': 'ツアーを読み込めませんでした。',
  'Failed to load tours.': 'ツアーを読み込めませんでした。',
  'Review prompt copied to clipboard.': 'レビュープロンプトをクリップボードにコピーしました。',
  'Review the changed files and confirm each chapter matches the diff intent.':
    '変更ファイルをレビューし、各チャプターが差分の意図に沿っていることを確認してください。',
  unknown: '不明',
} as const;

export type MessageKey = keyof typeof japaneseMessages;
type MessageValues = Record<string, number | string>;
export type Translator = (key: MessageKey, values?: MessageValues) => string;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translator;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    setLocaleState(readLocalePreference());
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    writeLocalePreference(nextLocale);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback<Translator>((key, values) => translate(locale, key, values), [locale]);
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error('useI18n must be used within LocaleProvider');
  }
  return value;
}

export function LanguageControl({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <ToggleGroup
      aria-label={t('Language')}
      className={cn('h-9 rounded-[10px] bg-raised p-0.5 shadow-control', className)}
      onValueChange={(values) => {
        const nextLocale = values[0];
        if (nextLocale === 'en' || nextLocale === 'ja') setLocale(nextLocale);
      }}
      size="sm"
      value={[locale]}
    >
      <ToggleGroupItem
        aria-label="English"
        className="min-h-0 h-8 rounded-[8px] px-2.5 text-[11px] font-semibold data-pressed:bg-control data-pressed:shadow-control"
        title="English"
        value="en"
      >
        EN
      </ToggleGroupItem>
      <ToggleGroupItem
        aria-label="日本語"
        className="min-h-0 h-8 rounded-[8px] px-2.5 text-[11px] font-semibold data-pressed:bg-control data-pressed:shadow-control"
        title="日本語"
        value="ja"
      >
        日本語
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function translate(locale: Locale, key: MessageKey, values: MessageValues = {}): string {
  const message = locale === 'ja' ? japaneseMessages[key] : key;
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}

function readLocalePreference(): Locale {
  if (typeof window === 'undefined') return 'en';

  const searchParams = new URLSearchParams(window.location.search);
  const queryLocale = searchParams.get('lang') ?? searchParams.get('locale');
  if (queryLocale === 'en' || queryLocale === 'ja') return queryLocale;

  try {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (storedLocale === 'en' || storedLocale === 'ja') return storedLocale;
  } catch {
    // Fall through to the browser language when storage is unavailable.
  }

  const browserLanguages = navigator.languages.length ? navigator.languages : [navigator.language];
  return browserLanguages.some((language) => language.toLowerCase().startsWith('ja')) ? 'ja' : 'en';
}

function writeLocalePreference(locale: Locale) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The current document still uses the selected locale when storage is unavailable.
  }
}
