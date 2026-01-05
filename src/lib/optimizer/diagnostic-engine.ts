// Diagnostic Engine — 6 Blocks of Problem Detection
// Based on MIXIT Technical Specification

import type {
    DiagnosisResult,
    DiagnosisBlock,
    DiagnosisCode,
    ActionHint,
    SKUData,
    OptimizerConfig,
} from './types';

// ══════════════════════════════════════════════════════════
// 🔍 MAIN DIAGNOSTIC FUNCTION
// ══════════════════════════════════════════════════════════

/**
 * Run all 6 diagnostic blocks on a SKU
 * Returns array of detected problems (empty if SKU is healthy)
 */
export function runDiagnostics(
    sku: SKUData,
    config: OptimizerConfig
): DiagnosisResult[] {
    const results: DiagnosisResult[] = [];

    // Block 1: Data Sufficiency (MUST run first)
    const dataCheck = checkDataSufficiency(sku, config);
    if (dataCheck) {
        results.push(dataCheck);
        // If insufficient data, skip other blocks
        if (dataCheck.code === 'INSUFFICIENT_DATA') {
            return results;
        }
    }

    // Block 2: Traffic Quality
    const trafficCheck = diagnoseTraffic(sku, config);
    if (trafficCheck) results.push(trafficCheck);

    // Block 3: Creative/CTR
    const creativeCheck = diagnoseCreative(sku, config);
    if (creativeCheck) results.push(creativeCheck);

    // Block 4: Conversion
    const conversionCheck = diagnoseConversion(sku, config);
    if (conversionCheck) results.push(conversionCheck);

    // Block 5: Price
    const priceCheck = diagnosePrice(sku, config);
    if (priceCheck) results.push(priceCheck);

    // Block 6: Rank
    const rankCheck = diagnoseRank(sku, config);
    if (rankCheck) results.push(rankCheck);

    return results;
}

// ══════════════════════════════════════════════════════════
// 📊 BLOCK 1: DATA SUFFICIENCY
// ══════════════════════════════════════════════════════════

/**
 * Check if we have enough data to make decisions
 * Spec: clicks < 30 OR orders < 10 (за 7–14 дней) → HOLD
 */
function checkDataSufficiency(
    sku: SKUData,
    config: OptimizerConfig
): DiagnosisResult | null {
    const { clicks, orders } = sku;
    const { min_clicks_for_decision, min_orders_for_decision } = config;

    const hasEnoughClicks = clicks >= min_clicks_for_decision;
    const hasEnoughOrders = orders >= min_orders_for_decision;

    if (!hasEnoughClicks || !hasEnoughOrders) {
        const missingData: string[] = [];
        if (!hasEnoughClicks) missingData.push(`кликов ${clicks}/${min_clicks_for_decision}`);
        if (!hasEnoughOrders) missingData.push(`заказов ${orders}/${min_orders_for_decision}`);

        return {
            block: 'DATA',
            code: 'INSUFFICIENT_DATA',
            confidence: 0.1, // Low confidence when no data
            action_hint: 'HOLD',
            reason: `Недостаточно данных: ${missingData.join(', ')}. Нужно больше статистики.`,
            metrics: { clicks, orders },
        };
    }

    return null;
}

// ══════════════════════════════════════════════════════════
// 🚗 BLOCK 2: TRAFFIC QUALITY
// ══════════════════════════════════════════════════════════

/**
 * Diagnose traffic quality issues
 * Symptoms: CTR падает при росте показов/спенда; клики есть, заказов нет; CPO растет
 */
