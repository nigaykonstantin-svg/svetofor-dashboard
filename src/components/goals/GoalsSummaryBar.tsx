'use client';

import { GoalProgress, GOAL_STATUS_COLORS } from '@/types/goal-types';
import { formatGoalMoney } from '@/lib/goals-utils';

interface GoalsSummaryBarProps {
    progress: GoalProgress | null;
    onManageGoals?: () => void;
    loading?: boolean;
}

export function GoalsSummaryBar({
    progress,
    onManageGoals,
    loading = false,
}: GoalsSummaryBarProps) {
    if (loading) {
        return (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-4 animate-pulse">
                <div className="flex items-center justify-center gap-4">
                    <div className="h-4 w-24 bg-slate-700 rounded" />
                    <div className="h-4 w-32 bg-slate-700 rounded" />
                    <div className="h-4 w-20 bg-slate-700 rounded" />
                </div>
            </div>
        );
    }

    if (!progress) {
        return (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">
                        🎯 Цели не установлены для этой категории
                    </span>
                    {onManageGoals && (
                        <button
                            onClick={onManageGoals}
                            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                        >
                            Установить цель
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const statusColors = GOAL_STATUS_COLORS[progress.status];
    const progressWidth = Math.min(100, progress.percentage);

    return (
        <div className={`border ${statusColors.border} ${statusColors.bg} rounded-lg p-3 mb-4`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
                {/* Goal & Progress */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm">🎯 Цель:</span>
                        <span className="text-white font-medium">
                            {formatGoalMoney(progress.goal)}
                        </span>
                    </div>

                    <div className="hidden sm:block w-px h-4 bg-slate-600" />

                    <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm">✅ Факт:</span>
                        <span className={`font-bold ${statusColors.text}`}>
                            {formatGoalMoney(progress.actual)} ({progress.percentage.toFixed(0)}%)
                        </span>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm">📅</span>
                        <span className="text-white text-sm">{progress.daysLeft} дней</span>
                    </div>

                    {progress.dailyTarget > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-sm">📈</span>
                            <span className="text-white text-sm">
                                +{formatGoalMoney(progress.dailyTarget)}/день
                            </span>
                        </div>
                    )}

                    {onManageGoals && (
                        <button
                            onClick={onManageGoals}
                            className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                        >
                            ⚙️
                        </button>
                    )}
                </div>
            </div>

            {/* Mini Progress Bar */}
            <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={`h-full transition-all duration-500 ${progress.status === 'achieved' ? 'bg-green-500' :
                            progress.status === 'on_track' ? 'bg-blue-500' :
                                progress.status === 'at_risk' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                    style={{ width: `${progressWidth}%` }}
                />
            </div>
        </div>
    );
}
