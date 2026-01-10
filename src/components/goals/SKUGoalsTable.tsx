'use client';

import { useState, useMemo } from 'react';
import { SKUData } from '@/types/dashboard';
import { Category, CATEGORY_LABELS } from '@/lib/auth-types';
import {
    SKUClass,
    SKU_CLASS_LABELS,
    SKU_CLASS_COLORS,
    SKUGoalProgress,
    GOAL_STATUS_STYLES,
    DEFAULT_CLASS_BENCHMARKS,
    getSKUOverallStatus,
} from '@/types/sku-goals';
import { classifySKUs, getClassificationStats } from '@/lib/sku-classifier';

interface SKUGoalsTableProps {
    skuData: SKUData[];
    onBulkEdit?: (nmIds: number[], goals: Partial<{ targetCTR: number; targetCRCart: number; targetCROrder: number }>) => void;
}

export function SKUGoalsTable({ skuData, onBulkEdit }: SKUGoalsTableProps) {
    const [selectedNmIds, setSelectedNmIds] = useState<Set<number>>(new Set());
    const [filterClass, setFilterClass] = useState<SKUClass | 'all'>('all');
    const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'exceeds' | 'on_track' | 'at_risk' | 'behind'>('all');
    const [search, setSearch] = useState('');
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50;

    // Классификация SKU
    const classifications = useMemo(() => classifySKUs(skuData), [skuData]);
    const stats = useMemo(() => getClassificationStats(classifications), [classifications]);

    // Обогатить SKU данными классификации и прогресса
    const enrichedData = useMemo(() => {
        return skuData.map(sku => {
            const classification = classifications.get(sku.nmId);
            const skuClass = classification?.skuClass || 'bronze';
            const benchmarks = DEFAULT_CLASS_BENCHMARKS[skuClass];

            const actualCTR = parseFloat(sku.crCart as string) || 0;
            const actualCRCart = parseFloat(sku.crOrder as string) || 0;
            const actualCROrder = parseFloat(sku.buyoutPercent as string) || 0;

            const ctrProgress = benchmarks.ctr > 0 ? (actualCTR / benchmarks.ctr) * 100 : 0;
            const crCartProgress = benchmarks.crCart > 0 ? (actualCRCart / benchmarks.crCart) * 100 : 0;
            const crOrderProgress = benchmarks.crOrder > 0 ? (actualCROrder / benchmarks.crOrder) * 100 : 0;

            const { status, issueCount } = getSKUOverallStatus(ctrProgress, crCartProgress, crOrderProgress);

            return {
                ...sku,
                skuClass,
                targetCTR: benchmarks.ctr,
                targetCRCart: benchmarks.crCart,
                targetCROrder: benchmarks.crOrder,
                actualCTR,
                actualCRCart,
                actualCROrder,
                ctrProgress,
                crCartProgress,
                crOrderProgress,
                status,
                issueCount,
                revenue: classification?.revenue30d || 0,
            };
        });
    }, [skuData, classifications]);

    // Фильтрация
    const filteredData = useMemo(() => {
        return enrichedData.filter(sku => {
            if (filterClass !== 'all' && sku.skuClass !== filterClass) return false;
            if (filterStatus !== 'all' && sku.status !== filterStatus) return false;
            if (search && !sku.sku?.toLowerCase().includes(search.toLowerCase()) &&
                !sku.title?.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [enrichedData, filterClass, filterStatus, search]);

    // Сортировка по выручке
    const sortedData = useMemo(() => {
        return [...filteredData].sort((a, b) => b.revenue - a.revenue);
    }, [filteredData]);

    // Пагинация
    const totalPages = Math.ceil(sortedData.length / pageSize);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [sortedData, currentPage, pageSize]);

    // Сброс страницы при изменении фильтров
    useMemo(() => {
        setCurrentPage(1);
    }, [filterClass, filterStatus, search]);

    // Обработчики
    const handleSelectAll = () => {
        if (selectedNmIds.size === sortedData.length) {
            setSelectedNmIds(new Set());
        } else {
            setSelectedNmIds(new Set(sortedData.map(s => s.nmId)));
        }
    };

    const handleSelect = (nmId: number) => {
        const newSet = new Set(selectedNmIds);
        if (newSet.has(nmId)) {
            newSet.delete(nmId);
        } else {
            newSet.add(nmId);
        }
        setSelectedNmIds(newSet);
    };

    // Прогресс-бар компонент
    const ProgressBar = ({ value, target, label }: { value: number; target: number; label: string }) => {
        const progress = target > 0 ? Math.min(100, (value / target) * 100) : 0;
        const isGood = progress >= 80;
        const isWarning = progress >= 50 && progress < 80;

        return (
            <div className="flex items-center gap-2">
                <div className="w-16 text-right text-xs text-slate-400">{value.toFixed(1)}%</div>
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all ${isGood ? 'bg-green-500' : isWarning ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, progress)}%` }}
                    />
                </div>
                <div className="w-12 text-xs text-slate-500">/ {target}%</div>
            </div>
        );
    };

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700">
            {/* Header */}
            <div className="p-4 border-b border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">🎯 Цели по SKU</h3>
                    {selectedNmIds.size > 0 && (
                        <button
                            onClick={() => setShowBulkModal(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
                        >
                            📝 Изменить цели ({selectedNmIds.size})
                        </button>
                    )}
                </div>

                {/* Stats */}
                <div className="flex gap-4 mb-4">
                    {(['gold', 'silver', 'bronze'] as SKUClass[]).map(cls => (
                        <div
                            key={cls}
                            className={`px-3 py-2 rounded-lg cursor-pointer transition-all ${filterClass === cls
                                ? `${SKU_CLASS_COLORS[cls].bg} ${SKU_CLASS_COLORS[cls].border} border`
                                : 'bg-slate-700/50 hover:bg-slate-700'
                                }`}
                            onClick={() => setFilterClass(filterClass === cls ? 'all' : cls)}
                        >
                            <div className={`text-sm font-medium ${SKU_CLASS_COLORS[cls].text}`}>
                                {SKU_CLASS_LABELS[cls]}
                            </div>
                            <div className="text-xs text-slate-400">{stats.byClass[cls]} SKU</div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex gap-3">
                    <input
                        type="text"
                        placeholder="🔍 Поиск SKU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                    >
                        <option value="all">Все статусы</option>
                        <option value="behind">❌ Отстают</option>
                        <option value="at_risk">⚠️ В зоне риска</option>
                        <option value="on_track">✓ По плану</option>
                        <option value="exceeds">🚀 Перевыполняют</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-900/50">
                        <tr className="text-left text-xs text-slate-400 uppercase">
                            <th className="p-3 w-10">
                                <input
                                    type="checkbox"
                                    checked={selectedNmIds.size === sortedData.length && sortedData.length > 0}
                                    onChange={handleSelectAll}
                                    className="rounded"
                                />
                            </th>
                            <th className="p-3">SKU</th>
                            <th className="p-3 w-20">Класс</th>
                            <th className="p-3 w-48">CTR</th>
                            <th className="p-3 w-48">CR Корзина</th>
                            <th className="p-3 w-48">CR Заказ</th>
                            <th className="p-3 w-24">Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map(sku => {
                            const statusStyle = GOAL_STATUS_STYLES[sku.status];

                            return (
                                <tr
                                    key={sku.nmId}
                                    className={`border-b border-slate-700/50 hover:bg-slate-800/50 transition ${selectedNmIds.has(sku.nmId) ? 'bg-blue-900/20' : ''}`}
                                >
                                    <td className="p-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedNmIds.has(sku.nmId)}
                                            onChange={() => handleSelect(sku.nmId)}
                                            className="rounded"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <div className="text-sm text-white font-medium">{sku.sku}</div>
                                        <div className="text-xs text-slate-400 truncate max-w-xs">{sku.title}</div>
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs ${SKU_CLASS_COLORS[sku.skuClass].bg} ${SKU_CLASS_COLORS[sku.skuClass].text}`}>
                                            {SKU_CLASS_LABELS[sku.skuClass]}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <ProgressBar value={sku.actualCTR} target={sku.targetCTR} label="CTR" />
                                    </td>
                                    <td className="p-3">
                                        <ProgressBar value={sku.actualCRCart} target={sku.targetCRCart} label="CR Cart" />
                                    </td>
                                    <td className="p-3">
                                        <ProgressBar value={sku.actualCROrder} target={sku.targetCROrder} label="CR Order" />
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs ${statusStyle.bg} ${statusStyle.text}`}>
                                            {statusStyle.icon}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer with Pagination */}
            <div className="p-4 border-t border-slate-700 flex items-center justify-between">
                <div className="text-sm text-slate-400">
                    Показано {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, sortedData.length)} из {sortedData.length} SKU
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm"
                    >
                        ««
                    </button>
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm"
                    >
                        ←
                    </button>
                    <span className="text-white text-sm px-2">
                        {currentPage} / {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm"
                    >
                        →
                    </button>
                    <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm"
                    >
                        »»
                    </button>
                </div>
            </div>
        </div>
    );
}
