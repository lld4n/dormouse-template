import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { setAccent, setTheme } from '@/settings/actions';
import { ACCENTS, THEMES } from '@/settings/config';
import { readSettings } from '@/settings/read';

import styles from './page.module.scss';

export const metadata: Metadata = {
    title: 'Settings — Dormouse',
};

export default async function SettingsPage() {
    const [t, { theme, accent }] = await Promise.all([getTranslations('settings'), readSettings()]);

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <div className={styles.headerRow}>
                    <h1 className={styles.title}>{t('title')}</h1>
                    <ButtonLink href="/" size="sm">
                        {t('back')}
                    </ButtonLink>
                </div>
                <p className={styles.tagline}>{t('tagline')}</p>
            </header>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('appearance')}</h2>
                <div className={styles.card}>
                    <div className={styles.field}>
                        <span className={styles.label}>{t('theme')}</span>
                        <form className={styles.row}>
                            {THEMES.map((candidate) => (
                                <Button
                                    key={candidate}
                                    size="sm"
                                    type="submit"
                                    formAction={setTheme.bind(null, candidate)}
                                    aria-pressed={candidate === theme}
                                >
                                    {t(`theme_${candidate}`)}
                                </Button>
                            ))}
                        </form>
                    </div>

                    <div className={styles.field}>
                        <span className={styles.label}>{t('accent')}</span>
                        <form className={styles.row}>
                            {ACCENTS.map((candidate) => (
                                <button
                                    key={candidate}
                                    type="submit"
                                    formAction={setAccent.bind(null, candidate)}
                                    className={styles.swatch}
                                    style={{ background: `var(--swatch-${candidate})` }}
                                    aria-label={candidate}
                                    aria-pressed={candidate === accent}
                                />
                            ))}
                        </form>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('language')}</h2>
                <div className={styles.card}>
                    <LocaleSwitcher />
                </div>
            </section>
        </main>
    );
}
