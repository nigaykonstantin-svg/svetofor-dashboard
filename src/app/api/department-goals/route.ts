import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { DepartmentGoal, DepartmentGoalsData } from '@/types/department-goals';

const DATA_FILE = path.join(process.cwd(), 'src/data/department-goals.json');

async function readGoalsData(): Promise<DepartmentGoalsData> {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return { companyTarget: 45000000000, goals: [] };
    }
}

async function writeGoalsData(data: DepartmentGoalsData): Promise<void> {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const departmentId = searchParams.get('departmentId');

        const data = await readGoalsData();

        if (departmentId) {
            const deptGoals = data.goals.filter(g => g.departmentId === departmentId);
            return NextResponse.json({
                companyTarget: data.companyTarget,
                goals: deptGoals
            });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error reading department goals:', error);
        return NextResponse.json({ error: 'Failed to load goals' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { goal } = body as { goal: DepartmentGoal };

        const data = await readGoalsData();

        // Check department goal count
        const deptGoals = data.goals.filter(g => g.departmentId === goal.departmentId);

        const existingIndex = data.goals.findIndex(g => g.id === goal.id);

        if (existingIndex === -1) {
            // Adding new goal - check limit
            if (deptGoals.length >= 10) {
                return NextResponse.json(
                    { error: 'Maximum 10 goals per department' },
                    { status: 400 }
                );
            }
            data.goals.push({
                ...goal,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        } else {
            // Updating existing
            data.goals[existingIndex] = {
                ...goal,
                updatedAt: new Date().toISOString(),
            };
        }

        await writeGoalsData(data);

        return NextResponse.json({ success: true, goal });
    } catch (error) {
        console.error('Error saving department goal:', error);
        return NextResponse.json({ error: 'Failed to save goal' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const goalId = searchParams.get('id');

        if (!goalId) {
            return NextResponse.json({ error: 'Goal ID required' }, { status: 400 });
        }

        const data = await readGoalsData();

        const goalIndex = data.goals.findIndex(g => g.id === goalId);
        if (goalIndex === -1) {
            return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
        }

        const deptId = data.goals[goalIndex].departmentId;
        const deptGoalsCount = data.goals.filter(g => g.departmentId === deptId).length;

        if (deptGoalsCount <= 3) {
            return NextResponse.json(
                { error: 'Minimum 3 goals per department required' },
                { status: 400 }
            );
        }

        data.goals.splice(goalIndex, 1);
        await writeGoalsData(data);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting department goal:', error);
        return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
    }
}
