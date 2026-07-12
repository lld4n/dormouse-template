import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
    reactCompiler: true,
    images: {
        remotePatterns: [{ protocol: 'https', hostname: 'avatars.yandex.net' }],
    },
    // Next traces file dependencies statically and can't infer runtime paths
    // like `data/tracks/${id}.json` — without this, dynamic routes get ENOENT
    // in production. Scoped per route: the 250 MB serverless limit is
    // per-function, so never use a blanket '/*'.
    outputFileTracingIncludes: {
        '/yandex-music/tracks': ['data/yandex-music/index/tracks.json'],
        '/yandex-music/tracks/[id]': ['data/yandex-music/**'],
    },
};

export default withNextIntl(nextConfig);
