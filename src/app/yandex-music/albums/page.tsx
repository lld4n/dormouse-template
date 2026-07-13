import type { Metadata } from 'next';
import type { AlbumIndexEntry } from '@/lib/data/yandex-music-album-index';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SearchSortControls } from '@/components/controls/SearchSortControls';
import { CoverImage } from '@/components/media/CoverImage';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { AlbumType } from '@/lib/data/yandex-music';
import { getAlbumsIndex } from '@/lib/data/yandex-music-album-index';

import styles from './page.module.scss';

export const metadata: Metadata = {
    title: 'Albums — Dormouse',
};

const PER_PAGE = 48;
const SORTS = ['listens', 'title', 'recent', 'release'] as const;
const TYPES = ['all', 'album', 'single', 'compilation'] as const;
type Sort = (typeof SORTS)[number];
type TypeFilter = (typeof TYPES)[number];

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

function matchesType(entry: AlbumIndexEntry, type: TypeFilter): boolean {
    switch (type) {
        case 'single':
            return entry.type === AlbumType.Single;
        case 'compilation':
            return entry.type === AlbumType.Compilation;
        case 'album':
            return entry.type === undefined;
        default:
            return true;
    }
}

export default async function AlbumsPage({ searchParams }: PageProps<'/yandex-music/albums'>) {
    const raw = await searchParams;
    const [t, locale, index] = await Promise.all([
        getTranslations('albums'),
        getLocale(),
        getAlbumsIndex(),
    ]);

    const q = pickParam(raw.q)?.trim() ?? '';
    const sortParam = pickParam(raw.sort);
    const sort: Sort = SORTS.includes(sortParam as Sort) ? (sortParam as Sort) : 'listens';
    const typeParam = pickParam(raw.type);
    const type: TypeFilter = TYPES.includes(typeParam as TypeFilter)
        ? (typeParam as TypeFilter)
        : 'all';
    const needle = q.toLocaleLowerCase();
    const matches = (album: AlbumIndexEntry) => !needle || album.search.includes(needle);

    const filtered = index.filter((album) => matches(album) && matchesType(album, type));

    const collator = new Intl.Collator(locale);
    const sorted = [...filtered].sort((a, b) => {
        switch (sort) {
            case 'title':
                return collator.compare(a.title, b.title);
            case 'recent':
                return b.firstSeen - a.firstSeen;
            case 'release':
                return b.releaseDate - a.releaseDate;
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
        type: type === 'all' ? undefined : type,
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
                key={`${q}:${sort}:${type}`}
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
                    {
                        key: 'type',
                        initialValue: type,
                        defaultValue: 'all',
                        options: TYPES.map((option) => ({
                            value: option,
                            label: t(`type_${option}`),
                        })),
                        className: styles.select,
                    },
                ]}
            />

            {visible.length === 0 ? (
                <p className={styles.empty}>{t('empty')}</p>
            ) : (
                <ul className={styles.grid}>
                    {visible.map((album) => {
                        const year = new Date(album.releaseDate).getFullYear();
                        return (
                            <li key={album.id}>
                                <Link
                                    href={`/yandex-music/albums/${album.id}`}
                                    className={styles.card}
                                >
                                    <CoverImage
                                        cover={album.cover}
                                        title={album.title}
                                        size={200}
                                        className={styles.cardCover}
                                    />
                                    <span className={styles.cardText}>
                                        <span className={styles.cardTitle}>
                                            {album.title}
                                            {album.version ? (
                                                <span className={styles.cardVersion}>
                                                    {' '}
                                                    {album.version}
                                                </span>
                                            ) : null}
                                        </span>
                                        <span className={styles.cardArtists}>
                                            {album.artists.map(({ name }) => name).join(', ')}
                                        </span>
                                        <span className={styles.cardMeta}>
                                            {year || t('type_album')} ·{' '}
                                            {t('trackCount', { count: album.trackCount })}
                                        </span>
                                    </span>
                                    {album.listens > 0 ? (
                                        <span className={styles.cardListens}>×{album.listens}</span>
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
                            href={`/yandex-music/albums${buildQuery(currentParams, page - 1)}`}
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
                            href={`/yandex-music/albums${buildQuery(currentParams, page + 1)}`}
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
