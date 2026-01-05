'use client';

import { useState } from 'react';

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

interface ActionsModeProps {
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
    onCreateTask?: (skus: SKUData[], taskType: string, aiSuggestion: string) => void;
    onSkuDeepDive?: (sku: SKUData) => void;
}

const ACTION_CATEGORIES = [
    {
        id: 'oos',
        title: '🚨 Критический OOS',
        description: 'Товары закончились — срочно заказать поставку',
        clusterKey: 'OOS_NOW' as const,
        taskType: 'restock',
        priority: 'critical',
        aiAction: 'Рассчитать оптимальный объём поставки',
    },
    {
        id: 'oos_soon',
        title: '⚠️ Скоро закончатся',
        description: 'Запас < 7 дней — запланировать поставку',
        clusterKey: 'OOS_SOON' as const,
        taskType: 'restock',
        priority: 'warning',
        aiAction: 'Приоритизировать по выручке и срочности',
    },
    {
        id: 'high_drr',
        title: '💸 Высокий ДРР',
        description: 'Реклама убыточна — оптимизировать ставки',
        clusterKey: 'HIGH_DRR' as const,
        taskType: 'ads',
        priority: 'critical',
        aiAction: 'Предложить новые ставки по каждому SKU',
    },
    {
        id: 'low_ctr',
        title: '👁️ Низкий CTR',
        description: 'Карточки не привлекают — улучшить фото/заголовок',
        clusterKey: 'LOW_CTR' as const,
        taskType: 'photo',
        priority: 'warning',
        aiAction: 'Сгенерировать рекомендации по визуалу',
    },
    {
        id: 'low_cr',
        title: '🛒 Низкая конверсия',
        description: 'Смотрят, но не покупают — проверить цену/описание',
        clusterKey: 'LOW_CR' as const,
        taskType: 'optimize',
        priority: 'warning',
        aiAction: 'Проанализировать ценовое позиционирование',
    },
    {
        id: 'low_buyout',
        title: '📦 Низкий выкуп',
        description: 'Заказывают, но не выкупают — проверить качество',
        clusterKey: 'LOW_BUYOUT' as const,
        taskType: 'optimize',
        priority: 'warning',
        aiAction: 'Проверить отзывы и качество',
    },
    {
        id: 'overstock',
        title: '📦 Затоварка',
        description: 'Запас > 90 дней — снизить цену или акция',
        clusterKey: 'OVERSTOCK' as const,
        taskType: 'price_down',
        priority: 'info',
        aiAction: 'Рассчитать оптимальную скидку',
    },
];

