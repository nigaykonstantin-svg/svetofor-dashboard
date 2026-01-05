// Price Engine V2 — Determines Price Changes Based on Triggers
// Only 3 triggers can change price; everything else is HOLD

import type {
    PriceRecommendation,
    PriceTrigger,
    SKUData,
    OptimizerConfig,
    ModeResult,
    DiagnosisResult,
} from './types';
import { hasActionHint } from './diagnostic-engine';

// ══════════════════════════════════════════════════════════
// 🎯 MAIN PRICE ENGINE
// ══════════════════════════════════════════════════════════

/**
 * Evaluate price recommendation for SKU
 * 
 * Only 3 triggers change price (per spec):
 * - Trigger A: CLEAR (stock_cover >= 120) → DOWN
 * - Trigger B: LOW_STOCK (stock_cover <= 10) → UP  
 * - Trigger C: OVERPRICED (CTR ok, CR low) → DOWN
 * 
 * Mode can also force direction (STOP → UP)
 */
export function evaluatePrice(
    sku: SKUData,
    mode: ModeResult,
    diagnoses: DiagnosisResult[],
    config: OptimizerConfig,
    isGoldSKU: boolean = false
): PriceRecommendation {

    // 1. Check mode-based overrides first
    if (mode.mode === 'STOP') {
        return createRecommendation(
            'UP',
            config.price_step_low_stock,
            'MODE_STOP',
            14,
            'Режим STOP: убыточный товар, поднимаем цену для выхода из минуса.',
            isGoldSKU,
            config
        );
    }

    // 2. Check Trigger A: CLEAR (Overstock)
    if (mode.mode === 'CLEAR') {
        return createRecommendation(
            'DOWN',
            config.price_step_clear,
            'CLEAR',
            7,
            `Trigger A: Затоваривание (${sku.stockCoverDays.toFixed(0)}d). Снижаем для ускорения продаж.`,
            isGoldSKU,
            config
        );
    }

    // 3. Check Trigger B: LOW_STOCK (Deficit)
    if (sku.stockCoverDays <= config.stock_critical_days && sku.ordersPerDay > 0) {
        return createRecommendation(
            'UP',
            config.price_step_low_stock,
            'LOW_STOCK',
            7,
            `Trigger B: Дефицит (${sku.stockCoverDays.toFixed(0)}d запас). Поднимаем цену для замедления продаж.`,
            isGoldSKU,
            config
        );
    }

    // 4. Check Trigger C: OVERPRICED
    const hasPriceDownHint = hasActionHint(diagnoses, 'PRICE_DOWN');
    const overpricedDiagnosis = diagnoses.find(d => d.code === 'OVERPRICED');

    if (overpricedDiagnosis || hasPriceDownHint) {
        // Additional checks per spec: CTR >= 1.5%, CR < 1.5%
        const ctrOk = sku.ctr >= config.ctr_benchmark;
        const crLow = sku.crOrder < config.cr_order_low;

        if (ctrOk && crLow) {
            return createRecommendation(
                'DOWN',
                config.price_step_overpriced,
                'OVERPRICED',
                7,
                `Trigger C: CTR ${sku.ctr.toFixed(1)}% норм, но CR ${sku.crOrder.toFixed(1)}% низкий. Тестируем снижение.`,
                isGoldSKU,
                config
            );
        }
    }

    // 5. Check for COW mode with potential UP
    if (mode.mode === 'COW' && sku.crOrder > config.cr_order_high) {
        // Very high conversion — might be underpriced
        return createRecommendation(
            'UP',
            config.max_price_step_pct_gold, // Small step for COW
            'MODE_COW',
            7,
            `COW с высоким CR (${sku.crOrder.toFixed(1)}%). Аккуратное повышение.`,
            isGoldSKU,
            config
        );
    }

    // 6. Default: HOLD
    return {
        action: 'HOLD',
        delta_pct: 0,
        trigger: 'NONE',
        ttl_days: config.ttl_default_days,
        reason: 'Нет триггеров для изменения цены. Держим текущую.',
    };
}

// ══════════════════════════════════════════════════════════
// 🔧 HELPER FUNCTIONS  
// ══════════════════════════════════════════════════════════

/**
 * Create price recommendation with Gold SKU protection
 */
