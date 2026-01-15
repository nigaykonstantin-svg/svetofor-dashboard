import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserRole, Category } from './auth-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
    if (!supabaseUrl || !supabaseKey) return null;
    if (!_supabase) {
        _supabase = createClient(supabaseUrl, supabaseKey);
    }
    return _supabase;
}

// Module permission interface
export interface ModulePermission {
    id: string;
    module_id: string;
    module_name: string;
    module_icon: string;
    module_path: string;
    allowed_roles: UserRole[];
    allowed_user_ids: string[];
    denied_user_ids: string[];
    category_restricted: boolean;
    sort_order: number;
    is_active: boolean;
}

// Default modules (fallback when Supabase not available)
export const DEFAULT_MODULES: ModulePermission[] = [
    {
        id: '1',
        module_id: 'dashboard',
        module_name: 'Дашборд',
        module_icon: '📊',
        module_path: '/',
        allowed_roles: ['super_admin', 'marketplace_admin', 'category_manager'],
        allowed_user_ids: [],
        denied_user_ids: [],
        category_restricted: true,
        sort_order: 1,
        is_active: true,
    },
    {
        id: '2',
        module_id: 'tasks',
        module_name: 'Задачи',
        module_icon: '📋',
        module_path: '/tasks',
        allowed_roles: ['super_admin', 'marketplace_admin', 'category_manager', 'manager'],
        allowed_user_ids: [],
        denied_user_ids: [],
        category_restricted: true,
        sort_order: 2,
        is_active: true,
    },
    {
        id: '3',
        module_id: 'goals',
        module_name: 'Цели',
        module_icon: '🎯',
        module_path: '/goals',
        allowed_roles: ['super_admin', 'marketplace_admin', 'category_manager'],
        allowed_user_ids: [],
        denied_user_ids: [],
        category_restricted: false,
        sort_order: 3,
        is_active: true,
    },
    {
        id: '4',
        module_id: 'seo',
        module_name: 'SEO',
        module_icon: '🔍',
        module_path: '/seo',
        allowed_roles: ['super_admin', 'marketplace_admin'],
        allowed_user_ids: [],
        denied_user_ids: [],
        category_restricted: false,
        sort_order: 4,
        is_active: true,
    },
    {
        id: '5',
        module_id: 'org-structure',
        module_name: 'Орг. структура',
        module_icon: '🏢',
        module_path: '/org-structure',
        allowed_roles: ['super_admin', 'marketplace_admin'],
        allowed_user_ids: [],
        denied_user_ids: [],
        category_restricted: false,
        sort_order: 5,
        is_active: true,
    },
    {
        id: '6',
        module_id: 'goals-45b',
        module_name: 'Цели 45 млрд.',
        module_icon: '💰',
        module_path: '/goals-45b',
        allowed_roles: ['super_admin', 'marketplace_admin'],
        allowed_user_ids: [],
        denied_user_ids: [],
        category_restricted: false,
        sort_order: 6,
        is_active: true,
    },
    {
        id: '7',
        module_id: 'admin',
        module_name: 'Управление пользователями',
        module_icon: '👥',
        module_path: '/admin',
        allowed_roles: ['super_admin', 'marketplace_admin'],
        allowed_user_ids: [],
        denied_user_ids: [],
        category_restricted: false,
        sort_order: 99,
        is_active: true,
    },
];

// Get all module permissions
export async function getAllModulePermissions(): Promise<ModulePermission[]> {
    const client = getSupabase();
    if (!client) return DEFAULT_MODULES;

    const { data, error } = await client
        .from('module_permissions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Error fetching module permissions:', error);
        return DEFAULT_MODULES;
    }

    return data || DEFAULT_MODULES;
}

// Check if user can access a specific module
export function canAccessModule(
    module: ModulePermission,
    userRole: UserRole,
    userId: string
): boolean {
    // Check if explicitly denied
    if (module.denied_user_ids.includes(userId)) {
        return false;
    }

    // Check if explicitly allowed (override)
    if (module.allowed_user_ids.includes(userId)) {
        return true;
    }

    // Check role-based access
    return module.allowed_roles.includes(userRole);
}

// Get accessible modules for a user
export async function getAccessibleModules(
    userRole: UserRole,
    userId: string
): Promise<ModulePermission[]> {
    const allModules = await getAllModulePermissions();

    return allModules.filter(module =>
        canAccessModule(module, userRole, userId)
    );
}

// Update module permissions
export async function updateModulePermissions(
    moduleId: string,
    updates: Partial<ModulePermission>
): Promise<boolean> {
    const client = getSupabase();
    if (!client) return false;

    const { error } = await client
        .from('module_permissions')
        .update(updates)
        .eq('module_id', moduleId);

    if (error) {
        console.error('Error updating module permissions:', error);
        return false;
    }

    return true;
}

// Add user to allowed list for a module
export async function grantModuleAccess(
    moduleId: string,
    userId: string
): Promise<boolean> {
    const client = getSupabase();
    if (!client) return false;

    // Get current allowed users
    const { data, error: fetchError } = await client
        .from('module_permissions')
        .select('allowed_user_ids')
        .eq('module_id', moduleId)
        .single();

    if (fetchError) return false;

    const currentAllowed = data?.allowed_user_ids || [];
    if (currentAllowed.includes(userId)) return true;

    const { error } = await client
        .from('module_permissions')
        .update({ allowed_user_ids: [...currentAllowed, userId] })
        .eq('module_id', moduleId);

    return !error;
}

// Remove user from allowed list
export async function revokeModuleAccess(
    moduleId: string,
    userId: string
): Promise<boolean> {
    const client = getSupabase();
    if (!client) return false;

    const { data, error: fetchError } = await client
        .from('module_permissions')
        .select('allowed_user_ids')
        .eq('module_id', moduleId)
        .single();

    if (fetchError) return false;

    const currentAllowed = (data?.allowed_user_ids || []).filter((id: string) => id !== userId);

    const { error } = await client
        .from('module_permissions')
        .update({ allowed_user_ids: currentAllowed })
        .eq('module_id', moduleId);

    return !error;
}

// Update roles for a module
export async function updateModuleRoles(
    moduleId: string,
    roles: UserRole[]
): Promise<boolean> {
    return updateModulePermissions(moduleId, { allowed_roles: roles });
}
