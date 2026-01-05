import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { password } = await request.json();
        const correctPassword = process.env.DASHBOARD_PASSWORD || 'mixit2026';

        if (password === correctPassword) {
            const response = NextResponse.json({ success: true });

            // Устанавливаем cookie на 7 дней
            response.cookies.set('svetofor_auth', 'authenticated', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7, // 7 дней
            });

            return response;
        }

        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}
