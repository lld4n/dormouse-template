const YANDEX_COVER_HOST = 'avatars.yandex.net';

/** Yandex's avatar CDN only ever generates these pixel sizes for `get-music-content` covers — any other value 404s outright rather than resizing on the fly. */
const VALID_SIZES = [30, 50, 75, 100, 150, 200, 300, 400, 600, 700, 800, 1000];

/** Rounds up to the nearest size Yandex actually serves, so requesting e.g. "roughly 2x this 280px box" never 404s and silently degrades to whatever fallback size the caller happens to retry. */
function snapToValidSize(size: number): number {
    return VALID_SIZES.find((valid) => valid >= size) ?? VALID_SIZES[VALID_SIZES.length - 1]!;
}

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
    const snapped = snapToValidSize(size);
    const url = new URL(`https://${cover.replace('%%', `${snapped}x${snapped}`)}`);
    if (
        url.protocol !== 'https:' ||
        url.hostname !== YANDEX_COVER_HOST ||
        !url.pathname.startsWith('/get-music-content/')
    ) {
        return null;
    }
    return url;
}
