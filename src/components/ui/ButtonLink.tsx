import type { ComponentPropsWithRef } from 'react';
import Link from 'next/link';

import styles from './Button.module.scss';

type ButtonLinkProps = ComponentPropsWithRef<typeof Link> & {
    variant?: 'primary' | 'secondary';
    size?: 'md' | 'sm';
    block?: boolean;
};

export function ButtonLink({
    variant = 'secondary',
    size = 'md',
    block = false,
    className,
    ...props
}: ButtonLinkProps) {
    const classes = [styles.button, styles[variant], styles[size], block && styles.block, className]
        .filter(Boolean)
        .join(' ');

    return <Link className={classes} {...props} />;
}
