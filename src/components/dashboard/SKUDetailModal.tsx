'use client';

import { useState } from 'react';
import { SKUData } from '@/types';

interface Signal {
    type: string;
    priority: 'critical' | 'warning' | 'success' | 'info';
    message: string;
    impactPerDay?: number;
    impactPerWeek?: number;
    action?: {
        type: string;
        priority: string;
        details: string;
    };
}

interface SKUDetailModalProps {
    sku: SKUData | null;
    onClose: () => void;
}

// Signal type to human-readable name
const SIGNAL_NAMES: Record<string, string> = {
    OOS_NOW: '🔴 Нет в наличии',
    OOS_SOON: '🟠 Скоро закончится',
    LOW_CTR: '📉 Низкий CTR',
    LOW_CR: '📉 Низкая конверсия',
    LOW_BUYOUT: '📦 Низкий выкуп',
    HIGH_DRR: '💸 Высокий ДРР',
    OVERSTOCK: '📦 Затоваривание',
    FALLING_SALES: '📉 Падение продаж',
    ABOVE_MARKET: '🏆 Выше рынка',
};

// Priority colors
const PRIORITY_STYLES: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

// Format money
const formatMoney = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M ₽`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K ₽`;
    return `${value.toFixed(0)} ₽`;
};

export function SKUDetailModal({ sku, onClose }: SKUDetailModalProps) {
    const [activeTab, setActiveTab] = useState<'signals' | 'metrics' | 'actions'>('signals');

    if (!sku) return null;

    const signals = sku.signals as Signal[] || [];
    const totalImpact = signals.reduce((sum, s) => sum + (s.impactPerWeek || 0), 0);

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-slate-700 shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 border-b border-slate-700">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <div className="text-slate-400 text-sm mb-1">{sku.sku}</div>
                            <h2 className="text-xl font-semibold text-white truncate pr-4">{sku.title}</h2>
                            <div className="flex gap-2 mt-2 text-sm text-slate-400">
                                <span>nmId: {sku.nmId}</span>
                                <span>•</span>
                                <span>{sku.category}</span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-700 rounded-lg transition"
                        >
                            <span className="text-2xl">×</span>
                        </button>
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-4 gap-4 mt-4">
                        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-white">{sku.stockTotal}</div>
                            <div className="text-xs text-slate-400">Остаток</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-white">{sku.stockCoverDays}д</div>
                            <div className="text-xs text-slate-400">Покрытие</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-white">{sku.crCart || '-'}%</div>
                            <div className="text-xs text-slate-400">CTR</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-emerald-400">{formatMoney(sku.orderSum || 0)}</div>
                            <div className="text-xs text-slate-400">Выручка</div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700">
                    {[
                        { id: 'signals', label: `🚨 Сигналы (${signals.length})` },
                        { id: 'metrics', label: '📊 Метрики' },
                        { id: 'actions', label: '✅ Действия' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex-1 py-3 text-sm font-medium transition ${activeTab === tab.id
                                    ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800/50'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[50vh]">
                    {activeTab === 'signals' && (
                        <div className="space-y-4">
                            {/* Total Impact */}
                            {totalImpact > 0 && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">💰</span>
                                        <div>
                                            <div className="text-red-400 font-semibold">
                                                Потенциальные потери: {formatMoney(totalImpact)} / неделю
                                            </div>
                                            <div className="text-sm text-slate-400">
                                                Сумма влияния всех проблем
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Signals list */}
                            {signals.length === 0 ? (
                                <div className="text-center text-slate-400 py-8">
                                    <span className="text-4xl">✅</span>
                                    <div className="mt-2">Нет активных сигналов</div>
                                </div>
                            ) : (
                                signals.map((signal, idx) => (
                                    <div
                                        key={idx}
                                        className={`border rounded-lg p-4 ${PRIORITY_STYLES[signal.priority] || PRIORITY_STYLES.info}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="font-medium">
                                                {SIGNAL_NAMES[signal.type] || signal.type}
                                            </div>
                                            {signal.impactPerWeek && signal.impactPerWeek > 0 && (
                                                <div className="text-sm opacity-80">
                                                    -{formatMoney(signal.impactPerWeek)}/нед
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-sm mt-1 opacity-80">{signal.message}</div>
                                        {signal.action && (
                                            <div className="mt-3 pt-3 border-t border-current/20">
                                                <div className="text-xs uppercase opacity-60 mb-1">Рекомендация:</div>
                                                <div className="text-sm">{signal.action.details}</div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'metrics' && (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Stock metrics */}
                            <div className="bg-slate-800/50 rounded-lg p-4">
                                <div className="text-sm text-slate-400 mb-3">📦 Остатки</div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">На складе</span>
                                        <span className="text-white font-medium">{sku.stockTotal}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">В пути</span>
                                        <span className="text-white font-medium">{sku.inTransit}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Эффективный запас</span>
                                        <span className="text-white font-medium">{sku.effectiveStock}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Дней покрытия</span>
                                        <span className={`font-medium ${parseFloat(sku.stockCoverDays) < 7 ? 'text-red-400' :
                                                parseFloat(sku.stockCoverDays) < 14 ? 'text-yellow-400' :
                                                    'text-white'
                                            }`}>{sku.stockCoverDays}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Sales velocity */}
                            <div className="bg-slate-800/50 rounded-lg p-4">
                                <div className="text-sm text-slate-400 mb-3">📈 Продажи</div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Продаж/день</span>
                                        <span className="text-white font-medium">{sku.ordersPerDay}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Заказов</span>
                                        <span className="text-white font-medium">{sku.orderCount}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Выручка</span>
                                        <span className="text-emerald-400 font-medium">{formatMoney(sku.orderSum || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Funnel metrics */}
                            <div className="bg-slate-800/50 rounded-lg p-4">
                                <div className="text-sm text-slate-400 mb-3">🔍 Воронка</div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Просмотры</span>
                                        <span className="text-white font-medium">{sku.openCount?.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">В корзину</span>
                                        <span className="text-white font-medium">{sku.cartCount?.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">CTR (корзина)</span>
                                        <span className={`font-medium ${parseFloat(sku.crCart || '0') < 4 ? 'text-red-400' : 'text-white'
                                            }`}>{sku.crCart || '-'}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">CR (заказ)</span>
                                        <span className={`font-medium ${parseFloat(sku.crOrder || '0') < 4 ? 'text-yellow-400' : 'text-white'
                                            }`}>{sku.crOrder || '-'}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Advert metrics */}
                            <div className="bg-slate-800/50 rounded-lg p-4">
                                <div className="text-sm text-slate-400 mb-3">📢 Реклама</div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">ДРР</span>
                                        <span className={`font-medium ${parseFloat(sku.drr || '0') > 30 ? 'text-red-400' :
                                                parseFloat(sku.drr || '0') > 20 ? 'text-yellow-400' :
                                                    'text-white'
                                            }`}>{sku.drr || '-'}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Расход</span>
                                        <span className="text-white font-medium">{sku.advertSpend ? formatMoney(parseFloat(sku.advertSpend)) : '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Выкуп</span>
                                        <span className={`font-medium ${parseFloat(sku.buyoutPercent || '0') < 50 ? 'text-yellow-400' : 'text-white'
                                            }`}>{sku.buyoutPercent || '-'}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'actions' && (
                        <div className="space-y-3">
                            {signals.filter(s => s.action).length === 0 ? (
                                <div className="text-center text-slate-400 py-8">
                                    <span className="text-4xl">✅</span>
                                    <div className="mt-2">Нет требуемых действий</div>
                                </div>
                            ) : (
                                signals.filter(s => s.action).map((signal, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-slate-800 rounded-lg p-4 flex items-start gap-4"
                                    >
                                        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${signal.action?.priority === 'today' ? 'bg-red-500/20 text-red-400' :
                                                signal.action?.priority === 'this_week' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-slate-700 text-slate-400'
                                            }`}>
                                            {signal.action?.priority === 'today' ? '🔥' :
                                                signal.action?.priority === 'this_week' ? '📅' : '📋'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <div className="font-medium text-white">
                                                    {signal.action?.details}
                                                </div>
                                                <span className={`text-xs px-2 py-1 rounded ${signal.action?.priority === 'today' ? 'bg-red-500/20 text-red-400' :
                                                        signal.action?.priority === 'this_week' ? 'bg-yellow-500/20 text-yellow-400' :
                                                            'bg-slate-700 text-slate-400'
                                                    }`}>
                                                    {signal.action?.priority === 'today' ? 'Сегодня' :
                                                        signal.action?.priority === 'this_week' ? 'На этой неделе' : 'Плановое'}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-400 mt-1">
                                                Сигнал: {SIGNAL_NAMES[signal.type] || signal.type}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-700 p-4 flex justify-between items-center bg-slate-800/30">
                    <a
                        href={`https://www.wildberries.ru/catalog/${sku.nmId}/detail.aspx`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-slate-400 hover:text-white transition flex items-center gap-2"
                    >
                        <span>🔗</span> Открыть на WB
                    </a>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm"
                    >
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
}
