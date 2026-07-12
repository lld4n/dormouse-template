import styles from './ErrorScreen.module.scss';

interface ErrorScreenProps {
    title: string;
    detailsLabel: string;
    details?: string;
    action?: React.ReactNode;
}

export function ErrorScreen({ title, detailsLabel, details, action }: ErrorScreenProps) {
    return (
        <main className={styles.main}>
            <h1 className={styles.name}>dormouse</h1>
            <p className={styles.message}>{title}</p>
            {details ? (
                <details className={styles.details}>
                    <summary className={styles.summary}>{detailsLabel}</summary>
                    <pre className={styles.stack}>{details}</pre>
                </details>
            ) : null}
            {action}
        </main>
    );
}
