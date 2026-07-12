import styles from './ErrorScreen.module.scss';

// Deliberately not translated: this screen must survive any failure,
// including a broken i18n setup.
interface ErrorScreenProps {
    title?: string;
    details?: string;
    action?: React.ReactNode;
}

export function ErrorScreen({ title = 'something went wrong', details, action }: ErrorScreenProps) {
    return (
        <main className={styles.main}>
            <h1 className={styles.name}>dormouse</h1>
            <p className={styles.message}>{title}</p>
            {details ? (
                <details className={styles.details}>
                    <summary className={styles.summary}>technical details</summary>
                    <pre className={styles.stack}>{details}</pre>
                </details>
            ) : null}
            {action}
        </main>
    );
}
