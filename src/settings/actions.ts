'use server';

import { cookies } from 'next/headers';

import { ACCENT_COOKIE, isAccent, isTheme, THEME_COOKIE } from './config';

const COOKIE_OPTIONS = {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
} as const;

export async function setTheme(theme: string): Promise<void> {
    if (!isTheme(theme)) {
        return;
    }
    (await cookies()).set(THEME_COOKIE, theme, COOKIE_OPTIONS);
}

export async function setAccent(accent: string): Promise<void> {
    if (!isAccent(accent)) {
        return;
    }
    (await cookies()).set(ACCENT_COOKIE, accent, COOKIE_OPTIONS);
}
