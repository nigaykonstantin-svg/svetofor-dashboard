'use client';

import { useState, useCallback } from 'react';
import { CategoryGoal, getCurrentPeriod } from '@/types/goal-types';
import { Category } from '@/lib/auth-types';

interface UseGoalsResult {
    goals: CategoryGoal[];
    loading: boolean;
    fetchGoals: () => Promise<void>;
    handleSaveGoals: (
        updates: { categoryId: Category; targetAmount: number }[],
        userId?: string
    ) => Promise<void>;
}

export function useGoals(): UseGoalsResult {
    const [goals, setGoals] = useState<CategoryGoal[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchGoals = useCallback(async () => {
        try {
            setLoading(true);
            const currentPeriod = getCurrentPeriod();
            const res = await fetch(`/api/goals?month=${currentPeriod.month}&year=${currentPeriod.year}`);
            const data = await res.json();
            if (data.success) {
                setGoals(data.goals);
            }
        } catch (err) {
            console.error('Failed to fetch goals:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSaveGoals = useCallback(async (
        updates: { categoryId: Category; targetAmount: number }[],
        userId?: string
    ) => {
        const response = await fetch('/api/goals', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                updates: updates.map(u => ({ ...u, period: getCurrentPeriod() })),
                userId,
            }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to save');
        }

        // Refresh goals after save
        await fetchGoals();
    }, [fetchGoals]);

    return { goals, loading, fetchGoals, handleSaveGoals };
}
