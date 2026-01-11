'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import UserHeader from '@/components/auth/UserHeader';
import {
    DepartmentGoal,
    GoalType,
    GoalStatus,
    GoalUnit,
    GOAL_STATUS_LABELS,
    GOAL_STATUS_COLORS,
    UNIT_LABELS,
} from '@/types/department-goals';
import orgData from '@/data/org-structure.json';

interface Department {
    id: string;
    name: string;
    icon: string;
    employeeCount: number;
}

// Main/Priority departments - always visible
const PRIORITY_DEPT_IDS = [
    'dept_15', // E-COM WB
    'dept_19', // E-COM OZON
    'dept_16', // E-COM Яндекс
    'dept_17', // E-COM Поддержка
    'dept_6',  // Оффлайн продажи
    'dept_2',  // Маркетинг
    'dept_8',  // Финансы
    'dept_3',  // IT
];

export default function Goals45BPage() {
    const router = useRouter();
    const [goals, setGoals] = useState<DepartmentGoal[]>([]);
    const [companyTarget, setCompanyTarget] = useState(45000000000);
    const [selectedDept, setSelectedDept] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingGoal, setEditingGoal] = useState<DepartmentGoal | null>(null);

    // Additional departments added by user
    const [additionalDepts, setAdditionalDepts] = useState<string[]>([]);
    const [showOtherDepts, setShowOtherDepts] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const departments: Department[] = orgData.departments.map((d) => ({
        id: d.id,
        name: d.name,
        icon: d.icon,
        employeeCount: d.employeeCount,
    }));

    // Priority departments (always visible)
    const priorityDepts = useMemo(() => {
        return PRIORITY_DEPT_IDS
            .map(id => departments.find(d => d.id === id))
            .filter(Boolean) as Department[];
    }, [departments]);

    // Other departments (can be added)
    const otherDepts = useMemo(() => {
        return departments.filter(d => !PRIORITY_DEPT_IDS.includes(d.id));
    }, [departments]);

    // Departments added from "Other"
    const addedDepts = useMemo(() => {
        return additionalDepts
            .map(id => departments.find(d => d.id === id))
            .filter(Boolean) as Department[];
    }, [departments, additionalDepts]);

    // Search filtered other departments
    const searchedOtherDepts = useMemo(() => {
        const notAdded = otherDepts.filter(d => !additionalDepts.includes(d.id));
        if (!searchQuery) return notAdded;
        return notAdded.filter(d =>
            d.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [otherDepts, additionalDepts, searchQuery]);

    useEffect(() => {
        fetchGoals();
    }, []);

    const fetchGoals = async () => {
        try {
            const res = await fetch('/api/department-goals');
            const data = await res.json();
            setGoals(data.goals || []);
            setCompanyTarget(data.companyTarget || 45000000000);
        } catch (err) {
            console.error('Failed to load goals:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate overall progress towards 45B
    const overallProgress = useMemo(() => {
        const totalWeight = goals.reduce((sum, g) => sum + g.weight, 0) || 1;
        const weightedProgress = goals.reduce((sum, g) => {
            if (g.type === 'quantitative' && g.metric) {
                const progress = Math.min(100, (g.metric.current / g.metric.target) * 100);
                return sum + (progress * g.weight);
            } else if (g.status === 'completed') {
                return sum + (100 * g.weight);
            } else if (g.status === 'in_progress') {
                return sum + (50 * g.weight);
            }
            return sum;
        }, 0);
        return weightedProgress / totalWeight;
    }, [goals]);

    // Get goals for selected department
    const deptGoals = useMemo(() => {
        if (!selectedDept) return [];
        return goals.filter((g) => g.departmentId === selectedDept);
    }, [goals, selectedDept]);

    // Calculate department progress
    const getDeptProgress = (deptId: string) => {
        const dGoals = goals.filter((g) => g.departmentId === deptId);
        if (dGoals.length === 0) return 0;
        const totalWeight = dGoals.reduce((sum, g) => sum + g.weight, 0) || 1;
        const weightedProgress = dGoals.reduce((sum, g) => {
            if (g.type === 'quantitative' && g.metric) {
                const progress = Math.min(100, (g.metric.current / g.metric.target) * 100);
                return sum + (progress * g.weight);
            } else if (g.status === 'completed') {
                return sum + (100 * g.weight);
            } else if (g.status === 'in_progress') {
                return sum + (50 * g.weight);
            }
            return sum;
        }, 0);
        return weightedProgress / totalWeight;
    };

    const getDeptGoalsCount = (deptId: string) => {
        return goals.filter(g => g.departmentId === deptId).length;
    };

    const handleSaveGoal = async (goal: DepartmentGoal) => {
        try {
            const res = await fetch('/api/department-goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal }),
            });
            if (res.ok) {
                await fetchGoals();
                setShowModal(false);
                setEditingGoal(null);
            }
        } catch (err) {
            console.error('Failed to save goal:', err);
        }
    };

    const handleDeleteGoal = async (goalId: string) => {
        if (!confirm('Удалить цель?')) return;
        try {
            const res = await fetch(`/api/department-goals?id=${goalId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                await fetchGoals();
            } else {
                const data = await res.json();
                alert(data.error || 'Ошибка удаления');
            }
        } catch (err) {
            console.error('Failed to delete goal:', err);
        }
    };

    const addDepartment = (deptId: string) => {
        if (!additionalDepts.includes(deptId)) {
            setAdditionalDepts(prev => [...prev, deptId]);
        }
    };

    const removeDepartment = (deptId: string) => {
        setAdditionalDepts(prev => prev.filter(id => id !== deptId));
    };

    const formatCurrency = (value: number) => {
        if (value >= 1e9) return `${(value / 1e9).toFixed(1)} млрд`;
        if (value >= 1e6) return `${(value / 1e6).toFixed(1)} млн`;
        if (value >= 1e3) return `${(value / 1e3).toFixed(0)} тыс`;
        return value.toString();
    };

    const formatMetricValue = (value: number, unit: GoalUnit) => {
        if (unit === 'rub') return formatCurrency(value);
        return `${value}${UNIT_LABELS[unit]}`;
    };

    // Render department card
    const renderDeptCard = (dept: Department, isRemovable: boolean = false) => {
        const goalsCount = getDeptGoalsCount(dept.id);
        const progress = getDeptProgress(dept.id);
        const isSelected = selectedDept === dept.id;

        return (
            <div key={dept.id} className="relative group">
                <button
                    onClick={() => setSelectedDept(dept.id)}
                    className={`
                        w-full text-left p-3 rounded-xl transition-all duration-200
                        ${isSelected
                            ? 'bg-emerald-500/20 ring-2 ring-emerald-500/50'
                            : 'bg-slate-900/50 hover:bg-slate-800/50'
                        }
                    `}
                >
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{dept.icon}</span>
                            <span className="text-white font-medium text-sm">{dept.name}</span>
                        </div>
                        <span className="text-xs text-slate-400">
                            {goalsCount}/10
                        </span>
                    </div>
                    <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${goalsCount >= 3
                                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                                : 'bg-amber-500'
                                }`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </button>
                {isRemovable && (
                    <button
                        onClick={() => removeDepartment(dept.id)}
                        className="absolute -right-1 -top-1 w-5 h-5 bg-slate-700 hover:bg-red-500 text-slate-400 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-all text-xs flex items-center justify-center"
                        title="Убрать"
                    >
                        ✕
                    </button>
                )}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-white text-xl">Загрузка...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950">
            <UserHeader onLogout={() => router.push('/login')} />

            <main className="ml-64 pt-20 p-6">
                {/* Header with overall progress */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        💰 Цели 45 млрд.
                    </h1>
                    <p className="text-slate-400 text-sm">
                        Стратегические цели компании с декомпозицией по отделам
                    </p>

                    {/* Company Progress */}
                    <div className="mt-4 bg-slate-900/50 backdrop-blur-xl rounded-2xl p-4 border border-slate-800/50">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-white font-medium">
                                Общий прогресс к цели
                            </span>
                            <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                                {formatCurrency(companyTarget)}
                            </span>
                        </div>
                        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, overallProgress)}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-slate-400">
                            <span>{overallProgress.toFixed(1)}% выполнено</span>
                            <span>{goals.length} целей</span>
                        </div>
                    </div>
                </div>

                {/* Main content: Departments + Goals */}
                <div className="grid grid-cols-12 gap-6">
                    {/* Left: Departments */}
                    <div className="col-span-4">
                        {/* Priority Departments */}
                        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                            👑 Ключевые отделы
                        </h2>
                        <div className="space-y-2 mb-4">
                            {priorityDepts.map(dept => renderDeptCard(dept, false))}
                        </div>

                        {/* Added departments from "Other" */}
                        {addedDepts.length > 0 && (
                            <>
                                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 mt-4">
                                    📌 Добавленные
                                </h2>
                                <div className="space-y-2 mb-4">
                                    {addedDepts.map(dept => renderDeptCard(dept, true))}
                                </div>
                            </>
                        )}

                        {/* Other Departments - Expandable */}
                        <div className="mt-4">
                            <button
                                onClick={() => setShowOtherDepts(!showOtherDepts)}
                                className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl text-sm text-slate-300 transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <span>📁</span>
                                    <span>Остальные отделы ({otherDepts.length - additionalDepts.length})</span>
                                </span>
                                <span className="text-slate-500">{showOtherDepts ? '▲' : '▼'}</span>
                            </button>

                            {showOtherDepts && (
                                <div className="mt-2 bg-slate-800/30 rounded-xl p-3 border border-slate-700/50">
                                    <input
                                        type="text"
                                        placeholder="🔍 Поиск..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm mb-2"
                                    />
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                        {searchedOtherDepts.length === 0 ? (
                                            <p className="text-center text-slate-500 text-sm py-2">
                                                Все отделы добавлены
                                            </p>
                                        ) : (
                                            searchedOtherDepts.map((dept) => (
                                                <button
                                                    key={dept.id}
                                                    onClick={() => addDepartment(dept.id)}
                                                    className="w-full flex items-center gap-2 p-2 hover:bg-slate-700/50 rounded-lg text-left transition-colors"
                                                >
                                                    <span className="text-lg">{dept.icon}</span>
                                                    <span className="text-sm text-white">{dept.name}</span>
                                                    <span className="text-xs text-slate-500 ml-auto">
                                                        {getDeptGoalsCount(dept.id)} целей
                                                    </span>
                                                    <span className="text-emerald-400 text-sm">+</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Goals for selected department */}
                    <div className="col-span-8">
                        {selectedDept ? (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold text-white">
                                        {departments.find((d) => d.id === selectedDept)?.icon}{' '}
                                        {departments.find((d) => d.id === selectedDept)?.name}
                                    </h2>
                                    {deptGoals.length < 10 && (
                                        <button
                                            onClick={() => {
                                                setEditingGoal(null);
                                                setShowModal(true);
                                            }}
                                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
                                        >
                                            + Добавить цель
                                        </button>
                                    )}
                                </div>

                                {deptGoals.length === 0 ? (
                                    <div className="bg-slate-900/50 rounded-xl p-8 text-center">
                                        <p className="text-slate-400 mb-4">
                                            У этого отдела пока нет целей
                                        </p>
                                        <button
                                            onClick={() => {
                                                setEditingGoal(null);
                                                setShowModal(true);
                                            }}
                                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                                        >
                                            Добавить первую цель
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
                                        {deptGoals.map((goal) => (
                                            <div
                                                key={goal.id}
                                                className="bg-slate-900/50 backdrop-blur-xl rounded-xl p-4 border border-slate-800/50"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span
                                                                className={`px-2 py-0.5 text-xs rounded-full text-white ${goal.type === 'quantitative'
                                                                    ? 'bg-blue-500/30'
                                                                    : 'bg-purple-500/30'
                                                                    }`}
                                                            >
                                                                {goal.type === 'quantitative'
                                                                    ? '📊 Кол.'
                                                                    : '🎯 Кач.'}
                                                            </span>
                                                            <span
                                                                className={`px-2 py-0.5 text-xs rounded-full text-white ${GOAL_STATUS_COLORS[goal.status]}`}
                                                            >
                                                                {GOAL_STATUS_LABELS[goal.status]}
                                                            </span>
                                                        </div>
                                                        <h3 className="text-white font-medium">
                                                            {goal.title}
                                                        </h3>
                                                        {goal.description && (
                                                            <p className="text-sm text-slate-400 mt-1">
                                                                {goal.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => {
                                                                setEditingGoal(goal);
                                                                setShowModal(true);
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteGoal(goal.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>

                                                {goal.type === 'quantitative' && goal.metric && (
                                                    <div className="mt-2">
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span className="text-slate-400">Прогресс</span>
                                                            <span className="text-white">
                                                                {formatMetricValue(goal.metric.current, goal.metric.unit)}
                                                                {' / '}
                                                                {formatMetricValue(goal.metric.target, goal.metric.unit)}
                                                            </span>
                                                        </div>
                                                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                                                                style={{
                                                                    width: `${Math.min(100, (goal.metric.current / goal.metric.target) * 100)}%`,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex justify-between mt-2 text-xs text-slate-500">
                                                    <span>Вес: {goal.weight}%</span>
                                                    {goal.deadline && (
                                                        <span>
                                                            Дедлайн: {new Date(goal.deadline).toLocaleDateString('ru-RU')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="bg-slate-900/50 rounded-xl p-8 text-center h-full flex items-center justify-center">
                                <p className="text-slate-400">
                                    ← Выберите отдел для просмотра целей
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Goal Modal */}
            {showModal && selectedDept && (
                <GoalModal
                    departmentId={selectedDept}
                    goal={editingGoal}
                    onSave={handleSaveGoal}
                    onClose={() => {
                        setShowModal(false);
                        setEditingGoal(null);
                    }}
                />
            )}
        </div>
    );
}

// Goal Creation/Edit Modal
interface GoalModalProps {
    departmentId: string;
    goal: DepartmentGoal | null;
    onSave: (goal: DepartmentGoal) => void;
    onClose: () => void;
}

function GoalModal({ departmentId, goal, onSave, onClose }: GoalModalProps) {
    const [title, setTitle] = useState(goal?.title || '');
    const [description, setDescription] = useState(goal?.description || '');
    const [type, setType] = useState<GoalType>(goal?.type || 'quantitative');
    const [status, setStatus] = useState<GoalStatus>(goal?.status || 'not_started');
    const [weight, setWeight] = useState(goal?.weight || 10);
    const [deadline, setDeadline] = useState(goal?.deadline?.split('T')[0] || '');
    const [targetValue, setTargetValue] = useState(goal?.metric?.target || 0);
    const [currentValue, setCurrentValue] = useState(goal?.metric?.current || 0);
    const [unit, setUnit] = useState<GoalUnit>(goal?.metric?.unit || 'percent');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newGoal: DepartmentGoal = {
            id: goal?.id || `goal_${Date.now()}`,
            departmentId,
            title,
            description,
            type,
            status,
            weight,
            deadline: deadline || undefined,
            createdAt: goal?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        if (type === 'quantitative') {
            newGoal.metric = {
                target: targetValue,
                current: currentValue,
                unit,
            };
        }

        onSave(newGoal);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-lg border border-slate-700">
                <h2 className="text-xl font-bold text-white mb-4">
                    {goal ? 'Редактировать цель' : 'Новая цель'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Название</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            placeholder="Например: Увеличить выручку на 20%"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Описание</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white h-20"
                            placeholder="Подробное описание цели..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Тип цели</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as GoalType)}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            >
                                <option value="quantitative">📊 Количественная</option>
                                <option value="qualitative">🎯 Качественная</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Статус</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as GoalStatus)}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            >
                                {Object.entries(GOAL_STATUS_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {type === 'quantitative' && (
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Ед. изм.</label>
                                <select
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value as GoalUnit)}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                >
                                    <option value="rub">₽</option>
                                    <option value="percent">%</option>
                                    <option value="units">шт.</option>
                                    <option value="projects">проект</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Цель</label>
                                <input
                                    type="number"
                                    value={targetValue}
                                    onChange={(e) => setTargetValue(Number(e.target.value))}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Текущее</label>
                                <input
                                    type="number"
                                    value={currentValue}
                                    onChange={(e) => setCurrentValue(Number(e.target.value))}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">
                                Вес — {weight}%
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={weight}
                                onChange={(e) => setWeight(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Дедлайн</label>
                            <input
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                        >
                            {goal ? 'Сохранить' : 'Создать'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
