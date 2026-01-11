// User roles
export type UserRole = 'super_admin' | 'marketplace_admin' | 'category_manager' | 'manager' | 'pending';

// Product categories
export type Category = 'face' | 'body' | 'makeup' | 'hair';

export const CATEGORY_LABELS: Record<Category, string> = {
    face: 'Лицо',
    body: 'Тело',
    makeup: 'Макияж',
    hair: 'Волосы',
};

export const CATEGORY_COLORS: Record<Category, string> = {
    face: 'bg-pink-500',
    body: 'bg-blue-500',
    makeup: 'bg-purple-500',
    hair: 'bg-amber-500',
};

// User interface
export interface User {
    id: string;
    email: string;
    name: string;
    image?: string;
    role: UserRole;
    categoryId?: Category;
    managerId?: string; // Category manager's ID (for managers only)
    createdAt: string;
    lastLogin: string;
}

// Team structure
export interface Team {
    id: Category;
    name: string;
    categoryManager?: User;
    managers: User[];
}

// Permission matrix
export const PERMISSIONS = {
    super_admin: {
        canViewAllTasks: true,
        canViewAllCategories: true,
        canCreateTasks: true,
        canAssignToAnyManager: true,
        canManageUsers: true,
        canViewAnalytics: true,
    },
    marketplace_admin: {
        canViewAllTasks: true,
        canViewAllCategories: true,
        canCreateTasks: true,
        canAssignToAnyManager: true,
        canManageUsers: true, // Can manage users
        canViewAnalytics: true,
    },
    category_manager: {
        canViewAllTasks: false, // Only their category
        canViewAllCategories: false,
        canCreateTasks: true,
        canAssignToAnyManager: false, // Only their managers
        canManageUsers: false,
        canViewAnalytics: true,
    },
    manager: {
        canViewAllTasks: false, // Only assigned to them
        canViewAllCategories: false,
        canCreateTasks: false,
        canAssignToAnyManager: false,
        canManageUsers: false,
        canViewAnalytics: false,
    },
    pending: {
        canViewAllTasks: false,
        canViewAllCategories: false,
        canCreateTasks: false,
        canAssignToAnyManager: false,
        canManageUsers: false,
        canViewAnalytics: false,
    },
};

// Helper functions
export function canCreateTasks(role: UserRole): boolean {
    return role === 'super_admin' || role === 'category_manager';
}

export function canViewAllCategories(role: UserRole): boolean {
    return role === 'super_admin';
}

export function canManageUsers(role: UserRole): boolean {
    return role === 'super_admin' || role === 'marketplace_admin';
}

export function getRoleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
        super_admin: '👑 Супер-админ',
        marketplace_admin: '🏪 Администратор маркетплейса',
        category_manager: '👨‍💼 Категорийный менеджер',
        manager: '👤 Менеджер',
        pending: '⏳ Ожидает подтверждения',
    };
    return labels[role];
}

export function getRoleBadgeColor(role: UserRole): string {
    const colors: Record<UserRole, string> = {
        super_admin: 'bg-amber-500',
        marketplace_admin: 'bg-emerald-500',
        category_manager: 'bg-blue-500',
        manager: 'bg-slate-500',
        pending: 'bg-gray-500',
    };
    return colors[role];
}
