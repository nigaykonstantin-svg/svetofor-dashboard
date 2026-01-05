'use client';

import { Task, TaskStatus, STATUS_CONFIG, PRIORITY_CONFIG, TaskPriority } from './types';

interface TaskControlPanelProps {
    tasks: Task[];
    onFilterByStatus?: (status: TaskStatus | null) => void;
    onFilterByAssignee?: (assigneeId: string | null) => void;
    onViewAllTasks?: () => void;
}

interface StatCardProps {
    label: string;
    value: number;
    emoji: string;
    color: string;
    bgColor: string;
    onClick?: () => void;
}

function StatCard({ label, value, emoji, color, bgColor, onClick }: StatCardProps) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center p-4 rounded-xl border transition hover:scale-105 ${bgColor}/10 border-${bgColor.replace('bg-', '')}/30 ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="text-2xl mb-1">{emoji}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate-400 mt-1">{label}</div>
        </button>
    );
}

export default function TaskControlPanel({
    tasks,
    onFilterByStatus,
    onFilterByAssignee,
    onViewAllTasks,
}: TaskControlPanelProps) {
    // Calculate stats
    const activeTasks = tasks.filter(t => t.status !== 'done');
    const now = new Date();

    const stats = {
        total: tasks.length,
        new: tasks.filter(t => t.status === 'new').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        review: tasks.filter(t => t.status === 'review').length,
        done: tasks.filter(t => t.status === 'done').length,
    };

    const alerts = {
        overdue: activeTasks.filter(t => t.deadline && new Date(t.deadline) < now).length,
        critical: activeTasks.filter(t => t.priority === 'critical').length,
        high: activeTasks.filter(t => t.priority === 'high').length,
    };

    // Group by assignee
    const byAssignee: Record<string, { name: string; active: number; overdue: number }> = {};
    activeTasks.forEach(task => {
        if (!byAssignee[task.assigneeId]) {
            byAssignee[task.assigneeId] = { name: task.assignee, active: 0, overdue: 0 };
        }
        byAssignee[task.assigneeId].active++;
        if (task.deadline && new Date(task.deadline) < now) {
            byAssignee[task.assigneeId].overdue++;
        }
    });

    const assigneeList = Object.entries(byAssignee)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.active - a.active);

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
        <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    📊 Контроль задач
                    <span className="text-sm font-normal text-slate-500">
                        ({activeTasks.length} активных)
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

            {/* Status Cards */}
            <div className="grid grid-cols-4 gap-3 mb-4">
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
                    label="На проверке"
                    value={stats.review}
                    emoji={STATUS_CONFIG.review.emoji}
                    color={STATUS_CONFIG.review.color}
                    bgColor={STATUS_CONFIG.review.bgColor}
                    onClick={() => onFilterByStatus?.('review')}
                />
                <StatCard
                    label="Выполнено"
                    value={stats.done}
                    emoji={STATUS_CONFIG.done.emoji}
                    color={STATUS_CONFIG.done.color}
                    bgColor={STATUS_CONFIG.done.bgColor}
                    onClick={() => onFilterByStatus?.('done')}
                />
            </div>

            {/* Alerts */}
            {(alerts.overdue > 0 || alerts.critical > 0) && (
                <div className="flex gap-3 mb-4">
                    {alerts.overdue > 0 && (
                        <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div>
                                <div className="text-red-400 font-semibold">{alerts.overdue} просрочено</div>
                                <div className="text-xs text-red-400/70">Требует внимания</div>
                            </div>
                        </div>
                    )}
                    {alerts.critical > 0 && (
                        <div className="flex-1 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 flex items-center gap-3">
                            <span className="text-2xl">🔴</span>
                            <div>
                                <div className="text-orange-400 font-semibold">{alerts.critical} критичных</div>
                                <div className="text-xs text-orange-400/70">Высокий приоритет</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* By Assignee */}
            {assigneeList.length > 0 && (
                <div>
                    <div className="text-sm text-slate-500 mb-2">По исполнителям</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                        {assigneeList.slice(0, 5).map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onFilterByAssignee?.(item.id)}
                                className="w-full flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 rounded-lg px-3 py-2 transition text-sm"
                            >
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    {item.name}
                                </span>
                                <span className="flex items-center gap-3">
                                    <span className="text-slate-400">{item.active} задач</span>
                                    {item.overdue > 0 && (
                                        <span className="text-red-400 text-xs bg-red-500/20 px-2 py-0.5 rounded">
                                            {item.overdue} просрочено
                                        </span>
                                    )}
                                </span>
                            </button>
                        ))}
                        {assigneeList.length > 5 && (
                            <div className="text-xs text-slate-500 text-center py-1">
                                ...и ещё {assigneeList.length - 5} исполнителей
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
