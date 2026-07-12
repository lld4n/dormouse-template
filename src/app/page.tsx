import { getTranslations } from 'next-intl/server';

import { ButtonLink } from '@/components/ui/ButtonLink';

import pkg from '../../package.json';
import styles from './page.module.scss';

export default async function Home() {
    const t = await getTranslations();

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <ButtonLink href="/settings" size="sm">
                    {t('settings.title')}
                </ButtonLink>
            </header>
            <section className={styles.hero}>
                <h1 className={styles.logo}>dormouse</h1>
                <p className={styles.tagline}>{t('home.tagline')}</p>
                <p className={styles.meta}>{t('home.version', { version: pkg.version })}</p>
            </section>
        </main>
    );
}
