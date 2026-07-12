import type { Metadata } from 'next';
import type { TrackSnapshot } from '@/lib/data/yandex-music';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { notFound } from 'next/navigation';
import { ChartHistory } from '@/components/charts/ChartHistory';
import { CoverLightbox } from '@/components/media/CoverLightbox';
import { ButtonLink } from '@/components/ui/ButtonLink';
import {
    getAlbum,
    getArtist,
    getChart,
    getTrack,
    getTrackListenStats,
    latest,
} from '@/lib/data/yandex-music';
import { formatDate, formatDuration, formatMonth } from '@/lib/format';

import styles from './page.module.scss';

export async function generateMetadata({
    params,
}: PageProps<'/yandex-music/tracks/[id]'>): Promise<Metadata> {
    const { id } = await params;
    const track = latest(await getTrack(id));
    return { title: track ? `${track.title} — Dormouse` : 'Dormouse' };
}

const DIFF_FIELDS = [
    'title',
    'version',
    'available',
    'explicit',
    'foreignAgent',
    'durationMs',
    'artists',
    'albums',
    'cover',
] as const satisfies readonly (keyof TrackSnapshot)[];

function diffValue(field: (typeof DIFF_FIELDS)[number], snapshot: TrackSnapshot): string {
    const value = snapshot[field];
    if (field === 'cover') {
        return '…';
    }
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    return String(value ?? '—');
}

export default async function TrackPage({ params }: PageProps<'/yandex-music/tracks/[id]'>) {
    const { id } = await params;
    const record = await getTrack(id);
    const track = latest(record);
    if (!record || !track) {
        notFound();
    }

    const [t, locale, stats, chart] = await Promise.all([
        getTranslations('track'),
        getLocale(),
        getTrackListenStats(id),
        getChart(id),
    ]);
    const [artists, albums] = await Promise.all([
        Promise.all(
            track.artists.map(
                async (artistId) => [artistId, latest(await getArtist(artistId))] as const,
            ),
        ),
        Promise.all(
            track.albums.map(
                async (albumId) => [albumId, latest(await getAlbum(albumId))] as const,
            ),
        ),
    ]);

    const yandexUrl = track.albums[0]
        ? `https://music.yandex.ru/album/${track.albums[0]}/track/${record.id}`
        : `https://music.yandex.ru/track/${record.id}`;

    const maxMonthCount = Math.max(1, ...stats.byMonth.map(({ count }) => count));
    const chartSnapshots = chart?.snapshots ?? [];
    const chartBest = chartSnapshots.length
        ? Math.min(...chartSnapshots.map(({ position }) => position))
        : null;
    const chartLast = chartSnapshots.at(-1) ?? null;

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
                    <ButtonLink href="/yandex-music/tracks" size="sm">
                        {t('allTracks')}
                    </ButtonLink>
                </div>
                <ButtonLink href="/settings" size="sm">
                    {t('settingsLink')}
                </ButtonLink>
            </header>

            <section className={styles.hero}>
                <CoverLightbox
                    cover={track.cover}
                    title={track.title}
                    thumbSize={280}
                    thumbClassName={styles.cover}
                />
                <div className={styles.info}>
                    <h1 className={styles.title}>
                        {track.title}
                        {track.version ? (
                            <span className={styles.version}> {track.version}</span>
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
                        {track.durationMs > 0 ? formatDuration(track.durationMs) : null}
                        {albums.map(([albumId, album]) => (
                            <span key={albumId}>
                                {track.durationMs > 0 || albumId !== track.albums[0] ? ' · ' : ''}
                                <Link
                                    href={`/yandex-music/albums/${albumId}`}
                                    className={styles.entityLink}
                                >
                                    {album?.title ?? `#${albumId}`}
                                </Link>
                            </span>
                        ))}
                    </p>
                    <div className={styles.badges}>
                        {track.explicit ? (
                            <span className={styles.badge}>{t('explicit')}</span>
                        ) : null}
                        {track.foreignAgent ? (
                            <span className={styles.badge}>{t('foreignAgent')}</span>
                        ) : null}
                        {!track.available ? (
                            <span className={`${styles.badge} ${styles.badgeAlert}`}>
                                {t('unavailable')}
                            </span>
                        ) : null}
                        {track.lyrics.sync ? (
                            <span className={styles.badge}>{t('syncLyrics')}</span>
                        ) : track.lyrics.text ? (
                            <span className={styles.badge}>{t('lyrics')}</span>
                        ) : null}
                    </div>
                    {track.substitutedId ? (
                        <p className={styles.canonical}>
                            <Link
                                href={`/yandex-music/tracks/${track.substitutedId}`}
                                className={styles.entityLink}
                            >
                                {t('canonical')}
                            </Link>
                        </p>
                    ) : null}
                    {track.available ? (
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
                    ) : null}
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

            {chartSnapshots.length > 0 ? (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>{t('chart')}</h2>
                    <div className={styles.card}>
                        <div className={styles.statsRow}>
                            {chartBest !== null ? (
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>#{chartBest}</span>
                                    <span className={styles.statLabel}>{t('chartPeak')}</span>
                                </div>
                            ) : null}
                            {chartLast ? (
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>#{chartLast.position}</span>
                                    <span className={styles.statLabel}>
                                        {t('chartLast', {
                                            date: formatDate(chartLast.snapshotDate, locale),
                                        })}
                                    </span>
                                </div>
                            ) : null}
                            {chartLast ? (
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>
                                        {chartLast.listeners.toLocaleString(locale)}
                                    </span>
                                    <span className={styles.statLabel}>{t('chartListeners')}</span>
                                </div>
                            ) : null}
                        </div>
                        <ChartHistory
                            snapshots={chartSnapshots}
                            locale={locale}
                            listenersLabel={t('chartListeners')}
                        />
                        {chartSnapshots.length >= 2 ? (
                            <div className={styles.sparklineDates}>
                                <span>{formatDate(chartSnapshots[0]!.snapshotDate, locale)}</span>
                                <span>
                                    {formatDate(chartSnapshots.at(-1)!.snapshotDate, locale)}
                                </span>
                            </div>
                        ) : null}
                    </div>
                </section>
            ) : null}

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
