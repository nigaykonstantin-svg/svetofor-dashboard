// Mode Classifier — Determines Strategic Mode for Each SKU
// Modes: STOP, CLEAR, COW, GROWTH (evaluated in order)

import type {
    SKUMode,
    ModeResult,
    SKUData,
    OptimizerConfig,
} from './types';

// ══════════════════════════════════════════════════════════
// 🎯 MAIN CLASSIFIER
// ══════════════════════════════════════════════════════════

/**
 * Classify SKU into strategic mode
 * Evaluated in cascade order (first match wins):
 * 1. STOP → убыточный
 * 2. CLEAR → затоваривание  
 * 3. COW → кэш-корова
 * 4. GROWTH → всё остальное
 */
export function classifyMode(
    sku: SKUData,
    config: OptimizerConfig
): ModeResult {
    // Step 1: STOP (Убыток)
    const stopResult = checkStopMode(sku, config);
    if (stopResult) return stopResult;

    // Step 2: CLEAR (Распродажа)
    const clearResult = checkClearMode(sku, config);
    if (clearResult) return clearResult;

    // Step 3: COW (Кэш-корова)
    const cowResult = checkCowMode(sku, config);
    if (cowResult) return cowResult;

    // Step 4: GROWTH (Default)
    return getGrowthMode(sku);
}

// ══════════════════════════════════════════════════════════
// 🛑 STOP MODE
// ══════════════════════════════════════════════════════════

/**
 * STOP Mode: Товар убыточен
 * Условие: CM0 <= 0 ИЛИ profit_before_mkt <= 0
 * Цель: Выйти из минуса
 * Действия: Цена UP, Реклама PAUSE
 * TTL: 14 дней
 */
function checkStopMode(
    sku: SKUData,
    config: OptimizerConfig
): ModeResult | null {
    const { cm0, margin, currentPrice, costPrice } = sku;

    // Check CM0 (contribution margin)
    if (cm0 !== undefined && cm0 <= 0) {
        return {
            mode: 'STOP',
            reason: `Убыточный: CM0 = ${cm0.toFixed(0)}₽ ≤ 0. Срочно поднять цену.`,
            ttl_days: 14,
            actions: {
                price: 'UP',
                ads: 'PAUSE',
            },
        };
    }

    // Check margin if CM0 not available
    if (margin !== undefined && margin <= 0) {
        return {
            mode: 'STOP',
            reason: `Убыточный: маржа ${(margin * 100).toFixed(0)}% ≤ 0. Срочно поднять цену.`,
            ttl_days: 14,
            actions: {
                price: 'UP',
                ads: 'PAUSE',
            },
        };
    }

    // Check if below minimum margin
    if (margin !== undefined && margin < config.min_margin_pct) {
        return {
            mode: 'STOP',
            reason: `Маржа ${(margin * 100).toFixed(0)}% ниже минимума ${(config.min_margin_pct * 100).toFixed(0)}%.`,
            ttl_days: 14,
            actions: {
                price: 'UP',
                ads: 'PAUSE',
            },
        };
    }

    return null;
}

// ══════════════════════════════════════════════════════════
// 🏷️ CLEAR MODE
// ══════════════════════════════════════════════════════════

/**
 * CLEAR Mode: Затоваривание
 * Условие: stock_cover_days >= 120
 * Цель: Освободить склад, ускорить оборачиваемость
 * Действия: Цена DOWN, Реклама ON
 * TTL: 3-7 дней (частые изменения)
 */
function checkClearMode(
    sku: SKUData,
    config: OptimizerConfig
): ModeResult | null {
    const { stockCoverDays, stockTotal, ordersPerDay } = sku;
    const { stock_overstock_days } = config;

    if (stockCoverDays >= stock_overstock_days) {
        const frozenCapital = stockTotal * sku.currentPrice;
        return {
            mode: 'CLEAR',
            reason: `Затоваривание: запас на ${stockCoverDays.toFixed(0)} дней (>${stock_overstock_days}). Заморожено ~${(frozenCapital / 1000).toFixed(0)}K₽.`,
            ttl_days: 5, // Re-evaluate more often
            actions: {
                price: 'DOWN',
                ads: 'ON',
            },
        };
    }

    return null;
}

