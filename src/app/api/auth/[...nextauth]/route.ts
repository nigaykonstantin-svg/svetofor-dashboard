import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getUserByEmail, MOCK_USERS } from '@/lib/team-data';
import { User, UserRole } from '@/lib/auth-types';

// Extend NextAuth types
declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            email: string;
            name: string;
            image?: string;
            role: UserRole;
            categoryId?: string;
            managerId?: string;
        };
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        role: UserRole;
        categoryId?: string;
        managerId?: string;
    }
}

export const authOptions: NextAuthOptions = {
    providers: [
        // Credentials provider with password
        CredentialsProvider({
            name: 'Login',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                // Try Supabase users first
                try {
                    const { getUserByEmailFromDB, verifyPassword, updateLastLogin } = await import('@/lib/supabase-users');
                    const dbUser = await getUserByEmailFromDB(credentials.email);

                    if (dbUser) {
                        // Verify password
                        const isValid = await verifyPassword(credentials.email, credentials.password);
                        if (!isValid) {
                            return null;
                        }

                        await updateLastLogin(credentials.email);
                        return {
                            id: dbUser.id,
                            email: dbUser.email,
                            name: dbUser.name,
                        };
                    }
                } catch (error) {
                    console.log('Supabase users not available, falling back to mock data');
                }

                // Fallback to mock data (no password check for dev)
                const user = getUserByEmail(credentials.email);
                if (user) {
                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.image,
                    };
                }

                return null;
            },
        }),
    ],


    callbacks: {
        async signIn({ user, account }) {
            // Allow sign in
            return true;
        },

        async jwt({ token, user, account }) {
            if (user) {
                // First sign in - look up user in our database
                let dbUser = null;

                // Try Supabase first
                try {
                    const { getUserByEmailFromDB, toAppUser } = await import('@/lib/supabase-users');
                    const supabaseUser = await getUserByEmailFromDB(user.email || '');
                    if (supabaseUser) {
                        dbUser = toAppUser(supabaseUser);
                    }
                } catch (error) {
                    console.log('Supabase not available, using mock data');
                }

                // Fallback to mock data
                if (!dbUser) {
                    dbUser = getUserByEmail(user.email || '');
                }

                if (dbUser) {
                    token.id = dbUser.id;
                    token.role = dbUser.role;
                    token.categoryId = dbUser.categoryId;
                    token.managerId = dbUser.managerId;
                } else {
                    // New user - set as pending
                    token.id = user.id || crypto.randomUUID();
                    token.role = 'pending';
                }
            }
            return token;
        },

        async session({ session, token }) {
            // Add custom fields to session
            if (session.user) {
                session.user.id = token.id;
                session.user.role = token.role;
                session.user.categoryId = token.categoryId;
                session.user.managerId = token.managerId;
            }
            return session;
        },
    },

    pages: {
        signIn: '/login',
        error: '/login',
    },

    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },

    secret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
