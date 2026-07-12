'use client';

import type { ChartSnapshot } from '../../../../../scripts/connectors/yandex-music/models/chart';
import { useTranslations } from 'next-intl';

import { useState } from 'react';

import styles from './page.module.scss';

/**
 * Chart rank over time. Rank 1 is the top of the chart, so the y axis is
 * inverted: lower position number = higher point. Coordinates are percentages
 * of the container, so the hover dot and tooltip can be plain positioned divs.
 */
export function ChartSparkline({
    snapshots,
    locale,
}: {
    snapshots: ChartSnapshot[];
    locale: string;
}) {
    const t = useTranslations('track');
    const [hovered, setHovered] = useState<number | null>(null);

    if (snapshots.length < 2) {
        return null;
    }

    const pad = 4;
    const dates = snapshots.map((snapshot) => snapshot.snapshotDate);
    const positions = snapshots.map((snapshot) => snapshot.position);
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const best = Math.min(...positions);
    const worst = Math.max(...positions);

    const points = snapshots.map((snapshot) => ({
        snapshot,
        x:
            maxDate === minDate
                ? 50
                : pad + ((snapshot.snapshotDate - minDate) / (maxDate - minDate)) * (100 - pad * 2),
        y:
            worst === best
                ? 50
                : pad + ((snapshot.position - best) / (worst - best)) * (100 - pad * 2),
    }));

    const active = hovered === null ? null : points[hovered];
    const dateFormat = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    return (
        <div
            className={styles.sparklineBox}
            onPointerMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = ((event.clientX - rect.left) / rect.width) * 100;
                let nearest = 0;
                for (let i = 1; i < points.length; i += 1) {
                    if (Math.abs(points[i]!.x - x) < Math.abs(points[nearest]!.x - x)) {
                        nearest = i;
                    }
                }
                setHovered(nearest);
            }}
            onPointerLeave={() => setHovered(null)}
        >
            <svg
                className={styles.sparkline}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                <polyline
                    points={points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>
            {active ? (
                <>
                    <span
                        className={styles.sparklineDot}
                        style={{ left: `${active.x}%`, top: `${active.y}%` }}
                    />
                    <div
                        className={styles.sparklineTooltip}
                        style={{
                            left: `${Math.min(80, Math.max(20, active.x))}%`,
                            top: `${active.y}%`,
                        }}
                    >
                        <span className={styles.sparklineTooltipTitle}>
                            #{active.snapshot.position}
                        </span>
                        <span>{dateFormat.format(active.snapshot.snapshotDate)}</span>
                        <span>
                            {active.snapshot.listeners.toLocaleString(locale)} {t('chartListeners')}
                        </span>
                    </div>
                </>
            ) : null}
        </div>
    );
}
