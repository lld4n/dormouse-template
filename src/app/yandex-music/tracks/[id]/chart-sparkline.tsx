import type { ChartSnapshot } from '@/lib/data/yandex-music';

import styles from './page.module.scss';

/**
 * Chart rank over time. Rank 1 is the top of the chart, so the y axis is
 * inverted: lower position number = higher point.
 */
export function ChartSparkline({ snapshots }: { snapshots: ChartSnapshot[] }) {
    if (snapshots.length < 2) {
        return null;
    }

    const width = 600;
    const height = 80;
    const padding = 4;

    const dates = snapshots.map((snapshot) => snapshot.snapshotDate);
    const positions = snapshots.map((snapshot) => snapshot.position);
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const best = Math.min(...positions);
    const worst = Math.max(...positions);

    const x = (date: number) =>
        maxDate === minDate
            ? padding
            : padding + ((date - minDate) / (maxDate - minDate)) * (width - padding * 2);
    const y = (position: number) =>
        worst === best
            ? height / 2
            : padding + ((position - best) / (worst - best)) * (height - padding * 2);

    const points = snapshots
        .map(
            (snapshot) =>
                `${x(snapshot.snapshotDate).toFixed(1)},${y(snapshot.position).toFixed(1)}`,
        )
        .join(' ');

    return (
        <svg
            className={styles.sparkline}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-hidden="true"
        >
            <polyline
                points={points}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}
