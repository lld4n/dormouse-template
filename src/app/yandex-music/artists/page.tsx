import type { Metadata } from 'next';
import type { ArtistIndexEntry } from '@/lib/data/yandex-music-artist-index';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SearchSortControls } from '@/components/controls/SearchSortControls';
import { CoverImage } from '@/components/media/CoverImage';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { getArtistsIndex } from '@/lib/data/yandex-music-artist-index';

import styles from './page.module.scss';

export const metadata: Metadata = {
    title: 'Artists — Dormouse',
};

const PER_PAGE = 48;
const SORTS = ['listens', 'name', 'recent'] as const;
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

export default async function ArtistsPage({ searchParams }: PageProps<'/yandex-music/artists'>) {
    const raw = await searchParams;
    const [t, locale, index] = await Promise.all([
        getTranslations('artists'),
        getLocale(),
        getArtistsIndex(),
    ]);

    const q = pickParam(raw.q)?.trim() ?? '';
    const sortParam = pickParam(raw.sort);
    const sort: Sort = SORTS.includes(sortParam as Sort) ? (sortParam as Sort) : 'listens';
    const needle = q.toLocaleLowerCase();
    const matches = (artist: ArtistIndexEntry) => !needle || artist.search.includes(needle);

    const filtered = index.filter((artist) => matches(artist));

    const collator = new Intl.Collator(locale);
    const sorted = [...filtered].sort((a, b) => {
        switch (sort) {
            case 'name':
                return collator.compare(a.name, b.name);
            case 'recent':
                return b.firstSeen - a.firstSeen;
            default:
                return b.listens - a.listens || collator.compare(a.name, b.name);
        }
    });

    const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
    const page = Math.min(Math.max(1, Number(pickParam(raw.page)) || 1), pages);
    const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const currentParams = {
        q: q || undefined,
        sort: sort === 'listens' ? undefined : sort,
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
                        defaultValue: 'listens',
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
                <ul className={styles.grid}>
                    {visible.map((artist) => (
                        <li key={artist.id}>
                            <Link
                                href={`/yandex-music/artists/${artist.id}`}
                                className={styles.card}
                            >
                                <CoverImage
                                    cover={artist.cover}
                                    title={artist.name}
                                    size={200}
                                    className={styles.cardCover}
                                />
                                <span className={styles.cardText}>
                                    <span className={styles.cardTitle}>{artist.name}</span>
                                    <span className={styles.cardMeta}>
                                        {t('trackCount', { count: artist.trackCount })}
                                        {artist.albumCount > 0
                                            ? ` · ${t('albumCount', { count: artist.albumCount })}`
                                            : ''}
                                    </span>
                                </span>
                                {artist.listens > 0 ? (
                                    <span className={styles.cardListens}>×{artist.listens}</span>
                                ) : null}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            {pages > 1 ? (
                <nav className={styles.pagination} aria-label={t('pagination')}>
                    {page > 1 ? (
                        <ButtonLink
                            href={`/yandex-music/artists${buildQuery(currentParams, page - 1)}`}
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
                            href={`/yandex-music/artists${buildQuery(currentParams, page + 1)}`}
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
