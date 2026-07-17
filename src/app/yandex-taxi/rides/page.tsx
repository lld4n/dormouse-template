import type { Metadata } from 'next';
import type { RideIndexEntry } from '@/lib/data/yandex-taxi-ride-index';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SearchSortControls } from '@/components/controls/SearchSortControls';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { getRidesIndex } from '@/lib/data/yandex-taxi-ride-index';
import { formatDate, formatMoney } from '@/lib/format';

import styles from './page.module.scss';

export const metadata: Metadata = {
    title: 'Rides — Dormouse',
};

const PER_PAGE = 48;
const SORTS = ['recent', 'oldest', 'cost_desc', 'cost_asc'] as const;
type Sort = (typeof SORTS)[number];

function pickParam(value: string | string[] | undefined): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function buildQuery(params: Record<string, string | undefined>, page: number): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value) {
            query.set(key, value);
        }
    }
    if (page > 1) {
        query.set('page', String(page));
    }
    const search = query.toString();
    return search ? `?${search}` : '';
}

export default async function RidesPage({ searchParams }: PageProps<'/yandex-taxi/rides'>) {
    const raw = await searchParams;
    const [t, taxiT, locale, index] = await Promise.all([
        getTranslations('rides'),
        getTranslations('taxi'),
        getLocale(),
        getRidesIndex(),
    ]);

    const q = pickParam(raw.q)?.trim() ?? '';
    const sortParam = pickParam(raw.sort);
    const sort: Sort = SORTS.includes(sortParam as Sort) ? (sortParam as Sort) : 'recent';
    const needle = q.toLocaleLowerCase();
    const matches = (ride: RideIndexEntry) => !needle || ride.search.includes(needle);

    const filtered = index.filter((ride) => matches(ride));

    const sorted = [...filtered].sort((a, b) => {
        switch (sort) {
            case 'oldest':
                return a.created - b.created;
            case 'cost_desc':
                return b.cost - a.cost;
            case 'cost_asc':
                return a.cost - b.cost;
            default:
                return b.created - a.created;
        }
    });

    const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
    const page = Math.min(Math.max(1, Number(pickParam(raw.page)) || 1), pages);
    const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const currentParams = {
        q: q || undefined,
        sort: sort === 'recent' ? undefined : sort,
    };

    return (
        <main className={styles.main}>
            <header className={styles.topBar}>
                <ButtonLink href="/" size="sm">
                    dormouse
                </ButtonLink>
                <ButtonLink href="/settings" size="sm">
                    {t('settingsLink')}
                </ButtonLink>
            </header>

            <div className={styles.heading}>
                <h1 className={styles.title}>{t('title')}</h1>
                <p className={styles.count}>{t('found', { count: sorted.length })}</p>
            </div>

            <SearchSortControls
                key={`${q}:${sort}`}
                initialQuery={q}
                placeholder={t('searchPlaceholder')}
                containerClassName={styles.filters}
                searchClassName={styles.search}
                selects={[
                    {
                        key: 'sort',
                        initialValue: sort,
                        defaultValue: 'recent',
                        options: SORTS.map((option) => ({
                            value: option,
                            label: t(`sort_${option}`),
                        })),
                        className: styles.select,
                    },
                ]}
            />

            {visible.length === 0 ? (
                <p className={styles.empty}>{t('empty')}</p>
            ) : (
                <ul className={styles.list}>
                    {visible.map((ride) => (
                        <li key={ride.id}>
                            <Link href={`/yandex-taxi/rides/${ride.id}`} className={styles.row}>
                                <span className={styles.rowDate}>
                                    {formatDate(ride.created, locale)}
                                </span>
                                <span className={styles.rowRoute}>
                                    <span className={styles.rowSource}>{ride.source}</span>
                                    <span className={styles.rowArrow}>→</span>
                                    <span className={styles.rowDestination}>
                                        {ride.destination}
                                    </span>
                                </span>
                                <span className={styles.rowTariff}>
                                    {taxiT(`tariff_${ride.tariff}`)}
                                </span>
                                {ride.status === 'cancelled' ? (
                                    <span className={styles.rowCancelled}>
                                        {taxiT('status_cancelled')}
                                    </span>
                                ) : (
                                    <span className={styles.rowCost}>
                                        {formatMoney(ride.cost, ride.currency, locale)}
                                    </span>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            {pages > 1 ? (
                <nav className={styles.pagination} aria-label={t('pagination')}>
                    {page > 1 ? (
                        <ButtonLink
                            href={`/yandex-taxi/rides${buildQuery(currentParams, page - 1)}`}
                            size="sm"
                        >
                            ← {t('prev')}
                        </ButtonLink>
                    ) : (
                        <span />
                    )}
                    <span className={styles.pageInfo}>{t('page', { page, pages })}</span>
                    {page < pages ? (
                        <ButtonLink
                            href={`/yandex-taxi/rides${buildQuery(currentParams, page + 1)}`}
                            size="sm"
                        >
                            {t('next')} →
                        </ButtonLink>
                    ) : (
                        <span />
                    )}
                </nav>
            ) : null}
        </main>
    );
}
