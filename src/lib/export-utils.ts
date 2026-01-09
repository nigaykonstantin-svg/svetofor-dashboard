// Export utilities for dashboard data

import { SKUData } from '@/types';

/**
 * Export SKUs to CSV format
 * @param skus - Array of SKU data to export
 * @param filename - Optional custom filename (defaults to date-based name)
 */
export function exportSKUsToCSV(
    skus: (SKUData & { signalType?: string })[],
    filename?: string
): void {
    if (skus.length === 0) return;

    const headers = [
        'Артикул',
        'nmId',
        'Название',
        'Категория',
        'Остаток',
        'В пути',
        'Продаж/день',
        'Дней покрытия',
        'CTR%',
        'CR%',
        'Выкуп%',
        'ДРР%',
        'Выручка',
        'Сигнал'
    ];

    const rows = skus.map(s => [
        s.sku,
        s.nmId,
        `"${s.title.replace(/"/g, '""')}"`,
        s.category,
        s.stockTotal,
        s.inTransit,
        s.ordersPerDay,
        s.stockCoverDays,
        s.crCart || '',
        s.crOrder || '',
        s.buyoutPercent || '',
        s.drr || '',
        s.orderSum,
        s.signals?.[0]?.type || s.signalType || ''
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

    // Add BOM for Excel compatibility with Cyrillic characters
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `wb_analytics_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    URL.revokeObjectURL(url);
}

/**
 * Format money value with Russian locale
 */
export function formatMoneyRu(value: number): string {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 0,
    }).format(value);
}
