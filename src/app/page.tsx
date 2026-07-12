import { getTranslations } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/LocaleSwitcher';

import pkg from '../../package.json';
import styles from './page.module.scss';

export default async function Home() {
    const t = await getTranslations('home');

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <LocaleSwitcher />
            </header>
            <section className={styles.hero}>
                <h1 className={styles.logo}>dormouse</h1>
                <p className={styles.tagline}>{t('tagline')}</p>
                <p className={styles.meta}>{t('version', { version: pkg.version })}</p>
            </section>
        </main>
    );
}