function diagnoseTraffic(
    sku: SKUData,
    config: OptimizerConfig
): DiagnosisResult | null {
    const { ctr, clicks, orders, adSpend, adOrders, cpo } = sku;

    if (!adSpend || adSpend === 0) return null; // No ads running

    // Calculate efficiency
    const hasClicks = clicks > 0;
    const hasOrders = orders > 0;
    const conversionFromClicks = hasClicks ? (orders / clicks) * 100 : 0;

    // Symptom: Lots of ad spend, clicks, but no orders
    if (adSpend > 0 && clicks > config.min_clicks_for_decision && conversionFromClicks < 0.5) {
        return {
            block: 'TRAFFIC',
            code: 'TRAFFIC_NON_TARGET_SUSPECTED',
            confidence: 0.7,
            action_hint: 'ADS_DOWN',
            reason: `Подозрение на нецелевой трафик: ${clicks} кликов, но конверсия ${conversionFromClicks.toFixed(1)}%. Реклама привлекает не тех.`,
            metrics: { clicks, orders, conversionFromClicks, adSpend },
        };
    }

    // Symptom: CPO growing (if we have historical data)
    // For now, just check if CPO is very high relative to potential margin
    if (cpo && sku.cm0 && cpo > sku.cm0) {
        return {
            block: 'TRAFFIC',
            code: 'TRAFFIC_QUALITY_LOW',
            confidence: 0.8,
            action_hint: 'ADS_DOWN',
            reason: `CPO (${cpo.toFixed(0)}₽) превышает маржу (${sku.cm0.toFixed(0)}₽). Убыточная реклама.`,
            metrics: { cpo, cm0: sku.cm0 },
        };
    }

    return null;
}

// ══════════════════════════════════════════════════════════
// 🎨 BLOCK 3: CREATIVE/CTR
// ══════════════════════════════════════════════════════════

/**
 * Diagnose creative issues
 * Symptoms: CTR падает при тех же ставках; позиции есть, кликов мало
 */
function diagnoseCreative(
    sku: SKUData,
    config: OptimizerConfig
): DiagnosisResult | null {
    const { ctr, impressions } = sku;
    const { ctr_benchmark } = config;

    // Need enough impressions to judge CTR
    if (impressions < 100) return null;

    if (ctr < ctr_benchmark * 0.7) { // 30% below benchmark
        return {
            block: 'CREATIVE',
            code: 'CTR_BELOW_BENCHMARK',
            confidence: 0.75,
            action_hint: 'HOLD', // Don't change price, fix creative
            reason: `CTR ${ctr.toFixed(1)}% ниже бенчмарка ${ctr_benchmark}%. Проверить главное фото.`,
            metrics: { ctr, ctr_benchmark, impressions },
        };
    }

    // Check for creative mismatch: good impressions but low CTR
    if (impressions > 500 && ctr < ctr_benchmark * 0.5) {
        return {
            block: 'CREATIVE',
            code: 'CREATIVE_MISMATCH_SUSPECTED',
            confidence: 0.8,
            action_hint: 'HOLD',
            reason: `${impressions} показов, но CTR всего ${ctr.toFixed(1)}%. Фото не привлекает ЦА.`,
            metrics: { ctr, impressions },
        };
    }

    return null;
}

// ══════════════════════════════════════════════════════════
// 🛒 BLOCK 4: CONVERSION
// ══════════════════════════════════════════════════════════

/**
 * Diagnose conversion issues
 * Symptoms: 
 * - CR_cart падает → "Карточка не убеждает"
 * - CR_order падает при норм CR_cart → "После корзины"
 */
