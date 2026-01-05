'use client';

import { useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    ComposedChart,
} from 'recharts';

interface DailyMetrics {
    date: string;
    orderSum: number;
    orderCount: number;
    avgCheck: number;
    openCount: number;
    cartCount: number;
    buyoutCount: number;
    buyoutSum: number;
    crCart: number;
    crOrder: number;
    buyoutPercent: number;
    advertSpend: number;
    drr: number;
}

interface AnalyticsChartProps {
    category?: string;
    period: number; // Now required from parent
}

const METRICS = {
    orderSum: { label: '💰 Выручка', color: '#10b981', unit: '₽', axis: 'left' },
    orderCount: { label: '📦 Заказы', color: '#3b82f6', unit: 'шт', axis: 'right' },
    avgCheck: { label: '🛒 Средний чек', color: '#f59e0b', unit: '₽', axis: 'left' },
    openCount: { label: '👁️ Просмотры', color: '#8b5cf6', unit: 'шт', axis: 'right' },
    cartCount: { label: '🛍️ В корзину', color: '#ec4899', unit: 'шт', axis: 'right' },
    crCart: { label: '📊 CR корзина', color: '#06b6d4', unit: '%', axis: 'percentage' },
    crOrder: { label: '📈 CR заказ', color: '#14b8a6', unit: '%', axis: 'percentage' },
    buyoutPercent: { label: '✨ Выкуп', color: '#a855f7', unit: '%', axis: 'percentage' },
    drr: { label: '💸 ДРР', color: '#ef4444', unit: '%', axis: 'percentage' },
    advertSpend: { label: '💵 Расход рекл.', color: '#f97316', unit: '₽', axis: 'left' },
};

type MetricKey = keyof typeof METRICS;

export default function AnalyticsChart({ category, period }: AnalyticsChartProps) {
    const [data, setData] = useState<DailyMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricKey>>(
        new Set(['orderSum', 'orderCount'])
    );
    const [totals, setTotals] = useState<Record<string, number>>({});

    useEffect(() => {
        fetchData();
    }, [period, category]);

    async function fetchData() {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ period: period.toString() });
            if (category) params.set('category', category);

            const response = await fetch(`/api/analytics-history?${params}`);
            const result = await response.json();

            if (result.success) {
                setData(result.data);
                setTotals(result.totals);
            } else {
                setError(result.error || 'Ошибка загрузки данных');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    const toggleMetric = (metric: MetricKey) => {
        const newSet = new Set(selectedMetrics);
        if (newSet.has(metric)) {
            newSet.delete(metric);
        } else {
            newSet.add(metric);
        }
        setSelectedMetrics(newSet);
    };

    const formatValue = (value: number, unit: string) => {
        if (unit === '₽') {
            if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
            if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
            return value.toFixed(0);
        }
        if (unit === '%') return `${value.toFixed(1)}%`;
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
        return value.toFixed(0);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    };

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;

        return (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
                <p className="text-slate-400 text-sm mb-2">
                    {new Date(label).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                    })}
                </p>
                {payload.map((entry: any, index: number) => {
                    const metric = METRICS[entry.dataKey as MetricKey];
                    return (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-slate-300">{metric?.label}:</span>
                            <span className="text-white font-semibold">
                                {formatValue(entry.value, metric?.unit || '')}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Get axis domain based on selected metrics
    const getLeftAxisMetrics = Array.from(selectedMetrics).filter(
        (m) => METRICS[m].axis === 'left'
    );
    const getRightAxisMetrics = Array.from(selectedMetrics).filter(
        (m) => METRICS[m].axis === 'right'
    );
    const getPercentageMetrics = Array.from(selectedMetrics).filter(
        (m) => METRICS[m].axis === 'percentage'
    );

    return (
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    📈 Динамика показателей
                    <span className="text-sm font-normal text-slate-500">
                        (период: {period} дней)
                    </span>
                </h2>
            </div>

            {/* Totals Summary */}
            {!loading && totals && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <div className="text-xs text-slate-500">Выручка</div>
                        <div className="text-lg font-bold text-emerald-400">
                            {formatValue(totals.orderSum || 0, '₽')} ₽
                        </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <div className="text-xs text-slate-500">Заказы</div>
                        <div className="text-lg font-bold text-blue-400">
                            {formatValue(totals.orderCount || 0, 'шт')}
                        </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <div className="text-xs text-slate-500">CR заказ</div>
                        <div className="text-lg font-bold text-teal-400">
                            {(totals.crOrder || 0).toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <div className="text-xs text-slate-500">Выкуп</div>
                        <div className="text-lg font-bold text-purple-400">
                            {(totals.buyoutPercent || 0).toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <div className="text-xs text-slate-500">ДРР</div>
                        <div className="text-lg font-bold text-red-400">
                            {(totals.drr || 0).toFixed(1)}%
                        </div>
                    </div>
                </div>
            )}

            {/* Metric Toggles */}
            <div className="flex flex-wrap gap-2 mb-6">
                {(Object.keys(METRICS) as MetricKey[]).map((key) => {
                    const metric = METRICS[key];
                    const isSelected = selectedMetrics.has(key);

                    return (
                        <button
                            key={key}
                            onClick={() => toggleMetric(key)}
                            className={`px-3 py-1.5 rounded-full text-sm transition flex items-center gap-1 ${isSelected
                                ? 'text-white shadow-lg'
                                : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                                }`}
                            style={{
                                backgroundColor: isSelected ? metric.color : undefined,
                            }}
                        >
                            {metric.label}
                        </button>
                    );
                })}
            </div>

            {/* Chart */}
            <div className="h-[400px]">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
                    </div>
                ) : error ? (
                    <div className="h-full flex items-center justify-center text-red-400">
                        {error}
                    </div>
                ) : data.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500">
                        Нет данных за выбранный период
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={formatDate}
                                stroke="#64748b"
                                fontSize={12}
                                tickLine={false}
                            />

                            {/* Left Y Axis (money) */}
                            {getLeftAxisMetrics.length > 0 && (
                                <YAxis
                                    yAxisId="left"
                                    orientation="left"
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickFormatter={(v) => formatValue(v, '₽')}
                                />
                            )}

                            {/* Right Y Axis (counts) */}
                            {getRightAxisMetrics.length > 0 && (
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickFormatter={(v) => formatValue(v, 'шт')}
                                />
                            )}

                            {/* Percentage Y Axis */}
                            {getPercentageMetrics.length > 0 && (
                                <YAxis
                                    yAxisId="percentage"
                                    orientation="right"
                                    stroke="#64748b"
                                    fontSize={12}
                                    domain={[0, 100]}
                                    tickFormatter={(v) => `${v}%`}
                                    hide={getRightAxisMetrics.length > 0}
                                />
                            )}

                            <Tooltip content={<CustomTooltip />} />
                            <Legend />

                            {/* Render selected metrics */}
                            {Array.from(selectedMetrics).map((key) => {
                                const metric = METRICS[key];
                                return (
                                    <Line
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        name={metric.label}
                                        stroke={metric.color}
                                        strokeWidth={2}
                                        dot={false}
                                        yAxisId={
                                            metric.axis === 'left'
                                                ? 'left'
                                                : metric.axis === 'right'
                                                    ? 'right'
                                                    : 'percentage'
                                        }
                                    />
                                );
                            })}
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
