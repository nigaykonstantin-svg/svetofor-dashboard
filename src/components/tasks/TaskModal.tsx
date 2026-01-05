'use client';

import { useState, useEffect } from 'react';
import { Task, TaskSKU, TASK_TYPES } from './types';
import { useAuth } from '@/lib/useAuth';
import { getAvailableManagers, getUserById } from '@/lib/team-data';
import { User, CATEGORY_LABELS, Category } from '@/lib/auth-types';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedSKUs: TaskSKU[];
    onCreateTask: (task: Task) => void;
}

export default function TaskModal({
    isOpen,
    onClose,
    selectedSKUs,
    onCreateTask,
}: TaskModalProps) {
    const { user, canCreateTasks, isSuperAdmin, isCategoryManager } = useAuth();
    const [availableManagers, setAvailableManagers] = useState<User[]>([]);

    const [taskForm, setTaskForm] = useState({
        type: 'optimize',
        assigneeId: '',
        deadline: '',
        comment: '',
        priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    });

    // Load available managers based on current user's role
    useEffect(() => {
        if (user && isOpen) {
            const managers = getAvailableManagers(user as User);
            setAvailableManagers(managers);
            // Auto-select first manager if only one available
            if (managers.length === 1) {
                setTaskForm(prev => ({ ...prev, assigneeId: managers[0].id }));
            }
        }
    }, [user, isOpen]);

    if (!isOpen) return null;

    // Check if user can create tasks
    if (!canCreateTasks) {
        return (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 rounded-xl p-8 border border-slate-700 text-center">
                    <div className="text-4xl mb-4">🚫</div>
                    <div className="text-white text-lg mb-2">Недостаточно прав</div>
                    <p className="text-slate-400 mb-4">Только руководители могут создавать задачи</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                    >
                        Закрыть
                    </button>
                </div>
            </div>
        );
    }

    const handleCreate = () => {
        if (!taskForm.assigneeId) return;

        const assignee = getUserById(taskForm.assigneeId);

        const newTask: Task = {
            id: Date.now().toString(),
            skus: selectedSKUs,
            type: taskForm.type,
            assignee: assignee?.name || '',
            assigneeId: taskForm.assigneeId,
            createdBy: user?.id || '',
            createdByName: user?.name || '',
            categoryId: assignee?.categoryId,
            priority: taskForm.priority,
            deadline: taskForm.deadline,
            comment: taskForm.comment,
            status: 'new',
            createdAt: new Date().toISOString(),
        };

        onCreateTask(newTask);
        setTaskForm({ type: 'optimize', assigneeId: '', deadline: '', comment: '', priority: 'medium' });
        onClose();
    };

    const PRIORITY_OPTIONS = [
        { value: 'low', label: '🟢 Низкий', color: 'bg-green-500' },
        { value: 'medium', label: '🟡 Средний', color: 'bg-yellow-500' },
        { value: 'high', label: '🟠 Высокий', color: 'bg-orange-500' },
        { value: 'critical', label: '🔴 Критичный', color: 'bg-red-500' },
    ];

    // Group managers by category for super admin
    const managersByCategory = isSuperAdmin
        ? availableManagers.reduce((acc, m) => {
            const cat = m.categoryId || 'other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(m);
            return acc;
        }, {} as Record<string, User[]>)
        : null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-xl w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-700 sticky top-0 bg-slate-900">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span>📤</span> Создать задачу
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Выбрано товаров: <span className="text-white font-semibold">{selectedSKUs.length}</span>
                        {user?.categoryId && (
                            <span className="ml-2 text-emerald-400">
                                • {CATEGORY_LABELS[user.categoryId as Category]}
                            </span>
                        )}
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    {/* Task Type */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Тип задачи</label>
                        <select
                            value={taskForm.type}
                            onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
                        >
                            {Object.entries(TASK_TYPES).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Assignee Selector */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">
                            Исполнитель
                            {isCategoryManager && (
                                <span className="ml-2 text-xs text-slate-500">(ваша команда)</span>
                            )}
                        </label>
                        <select
                            value={taskForm.assigneeId}
                            onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
                        >
                            <option value="">Выберите менеджера...</option>

                            {isSuperAdmin && managersByCategory ? (
                                // Super admin sees managers grouped by category
                                Object.entries(managersByCategory).map(([cat, managers]) => (
                                    <optgroup key={cat} label={CATEGORY_LABELS[cat as Category] || cat}>
                                        {managers.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </optgroup>
                                ))
                            ) : (
                                // Category manager sees their managers
                                availableManagers.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))
                            )}
                        </select>

                        {availableManagers.length === 0 && (
                            <p className="text-xs text-red-400 mt-1">У вас нет доступных менеджеров</p>
                        )}
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Приоритет</label>
                        <div className="grid grid-cols-4 gap-2">
                            {PRIORITY_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setTaskForm({ ...taskForm, priority: opt.value as typeof taskForm.priority })}
                                    className={`px-3 py-2 rounded-lg text-sm transition ${taskForm.priority === opt.value
                                            ? `${opt.color} text-white`
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Deadline */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Срок выполнения</label>
                        <input
                            type="date"
                            value={taskForm.deadline}
                            onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
                        />
                    </div>

                    {/* Comment */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Комментарий</label>
                        <textarea
                            placeholder="Инструкции для исполнителя..."
                            value={taskForm.comment}
                            onChange={(e) => setTaskForm({ ...taskForm, comment: e.target.value })}
                            rows={3}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 resize-none"
                        />
                    </div>

                    {/* Selected SKUs preview */}
                    <div className="bg-slate-800/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                        <div className="text-xs text-slate-500 mb-2">Товары в задаче:</div>
                        <div className="space-y-1">
                            {selectedSKUs.slice(0, 5).map((s) => (
                                <div key={s.nmId} className="text-sm truncate">
                                    <span className="text-slate-500">{s.sku}</span>
                                    <span className="ml-2">{s.title}</span>
                                </div>
                            ))}
                            {selectedSKUs.length > 5 && (
                                <div className="text-xs text-slate-500">...и ещё {selectedSKUs.length - 5} товаров</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-700 flex gap-3 justify-end sticky bottom-0 bg-slate-900">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!taskForm.assigneeId}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Создать задачу
                    </button>
                </div>
            </div>
        </div>
    );
}
