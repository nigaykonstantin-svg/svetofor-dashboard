'use client';

import { useState } from 'react';
import { Scenario, ScenarioChanges, ScenarioPrediction } from './types';

interface ScenariosModeProps {
    category: string;
    kpis: {
        totalOrderSum: number;
        totalOrders: number;
        avgCheck: number;
        avgDRR: number;
        skuCount: number;
    } | null;
}

export default function ScenariosMode({
    category,
    kpis,
}: ScenariosModeProps) {
    const [changes, setChanges] = useState<ScenarioChanges>({
        priceChangePercent: 0,
        budgetChangePercent: 0,
        newSKUs: 0,
    });
    const [loading, setLoading] = useState(false);
    const [prediction, setPrediction] = useState<ScenarioPrediction | null>(null);
    const [savedScenarios, setSavedScenarios] = useState<Scenario[]>([]);
    const [error, setError] = useState<string | null>(null);

    const calculateScenario = async () => {
        if (!kpis) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/ai-scenario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    changes,
                    category,
                    currentKpis: kpis,
                }),
            });

            const result = await response.json();

            if (result.success) {
                setPrediction(result.prediction);
            } else {
                setError(result.error || 'Ошибка расчёта');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    const saveScenario = () => {
        if (!prediction) return;

        const newScenario: Scenario = {
            id: Date.now().toString(),
            name: `Сценарий ${savedScenarios.length + 1}`,
            changes: { ...changes },
            prediction,
            createdAt: new Date().toISOString(),
        };

        setSavedScenarios(prev => [...prev, newScenario]);
    };

    const formatChange = (change: number) => {
        if (change === 0) return '0%';
        return change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
    };

    const formatMoney = (value: number) => {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M₽`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)}K₽`;
        return `${value.toFixed(0)}₽`;
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <div className="p-4">
                <div className="text-sm text-slate-400 mb-4">
                    🔮 Моделирование сценариев — измените параметры и посмотрите прогноз
                </div>

                {/* Parameters */}
                <div className="space-y-4 mb-6">
                    {/* Price Change */}
                    <div className="bg-slate-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm">📊 Изменение цены</span>
                            <span className={`font-mono font-bold ${(changes.priceChangePercent || 0) > 0 ? 'text-green-400' :
                                    (changes.priceChangePercent || 0) < 0 ? 'text-red-400' : 'text-slate-400'
                                }`}>
                                {formatChange(changes.priceChangePercent || 0)}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="-30"
                            max="30"
                            step="1"
                            value={changes.priceChangePercent || 0}
                            onChange={(e) => setChanges({ ...changes, priceChangePercent: parseInt(e.target.value) })}
                            className="w-full accent-purple-500"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>-30%</span>
                            <span>0%</span>
                            <span>+30%</span>
                        </div>
                    </div>

                    {/* Budget Change */}
                    <div className="bg-slate-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm">📢 Рекламный бюджет</span>
                            <span className={`font-mono font-bold ${(changes.budgetChangePercent || 0) > 0 ? 'text-green-400' :
                                    (changes.budgetChangePercent || 0) < 0 ? 'text-red-400' : 'text-slate-400'
                                }`}>
                                {formatChange(changes.budgetChangePercent || 0)}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="-50"
                            max="100"
                            step="5"
                            value={changes.budgetChangePercent || 0}
                            onChange={(e) => setChanges({ ...changes, budgetChangePercent: parseInt(e.target.value) })}
                            className="w-full accent-purple-500"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>-50%</span>
                            <span>0%</span>
                            <span>+100%</span>
                        </div>
                    </div>

                    {/* New SKUs */}
                    <div className="bg-slate-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm">📦 Новые SKU</span>
                            <span className="font-mono font-bold text-blue-400">
                                +{changes.newSKUs || 0} шт
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="20"
                            step="1"
                            value={changes.newSKUs || 0}
                            onChange={(e) => setChanges({ ...changes, newSKUs: parseInt(e.target.value) })}
                            className="w-full accent-purple-500"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>0</span>
                            <span>10</span>
                            <span>20</span>
                        </div>
                    </div>
                </div>

                {/* Calculate Button */}
                <button
                    onClick={calculateScenario}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 rounded-lg font-medium transition text-sm mb-6"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Рассчитываю...
                        </span>
                    ) : (
                        '🧮 Рассчитать прогноз'
                    )}
                </button>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* Prediction Results */}
                {prediction && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold">📈 Прогноз</h3>
                            <button
                                onClick={saveScenario}
                                className="text-sm text-purple-400 hover:text-purple-300"
                            >
                                💾 Сохранить
                            </button>
                        </div>

                        {/* Metrics Cards */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-800 rounded-lg p-3 text-center">
                                <div className="text-xs text-slate-500 mb-1">Выручка</div>
                                <div className="font-bold">{formatMoney(prediction.revenue.predicted)}</div>
                                <div className={`text-xs ${prediction.revenue.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatChange(prediction.revenue.change)}
                                </div>
                            </div>
                            <div className="bg-slate-800 rounded-lg p-3 text-center">
                                <div className="text-xs text-slate-500 mb-1">Заказы</div>
                                <div className="font-bold">{prediction.orders.predicted.toLocaleString()}</div>
                                <div className={`text-xs ${prediction.orders.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatChange(prediction.orders.change)}
                                </div>
                            </div>
                            <div className="bg-slate-800 rounded-lg p-3 text-center">
                                <div className="text-xs text-slate-500 mb-1">Маржа</div>
                                <div className="font-bold">{formatMoney(prediction.margin.predicted)}</div>
                                <div className={`text-xs ${prediction.margin.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatChange(prediction.margin.change)}
                                </div>
                            </div>
                        </div>

                        {/* Risks */}
                        {prediction.risks.length > 0 && (
                            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
                                <div className="text-xs text-red-400 mb-2">⚠️ Риски</div>
                                <ul className="text-sm text-slate-300 space-y-1">
                                    {prediction.risks.map((risk, i) => (
                                        <li key={i}>• {risk}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Opportunities */}
                        {prediction.opportunities.length > 0 && (
                            <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3">
                                <div className="text-xs text-emerald-400 mb-2">💡 Возможности</div>
                                <ul className="text-sm text-slate-300 space-y-1">
                                    {prediction.opportunities.map((opp, i) => (
                                        <li key={i}>• {opp}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Saved Scenarios */}
                {savedScenarios.length > 0 && (
                    <div className="mt-6">
                        <h3 className="font-bold mb-3">💾 Сохранённые сценарии</h3>
                        <div className="space-y-2">
                            {savedScenarios.map(scenario => (
                                <div key={scenario.id} className="bg-slate-800 rounded-lg p-3 flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium">{scenario.name}</div>
                                        <div className="text-xs text-slate-500">
                                            Цена: {formatChange(scenario.changes.priceChangePercent || 0)} |
                                            Бюджет: {formatChange(scenario.changes.budgetChangePercent || 0)} |
                                            SKU: +{scenario.changes.newSKUs || 0}
                                        </div>
                                    </div>
                                    {scenario.prediction && (
                                        <div className={`text-sm font-bold ${scenario.prediction.revenue.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatChange(scenario.prediction.revenue.change)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
