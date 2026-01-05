'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { User, UserRole, getRoleLabel, getRoleBadgeColor, CATEGORY_LABELS, Category } from '@/lib/auth-types';

export function useAuth() {
    const { data: session, status } = useSession();

    const isLoading = status === 'loading';
    const isAuthenticated = status === 'authenticated';

    const user = session?.user ? {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.name || '',
        image: session.user.image,
        role: session.user.role as UserRole,
        categoryId: session.user.categoryId as Category | undefined,
        managerId: session.user.managerId,
    } : null;

    const isSuperAdmin = user?.role === 'super_admin';
    const isCategoryManager = user?.role === 'category_manager';
    const isManager = user?.role === 'manager';
    const isPending = user?.role === 'pending';

    const canCreateTasks = isSuperAdmin || isCategoryManager;
    const canManageUsers = isSuperAdmin;
    const canViewAllCategories = isSuperAdmin;

    return {
        user,
        isLoading,
        isAuthenticated,
        isSuperAdmin,
        isCategoryManager,
        isManager,
        isPending,
        canCreateTasks,
        canManageUsers,
        canViewAllCategories,
        signIn,
        signOut,
        getRoleLabel: () => user ? getRoleLabel(user.role) : '',
        getCategoryLabel: () => user?.categoryId ? CATEGORY_LABELS[user.categoryId] : 'Все категории',
    };
}

export { signIn, signOut };
