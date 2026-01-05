'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

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

interface AiInsightsPanelProps {
    isOpen: boolean;
    onClose: () => void;
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
    onCreateTask?: (skus: SKUData[], taskType: string) => void;
}

// Actionable insight categories with SKU mappings
const ACTION_CATEGORIES = [
    {
        id: 'oos',
        title: '🚨 Критический OOS',
        description: 'Товары закончились — срочно заказать поставку',
        clusterKey: 'OOS_NOW' as const,
        taskType: 'restock',
        priority: 'critical',
    },
    {
        id: 'oos_soon',
        title: '⚠️ Скоро закончатся',
        description: 'Запас < 7 дней — запланировать поставку',
        clusterKey: 'OOS_SOON' as const,
        taskType: 'restock',
        priority: 'warning',
    },
    {
        id: 'high_drr',
        title: '💸 Высокий ДРР',
        description: 'Реклама убыточна — оптимизировать ставки',
        clusterKey: 'HIGH_DRR' as const,
        taskType: 'ads',
        priority: 'critical',
    },
    {
        id: 'low_ctr',
        title: '👁️ Низкий CTR',
        description: 'Карточки не привлекают — улучшить фото/заголовок',
        clusterKey: 'LOW_CTR' as const,
        taskType: 'photo',
        priority: 'warning',
    },
    {
        id: 'low_cr',
        title: '🛒 Низкая конверсия',
        description: 'Смотрят, но не покупают — проверить цену/описание',
        clusterKey: 'LOW_CR' as const,
        taskType: 'optimize',
        priority: 'warning',
    },
    {
        id: 'low_buyout',
        title: '📦 Низкий выкуп',
        description: 'Заказывают, но не выкупают — проверить качество',
        clusterKey: 'LOW_BUYOUT' as const,
        taskType: 'optimize',
        priority: 'warning',
    },
    {
        id: 'overstock',
        title: '📦 Затоварка',
        description: 'Запас > 90 дней — снизить цену или акция',
        clusterKey: 'OVERSTOCK' as const,
        taskType: 'price_down',
        priority: 'info',
    },
];

