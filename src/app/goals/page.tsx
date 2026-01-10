'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import UserHeader from '@/components/auth/UserHeader';
import { GoalProgressCard, GoalsManagementModal, SKUGoalsTable } from '@/components/goals';
import { useAuth } from '@/lib/useAuth';
import { Category, CATEGORY_LABELS, canCreateTasks, canViewAllCategories } from '@/lib/auth-types';
import {
    CategoryGoal,
    GoalProgress,
    GoalPeriod,
    getCurrentPeriod,
    GOAL_STATUS_COLORS,
} from '@/types/goal-types';
import {
    calculateAllGoalsProgress,
    calculateTotalProgress,
    formatPeriod,
    formatGoalMoney,
    getProblematicSKUs,
} from '@/lib/goals-utils';
import { SKUData } from '@/types/dashboard';
import { getCachedSKUData, cacheSKUData } from '@/lib/client-cache';

export default function GoalsPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();

    // State
    const [goals, setGoals] = useState<CategoryGoal[]>([]);
    const [skuData, setSkuData] = useState<SKUData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<GoalPeriod>(getCurrentPeriod());
    const [showManageModal, setShowManageModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'categories' | 'sku'>('categories');

    // AbortController ref for canceling in-flight requests
    const abortControllerRef = useRef<AbortController | null>(null);

    // Auth redirect
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Fetch goals and SKU data
    useEffect(() => {
        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        async function fetchData() {
            try {
                setLoading(true);
                setError(null);

                // Fetch goals
                const goalsRes = await fetch(
                    `/api/goals?month=${period.month}&year=${period.year}`,
                    { signal }
                );
                if (!goalsRes.ok) {
                    throw new Error(`Goals API error: ${goalsRes.status}`);
                }
                const goalsData = await goalsRes.json();

                if (!signal.aborted && goalsData.success) {
                    setGoals(goalsData.goals);
                }

                // Calculate days from start of goal month to today
                // For January 2026, if today is Jan 10, period = 10 days
                const now = new Date();
                const goalMonthStart = new Date(period.year, period.month - 1, 1); // period.month is 1-indexed
                const daysFromMonthStart = Math.max(1, Math.ceil((now.getTime() - goalMonthStart.getTime()) / (1000 * 60 * 60 * 24)));

                console.log(`Goals: fetching SKU data for ${daysFromMonthStart} days (from ${goalMonthStart.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]})`);

                // Fetch SKU data for actual sales calculation (optional - goals page can work without it)
                try {
                    // Check client cache first
                    const cached = getCachedSKUData(daysFromMonthStart);
                    if (cached) {
                        console.log(`Goals: using cached SKU data (period=${cached.cachedPeriod})`);
                        const flatSku = Object.values(cached.data.data || {}).flat() as SKUData[];
                        const uniqueSku = [...new Map(flatSku.map(s => [s.nmId, s])).values()];
                        if (!signal.aborted) {
                            setSkuData(uniqueSku);
                        }
                    } else {
                        // Fetch from API
                        const skuRes = await fetch(
                            `/api/svetofor?period=${daysFromMonthStart}&skipDRR=true`,
                            { signal }
                        );
                        if (skuRes.ok) {
                            const skuDataResult = await skuRes.json();
                            if (!signal.aborted && skuDataResult.success && skuDataResult.data) {
                                // Cache the result
                                cacheSKUData(skuDataResult, daysFromMonthStart);
                                // Flatten and deduplicate by nmId
                                const flatSku = Object.values(skuDataResult.data).flat() as SKUData[];
                                const uniqueSku = [...new Map(flatSku.map(s => [s.nmId, s])).values()];
                                setSkuData(uniqueSku);
                            }
                        }
                    }
                } catch (skuErr) {
                    // SKU data is optional, continue without it
                    console.warn('Could not load SKU data for goals:', skuErr);
                }
            } catch (err) {
                // Ignore aborted requests
                if (err instanceof Error && err.name === 'AbortError') {
                    return;
                }
                console.error('Failed to fetch goals data:', err);
                if (!signal.aborted) {
                    setError('Не удалось загрузить данные целей');
                }
            } finally {
                if (!signal.aborted) {
                    setLoading(false);
                }
            }
        }

        if (user) {
            fetchData();
        }

        return () => {
            abortControllerRef.current?.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, period.month, period.year]);

    // Calculate progress for all goals
    const goalsProgress = useMemo(() => {
        return calculateAllGoalsProgress(goals, skuData, period);
    }, [goals, skuData, period]);

    // Filter progress by user's access
    const visibleProgress = useMemo(() => {
        if (!user) return [];

        if (canViewAllCategories(user.role)) {
            // Super admin sees all
            return goalsProgress;
        }

        if (user.categoryId) {
            // Category manager or manager sees only their category
            return goalsProgress.filter(p => p.categoryId === user.categoryId);
        }

        return [];
    }, [goalsProgress, user]);

    // Total company progress
    const totalProgress = useMemo(() => {
        return calculateTotalProgress(goalsProgress);
    }, [goalsProgress]);

    // Handle saving goals
    const handleSaveGoals = async (updates: { categoryId: Category; targetAmount: number }[]) => {
        const response = await fetch('/api/goals', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                updates: updates.map(u => ({ ...u, period })),
                userId: user?.id,
            }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to save');
        }

        // Refresh goals
        const goalsRes = await fetch(`/api/goals?month=${period.month}&year=${period.year}`);
        const goalsData = await goalsRes.json();
        if (goalsData.success) {
            setGoals(goalsData.goals);
        }
    };

    // Allowed categories for editing
    const allowedCategories = useMemo(() => {
        if (!user) return [];
        if (canViewAllCategories(user.role)) {
            return ['face', 'body', 'makeup', 'hair'] as Category[];
        }
        if (user.categoryId) {
            return [user.categoryId];
        }
        return [];
    }, [user]);

    if (authLoading || !user) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-white">Загрузка...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900">
            <UserHeader />

            <main className="container mx-auto px-4 py-6 max-w-6xl">
                {/* Page Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">
                            🎯 Цели по категориям
                        </h1>
                        <p className="text-slate-400">
                            {formatPeriod(period)}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Period navigation */}
                        <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
                            <button
                                onClick={() => setPeriod(prev => ({
                                    month: prev.month === 1 ? 12 : prev.month - 1,
                                    year: prev.month === 1 ? prev.year - 1 : prev.year,
                                }))}
                                className="px-3 py-1.5 text-slate-400 hover:text-white transition-colors"
                            >
                                ←
                            </button>
                            <span className="text-white text-sm px-2">
                                {formatPeriod(period)}
                            </span>
                            <button
                                onClick={() => setPeriod(prev => ({
                                    month: prev.month === 12 ? 1 : prev.month + 1,
                                    year: prev.month === 12 ? prev.year + 1 : prev.year,
                                }))}
                                className="px-3 py-1.5 text-slate-400 hover:text-white transition-colors"
                            >
                                →
                            </button>
                        </div>

                        {/* Manage button */}
                        {canCreateTasks(user.role) && (
                            <button
                                onClick={() => setShowManageModal(true)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                            >
                                ⚙️ Управление целями
                            </button>
                        )}

                        {/* Back button */}
                        <button
                            onClick={() => router.push('/')}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                        >
                            ← Назад
                        </button>
                    </div>
                </div>

                {/* Error state */}
                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 text-red-400">
                        {error}
                    </div>
                )}

                {/* Loading state */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-slate-800/50 rounded-xl p-4 animate-pulse">
                                <div className="h-6 bg-slate-700 rounded w-1/3 mb-4" />
                                <div className="h-3 bg-slate-700 rounded w-full mb-4" />
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="h-12 bg-slate-700 rounded" />
                                    <div className="h-12 bg-slate-700 rounded" />
                                    <div className="h-12 bg-slate-700 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Tabs */}
                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={() => setActiveTab('categories')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'categories'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:text-white'
                                    }`}
                            >
                                📊 По категориям
                            </button>
                            <button
                                onClick={() => setActiveTab('sku')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'sku'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:text-white'
                                    }`}
                            >
                                🎯 По SKU (Gold/Silver/Bronze)
                            </button>
                        </div>

                        {/* Tab: Categories */}
                        {activeTab === 'categories' && (
                            <>
                                {/* Total Company Progress (for admins) */}
                                {canViewAllCategories(user.role) && goalsProgress.length > 0 && (
                                    <div className={`mb-6 p-4 rounded-xl border ${GOAL_STATUS_COLORS[totalProgress.overallStatus].border} ${GOAL_STATUS_COLORS[totalProgress.overallStatus].bg}`}>
                                        <h2 className="text-lg font-semibold text-white mb-3">
                                            📊 Общий прогресс компании
                                        </h2>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="text-center">
                                                <div className="text-slate-400 text-sm mb-1">План</div>
                                                <div className="text-white font-bold text-xl">
                                                    {formatGoalMoney(totalProgress.totalGoal)}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-slate-400 text-sm mb-1">Факт</div>
                                                <div className={`font-bold text-xl ${GOAL_STATUS_COLORS[totalProgress.overallStatus].text}`}>
                                                    {formatGoalMoney(totalProgress.totalActual)}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-slate-400 text-sm mb-1">Выполнение</div>
                                                <div className={`font-bold text-xl ${GOAL_STATUS_COLORS[totalProgress.overallStatus].text}`}>
                                                    {totalProgress.totalPercentage.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${totalProgress.overallStatus === 'achieved' ? 'bg-green-500' :
                                                    totalProgress.overallStatus === 'on_track' ? 'bg-blue-500' :
                                                        totalProgress.overallStatus === 'at_risk' ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                style={{ width: `${Math.min(100, totalProgress.totalPercentage)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Category Cards */}
                                {visibleProgress.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {visibleProgress.map(progress => (
                                            <GoalProgressCard
                                                key={progress.categoryId}
                                                progress={progress}
                                                problematicSKUs={getProblematicSKUs(skuData, progress.categoryId, 3)}
                                                onViewDetails={() => router.push(`/?category=${progress.categoryId}`)}
                                                onCreateTask={() => router.push(`/?category=${progress.categoryId}&action=createTask`)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-slate-400">
                                        <div className="text-4xl mb-4">🎯</div>
                                        <p>Цели на этот период не установлены</p>
                                        {canCreateTasks(user.role) && (
                                            <button
                                                onClick={() => setShowManageModal(true)}
                                                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                                            >
                                                Установить цели
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Tab: SKU Goals */}
                        {activeTab === 'sku' && (
                            <SKUGoalsTable skuData={skuData} />
                        )}
                    </>
                )}
            </main>

            {/* Management Modal */}
            <GoalsManagementModal
                isOpen={showManageModal}
                onClose={() => setShowManageModal(false)}
                goals={goals}
                onSave={handleSaveGoals}
                period={period}
                allowedCategories={allowedCategories}
            />
        </div>
    );
}
