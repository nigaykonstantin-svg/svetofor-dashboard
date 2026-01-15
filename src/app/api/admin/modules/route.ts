import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
    getAllModulePermissions,
    updateModulePermissions,
    grantModuleAccess,
    revokeModuleAccess,
    updateModuleRoles
} from '@/lib/module-permissions';
import { canManageUsers } from '@/lib/auth-types';

// GET /api/admin/modules - Get all module permissions
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!canManageUsers(session.user.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const modules = await getAllModulePermissions();
        return NextResponse.json({ modules });
    } catch (error) {
        console.error('Error fetching modules:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT /api/admin/modules - Update module permissions
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!canManageUsers(session.user.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { module_id, action, ...updates } = body;

        if (!module_id) {
            return NextResponse.json({ error: 'Missing module_id' }, { status: 400 });
        }

        let success = false;

        switch (action) {
            case 'grant_user':
                if (!updates.user_id) {
                    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
                }
                success = await grantModuleAccess(module_id, updates.user_id);
                break;

            case 'revoke_user':
                if (!updates.user_id) {
                    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
                }
                success = await revokeModuleAccess(module_id, updates.user_id);
                break;

            case 'update_roles':
                if (!updates.roles || !Array.isArray(updates.roles)) {
                    return NextResponse.json({ error: 'Missing or invalid roles array' }, { status: 400 });
                }
                success = await updateModuleRoles(module_id, updates.roles);
                break;

            default:
                // General update
                success = await updateModulePermissions(module_id, updates);
        }

        if (!success) {
            return NextResponse.json({ error: 'Update failed' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating module:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
