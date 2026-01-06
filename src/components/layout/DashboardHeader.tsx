'use client';

import { useRouter } from 'next/navigation';
import PeriodSelector from './PeriodSelector';
import UserHeader from '@/components/auth/UserHeader';

interface DashboardHeaderProps {
    // Data
    totalSKUs?: number;
    timestamp?: string;
    // Period
    period: number;
    onPeriodChange: (period: number) => void;
    customDateRange?: { start: string; end: string };
    onDateRangeChange: (range: { start: string; end: string } | undefined) => void;
    comparisonEnabled: boolean;
    onComparisonToggle: (enabled: boolean) => void;
    // Actions
    onRefresh: () => void;
    onOpenAiPanel: () => void;
    onOpenSettings: () => void;
    onOpenCommandPalette?: () => void;
}

export default function DashboardHeader({
    totalSKUs,
    timestamp,
    period,
    onPeriodChange,
    customDateRange,
    onDateRangeChange,
    comparisonEnabled,
    onComparisonToggle,
    onRefresh,
    onOpenAiPanel,
    onOpenSettings,
    onOpenCommandPalette,
}: DashboardHeaderProps) {
    const router = useRouter();

    return (
        <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
                {/* Logo & Info */}
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <span className="text-3xl">🚦</span> WB Analytics Dashboard
                    </h1>
                    <p className="text-slate-500 text-sm">
                        MIXIT • {totalSKUs?.toLocaleString() || '...'} SKU • {timestamp ? new Date(timestamp).toLocaleString('ru-RU') : '...'}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Period Selector */}
                    <PeriodSelector
                        period={period}
                        onPeriodChange={(p) => {
                            onPeriodChange(p);
                            onDateRangeChange(undefined);
                        }}
                        dateRange={customDateRange}
                        onDateRangeChange={onDateRangeChange}
                        comparisonEnabled={comparisonEnabled}
                        onComparisonToggle={onComparisonToggle}
                    />

                    {/* Command Palette Button */}
                    {onOpenCommandPalette && (
                        <button
                            onClick={onOpenCommandPalette}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition flex items-center gap-2 text-sm"
                            title="⌘K"
                        >
                            <span>🔍</span>
                            <kbd className="hidden sm:inline text-xs bg-slate-700 px-1.5 py-0.5 rounded">⌘K</kbd>
                        </button>
                    )}

                    {/* Refresh */}
                    <button
                        onClick={onRefresh}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition flex items-center gap-2"
                    >
                        <span className="text-lg">🔄</span> Обновить
                    </button>

                    {/* AI Analysis */}
                    <button
                        onClick={onOpenAiPanel}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition flex items-center gap-2 shadow-lg"
                    >
                        <span className="text-lg">🤖</span> AI Анализ
                    </button>

                    {/* Settings */}
                    <button
                        onClick={onOpenSettings}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition flex items-center gap-2"
                    >
                        <span className="text-lg">⚙️</span> Настройки
                    </button>

                    {/* Goals */}
                    <button
                        onClick={() => router.push('/goals')}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-lg transition flex items-center gap-2"
                    >
                        <span className="text-lg">🎯</span> Цели
                    </button>

                    {/* User Profile */}
                    <UserHeader />
                </div>
            </div>
        </header>
    );
}