export default function AiInsightsPanel({
    isOpen,
    onClose,
    category,
    period,
    kpis,
    clusters,
    onCreateTask,
}: AiInsightsPanelProps) {
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [selectedSKUs, setSelectedSKUs] = useState<Set<number>>(new Set());

    const runAnalysis = async () => {
        if (!kpis || !clusters) return;

        setLoading(true);
        setError(null);
        setAnalysis(null);

        try {
            const response = await fetch('/api/ai-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category,
                    period,
                    kpis,
                    clusters,
                }),
            });

            const result = await response.json();

            if (result.success) {
                setAnalysis(result.analysis);
            } else {
                setError(result.error || 'Неизвестная ошибка');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
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

    const handleCreateTask = (taskType: string) => {
        if (!clusters || selectedSKUs.size === 0) return;

        // Collect all selected SKUs from all clusters
        const allSKUs = [
            ...clusters.OOS_NOW,
            ...clusters.OOS_SOON,
            ...clusters.HIGH_DRR,
            ...clusters.LOW_CTR,
            ...clusters.LOW_CR,
            ...clusters.LOW_BUYOUT,
            ...clusters.OVERSTOCK,
            ...clusters.ABOVE_MARKET,
        ];

        const selectedItems = allSKUs.filter(s => selectedSKUs.has(s.nmId));

        if (onCreateTask) {
            onCreateTask(selectedItems, taskType);
            setSelectedSKUs(new Set());
            onClose();
        }
    };

    if (!isOpen) return null;

    // Get counts for each action category
    const getCategoryCount = (clusterKey: keyof typeof clusters) => {
        if (!clusters) return 0;
        return clusters[clusterKey]?.length || 0;
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-full max-w-3xl bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">🤖</span> AI Анализ
                        </h2>
                        <p className="text-slate-400 text-sm">
                            {category === 'Все' ? 'Все категории' : category} • {period} дней
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedSKUs.size > 0 && (
                            <span className="px-3 py-1 bg-emerald-600/20 text-emerald-400 rounded-full text-sm">
                                {selectedSKUs.size} выбрано
                            </span>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-700 rounded-lg transition"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Actionable Categories Section */}
                    <div className="p-4 border-b border-slate-700">
                        <h3 className="text-sm font-semibold text-slate-400 mb-3">📋 Действия по категориям</h3>
                        <div className="space-y-2">
                            {ACTION_CATEGORIES.map((cat) => {
                                const count = getCategoryCount(cat.clusterKey);
                                if (count === 0) return null;

                                const isExpanded = expandedCategory === cat.id;
                                const skus = clusters?.[cat.clusterKey] || [];

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
                                                {/* Select All + Create Task */}
                                                <div className="flex items-center justify-between mb-3">
                                                    <button
                                                        onClick={() => selectAllInCategory(skus)}
                                                        className="text-sm text-emerald-400 hover:text-emerald-300"
                                                    >
                                                        ✓ Выбрать все ({count})
                                                    </button>
                                                    <button
                                                        onClick={() => handleCreateTask(cat.taskType)}
                                                        disabled={selectedSKUs.size === 0}
                                                        className="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm transition"
                                                    >
                                                        📤 Создать задачу
                                                    </button>
                                                </div>

                                                {/* SKU List */}
                                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                                    {skus.slice(0, 20).map((sku) => (
                                                        <label
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
                                                            <div className="flex-1 min-w-0">
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
                                                            <div className="text-right text-xs text-slate-500">
                                                                {sku.signals[0]?.message?.slice(0, 25) || ''}
                                                            </div>
                                                        </label>
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
                    </div>

                    {/* AI Analysis Section */}
                    <div className="p-4">
                        <h3 className="text-sm font-semibold text-slate-400 mb-3">🧠 AI Рекомендации</h3>

                        {!analysis && !loading && !error && (
                            <div className="text-center py-8 bg-slate-800/50 rounded-lg">
                                <div className="text-4xl mb-3">💡</div>
                                <p className="text-slate-400 mb-4 text-sm">
                                    AI найдёт паттерны и даст персональные рекомендации
                                </p>
                                <button
                                    onClick={runAnalysis}
                                    className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition shadow-lg text-sm"
                                >
                                    🚀 Запустить анализ
                                </button>
                            </div>
                        )}

                        {loading && (
                            <div className="text-center py-8">
                                <div className="relative w-16 h-16 mx-auto mb-3">
                                    <div className="absolute inset-0 rounded-full border-4 border-purple-500/30"></div>
                                    <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center text-2xl">🤖</div>
                                </div>
                                <p className="text-slate-400 text-sm">Анализирую данные...</p>
                            </div>
                        )}

                        {error && (
                            <div className="text-center py-8 bg-red-900/20 rounded-lg">
                                <div className="text-3xl mb-2">❌</div>
                                <p className="text-red-400 text-sm mb-3">{error}</p>
                                <button
                                    onClick={runAnalysis}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition"
                                >
                                    Попробовать снова
                                </button>
                            </div>
                        )}

                        {analysis && (
                            <div className="prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown
                                    components={{
                                        h2: ({ children }) => (
                                            <h2 className="text-lg font-bold mt-5 mb-2 pb-1 border-b border-slate-700 first:mt-0">
                                                {children}
                                            </h2>
                                        ),
                                        ul: ({ children }) => (
                                            <ul className="list-disc list-inside space-y-1 text-slate-300 text-sm">
                                                {children}
                                            </ul>
                                        ),
                                        p: ({ children }) => (
                                            <p className="text-slate-300 mb-2 text-sm">{children}</p>
                                        ),
                                        strong: ({ children }) => (
                                            <strong className="text-white font-semibold">{children}</strong>
                                        ),
                                    }}
                                >
                                    {analysis}
                                </ReactMarkdown>

                                <button
                                    onClick={runAnalysis}
                                    disabled={loading}
                                    className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs transition flex items-center gap-2"
                                >
                                    <span>🔄</span> Обновить анализ
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer with Create Task Button */}
                {selectedSKUs.size > 0 && (
                    <div className="border-t border-slate-700 p-4 bg-slate-800">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-400">
                                Выбрано: <span className="text-white font-semibold">{selectedSKUs.size} SKU</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedSKUs(new Set())}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition"
                                >
                                    Очистить
                                </button>
                                <button
                                    onClick={() => handleCreateTask('optimize')}
                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm transition flex items-center gap-2"
                                >
                                    <span>📤</span> Создать задачу
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
