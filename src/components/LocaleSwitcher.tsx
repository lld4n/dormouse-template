import { getLocale, getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/Button';
import { setLocale } from '@/i18n/actions';
import { LOCALES } from '@/i18n/config';

import styles from './LocaleSwitcher.module.scss';

export async function LocaleSwitcher() {
    const [locale, t] = await Promise.all([getLocale(), getTranslations('localeSwitcher')]);

    return (
        <form className={styles.switcher} aria-label={t('label')}>
            {LOCALES.map((candidate) => (
                <Button
                    key={candidate}
                    size="sm"
                    type="submit"
                    formAction={setLocale.bind(null, candidate)}
                    disabled={candidate === locale}
                >
                    {candidate}
                </Button>
            ))}
        </form>
    );
}
