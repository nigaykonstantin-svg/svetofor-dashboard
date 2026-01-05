'use client';

import { useState } from 'react';
import { Mission, MissionPhase, PRESET_GOALS } from './types';

interface SKUData {
    sku: string;
    nmId: number;
    title: string;
    category: string;
    stockTotal: number;
    ordersPerDay: string;
    stockCoverDays: string;
    crCart?: string;
    crOrder?: string;
    drr?: string;
    orderSum: number;
    signals: { type: string; priority: string; message: string }[];
}

interface MissionsModeProps {
    category: string;
    period: number;
    kpis: {
        totalOrderSum: number;
        totalOrders: number;
        avgCheck: number;
        avgDRR: number;
        skuCount: number;
    } | null;
    clusters: {
        OOS_NOW: SKUData[];
        OOS_SOON: SKUData[];
        HIGH_DRR: SKUData[];
        LOW_CTR: SKUData[];
        LOW_CR: SKUData[];
        LOW_BUYOUT: SKUData[];
        OVERSTOCK: SKUData[];
        ABOVE_MARKET: SKUData[];
    } | null;
    onCreateTasks?: (phases: MissionPhase[]) => void;
}

export default function MissionsMode({
    category,
    period,
    kpis,
    clusters,
    onCreateTasks,
}: MissionsModeProps) {
    const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
    const [customGoal, setCustomGoal] = useState('');
    const [targetValue, setTargetValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [mission, setMission] = useState<Mission | null>(null);
    const [error, setError] = useState<string | null>(null);

    const generateMission = async () => {
        const goal = selectedGoal === 'custom'
            ? customGoal
            : `${PRESET_GOALS.find(g => g.id === selectedGoal)?.title} ${targetValue}`;

        if (!goal.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/ai-mission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    goal,
                    category,
                    period,
                    kpis,
                    clusters,
                }),
            });

            const result = await response.json();

            if (result.success) {
                setMission(result.mission);
            } else {
                setError(result.error || 'Ошибка генерации миссии');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleStartMission = () => {
        if (mission && onCreateTasks) {
            onCreateTasks(mission.phases);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <div className="p-4">
                {!mission ? (
                    <>
                        {/* Goal Selection */}
                        <div className="mb-6">
                            <div className="text-sm text-slate-400 mb-3">🎯 Выберите цель</div>

                            <div className="grid grid-cols-1 gap-2 mb-4">
                                {PRESET_GOALS.map((goal) => (
                                    <button
                                        key={goal.id}
                                        onClick={() => setSelectedGoal(goal.id)}
                                        className={`px-4 py-3 rounded-lg text-left transition flex items-center gap-3 ${selectedGoal === goal.id
                                                ? 'bg-purple-600/30 border border-purple-500'
                                                : 'bg-slate-800 hover:bg-slate-700 border border-transparent'
                                            }`}
                                    >
                                        <span className="text-xl">{goal.emoji}</span>
                                        <div className="flex-1">
                                            <div className="font-medium">{goal.title}</div>
                                            <div className="text-xs text-slate-500">{goal.placeholder}</div>
                                        </div>
                                    </button>
                                ))}

                                <button
                                    onClick={() => setSelectedGoal('custom')}
                                    className={`px-4 py-3 rounded-lg text-left transition flex items-center gap-3 ${selectedGoal === 'custom'
                                            ? 'bg-purple-600/30 border border-purple-500'
                                            : 'bg-slate-800 hover:bg-slate-700 border border-transparent'
                                        }`}
                                >
                                    <span className="text-xl">✨</span>
                                    <div className="flex-1">
                                        <div className="font-medium">Своя цель</div>
                                        <div className="text-xs text-slate-500">Опишите что хотите достичь</div>
                                    </div>
                                </button>
                            </div>

                            {/* Target Value Input */}
                            {selectedGoal && selectedGoal !== 'custom' && (
                                <div className="mb-4">
                                    <label className="text-sm text-slate-400 block mb-2">
                                        Укажите значение
                                    </label>
                                    <input
                                        type="text"
                                        value={targetValue}
                                        onChange={(e) => setTargetValue(e.target.value)}
                                        placeholder={PRESET_GOALS.find(g => g.id === selectedGoal)?.placeholder}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                            )}

                            {/* Custom Goal Input */}
                            {selectedGoal === 'custom' && (
                                <div className="mb-4">
                                    <label className="text-sm text-slate-400 block mb-2">
                                        Опишите вашу цель
                                    </label>
                                    <textarea
                                        value={customGoal}
                                        onChange={(e) => setCustomGoal(e.target.value)}
                                        placeholder="Например: Увеличить выручку на 500 000₽ за месяц за счёт оптимизации цен и рекламы"
                                        rows={3}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500 resize-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={generateMission}
                            disabled={!selectedGoal || loading || (selectedGoal !== 'custom' && !targetValue) || (selectedGoal === 'custom' && !customGoal)}
                            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition text-sm"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    AI планирует миссию...
                                </span>
                            ) : (
                                '🚀 Сгенерировать план действий'
                            )}
                        </button>

                        {error && (
                            <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-sm text-red-400">
                                {error}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* Mission View */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-lg">{mission.goal}</h3>
                                <button
                                    onClick={() => setMission(null)}
                                    className="text-slate-400 hover:text-white text-sm"
                                >
                                    ← Назад
                                </button>
                            </div>

                            {mission.predictedImpact && (
                                <div className="p-3 bg-emerald-900/20 border border-emerald-700/50 rounded-lg mb-4">
                                    <div className="text-xs text-emerald-400 mb-1">📈 Прогнозируемый эффект</div>
                                    <div className="text-sm text-emerald-300">{mission.predictedImpact}</div>
                                </div>
                            )}
                        </div>

                        {/* Mission Phases */}
                        <div className="space-y-3 mb-6">
                            {mission.phases.map((phase, index) => (
                                <div key={phase.id} className="bg-slate-800 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 bg-purple-600/30 rounded-full flex items-center justify-center text-sm font-bold">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium mb-1">{phase.name}</div>
                                            <div className="text-sm text-slate-400 mb-2">{phase.description}</div>

                                            {phase.predictedImpact && (
                                                <div className="text-xs text-emerald-400 mb-2">
                                                    💰 {phase.predictedImpact}
                                                </div>
                                            )}

                                            {phase.skus.length > 0 && (
                                                <div className="mt-2">
                                                    <div className="text-xs text-slate-500 mb-1">
                                                        SKU: {phase.skus.length} товаров
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {phase.skus.slice(0, 5).map(s => (
                                                            <span key={s.nmId} className="px-2 py-0.5 bg-slate-700 rounded text-xs">
                                                                {s.sku}
                                                            </span>
                                                        ))}
                                                        {phase.skus.length > 5 && (
                                                            <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-500">
                                                                +{phase.skus.length - 5}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Start Mission Button */}
                        <button
                            onClick={handleStartMission}
                            className="w-full px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 rounded-lg font-medium transition text-sm"
                        >
                            🎯 Запустить миссию (создать {mission.phases.length} задач)
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
