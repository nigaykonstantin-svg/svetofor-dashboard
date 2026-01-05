// Priority Resolver — Resolves Conflicts According to 7-Level Priority Stack
// Final decision maker that produces actionable recommendations

import type {
    FinalDecision,
    PriorityLevel,
    SKUData,
    OptimizerConfig,
    ModeResult,
    PriceRecommendation,
    DiagnosisResult,
    GuardResult,
} from './types';
import { isDirectionBlocked, getBlockingGuards } from './safety-guards';

// ══════════════════════════════════════════════════════════
// 🎯 MAIN RESOLVER
// ══════════════════════════════════════════════════════════

/**
 * Resolve conflicts and produce final decision
 * 
 * Priority Stack (lower = higher priority):
 * 1. Stop Signals: Manual Lock, Insufficient Data, Cooldown → HOLD
 * 2. Prohibitions: Min Margin, Rank Drop, Low Stock → Block specific directions
 * 3. Gold: Limit step size for top performers
 * 4. Family: Cannibalization protection
 * 5. Mode: Strategic direction (STOP/CLEAR/GROWTH)
 * 6. Optimization: Best scenario by Profit/EV
 * 7. Tactics: Intraday adjustments (future)
 */
export function resolveConflicts(
    sku: SKUData,
    mode: ModeResult,
    priceRec: PriceRecommendation,
    diagnoses: DiagnosisResult[],
    guards: GuardResult[],
    config: OptimizerConfig,
    isGoldSKU: boolean = false
): FinalDecision {
    const reasonChain: string[] = [];
    const appliedRules: string[] = [];
    const blockedBy: string[] = [];

    // ═══════════════════════════════════════════════════════
    // Level 1: Stop Signals (absolute blocks)
    // ═══════════════════════════════════════════════════════

    const level1Guards = guards.filter(g =>
        g.blocked && ['MANUAL_OVERRIDE', 'DATA_GUARD', 'COOLDOWN_GUARD'].includes(g.guard)
    );

    if (level1Guards.length > 0) {
        const mainBlock = level1Guards[0];
        reasonChain.push(`L1 [Стоп-сигнал]: ${mainBlock.reason}`);
        blockedBy.push(...level1Guards.map(g => g.guard));

        return {
            action: 'HOLD',
            delta_pct: 0,
            confidence: 0.95,
            priority_level: 1,
            applied_rules: ['STOP_SIGNAL'],
            blocked_by: blockedBy,
            reason_chain: reasonChain,
        };
    }
    reasonChain.push('L1: Нет стоп-сигналов ✓');
    appliedRules.push('L1_PASSED');

    // ═══════════════════════════════════════════════════════
    // Level 2: Prohibitions (directional blocks)
    // ═══════════════════════════════════════════════════════

    const level2Guards = guards.filter(g =>
        g.blocked && ['MIN_MARGIN_GUARD', 'RANK_DROP_GUARD', 'STOCK_GUARD'].includes(g.guard)
    );

    let allowedDirections: Set<'UP' | 'DOWN' | 'HOLD'> = new Set(['UP', 'DOWN', 'HOLD']);

    for (const guard of level2Guards) {
        if (guard.blocks_direction === 'UP') {
            allowedDirections.delete('UP');
            blockedBy.push(`${guard.guard}→UP`);
            reasonChain.push(`L2 [Запрет UP]: ${guard.reason}`);
        } else if (guard.blocks_direction === 'DOWN') {
            allowedDirections.delete('DOWN');
            blockedBy.push(`${guard.guard}→DOWN`);
            reasonChain.push(`L2 [Запрет DOWN]: ${guard.reason}`);
        } else if (guard.blocks_direction === 'BOTH') {
            allowedDirections.delete('UP');
            allowedDirections.delete('DOWN');
            blockedBy.push(`${guard.guard}→BOTH`);
            reasonChain.push(`L2 [Запрет UP+DOWN]: ${guard.reason}`);
        }
    }

    if (!allowedDirections.has('UP') && !allowedDirections.has('DOWN')) {
        reasonChain.push('L2: Все направления заблокированы → HOLD');
        return {
            action: 'HOLD',
            delta_pct: 0,
            confidence: 0.9,
            priority_level: 2,
            applied_rules: ['L2_PROHIBITIONS'],
            blocked_by: blockedBy,
            reason_chain: reasonChain,
        };
    }
    appliedRules.push('L2_PASSED');

    // ═══════════════════════════════════════════════════════
    // Level 3: Gold Protection (step limit)
    // ═══════════════════════════════════════════════════════

    let maxStep = config.max_price_step_pct;

    if (isGoldSKU) {
        maxStep = config.max_price_step_pct_gold;
        reasonChain.push(`L3 [Gold]: Макс. шаг ограничен ${(maxStep * 100).toFixed(0)}%`);
        appliedRules.push('GOLD_STEP_LIMIT');
    } else {
        reasonChain.push(`L3: Не Gold SKU, макс. шаг ${(maxStep * 100).toFixed(0)}%`);
    }

    // ═══════════════════════════════════════════════════════
    // Level 4: Family Guard
    // ═══════════════════════════════════════════════════════

    const familyGuard = guards.find(g => g.guard === 'FAMILY_GUARD' && g.blocked);
    if (familyGuard) {
        reasonChain.push(`L4 [Семья]: ${familyGuard.reason}`);
        blockedBy.push('FAMILY_GUARD');
        return {
            action: 'HOLD',
            delta_pct: 0,
            confidence: 0.85,
            priority_level: 4,
            applied_rules: ['FAMILY_LIMIT'],
            blocked_by: blockedBy,
            reason_chain: reasonChain,
        };
    }
    appliedRules.push('L4_PASSED');

    // ═══════════════════════════════════════════════════════
    // Level 5: Mode-based Direction
    // ═══════════════════════════════════════════════════════

    reasonChain.push(`L5 [Режим ${mode.mode}]: ${mode.reason}`);
    appliedRules.push(`MODE_${mode.mode}`);

    // Check if mode's preferred action is allowed
    let preferredAction = mode.actions.price;
    if (preferredAction === 'UP' && !allowedDirections.has('UP')) {
        reasonChain.push(`L5: Режим хочет UP, но заблокировано → HOLD`);
        preferredAction = 'HOLD';
    }
    if (preferredAction === 'DOWN' && !allowedDirections.has('DOWN')) {
        reasonChain.push(`L5: Режим хочет DOWN, но заблокировано → HOLD`);
        preferredAction = 'HOLD';
    }

    // ═══════════════════════════════════════════════════════
    // Level 6: Optimization (Price Engine result)
    // ═══════════════════════════════════════════════════════

    let finalAction = priceRec.action;
    let finalDelta = priceRec.delta_pct;

    // Validate against allowed directions
    if (finalAction === 'UP' && !allowedDirections.has('UP')) {
        finalAction = 'HOLD';
        finalDelta = 0;
        reasonChain.push(`L6: Price Engine рекомендует UP, но заблокировано → HOLD`);
    } else if (finalAction === 'DOWN' && !allowedDirections.has('DOWN')) {
        finalAction = 'HOLD';
        finalDelta = 0;
        reasonChain.push(`L6: Price Engine рекомендует DOWN, но заблокировано → HOLD`);
    } else if (finalAction !== 'HOLD') {
        reasonChain.push(`L6 [Оптимизация]: ${priceRec.reason}`);
        appliedRules.push(`TRIGGER_${priceRec.trigger}`);
    }

    // Clamp to max step
    if (Math.abs(finalDelta) > maxStep) {
        const oldDelta = finalDelta;
        finalDelta = finalDelta > 0 ? maxStep : -maxStep;
        reasonChain.push(`L6: Шаг ${(oldDelta * 100).toFixed(0)}% урезан до ${(finalDelta * 100).toFixed(0)}%`);
    }

    // ═══════════════════════════════════════════════════════
    // Level 7: Tactical Adjustments (future)
    // ═══════════════════════════════════════════════════════

    // Reserved for intraday adjustments like evening boost
    reasonChain.push('L7: Тактические корректировки не применялись');

    // ═══════════════════════════════════════════════════════
    // Final Decision
    // ═══════════════════════════════════════════════════════

    // Calculate confidence based on data quality and rule strength
    let confidence = calculateConfidence(sku, diagnoses, guards, priceRec);

    return {
        action: finalAction,
        delta_pct: finalDelta,
        confidence,
        priority_level: determinePriorityLevel(finalAction, priceRec, guards),
        applied_rules: appliedRules,
        blocked_by: blockedBy,
        reason_chain: reasonChain,
    };
}

