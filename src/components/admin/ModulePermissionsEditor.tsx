'use client';

import React, { useState, useEffect } from 'react';
import { UserRole, getRoleLabel } from '@/lib/auth-types';

interface ModulePermission {
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

interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
}

const ALL_ROLES: UserRole[] = ['super_admin', 'marketplace_admin', 'category_manager', 'manager', 'pending'];

interface ModulePermissionsEditorProps {
    users: User[];
    currentUserRole: UserRole;
}

export default function ModulePermissionsEditor({ users, currentUserRole }: ModulePermissionsEditorProps) {
    const [modules, setModules] = useState<ModulePermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [expandedModule, setExpandedModule] = useState<string | null>(null);

    // Fetch modules
    const fetchModules = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/modules');
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setModules(data.modules || []);
        } catch (error) {
            console.error('Error fetching modules:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchModules();
    }, []);

    // Toggle role for a module
    const toggleRole = async (moduleId: string, role: UserRole) => {
        const module = modules.find(m => m.module_id === moduleId);
        if (!module) return;

        // Prevent removing super_admin from admin module
        if (moduleId === 'admin' && role === 'super_admin') return;

        setSaving(moduleId);

        const currentRoles = module.allowed_roles;
        const newRoles = currentRoles.includes(role)
            ? currentRoles.filter(r => r !== role)
            : [...currentRoles, role];

        try {
            const res = await fetch('/api/admin/modules', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    module_id: moduleId,
                    action: 'update_roles',
                    roles: newRoles,
                }),
            });

            if (res.ok) {
                setModules(prev => prev.map(m =>
                    m.module_id === moduleId
                        ? { ...m, allowed_roles: newRoles }
                        : m
                ));
            }
        } catch (error) {
            console.error('Error updating roles:', error);
        } finally {
            setSaving(null);
        }
    };

    // Grant/revoke user access
    const toggleUserAccess = async (moduleId: string, userId: string, grant: boolean) => {
        setSaving(moduleId);

        try {
            const res = await fetch('/api/admin/modules', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    module_id: moduleId,
                    action: grant ? 'grant_user' : 'revoke_user',
                    user_id: userId,
                }),
            });

            if (res.ok) {
                fetchModules();
            }
        } catch (error) {
            console.error('Error updating user access:', error);
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-pink-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-slate-700/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-slate-400">
                    Настройте доступ к модулям для каждой роли. Вы также можете дать или забрать доступ
                    у конкретных пользователей независимо от их роли.
                </p>
            </div>

            {modules.map(module => (
                <div
                    key={module.module_id}
                    className={`bg-slate-800/50 rounded-xl border border-white/10 overflow-hidden transition-all ${saving === module.module_id ? 'opacity-70' : ''
                        }`}
                >
                    {/* Module Header */}
                    <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
                        onClick={() => setExpandedModule(
                            expandedModule === module.module_id ? null : module.module_id
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{module.module_icon}</span>
                            <div>
                                <h3 className="font-medium">{module.module_name}</h3>
                                <p className="text-xs text-slate-500">{module.module_path}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Quick role badges */}
                            <div className="hidden md:flex items-center gap-1">
                                {module.allowed_roles.slice(0, 3).map(role => (
                                    <span
                                        key={role}
                                        className="px-2 py-0.5 bg-slate-700 rounded text-xs"
                                    >
                                        {role.replace('_', ' ')}
                                    </span>
                                ))}
                                {module.allowed_roles.length > 3 && (
                                    <span className="text-xs text-slate-500">
                                        +{module.allowed_roles.length - 3}
                                    </span>
                                )}
                            </div>

                            <span className="text-slate-400">
                                {expandedModule === module.module_id ? '▼' : '▶'}
                            </span>
                        </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedModule === module.module_id && (
                        <div className="border-t border-white/10 p-4 space-y-4">
                            {/* Role Toggles */}
                            <div>
                                <h4 className="text-sm font-medium text-slate-400 mb-2">
                                    Доступ по ролям
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_ROLES.map(role => {
                                        const isAllowed = module.allowed_roles.includes(role);
                                        const isLocked = module.module_id === 'admin' && role === 'super_admin';

                                        return (
                                            <button
                                                key={role}
                                                onClick={() => !isLocked && toggleRole(module.module_id, role)}
                                                disabled={isLocked}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isAllowed
                                                        ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                                                        : 'bg-slate-700/50 text-slate-400 border border-transparent'
                                                    } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/30'}`}
                                            >
                                                {isAllowed ? '✓ ' : ''}{getRoleLabel(role)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Category Restriction Toggle */}
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={module.category_restricted}
                                        onChange={() => {/* TODO: implement */ }}
                                        className="w-4 h-4 rounded accent-pink-500"
                                    />
                                    <span className="text-sm">
                                        Ограничить по категории (пользователь видит только данные своей категории)
                                    </span>
                                </label>
                            </div>

                            {/* User-specific Access */}
                            <div>
                                <h4 className="text-sm font-medium text-slate-400 mb-2">
                                    Персональный доступ
                                </h4>
                                <div className="text-xs text-slate-500 mb-2">
                                    Добавьте пользователей, которым нужен доступ независимо от роли
                                </div>

                                {/* Users with explicit access */}
                                {module.allowed_user_ids.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {module.allowed_user_ids.map(userId => {
                                            const user = users.find(u => u.id === userId);
                                            return (
                                                <span
                                                    key={userId}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm"
                                                >
                                                    {user?.name || userId}
                                                    <button
                                                        onClick={() => toggleUserAccess(module.module_id, userId, false)}
                                                        className="hover:text-red-400 ml-1"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Add user dropdown */}
                                <select
                                    className="px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            toggleUserAccess(module.module_id, e.target.value, true);
                                            e.target.value = '';
                                        }
                                    }}
                                    defaultValue=""
                                >
                                    <option value="">+ Добавить пользователя...</option>
                                    {users
                                        .filter(u => !module.allowed_user_ids.includes(u.id))
                                        .map(user => (
                                            <option key={user.id} value={user.id}>
                                                {user.name} ({user.email})
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
