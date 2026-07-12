import { resolveYandexCover } from '@/lib/covers';

const CACHE_CONTROL = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const size = Number(searchParams.get('size'));
    const source = resolveYandexCover(searchParams.get('cover') ?? '', size);
    if (!source) {
        return new Response(null, { status: 400 });
    }

    const upstream = await fetch(source, { next: { revalidate: 60 * 60 * 24 * 7 } });
    if (!upstream.ok || !upstream.body) {
        return new Response(null, { status: 404 });
    }

    return new Response(upstream.body, {
        headers: {
            'Cache-Control': CACHE_CONTROL,
            'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg',
        },
    });
}