export default function ActionsMode({
    clusters,
    onCreateTask,
    onSkuDeepDive,
}: ActionsModeProps) {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [selectedSKUs, setSelectedSKUs] = useState<Set<number>>(new Set());
    const [generatingAI, setGeneratingAI] = useState<string | null>(null);
    const [aiSuggestions, setAiSuggestions] = useState<Record<string, string>>({});

    const getCategoryCount = (clusterKey: keyof NonNullable<typeof clusters>) => {
        if (!clusters) return 0;
        return clusters[clusterKey]?.length || 0;
    };

    const toggleSKU = (nmId: number) => {
        const newSet = new Set(selectedSKUs);
        if (newSet.has(nmId)) {
            newSet.delete(nmId);
        } else {
            newSet.add(nmId);
        }
        setSelectedSKUs(newSet);
    };

    const selectAllInCategory = (skus: SKUData[]) => {
        const newSet = new Set(selectedSKUs);
        skus.forEach(s => newSet.add(s.nmId));
        setSelectedSKUs(newSet);
    };

    const generateAISuggestion = async (cat: typeof ACTION_CATEGORIES[0], skus: SKUData[]) => {
        setGeneratingAI(cat.id);

        try {
            const response = await fetch('/api/ai-task-suggestion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actionType: cat.id,
                    taskType: cat.taskType,
                    skus: skus.slice(0, 10), // Limit for API
                }),
            });

            const result = await response.json();
            if (result.success) {
                setAiSuggestions(prev => ({ ...prev, [cat.id]: result.suggestion }));
            }
        } catch (error) {
            console.error('AI suggestion error:', error);
        } finally {
            setGeneratingAI(null);
        }
    };

    const handleCreateTask = (cat: typeof ACTION_CATEGORIES[0]) => {
        if (!clusters || selectedSKUs.size === 0) return;

        const skus = clusters[cat.clusterKey] || [];
        const selectedItems = skus.filter(s => selectedSKUs.has(s.nmId));
        const suggestion = aiSuggestions[cat.id] || '';

        if (onCreateTask) {
            onCreateTask(selectedItems, cat.taskType, suggestion);
            setSelectedSKUs(new Set());
        }
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <div className="p-4">
                <div className="text-sm text-slate-400 mb-3">
                    📋 Проблемы по категориям — выберите SKU и создайте задачи
                </div>

                <div className="space-y-2">
                    {ACTION_CATEGORIES.map((cat) => {
                        const count = getCategoryCount(cat.clusterKey);
                        if (count === 0) return null;

                        const isExpanded = expandedCategory === cat.id;
                        const skus = clusters?.[cat.clusterKey] || [];
                        const hasSuggestion = !!aiSuggestions[cat.id];

                        return (
                            <div key={cat.id} className="bg-slate-800 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`w-2 h-2 rounded-full ${cat.priority === 'critical' ? 'bg-red-500' :
                                                cat.priority === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                                            }`} />
                                        <div className="text-left">
                                            <div className="font-medium">{cat.title}</div>
                                            <div className="text-xs text-slate-500">{cat.description}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-1 bg-slate-700 rounded text-sm font-mono">
                                            {count}
                                        </span>
                                        <svg
                                            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-slate-700 p-3">
                                        {/* Actions Bar */}
                                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                            <button
                                                onClick={() => selectAllInCategory(skus)}
                                                className="text-sm text-emerald-400 hover:text-emerald-300"
                                            >
                                                ✓ Выбрать все ({count})
                                            </button>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => generateAISuggestion(cat, skus)}
                                                    disabled={generatingAI === cat.id}
                                                    className="px-3 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 rounded text-sm transition flex items-center gap-1"
                                                >
                                                    {generatingAI === cat.id ? (
                                                        <>⏳ Генерирую...</>
                                                    ) : (
                                                        <>🧠 {cat.aiAction}</>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleCreateTask(cat)}
                                                    disabled={selectedSKUs.size === 0}
                                                    className="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm transition"
                                                >
                                                    📤 Создать задачу
                                                </button>
                                            </div>
                                        </div>

                                        {/* AI Suggestion */}
                                        {hasSuggestion && (
                                            <div className="mb-3 p-3 bg-purple-900/20 border border-purple-700/50 rounded-lg">
                                                <div className="text-xs text-purple-400 mb-1">🧠 AI Рекомендация:</div>
                                                <div className="text-sm text-slate-300">{aiSuggestions[cat.id]}</div>
                                            </div>
                                        )}

                                        {/* SKU List */}
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                            {skus.slice(0, 20).map((sku) => (
                                                <div
                                                    key={sku.nmId}
                                                    className={`flex items-center gap-3 p-2 rounded cursor-pointer transition ${selectedSKUs.has(sku.nmId)
                                                            ? 'bg-emerald-900/30 border border-emerald-700'
                                                            : 'bg-slate-700/30 hover:bg-slate-700/50'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSKUs.has(sku.nmId)}
                                                        onChange={() => toggleSKU(sku.nmId)}
                                                        className="w-4 h-4 rounded bg-slate-600 border-slate-500 text-emerald-500"
                                                    />
                                                    <div
                                                        className="flex-1 min-w-0 cursor-pointer"
                                                        onClick={() => onSkuDeepDive?.(sku)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs text-slate-400">{sku.sku}</span>
                                                            {sku.drr && parseFloat(sku.drr) > 30 && (
                                                                <span className="px-1 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">
                                                                    ДРР {sku.drr}%
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-sm truncate">{sku.title}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => onSkuDeepDive?.(sku)}
                                                        className="p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-white transition"
                                                        title="Детальный анализ"
                                                    >
                                                        🔍
                                                    </button>
                                                </div>
                                            ))}
                                            {skus.length > 20 && (
                                                <div className="text-center text-sm text-slate-500 py-2">
                                                    и ещё {skus.length - 20} товаров...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* No issues message */}
                {ACTION_CATEGORIES.every(cat => getCategoryCount(cat.clusterKey) === 0) && (
                    <div className="text-center py-12 text-slate-500">
                        <div className="text-4xl mb-3">✅</div>
                        <p>Нет проблемных SKU в выбранной категории</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            {selectedSKUs.size > 0 && (
                <div className="border-t border-slate-700 p-4 bg-slate-800 sticky bottom-0">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-400">
                            Выбрано: <span className="text-white font-semibold">{selectedSKUs.size} SKU</span>
                        </div>
                        <button
                            onClick={() => setSelectedSKUs(new Set())}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition"
                        >
                            Очистить выбор
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
