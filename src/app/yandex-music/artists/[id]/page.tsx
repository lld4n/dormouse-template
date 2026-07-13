import type { Metadata } from 'next';
import type { ArtistSnapshot } from '@/lib/data/yandex-music';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { notFound } from 'next/navigation';
import { CoverImage } from '@/components/media/CoverImage';
import { CoverLightbox } from '@/components/media/CoverLightbox';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { ArtistDisclaimer, getArtist, getTracksListenStats, latest } from '@/lib/data/yandex-music';
import { getAlbumsIndex } from '@/lib/data/yandex-music-album-index';
import { getTracksIndex } from '@/lib/data/yandex-music-track-index';
import { formatDate, formatMonth } from '@/lib/format';

import styles from './page.module.scss';

export async function generateMetadata({
    params,
}: PageProps<'/yandex-music/artists/[id]'>): Promise<Metadata> {
    const { id } = await params;
    const artist = latest(await getArtist(id));
    return { title: artist ? `${artist.name} — Dormouse` : 'Dormouse' };
}

const DIFF_FIELDS = [
    'name',
    'various',
    'cover',
    'cutoutCover',
    'disclaimers',
] as const satisfies readonly (keyof ArtistSnapshot)[];

function diffValue(field: (typeof DIFF_FIELDS)[number], snapshot: ArtistSnapshot): string {
    const value = snapshot[field];
    if (field === 'cover' || field === 'cutoutCover') {
        return value ? '…' : '—';
    }
    if (Array.isArray(value)) {
        return value.join(', ') || '—';
    }
    return String(value ?? '—');
}

export default async function ArtistPage({ params }: PageProps<'/yandex-music/artists/[id]'>) {
    const { id } = await params;
    const record = await getArtist(id);
    const artist = latest(record);
    if (!record || !artist) {
        notFound();
    }

    const [t, locale, tracksIndex, albumsIndex] = await Promise.all([
        getTranslations('artist'),
        getLocale(),
        getTracksIndex(),
        getAlbumsIndex(),
    ]);

    const collator = new Intl.Collator(locale);

    const artistAlbums = albumsIndex
        .filter((album) => album.artists.some((a) => a.id === id))
        .sort((a, b) => b.releaseDate - a.releaseDate);

    const artistTracks = tracksIndex.filter((track) => track.artists.some((a) => a.id === id));
    const sortedTracks = [...artistTracks].sort(
        (a, b) => b.listens - a.listens || collator.compare(a.title, b.title),
    );
    const stats = await getTracksListenStats(artistTracks.map((track) => track.id));

    const yandexUrl = `https://music.yandex.ru/artist/${id}`;
    const maxMonthCount = Math.max(1, ...stats.byMonth.map(({ count }) => count));
    const isForeignAgent = artist.disclaimers.includes(ArtistDisclaimer.ForeignAgent);

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
                    <ButtonLink href="/yandex-music/artists" size="sm">
                        {t('allArtists')}
                    </ButtonLink>
                </div>
                <ButtonLink href="/settings" size="sm">
                    {t('settingsLink')}
                </ButtonLink>
            </header>

            <section className={styles.hero}>
                <CoverLightbox
                    cover={artist.cover}
                    title={artist.name}
                    thumbSize={280}
                    thumbClassName={styles.cover}
                />
                <div className={styles.info}>
                    <h1 className={styles.title}>{artist.name}</h1>
                    <div className={styles.badges}>
                        {artist.various ? (
                            <span className={styles.badge}>{t('various')}</span>
                        ) : null}
                        {isForeignAgent ? (
                            <span className={styles.badge}>{t('foreignAgent')}</span>
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
                <h2 className={styles.sectionTitle}>{t('albumsTitle')}</h2>
                <div className={styles.card}>
                    {artistAlbums.length === 0 ? (
                        <p className={styles.muted}>{t('noAlbums')}</p>
                    ) : (
                        <ul className={styles.albumGrid}>
                            {artistAlbums.map((album) => (
                                <li key={album.id}>
                                    <Link
                                        href={`/yandex-music/albums/${album.id}`}
                                        className={styles.albumCard}
                                    >
                                        <CoverImage
                                            cover={album.cover}
                                            title={album.title}
                                            size={200}
                                            className={styles.albumCover}
                                        />
                                        <span className={styles.albumTitle}>{album.title}</span>
                                        <span className={styles.albumMeta}>
                                            {new Date(album.releaseDate).getFullYear()}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
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
