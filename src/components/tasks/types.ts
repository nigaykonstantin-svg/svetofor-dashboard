'use client';

import { useState, useEffect, useCallback } from 'react';

// Task type labels
export const TASK_TYPES: Record<string, string> = {
    optimize: '🎯 Оптимизировать карточку',
    price_down: '📉 Снизить цену',
    price_up: '📈 Повысить цену',
    restock: '📦 Заказать поставку',
    ads: '📢 Проверить рекламу',
    photo: '📷 Обновить фото',
    other: '📝 Другое',
};

// Priority type
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
    low: { label: 'Низкий', color: 'text-green-400', bgColor: 'bg-green-500' },
    medium: { label: 'Средний', color: 'text-yellow-400', bgColor: 'bg-yellow-500' },
    high: { label: 'Высокий', color: 'text-orange-400', bgColor: 'bg-orange-500' },
    critical: { label: 'Критичный', color: 'text-red-400', bgColor: 'bg-red-500' },
};

// Task history entry for audit log
export interface TaskHistoryEntry {
    id: string;
    action: 'created' | 'status_changed' | 'comment_added' | 'reassigned';
    fromStatus?: TaskStatus;
    toStatus?: TaskStatus;
    comment?: string;
    userId: string;
    userName: string;
    timestamp: string;
}

// Task status type
export type TaskStatus = 'new' | 'in_progress' | 'review' | 'done';

// Status configuration
export const STATUS_CONFIG: Record<TaskStatus, { label: string; emoji: string; color: string; bgColor: string }> = {
    new: { label: 'Новая', emoji: '📋', color: 'text-blue-400', bgColor: 'bg-blue-500' },
    in_progress: { label: 'В работе', emoji: '⏳', color: 'text-yellow-400', bgColor: 'bg-yellow-500' },
    review: { label: 'На проверке', emoji: '🔍', color: 'text-purple-400', bgColor: 'bg-purple-500' },
    done: { label: 'Выполнено', emoji: '✅', color: 'text-green-400', bgColor: 'bg-green-500' },
};

// Task interface
export interface Task {
    id: string;
    skus: TaskSKU[];
    type: string;
    // Assignment
    assignee: string;         // Display name
    assigneeId: string;       // User ID
    createdBy: string;        // Creator User ID
    createdByName: string;    // Creator display name
    // Categorization
    categoryId?: string;      // Category of assigned manager
    priority: TaskPriority;
    // Content
    deadline: string;
    comment: string;
    completionComment?: string;  // Comment from executor when completing
    status: TaskStatus;
    createdAt: string;
    updatedAt?: string;
    completedAt?: string;
    // History
    history?: TaskHistoryEntry[];
}

export interface TaskSKU {
    nmId: number;
    sku: string;
    title: string;
}

// Hook for managing tasks with localStorage
export function useTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load tasks from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('svetofor_tasks_v3');
        if (saved) {
            try {
                setTasks(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse tasks:', e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save tasks to localStorage
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('svetofor_tasks_v3', JSON.stringify(tasks));
        }
    }, [tasks, isLoaded]);

    const addTask = (task: Task) => {
        const taskWithHistory: Task = {
            ...task,
            history: [{
                id: Date.now().toString(),
                action: 'created',
                toStatus: task.status,
                userId: task.createdBy,
                userName: task.createdByName,
                timestamp: new Date().toISOString(),
            }],
        };
        setTasks(prev => [...prev, taskWithHistory]);
    };

    const updateTaskStatus = (
        taskId: string,
        status: TaskStatus,
        userId?: string,
        userName?: string,
        completionComment?: string
    ) => {
        setTasks(prev => prev.map(t => {
            if (t.id !== taskId) return t;

            const historyEntry: TaskHistoryEntry = {
                id: Date.now().toString(),
                action: 'status_changed',
                fromStatus: t.status,
                toStatus: status,
                comment: completionComment,
                userId: userId || 'unknown',
                userName: userName || 'Unknown',
                timestamp: new Date().toISOString(),
            };

            return {
                ...t,
                status,
                updatedAt: new Date().toISOString(),
                completedAt: status === 'done' ? new Date().toISOString() : t.completedAt,
                completionComment: completionComment || t.completionComment,
                history: [...(t.history || []), historyEntry],
            };
        }));
    };

    const updateTask = (taskId: string, updates: Partial<Task>) => {
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
        ));
    };

    const deleteTask = (taskId: string) => {
        setTasks(prev => {
            const remaining = prev.filter(t => t.id !== taskId);
            if (remaining.length === 0) {
                localStorage.removeItem('svetofor_tasks_v3');
            }
            return remaining;
        });
    };

    // Filter tasks by user role
    const getTasksForUser = useCallback((userId: string, role: string, categoryId?: string) => {
        return tasks.filter(task => {
            if (role === 'super_admin') return true;
            if (role === 'category_manager') return task.categoryId === categoryId;
            if (role === 'manager') return task.assigneeId === userId;
            return false;
        });
    }, [tasks]);

    // Get task statistics
    const getTaskStats = useCallback((filteredTasks: Task[]) => {
        const now = new Date();
        return {
            total: filteredTasks.length,
            new: filteredTasks.filter(t => t.status === 'new').length,
            inProgress: filteredTasks.filter(t => t.status === 'in_progress').length,
            review: filteredTasks.filter(t => t.status === 'review').length,
            done: filteredTasks.filter(t => t.status === 'done').length,
            critical: filteredTasks.filter(t => t.priority === 'critical' && t.status !== 'done').length,
            overdue: filteredTasks.filter(t => {
                if (!t.deadline || t.status === 'done') return false;
                return new Date(t.deadline) < now;
            }).length,
        };
    }, []);

    // Get tasks grouped by assignee
    const getTasksByAssignee = useCallback((filteredTasks: Task[]) => {
        const byAssignee: Record<string, { name: string; tasks: Task[]; overdue: number }> = {};

        filteredTasks.forEach(task => {
            if (!byAssignee[task.assigneeId]) {
                byAssignee[task.assigneeId] = {
                    name: task.assignee,
                    tasks: [],
                    overdue: 0,
                };
            }
            byAssignee[task.assigneeId].tasks.push(task);
            if (task.deadline && task.status !== 'done' && new Date(task.deadline) < new Date()) {
                byAssignee[task.assigneeId].overdue++;
            }
        });

        return Object.entries(byAssignee).map(([id, data]) => ({
            id,
            name: data.name,
            total: data.tasks.length,
            active: data.tasks.filter(t => t.status !== 'done').length,
            overdue: data.overdue,
        }));
    }, []);

    return {
        tasks,
        isLoaded,
        addTask,
        updateTask,
        updateTaskStatus,
        deleteTask,
        getTasksForUser,
        getTaskStats,
        getTasksByAssignee,
    };
}
