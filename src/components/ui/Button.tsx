import type { ComponentPropsWithRef } from 'react';

import styles from './Button.module.scss';

type ButtonProps = ComponentPropsWithRef<'button'> & {
    variant?: 'primary' | 'secondary';
    size?: 'md' | 'sm';
    block?: boolean;
};

export function Button({
    variant = 'secondary',
    size = 'md',
    block = false,
    type = 'button',
    className,
    ...props
}: ButtonProps) {
    const classes = [styles.button, styles[variant], styles[size], block && styles.block, className]
        .filter(Boolean)
        .join(' ');

    return <button type={type} className={classes} {...props} />;
}
