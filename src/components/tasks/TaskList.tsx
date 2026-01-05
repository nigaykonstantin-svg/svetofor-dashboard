'use client';

import { Task, TASK_TYPES } from './types';

interface TaskListProps {
    tasks: Task[];
    onUpdateStatus: (taskId: string, status: Task['status']) => void;
    onDeleteTask: (taskId: string) => void;
}

export default function TaskList({
    tasks,
    onUpdateStatus,
    onDeleteTask,
}: TaskListProps) {
    if (tasks.length === 0) return null;

    const getStatusColor = (status: Task['status']) => {
        switch (status) {
            case 'new': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'in_progress': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'done': return 'bg-green-500/20 text-green-400 border-green-500/30';
        }
    };

    const getStatusLabel = (status: Task['status']) => {
        switch (status) {
            case 'new': return '📋 Новая';
            case 'in_progress': return '⏳ В работе';
            case 'done': return '✅ Готово';
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
        });
    };

    const isOverdue = (deadline: string) => {
        if (!deadline) return false;
        return new Date(deadline) < new Date();
    };

    return (
        <div className="bg-slate-900 rounded-xl p-4 mb-6">
            <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <span>📋</span> Задачи ({tasks.length})
            </h2>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {tasks.map((task) => (
                    <div
                        key={task.id}
                        className={`rounded-lg border p-4 ${getStatusColor(task.status)}`}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-2">
                            <div className="text-sm font-medium">
                                {TASK_TYPES[task.type] || task.type}
                            </div>
                            <button
                                onClick={() => onDeleteTask(task.id)}
                                className="text-slate-500 hover:text-red-400 transition text-xs"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Assignee */}
                        <div className="text-white font-semibold mb-1">
                            → {task.assignee}
                        </div>

                        {/* SKU count */}
                        <div className="text-xs opacity-70 mb-2">
                            {task.skus.length} товар{task.skus.length > 1 ? 'ов' : ''}
                        </div>

                        {/* Comment preview */}
                        {task.comment && (
                            <div className="text-xs opacity-60 truncate mb-2">
                                "{task.comment}"
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-current/20">
                            {/* Deadline */}
                            {task.deadline && (
                                <div className={`text-xs ${isOverdue(task.deadline) && task.status !== 'done' ? 'text-red-400' : ''}`}>
                                    ⏰ {formatDate(task.deadline)}
                                    {isOverdue(task.deadline) && task.status !== 'done' && ' !'}
                                </div>
                            )}

                            {/* Status buttons */}
                            <div className="flex gap-1">
                                {task.status === 'new' && (
                                    <button
                                        onClick={() => onUpdateStatus(task.id, 'in_progress')}
                                        className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition"
                                    >
                                        Взять в работу
                                    </button>
                                )}
                                {task.status === 'in_progress' && (
                                    <button
                                        onClick={() => onUpdateStatus(task.id, 'done')}
                                        className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition"
                                    >
                                        Завершить
                                    </button>
                                )}
                                {task.status === 'done' && (
                                    <span className="text-xs opacity-50">
                                        {getStatusLabel(task.status)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
