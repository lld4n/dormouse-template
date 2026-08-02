import type { Metadata } from 'next';
import { Disc3, Mic2, Music } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { getAlbumsIndex } from '@/lib/data/yandex-music-album-index';
import { getArtistsIndex } from '@/lib/data/yandex-music-artist-index';
import { getTracksIndex } from '@/lib/data/yandex-music-track-index';

import styles from './page.module.scss';

export const metadata: Metadata = {
    title: 'Yandex Music — Dormouse',
};

export default async function YandexMusicPage() {
    const [t, tracks, albums, artists] = await Promise.all([
        getTranslations('musicHub'),
        getTracksIndex(),
        getAlbumsIndex(),
        getArtistsIndex(),
    ]);

    const sections = [
        {
            href: '/yandex-music/tracks',
            icon: Music,
            label: t('tracks'),
            count: t('trackCount', { count: tracks.length }),
        },
        {
            href: '/yandex-music/albums',
            icon: Disc3,
            label: t('albums'),
            count: t('albumCount', { count: albums.length }),
        },
        {
            href: '/yandex-music/artists',
            icon: Mic2,
            label: t('artists'),
            count: t('artistCount', { count: artists.length }),
        },
    ];

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
            </div>

            <div className={styles.navGrid}>
                {sections.map(({ href, icon: Icon, label, count }) => (
                    <Link key={href} href={href} className={styles.navCard}>
                        <Icon className={styles.navIcon} size={22} strokeWidth={1.5} />
                        <span className={styles.navLabel}>{label}</span>
                        <span className={styles.navCount}>{count}</span>
                    </Link>
                ))}
            </div>
        </main>
    );
}
