// Types for Department Goals (45B Strategic Goal System)

export type GoalType = 'quantitative' | 'qualitative';
export type GoalUnit = 'rub' | 'percent' | 'units' | 'projects';
export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'at_risk';

export interface GoalMetric {
    target: number;
    current: number;
    unit: GoalUnit;
}

export interface DepartmentGoal {
    id: string;
    departmentId: string;
    title: string;
    description?: string;
    type: GoalType;
    metric?: GoalMetric;
    weight: number; // Contribution to overall goal (0-100)
    status: GoalStatus;
    deadline?: string;
    ownerId?: string;
    ownerName?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DepartmentGoalsData {
    companyTarget: number; // 45,000,000,000
    goals: DepartmentGoal[];
}

// Goal templates for quick creation
export const GOAL_TEMPLATES = {
    quantitative: [
        { title: 'Увеличить выручку', unit: 'rub' as GoalUnit },
        { title: 'Рост конверсии', unit: 'percent' as GoalUnit },
        { title: 'Количество заказов', unit: 'units' as GoalUnit },
    ],
    qualitative: [
        { title: 'Запуск нового проекта', unit: 'projects' as GoalUnit },
        { title: 'Внедрение системы', unit: 'projects' as GoalUnit },
        { title: 'Обучение команды', unit: 'projects' as GoalUnit },
    ],
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
    not_started: 'Не начата',
    in_progress: 'В работе',
    completed: 'Завершена',
    at_risk: 'Под угрозой',
};

export const GOAL_STATUS_COLORS: Record<GoalStatus, string> = {
    not_started: 'bg-slate-500',
    in_progress: 'bg-blue-500',
    completed: 'bg-emerald-500',
    at_risk: 'bg-red-500',
};

export const UNIT_LABELS: Record<GoalUnit, string> = {
    rub: '₽',
    percent: '%',
    units: 'шт.',
    projects: 'проектов',
};
