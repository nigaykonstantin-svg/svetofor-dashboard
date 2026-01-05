'use client';

import { Task, TASK_TYPES, STATUS_CONFIG, PRIORITY_CONFIG } from './types';

interface TaskListProps {
    tasks: Task[];
    onUpdateStatus: (taskId: string, status: Task['status']) => void;
    onDeleteTask: (taskId: string) => void;
    onTaskClick?: (task: Task) => void;
    compact?: boolean;
}

export default function TaskList({
    tasks,
    onUpdateStatus,
    onDeleteTask,
    onTaskClick,
    compact = false,
}: TaskListProps) {
    if (tasks.length === 0) {
        return (
            <div className="bg-slate-900/50 rounded-xl p-8 text-center">
                <div className="text-4xl mb-3">📋</div>
                <div className="text-slate-400">Нет задач</div>
            </div>
        );
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
        });
    };

    const isOverdue = (deadline: string, status: Task['status']) => {
        if (!deadline || status === 'done') return false;
        return new Date(deadline) < new Date();
    };

    // Sort by priority and deadline
    const sortedTasks = [...tasks].sort((a, b) => {
        // Done tasks to the end
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;

        // Overdue first
        const aOverdue = isOverdue(a.deadline, a.status);
        const bOverdue = isOverdue(b.deadline, b.status);
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;

        // Then by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // Then by deadline
        if (a.deadline && b.deadline) {
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        return 0;
    });

    if (compact) {
        return (
            <div className="space-y-2">
                {sortedTasks.slice(0, 5).map((task) => {
                    const statusConfig = STATUS_CONFIG[task.status];
                    const priorityConfig = PRIORITY_CONFIG[task.priority];
                    const overdue = isOverdue(task.deadline, task.status);

                    return (
                        <button
                            key={task.id}
                            onClick={() => onTaskClick?.(task)}
                            className="w-full bg-slate-800/50 hover:bg-slate-800 rounded-lg p-3 text-left transition flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-lg">{statusConfig.emoji}</span>
                                <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">
                                        {TASK_TYPES[task.type]?.split(' ').slice(1).join(' ') || task.type}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">
                                        → {task.assignee}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {overdue && (
                                    <span className="text-red-400 text-xs">⚠️</span>
                                )}
                                {task.priority === 'critical' && (
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                )}
                            </div>
                        </button>
                    );
                })}
                {tasks.length > 5 && (
                    <div className="text-xs text-slate-500 text-center py-2">
                        +{tasks.length - 5} ещё
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {sortedTasks.map((task) => {
                const statusConfig = STATUS_CONFIG[task.status];
                const priorityConfig = PRIORITY_CONFIG[task.priority];
                const overdue = isOverdue(task.deadline, task.status);

                return (
                    <div
                        key={task.id}
                        onClick={() => onTaskClick?.(task)}
                        className={`rounded-xl border p-4 transition cursor-pointer hover:scale-[1.02] ${task.status === 'done'
                                ? 'bg-slate-800/30 border-slate-700/50 opacity-60'
                                : overdue
                                    ? 'bg-red-500/10 border-red-500/30'
                                    : `${statusConfig.bgColor}/10 border-${statusConfig.bgColor.replace('bg-', '')}/30`
                            }`}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.bgColor}/20 ${statusConfig.color}`}>
                                    {statusConfig.emoji} {statusConfig.label}
                                </span>
                                {task.priority !== 'medium' && (
                                    <span className={`px-2 py-0.5 rounded text-xs ${priorityConfig.bgColor}/20 ${priorityConfig.color}`}>
                                        {priorityConfig.label}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteTask(task.id);
                                }}
                                className="text-slate-500 hover:text-red-400 transition text-xs p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Type */}
                        <div className="text-sm font-medium mb-1">
                            {TASK_TYPES[task.type] || task.type}
                        </div>

                        {/* Assignee */}
                        <div className="text-white font-semibold mb-1">
                            → {task.assignee}
                        </div>

                        {/* SKU count */}
                        <div className="text-xs text-slate-500 mb-2">
                            {task.skus.length} товар{task.skus.length > 1 ? 'ов' : ''}
                            {task.skus.length === 1 && task.skus[0]?.sku && (
                                <span className="ml-1 text-slate-600">({task.skus[0].sku})</span>
                            )}
                        </div>

                        {/* Comment preview */}
                        {task.comment && (
                            <div className="text-xs text-slate-500 truncate mb-2 italic">
                                "{task.comment}"
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-current/10">
                            {/* Deadline */}
                            {task.deadline ? (
                                <div className={`text-xs flex items-center gap-1 ${overdue ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
                                    ⏰ {formatDate(task.deadline)}
                                    {overdue && ' !'}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-600">Без срока</div>
                            )}

                            {/* Quick Status buttons */}
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                {task.status === 'new' && (
                                    <button
                                        onClick={() => onUpdateStatus(task.id, 'in_progress')}
                                        className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition"
                                    >
                                        Взять
                                    </button>
                                )}
                                {task.status === 'in_progress' && (
                                    <>
                                        <button
                                            onClick={() => onUpdateStatus(task.id, 'review')}
                                            className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition"
                                        >
                                            На проверку
                                        </button>
                                        <button
                                            onClick={() => onUpdateStatus(task.id, 'done')}
                                            className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition"
                                        >
                                            Готово
                                        </button>
                                    </>
                                )}
                                {task.status === 'review' && (
                                    <button
                                        onClick={() => onUpdateStatus(task.id, 'done')}
                                        className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition"
                                    >
                                        ✓ Принять
                                    </button>
                                )}
                                {task.status === 'done' && (
                                    <span className="text-xs text-slate-500">
                                        ✅ Выполнено
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
