const YANDEX_COVER_HOST = 'avatars.yandex.net';

export function coverProxyUrl(cover: string, size: number): string | null {
    if (!cover) {
        return null;
    }
    const params = new URLSearchParams({ cover, size: String(size) });
    return `/api/covers?${params}`;
}

export function resolveYandexCover(cover: string, size: number): URL | null {
    if (!cover || !Number.isInteger(size) || size < 1 || size > 2_000) {
        return null;
    }
    const url = new URL(`https://${cover.replace('%%', `${size}x${size}`)}`);
    if (
        url.protocol !== 'https:' ||
        url.hostname !== YANDEX_COVER_HOST ||
        !url.pathname.startsWith('/get-music-content/')
    ) {
        return null;
    }
    return url;
}