function diagnoseConversion(
    sku: SKUData,
    config: OptimizerConfig
): DiagnosisResult | null {
    const { ctr, crCart, crOrder, clicks, cartAdds } = sku;
    const { ctr_benchmark, cr_cart_low, cr_order_low } = config;

    // CTR is OK but cart conversion is low
    if (ctr >= ctr_benchmark && crCart < cr_cart_low && clicks > 50) {
        return {
            block: 'CONVERSION',
            code: 'CARD_CONVERSION_WEAK',
            confidence: 0.75,
            action_hint: 'PRICE_DOWN', // Price might be the issue
            reason: `CTR норм (${ctr.toFixed(1)}%), но в корзину добавляют мало: ${crCart.toFixed(1)}%. Карточка не убеждает.`,
            metrics: { ctr, crCart },
        };
    }

    // Cart adds OK but checkout conversion is low
    if (crCart >= cr_cart_low && crOrder < cr_order_low && cartAdds > 20) {
        return {
            block: 'CONVERSION',
            code: 'CHECKOUT_CONVERSION_WEAK',
            confidence: 0.7,
            action_hint: 'HOLD', // Usually not a price issue
            reason: `В корзину добавляют (${crCart.toFixed(1)}%), но не заказывают: CR ${crOrder.toFixed(1)}%. Проблема на этапе оформления.`,
            metrics: { crCart, crOrder },
        };
    }

    return null;
}

// ══════════════════════════════════════════════════════════
// 💰 BLOCK 5: PRICE
// ══════════════════════════════════════════════════════════

/**
 * Diagnose price issues
 * Symptoms:
 * - OVERPRICED: CTR норм, CR низкий, конкуренты дешевле
 * - UNDERPRICED: stock_cover низкий, продажи идут
 */
function diagnosePrice(
    sku: SKUData,
    config: OptimizerConfig
): DiagnosisResult | null {
    const {
        ctr, crOrder, stockCoverDays,
        currentPrice, competitorPriceMin, competitorPriceAvg,
        ordersPerDay
    } = sku;
    const { ctr_benchmark, cr_order_low, stock_critical_days } = config;

    // OVERPRICED: Good traffic but low conversion, competitors cheaper
    const hasCompetitorData = competitorPriceMin !== undefined && competitorPriceMin > 0;
    const isCheaperThanCompetitor = hasCompetitorData && currentPrice > competitorPriceMin * 1.1; // 10%+ higher

    if (ctr >= ctr_benchmark && crOrder < cr_order_low) {
        if (isCheaperThanCompetitor) {
            return {
                block: 'PRICE',
                code: 'OVERPRICED',
                confidence: 0.85,
                action_hint: 'PRICE_DOWN',
                reason: `CTR ${ctr.toFixed(1)}% норм, но CR ${crOrder.toFixed(1)}% низкий. Конкуренты дешевле (от ${competitorPriceMin}₽ vs наши ${currentPrice}₽).`,
                metrics: { ctr, crOrder, currentPrice, competitorPriceMin },
            };
        } else {
            return {
                block: 'PRICE',
                code: 'OVERPRICED',
                confidence: 0.7,
                action_hint: 'PRICE_DOWN',
                reason: `CTR ${ctr.toFixed(1)}% норм, но CR ${crOrder.toFixed(1)}% низкий. Возможно цена ${currentPrice}₽ отпугивает.`,
                metrics: { ctr, crOrder, currentPrice },
            };
        }
    }

    // UNDERPRICED: Low stock but selling fast
    if (stockCoverDays <= stock_critical_days && ordersPerDay > 0.5) {
        return {
            block: 'PRICE',
            code: 'UNDERPRICED',
            confidence: 0.9,
            action_hint: 'PRICE_UP',
            reason: `Дефицит: запас на ${stockCoverDays.toFixed(0)} дней, продажи ${ordersPerDay.toFixed(1)}/день. Можно поднять цену.`,
            metrics: { stockCoverDays, ordersPerDay },
        };
    }

    // COMPETITIVE: Price seems OK
    if (ctr >= ctr_benchmark && crOrder >= cr_order_low) {
        return {
            block: 'PRICE',
            code: 'PRICE_COMPETITIVE',
            confidence: 0.8,
            action_hint: 'HOLD',
            reason: `Цена конкурентна: CTR ${ctr.toFixed(1)}%, CR ${crOrder.toFixed(1)}%. Не трогать.`,
            metrics: { ctr, crOrder },
        };
    }

    return null;
}

