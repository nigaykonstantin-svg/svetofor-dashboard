'use client';

import { GoalProgress, GOAL_STATUS_COLORS, GOAL_STATUS_LABELS } from '@/types/goal-types';
import { CATEGORY_COLORS } from '@/lib/auth-types';
import { formatGoalMoney } from '@/lib/goals-utils';

interface GoalProgressCardProps {
    progress: GoalProgress;
    managerName?: string;
    problematicSKUs?: { sku: { sku: string; title: string }; issue: string; severity: string }[];
    onViewDetails?: () => void;
    onCreateTask?: () => void;
    compact?: boolean;
}

export function GoalProgressCard({
    progress,
    managerName,
    problematicSKUs,
    onViewDetails,
    onCreateTask,
    compact = false,
}: GoalProgressCardProps) {
    const statusColors = GOAL_STATUS_COLORS[progress.status];
    const categoryColor = CATEGORY_COLORS[progress.categoryId] || 'bg-slate-500';

    // Calculate progress bar width (cap at 100% for display)
    const progressWidth = Math.min(100, progress.percentage);

    // Determine progress bar color based on status
    const progressBarColor = {
        achieved: 'bg-green-500',
        on_track: 'bg-blue-500',
        at_risk: 'bg-yellow-500',
        behind: 'bg-red-500',
    }[progress.status];

    // Forecast status
    const forecastStatus = progress.projectedPercentage >= 100 ? 'good'
        : progress.projectedPercentage >= 80 ? 'warning'
            : 'danger';

    if (compact) {
        return (
            <div className={`rounded-lg border ${statusColors.border} ${statusColors.bg} p-3`}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${categoryColor}`} />
                        <span className="font-medium text-white text-sm">{progress.categoryName}</span>
                    </div>
                    <span className={`text-sm font-bold ${statusColors.text}`}>
                        {progress.percentage.toFixed(0)}%
                    </span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${progressBarColor} transition-all duration-500`}
                        style={{ width: `${progressWidth}%` }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-xl border ${statusColors.border} bg-slate-800/50 p-4`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${categoryColor}`} />
                    <span className="font-semibold text-white text-lg">
                        🎯 {progress.categoryName}
                    </span>
                </div>
                {managerName && (
                    <span className="text-slate-400 text-sm">{managerName}</span>
                )}
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                    <span className={`text-sm font-bold ${statusColors.text}`}>
                        {progress.percentage.toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-400">
                        {GOAL_STATUS_LABELS[progress.status]}
                    </span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${progressBarColor} transition-all duration-500`}
                        style={{ width: `${progressWidth}%` }}
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">План</div>
                    <div className="text-white font-medium text-sm">
                        {formatGoalMoney(progress.goal)}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Факт</div>
                    <div className={`font-medium text-sm ${statusColors.text}`}>
                        {formatGoalMoney(progress.actual)}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Осталось</div>
                    <div className="text-white font-medium text-sm">
                        {progress.remaining > 0 ? formatGoalMoney(progress.remaining) : '✅'}
                    </div>
                </div>
            </div>

            {/* Forecast Section */}
            <div className={`mb-4 p-3 rounded-lg ${forecastStatus === 'good' ? 'bg-green-500/10 border border-green-500/30' :
                    forecastStatus === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                        'bg-red-500/10 border border-red-500/30'
                }`}>
                <div className="text-xs text-slate-400 mb-1">📊 Прогноз на конец месяца</div>
                <div className="flex items-center justify-between">
                    <span className={`font-bold ${forecastStatus === 'good' ? 'text-green-400' :
                            forecastStatus === 'warning' ? 'text-yellow-400' :
                                'text-red-400'
                        }`}>
                        {formatGoalMoney(progress.projectedTotal)} ({progress.projectedPercentage}%)
                    </span>
                    <span className="text-xs text-slate-400">
                        {progress.dailyAverage > 0 && `~${formatGoalMoney(progress.dailyAverage)}/день`}
                    </span>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-slate-400 mb-3 pb-3 border-b border-slate-700">
                <span>📅 {progress.daysLeft} дней осталось</span>
                <span>
                    {progress.dailyTarget > 0
                        ? `📈 Нужно +${formatGoalMoney(progress.dailyTarget)}/день`
                        : '✅ Выполнено!'}
                </span>
                <span>
                    {progress.trend === 'up' && '📈 Рост'}
                    {progress.trend === 'down' && '📉 Спад'}
                    {progress.trend === 'stable' && '➡️ Стабильно'}
                </span>
            </div>

            {/* Problematic SKUs */}
            {problematicSKUs && problematicSKUs.length > 0 && (
                <div className="mb-3 pb-3 border-b border-slate-700">
                    <div className="text-xs text-slate-400 mb-2">⚠️ Требуют внимания:</div>
                    <div className="space-y-1">
                        {problematicSKUs.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                                <span className="text-white truncate max-w-[150px]" title={item.sku.title}>
                                    {item.sku.sku}
                                </span>
                                <span className={
                                    item.severity === 'high' ? 'text-red-400' :
                                        item.severity === 'medium' ? 'text-yellow-400' :
                                            'text-slate-400'
                                }>
                                    {item.issue}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                {onViewDetails && (
                    <button
                        onClick={onViewDetails}
                        className="flex-1 px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                        📋 Топ SKU для роста
                    </button>
                )}
                {onCreateTask && (
                    <button
                        onClick={onCreateTask}
                        className="flex-1 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                    >
                        📝 Поставить задачу
                    </button>
                )}
            </div>
        </div>
    );
}
