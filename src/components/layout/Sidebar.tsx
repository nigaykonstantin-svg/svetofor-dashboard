'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
    signalCounts?: {
        OOS_NOW?: number;
        OOS_SOON?: number;
        LOW_CTR?: number;
        LOW_CR?: number;
        HIGH_DRR?: number;
        OVERSTOCK?: number;
    };
    onSignalClick?: (signal: string) => void;
    selectedSignal?: string | null;
}

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Дашборд', icon: '📊', path: '/' },
    { id: 'tasks', label: 'Задачи', icon: '📋', path: '/tasks' },
    { id: 'goals', label: 'Цели', icon: '🎯', path: '/goals' },
];

const SIGNAL_ITEMS = [
    { id: 'OOS_NOW', label: 'Нет в наличии', icon: '🔴', color: 'text-red-400' },
    { id: 'OOS_SOON', label: 'Скоро закончится', icon: '🟠', color: 'text-orange-400' },
    { id: 'LOW_CTR', label: 'Низкий CTR', icon: '🟡', color: 'text-yellow-400' },
    { id: 'LOW_CR', label: 'Низкая конверсия', icon: '🟡', color: 'text-yellow-400' },
    { id: 'HIGH_DRR', label: 'Высокий ДРР', icon: '💸', color: 'text-pink-400' },
    { id: 'OVERSTOCK', label: 'Затоварка', icon: '📦', color: 'text-blue-400' },
];

export default function Sidebar({
    isCollapsed,
    onToggle,
    signalCounts = {},
    onSignalClick,
    selectedSignal,
}: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <aside
            className={`
                fixed left-0 top-0 h-full z-40
                bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/50
                transition-all duration-300 ease-out
                ${isCollapsed ? 'w-16' : 'w-64'}
            `}
        >
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/50">
                {!isCollapsed && (
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🚦</span>
                        <span className="font-semibold text-lg bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            Светофор
                        </span>
                    </div>
                )}
                <button
                    onClick={onToggle}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    title={isCollapsed ? 'Развернуть' : 'Свернуть'}
                >
                    <span className="text-slate-400">{isCollapsed ? '→' : '←'}</span>
                </button>
            </div>

            {/* Navigation */}
            <nav className="p-3 space-y-1">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                        <button
                            key={item.id}
                            onClick={() => router.push(item.path)}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                transition-all duration-200
                                ${isActive
                                    ? 'bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }
                            `}
                        >
                            <span className="text-xl">{item.icon}</span>
                            {!isCollapsed && (
                                <span className="font-medium">{item.label}</span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Signals Section */}
            {!isCollapsed && (
                <>
                    <div className="px-4 py-2 mt-4">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Сигналы
                        </span>
                    </div>
                    <div className="px-3 space-y-0.5">
                        {SIGNAL_ITEMS.map((signal) => {
                            const count = signalCounts[signal.id as keyof typeof signalCounts] || 0;
                            const isActive = selectedSignal === signal.id;

                            if (count === 0) return null;

                            return (
                                <button
                                    key={signal.id}
                                    onClick={() => onSignalClick?.(signal.id)}
                                    className={`
                                        w-full flex items-center justify-between px-3 py-2 rounded-lg
                                        transition-all duration-200
                                        ${isActive
                                            ? 'bg-slate-800 ring-1 ring-slate-700'
                                            : 'hover:bg-slate-800/50'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{signal.icon}</span>
                                        <span className={`text-sm ${signal.color}`}>
                                            {signal.label}
                                        </span>
                                    </div>
                                    <span className={`
                                        text-xs font-medium px-2 py-0.5 rounded-full
                                        ${isActive ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'}
                                    `}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Bottom Actions */}
            <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-800/50">
                <button
                    onClick={() => router.push('/login')}
                    className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                        text-slate-400 hover:bg-slate-800 hover:text-white
                        transition-all duration-200
                    `}
                >
                    <span className="text-xl">⚙️</span>
                    {!isCollapsed && <span className="font-medium">Настройки</span>}
                </button>
            </div>
        </aside>
    );
}
