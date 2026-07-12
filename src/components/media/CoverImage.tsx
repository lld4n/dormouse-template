'use client';

/* eslint-disable next/no-img-element -- the local cover route is a validated proxy with lazy loading and an error fallback. */

import { useState } from 'react';

import { coverProxyUrl } from '@/lib/covers';

import styles from './CoverImage.module.scss';

interface CoverImageProps {
    cover: string;
    title: string;
    size: number;
    alt?: string;
    className?: string;
    priority?: boolean;
}

function initials(title: string): string {
    return title.trim().slice(0, 1).toLocaleUpperCase() || '♪';
}

export function CoverImage({
    cover,
    title,
    size,
    alt = '',
    className,
    priority = false,
}: CoverImageProps) {
    const [failed, setFailed] = useState(false);
    const src = coverProxyUrl(cover, size);

    if (!src || failed) {
        return (
            <span
                className={`${styles.placeholder} ${className ?? ''}`}
                aria-label={alt || undefined}
                style={{ width: size, height: size }}
            >
                {initials(title)}
            </span>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            width={size}
            height={size}
            className={className}
            style={{ width: size, height: size }}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            onError={() => setFailed(true)}
        />
    );
}
