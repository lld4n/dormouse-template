import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RouteMap } from '@/components/media/RouteMap';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { getRide } from '@/lib/data/yandex-taxi';
import { formatDateTime, formatMoney } from '@/lib/format';

import styles from './page.module.scss';

export async function generateMetadata({
    params,
}: PageProps<'/yandex-taxi/rides/[id]'>): Promise<Metadata> {
    const { id } = await params;
    const ride = await getRide(id);
    return {
        title: ride ? `${ride.source.text} — Dormouse` : 'Dormouse',
    };
}

export default async function RidePage({ params }: PageProps<'/yandex-taxi/rides/[id]'>) {
    const { id } = await params;
    const ride = await getRide(id);
    if (!ride) {
        notFound();
    }

    const [t, taxiT, locale] = await Promise.all([
        getTranslations('ride'),
        getTranslations('taxi'),
        getLocale(),
    ]);

    const cancelled = ride.status === 'cancelled';
    const durationMinutes = ride.duration !== null ? Math.round(ride.duration / 60) : null;

    return (
        <main className={styles.main}>
            <header className={styles.topBar}>
                <div className={styles.topBarGroup}>
                    <ButtonLink href="/" size="sm">
                        dormouse
                    </ButtonLink>
                    <ButtonLink href="/yandex-taxi/rides" size="sm">
                        {t('allRides')}
                    </ButtonLink>
                </div>
                <ButtonLink href="/settings" size="sm">
                    {t('settingsLink')}
                </ButtonLink>
            </header>

            <section className={styles.hero}>
                <RouteMap
                    source={ride.source.point}
                    destinations={ride.destinations.map((d) => d.point)}
                    track={ride.track}
                    className={styles.map}
                />
                <div className={styles.info}>
                    <p className={styles.date}>{formatDateTime(ride.created, locale)}</p>
                    <h1 className={styles.route}>
                        <span>{ride.source.text}</span>
                        {ride.destinations.map((destination) => (
                            <span key={destination.text}>
                                <span className={styles.arrow}> → </span>
                                {destination.text}
                            </span>
                        ))}
                    </h1>
                    <div className={styles.badges}>
                        <span className={styles.badge}>{taxiT(`tariff_${ride.tariff}`)}</span>
                        {cancelled ? (
                            <span className={`${styles.badge} ${styles.badgeAlert}`}>
                                {taxiT('status_cancelled')}
                            </span>
                        ) : null}
                        {ride.surge !== null && ride.surge > 1 ? (
                            <span className={styles.badge}>
                                {t('surge', { value: ride.surge })}
                            </span>
                        ) : null}
                        {durationMinutes !== null ? (
                            <span className={styles.badge}>
                                {t('duration', { minutes: durationMinutes })}
                            </span>
                        ) : null}
                    </div>
                    {!cancelled ? (
                        <p className={styles.cost}>
                            {formatMoney(ride.cost, ride.currency, locale)}
                        </p>
                    ) : null}
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('paymentMethod')}</h2>
                <div className={styles.card}>
                    <div className={styles.statsRow}>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>
                                {taxiT(`payment_${ride.payment}`)}
                            </span>
                            <span className={styles.statLabel}>{t('paymentMethod')}</span>
                        </div>
                        {ride.cashback !== null ? (
                            <div className={styles.stat}>
                                <span className={styles.statValue}>
                                    {formatMoney(ride.cashback, ride.currency, locale)}
                                </span>
                                <span className={styles.statLabel}>{t('cashback')}</span>
                            </div>
                        ) : null}
                        {ride.tips !== null ? (
                            <div className={styles.stat}>
                                <span className={styles.statValue}>
                                    {formatMoney(ride.tips, ride.currency, locale)}
                                </span>
                                <span className={styles.statLabel}>{t('tip')}</span>
                            </div>
                        ) : null}
                    </div>
                </div>
            </section>

            {ride.driver || ride.car ? (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>{t('driver')}</h2>
                    <div className={styles.card}>
                        <div className={styles.statsRow}>
                            {ride.driver ? (
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{ride.driver}</span>
                                    <span className={styles.statLabel}>{t('driver')}</span>
                                </div>
                            ) : null}
                            {ride.rating !== null ? (
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{ride.rating}</span>
                                    <span className={styles.statLabel}>{t('rating')}</span>
                                </div>
                            ) : null}
                            {ride.car ? (
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>
                                        {ride.car_color ? (
                                            <span
                                                className={styles.carColor}
                                                style={{ background: `#${ride.car_color}` }}
                                            />
                                        ) : null}
                                        {ride.car}
                                        {ride.car_number ? ` · ${ride.car_number}` : ''}
                                    </span>
                                    <span className={styles.statLabel}>{t('car')}</span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </section>
            ) : null}
        </main>
    );
}
