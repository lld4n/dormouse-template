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

export function formatDateTime(epochMs: number, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(epochMs);
}

export function formatMoney(amount: number, currency: string, locale: string): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount);
}

/** `isoWeekday` is Monday = 0 .. Sunday = 6. `2024-01-01` is a Monday — used purely as a stable reference date to get a locale weekday name, not as a real date. */
export function formatWeekday(isoWeekday: number, locale: string): string {
    const reference = new Date(Date.UTC(2024, 0, 1 + isoWeekday));
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(reference);
}
