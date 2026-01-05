'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { MOCK_USERS } from '@/lib/team-data';
import { CATEGORY_LABELS, Category } from '@/lib/auth-types';

export default function LoginPage() {
    const [selectedEmail, setSelectedEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showAllUsers, setShowAllUsers] = useState(false);

    const handleGoogleLogin = () => {
        setIsLoading(true);
        signIn('google', { callbackUrl: '/' });
    };

    const handleDemoLogin = () => {
        if (!selectedEmail) return;
        setIsLoading(true);
        signIn('credentials', { email: selectedEmail, callbackUrl: '/' });
    };

    // Only show key users by default
    const superAdmins = MOCK_USERS.filter(u => u.role === 'super_admin');
    const categoryManagers = MOCK_USERS.filter(u => u.role === 'category_manager');
    const managers = MOCK_USERS.filter(u => u.role === 'manager');

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <div className="text-6xl mb-4">🚦</div>
                    <h1 className="text-3xl font-bold text-white mb-2">WB Analytics</h1>
                    <p className="text-slate-400">Светофор для MIXIT</p>
                </div>

                {/* Login Card */}
                <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 shadow-xl">
                    {/* Google SSO Button */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Войти через Google
                    </button>

                    {/* Divider */}
                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-slate-900 text-slate-500">или демо-режим</span>
                        </div>
                    </div>

                    {/* Demo User Selector - Simplified */}
                    <div className="space-y-4">
                        <select
                            value={selectedEmail}
                            onChange={(e) => setSelectedEmail(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                        >
                            <option value="">Выберите роль...</option>

                            {/* Super Admin - always visible */}
                            <optgroup label="👑 Администрация">
                                {superAdmins.map(u => (
                                    <option key={u.id} value={u.email}>
                                        {u.name} — полный доступ
                                    </option>
                                ))}
                            </optgroup>

                            {/* Category Managers - always visible */}
                            <optgroup label="👨‍💼 Руководители категорий">
                                {categoryManagers.map(u => (
                                    <option key={u.id} value={u.email}>
                                        {u.name} — {CATEGORY_LABELS[u.categoryId as Category]}
                                    </option>
                                ))}
                            </optgroup>

                            {/* Managers - only if expanded */}
                            {showAllUsers && (
                                <optgroup label="👤 Менеджеры">
                                    {managers.map(u => (
                                        <option key={u.id} value={u.email}>
                                            {u.name} — {CATEGORY_LABELS[u.categoryId as Category]}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>

                        {/* Toggle to show all users */}
                        {!showAllUsers && (
                            <button
                                type="button"
                                onClick={() => setShowAllUsers(true)}
                                className="w-full text-sm text-slate-500 hover:text-slate-300 transition"
                            >
                                + Показать всех менеджеров ({managers.length})
                            </button>
                        )}

                        <button
                            onClick={handleDemoLogin}
                            disabled={!selectedEmail || isLoading}
                            className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin">⏳</span>
                                    Вход...
                                </span>
                            ) : (
                                'Войти в демо-режиме'
                            )}
                        </button>
                    </div>

                    {/* Info */}
                    <p className="mt-6 text-center text-xs text-slate-500">
                        Для рабочего доступа используйте корпоративный Google аккаунт
                    </p>
                </div>

                {/* Role Legend - Compact */}
                <div className="mt-6 bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                    <div className="text-xs text-slate-500 mb-3">Уровни доступа:</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span className="text-slate-400">Админ</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="text-slate-400">Рук. категории</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                            <span className="text-slate-400">Менеджер</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
