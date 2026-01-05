import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
    function middleware(request) {
        // Additional checks after NextAuth authentication
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token, req }) => {
                // Allow access to login page and auth API without token
                if (
                    req.nextUrl.pathname.startsWith('/login') ||
                    req.nextUrl.pathname.startsWith('/api/auth')
                ) {
                    return true;
                }

                // For all other routes, require a valid token
                return !!token;
            },
        },
        pages: {
            signIn: '/login',
        },
    }
);

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|public).*)',
    ],
};
