'use client';

import { useState, useEffect } from 'react';

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
    status: 'new' | 'in_progress' | 'review' | 'done';
    createdAt: string;
    updatedAt?: string;
    completedAt?: string;
}

export interface TaskSKU {
    nmId: number;
    sku: string;
    title: string;
}

// Hook for managing tasks with localStorage
export function useTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);

    // Load tasks from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('svetofor_tasks_v2');
        if (saved) {
            try {
                setTasks(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse tasks:', e);
            }
        }
    }, []);

    // Save tasks to localStorage
    useEffect(() => {
        if (tasks.length > 0) {
            localStorage.setItem('svetofor_tasks_v2', JSON.stringify(tasks));
        }
    }, [tasks]);

    const addTask = (task: Task) => {
        setTasks(prev => [...prev, task]);
    };

    const updateTaskStatus = (taskId: string, status: Task['status']) => {
        setTasks(prev => prev.map(t =>
            t.id === taskId ? {
                ...t,
                status,
                updatedAt: new Date().toISOString(),
                completedAt: status === 'done' ? new Date().toISOString() : t.completedAt,
            } : t
        ));
    };

    const deleteTask = (taskId: string) => {
        setTasks(prev => {
            const remaining = prev.filter(t => t.id !== taskId);
            if (remaining.length === 0) {
                localStorage.removeItem('svetofor_tasks_v2');
            }
            return remaining;
        });
    };

    // Filter tasks by user role
    const getTasksForUser = (userId: string, role: string, categoryId?: string) => {
        return tasks.filter(task => {
            if (role === 'super_admin') return true;
            if (role === 'category_manager') return task.categoryId === categoryId;
            if (role === 'manager') return task.assigneeId === userId;
            return false;
        });
    };

    // Get task statistics
    const getTaskStats = (filteredTasks: Task[]) => {
        return {
            total: filteredTasks.length,
            new: filteredTasks.filter(t => t.status === 'new').length,
            inProgress: filteredTasks.filter(t => t.status === 'in_progress').length,
            review: filteredTasks.filter(t => t.status === 'review').length,
            done: filteredTasks.filter(t => t.status === 'done').length,
            critical: filteredTasks.filter(t => t.priority === 'critical' && t.status !== 'done').length,
            overdue: filteredTasks.filter(t => {
                if (!t.deadline || t.status === 'done') return false;
                return new Date(t.deadline) < new Date();
            }).length,
        };
    };

    return {
        tasks,
        addTask,
        updateTaskStatus,
        deleteTask,
        getTasksForUser,
        getTaskStats,
    };
}
