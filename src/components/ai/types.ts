'use client';

// Shared types for AI components

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    skuRefs?: number[]; // nmIds referenced in the message
}

export interface QuickPrompt {
    id: string;
    emoji: string;
    title: string;
    prompt: string;
}

export interface Mission {
    id: string;
    goal: string;
    status: 'planning' | 'active' | 'completed';
    phases: MissionPhase[];
    createdAt: string;
    predictedImpact: string;
}

export interface MissionPhase {
    id: string;
    name: string;
    description: string;
    skus: MissionSKU[];
    predictedImpact: string;
    assigneeId?: string;
    assigneeName?: string;
    deadline?: string;
    status: 'pending' | 'in_progress' | 'done';
}

export interface MissionSKU {
    nmId: number;
    sku: string;
    title: string;
    currentIssue?: string;
}

export interface Scenario {
    id: string;
    name: string;
    changes: ScenarioChanges;
    prediction?: ScenarioPrediction;
    createdAt: string;
}

export interface ScenarioChanges {
    priceChangePercent?: number;
    budgetChangePercent?: number;
    newSKUs?: number;
}

export interface ScenarioPrediction {
    revenue: { current: number; predicted: number; change: number };
    orders: { current: number; predicted: number; change: number };
    margin: { current: number; predicted: number; change: number };
    risks: string[];
    opportunities: string[];
}

export interface SKUAnalysis {
    diagnosis: string;
    recommendations: string[];
    competitorComparison?: string;
    historicalTrend?: string;
}

// Tab types
export type AiPanelTab = 'chat' | 'actions' | 'missions' | 'sku' | 'scenarios';

export const AI_TABS: { id: AiPanelTab; emoji: string; label: string }[] = [
    { id: 'chat', emoji: '💬', label: 'Чат' },
    { id: 'actions', emoji: '📋', label: 'Действия' },
    { id: 'missions', emoji: '🎯', label: 'Миссии' },
    { id: 'sku', emoji: '🔍', label: 'SKU' },
    { id: 'scenarios', emoji: '🔮', label: 'Сценарии' },
];

// Quick prompts for chat
export const QUICK_PROMPTS: QuickPrompt[] = [
    {
        id: 'sales_drop',
        emoji: '📉',
        title: 'Почему упали продажи?',
        prompt: 'Проанализируй, почему могли упасть продажи в этой категории. Укажи конкретные SKU и причины.',
    },
    {
        id: 'urgent_restock',
        emoji: '🚨',
        title: 'Срочные пополнения',
        prompt: 'Какие SKU нужно срочно пополнить? Отсортируй по приоритетности и укажи рекомендуемые объёмы.',
    },
    {
        id: 'price_up',
        emoji: '📈',
        title: 'Повысить цену',
        prompt: 'Какие товары можно поднять в цене без потери продаж? Укажи рекомендуемый процент повышения.',
    },
    {
        id: 'compare_periods',
        emoji: '📊',
        title: 'Сравнить периоды',
        prompt: 'Сравни текущий период с предыдущим. Что улучшилось, что ухудшилось?',
    },
    {
        id: 'top_problems',
        emoji: '⚠️',
        title: 'Топ проблем',
        prompt: 'Назови 5 самых проблемных SKU и что с ними делать в первую очередь.',
    },
    {
        id: 'quick_wins',
        emoji: '🎯',
        title: 'Быстрые победы',
        prompt: 'Какие быстрые действия дадут максимальный эффект? Что можно сделать прямо сейчас?',
    },
];

// Preset goals for missions
export const PRESET_GOALS = [
    { id: 'revenue_up', emoji: '💰', title: 'Увеличить выручку', placeholder: 'на X%' },
    { id: 'drr_down', emoji: '📉', title: 'Снизить ДРР', placeholder: 'до X%' },
    { id: 'fix_oos', emoji: '📦', title: 'Устранить OOS', placeholder: 'все товары' },
    { id: 'improve_cr', emoji: '🛒', title: 'Улучшить конверсию', placeholder: 'до X%' },
    { id: 'reduce_overstock', emoji: '📦', title: 'Сократить затоварку', placeholder: 'на X SKU' },
];
