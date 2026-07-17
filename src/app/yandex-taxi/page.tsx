import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { BarChart } from '@/components/charts/BarChart';
import { ProportionBars } from '@/components/charts/ProportionBars';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { getRideStats } from '@/lib/data/yandex-taxi-stats';
import { formatDate, formatMoney, formatMonth, formatWeekday } from '@/lib/format';

import styles from './page.module.scss';

export const metadata: Metadata = {
    title: 'Taxi overview — Dormouse',
};

export default async function TaxiOverviewPage() {
    const [t, taxiT, locale, stats] = await Promise.all([
        getTranslations('taxiStats'),
        getTranslations('taxi'),
        getLocale(),
        getRideStats(),
    ]);

    if (stats.totalRides === 0 || stats.firstRideAt === null) {
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
                <p className={styles.empty}>{t('empty')}</p>
            </main>
        );
    }

    const money = (amount: number) =>
        stats.currency ? formatMoney(amount, stats.currency, locale) : String(amount);

    const monthItems = [...stats.byMonth].reverse().map(({ month, rides }) => {
        const [year, monthNumber] = month.split('-');
        const withYear = monthNumber === '01' || month === stats.byMonth[0]!.month;
        return {
            key: month,
            label: withYear
                ? `${formatMonth(month, locale)} ’${year!.slice(2)}`
                : formatMonth(month, locale),
            value: rides,
            title: `${month}: ${rides}`,
        };
    });
    const spendItems = [...stats.byMonth].reverse().map(({ month, cost }) => {
        const [year, monthNumber] = month.split('-');
        const withYear = monthNumber === '01' || month === stats.byMonth[0]!.month;
        return {
            key: month,
            label: withYear
                ? `${formatMonth(month, locale)} ’${year!.slice(2)}`
                : formatMonth(month, locale),
            value: cost,
            title: `${month}: ${money(cost)}`,
        };
    });
    const weekdayItems = stats.byWeekday.map(({ weekday, count }) => ({
        key: String(weekday),
        label: formatWeekday(weekday, locale),
        value: count,
    }));
    const hourItems = stats.byHour.map(({ hour, count }) => ({
        key: String(hour),
        label: String(hour),
        value: count,
    }));
    const tariffItems = stats.byTariff.map(({ tariff, count }) => ({
        key: tariff,
        label: taxiT(`tariff_${tariff}`),
        value: count,
    }));
    const paymentItems = stats.byPayment.map(({ payment, count }) => ({
        key: payment,
        label: taxiT(`payment_${payment}`),
        value: count,
    }));
    const carItems = stats.topCars.map(({ car, count }) => ({
        key: car,
        label: car,
        value: count,
    }));

    const totalHours = Math.round(stats.totalDurationSeconds / 3600);

    const records = [
        stats.mostExpensive
            ? {
                  label: t('mostExpensive'),
                  value: money(stats.mostExpensive.cost),
                  ride: stats.mostExpensive,
              }
            : null,
        stats.cheapest
            ? { label: t('cheapest'), value: money(stats.cheapest.cost), ride: stats.cheapest }
            : null,
        stats.longest
            ? {
                  label: t('longest'),
                  value: t('minutes', { minutes: Math.round(stats.longest.durationSeconds / 60) }),
                  ride: stats.longest,
              }
            : null,
        stats.farthest
            ? {
                  label: t('farthest'),
                  value: t('km', { value: Math.round(stats.farthest.distanceKm) }),
                  ride: stats.farthest,
              }
            : null,
    ].filter((record): record is NonNullable<typeof record> => record !== null);

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

            <div className={styles.heading}>
                <h1 className={styles.title}>{t('title')}</h1>
                <p className={styles.since}>
                    {t('since', { date: formatDate(stats.firstRideAt, locale) })}
                </p>
            </div>

            <div className={styles.statsGrid}>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{stats.totalRides}</span>
                    <span className={styles.statLabel}>
                        {t('totalRides', { count: stats.totalRides })}
                    </span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{money(stats.totalCost)}</span>
                    <span className={styles.statLabel}>{t('totalSpent')}</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{money(stats.avgCost)}</span>
                    <span className={styles.statLabel}>{t('avgCost')}</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{money(stats.totalCashback)}</span>
                    <span className={styles.statLabel}>{t('totalCashback')}</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{t('hours', { hours: totalHours })}</span>
                    <span className={styles.statLabel}>{t('totalDuration')}</span>
                </div>
                {stats.cancelledRides > 0 ? (
                    <div className={styles.stat}>
                        <span className={styles.statValue}>{stats.cancelledRides}</span>
                        <span className={styles.statLabel}>
                            {t('cancelledRides', { count: stats.cancelledRides })}
                        </span>
                    </div>
                ) : null}
            </div>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('monthlyActivity')}</h2>
                <div className={styles.card}>
                    <BarChart items={monthItems} scrollable />
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('monthlySpend')}</h2>
                <div className={styles.card}>
                    <BarChart
                        items={spendItems}
                        valueFormatter={money}
                        scrollable
                        columnWidth={56}
                    />
                </div>
            </section>

            <div className={styles.row}>
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>{t('byWeekday')}</h2>
                    <div className={styles.card}>
                        <BarChart items={weekdayItems} />
                    </div>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>{t('byHour')}</h2>
                    <div className={styles.card}>
                        <BarChart items={hourItems} />
                    </div>
                </section>
            </div>

            <div className={styles.row}>
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>{t('tariffs')}</h2>
                    <div className={styles.card}>
                        <ProportionBars items={tariffItems} />
                    </div>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>{t('paymentMethods')}</h2>
                    <div className={styles.card}>
                        <ProportionBars items={paymentItems} />
                    </div>
                </section>
            </div>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('surge')}</h2>
                <div className={styles.card}>
                    {stats.surgedRides > 0 ? (
                        <p className={styles.muted}>
                            {t('surgedRides', {
                                count: stats.surgedRides,
                                avg: stats.avgSurge!.toFixed(2),
                            })}
                        </p>
                    ) : (
                        <p className={styles.muted}>{t('noSurge')}</p>
                    )}
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('fleet')}</h2>
                <div className={styles.card}>
                    <div className={styles.statsRow}>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>
                                {t('uniqueDrivers', { count: stats.uniqueDrivers })}
                            </span>
                        </div>
                        {stats.avgRating !== null ? (
                            <div className={styles.stat}>
                                <span className={styles.statValue}>
                                    {stats.avgRating.toFixed(2)}
                                </span>
                                <span className={styles.statLabel}>{t('avgRating')}</span>
                            </div>
                        ) : null}
                    </div>
                    {carItems.length > 0 ? (
                        <>
                            <p className={styles.subLabel}>{t('topCars')}</p>
                            <ProportionBars items={carItems} />
                        </>
                    ) : null}
                </div>
            </section>

            {stats.topRoutes.length > 0 ? (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>{t('topRoutes')}</h2>
                    <div className={styles.card}>
                        <ul className={styles.routeList}>
                            {stats.topRoutes.map((route) => (
                                <li
                                    key={`${route.source} -> ${route.destination}`}
                                    className={styles.routeRow}
                                >
                                    <span className={styles.routeText}>
                                        {route.source}
                                        <span className={styles.routeArrow}> → </span>
                                        {route.destination}
                                    </span>
                                    <span className={styles.routeCount}>×{route.count}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            ) : null}

            {records.length > 0 ? (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>{t('records')}</h2>
                    <div className={styles.recordsGrid}>
                        {records.map((record) => (
                            <Link
                                key={record.label}
                                href={`/yandex-taxi/rides/${record.ride.id}`}
                                className={styles.recordCard}
                            >
                                <span className={styles.recordLabel}>{record.label}</span>
                                <span className={styles.recordValue}>{record.value}</span>
                                <span className={styles.recordRoute}>
                                    {record.ride.source}
                                    <span className={styles.routeArrow}> → </span>
                                    {record.ride.destination}
                                </span>
                            </Link>
                        ))}
                    </div>
                    {stats.homeAddress ? (
                        <p className={styles.homeNote}>
                            {t('homeBase')}: {stats.homeAddress} ·{' '}
                            {t('awayRides', { count: stats.awayRides })}
                        </p>
                    ) : null}
                </section>
            ) : null}
        </main>
    );
}
