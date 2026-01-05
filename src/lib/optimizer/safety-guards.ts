// Safety Guards — 9 Rules That Block Dangerous Decisions
// These are the final gatekeepers before any action is taken

import type {
    GuardResult,
    GuardType,
    BlockDirection,
    SKUData,
    OptimizerConfig,
    PriceRecommendation,
    ChangeHistory,
    FamilyDefinition,
} from './types';

// ══════════════════════════════════════════════════════════
// 🛡️ MAIN GUARD RUNNER
// ══════════════════════════════════════════════════════════

/**
 * Run all 9 safety guards on a recommendation
 * Returns array of blocking guards (empty if all passed)
 */
export function runSafetyGuards(
    sku: SKUData,
    recommendation: PriceRecommendation,
    config: OptimizerConfig,
    options: {
        recentChanges?: ChangeHistory[];
        family?: FamilyDefinition | null;
        familyChangesToday?: number;
        isGoldSKU?: boolean;
        isManualLocked?: boolean;
    } = {}
): GuardResult[] {
    const results: GuardResult[] = [];

    // Guard 1: Manual Override (highest priority)
    const manualGuard = checkManualOverride(options.isManualLocked);
    if (manualGuard.blocked) results.push(manualGuard);

    // Guard 2: Data Guard
    const dataGuard = checkDataGuard(sku, config);
    if (dataGuard.blocked) results.push(dataGuard);

    // Guard 3: Cooldown Guard
    const cooldownGuard = checkCooldownGuard(
        sku,
        config,
        options.recentChanges || [],
        options.isGoldSKU || false
    );
    if (cooldownGuard.blocked) results.push(cooldownGuard);

    // Guard 4: Min Margin Guard (blocks DOWN only)
    if (recommendation.action === 'DOWN') {
        const marginGuard = checkMinMarginGuard(sku, recommendation, config);
        if (marginGuard.blocked) results.push(marginGuard);
    }

    // Guard 5: Gold Protection
    if (options.isGoldSKU) {
        const goldGuard = checkGoldProtection(recommendation, config);
        if (goldGuard.blocked) results.push(goldGuard);
    }

    // Guard 6: Rank Drop Guard (blocks UP only)
    if (recommendation.action === 'UP') {
        const rankGuard = checkRankDropGuard(sku, config);
        if (rankGuard.blocked) results.push(rankGuard);
    }

    // Guard 7: Stock Guard (blocks DOWN and ADS_UP when low stock)
    if (recommendation.action === 'DOWN') {
        const stockGuard = checkStockGuard(sku, config);
        if (stockGuard.blocked) results.push(stockGuard);
    }

    // Guard 8: Family Guard
    if (options.family && recommendation.action !== 'HOLD') {
        const familyGuard = checkFamilyGuard(
            sku,
            options.family,
            options.familyChangesToday || 0,
            config
        );
        if (familyGuard.blocked) results.push(familyGuard);
    }

    // Guard 9: Spend Leak Guard
    const spendGuard = checkSpendLeakGuard(sku, config);
    if (spendGuard.blocked) results.push(spendGuard);

    return results;
}

// ══════════════════════════════════════════════════════════
// 1️⃣ MANUAL OVERRIDE GUARD
// ══════════════════════════════════════════════════════════

function checkManualOverride(isManualLocked?: boolean): GuardResult {
    if (isManualLocked) {
        return {
            guard: 'MANUAL_OVERRIDE',
            blocked: true,
            blocks_direction: 'BOTH',
            reason: 'Ручная блокировка активна. Система не трогает этот SKU.',
        };
    }
    return {
        guard: 'MANUAL_OVERRIDE',
        blocked: false,
        reason: 'Нет ручной блокировки.',
    };
}

// ══════════════════════════════════════════════════════════
// 2️⃣ DATA GUARD
// ══════════════════════════════════════════════════════════

