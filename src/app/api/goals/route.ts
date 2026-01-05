import { NextRequest, NextResponse } from 'next/server';
import { Category } from '@/lib/auth-types';
import {
    CategoryGoal,
    GoalPeriod,
    GoalsResponse,
    GoalUpdateRequest,
    generateGoalId,
    getCurrentPeriod,
} from '@/types/goal-types';
import goalsData from '@/data/category-goals.json';
import fs from 'fs';
import path from 'path';

// In-memory cache of goals (loaded from JSON)
let goals: CategoryGoal[] = goalsData.goals as CategoryGoal[];

// Path to goals file for persistence
const GOALS_FILE_PATH = path.join(process.cwd(), 'src/data/category-goals.json');

// GET: Retrieve goals for a period
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        // Default to current period
        const period: GoalPeriod = {
            month: month ? parseInt(month) : getCurrentPeriod().month,
            year: year ? parseInt(year) : getCurrentPeriod().year,
        };

        // Filter goals for requested period
        const periodGoals = goals.filter(
            g => g.period.month === period.month && g.period.year === period.year
        );

        // If no goals for this period, return empty with period info
        const response: GoalsResponse = {
            success: true,
            goals: periodGoals,
            progress: [], // Progress is calculated client-side with SKU data
            period,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Goals API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch goals' },
            { status: 500 }
        );
    }
}

// POST: Create or update a goal
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { categoryId, targetAmount, period, userId } = body as GoalUpdateRequest & { userId?: string };

        // Validate required fields
        if (!categoryId || targetAmount === undefined || !period) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: categoryId, targetAmount, period' },
                { status: 400 }
            );
        }

        // Validate category
        const validCategories: Category[] = ['face', 'body', 'makeup', 'hair'];
        if (!validCategories.includes(categoryId)) {
            return NextResponse.json(
                { success: false, error: 'Invalid category' },
                { status: 400 }
            );
        }

        const goalId = generateGoalId(categoryId, period);
        const now = new Date().toISOString();

        // Check if goal exists
        const existingIndex = goals.findIndex(g => g.id === goalId);

        if (existingIndex >= 0) {
            // Update existing goal
            goals[existingIndex] = {
                ...goals[existingIndex],
                targetAmount,
                updatedAt: now,
            };
        } else {
            // Create new goal
            const newGoal: CategoryGoal = {
                id: goalId,
                categoryId,
                targetAmount,
                period,
                createdBy: userId || 'system',
                createdAt: now,
                updatedAt: now,
            };
            goals.push(newGoal);
        }

        // Persist to file
        await saveGoalsToFile();

        return NextResponse.json({
            success: true,
            goal: goals.find(g => g.id === goalId),
        });
    } catch (error) {
        console.error('Goals API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to save goal' },
            { status: 500 }
        );
    }
}

// PUT: Bulk update goals
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { updates, userId } = body as {
            updates: GoalUpdateRequest[];
            userId?: string;
        };

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json(
                { success: false, error: 'Updates array is required' },
                { status: 400 }
            );
        }

        const now = new Date().toISOString();
        const updatedGoals: CategoryGoal[] = [];

        for (const update of updates) {
            const { categoryId, targetAmount, period } = update;
            const goalId = generateGoalId(categoryId, period);

            const existingIndex = goals.findIndex(g => g.id === goalId);

            if (existingIndex >= 0) {
                goals[existingIndex] = {
                    ...goals[existingIndex],
                    targetAmount,
                    updatedAt: now,
                };
                updatedGoals.push(goals[existingIndex]);
            } else {
                const newGoal: CategoryGoal = {
                    id: goalId,
                    categoryId,
                    targetAmount,
                    period,
                    createdBy: userId || 'system',
                    createdAt: now,
                    updatedAt: now,
                };
                goals.push(newGoal);
                updatedGoals.push(newGoal);
            }
        }

        // Persist to file
        await saveGoalsToFile();

        return NextResponse.json({
            success: true,
            goals: updatedGoals,
        });
    } catch (error) {
        console.error('Goals API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update goals' },
            { status: 500 }
        );
    }
}

// DELETE: Remove a goal
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const goalId = searchParams.get('id');

        if (!goalId) {
            return NextResponse.json(
                { success: false, error: 'Goal ID is required' },
                { status: 400 }
            );
        }

        const existingIndex = goals.findIndex(g => g.id === goalId);

        if (existingIndex < 0) {
            return NextResponse.json(
                { success: false, error: 'Goal not found' },
                { status: 404 }
            );
        }

        goals.splice(existingIndex, 1);

        // Persist to file
        await saveGoalsToFile();

        return NextResponse.json({
            success: true,
            deleted: goalId,
        });
    } catch (error) {
        console.error('Goals API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete goal' },
            { status: 500 }
        );
    }
}

// Helper to save goals to file
async function saveGoalsToFile() {
    try {
        const data = JSON.stringify({ goals }, null, 2);
        fs.writeFileSync(GOALS_FILE_PATH, data, 'utf-8');
    } catch (error) {
        console.error('Failed to save goals file:', error);
        // Don't throw - goals are still in memory
    }
}
