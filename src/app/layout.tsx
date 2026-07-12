import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';

import { ErrorScreen } from '@/components/ErrorScreen';
import { isAuthConfigured, isPublicMode, missingAuthEnv } from '@/lib/config';
import { readSettings } from '@/settings/read';

import './globals.scss';

export const metadata: Metadata = {
    title: 'Dormouse',
    description: 'A personal archive of your data',
};

function ConfigurationError() {
    const details = [
        'Private mode is enabled (APP_MODE is not "public"), but auth is not configured.',
        `Missing environment variables:\n${missingAuthEnv().join('\n')}`,
        'See .env.example in the repository for how to configure access.',
    ].join('\n\n');

    return <ErrorScreen details={details} />;
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const [locale, { theme, accent }] = await Promise.all([getLocale(), readSettings()]);
    // Fail-closed: a private deployment without auth config shows an error instead of content.
    const blocked = !isPublicMode() && !isAuthConfigured();

    return (
        <html
            lang={locale}
            data-theme={theme === 'system' ? undefined : theme}
            data-accent={accent}
            className={`${GeistSans.variable} ${GeistMono.variable}`}
        >
            <body>
                <NextIntlClientProvider>
                    {blocked ? <ConfigurationError /> : children}
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