// ══════════════════════════════════════════════════════════
// 📊 BLOCK 6: RANK
// ══════════════════════════════════════════════════════════

/**
 * Diagnose ranking issues
 * Symptoms: Падают показы/заказы относительно 14d avg
 */
function diagnoseRank(
    sku: SKUData,
    config: OptimizerConfig
): DiagnosisResult | null {
    const {
        ordersTrend14d,
        impressionsTrend14d,
        ordersLast7d,
        ordersLast14d
    } = sku;
    const { rank_drop_warning, rank_drop_critical, sales_drop_warning } = config;

    // Calculate current vs average if we have the data
    let ordersRatio = 1.0;
    if (ordersLast14d && ordersLast14d > 0) {
        const avg7d = ordersLast7d / 7;
        const avg14d = ordersLast14d / 14;
        ordersRatio = avg14d > 0 ? avg7d / avg14d : 1.0;
    }

    // Use provided trend if available
    const effectiveTrend = ordersTrend14d !== undefined ?
        (1 + ordersTrend14d / 100) : ordersRatio;

    // Critical drop
    if (effectiveTrend < rank_drop_critical) {
        return {
            block: 'RANK',
            code: 'RANK_DROP_CRITICAL',
            confidence: 0.9,
            action_hint: 'HOLD', // Block price UP
            reason: `КРИТИЧНО: Заказы упали до ${(effectiveTrend * 100).toFixed(0)}% от среднего. Блокировка повышения цены.`,
            metrics: { effectiveTrend, ordersLast7d, ordersLast14d },
        };
    }

    // Warning drop
    if (effectiveTrend < rank_drop_warning) {
        return {
            block: 'RANK',
            code: 'RANK_DROP_WARNING',
            confidence: 0.75,
            action_hint: 'ADS_UP', // Try to recover with ads
            reason: `Заказы снижаются: ${(effectiveTrend * 100).toFixed(0)}% от среднего. Рассмотреть усиление рекламы.`,
            metrics: { effectiveTrend },
        };
    }

    // Check impressions trend too
    if (impressionsTrend14d !== undefined && impressionsTrend14d < -sales_drop_warning * 100) {
        return {
            block: 'RANK',
            code: 'RANK_DROP_WARNING',
            confidence: 0.7,
            action_hint: 'ADS_UP',
            reason: `Показы упали на ${Math.abs(impressionsTrend14d).toFixed(0)}%. Позиция в выдаче падает.`,
            metrics: { impressionsTrend14d },
        };
    }

    return null;
}

// ══════════════════════════════════════════════════════════
// 🔧 HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════

/**
 * Get the most critical diagnosis from results
 */
export function getMostCriticalDiagnosis(
    diagnoses: DiagnosisResult[]
): DiagnosisResult | null {
    if (diagnoses.length === 0) return null;

    // Priority order of blocks
    const blockPriority: DiagnosisBlock[] = [
        'DATA',
        'RANK',
        'PRICE',
        'CONVERSION',
        'TRAFFIC',
        'CREATIVE',
    ];

    // Sort by block priority, then by confidence
    const sorted = [...diagnoses].sort((a, b) => {
        const aPriority = blockPriority.indexOf(a.block);
        const bPriority = blockPriority.indexOf(b.block);
        if (aPriority !== bPriority) return aPriority - bPriority;
        return b.confidence - a.confidence;
    });

    return sorted[0];
}

/**
 * Check if any diagnosis suggests a specific action
 */
export function hasActionHint(
    diagnoses: DiagnosisResult[],
    action: ActionHint
): boolean {
    return diagnoses.some(d => d.action_hint === action);
}

/**
 * Get all diagnoses suggesting a specific action
 */
export function getDiagnosesByAction(
    diagnoses: DiagnosisResult[],
    action: ActionHint
): DiagnosisResult[] {
    return diagnoses.filter(d => d.action_hint === action);
}
