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

// FIXED: Correct mapping to actual WB category names
const CATEGORY_MAPPING: Record<Category, string[]> = {
    face: ['Уход за лицом', 'уход за лицом'],
    body: ['Уход за телом', 'уход за телом'],
    makeup: ['Макияж', 'макияж'],
    hair: ['Уход за волосами', 'уход за волосами'],
};

// Calculate actual sales for a category from SKU data
export function calculateCategorySales(
    skuData: SKUData[],
    categoryId: Category
): number {
    const categoryNames = CATEGORY_MAPPING[categoryId] || [];

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
    const daysElapsed = getDaysElapsedInPeriod(period);
    const daysInMonth = new Date(period.year, period.month, 0).getDate();

    const percentage = goal.targetAmount > 0
        ? (actualAmount / goal.targetAmount) * 100
        : 0;
    const remaining = Math.max(0, goal.targetAmount - actualAmount);
    const dailyTarget = daysLeft > 0 ? remaining / daysLeft : 0;

    // Calculate forecast
    const dailyAverage = daysElapsed > 0 ? actualAmount / daysElapsed : 0;
    const projectedTotal = dailyAverage * daysInMonth;
    const projectedPercentage = goal.targetAmount > 0
        ? (projectedTotal / goal.targetAmount) * 100
        : 0;

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
        daysElapsed,
        dailyTarget: Math.round(dailyTarget),
        dailyAverage: Math.round(dailyAverage),
        projectedTotal: Math.round(projectedTotal),
        projectedPercentage: Math.round(projectedPercentage * 10) / 10,
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
    totalProjected: number;
    totalProjectedPercentage: number;
    overallStatus: GoalStatus;
} {
    const totalGoal = progresses.reduce((sum, p) => sum + p.goal, 0);
    const totalActual = progresses.reduce((sum, p) => sum + p.actual, 0);
    const totalProjected = progresses.reduce((sum, p) => sum + p.projectedTotal, 0);
    const totalPercentage = totalGoal > 0
        ? (totalActual / totalGoal) * 100
        : 0;
    const totalProjectedPercentage = totalGoal > 0
        ? (totalProjected / totalGoal) * 100
        : 0;

    const expectedProgress = getExpectedProgress(getCurrentPeriod());
    const overallStatus = calculateGoalStatus(totalPercentage, expectedProgress);

    return {
        totalGoal,
        totalActual,
        totalPercentage: Math.round(totalPercentage * 10) / 10,
        totalProjected: Math.round(totalProjected),
        totalProjectedPercentage: Math.round(totalProjectedPercentage * 10) / 10,
        overallStatus,
    };
}

// Get top problematic SKUs in a category
export function getProblematicSKUs(
    skuData: SKUData[],
    categoryId: Category,
    limit: number = 3
): { sku: SKUData; issue: string; severity: 'high' | 'medium' | 'low' }[] {
    const categoryNames = CATEGORY_MAPPING[categoryId] || [];

    const categorySKUs = skuData.filter(sku =>
        categoryNames.some(name => sku.category?.toLowerCase() === name.toLowerCase())
    );

    const problematic: { sku: SKUData; issue: string; severity: 'high' | 'medium' | 'low' }[] = [];

    for (const sku of categorySKUs) {
        // OOS - highest priority
        if (sku.stockTotal === 0) {
            problematic.push({
                sku,
                issue: '🔴 Нет в наличии (OOS)',
                severity: 'high'
            });
            continue;
        }

        // High DRR (>30%)
        const drr = parseFloat(sku.drr || '0');
        if (drr > 30) {
            problematic.push({
                sku,
                issue: `🟠 Высокий ДРР ${drr.toFixed(0)}%`,
                severity: 'medium'
            });
            continue;
        }

        // Low conversion (<1%)
        const crOrder = parseFloat(sku.crOrder || '0');
        if (crOrder < 1 && crOrder > 0) {
            problematic.push({
                sku,
                issue: `🟡 Низкая конверсия ${crOrder.toFixed(1)}%`,
                severity: 'low'
            });
        }
    }

    // Sort by severity and limit
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return problematic
        .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
        .slice(0, limit);
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
    const categoryNames = CATEGORY_MAPPING[categoryId] || [];

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
