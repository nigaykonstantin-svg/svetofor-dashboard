'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { canManageUsers, getRoleLabel, getRoleBadgeColor, CATEGORY_LABELS, Category, UserRole } from '@/lib/auth-types';
import UserHeader from '@/components/auth/UserHeader';

interface PlatformUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    category_id: Category | null;
    manager_id: string | null;
    created_at: string;
    is_active: boolean;
    last_login: string | null;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
    { value: 'super_admin', label: '👑 Супер-админ' },
    { value: 'marketplace_admin', label: '🏪 Админ маркетплейса' },
    { value: 'category_manager', label: '👨‍💼 Категорийный менеджер' },
    { value: 'manager', label: '👤 Менеджер' },
    { value: 'pending', label: '⏳ Ожидает подтверждения' },
];

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
    { value: 'face', label: 'Лицо' },
    { value: 'body', label: 'Тело' },
    { value: 'makeup', label: 'Макияж' },
    { value: 'hair', label: 'Волосы' },
];

export default function AdminPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [users, setUsers] = useState<PlatformUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState<string>('all');
    const [showInactive, setShowInactive] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        email: '',
        name: '',
        role: 'manager' as UserRole,
        category_id: '' as string,
    });

    // Check authorization
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated' && session?.user && !canManageUsers(session.user.role)) {
            router.push('/');
        }
    }, [status, session, router]);

    // Fetch users
    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/users');
            if (!res.ok) throw new Error('Failed to fetch users');
            const data = await res.json();
            setUsers(data.users || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated' && session?.user && canManageUsers(session.user.role)) {
            fetchUsers();
        }
    }, [status, session]);

    // Filter users
    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = filterRole === 'all' || user.role === filterRole;
        const matchesActive = showInactive || user.is_active;
        return matchesSearch && matchesRole && matchesActive;
    });

    // Handle create user
    const handleCreateUser = async () => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    category_id: formData.category_id || null,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create user');
            }

            setShowAddModal(false);
            setFormData({ email: '', name: '', role: 'manager', category_id: '' });
            fetchUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error creating user');
        }
    };

    // Handle update user
    const handleUpdateUser = async () => {
        if (!editingUser) return;

        try {
            const res = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingUser.id,
                    ...formData,
                    category_id: formData.category_id || null,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update user');
            }

            setEditingUser(null);
            setFormData({ email: '', name: '', role: 'manager', category_id: '' });
            fetchUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error updating user');
        }
    };

    // Handle toggle active status
    const handleToggleActive = async (user: PlatformUser) => {
        try {
            const action = user.is_active ? 'deactivate' : 'reactivate';
            const res = await fetch(`/api/admin/users?id=${user.id}&action=${action}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Operation failed');
            }

            fetchUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error');
        }
    };

    // Open edit modal
    const openEditModal = (user: PlatformUser) => {
        setEditingUser(user);
        setFormData({
            email: user.email,
            name: user.name,
            role: user.role,
            category_id: user.category_id || '',
        });
    };

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!session?.user || !canManageUsers(session.user.role)) {
        return null;
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/')}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            ← Назад
                        </button>
                        <h1 className="text-2xl font-bold">👥 Управление пользователями</h1>
                    </div>
                    <UserHeader />
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
                        <p className="text-red-300">{error}</p>
                    </div>
                )}

                {/* Toolbar */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Search */}
                        <input
                            type="text"
                            placeholder="Поиск по имени или email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 min-w-[200px] px-4 py-2 bg-slate-700/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                        />

                        {/* Role filter */}
                        <select
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                            className="px-4 py-2 bg-slate-700/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                        >
                            <option value="all">Все роли</option>
                            {ROLE_OPTIONS.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>

                        {/* Show inactive toggle */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                                className="w-4 h-4 rounded accent-pink-500"
                            />
                            <span className="text-sm text-slate-400">Показать неактивных</span>
                        </label>

                        {/* Add user button */}
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg hover:opacity-90 transition-opacity font-medium"
                        >
                            + Добавить пользователя
                        </button>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700/50">
                                <tr>
                                    <th className="text-left px-4 py-3 font-medium text-slate-400">Имя</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-400">Email</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-400">Роль</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-400">Категория</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-400">Статус</th>
                                    <th className="text-left px-4 py-3 font-medium text-slate-400">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-slate-400">
                                            Пользователи не найдены
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map(user => (
                                        <tr key={user.id} className={`border-t border-white/5 ${!user.is_active ? 'opacity-50' : ''}`}>
                                            <td className="px-4 py-3 font-medium">{user.name}</td>
                                            <td className="px-4 py-3 text-slate-400">{user.email}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)} text-white`}>
                                                    {getRoleLabel(user.role)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {user.category_id ? CATEGORY_LABELS[user.category_id] : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${user.is_active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                                    {user.is_active ? 'Активен' : 'Неактивен'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => openEditModal(user)}
                                                        className="px-3 py-1 text-sm bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 transition-colors"
                                                    >
                                                        ✏️ Редактировать
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleActive(user)}
                                                        className={`px-3 py-1 text-sm rounded transition-colors ${user.is_active
                                                                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                                                                : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                                            }`}
                                                    >
                                                        {user.is_active ? '🚫 Деактивировать' : '✅ Активировать'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-white/10 p-4">
                        <div className="text-2xl font-bold">{users.length}</div>
                        <div className="text-slate-400 text-sm">Всего пользователей</div>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-white/10 p-4">
                        <div className="text-2xl font-bold">{users.filter(u => u.is_active).length}</div>
                        <div className="text-slate-400 text-sm">Активных</div>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-white/10 p-4">
                        <div className="text-2xl font-bold">{users.filter(u => u.role === 'pending').length}</div>
                        <div className="text-slate-400 text-sm">Ожидают подтверждения</div>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-white/10 p-4">
                        <div className="text-2xl font-bold">{users.filter(u => u.role === 'super_admin' || u.role === 'marketplace_admin').length}</div>
                        <div className="text-slate-400 text-sm">Администраторов</div>
                    </div>
                </div>
            </main>

            {/* Add/Edit Modal */}
            {(showAddModal || editingUser) && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl border border-white/10 w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-6">
                            {editingUser ? '✏️ Редактировать пользователя' : '➕ Добавить пользователя'}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    disabled={!!editingUser}
                                    className="w-full px-4 py-2 bg-slate-700/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-50"
                                    placeholder="user@mixit.ru"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Имя</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-700/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    placeholder="Иван Иванов"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Роль</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                                    className="w-full px-4 py-2 bg-slate-700/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                                >
                                    {ROLE_OPTIONS.filter(r =>
                                        session?.user?.role === 'super_admin' || r.value !== 'super_admin'
                                    ).map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Категория (для категорийных менеджеров)</label>
                                <select
                                    value={formData.category_id}
                                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-700/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                                >
                                    <option value="">— Не выбрана —</option>
                                    {CATEGORY_OPTIONS.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setEditingUser(null);
                                    setFormData({ email: '', name: '', role: 'manager', category_id: '' });
                                }}
                                className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={editingUser ? handleUpdateUser : handleCreateUser}
                                disabled={!formData.email || !formData.name}
                                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {editingUser ? 'Сохранить' : 'Добавить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
