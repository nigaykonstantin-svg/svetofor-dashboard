// Signal Engine - определение проблем для Светофора

import { getThresholds, CategoryThresholds } from './category-thresholds';

export type SignalType =
    | 'OOS_NOW'        // Товара нет
    | 'OOS_SOON'       // Скоро закончится
    | 'LOW_CR'         // Низкая конверсия
    | 'LOW_CTR'        // Низкий CTR
    | 'OVERSTOCK'      // Затоваривание
    | 'ABOVE_MARKET'   // Выше рынка (хорошо)
    | 'PRICE_DOWN'     // Нужно снизить цену
    | 'PRICE_UP'       // Можно поднять цену
    | 'HIGH_DRR'       // Высокий ДРР (убыточная реклама)
    | 'FALLING_SALES'  // Падение продаж
    | 'LOW_BUYOUT';    // Низкий процент выкупа

export type SignalPriority = 'critical' | 'warning' | 'info' | 'success';

export interface Signal {
    type: SignalType;
    priority: SignalPriority;
    sku: string;
    nmId: number;
    title: string;
    message: string;
    metric?: number;
    impact?: number; // в рублях
}

export interface SKUAnalysis {
    sku: string;
    nmId: number;
    title: string;
    category: string;

    // Stock
    stockTotal: number;
    inTransit: number;
    effectiveStock: number;

    // Velocity
    ordersPerDay: number;
    stockCoverDays: number;

    // Funnel
    ctr?: number;        // openCount -> cartCount
    crCart?: number;     // cartCount -> orderCount  
    crOrder?: number;    // views -> orders
    buyoutPercent?: number;

    // Revenue
    orderSum?: number;

    // Advertising
    drr?: number;        // Доля рекламных расходов %
    advertSpend?: number; // Расходы на рекламу ₽

    // Trends
    salesTrend?: number; // % изменения vs прошлая неделя

    // Signal
    signals: Signal[];
}

// Get thresholds for category (imported from category-thresholds.ts)
function getConfig(category?: string): CategoryThresholds {
    return getThresholds(category);
}