function createRecommendation(
    action: 'UP' | 'DOWN',
    deltaPct: number,
    trigger: PriceTrigger,
    ttlDays: number,
    reason: string,
    isGoldSKU: boolean,
    config: OptimizerConfig
): PriceRecommendation {
    // Apply Gold protection: max step ±2%
    let effectiveDelta = deltaPct;
    let effectiveReason = reason;

    if (isGoldSKU) {
        const maxGoldStep = config.max_price_step_pct_gold;
        if (deltaPct > maxGoldStep) {
            effectiveDelta = maxGoldStep;
            effectiveReason = `${reason} [Gold: ограничен до ±${(maxGoldStep * 100).toFixed(0)}%]`;
        }
    }

    return {
        action,
        delta_pct: effectiveDelta,
        trigger,
        ttl_days: ttlDays,
        reason: effectiveReason,
    };
}

/**
 * Calculate expected profit impact of price change
 */
export function calculatePriceImpact(
    sku: SKUData,
    deltaPct: number,
    elasticity: number = -1.5 // Default price elasticity
): {
    newPrice: number;
    expectedOrdersDelta: number;
    expectedProfitDelta: number;
} {
    const { currentPrice, ordersPerDay, cm0 } = sku;

    // New price
    const newPrice = currentPrice * (1 + deltaPct);

    // Estimate orders change using elasticity
    // elasticity = % change in quantity / % change in price
    const ordersDeltaPct = deltaPct * elasticity;
    const newOrdersPerDay = ordersPerDay * (1 + ordersDeltaPct);
    const expectedOrdersDelta = newOrdersPerDay - ordersPerDay;

    // Estimate profit change
    // Simplified: profit = orders * (margin per unit)
    const currentProfit = ordersPerDay * (cm0 ?? currentPrice * 0.3);
    const newMarginPerUnit = (cm0 ?? currentPrice * 0.3) + (newPrice - currentPrice);
    const newProfit = newOrdersPerDay * newMarginPerUnit;
    const expectedProfitDelta = newProfit - currentProfit;

    return {
        newPrice,
        expectedOrdersDelta,
        expectedProfitDelta,
    };
}

/**
 * Generate simulation scenarios (EV-based optimization for GROWTH mode)
 */
export function generatePriceScenarios(
    sku: SKUData,
    config: OptimizerConfig
): Array<{
    deltaPct: number;
    newPrice: number;
    expectedProfit: number;
    label: string;
}> {
    const scenarios = [
        { deltaPct: -0.10, label: '-10%' },
        { deltaPct: -0.05, label: '-5%' },
        { deltaPct: 0, label: 'Текущая' },
        { deltaPct: 0.03, label: '+3%' },
        { deltaPct: 0.05, label: '+5%' },
    ];

    return scenarios.map(s => {
        const impact = calculatePriceImpact(sku, s.deltaPct);
        return {
            deltaPct: s.deltaPct,
            newPrice: impact.newPrice,
            expectedProfit: sku.ordersPerDay * (sku.cm0 ?? sku.currentPrice * 0.3) + impact.expectedProfitDelta,
            label: s.label,
        };
    });
}

/**
 * Find optimal price scenario by expected profit
 */
export function findOptimalScenario(
    sku: SKUData,
    config: OptimizerConfig
): { deltaPct: number; expectedProfit: number } {
    const scenarios = generatePriceScenarios(sku, config);

    // Find max expected profit
    let best = scenarios[2]; // Default to current price
    for (const s of scenarios) {
        if (s.expectedProfit > best.expectedProfit) {
            best = s;
        }
    }

    return {
        deltaPct: best.deltaPct,
        expectedProfit: best.expectedProfit,
    };
}

/**
 * Get price action emoji for display
 */
export function getPriceActionEmoji(action: 'UP' | 'DOWN' | 'HOLD'): string {
    const emojis: Record<string, string> = {
        'UP': '⬆️',
        'DOWN': '⬇️',
        'HOLD': '➡️',
    };
    return emojis[action];
}

/**
 * Format price delta for display
 */
export function formatPriceDelta(deltaPct: number): string {
    if (deltaPct === 0) return '0%';
    const sign = deltaPct > 0 ? '+' : '';
    return `${sign}${(deltaPct * 100).toFixed(0)}%`;
}
