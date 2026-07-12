'use client';

import { useTranslations } from 'next-intl';

import { ErrorScreen } from '@/components/ErrorScreen';
import { Button } from '@/components/ui/Button';

interface ErrorPageProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
    const t = useTranslations('error');
    const details = [error.message, error.digest && `digest: ${error.digest}`, error.stack]
        .filter(Boolean)
        .join('\n\n');

    return (
        <ErrorScreen
            title={t('title')}
            detailsLabel={t('details')}
            details={details}
            action={<Button onClick={reset}>{t('retry')}</Button>}
        />
    );
}
