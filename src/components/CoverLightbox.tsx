'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import styles from './CoverLightbox.module.scss';

const MIN_SCALE = 1;
const MAX_SCALE = 6;

interface CoverLightboxProps {
    thumbSrc: string;
    fullSrc: string;
    alt: string;
    thumbSize: number;
    thumbClassName?: string;
}

export function CoverLightbox({
    thumbSrc,
    fullSrc,
    alt,
    thumbSize,
    thumbClassName,
}: CoverLightboxProps) {
    const t = useTranslations('lightbox');
    const dialogRef = useRef<HTMLDialogElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const reset = () => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
    };

    const zoomTo = (next: number) => {
        const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
        setScale(clamped);
        if (clamped === MIN_SCALE) {
            setOffset({ x: 0, y: 0 });
        }
    };

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) {
            return;
        }
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            setScale((current) => {
                const next = Math.min(
                    MAX_SCALE,
                    Math.max(MIN_SCALE, current * (event.deltaY < 0 ? 1.2 : 1 / 1.2)),
                );
                if (next === MIN_SCALE) {
                    setOffset({ x: 0, y: 0 });
                }
                return next;
            });
        };
        stage.addEventListener('wheel', onWheel, { passive: false });
        return () => stage.removeEventListener('wheel', onWheel);
    }, []);

    const open = () => {
        reset();
        dialogRef.current?.showModal();
    };

    return (
        <>
            <button type="button" className={styles.trigger} onClick={open} aria-label={t('open')}>
                <Image
                    src={thumbSrc}
                    alt={alt}
                    width={thumbSize}
                    height={thumbSize}
                    className={thumbClassName}
                    priority
                    unoptimized
                />
            </button>
            <dialog
                ref={dialogRef}
                className={styles.dialog}
                onClick={(event) => {
                    if (event.target === dialogRef.current) {
                        dialogRef.current.close();
                    }
                }}
            >
                <div className={styles.toolbar}>
                    <button
                        type="button"
                        className={styles.tool}
                        onClick={() => zoomTo(scale / 1.5)}
                        aria-label={t('zoomOut')}
                    >
                        −
                    </button>
                    <button
                        type="button"
                        className={styles.tool}
                        onClick={() => zoomTo(scale * 1.5)}
                        aria-label={t('zoomIn')}
                    >
                        +
                    </button>
                    <button
                        type="button"
                        className={styles.tool}
                        onClick={reset}
                        aria-label={t('reset')}
                    >
                        1:1
                    </button>
                    <button
                        type="button"
                        className={styles.tool}
                        onClick={() => dialogRef.current?.close()}
                        aria-label={t('close')}
                    >
                        ✕
                    </button>
                </div>
                <div
                    ref={stageRef}
                    className={styles.stage}
                    data-grabbing={dragRef.current !== null || undefined}
                    onDoubleClick={() => zoomTo(scale > 1 ? 1 : 2.5)}
                    onPointerDown={(event) => {
                        if (scale === 1) {
                            return;
                        }
                        dragRef.current = {
                            pointerId: event.pointerId,
                            startX: event.clientX - offset.x,
                            startY: event.clientY - offset.y,
                        };
                        event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                        const drag = dragRef.current;
                        if (drag?.pointerId !== event.pointerId) {
                            return;
                        }
                        setOffset({
                            x: event.clientX - drag.startX,
                            y: event.clientY - drag.startY,
                        });
                    }}
                    onPointerUp={() => {
                        dragRef.current = null;
                    }}
                >
                    <img
                        src={fullSrc}
                        alt={alt}
                        className={styles.full}
                        style={{
                            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                        }}
                        draggable={false}
                    />
                </div>
            </dialog>
        </>
    );
}
