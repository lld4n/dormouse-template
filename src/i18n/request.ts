import type { Locale } from './config';
import { getRequestConfig } from 'next-intl/server';

import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from './config';

async function detectLocale(): Promise<Locale> {
    const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(cookieLocale)) {
        return cookieLocale;
    }
    const acceptLanguage = (await headers()).get('accept-language') ?? '';
    return acceptLanguage.toLowerCase().includes('ru') ? 'ru' : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
    const locale = await detectLocale();

    return {
        locale,
        messages: (await import(`./messages/${locale}.json`)).default,
    };
});
