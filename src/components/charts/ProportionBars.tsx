import styles from './ProportionBars.module.scss';

export interface ProportionItem {
    key: string;
    label: string;
    value: number;
}

interface ProportionBarsProps {
    items: ProportionItem[];
    valueFormatter?: (value: number) => string;
    className?: string;
}

/** Horizontal share-of-total bars (breakdown by category), e.g. tariff or payment method mix. */
export function ProportionBars({ items, valueFormatter, className }: ProportionBarsProps) {
    const max = Math.max(1, ...items.map((item) => item.value));

    return (
        <div className={`${styles.rows} ${className ?? ''}`}>
            {items.map((item) => (
                <div key={item.key} className={styles.row}>
                    <span className={styles.label}>{item.label}</span>
                    <span className={styles.track}>
                        <span
                            className={styles.fill}
                            style={{ width: `${(item.value / max) * 100}%` }}
                        />
                    </span>
                    <span className={styles.value}>
                        {valueFormatter ? valueFormatter(item.value) : item.value}
                    </span>
                </div>
            ))}
        </div>
    );
}
