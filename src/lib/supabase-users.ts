import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, UserRole, Category } from './auth-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Lazy initialize
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
    if (!supabaseUrl || !supabaseKey) {
        return null;
    }
    if (!_supabase) {
        _supabase = createClient(supabaseUrl, supabaseKey);
    }
    return _supabase;
}

// Platform user interface (matches DB schema)
export interface PlatformUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    category_id: Category | null;
    manager_id: string | null;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    is_active: boolean;
    last_login: string | null;
}

// Convert DB user to app User type
export function toAppUser(dbUser: PlatformUser): User {
    return {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        categoryId: dbUser.category_id || undefined,
        managerId: dbUser.manager_id || undefined,
        createdAt: dbUser.created_at,
        lastLogin: dbUser.last_login || dbUser.created_at,
    };
}

// Check if Supabase users are configured
export async function isSupabaseUsersConfigured(): Promise<boolean> {
    const client = getSupabase();
    if (!client) return false;

    try {
        const { count, error } = await client
            .from('platform_users')
            .select('*', { count: 'exact', head: true });

        return !error && count !== null;
    } catch {
        return false;
    }
}

// Get all users (for admin panel)
export async function getAllUsers(): Promise<PlatformUser[]> {
    const client = getSupabase();
    if (!client) return [];

    const { data, error } = await client
        .from('platform_users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }

    return data || [];
}

// Get active users only
export async function getActiveUsers(): Promise<PlatformUser[]> {
    const client = getSupabase();
    if (!client) return [];

    const { data, error } = await client
        .from('platform_users')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching active users:', error);
        return [];
    }

    return data || [];
}

// Get user by email
export async function getUserByEmailFromDB(email: string): Promise<PlatformUser | null> {
    const client = getSupabase();
    if (!client) return null;

    const { data, error } = await client
        .from('platform_users')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('is_active', true)
        .single();

    if (error) {
        if (error.code !== 'PGRST116') { // Not found is okay
            console.error('Error fetching user by email:', error);
        }
        return null;
    }

    return data;
}

// Get user by ID
export async function getUserByIdFromDB(id: string): Promise<PlatformUser | null> {
    const client = getSupabase();
    if (!client) return null;

    const { data, error } = await client
        .from('platform_users')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching user by ID:', error);
        return null;
    }

    return data;
}

// Create new user
export interface CreateUserInput {
    email: string;
    name: string;
    role: UserRole;
    category_id?: Category;
    manager_id?: string;
    created_by?: string;
}

export async function createUser(input: CreateUserInput): Promise<PlatformUser | null> {
    const client = getSupabase();
    if (!client) return null;

    const { data, error } = await client
        .from('platform_users')
        .insert({
            email: input.email.toLowerCase(),
            name: input.name,
            role: input.role,
            category_id: input.category_id || null,
            manager_id: input.manager_id || null,
            created_by: input.created_by || null,
            is_active: true,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating user:', error);
        return null;
    }

    return data;
}

// Update user
export interface UpdateUserInput {
    name?: string;
    role?: UserRole;
    category_id?: Category | null;
    manager_id?: string | null;
    is_active?: boolean;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<PlatformUser | null> {
    const client = getSupabase();
    if (!client) return null;

    const { data, error } = await client
        .from('platform_users')
        .update(input)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating user:', error);
        return null;
    }

    return data;
}

// Deactivate user (soft delete)
export async function deactivateUser(id: string): Promise<boolean> {
    const client = getSupabase();
    if (!client) return false;

    const { error } = await client
        .from('platform_users')
        .update({ is_active: false })
        .eq('id', id);

    if (error) {
        console.error('Error deactivating user:', error);
        return false;
    }

    return true;
}

// Reactivate user
export async function reactivateUser(id: string): Promise<boolean> {
    const client = getSupabase();
    if (!client) return false;

    const { error } = await client
        .from('platform_users')
        .update({ is_active: true })
        .eq('id', id);

    if (error) {
        console.error('Error reactivating user:', error);
        return false;
    }

    return true;
}

// Update last login
export async function updateLastLogin(email: string): Promise<void> {
    const client = getSupabase();
    if (!client) return;

    await client
        .from('platform_users')
        .update({ last_login: new Date().toISOString() })
        .eq('email', email.toLowerCase());
}

// Get users by role
export async function getUsersByRole(role: UserRole): Promise<PlatformUser[]> {
    const client = getSupabase();
    if (!client) return [];

    const { data, error } = await client
        .from('platform_users')
        .select('*')
        .eq('role', role)
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching users by role:', error);
        return [];
    }

    return data || [];
}

// Get users by category
export async function getUsersByCategory(category: Category): Promise<PlatformUser[]> {
    const client = getSupabase();
    if (!client) return [];

    const { data, error } = await client
        .from('platform_users')
        .select('*')
        .eq('category_id', category)
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching users by category:', error);
        return [];
    }

    return data || [];
}

// Check if user can manage other users
export function canManageUsersDB(role: UserRole): boolean {
    return role === 'super_admin' || role === 'marketplace_admin';
}

// Check if user can edit specific user
export function canEditUser(editorRole: UserRole, targetRole: UserRole): boolean {
    // super_admin can edit anyone
    if (editorRole === 'super_admin') return true;

    // marketplace_admin can edit everyone except super_admin
    if (editorRole === 'marketplace_admin' && targetRole !== 'super_admin') return true;

    return false;
}
