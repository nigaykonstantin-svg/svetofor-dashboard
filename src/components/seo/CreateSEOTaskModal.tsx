'use client';

import { useState } from 'react';
import { Task, TaskPriority, PRIORITY_CONFIG } from '@/components/tasks/types';

interface CreateSEOTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateTask: (task: Task) => void;
    selectedItems: Array<{
        sku: string;
        nmId: number | null;
        name: string;
        keyword?: string;
    }>;
    users: Array<{ id: string; name: string }>;
    currentUserId: string;
    currentUserName: string;
}

export default function CreateSEOTaskModal({
    isOpen,
    onClose,
    onCreateTask,
    selectedItems,
    users,
    currentUserId,
    currentUserName
}: CreateSEOTaskModalProps) {
    const [assigneeId, setAssigneeId] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [deadline, setDeadline] = useState('');
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!assigneeId || selectedItems.length === 0) return;

        setIsSubmitting(true);

        const assignee = users.find(u => u.id === assigneeId);

        // Create task with selected SKUs
        const task: Task = {
            id: Date.now().toString(),
            skus: selectedItems.map(item => ({
                nmId: item.nmId || 0,
                sku: item.sku,
                title: item.name
            })),
            type: 'seo',
            assignee: assignee?.name || 'Unknown',
            assigneeId,
            createdBy: currentUserId,
            createdByName: currentUserName,
            priority,
            deadline: deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            comment: comment || `SEO оптимизация: ${selectedItems.map(i => i.keyword || i.name).join(', ')}`,
            status: 'new',
            createdAt: new Date().toISOString(),
        };

        onCreateTask(task);
        setIsSubmitting(false);
        onClose();

        // Reset form
        setAssigneeId('');
        setPriority('medium');
        setDeadline('');
        setComment('');
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 rounded-2xl border border-slate-700 max-w-lg w-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-white">
                        📤 Создать SEO задачу
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Выбрано товаров: {selectedItems.length}
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    {/* Selected items preview */}
                    <div className="bg-slate-800/50 rounded-lg p-3 max-h-32 overflow-auto">
                        <div className="text-slate-400 text-xs mb-2">Товары для оптимизации:</div>
                        {selectedItems.slice(0, 5).map((item, i) => (
                            <div key={i} className="text-white text-sm truncate">
                                {item.name} <span className="text-slate-500">({item.sku})</span>
                            </div>
                        ))}
                        {selectedItems.length > 5 && (
                            <div className="text-slate-500 text-xs mt-1">
                                ...и ещё {selectedItems.length - 5}
                            </div>
                        )}
                    </div>

                    {/* Assignee */}
                    <div>
                        <label className="block text-slate-400 text-sm mb-2">Исполнитель *</label>
                        <select
                            value={assigneeId}
                            onChange={(e) => setAssigneeId(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                        >
                            <option value="">Выберите исполнителя</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="block text-slate-400 text-sm mb-2">Приоритет</label>
                        <div className="flex gap-2">
                            {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPriority(p)}
                                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${priority === p
                                            ? `${PRIORITY_CONFIG[p].bgColor} text-white`
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                >
                                    {PRIORITY_CONFIG[p].label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Deadline */}
                    <div>
                        <label className="block text-slate-400 text-sm mb-2">Дедлайн</label>
                        <input
                            type="date"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
                        />
                    </div>

                    {/* Comment */}
                    <div>
                        <label className="block text-slate-400 text-sm mb-2">Комментарий</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Инструкции для исполнителя..."
                            rows={3}
                            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!assigneeId || isSubmitting}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm"
                    >
                        {isSubmitting ? 'Создание...' : `Создать задачу (${selectedItems.length})`}
                    </button>
                </div>
            </div>
        </div>
    );
}
