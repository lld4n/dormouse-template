import type { CSSProperties } from 'react';

import styles from './BarChart.module.scss';

export interface BarChartItem {
    key: string;
    label: string;
    value: number;
    title?: string;
}

interface BarChartProps {
    items: BarChartItem[];
    valueFormatter?: (value: number) => string;
    /**
     * For long time series: enables horizontal scrolling via the rtl trick
     * documented on `.scrollable` in `BarChart.module.scss`. Callers must
     * pass `items` newest-first when this is set — the component doesn't
     * reorder them itself.
     */
    scrollable?: boolean;
    /** Only relevant when `scrollable` — widen columns (default 32px) when `valueFormatter` produces long labels (e.g. formatted money) that would otherwise get clipped. */
    columnWidth?: number;
    className?: string;
}

/** Plain CSS bar chart — no client JS, no charting library, matches the one already hand-rolled in the yandex-music track detail page. */
export function BarChart({
    items,
    valueFormatter,
    scrollable = false,
    columnWidth,
    className,
}: BarChartProps) {
    const max = Math.max(1, ...items.map((item) => item.value));

    return (
        <div
            className={`${styles.bars} ${scrollable ? styles.scrollable : ''} ${className ?? ''}`}
            style={
                columnWidth
                    ? ({ '--bar-column-width': `${columnWidth}px` } as CSSProperties)
                    : undefined
            }
        >
            {items.map((item) => (
                <div
                    key={item.key}
                    className={styles.column}
                    title={item.title ?? `${item.label}: ${item.value}`}
                >
                    <div className={styles.track}>
                        <div
                            className={styles.bar}
                            style={{ height: `${(item.value / max) * 100}%` }}
                        />
                    </div>
                    <span className={styles.label}>{item.label}</span>
                    <span className={styles.value}>
                        {valueFormatter ? valueFormatter(item.value) : item.value}
                    </span>
                </div>
            ))}
        </div>
    );
}
