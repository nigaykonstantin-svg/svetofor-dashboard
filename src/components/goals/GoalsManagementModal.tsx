'use client';

import { useState, useEffect } from 'react';
import { Category, CATEGORY_LABELS } from '@/lib/auth-types';
import { CategoryGoal, GoalPeriod, getCurrentPeriod, generateGoalId } from '@/types/goal-types';
import { formatPeriod } from '@/lib/goals-utils';

interface GoalsManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    goals: CategoryGoal[];
    onSave: (updates: { categoryId: Category; targetAmount: number }[]) => Promise<void>;
    period?: GoalPeriod;
    allowedCategories?: Category[]; // For category managers
}

const ALL_CATEGORIES: Category[] = ['face', 'body', 'makeup', 'hair'];

export function GoalsManagementModal({
    isOpen,
    onClose,
    goals,
    onSave,
    period = getCurrentPeriod(),
    allowedCategories,
}: GoalsManagementModalProps) {
    const [values, setValues] = useState<Record<Category, string>>({
        face: '',
        body: '',
        makeup: '',
        hair: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Categories this user can edit
    const editableCategories = allowedCategories || ALL_CATEGORIES;

    // Initialize values from existing goals
    useEffect(() => {
        const newValues: Record<Category, string> = {
            face: '',
            body: '',
            makeup: '',
            hair: '',
        };

        goals.forEach(goal => {
            if (goal.period.month === period.month && goal.period.year === period.year) {
                newValues[goal.categoryId] = goal.targetAmount.toString();
            }
        });

        setValues(newValues);
    }, [goals, period]);

    const handleValueChange = (category: Category, value: string) => {
        // Allow only numbers
        const numericValue = value.replace(/[^0-9]/g, '');
        setValues(prev => ({ ...prev, [category]: numericValue }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);

        try {
            const updates = editableCategories
                .filter(cat => values[cat] !== '')
                .map(cat => ({
                    categoryId: cat,
                    targetAmount: parseInt(values[cat]) || 0,
                }));

            await onSave(updates);
            onClose();
        } catch (err) {
            setError('Не удалось сохранить цели');
            console.error('Save goals error:', err);
        } finally {
            setSaving(false);
        }
    };

    const formatInputValue = (value: string): string => {
        if (!value) return '';
        const num = parseInt(value);
        if (isNaN(num)) return '';
        return num.toLocaleString('ru-RU');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 className="text-lg font-semibold text-white">
                        ⚙️ Управление целями на {formatPeriod(period)}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                        {ALL_CATEGORIES.map(category => {
                            const isEditable = editableCategories.includes(category);
                            const currentGoal = goals.find(
                                g => g.categoryId === category &&
                                    g.period.month === period.month &&
                                    g.period.year === period.year
                            );

                            return (
                                <div
                                    key={category}
                                    className={`flex items-center justify-between p-3 rounded-lg border ${isEditable
                                            ? 'bg-slate-700/50 border-slate-600'
                                            : 'bg-slate-800/50 border-slate-700 opacity-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">
                                            {category === 'face' && '💆'}
                                            {category === 'body' && '🧴'}
                                            {category === 'makeup' && '💄'}
                                            {category === 'hair' && '💇'}
                                        </span>
                                        <span className="text-white font-medium">
                                            {CATEGORY_LABELS[category]}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {currentGoal && (
                                            <span className="text-slate-400 text-sm">
                                                Текущий: {(currentGoal.targetAmount / 1_000_000).toFixed(1)}M
                                            </span>
                                        )}

                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={formatInputValue(values[category])}
                                                onChange={(e) => handleValueChange(category, e.target.value.replace(/\s/g, ''))}
                                                disabled={!isEditable || saving}
                                                placeholder="0"
                                                className={`w-32 px-3 py-2 text-right bg-slate-900 border border-slate-600 rounded-lg text-white 
                                                    focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50
                                                    ${isEditable ? '' : 'cursor-not-allowed'}`}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                                ₽
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <p className="text-xs text-slate-400">
                        💡 Введите целевую сумму продаж в рублях для каждой категории
                    </p>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-4 border-t border-slate-700">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                Сохранение...
                            </>
                        ) : (
                            <>
                                💾 Сохранить
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
