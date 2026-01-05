// Utility functions for goal calculations

import { Category, CATEGORY_LABELS } from '@/lib/auth-types';
import {
    CategoryGoal,
    GoalProgress,
    GoalPeriod,
    GoalStatus,
    getCurrentPeriod,
    getDaysLeftInPeriod,
    getDaysElapsedInPeriod,
    getExpectedProgress,
    calculateGoalStatus,
} from '@/types/goal-types';
import { SKUData } from '@/types/dashboard';

// Calculate actual sales for a category from SKU data
export function calculateCategorySales(
    skuData: SKUData[],
    categoryId: Category
): number {
    // Map category ID to Russian category names used in data
    const categoryMapping: Record<Category, string[]> = {
        face: ['Лицо', 'лицо', 'ЛИЦО', 'Face', 'face'],
        body: ['Тело', 'тело', 'ТЕЛО', 'Body', 'body'],
        makeup: ['Макияж', 'макияж', 'МАКИЯЖ', 'Makeup', 'makeup'],
        hair: ['Волосы', 'волосы', 'ВОЛОСЫ', 'Hair', 'hair'],
    };

    const categoryNames = categoryMapping[categoryId] || [];

    return skuData
        .filter(sku => categoryNames.some(name =>
            sku.category?.toLowerCase() === name.toLowerCase()
        ))
        .reduce((sum, sku) => sum + (sku.orderSum || 0), 0);
}

// Calculate progress for a single goal
export function calculateGoalProgress(
    goal: CategoryGoal,
    actualAmount: number
): GoalProgress {
    const period = goal.period;
    const daysLeft = getDaysLeftInPeriod(period);
    const percentage = goal.targetAmount > 0
        ? (actualAmount / goal.targetAmount) * 100
        : 0;
    const remaining = Math.max(0, goal.targetAmount - actualAmount);
    const dailyTarget = daysLeft > 0 ? remaining / daysLeft : 0;

    const expectedProgress = getExpectedProgress(period);
    const status = calculateGoalStatus(percentage, expectedProgress);

    // Determine trend based on percentage vs expected
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (percentage > expectedProgress + 5) trend = 'up';
    else if (percentage < expectedProgress - 10) trend = 'down';

    return {
        categoryId: goal.categoryId,
        categoryName: CATEGORY_LABELS[goal.categoryId],
        goal: goal.targetAmount,
        actual: actualAmount,
        percentage: Math.round(percentage * 10) / 10,
        remaining,
        daysLeft,
        dailyTarget: Math.round(dailyTarget),
        status,
        trend,
    };
}

// Calculate progress for all goals
export function calculateAllGoalsProgress(
    goals: CategoryGoal[],
    skuData: SKUData[],
    period: GoalPeriod
): GoalProgress[] {
    const currentPeriod = period || getCurrentPeriod();

    // Filter goals for current period
    const periodGoals = goals.filter(
        g => g.period.month === currentPeriod.month && g.period.year === currentPeriod.year
    );

    return periodGoals.map(goal => {
        const actualAmount = calculateCategorySales(skuData, goal.categoryId);
        return calculateGoalProgress(goal, actualAmount);
    });
}

// Get total company progress
export function calculateTotalProgress(progresses: GoalProgress[]): {
    totalGoal: number;
    totalActual: number;
    totalPercentage: number;
    overallStatus: GoalStatus;
} {
    const totalGoal = progresses.reduce((sum, p) => sum + p.goal, 0);
    const totalActual = progresses.reduce((sum, p) => sum + p.actual, 0);
    const totalPercentage = totalGoal > 0
        ? (totalActual / totalGoal) * 100
        : 0;

    const expectedProgress = getExpectedProgress(getCurrentPeriod());
    const overallStatus = calculateGoalStatus(totalPercentage, expectedProgress);

    return {
        totalGoal,
        totalActual,
        totalPercentage: Math.round(totalPercentage * 10) / 10,
        overallStatus,
    };
}

// Format money for display
export function formatGoalMoney(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ₽`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K ₽`;
    return `${value.toLocaleString('ru-RU')} ₽`;
}

// Get top SKUs for growth in a category
export function getTopGrowthSKUs(
    skuData: SKUData[],
    categoryId: Category,
    limit: number = 5
): SKUData[] {
    const categoryMapping: Record<Category, string[]> = {
        face: ['Лицо', 'лицо', 'Face', 'face'],
        body: ['Тело', 'тело', 'Body', 'body'],
        makeup: ['Макияж', 'макияж', 'Makeup', 'makeup'],
        hair: ['Волосы', 'волосы', 'Hair', 'hair'],
    };

    const categoryNames = categoryMapping[categoryId] || [];

    return skuData
        .filter(sku => categoryNames.some(name =>
            sku.category?.toLowerCase() === name.toLowerCase()
        ))
        // Sort by potential: high stock + low sales = opportunity
        .sort((a, b) => {
            const potentialA = (a.stockTotal || 0) / Math.max(1, parseFloat(a.ordersPerDay) || 1);
            const potentialB = (b.stockTotal || 0) / Math.max(1, parseFloat(b.ordersPerDay) || 1);
            return potentialB - potentialA;
        })
        .slice(0, limit);
}

// Period display helpers
export function formatPeriod(period: GoalPeriod): string {
    const months = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return `${months[period.month - 1]} ${period.year}`;
}

export function formatPeriodShort(period: GoalPeriod): string {
    return `${String(period.month).padStart(2, '0')}/${period.year}`;
}
