import { NextResponse } from 'next/server';
import { getActiveUsers } from '@/lib/supabase-users';
import { MOCK_USERS } from '@/lib/team-data';

// GET /api/auth/users - Public endpoint for login page
export async function GET() {
    try {
        // Try Supabase first
        const supabaseUsers = await getActiveUsers();

        if (supabaseUsers.length > 0) {
            // Return only necessary fields for login (no passwords!)
            return NextResponse.json({
                users: supabaseUsers.map(u => ({
                    id: u.id,
                    email: u.email,
                    name: u.name,
                }))
            });
        }

        // Fallback to mock users
        const activeUsers = MOCK_USERS.filter(u => u.role !== 'pending');
        return NextResponse.json({
            users: activeUsers.map(u => ({
                id: u.id,
                email: u.email,
                name: u.name,
            }))
        });
    } catch (error) {
        console.error('Error fetching users for login:', error);

        // Fallback to mock
        const activeUsers = MOCK_USERS.filter(u => u.role !== 'pending');
        return NextResponse.json({
            users: activeUsers.map(u => ({
                id: u.id,
                email: u.email,
                name: u.name,
            }))
        });
    }
}
