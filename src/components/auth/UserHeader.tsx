'use client';

import { useAuth } from '@/lib/useAuth';
import { getRoleBadgeColor, CATEGORY_LABELS, Category } from '@/lib/auth-types';

export default function UserHeader() {
    const {
        user,
        isLoading,
        isAuthenticated,
        signOut,
        getRoleLabel,
        getCategoryLabel,
        isSuperAdmin,
        isCategoryManager,
        isManager,
        isPending,
    } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-slate-700"></div>
                <div className="h-4 w-24 bg-slate-700 rounded"></div>
            </div>
        );
    }

    if (!isAuthenticated || !user) {
        return null;
    }

    const roleColor = getRoleBadgeColor(user.role);

    return (
        <div className="flex items-center gap-4">
            {/* User Info */}
            <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative">
                    {user.image ? (
                        <img
                            src={user.image}
                            alt={user.name}
                            className="w-10 h-10 rounded-full border-2 border-slate-600"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-lg font-bold">
                            {user.name.charAt(0)}
                        </div>
                    )}
                    {/* Online indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900"></div>
                </div>

                {/* Name & Role */}
                <div className="hidden sm:block">
                    <div className="text-sm font-medium text-white">{user.name}</div>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${roleColor} text-white`}>
                            {isSuperAdmin && '👑'}
                            {isCategoryManager && '👨‍💼'}
                            {isManager && '👤'}
                            {isPending && '⏳'}
                            {' '}
                            {isSuperAdmin ? 'Админ' :
                                isCategoryManager ? 'Кат. менеджер' :
                                    isManager ? 'Менеджер' : 'Ожидание'}
                        </span>
                        {user.categoryId && (
                            <span className="text-xs text-slate-400">
                                {CATEGORY_LABELS[user.categoryId as Category]}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Menu Dropdown */}
            <div className="relative group">
                <button className="p-2 hover:bg-slate-800 rounded-lg transition">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Dropdown Menu */}
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <div className="p-3 border-b border-slate-700">
                        <div className="text-sm text-white font-medium truncate">{user.name}</div>
                        <div className="text-xs text-slate-400 truncate">{user.email}</div>
                    </div>

                    <div className="p-1">
                        {isSuperAdmin && (
                            <a
                                href="/admin"
                                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition"
                            >
                                <span>⚙️</span> Управление
                            </a>
                        )}
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 rounded transition"
                        >
                            <span>🚪</span> Выйти
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
