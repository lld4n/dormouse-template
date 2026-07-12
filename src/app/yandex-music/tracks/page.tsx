import type { Metadata } from 'next';
import type { TrackIndexEntry } from '@/lib/data/yandex-music-track-index';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { CoverImage } from '@/components/media/CoverImage';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { getTracksIndex } from '@/lib/data/yandex-music-track-index';

import styles from './page.module.scss';
import { TracksControls } from './tracks-controls';

export const metadata: Metadata = {
    title: 'Tracks — Dormouse',
};

const PER_PAGE = 48;
const SORTS = ['listens', 'title', 'recent'] as const;
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

export default async function TracksPage({ searchParams }: PageProps<'/yandex-music/tracks'>) {
    const raw = await searchParams;
    const [t, locale, index] = await Promise.all([
        getTranslations('tracks'),
        getLocale(),
        getTracksIndex(),
    ]);

    const q = pickParam(raw.q)?.trim() ?? '';
    const sortParam = pickParam(raw.sort);
    const sort: Sort = SORTS.includes(sortParam as Sort) ? (sortParam as Sort) : 'listens';
    const needle = q.toLocaleLowerCase();
    const matches = (track: TrackIndexEntry) => !needle || track.search.includes(needle);

    const filtered = index.filter((track) => matches(track));

    const collator = new Intl.Collator(locale);
    const sorted = [...filtered].sort((a, b) => {
        switch (sort) {
            case 'title':
                return collator.compare(a.title, b.title);
            case 'recent':
                return b.firstSeen - a.firstSeen;
            default:
                return b.listens - a.listens || collator.compare(a.title, b.title);
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

            <TracksControls
                key={`${q}:${sort}`}
                initialQuery={q}
                initialSort={sort}
                placeholder={t('searchPlaceholder')}
                sortOptions={SORTS.map((option) => ({ value: option, label: t(`sort_${option}`) }))}
                classNames={{
                    container: styles.filters,
                    search: styles.search,
                    sort: styles.select,
                }}
            />

            {visible.length === 0 ? (
                <p className={styles.empty}>{t('empty')}</p>
            ) : (
                <ul className={styles.grid}>
                    {visible.map((track) => {
                        return (
                            <li key={track.id}>
                                <Link
                                    href={`/yandex-music/tracks/${track.id}`}
                                    className={styles.card}
                                >
                                    <CoverImage
                                        cover={track.cover}
                                        title={track.title}
                                        size={200}
                                        className={styles.cardCover}
                                    />
                                    <span className={styles.cardText}>
                                        <span className={styles.cardTitle}>
                                            {track.title}
                                            {track.version ? (
                                                <span className={styles.cardVersion}>
                                                    {' '}
                                                    {track.version}
                                                </span>
                                            ) : null}
                                        </span>
                                        <span className={styles.cardArtists}>
                                            {track.artists.map(({ name }) => name).join(', ')}
                                        </span>
                                        {track.albums[0] ? (
                                            <span className={styles.cardAlbum}>
                                                {track.albums[0].title}
                                            </span>
                                        ) : null}
                                    </span>
                                    {track.listens > 0 ? (
                                        <span className={styles.cardListens}>×{track.listens}</span>
                                    ) : null}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}

            {pages > 1 ? (
                <nav className={styles.pagination} aria-label={t('pagination')}>
                    {page > 1 ? (
                        <ButtonLink
                            href={`/yandex-music/tracks${buildQuery(currentParams, page - 1)}`}
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
                            href={`/yandex-music/tracks${buildQuery(currentParams, page + 1)}`}
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
