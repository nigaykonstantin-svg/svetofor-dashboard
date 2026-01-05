'use client';

import { useState } from 'react';
import { Task, TASK_TYPES, TaskStatus, STATUS_CONFIG, PRIORITY_CONFIG } from './types';
import { useAuth } from '@/lib/useAuth';

interface TaskDetailModalProps {
    task: Task;
    isOpen: boolean;
    onClose: () => void;
    onUpdateStatus: (taskId: string, status: TaskStatus, completionComment?: string) => void;
    onDelete: (taskId: string) => void;
}

export default function TaskDetailModal({
    task,
    isOpen,
    onClose,
    onUpdateStatus,
    onDelete,
}: TaskDetailModalProps) {
    const { user, isSuperAdmin, isCategoryManager } = useAuth();
    const [completionComment, setCompletionComment] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    if (!isOpen) return null;

    const isAssignee = user?.id === task.assigneeId;
    const isCreator = user?.id === task.createdBy;
    const canManage = isSuperAdmin || isCategoryManager || isCreator;
    const canChangeStatus = isAssignee || canManage;

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const formatDateTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const isOverdue = task.deadline && task.status !== 'done' && new Date(task.deadline) < new Date();

    const handleStatusChange = (newStatus: TaskStatus) => {
        if (newStatus === 'done' || newStatus === 'review') {
            onUpdateStatus(task.id, newStatus, completionComment || undefined);
        } else {
            onUpdateStatus(task.id, newStatus);
        }
        if (newStatus === 'done') {
            onClose();
        }
    };

    const handleDelete = () => {
        if (confirmDelete) {
            onDelete(task.id);
            onClose();
        } else {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 3000);
        }
    };

    const statusConfig = STATUS_CONFIG[task.status];
    const priorityConfig = PRIORITY_CONFIG[task.priority];

    // Available status transitions
    const getNextStatuses = (): TaskStatus[] => {
        switch (task.status) {
            case 'new': return ['in_progress'];
            case 'in_progress': return ['review', 'done'];
            case 'review': return ['done', 'in_progress'];
            case 'done': return [];
        }
    };

    const nextStatuses = getNextStatuses();

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-xl w-full max-w-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="text-lg font-bold flex items-center gap-2">
                                {TASK_TYPES[task.type] || task.type}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${statusConfig.color} ${statusConfig.bgColor}/20`}>
                                    {statusConfig.emoji} {statusConfig.label}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${priorityConfig.color} ${priorityConfig.bgColor}/20`}>
                                    {priorityConfig.label}
                                </span>
                                {isOverdue && (
                                    <span className="px-2 py-1 rounded text-xs font-medium text-red-400 bg-red-500/20">
                                        ⚠️ Просрочено
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition p-2"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Assignment Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-sm text-slate-500 mb-1">Исполнитель</div>
                            <div className="font-medium">{task.assignee}</div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-500 mb-1">Постановщик</div>
                            <div className="font-medium">{task.createdByName}</div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-500 mb-1">Создано</div>
                            <div>{formatDate(task.createdAt)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-500 mb-1">Срок</div>
                            <div className={isOverdue ? 'text-red-400 font-medium' : ''}>
                                {task.deadline ? formatDate(task.deadline) : 'Не указан'}
                                {isOverdue && ' ⚠️'}
                            </div>
                        </div>
                    </div>

                    {/* Comment */}
                    {task.comment && (
                        <div>
                            <div className="text-sm text-slate-500 mb-2">Инструкции</div>
                            <div className="bg-slate-800 rounded-lg p-4 text-sm">
                                {task.comment}
                            </div>
                        </div>
                    )}

                    {/* Completion Comment */}
                    {task.completionComment && (
                        <div>
                            <div className="text-sm text-slate-500 mb-2">Комментарий исполнителя</div>
                            <div className="bg-emerald-900/30 border border-emerald-700/30 rounded-lg p-4 text-sm">
                                {task.completionComment}
                            </div>
                        </div>
                    )}

                    {/* SKUs */}
                    <div>
                        <div className="text-sm text-slate-500 mb-2">
                            Товары ({task.skus.length})
                        </div>
                        <div className="bg-slate-800 rounded-lg max-h-40 overflow-y-auto">
                            {task.skus.map((sku) => (
                                <div
                                    key={sku.nmId}
                                    className="px-4 py-2 border-b border-slate-700 last:border-0 flex items-center gap-3"
                                >
                                    <span className="text-slate-500 font-mono text-sm">{sku.sku}</span>
                                    <span className="truncate">{sku.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Status Change with Comment */}
                    {canChangeStatus && nextStatuses.length > 0 && (
                        <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                            <div className="text-sm text-slate-400">Изменить статус</div>

                            {(task.status === 'in_progress' || task.status === 'review') && (
                                <textarea
                                    placeholder="Комментарий при завершении (опционально)..."
                                    value={completionComment}
                                    onChange={(e) => setCompletionComment(e.target.value)}
                                    rows={2}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none"
                                />
                            )}

                            <div className="flex gap-2 flex-wrap">
                                {nextStatuses.map((status) => {
                                    const config = STATUS_CONFIG[status];
                                    return (
                                        <button
                                            key={status}
                                            onClick={() => handleStatusChange(status)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${config.bgColor} hover:opacity-80`}
                                        >
                                            {config.emoji} {status === 'in_progress' ? 'Вернуть в работу' : config.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* History */}
                    {task.history && task.history.length > 0 && (
                        <div>
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="text-sm text-slate-400 hover:text-white transition flex items-center gap-2"
                            >
                                📜 История изменений ({task.history.length})
                                <span>{showHistory ? '▼' : '▶'}</span>
                            </button>

                            {showHistory && (
                                <div className="mt-3 space-y-2">
                                    {task.history.slice().reverse().map((entry) => (
                                        <div
                                            key={entry.id}
                                            className="bg-slate-800/50 rounded-lg px-4 py-2 text-sm flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-500">
                                                    {entry.action === 'created' && '🆕'}
                                                    {entry.action === 'status_changed' && '🔄'}
                                                    {entry.action === 'comment_added' && '💬'}
                                                </span>
                                                <span>
                                                    {entry.action === 'created' && 'Задача создана'}
                                                    {entry.action === 'status_changed' && (
                                                        <>
                                                            {entry.fromStatus && STATUS_CONFIG[entry.fromStatus]?.emoji}
                                                            →
                                                            {entry.toStatus && STATUS_CONFIG[entry.toStatus]?.emoji}
                                                            {' '}
                                                            {entry.toStatus && STATUS_CONFIG[entry.toStatus]?.label}
                                                        </>
                                                    )}
                                                </span>
                                                <span className="text-slate-500">—</span>
                                                <span className="text-slate-400">{entry.userName}</span>
                                            </div>
                                            <span className="text-slate-500 text-xs">
                                                {formatDateTime(entry.timestamp)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 flex gap-3 justify-between sticky bottom-0 bg-slate-900">
                    {canManage && (
                        <button
                            onClick={handleDelete}
                            className={`px-4 py-2 rounded-lg transition text-sm ${confirmDelete
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-slate-700 hover:bg-slate-600 text-red-400'
                                }`}
                        >
                            {confirmDelete ? 'Подтвердить удаление' : '🗑️ Удалить'}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition ml-auto"
                    >
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
}
