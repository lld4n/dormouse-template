import type { Metadata } from 'next';
import type { AlbumSnapshot } from '@/lib/data/yandex-music';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { notFound } from 'next/navigation';
import { CoverLightbox } from '@/components/media/CoverLightbox';
import { ButtonLink } from '@/components/ui/ButtonLink';
import {
    AlbumType,
    getAlbum,
    getAlbumListenStats,
    getArtist,
    latest,
} from '@/lib/data/yandex-music';
import { getTracksIndex } from '@/lib/data/yandex-music-track-index';
import { formatDate, formatMonth } from '@/lib/format';

import styles from './page.module.scss';

export async function generateMetadata({
    params,
}: PageProps<'/yandex-music/albums/[id]'>): Promise<Metadata> {
    const { id } = await params;
    const album = latest(await getAlbum(id));
    return { title: album ? `${album.title} — Dormouse` : 'Dormouse' };
}

const DIFF_FIELDS = [
    'title',
    'version',
    'type',
    'releaseDate',
    'genre',
    'artists',
    'labels',
    'trackCount',
    'explicit',
    'cover',
] as const satisfies readonly (keyof AlbumSnapshot)[];

function diffValue(field: (typeof DIFF_FIELDS)[number], snapshot: AlbumSnapshot): string {
    const value = snapshot[field];
    if (field === 'cover') {
        return '…';
    }
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    return String(value ?? '—');
}

