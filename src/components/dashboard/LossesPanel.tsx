'use client';

import { useMemo } from 'react';
import { SKUData } from '@/types';

interface Signal {
    type: string;
    priority: string;
    impactPerWeek?: number;
}

interface LossesPanelProps {
    allSKUs: (SKUData & { signalType?: string })[];
    selectedCategory?: string;
}

// Signal type icons and colors
const SIGNAL_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    OOS_NOW: { icon: '🔴', color: 'text-red-400', label: 'Нет в наличии' },
    OOS_SOON: { icon: '🟠', color: 'text-orange-400', label: 'Скоро закончится' },
    LOW_CTR: { icon: '📉', color: 'text-yellow-400', label: 'Низкий CTR' },
    LOW_CR: { icon: '📉', color: 'text-yellow-400', label: 'Низкая конверсия' },
    LOW_BUYOUT: { icon: '📦', color: 'text-yellow-400', label: 'Низкий выкуп' },
    HIGH_DRR: { icon: '💸', color: 'text-red-400', label: 'Высокий ДРР' },
    OVERSTOCK: { icon: '📦', color: 'text-blue-400', label: 'Затоваривание' },
    FALLING_SALES: { icon: '📉', color: 'text-red-400', label: 'Падение продаж' },
};

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
    'Уход за лицом': 'bg-pink-500',
    'Уход за телом': 'bg-purple-500',
    'Макияж': 'bg-rose-500',
    'Уход за волосами': 'bg-violet-500',
};

const formatMoney = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M ₽`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K ₽`;
    return `${value.toFixed(0)} ₽`;
};

export function LossesPanel({ allSKUs, selectedCategory }: LossesPanelProps) {
    const analysis = useMemo(() => {
        // Filter by category if selected
        let skus = allSKUs;
        if (selectedCategory && selectedCategory !== 'Все') {
            const categoryMap: Record<string, string[]> = {
                'Лицо': ['Уход за лицом'],
                'Тело': ['Уход за телом'],
                'Макияж': ['Макияж'],
                'Волосы': ['Уход за волосами'],
            };
            const allowed = categoryMap[selectedCategory] || [];
            skus = allSKUs.filter(s =>
                allowed.some(cat => s.category?.toLowerCase() === cat.toLowerCase())
            );
        }

        // Calculate totals
        let totalImpact = 0;
        const byCategory: Record<string, { impact: number; count: number }> = {};
        const bySignalType: Record<string, { impact: number; count: number }> = {};

        skus.forEach(sku => {
            const signals = (sku.signals || []) as Signal[];
            const category = sku.category || 'Другое';

            signals.forEach(signal => {
                const impact = signal.impactPerWeek || 0;
                totalImpact += impact;

                // By category
                if (!byCategory[category]) {
                    byCategory[category] = { impact: 0, count: 0 };
                }
                byCategory[category].impact += impact;
                byCategory[category].count++;

                // By signal type
                if (!bySignalType[signal.type]) {
                    bySignalType[signal.type] = { impact: 0, count: 0 };
                }
                bySignalType[signal.type].impact += impact;
                bySignalType[signal.type].count++;
            });
        });

        // Sort by impact
        const categoriesSorted = Object.entries(byCategory)
            .sort(([, a], [, b]) => b.impact - a.impact)
            .slice(0, 4);

        const signalsSorted = Object.entries(bySignalType)
            .sort(([, a], [, b]) => b.impact - a.impact)
            .slice(0, 5);

        return { totalImpact, categoriesSorted, signalsSorted };
    }, [allSKUs, selectedCategory]);

    if (analysis.totalImpact === 0) {
        return null;
    }

    return (
        <div className="bg-gradient-to-r from-red-900/20 to-orange-900/20 border border-red-500/30 rounded-xl p-5 mb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">💰</span>
                    <div>
                        <div className="text-sm text-slate-400">Потенциальные потери</div>
                        <div className="text-2xl font-bold text-red-400">
                            {formatMoney(analysis.totalImpact)} / неделю
                        </div>
                    </div>
                </div>
                <div className="text-right text-sm text-slate-400">
                    {selectedCategory && selectedCategory !== 'Все'
                        ? `Категория: ${selectedCategory}`
                        : 'Все категории'}
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                {/* By Category */}
                <div className="bg-slate-900/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400 mb-3">По категориям</div>
                    <div className="space-y-2">
                        {analysis.categoriesSorted.map(([category, data]) => {
                            const pct = analysis.totalImpact > 0 ? (data.impact / analysis.totalImpact) * 100 : 0;
                            const barColor = CATEGORY_COLORS[category] || 'bg-slate-500';

                            return (
                                <div key={category} className="flex items-center gap-3">
                                    <div className="w-24 truncate text-sm text-slate-300">{category.split(' ')[2] || category}</div>
                                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${barColor} transition-all`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <div className="w-20 text-right text-sm text-slate-300">
                                        {formatMoney(data.impact)}
                                    </div>
                                    <div className="w-12 text-right text-xs text-slate-500">
                                        {pct.toFixed(0)}%
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* By Signal Type */}
                <div className="bg-slate-900/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400 mb-3">По типам проблем</div>
                    <div className="space-y-2">
                        {analysis.signalsSorted.map(([type, data]) => {
                            const config = SIGNAL_CONFIG[type] || { icon: '⚠️', color: 'text-slate-400', label: type };

                            return (
                                <div key={type} className="flex items-center gap-3">
                                    <span className="text-sm">{config.icon}</span>
                                    <div className={`flex-1 text-sm ${config.color}`}>
                                        {config.label}
                                    </div>
                                    <div className="text-sm text-slate-300">
                                        {formatMoney(data.impact)}
                                    </div>
                                    <div className="text-xs text-slate-500 w-16 text-right">
                                        ({data.count} SKU)
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
