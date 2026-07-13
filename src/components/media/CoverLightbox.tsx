'use client';

import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';

import { coverProxyUrl } from '@/lib/covers';

import { CoverImage } from './CoverImage';
import styles from './CoverLightbox.module.scss';

const iconProps = { size: 20, strokeWidth: 1.75 };

interface CoverLightboxProps {
    cover: string;
    title: string;
    thumbSize: number;
    thumbClassName?: string;
}

export function CoverLightbox({ cover, title, thumbSize, thumbClassName }: CoverLightboxProps) {
    const [open, setOpen] = useState(false);
    const full = coverProxyUrl(cover, 1_000);

    return (
        <>
            <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
                <CoverImage
                    cover={cover}
                    title={title}
                    alt={title}
                    size={thumbSize}
                    className={thumbClassName}
                    priority
                />
            </button>
            {full ? (
                <Lightbox
                    open={open}
                    close={() => setOpen(false)}
                    slides={[{ src: full, alt: title }]}
                    plugins={[Zoom]}
                    carousel={{ finite: true, preload: 0 }}
                    render={{
                        buttonPrev: () => null,
                        buttonNext: () => null,
                        iconClose: () => <X {...iconProps} />,
                        iconZoomIn: () => <ZoomIn {...iconProps} />,
                        iconZoomOut: () => <ZoomOut {...iconProps} />,
                    }}
                    zoom={{ maxZoomPixelRatio: 6, scrollToZoom: true }}
                />
            ) : null}
        </>
    );
}
