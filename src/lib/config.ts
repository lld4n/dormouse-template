// Access mode is fail-closed: the app is private unless APP_MODE is explicitly "public".
export function isPublicMode(): boolean {
    return process.env.APP_MODE === 'public';
}

export const REQUIRED_AUTH_ENV = [
    'AUTH_SECRET',
    'AUTH_GITHUB_ID',
    'AUTH_GITHUB_SECRET',
    'ALLOWED_GITHUB_LOGIN',
] as const;

export function missingAuthEnv(): string[] {
    return REQUIRED_AUTH_ENV.filter((name) => !process.env[name]);
}

export function isAuthConfigured(): boolean {
    return missingAuthEnv().length === 0;
}
