import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/Button';
import { signIn } from '@/lib/auth';

import styles from './page.module.scss';

export const metadata: Metadata = {
    title: 'Sign in — Dormouse',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
    const [{ from }, t] = await Promise.all([searchParams, getTranslations('login')]);
    const redirectTo = typeof from === 'string' && from.startsWith('/') ? from : '/';

    return (
        <main className={styles.main}>
            <h1 className={styles.title}>dormouse</h1>
            <p className={styles.hint}>{t('hint')}</p>
            <form
                action={async () => {
                    'use server';
                    await signIn('github', { redirectTo });
                }}
            >
                <Button type="submit" variant="primary">
                    {t('cta')}
                </Button>
            </form>
        </main>
    );
}
