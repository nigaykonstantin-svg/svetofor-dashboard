'use client';

import { useMemo } from 'react';
import { Task, TaskStatus, STATUS_CONFIG, PRIORITY_CONFIG, TASK_TYPES } from './types';

interface TaskControlPanelProps {
    tasks: Task[];
    onFilterByStatus?: (status: TaskStatus | null) => void;
    onFilterByAssignee?: (assigneeId: string | null) => void;
    onViewAllTasks?: () => void;
    onTaskClick?: (task: Task) => void;
}

// Workload bar component
function WorkloadBar({ current, max }: { current: number; max: number }) {
    const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    const getColor = () => {
        if (percentage >= 80) return 'bg-red-500';
        if (percentage >= 50) return 'bg-yellow-500';
        return 'bg-emerald-500';
    };

    return (
        <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
                className={`h-full ${getColor()} transition-all duration-300`}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}

// Stat card component
function StatCard({
    label,
    value,
    emoji,
    color,
    bgColor,
    onClick,
    highlight = false,
}: {
    label: string;
    value: number;
    emoji: string;
    color: string;
    bgColor: string;
    onClick?: () => void;
    highlight?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center p-3 rounded-xl border transition hover:scale-105 
                ${bgColor}/10 border-${bgColor.replace('bg-', '')}/30 
                ${highlight ? 'ring-2 ring-red-500 animate-pulse' : ''}
                ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="text-xl mb-0.5">{emoji}</div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-slate-400">{label}</div>
        </button>
    );
}

// Urgent task card
function UrgentTaskCard({ task, onClick }: { task: Task; onClick?: () => void }) {
    const isOverdue = task.deadline && new Date(task.deadline) < new Date();
    const priorityConfig = PRIORITY_CONFIG[task.priority];

    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-3 rounded-lg border transition hover:bg-slate-800/70 ${isOverdue
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-slate-800/50 border-slate-700'
                }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                        {TASK_TYPES[task.type]?.split(' ').slice(1).join(' ') || task.type}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                        → {task.assignee}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${priorityConfig.bgColor}/20 ${priorityConfig.color}`}>
                        {priorityConfig.label}
                    </span>
                    {task.deadline && (
                        <span className={`text-[10px] ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
                            {isOverdue ? '⚠️ ' : '⏰ '}
                            {new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}

export default function TaskControlPanel({
    tasks,
    onFilterByStatus,
    onFilterByAssignee,
    onViewAllTasks,
    onTaskClick,
}: TaskControlPanelProps) {
    const now = new Date();

    // Calculate stats
    const stats = useMemo(() => {
        const activeTasks = tasks.filter(t => t.status !== 'done');
        return {
            total: tasks.length,
            new: tasks.filter(t => t.status === 'new').length,
            inProgress: tasks.filter(t => t.status === 'in_progress').length,
            review: tasks.filter(t => t.status === 'review').length,
            done: tasks.filter(t => t.status === 'done').length,
            overdue: activeTasks.filter(t => t.deadline && new Date(t.deadline) < now).length,
            critical: activeTasks.filter(t => t.priority === 'critical').length,
        };
    }, [tasks, now]);

    // Group by assignee with workload
    const teamWorkload = useMemo(() => {
        const byAssignee: Record<string, {
            name: string;
            active: number;
            overdue: number;
            critical: number;
        }> = {};

        tasks.filter(t => t.status !== 'done').forEach(task => {
            if (!byAssignee[task.assigneeId]) {
                byAssignee[task.assigneeId] = { name: task.assignee, active: 0, overdue: 0, critical: 0 };
            }
            byAssignee[task.assigneeId].active++;
            if (task.deadline && new Date(task.deadline) < now) {
                byAssignee[task.assigneeId].overdue++;
            }
            if (task.priority === 'critical') {
                byAssignee[task.assigneeId].critical++;
            }
        });

        return Object.entries(byAssignee)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.active - a.active);
    }, [tasks, now]);

    // Get urgent tasks (overdue or critical)
    const urgentTasks = useMemo(() => {
        return tasks
            .filter(t => t.status !== 'done')
            .filter(t =>
                t.priority === 'critical' ||
                (t.deadline && new Date(t.deadline) < now)
            )
            .sort((a, b) => {
                // Overdue first
                const aOverdue = a.deadline && new Date(a.deadline) < now;
                const bOverdue = b.deadline && new Date(b.deadline) < now;
                if (aOverdue && !bOverdue) return -1;
                if (!aOverdue && bOverdue) return 1;
                // Then critical
                if (a.priority === 'critical' && b.priority !== 'critical') return -1;
                if (a.priority !== 'critical' && b.priority === 'critical') return 1;
                return 0;
            })
            .slice(0, 3);
    }, [tasks, now]);

    const maxWorkload = Math.max(...teamWorkload.map(t => t.active), 5);

    // Empty state
    if (tasks.length === 0) {
        return (
            <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    📊 Контроль задач
                </h3>
                <div className="text-center py-8 text-slate-500">
                    <div className="text-4xl mb-3">📋</div>
                    <div>Задач пока нет</div>
                    <div className="text-sm mt-1">Выберите товары и создайте задачу</div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    📊 Контроль задач
                    <span className="text-sm font-normal text-slate-500">
                        ({stats.total - stats.done} активных)
                    </span>
                </h3>
                {onViewAllTasks && (
                    <button
                        onClick={onViewAllTasks}
                        className="text-sm text-emerald-400 hover:text-emerald-300 transition"
                    >
                        Все задачи →
                    </button>
                )}
            </div>

            {/* Overdue Alert Banner */}
            {stats.overdue > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div className="flex-1">
                        <div className="text-red-400 font-semibold">
                            {stats.overdue} задач{stats.overdue > 1 ? '' : 'а'} просрочен{stats.overdue > 1 ? 'о' : 'а'}
                        </div>
                        <div className="text-xs text-red-400/70">Требует немедленного внимания</div>
                    </div>
                    <button
                        onClick={() => onFilterByStatus?.('new')}
                        className="text-xs px-3 py-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition"
                    >
                        Показать
                    </button>
                </div>
            )}

            {/* Status Cards */}
            <div className="grid grid-cols-5 gap-2 mb-4">
                <StatCard
                    label="Новых"
                    value={stats.new}
                    emoji={STATUS_CONFIG.new.emoji}
                    color={STATUS_CONFIG.new.color}
                    bgColor={STATUS_CONFIG.new.bgColor}
                    onClick={() => onFilterByStatus?.('new')}
                />
                <StatCard
                    label="В работе"
                    value={stats.inProgress}
                    emoji={STATUS_CONFIG.in_progress.emoji}
                    color={STATUS_CONFIG.in_progress.color}
                    bgColor={STATUS_CONFIG.in_progress.bgColor}
                    onClick={() => onFilterByStatus?.('in_progress')}
                />
                <StatCard
                    label="Проверка"
                    value={stats.review}
                    emoji={STATUS_CONFIG.review.emoji}
                    color={STATUS_CONFIG.review.color}
                    bgColor={STATUS_CONFIG.review.bgColor}
                    onClick={() => onFilterByStatus?.('review')}
                    highlight={stats.review > 0}
                />
                <StatCard
                    label="Готово"
                    value={stats.done}
                    emoji={STATUS_CONFIG.done.emoji}
                    color={STATUS_CONFIG.done.color}
                    bgColor={STATUS_CONFIG.done.bgColor}
                    onClick={() => onFilterByStatus?.('done')}
                />
                <StatCard
                    label="Просрочено"
                    value={stats.overdue}
                    emoji="⚠️"
                    color="text-red-400"
                    bgColor="bg-red-500"
                    highlight={stats.overdue > 0}
                />
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Team Workload */}
                {teamWorkload.length > 0 && (
                    <div>
                        <div className="text-sm text-slate-500 mb-2">👥 Загрузка команды</div>
                        <div className="space-y-2">
                            {teamWorkload.slice(0, 5).map((member) => (
                                <button
                                    key={member.id}
                                    onClick={() => onFilterByAssignee?.(member.id)}
                                    className="w-full flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 rounded-lg px-3 py-2 transition text-sm"
                                >
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span className="truncate max-w-[100px]">{member.name}</span>
                                    </span>
                                    <span className="flex items-center gap-3">
                                        <WorkloadBar current={member.active} max={maxWorkload} />
                                        <span className="text-slate-400 w-8 text-right">{member.active}</span>
                                        {member.overdue > 0 && (
                                            <span className="text-red-400 text-xs">⚠️{member.overdue}</span>
                                        )}
                                        {member.critical > 0 && (
                                            <span className="text-orange-400 text-xs">🔴{member.critical}</span>
                                        )}
                                    </span>
                                </button>
                            ))}
                            {teamWorkload.length > 5 && (
                                <div className="text-xs text-slate-500 text-center py-1">
                                    +{teamWorkload.length - 5} ещё
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Urgent Tasks */}
                {urgentTasks.length > 0 && (
                    <div>
                        <div className="text-sm text-slate-500 mb-2">🔥 Требуют внимания</div>
                        <div className="space-y-2">
                            {urgentTasks.map((task) => (
                                <UrgentTaskCard
                                    key={task.id}
                                    task={task}
                                    onClick={() => onTaskClick?.(task)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
