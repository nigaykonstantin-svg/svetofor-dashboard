'use client';

import { Suspense, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import {
    TaskList,
    TaskDetailModal,
    TaskFilters,
    TaskControlPanel,
    useTasks,
    Task,
    TaskStatus,
    TaskPriority
} from '@/components/tasks';

// Inner component that uses useSearchParams
function TasksPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isAuthenticated, isLoading, isSuperAdmin, isCategoryManager } = useAuth();
    const { tasks, isLoaded, updateTaskStatus, deleteTask, getTasksForUser, getTaskStats } = useTasks();

    // Initialize filters from URL params
    const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(
        (searchParams.get('status') as TaskStatus) || null
    );
    const [priorityFilter, setPriorityFilter] = useState<TaskPriority | null>(
        (searchParams.get('priority') as TaskPriority) || null
    );
    const [typeFilter, setTypeFilter] = useState<string | null>(
        searchParams.get('type') || null
    );
    const [assigneeFilter, setAssigneeFilter] = useState<string | null>(
        searchParams.get('assignee') || null
    );

    // Selected task for detail modal
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    // Get tasks for current user based on role (inline to avoid callback dependency issues)
    const userTasks = useMemo(() => {
        if (!user || !isLoaded) return [];
        return tasks.filter(task => {
            if (user.role === 'super_admin') return true;
            if (user.role === 'category_manager') return task.categoryId === user.categoryId;
            if (user.role === 'manager') return task.assigneeId === user.id;
            return false;
        });
    }, [user, tasks, isLoaded]);

    // Get stats (inline calculation)
    const stats = useMemo(() => {
        const now = new Date();
        return {
            total: userTasks.length,
            new: userTasks.filter(t => t.status === 'new').length,
            inProgress: userTasks.filter(t => t.status === 'in_progress').length,
            review: userTasks.filter(t => t.status === 'review').length,
            done: userTasks.filter(t => t.status === 'done').length,
            critical: userTasks.filter(t => t.priority === 'critical' && t.status !== 'done').length,
            overdue: userTasks.filter(t => {
                if (!t.deadline || t.status === 'done') return false;
                return new Date(t.deadline) < now;
            }).length,
        };
    }, [userTasks]);

    // Get unique assignees for filter
    const assignees = useMemo(() => {
        const map = new Map<string, string>();
        userTasks.forEach(t => map.set(t.assigneeId, t.assignee));
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [userTasks]);

    // Apply filters
    const filteredTasks = useMemo(() => {
        return userTasks.filter(task => {
            if (statusFilter && task.status !== statusFilter) return false;
            if (priorityFilter && task.priority !== priorityFilter) return false;
            if (typeFilter && task.type !== typeFilter) return false;
            if (assigneeFilter && task.assigneeId !== assigneeFilter) return false;
            return true;
        });
    }, [userTasks, statusFilter, priorityFilter, typeFilter, assigneeFilter]);

    const clearFilters = () => {
        setStatusFilter(null);
        setPriorityFilter(null);
        setTypeFilter(null);
        setAssigneeFilter(null);
    };

    const handleUpdateStatus = (taskId: string, status: TaskStatus, completionComment?: string) => {
        updateTaskStatus(taskId, status, user?.id, user?.name, completionComment);
        // Update selected task if it's the one being modified
        if (selectedTask?.id === taskId) {
            const updatedTask = tasks.find(t => t.id === taskId);
            if (updatedTask) {
                setSelectedTask({ ...updatedTask, status });
            }
        }
    };

    const handleDeleteTask = (taskId: string) => {
        deleteTask(taskId);
        if (selectedTask?.id === taskId) {
            setSelectedTask(null);
        }
    };

    // Loading state
    if (isLoading || !isLoaded) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <div className="text-slate-400">Загрузка...</div>
                </div>
            </div>
        );
    }

    // Auth check
    if (!isAuthenticated || !user) {
        router.push('/login');
        return null;
    }

    const isManager = user.role === 'manager';
    const canSeeControlPanel = isSuperAdmin || isCategoryManager;

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="text-slate-400 hover:text-white transition"
                            >
                                ← Дашборд
                            </button>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                📋 {isManager ? 'Мои задачи' : 'Управление задачами'}
                            </h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-slate-400">
                                {user.name}
                            </div>
                            <div className="text-xs px-2 py-1 bg-slate-800 rounded">
                                {isSuperAdmin ? '👑 Админ' : isCategoryManager ? '👨‍💼 Категорийный' : '👤 Менеджер'}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Control Panel for Admins */}
                {canSeeControlPanel && (
                    <div className="mb-6">
                        <TaskControlPanel
                            tasks={userTasks}
                            onFilterByStatus={setStatusFilter}
                            onFilterByAssignee={setAssigneeFilter}
                        />
                    </div>
                )}

                {/* Stats Bar for Managers */}
                {isManager && (
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 text-center">
                            <div className="text-2xl font-bold text-blue-400">{stats.new}</div>
                            <div className="text-xs text-slate-500">Новых</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 text-center">
                            <div className="text-2xl font-bold text-yellow-400">{stats.inProgress}</div>
                            <div className="text-xs text-slate-500">В работе</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 text-center">
                            <div className="text-2xl font-bold text-purple-400">{stats.review}</div>
                            <div className="text-xs text-slate-500">На проверке</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 text-center">
                            <div className="text-2xl font-bold text-green-400">{stats.done}</div>
                            <div className="text-xs text-slate-500">Выполнено</div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <TaskFilters
                    statusFilter={statusFilter}
                    priorityFilter={priorityFilter}
                    typeFilter={typeFilter}
                    assigneeFilter={assigneeFilter}
                    onStatusChange={setStatusFilter}
                    onPriorityChange={setPriorityFilter}
                    onTypeChange={setTypeFilter}
                    onAssigneeChange={setAssigneeFilter}
                    onClearAll={clearFilters}
                    assignees={assignees}
                    showAssigneeFilter={canSeeControlPanel}
                />

                {/* Results info */}
                <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-slate-500">
                        Показано: {filteredTasks.length} из {userTasks.length}
                        {stats.overdue > 0 && (
                            <span className="ml-3 text-red-400">
                                ⚠️ {stats.overdue} просрочено
                            </span>
                        )}
                    </div>
                    {filteredTasks.some(t => t.status !== 'done') && (
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'done' ? null : 'done')}
                            className="text-xs text-slate-500 hover:text-white transition"
                        >
                            {statusFilter === 'done' ? 'Показать активные' : 'Показать завершённые'}
                        </button>
                    )}
                </div>

                {/* Task List */}
                <TaskList
                    tasks={filteredTasks}
                    onUpdateStatus={(taskId, status) => handleUpdateStatus(taskId, status)}
                    onDeleteTask={handleDeleteTask}
                    onTaskClick={setSelectedTask}
                />

                {/* Empty state */}
                {userTasks.length === 0 && (
                    <div className="text-center py-16">
                        <div className="text-6xl mb-4">📋</div>
                        <div className="text-xl text-slate-400 mb-2">
                            {isManager ? 'У вас пока нет задач' : 'Задачи не найдены'}
                        </div>
                        <div className="text-sm text-slate-600">
                            {isManager
                                ? 'Когда руководитель назначит вам задачу, она появится здесь'
                                : 'Создайте задачу, выбрав товары на дашборде'}
                        </div>
                        {!isManager && (
                            <button
                                onClick={() => router.push('/')}
                                className="mt-6 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                            >
                                Перейти к дашборду
                            </button>
                        )}
                    </div>
                )}
            </main>

            {/* Task Detail Modal */}
            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    isOpen={true}
                    onClose={() => setSelectedTask(null)}
                    onUpdateStatus={handleUpdateStatus}
                    onDelete={handleDeleteTask}
                />
            )}
        </div>
    );
}

// Main export with Suspense boundary
export default function TasksPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <div className="text-slate-400">Загрузка...</div>
                </div>
            </div>
        }>
            <TasksPageContent />
        </Suspense>
    );
}
