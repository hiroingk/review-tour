export type DiffLayout = 'split' | 'unified';
export type DiffSyntaxTheme = 'auto' | 'github-dark' | 'github-light' | 'plain';

export type DiffDisplaySettings = {
  backgrounds: boolean;
  fontFamily: 'geist-mono' | 'system-mono';
  fontSize: 12 | 13 | 14;
  indicators: 'classic' | 'none';
  inlineDiffs: 'word' | 'none';
  ligatures: boolean;
  lineHeight: 'compact' | 'normal' | 'relaxed';
  lineNumbers: boolean;
  layout: DiffLayout;
  syntaxTheme: DiffSyntaxTheme;
  wrapping: boolean;
};

export const defaultDiffDisplaySettings: DiffDisplaySettings = {
  backgrounds: true,
  fontFamily: 'geist-mono',
  fontSize: 12,
  indicators: 'classic',
  inlineDiffs: 'word',
  ligatures: false,
  lineHeight: 'normal',
  lineNumbers: true,
  layout: 'split',
  syntaxTheme: 'auto',
  wrapping: false,
};

export const DIFF_DISPLAY_SETTINGS_STORAGE_KEY = 'review-tour:diff-display-settings';
const DIFF_DISPLAY_SETTINGS_STORAGE_VERSION = 2;

export function readDiffDisplaySettings() {
  if (typeof window === 'undefined') return defaultDiffDisplaySettings;

  try {
    const stored = window.localStorage.getItem(DIFF_DISPLAY_SETTINGS_STORAGE_KEY);
    if (!stored) return defaultDiffDisplaySettings;

    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed)) return defaultDiffDisplaySettings;

    return normalizeDiffDisplaySettings(parsed);
  } catch {
    return defaultDiffDisplaySettings;
  }
}

export function writeDiffDisplaySettings(settings: DiffDisplaySettings) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      DIFF_DISPLAY_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...settings,
        settingsVersion: DIFF_DISPLAY_SETTINGS_STORAGE_VERSION,
      }),
    );
  } catch {
    // Ignore storage failures; the current page still uses the selected settings.
  }
}

function normalizeDiffDisplaySettings(value: Record<string, unknown>): DiffDisplaySettings {
  return {
    backgrounds: typeof value.backgrounds === 'boolean' ? value.backgrounds : true,
    fontFamily:
      value.fontFamily === 'system-mono' || value.fontFamily === 'geist-mono'
        ? value.fontFamily
        : 'geist-mono',
    fontSize:
      value.fontSize === 13 || value.fontSize === 14 || value.fontSize === 12 ? value.fontSize : 12,
    indicators:
      value.indicators === 'none' || value.indicators === 'classic' ? value.indicators : 'classic',
    inlineDiffs:
      value.inlineDiffs === 'none' || value.inlineDiffs === 'word' ? value.inlineDiffs : 'word',
    ligatures: typeof value.ligatures === 'boolean' ? value.ligatures : false,
    lineHeight:
      value.lineHeight === 'compact' ||
      value.lineHeight === 'relaxed' ||
      value.lineHeight === 'normal'
        ? value.lineHeight
        : 'normal',
    lineNumbers: typeof value.lineNumbers === 'boolean' ? value.lineNumbers : true,
    layout: value.layout === 'unified' || value.layout === 'split' ? value.layout : 'split',
    syntaxTheme: normalizeSyntaxTheme(value.syntaxTheme, value.settingsVersion),
    wrapping: typeof value.wrapping === 'boolean' ? value.wrapping : false,
  };
}

function normalizeSyntaxTheme(
  value: unknown,
  settingsVersion: unknown,
): DiffDisplaySettings['syntaxTheme'] {
  if (value === 'auto' || value === 'github-light' || value === 'plain') {
    return value;
  }

  if (value === 'github-dark') {
    return settingsVersion === DIFF_DISPLAY_SETTINGS_STORAGE_VERSION ? 'github-dark' : 'auto';
  }

  return 'auto';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
