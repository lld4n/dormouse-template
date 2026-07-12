import type { Accent, Theme } from './config';

import { cookies } from 'next/headers';
import {
    ACCENT_COOKIE,
    DEFAULT_ACCENT,
    DEFAULT_THEME,
    isAccent,
    isTheme,
    THEME_COOKIE,
} from './config';

export async function readSettings(): Promise<{ theme: Theme; accent: Accent }> {
    const store = await cookies();
    const theme = store.get(THEME_COOKIE)?.value;
    const accent = store.get(ACCENT_COOKIE)?.value;

    return {
        theme: isTheme(theme) ? theme : DEFAULT_THEME,
        accent: isAccent(accent) ? accent : DEFAULT_ACCENT,
    };
}
