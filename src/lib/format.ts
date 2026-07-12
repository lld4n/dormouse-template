export function formatDuration(ms: number): string {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatDate(epochMs: number, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(epochMs);
}

/** `month` is a `YYYY-MM` history key. */
export function formatMonth(month: string, locale: string): string {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Intl.DateTimeFormat(locale, { month: 'short' }).format(
        new Date(year!, monthNumber! - 1, 1),
    );
}