// ══════════════════════════════════════════════════════════
// 🔧 HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════

/**
 * Calculate decision confidence based on data quality
 */
function calculateConfidence(
    sku: SKUData,
    diagnoses: DiagnosisResult[],
    guards: GuardResult[],
    priceRec: PriceRecommendation
): number {
    let confidence = 0.7; // Base confidence

    // Boost for more data
    if (sku.clicks > 100) confidence += 0.05;
    if (sku.orders > 30) confidence += 0.05;
    if (sku.clicks > 500) confidence += 0.05;

    // Boost for clear diagnosis
    const maxDiagConfidence = Math.max(0, ...diagnoses.map(d => d.confidence));
    confidence += maxDiagConfidence * 0.1;

    // Reduce if many guards triggered (even non-blocking)
    const activeGuards = guards.filter(g => g.blocked).length;
    confidence -= activeGuards * 0.02;

    // Clamp to 0.1 - 0.99
    return Math.min(0.99, Math.max(0.1, confidence));
}

/**
 * Determine which priority level ultimately decided the action
 */
function determinePriorityLevel(
    action: 'UP' | 'DOWN' | 'HOLD',
    priceRec: PriceRecommendation,
    guards: GuardResult[]
): PriorityLevel {
    const blockingGuards = getBlockingGuards(guards);

    // Level 1: Stop signals
    if (blockingGuards.some(g =>
        ['MANUAL_OVERRIDE', 'DATA_GUARD', 'COOLDOWN_GUARD'].includes(g.guard)
    )) {
        return 1;
    }

    // Level 2: Prohibitions
    if (blockingGuards.some(g =>
        ['MIN_MARGIN_GUARD', 'RANK_DROP_GUARD', 'STOCK_GUARD'].includes(g.guard)
    )) {
        return 2;
    }

    // Level 4: Family
    if (blockingGuards.some(g => g.guard === 'FAMILY_GUARD')) {
        return 4;
    }

    // Level 5/6: Mode or Optimization
    if (action !== 'HOLD') {
        if (priceRec.trigger === 'MODE_STOP' || priceRec.trigger === 'MODE_COW') {
            return 5;
        }
        return 6;
    }

    return 6; // Default to optimization level
}

