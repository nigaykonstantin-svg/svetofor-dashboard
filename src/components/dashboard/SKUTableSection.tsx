'use client';

import { useState } from 'react';
import { SKUData, SortField, SortDirection, formatMoney } from '@/types';

interface ColumnVisibility {
    sku: boolean;
    title: boolean;
    brandName: boolean;
    subjectName: boolean;
    category: boolean;
    subCategory: boolean;
    brandManager: boolean;
    categoryManager: boolean;
    stock: boolean;
    inTransit: boolean;
    stocksWb: boolean;
    stocksMp: boolean;
    salesPerDay: boolean;
    coverDays: boolean;
    views: boolean;
    cartCount: boolean;
    orderCount: boolean;
    buyoutCount: boolean;
    buyoutSum: boolean;
    ctr: boolean;
    crCart: boolean;
    crOrder: boolean;
    buyout: boolean;
    drr: boolean;
    advertSpend: boolean;
    orderSum: boolean;
    signal: boolean;
}

interface AdvancedFilters {
    stockMin: string;
    stockMax: string;
    daysMin: string;
    daysMax: string;
    ctrMin: string;
    ctrMax: string;
    crMin: string;
    crMax: string;
    drrMin: string;
    drrMax: string;
    salesMin: string;
    salesMax: string;
}

interface SKUTableSectionProps {
    filteredSKUs: SKUData[];
    paginatedSKUs: SKUData[];
    selectedSKUs: Set<number>;
    onSelectSKU: (nmId: number) => void;
    onSelectAll: (select: boolean) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    sortField: SortField;
    sortDirection: SortDirection;
    onSort: (field: SortField) => void;
    columns: ColumnVisibility;
    onColumnsChange: (columns: ColumnVisibility) => void;
    filters: AdvancedFilters;
    onFiltersChange: (filters: AdvancedFilters) => void;
    currentPage: number;
    totalPages: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onCreateTask: () => void;
    onExport: () => void;
}

const COLUMN_OPTIONS = [
    { key: 'sku', label: 'Артикул' },
    { key: 'title', label: 'Название' },
    { key: 'brandName', label: 'Бренд' },
    { key: 'subjectName', label: 'Предмет' },
    { key: 'category', label: 'Категория' },
    { key: 'subCategory', label: 'Суб-категория' },
    { key: 'brandManager', label: 'Бренд-менеджер' },
    { key: 'categoryManager', label: 'Катег. менедж.' },
    { key: 'stock', label: 'Остаток' },
    { key: 'inTransit', label: 'В пути' },
    { key: 'stocksWb', label: 'Остаток WB' },
    { key: 'stocksMp', label: 'Остаток МП' },
    { key: 'salesPerDay', label: 'Продаж/день' },
    { key: 'coverDays', label: 'Дней' },
    { key: 'views', label: 'Просмотры' },
    { key: 'cartCount', label: 'В корзину' },
    { key: 'orderCount', label: 'Заказы шт' },
    { key: 'buyoutCount', label: 'Выкупы шт' },
    { key: 'buyoutSum', label: 'Выкупы ₽' },
    { key: 'ctr', label: 'CTR %' },
    { key: 'crCart', label: 'CR корзина' },
    { key: 'crOrder', label: 'CR заказ' },
    { key: 'buyout', label: 'Выкуп %' },
    { key: 'drr', label: 'ДРР' },
    { key: 'advertSpend', label: 'Расход рек.' },
    { key: 'orderSum', label: 'Выручка' },
    { key: 'signal', label: 'Сигнал' },
];

