import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
    getAllUsers,
    createUser,
    updateUser,
    deactivateUser,
    reactivateUser,
    CreateUserInput,
    UpdateUserInput
} from '@/lib/supabase-users';
import { canManageUsers } from '@/lib/auth-types';

// GET /api/admin/users - List all users
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!canManageUsers(session.user.role)) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const users = await getAllUsers();
        return NextResponse.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/admin/users - Create new user
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!canManageUsers(session.user.role)) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();

        // Validate required fields
        if (!body.email || !body.name || !body.role) {
            return NextResponse.json({ error: 'Missing required fields: email, name, role' }, { status: 400 });
        }

        // marketplace_admin cannot create super_admin
        if (session.user.role === 'marketplace_admin' && body.role === 'super_admin') {
            return NextResponse.json({ error: 'Cannot create super admin' }, { status: 403 });
        }

        const input: CreateUserInput = {
            email: body.email,
            name: body.name,
            role: body.role,
            category_id: body.category_id,
            manager_id: body.manager_id,
            created_by: session.user.id,
        };

        const user = await createUser(input);

        if (!user) {
            return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
        }

        return NextResponse.json({ user }, { status: 201 });
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT /api/admin/users - Update user
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!canManageUsers(session.user.role)) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();

        if (!body.id) {
            return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
        }

        // marketplace_admin cannot modify super_admin
        if (session.user.role === 'marketplace_admin' && body.role === 'super_admin') {
            return NextResponse.json({ error: 'Cannot modify super admin' }, { status: 403 });
        }

        const input: UpdateUserInput = {};
        if (body.name !== undefined) input.name = body.name;
        if (body.role !== undefined) input.role = body.role;
        if (body.category_id !== undefined) input.category_id = body.category_id;
        if (body.manager_id !== undefined) input.manager_id = body.manager_id;
        if (body.is_active !== undefined) input.is_active = body.is_active;

        const user = await updateUser(body.id, input);

        if (!user) {
            return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
        }

        return NextResponse.json({ user });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/admin/users - Deactivate user
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!canManageUsers(session.user.role)) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const action = searchParams.get('action'); // 'deactivate' or 'reactivate'

        if (!id) {
            return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
        }

        // Cannot deactivate yourself
        if (id === session.user.id) {
            return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
        }

        let success: boolean;
        if (action === 'reactivate') {
            success = await reactivateUser(id);
        } else {
            success = await deactivateUser(id);
        }

        if (!success) {
            return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error with user operation:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
