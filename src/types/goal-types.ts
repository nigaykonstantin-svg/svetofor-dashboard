// Types for Category Goals Module

import { Category } from '@/lib/auth-types';

// Goal period (monthly)
export interface GoalPeriod {
    month: number; // 1-12
    year: number;
}

// Category goal definition
export interface CategoryGoal {
    id: string;
    categoryId: Category;
    targetAmount: number; // Target in rubles
    period: GoalPeriod;
    createdBy: string; // userId
    createdAt: string;
    updatedAt: string;
}

// Calculated progress for a goal
export interface GoalProgress {
    categoryId: Category;
    categoryName: string;
    goal: number; // Target amount
    actual: number; // Current amount from sales
    percentage: number; // 0-100+
    remaining: number; // Amount left to reach goal
    daysLeft: number; // Days until end of period
    daysElapsed: number; // Days since start of period
    dailyTarget: number; // Required daily sales to meet goal
    dailyAverage: number; // Current average daily sales
    projectedTotal: number; // Projected total at end of month
    projectedPercentage: number; // Projected percentage at end of month
    status: GoalStatus;
    trend: 'up' | 'down' | 'stable'; // Based on recent performance
}

// Goal achievement status
export type GoalStatus = 'achieved' | 'on_track' | 'at_risk' | 'behind';

// Status thresholds (percentage-based)
export const GOAL_STATUS_THRESHOLDS = {
    achieved: 100,
    on_track: 80, // >= 80% of expected progress
    at_risk: 50,  // 50-80% of expected progress
    behind: 0,    // < 50% of expected progress
};

// Status colors for UI
export const GOAL_STATUS_COLORS: Record<GoalStatus, { bg: string; text: string; border: string }> = {
    achieved: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
    on_track: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
    at_risk: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
    behind: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
};

// Status labels
export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
    achieved: '✅ Выполнено',
    on_track: '🔵 По плану',
    at_risk: '⚠️ Есть риски',
    behind: '🔴 Отставание',
};

// API response types
export interface GoalsResponse {
    success: boolean;
    goals: CategoryGoal[];
    progress: GoalProgress[];
    period: GoalPeriod;
}

export interface GoalUpdateRequest {
    categoryId: Category;
    targetAmount: number;
    period: GoalPeriod;
}

// Helper to generate goal ID
export function generateGoalId(categoryId: Category, period: GoalPeriod): string {
    return `goal-${categoryId}-${period.year}-${String(period.month).padStart(2, '0')}`;
}

// Helper to get current period
export function getCurrentPeriod(): GoalPeriod {
    const now = new Date();
    return {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
    };
}

// Helper to get days left in period
export function getDaysLeftInPeriod(period: GoalPeriod): number {
    const now = new Date();
    const endOfMonth = new Date(period.year, period.month, 0); // Last day of month
    const diffTime = endOfMonth.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

// Helper to get days elapsed in period
export function getDaysElapsedInPeriod(period: GoalPeriod): number {
    const now = new Date();
    const startOfMonth = new Date(period.year, period.month - 1, 1);
    const diffTime = now.getTime() - startOfMonth.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

// Helper to calculate expected progress
export function getExpectedProgress(period: GoalPeriod): number {
    const daysInMonth = new Date(period.year, period.month, 0).getDate();
    const elapsed = getDaysElapsedInPeriod(period);
    return (elapsed / daysInMonth) * 100;
}

// Helper to determine goal status
export function calculateGoalStatus(percentage: number, expectedPercentage: number): GoalStatus {
    if (percentage >= 100) return 'achieved';

    const progressRatio = percentage / expectedPercentage;

    if (progressRatio >= 0.95) return 'on_track'; // Within 5% of expected
    if (progressRatio >= 0.7) return 'at_risk';   // 70-95% of expected
    return 'behind';                               // < 70% of expected
}