export default async function AlbumPage({ params }: PageProps<'/yandex-music/albums/[id]'>) {
    const { id } = await params;
    const record = await getAlbum(id);
    const album = latest(record);
    if (!record || !album) {
        notFound();
    }

    const [t, locale, tracksIndex] = await Promise.all([
        getTranslations('album'),
        getLocale(),
        getTracksIndex(),
    ]);
    const artists = await Promise.all(
        album.artists.map(
            async (artistId) => [artistId, latest(await getArtist(artistId))] as const,
        ),
    );

    const albumTracks = tracksIndex.filter((track) => track.albums.some((a) => a.id === id));
    const collator = new Intl.Collator(locale);
    const sortedTracks = [...albumTracks].sort((a, b) => collator.compare(a.title, b.title));
    const stats = await getAlbumListenStats(albumTracks.map((track) => track.id));

    const yandexUrl = `https://music.yandex.ru/album/${id}`;
    const maxMonthCount = Math.max(1, ...stats.byMonth.map(({ count }) => count));

    const metadataChanges = record.snapshots
        .slice(1)
        .map((snapshot, index) => {
            const previous = record.snapshots[index]!;
            const changes = DIFF_FIELDS.filter(
                (field) => JSON.stringify(previous[field]) !== JSON.stringify(snapshot[field]),
            ).map(
                (field) =>
                    `${field}: ${diffValue(field, previous)} → ${diffValue(field, snapshot)}`,
            );
            return { date: snapshot.snapshotDate, changes };
        })
        .filter(({ changes }) => changes.length > 0);

    return (
        <main className={styles.main}>
            <header className={styles.topBar}>
                <div className={styles.topBarGroup}>
                    <ButtonLink href="/" size="sm">
                        dormouse
                    </ButtonLink>
                    <ButtonLink href="/yandex-music/albums" size="sm">
                        {t('allAlbums')}
                    </ButtonLink>
                </div>
                <ButtonLink href="/settings" size="sm">
                    {t('settingsLink')}
                </ButtonLink>
            </header>

            <section className={styles.hero}>
                <CoverLightbox
                    cover={album.cover}
                    title={album.title}
                    thumbSize={280}
                    thumbClassName={styles.cover}
                />
                <div className={styles.info}>
                    <h1 className={styles.title}>
                        {album.title}
                        {album.version ? (
                            <span className={styles.version}> {album.version}</span>
                        ) : null}
                    </h1>
                    <p className={styles.artists}>
                        {artists.map(([artistId, artist], index) => (
                            <span key={artistId}>
                                {index > 0 ? ', ' : ''}
                                <Link
                                    href={`/yandex-music/artists/${artistId}`}
                                    className={styles.entityLink}
                                >
                                    {artist?.name ?? `#${artistId}`}
                                </Link>
                            </span>
                        ))}
                    </p>
                    <p className={styles.meta}>
                        {formatDate(album.releaseDate, locale)}
                        {album.genre ? ` · ${album.genre}` : ''}
                        {' · '}
                        {t('trackCount', { count: album.trackCount })}
                    </p>
                    <div className={styles.badges}>
                        {album.type === AlbumType.Single ? (
                            <span className={styles.badge}>{t('single')}</span>
                        ) : null}
                        {album.type === AlbumType.Compilation ? (
                            <span className={styles.badge}>{t('compilation')}</span>
                        ) : null}
                        {album.explicit ? (
                            <span className={styles.badge}>{t('explicit')}</span>
                        ) : null}
                        {album.veryImportant ? (
                            <span className={styles.badge}>{t('veryImportant')}</span>
                        ) : null}
                    </div>
                    <p>
                        <a
                            href={yandexUrl}
                            className={styles.external}
                            rel="noreferrer"
                            target="_blank"
                        >
                            {t('openInYandex')} ↗
                        </a>
                    </p>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('tracksTitle')}</h2>
                <div className={styles.card}>
                    {sortedTracks.length === 0 ? (
                        <p className={styles.muted}>{t('noTracks')}</p>
                    ) : (
                        <ul className={styles.trackList}>
                            {sortedTracks.map((track) => (
                                <li key={track.id}>
                                    <Link
                                        href={`/yandex-music/tracks/${track.id}`}
                                        className={styles.trackRow}
                                    >
                                        <span className={styles.trackText}>
                                            <span className={styles.trackTitle}>
                                                {track.title}
                                                {track.version ? (
                                                    <span className={styles.cardVersion}>
                                                        {' '}
                                                        {track.version}
                                                    </span>
                                                ) : null}
                                            </span>
                                            <span className={styles.trackArtists}>
                                                {track.artists.map(({ name }) => name).join(', ')}
                                            </span>
                                        </span>
                                        {track.listens > 0 ? (
                                            <span className={styles.cardListens}>
                                                ×{track.listens}
                                            </span>
                                        ) : null}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('listens')}</h2>
                <div className={styles.card}>
                    {stats.total === 0 ? (
                        <p className={styles.muted}>{t('notListened')}</p>
                    ) : (
                        <>
                            <div className={styles.statsRow}>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{stats.total}</span>
                                    <span className={styles.statLabel}>
                                        {t('totalListens', { count: stats.total })}
                                    </span>
                                </div>
                                {stats.firstAt !== null ? (
                                    <div className={styles.stat}>
                                        <span className={styles.statValue}>
                                            {formatDate(stats.firstAt, locale)}
                                        </span>
                                        <span className={styles.statLabel}>{t('firstListen')}</span>
                                    </div>
                                ) : null}
                                {stats.lastAt !== null ? (
                                    <div className={styles.stat}>
                                        <span className={styles.statValue}>
                                            {formatDate(stats.lastAt, locale)}
                                        </span>
                                        <span className={styles.statLabel}>{t('lastListen')}</span>
                                    </div>
                                ) : null}
                            </div>

                            {/* rtl + newest-first DOM keeps the visual order chronological
                                while the initial scroll position lands on the newest month */}
                            <div className={styles.bars}>
                                {[...stats.byMonth].reverse().map(({ month, count }) => {
                                    const [year, monthNumber] = month.split('-');
                                    const withYear =
                                        monthNumber === '01' || month === stats.byMonth[0]!.month;
                                    return (
                                        <div
                                            key={month}
                                            className={styles.barColumn}
                                            title={`${month}: ${count}`}
                                        >
                                            <div className={styles.barTrack}>
                                                <div
                                                    className={styles.bar}
                                                    style={{
                                                        height: `${(count / maxMonthCount) * 100}%`,
                                                    }}
                                                />
                                            </div>
                                            <span className={styles.barLabel}>
                                                {formatMonth(month, locale)}
                                                {withYear ? ` ’${year!.slice(2)}` : ''}
                                            </span>
                                            <span className={styles.barCount}>{count}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className={styles.contexts}>
                                {stats.byContext.map(({ context, count }) => (
                                    <span key={context} className={styles.badge}>
                                        {t(`context_${context}`)} × {count}
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('metadataHistory')}</h2>
                <div className={styles.card}>
                    <p className={styles.muted}>
                        {t('appearedIn', {
                            date: formatDate(record.snapshots[0]!.snapshotDate, locale),
                        })}
                    </p>
                    {metadataChanges.length > 0 ? (
                        <ul className={styles.changes}>
                            {metadataChanges.map(({ date, changes }) => (
                                <li key={date} className={styles.change}>
                                    <span className={styles.changeDate}>
                                        {formatDate(date, locale)}
                                    </span>
                                    <ul>
                                        {changes.map((change) => (
                                            <li key={change} className={styles.changeItem}>
                                                {change}
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            </section>
        </main>
    );
}