export function analyzeSKU(data: {
    stocks: Map<number, { quantity: number; inTransit: number; price: number; category: string }>;
    funnel: Map<number, {
        title: string;
        vendorCode: string;
        openCount: number;
        cartCount: number;
        orderCount: number;
        orderSum: number;
        crCart: number;
        crOrder: number;
        buyoutPercent: number;
    }>;
    velocity: Map<number, number>; // ordersPerDay
}): SKUAnalysis[] {
    const results: SKUAnalysis[] = [];

    // Объединяем данные по nmId
    const allNmIds = new Set([
        ...data.stocks.keys(),
        ...data.funnel.keys(),
    ]);

    for (const nmId of allNmIds) {
        const stock = data.stocks.get(nmId);
        const funnel = data.funnel.get(nmId);
        const ordersPerDay = data.velocity.get(nmId) || 0;

        if (!stock && !funnel) continue;

        const stockTotal = stock?.quantity || 0;
        const inTransit = stock?.inTransit || 0;
        const effectiveStock = stockTotal + inTransit;
        const stockCoverDays = ordersPerDay > 0 ? effectiveStock / ordersPerDay : 999;

        // Get thresholds for this SKU's category
        const category = stock?.category || '';
        const CONFIG = getConfig(category);

        const signals: Signal[] = [];

        // 1. OOS сейчас
        if (stockTotal === 0 && ordersPerDay > 0) {
            signals.push({
                type: 'OOS_NOW',
                priority: 'critical',
                sku: funnel?.vendorCode || String(nmId),
                nmId,
                title: funnel?.title || 'Unknown',
                message: `Товар закончился! Продажи/день: ${ordersPerDay.toFixed(1)}`,
                metric: stockTotal,
                impact: ordersPerDay * (stock?.price || 0) * 7, // упущено за неделю
            });
        }

        // 2. OOS скоро
        else if (stockCoverDays < CONFIG.STOCK_CRITICAL_DAYS) {
            signals.push({
                type: 'OOS_SOON',
                priority: 'critical',
                sku: funnel?.vendorCode || String(nmId),
                nmId,
                title: funnel?.title || 'Unknown',
                message: `Закончится через ${stockCoverDays.toFixed(0)} дней (порог: ${CONFIG.STOCK_CRITICAL_DAYS}д)`,
                metric: stockCoverDays,
            });
        }
        else if (stockCoverDays < CONFIG.STOCK_WARNING_DAYS) {
            signals.push({
                type: 'OOS_SOON',
                priority: 'warning',
                sku: funnel?.vendorCode || String(nmId),
                nmId,
                title: funnel?.title || 'Unknown',
                message: `Запас на ${stockCoverDays.toFixed(0)} дней`,
                metric: stockCoverDays,
            });
        }

        // 3. Overstock
        if (stockCoverDays > CONFIG.STOCK_OVERSTOCK_DAYS) {
            signals.push({
                type: 'OVERSTOCK',
                priority: 'warning',
                sku: funnel?.vendorCode || String(nmId),
                nmId,
                title: funnel?.title || 'Unknown',
                message: `Запас на ${stockCoverDays.toFixed(0)} дней — заморозка денег (порог: ${CONFIG.STOCK_OVERSTOCK_DAYS}д)`,
                metric: stockCoverDays,
            });
        }

        // 4. Low CR (низкая конверсия)
        if (funnel && funnel.crCart < CONFIG.CR_CART_LOW && funnel.openCount > 100) {
            signals.push({
                type: 'LOW_CR',
                priority: 'warning',
                sku: funnel.vendorCode,
                nmId,
                title: funnel.title,
                message: `Низкая конверсия в корзину: ${funnel.crCart.toFixed(1)}% (порог: ${CONFIG.CR_CART_LOW}%)`,
                metric: funnel.crCart,
            });
        }

        // 5. Выше рынка
        if (funnel && funnel.crOrder > CONFIG.CR_ORDER_HIGH) {
            signals.push({
                type: 'ABOVE_MARKET',
                priority: 'success',
                sku: funnel.vendorCode,
                nmId,
                title: funnel.title,
                message: `Отличная конверсия: ${funnel.crOrder.toFixed(1)}% — защищать! (выше ${CONFIG.CR_ORDER_HIGH}%)`,
                metric: funnel.crOrder,
            });
        }

        // 6. Низкий выкуп
        if (funnel && funnel.buyoutPercent < CONFIG.BUYOUT_LOW && funnel.orderCount > 10) {
            signals.push({
                type: 'LOW_BUYOUT',
                priority: 'warning',
                sku: funnel.vendorCode,
                nmId,
                title: funnel.title,
                message: `Низкий выкуп: ${funnel.buyoutPercent.toFixed(0)}% — проверить описание/фото (порог: ${CONFIG.BUYOUT_LOW}%)`,
                metric: funnel.buyoutPercent,
            });
        }

        results.push({
            sku: funnel?.vendorCode || String(nmId),
            nmId,
            title: funnel?.title || 'Unknown',
            category: stock?.category || 'Unknown',
            stockTotal,
            inTransit,
            effectiveStock,
            ordersPerDay,
            stockCoverDays,
            ctr: funnel ? (funnel.cartCount / funnel.openCount) * 100 : undefined,
            crCart: funnel?.crCart,
            crOrder: funnel?.crOrder,
            buyoutPercent: funnel?.buyoutPercent,
            orderSum: funnel?.orderSum,
            signals,
        });
    }

    return results;
}

// Группировка по кластерам для дашборда
export function groupByCluster(analyses: SKUAnalysis[]): Record<SignalType, SKUAnalysis[]> {
    const clusters: Record<SignalType, SKUAnalysis[]> = {
        OOS_NOW: [],
        OOS_SOON: [],
        LOW_CR: [],
        LOW_CTR: [],
        OVERSTOCK: [],
        ABOVE_MARKET: [],
        PRICE_DOWN: [],
        PRICE_UP: [],
        HIGH_DRR: [],
        FALLING_SALES: [],
        LOW_BUYOUT: [],
    };

    for (const item of analyses) {
        for (const signal of item.signals) {
            clusters[signal.type].push(item);
        }
    }

    return clusters;
}

// Updated: 2026-01-04
