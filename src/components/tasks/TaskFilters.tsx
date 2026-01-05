'use client';

import { TaskStatus, STATUS_CONFIG, TaskPriority, PRIORITY_CONFIG, TASK_TYPES } from './types';

interface TaskFiltersProps {
    statusFilter: TaskStatus | null;
    priorityFilter: TaskPriority | null;
    typeFilter: string | null;
    assigneeFilter: string | null;
    onStatusChange: (status: TaskStatus | null) => void;
    onPriorityChange: (priority: TaskPriority | null) => void;
    onTypeChange: (type: string | null) => void;
    onAssigneeChange: (assigneeId: string | null) => void;
    onClearAll: () => void;
    assignees?: { id: string; name: string }[];
    showAssigneeFilter?: boolean;
}

export default function TaskFilters({
    statusFilter,
    priorityFilter,
    typeFilter,
    assigneeFilter,
    onStatusChange,
    onPriorityChange,
    onTypeChange,
    onAssigneeChange,
    onClearAll,
    assignees = [],
    showAssigneeFilter = true,
}: TaskFiltersProps) {
    const hasFilters = statusFilter || priorityFilter || typeFilter || assigneeFilter;

    return (
        <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-slate-400">Фильтры</div>
                {hasFilters && (
                    <button
                        onClick={onClearAll}
                        className="text-xs text-slate-500 hover:text-white transition"
                    >
                        Сбросить все
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-3">
                {/* Status Filter */}
                <div className="flex gap-1">
                    <button
                        onClick={() => onStatusChange(null)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition ${!statusFilter
                                ? 'bg-slate-600 text-white'
                                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                            }`}
                    >
                        Все статусы
                    </button>
                    {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG[TaskStatus]][]).map(([status, config]) => (
                        <button
                            key={status}
                            onClick={() => onStatusChange(statusFilter === status ? null : status)}
                            className={`px-3 py-1.5 rounded-lg text-xs transition ${statusFilter === status
                                    ? `${config.bgColor} text-white`
                                    : `${config.bgColor}/20 ${config.color} hover:${config.bgColor}/40`
                                }`}
                        >
                            {config.emoji} {config.label}
                        </button>
                    ))}
                </div>

                {/* Priority Filter */}
                <div className="flex gap-1">
                    {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG[TaskPriority]][]).map(([priority, config]) => (
                        <button
                            key={priority}
                            onClick={() => onPriorityChange(priorityFilter === priority ? null : priority)}
                            className={`px-3 py-1.5 rounded-lg text-xs transition ${priorityFilter === priority
                                    ? `${config.bgColor} text-white`
                                    : `bg-slate-700/50 ${config.color} hover:bg-slate-700`
                                }`}
                        >
                            {config.label}
                        </button>
                    ))}
                </div>

                {/* Type Filter */}
                <select
                    value={typeFilter || ''}
                    onChange={(e) => onTypeChange(e.target.value || null)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                >
                    <option value="">Все типы</option>
                    {Object.entries(TASK_TYPES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>

                {/* Assignee Filter */}
                {showAssigneeFilter && assignees.length > 0 && (
                    <select
                        value={assigneeFilter || ''}
                        onChange={(e) => onAssigneeChange(e.target.value || null)}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                    >
                        <option value="">Все исполнители</option>
                        {assignees.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                )}
            </div>
        </div>
    );
}