export default function SKUTableSection({
    filteredSKUs,
    paginatedSKUs,
    selectedSKUs,
    onSelectSKU,
    onSelectAll,
    searchQuery,
    onSearchChange,
    sortField,
    sortDirection,
    onSort,
    columns,
    onColumnsChange,
    filters,
    onFiltersChange,
    currentPage,
    totalPages,
    itemsPerPage,
    onPageChange,
    onCreateTask,
    onExport,
}: SKUTableSectionProps) {
    const [showFilters, setShowFilters] = useState(false);
    const [showColumns, setShowColumns] = useState(false);

    const allSelected = paginatedSKUs.length > 0 && paginatedSKUs.every(s => selectedSKUs.has(s.nmId));

    const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
        <th
            className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
            onClick={() => onSort(field)}
        >
            <span className="flex items-center gap-1">
                {children}
                {sortField === field && (
                    <span className="text-emerald-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
            </span>
        </th>
    );

    return (
        <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-800">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-64">
                        <input
                            type="text"
                            placeholder="🔍 Поиск по артикулу, названию, nmId..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-4 py-2 rounded-lg transition flex items-center gap-2 text-sm ${showFilters ? 'bg-purple-600 text-white' : 'bg-slate-800 hover:bg-slate-700'
                            }`}
                    >
                        <span>🎛️</span> Фильтры
                    </button>
                    <button
                        onClick={() => setShowColumns(!showColumns)}
                        className={`px-4 py-2 rounded-lg transition flex items-center gap-2 text-sm ${showColumns ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700'
                            }`}
                    >
                        <span>📋</span> Колонки
                    </button>
                    <div className="text-slate-400 text-sm">
                        Найдено: <span className="text-white font-semibold">{filteredSKUs.length}</span> SKU
                        {selectedSKUs.size > 0 && (
                            <span className="ml-2 text-emerald-400">
                                ({selectedSKUs.size} выбрано)
                            </span>
                        )}
                    </div>
                    {selectedSKUs.size > 0 && (
                        <button
                            onClick={onCreateTask}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition flex items-center gap-2 text-sm"
                        >
                            <span>📤</span> Создать задачу
                        </button>
                    )}
                    <button
                        onClick={onExport}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition flex items-center gap-2 text-sm"
                    >
                        <span>📥</span> Экспорт
                    </button>
                </div>

                {/* Column Selector */}
                {showColumns && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                        <div className="text-sm text-slate-400 mb-2">Показать колонки:</div>
                        <div className="flex flex-wrap gap-2">
                            {COLUMN_OPTIONS.map(col => (
                                <label
                                    key={col.key}
                                    className={`px-3 py-1 rounded-full text-sm cursor-pointer transition ${columns[col.key as keyof ColumnVisibility]
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={columns[col.key as keyof ColumnVisibility]}
                                        onChange={() => onColumnsChange({
                                            ...columns,
                                            [col.key]: !columns[col.key as keyof ColumnVisibility],
                                        })}
                                    />
                                    {col.label}
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* Advanced Filters */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Остаток от</label>
                                <input
                                    type="number"
                                    value={filters.stockMin}
                                    onChange={(e) => onFiltersChange({ ...filters, stockMin: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1 text-sm"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Остаток до</label>
                                <input
                                    type="number"
                                    value={filters.stockMax}
                                    onChange={(e) => onFiltersChange({ ...filters, stockMax: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1 text-sm"
                                    placeholder="∞"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Дней от</label>
                                <input
                                    type="number"
                                    value={filters.daysMin}
                                    onChange={(e) => onFiltersChange({ ...filters, daysMin: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1 text-sm"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Дней до</label>
                                <input
                                    type="number"
                                    value={filters.daysMax}
                                    onChange={(e) => onFiltersChange({ ...filters, daysMax: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1 text-sm"
                                    placeholder="∞"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">ДРР от %</label>
                                <input
                                    type="number"
                                    value={filters.drrMin}
                                    onChange={(e) => onFiltersChange({ ...filters, drrMin: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1 text-sm"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">ДРР до %</label>
                                <input
                                    type="number"
                                    value={filters.drrMax}
                                    onChange={(e) => onFiltersChange({ ...filters, drrMax: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1 text-sm"
                                    placeholder="∞"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-800/50 sticky top-0">
                        <tr>
                            <th className="w-10 px-3 py-3">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={(e) => onSelectAll(e.target.checked)}
                                    className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                                />
                            </th>
                            {columns.sku && <SortableHeader field="sku">Артикул</SortableHeader>}
                            {columns.title && <SortableHeader field="title">Название</SortableHeader>}
                            {columns.stock && <SortableHeader field="stockTotal">Остаток</SortableHeader>}
                            {columns.salesPerDay && <SortableHeader field="ordersPerDay">Прод/день</SortableHeader>}
                            {columns.coverDays && <SortableHeader field="stockCoverDays">Дней</SortableHeader>}
                            {columns.crCart && <SortableHeader field="crCart">CR корз.</SortableHeader>}
                            {columns.crOrder && <SortableHeader field="crOrder">CR заказ</SortableHeader>}
                            {columns.drr && <SortableHeader field="drr">ДРР</SortableHeader>}
                            {columns.orderSum && <SortableHeader field="orderSum">Выручка</SortableHeader>}
                            {columns.signal && <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase">Сигнал</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {paginatedSKUs.map((item) => {
                            const isSelected = selectedSKUs.has(item.nmId);
                            return (
                                <tr
                                    key={item.nmId}
                                    className={`hover:bg-slate-800/50 transition ${isSelected ? 'bg-emerald-900/20' : ''}`}
                                >
                                    <td className="px-3 py-3">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => onSelectSKU(item.nmId)}
                                            className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                                        />
                                    </td>
                                    {columns.sku && (
                                        <td className="px-3 py-3 text-sm font-mono">
                                            <a
                                                href={`https://www.wildberries.ru/catalog/${item.nmId}/detail.aspx`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-400 hover:text-blue-300 hover:underline"
                                            >
                                                {item.sku}
                                            </a>
                                        </td>
                                    )}
                                    {columns.title && (
                                        <td className="px-3 py-3 text-sm max-w-xs truncate" title={item.title}>
                                            {item.title}
                                        </td>
                                    )}
                                    {columns.stock && (
                                        <td className={`px-3 py-3 text-sm ${item.stockTotal < 10 ? 'text-red-400' : ''}`}>
                                            {item.stockTotal.toLocaleString()}
                                        </td>
                                    )}
                                    {columns.salesPerDay && (
                                        <td className="px-3 py-3 text-sm">{item.ordersPerDay}</td>
                                    )}
                                    {columns.coverDays && (
                                        <td className={`px-3 py-3 text-sm ${parseFloat(item.stockCoverDays) < 7 ? 'text-red-400' :
                                                parseFloat(item.stockCoverDays) < 14 ? 'text-yellow-400' : ''
                                            }`}>
                                            {item.stockCoverDays}
                                        </td>
                                    )}
                                    {columns.crCart && <td className="px-3 py-3 text-sm">{item.crCart || '—'}</td>}
                                    {columns.crOrder && <td className="px-3 py-3 text-sm">{item.crOrder || '—'}</td>}
                                    {columns.drr && (
                                        <td className={`px-3 py-3 text-sm ${parseFloat(item.drr || '0') > 50 ? 'text-red-400' :
                                                parseFloat(item.drr || '0') > 30 ? 'text-yellow-400' : ''
                                            }`}>
                                            {item.drr || '—'}
                                        </td>
                                    )}
                                    {columns.orderSum && (
                                        <td className="px-3 py-3 text-sm">{formatMoney(item.orderSum)} ₽</td>
                                    )}
                                    {columns.signal && (
                                        <td className="px-3 py-3 text-sm">
                                            {item.signals[0] && (
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${item.signals[0].priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                                        item.signals[0].priority === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                                            'bg-green-500/20 text-green-400'
                                                    }`}>
                                                    {item.signals[0].type}
                                                </span>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-t border-slate-700">
                    <div className="text-slate-400 text-sm">
                        Показано {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredSKUs.length)} из {filteredSKUs.length} SKU
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onPageChange(1)}
                            disabled={currentPage === 1}
                            className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            «
                        </button>
                        <button
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            ←
                        </button>
                        <span className="px-3 py-1 text-sm">
                            <span className="text-white font-semibold">{currentPage}</span>
                            <span className="text-slate-500"> / {totalPages}</span>
                        </span>
                        <button
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            →
                        </button>
                        <button
                            onClick={() => onPageChange(totalPages)}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            »
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