// ══════════════════════════════════════════════════════════
// 🐄 COW MODE
// ══════════════════════════════════════════════════════════

/**
 * COW Mode: Кэш-корова
 * Условие: CM0 >= high_margin_threshold И stock_cover_days >= 15
 * Цель: Удерживать прибыль, защищать позиции
 * Действия: Цена HOLD или аккуратный UP, Реклама SCALE
 * TTL: 5-7 дней
 */
function checkCowMode(
    sku: SKUData,
    config: OptimizerConfig
): ModeResult | null {
    const { cm0, margin, stockCoverDays, crOrder } = sku;
    const { high_margin_threshold, stock_cow_min_days, cr_order_high } = config;

    const effectiveMargin = cm0 !== undefined ?
        (cm0 / sku.currentPrice) :
        (margin ?? 0);

    const hasHighMargin = effectiveMargin >= high_margin_threshold;
    const hasStableStock = stockCoverDays >= stock_cow_min_days;
    const hasGoodConversion = crOrder !== undefined && crOrder >= cr_order_high * 0.7; // 70% of high benchmark

    if (hasHighMargin && hasStableStock) {
        // Determine if we can try to raise price
        const priceAction = hasGoodConversion ? 'HOLD' : 'HOLD'; // Conservative for now

        return {
            mode: 'COW',
            reason: `Кэш-корова: маржа ${(effectiveMargin * 100).toFixed(0)}% ≥ ${(high_margin_threshold * 100).toFixed(0)}%, запас стабилен (${stockCoverDays.toFixed(0)}d).`,
            ttl_days: 7,
            actions: {
                price: priceAction,
                ads: 'SCALE',
            },
        };
    }

    return null;
}

// ══════════════════════════════════════════════════════════
// 📈 GROWTH MODE
// ══════════════════════════════════════════════════════════

/**
 * GROWTH Mode: Default for active SKUs
 * Цель: Максимизация profit/day с контролем позиций
 * Действия: Управление по модели EV и эластичности
 */
function getGrowthMode(sku: SKUData): ModeResult {
    return {
        mode: 'GROWTH',
        reason: 'Активный рост: оптимизация по Profit/Day с учётом эластичности.',
        ttl_days: 7,
        actions: {
            price: 'HOLD', // Will be refined by Price Engine
            ads: 'ON',
        },
    };
}

// ══════════════════════════════════════════════════════════
// 🔧 HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════

/**
 * Get mode priority (lower = more urgent)
 */
export function getModePriority(mode: SKUMode): number {
    const priorities: Record<SKUMode, number> = {
        'STOP': 1,
        'CLEAR': 2,
        'COW': 3,
        'GROWTH': 4,
    };
    return priorities[mode];
}

/**
 * Get mode display info
 */
export function getModeDisplayInfo(mode: SKUMode): {
    emoji: string;
    color: string;
    label: string;
    labelRu: string;
} {
    const info: Record<SKUMode, { emoji: string; color: string; label: string; labelRu: string }> = {
        'STOP': {
            emoji: '🛑',
            color: '#EF4444', // red
            label: 'STOP',
            labelRu: 'Стоп-лосс',
        },
        'CLEAR': {
            emoji: '🏷️',
            color: '#F59E0B', // amber
            label: 'CLEAR',
            labelRu: 'Распродажа',
        },
        'COW': {
            emoji: '🐄',
            color: '#10B981', // green
            label: 'COW',
            labelRu: 'Кэш-корова',
        },
        'GROWTH': {
            emoji: '📈',
            color: '#3B82F6', // blue
            label: 'GROWTH',
            labelRu: 'Рост',
        },
    };
    return info[mode];
}

/**
 * Check if mode allows price changes
 */
export function canChangePrice(mode: SKUMode): boolean {
    // All modes can potentially change price
    return true;
}

/**
 * Get recommended price direction for mode
 */
export function getModePriceDirection(mode: SKUMode): 'UP' | 'DOWN' | 'HOLD' {
    const directions: Record<SKUMode, 'UP' | 'DOWN' | 'HOLD'> = {
        'STOP': 'UP',
        'CLEAR': 'DOWN',
        'COW': 'HOLD',
        'GROWTH': 'HOLD', // Decided by Price Engine
    };
    return directions[mode];
}
