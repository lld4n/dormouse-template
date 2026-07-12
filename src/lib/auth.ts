import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [GitHub],
    callbacks: {
        signIn({ profile }) {
            const allowed = process.env.ALLOWED_GITHUB_LOGIN;
            return Boolean(allowed) && profile?.login === allowed;
        },
    },
});
