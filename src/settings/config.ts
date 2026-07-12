export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const ACCENTS = [
    'sky',
    'coral',
    'amber',
    'emerald',
    'violet',
    'magenta',
    'neutral',
] as const;
export type Accent = (typeof ACCENTS)[number];

export const DEFAULT_THEME: Theme = 'system';
export const DEFAULT_ACCENT: Accent = 'sky';

export const THEME_COOKIE = 'THEME';
export const ACCENT_COOKIE = 'ACCENT';

export function isTheme(value: string | undefined): value is Theme {
    return THEMES.includes(value as Theme);
}

export function isAccent(value: string | undefined): value is Accent {
    return ACCENTS.includes(value as Accent);
}