function checkDataGuard(sku: SKUData, config: OptimizerConfig): GuardResult {
    const { clicks, orders } = sku;
    const { min_clicks_for_decision, min_orders_for_decision } = config;

    const hasEnoughData = clicks >= min_clicks_for_decision &&
        orders >= min_orders_for_decision;

    if (!hasEnoughData) {
        return {
            guard: 'DATA_GUARD',
            blocked: true,
            blocks_direction: 'BOTH',
            reason: `Недостаточно данных: ${clicks}/${min_clicks_for_decision} кликов, ${orders}/${min_orders_for_decision} заказов.`,
            details: { clicks, orders },
        };
    }

    return {
        guard: 'DATA_GUARD',
        blocked: false,
        reason: 'Достаточно данных для принятия решения.',
    };
}

// ══════════════════════════════════════════════════════════
// 3️⃣ COOLDOWN GUARD
// ══════════════════════════════════════════════════════════

function checkCooldownGuard(
    sku: SKUData,
    config: OptimizerConfig,
    recentChanges: ChangeHistory[],
    isGoldSKU: boolean
): GuardResult {
    const cooldownDays = isGoldSKU ?
        config.cooldown_price_days_gold :
        config.cooldown_price_days;

    // Check from SKU data if available
    if (sku.lastPriceChange) {
        const daysSinceChange = Math.floor(
            (Date.now() - sku.lastPriceChange.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceChange < cooldownDays) {
            return {
                guard: 'COOLDOWN_GUARD',
                blocked: true,
                blocks_direction: 'BOTH',
                reason: `Cooldown: прошло ${daysSinceChange}/${cooldownDays} дней с последнего изменения.`,
                details: { daysSinceChange, cooldownDays },
            };
        }
    }

    // Check from history if provided
    const skuChanges = recentChanges.filter(c => c.sku === sku.sku);
    if (skuChanges.length > 0) {
        const lastChange = skuChanges.reduce((a, b) =>
            a.timestamp > b.timestamp ? a : b
        );
        const daysSinceChange = Math.floor(
            (Date.now() - lastChange.timestamp.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceChange < cooldownDays) {
            return {
                guard: 'COOLDOWN_GUARD',
                blocked: true,
                blocks_direction: 'BOTH',
                reason: `Cooldown: прошло ${daysSinceChange}/${cooldownDays} дней с последнего изменения (${lastChange.action} ${(lastChange.delta_pct * 100).toFixed(0)}%).`,
                details: { daysSinceChange, cooldownDays, lastChange },
            };
        }
    }

    return {
        guard: 'COOLDOWN_GUARD',
        blocked: false,
        reason: `Cooldown пройден (требуется ${cooldownDays} дней).`,
    };
}

// ══════════════════════════════════════════════════════════
// 4️⃣ MIN MARGIN GUARD
// ══════════════════════════════════════════════════════════

function checkMinMarginGuard(
    sku: SKUData,
    recommendation: PriceRecommendation,
    config: OptimizerConfig
): GuardResult {
    const { currentPrice, costPrice, margin, cm0 } = sku;
    const { min_margin_pct } = config;

    // Calculate margin after proposed change
    const newPrice = currentPrice * (1 - recommendation.delta_pct);

    let newMargin: number | undefined;
    if (costPrice !== undefined && costPrice > 0) {
        newMargin = (newPrice - costPrice) / newPrice;
    } else if (margin !== undefined) {
        // Estimate new margin based on current
        const currentCost = currentPrice * (1 - margin);
        newMargin = (newPrice - currentCost) / newPrice;
    }

    if (newMargin !== undefined && newMargin < min_margin_pct) {
        return {
            guard: 'MIN_MARGIN_GUARD',
            blocked: true,
            blocks_direction: 'DOWN',
            reason: `Маржа после снижения будет ${(newMargin * 100).toFixed(0)}% < ${(min_margin_pct * 100).toFixed(0)}% минимума.`,
            details: { newMargin, min_margin_pct, newPrice },
        };
    }

    // Also block if already at/below minimum
    if (margin !== undefined && margin <= min_margin_pct) {
        return {
            guard: 'MIN_MARGIN_GUARD',
            blocked: true,
            blocks_direction: 'DOWN',
            reason: `Текущая маржа ${(margin * 100).toFixed(0)}% уже на минимуме. Снижение запрещено.`,
            details: { margin, min_margin_pct },
        };
    }

    return {
        guard: 'MIN_MARGIN_GUARD',
        blocked: false,
        reason: 'Маржа останется выше минимума.',
    };
}

// ══════════════════════════════════════════════════════════
// 5️⃣ GOLD PROTECTION GUARD
// ══════════════════════════════════════════════════════════

function checkGoldProtection(
    recommendation: PriceRecommendation,
    config: OptimizerConfig
): GuardResult {
    const { max_price_step_pct_gold } = config;

    if (Math.abs(recommendation.delta_pct) > max_price_step_pct_gold) {
        return {
            guard: 'GOLD_PROTECTION',
            blocked: true,
            blocks_direction: 'BOTH',
            reason: `Gold SKU: шаг ${(Math.abs(recommendation.delta_pct) * 100).toFixed(0)}% превышает лимит ${(max_price_step_pct_gold * 100).toFixed(0)}%.`,
            details: {
                requested: recommendation.delta_pct,
                max: max_price_step_pct_gold
            },
        };
    }

    return {
        guard: 'GOLD_PROTECTION',
        blocked: false,
        reason: `Gold SKU: шаг в пределах лимита ±${(max_price_step_pct_gold * 100).toFixed(0)}%.`,
    };
}

// ══════════════════════════════════════════════════════════
// 6️⃣ RANK DROP GUARD
// ══════════════════════════════════════════════════════════

function checkRankDropGuard(sku: SKUData, config: OptimizerConfig): GuardResult {
    const { ordersLast7d, ordersLast14d, ordersTrend14d } = sku;
    const { rank_drop_critical } = config;

    // Calculate ratio
    let ordersRatio = 1.0;
    if (ordersLast14d && ordersLast14d > 0 && ordersLast7d !== undefined) {
        const avg7d = ordersLast7d / 7;
        const avg14d = ordersLast14d / 14;
        ordersRatio = avg14d > 0 ? avg7d / avg14d : 1.0;
    }

    // Use provided trend if available
    const effectiveRatio = ordersTrend14d !== undefined ?
        (1 + ordersTrend14d / 100) : ordersRatio;

    if (effectiveRatio < rank_drop_critical) {
        return {
            guard: 'RANK_DROP_GUARD',
            blocked: true,
            blocks_direction: 'UP',
            reason: `Заказы упали до ${(effectiveRatio * 100).toFixed(0)}% от среднего. Повышение цены заблокировано.`,
            details: { effectiveRatio, rank_drop_critical },
        };
    }

    return {
        guard: 'RANK_DROP_GUARD',
        blocked: false,
        reason: 'Ранжирование стабильно.',
    };
}

// ══════════════════════════════════════════════════════════
// 7️⃣ STOCK GUARD
// ══════════════════════════════════════════════════════════

function checkStockGuard(sku: SKUData, config: OptimizerConfig): GuardResult {
    const { stockCoverDays } = sku;
    const { stock_critical_days } = config;

    if (stockCoverDays < stock_critical_days) {
        return {
            guard: 'STOCK_GUARD',
            blocked: true,
            blocks_direction: 'DOWN',
            reason: `Низкий запас (${stockCoverDays.toFixed(0)} дней). Снижение цены и разгон рекламы заблокированы.`,
            details: { stockCoverDays, stock_critical_days },
        };
    }

    return {
        guard: 'STOCK_GUARD',
        blocked: false,
        reason: 'Запас достаточен.',
    };
}

// ══════════════════════════════════════════════════════════
// 8️⃣ FAMILY GUARD
// ══════════════════════════════════════════════════════════

function checkFamilyGuard(
    sku: SKUData,
    family: FamilyDefinition,
    familyChangesToday: number,
    config: OptimizerConfig
): GuardResult {
    const { family_max_changes } = config;

    if (familyChangesToday >= family_max_changes) {
        return {
            guard: 'FAMILY_GUARD',
            blocked: true,
            blocks_direction: 'BOTH',
            reason: `Семейство "${family.name}": уже ${familyChangesToday}/${family_max_changes} изменений сегодня.`,
            details: { family: family.family_id, familyChangesToday, family_max_changes },
        };
    }

    // Check price ladder if defined
    if (family.price_ladder && family.price_ladder.length > 1) {
        // Would need actual prices of other family members to validate ladder
        // For now, just allow but note the constraint
    }

    return {
        guard: 'FAMILY_GUARD',
        blocked: false,
        reason: `Семейство "${family.name}": изменение разрешено.`,
    };
}

// ══════════════════════════════════════════════════════════
// 9️⃣ SPEND LEAK GUARD
// ══════════════════════════════════════════════════════════

function checkSpendLeakGuard(sku: SKUData, config: OptimizerConfig): GuardResult {
    const { adSpend, adOrders } = sku;
    const { spend_spike_multiplier } = config;

    // This guard is more about detecting sudden spend spikes
    // For now, check if we have high spend but no orders
    if (adSpend > 1000 && adOrders === 0) {
        return {
            guard: 'SPEND_LEAK_GUARD',
            blocked: true,
            blocks_direction: 'BOTH',
            reason: `Расход ${adSpend}₽ без заказов. Утечка бюджета. Требуется аудит рекламы.`,
            details: { adSpend, adOrders },
        };
    }

    // Check CPO vs CM0
    if (sku.cpo && sku.cm0 && sku.cpo > sku.cm0 * spend_spike_multiplier) {
        return {
            guard: 'SPEND_LEAK_GUARD',
            blocked: false, // Warning, not block
            reason: `CPO (${sku.cpo.toFixed(0)}₽) в ${(sku.cpo / sku.cm0).toFixed(1)}x выше маржи. Рекомендуется снизить рекламу.`,
            details: { cpo: sku.cpo, cm0: sku.cm0 },
        };
    }

    return {
        guard: 'SPEND_LEAK_GUARD',
        blocked: false,
        reason: 'Расходы на рекламу в норме.',
    };
}

// ══════════════════════════════════════════════════════════
// 🔧 HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════

/**
 * Check if any guard blocks a specific direction
 */
export function isDirectionBlocked(
    guards: GuardResult[],
    direction: 'UP' | 'DOWN'
): boolean {
    return guards.some(g =>
        g.blocked &&
        (g.blocks_direction === direction || g.blocks_direction === 'BOTH')
    );
}

/**
 * Get all blocking guards
 */
export function getBlockingGuards(guards: GuardResult[]): GuardResult[] {
    return guards.filter(g => g.blocked);
}

/**
 * Get guard priority (lower = higher priority)
 */
export function getGuardPriority(guard: GuardType): number {
    const priorities: Record<GuardType, number> = {
        'MANUAL_OVERRIDE': 1,
        'DATA_GUARD': 2,
        'COOLDOWN_GUARD': 3,
        'MIN_MARGIN_GUARD': 4,
        'GOLD_PROTECTION': 5,
        'RANK_DROP_GUARD': 6,
        'STOCK_GUARD': 7,
        'FAMILY_GUARD': 8,
        'SPEND_LEAK_GUARD': 9,
    };
    return priorities[guard];
}

/**
 * Get guard display info
 */
export function getGuardDisplayInfo(guard: GuardType): {
    emoji: string;
    label: string;
    labelRu: string;
} {
    const info: Record<GuardType, { emoji: string; label: string; labelRu: string }> = {
        'MANUAL_OVERRIDE': { emoji: '🔒', label: 'Manual Lock', labelRu: 'Ручная блокировка' },
        'DATA_GUARD': { emoji: '📊', label: 'Data Guard', labelRu: 'Мало данных' },
        'COOLDOWN_GUARD': { emoji: '⏳', label: 'Cooldown', labelRu: 'Кулдаун' },
        'MIN_MARGIN_GUARD': { emoji: '💰', label: 'Min Margin', labelRu: 'Мин. маржа' },
        'GOLD_PROTECTION': { emoji: '🏆', label: 'Gold Protection', labelRu: 'Защита Gold' },
        'RANK_DROP_GUARD': { emoji: '📉', label: 'Rank Drop', labelRu: 'Падение позиций' },
        'STOCK_GUARD': { emoji: '📦', label: 'Low Stock', labelRu: 'Низкий запас' },
        'FAMILY_GUARD': { emoji: '👨‍👩‍👧', label: 'Family Limit', labelRu: 'Лимит семьи' },
        'SPEND_LEAK_GUARD': { emoji: '💸', label: 'Spend Leak', labelRu: 'Утечка бюджета' },
    };
    return info[guard];
}
