import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { isAuthConfigured, isPublicMode } from '@/lib/config';

const requireSession = auth((request) => {
    if (!request.auth) {
        const loginUrl = new URL('/login', request.nextUrl);
        if (request.nextUrl.pathname !== '/') {
            loginUrl.searchParams.set('from', request.nextUrl.pathname);
        }
        return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
});

export function proxy(request: NextRequest, event: NextFetchEvent) {
    const { pathname } = request.nextUrl;

    if (isPublicMode()) {
        // Auth endpoints are unused in public mode; don't expose them.
        if (pathname.startsWith('/api/auth')) {
            return new NextResponse(null, { status: 404 });
        }
        // Login makes no sense in public mode; signIn() would crash without AUTH_* env.
        if (pathname === '/login') {
            return NextResponse.redirect(new URL('/', request.nextUrl));
        }
        return NextResponse.next();
    }

    if (!isAuthConfigured()) {
        // NextAuth would crash without its env; let the request through —
        // the root layout fail-closed gate renders an error screen instead of content.
        return pathname.startsWith('/api/auth')
            ? new NextResponse(null, { status: 404 })
            : NextResponse.next();
    }

    if (pathname === '/login' || pathname.startsWith('/api/auth')) {
        return NextResponse.next();
    }

    // auth()'s wrapper is typed for route handlers, but in proxy it takes (request, event).
    return requireSession(request, event as unknown as Parameters<typeof requireSession>[1]);
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
