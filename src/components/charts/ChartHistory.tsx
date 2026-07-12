'use client';

import type { ChartSnapshot } from '../../../scripts/connectors/yandex-music/models/chart';
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

import styles from './ChartHistory.module.scss';

interface ChartHistoryProps {
    snapshots: ChartSnapshot[];
    locale: string;
    listenersLabel: string;
}

export function ChartHistory({ snapshots, locale, listenersLabel }: ChartHistoryProps) {
    if (snapshots.length < 2) {
        return null;
    }

    const formatter = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    const data = snapshots.map((snapshot) => ({
        date: snapshot.snapshotDate,
        position: snapshot.position,
        listeners: snapshot.listeners,
    }));

    return (
        <div className={styles.chart}>
            <ResponsiveContainer width="100%" height={168}>
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <YAxis dataKey="position" domain={['dataMin', 'dataMax']} reversed hide />
                    <Tooltip
                        cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }}
                        contentStyle={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12,
                        }}
                        labelFormatter={(value) => formatter.format(Number(value))}
                        formatter={(value, name) => [
                            name === 'position'
                                ? `#${value}`
                                : Number(value).toLocaleString(locale),
                            name === 'position' ? 'position' : listenersLabel,
                        ]}
                    />
                    <Line
                        type="monotone"
                        dataKey="position"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: 'var(--accent)' }}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