/**
 * Format decision for display
 */
export function formatDecision(decision: FinalDecision): string {
    const actionEmoji = {
        'UP': '⬆️',
        'DOWN': '⬇️',
        'HOLD': '➡️',
    }[decision.action];

    const deltaStr = decision.delta_pct !== 0
        ? ` ${(decision.delta_pct * 100).toFixed(0)}%`
        : '';

    return `${actionEmoji} ${decision.action}${deltaStr} (L${decision.priority_level}, ${(decision.confidence * 100).toFixed(0)}%)`;
}

/**
 * Get summary of decision reasoning
 */
export function getDecisionSummary(decision: FinalDecision): string {
    if (decision.blocked_by.length > 0) {
        return `Заблокировано: ${decision.blocked_by.join(', ')}`;
    }
    if (decision.action === 'HOLD') {
        return 'Нет триггеров для изменения';
    }
    return decision.reason_chain[decision.reason_chain.length - 2] || 'Оптимизация по Profit/EV';
}

/**
 * Check if decision is actionable (not HOLD)
 */
export function isActionable(decision: FinalDecision): boolean {
    return decision.action !== 'HOLD' && decision.delta_pct !== 0;
}

/**
 * Get urgency level based on priority and action
 */
export function getUrgency(decision: FinalDecision): 'critical' | 'warning' | 'info' | 'success' {
    if (decision.priority_level <= 2) {
        return decision.action === 'HOLD' ? 'warning' : 'critical';
    }
    if (decision.action === 'HOLD') {
        return 'info';
    }
    if (decision.action === 'UP') {
        return 'success';
    }
    return 'warning';
}
