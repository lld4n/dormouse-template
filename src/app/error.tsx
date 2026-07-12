'use client';

import { ErrorScreen } from '@/components/ErrorScreen';
import { Button } from '@/components/ui/Button';

interface ErrorPageProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
    const details = [error.message, error.digest && `digest: ${error.digest}`, error.stack]
        .filter(Boolean)
        .join('\n\n');

    return <ErrorScreen details={details} action={<Button onClick={reset}>try again</Button>} />;
}
