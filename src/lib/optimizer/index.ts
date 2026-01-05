// Optimizer — Main Entry Point for the MIXIT Dynamic Pricing System
// Orchestrates all modules: Config, Diagnostics, Mode, Price Engine, Guards, Resolver

import type {
    SKUData,
    OptimizerOutput,
    OptimizerConfig,
    ChangeHistory,
    FamilyDefinition,
} from './types';

import { getConfig, isGoldSKU, isManualLocked, getFamilyForSKU } from './config-manager';
import { runDiagnostics, getMostCriticalDiagnosis } from './diagnostic-engine';
import { classifyMode, getModeDisplayInfo } from './mode-classifier';
import { evaluatePrice, getPriceActionEmoji, formatPriceDelta } from './price-engine';
import { runSafetyGuards, getBlockingGuards } from './safety-guards';
import { resolveConflicts, formatDecision, getUrgency, isActionable } from './priority-resolver';

// ══════════════════════════════════════════════════════════
// 🎯 MAIN OPTIMIZER FUNCTION
// ══════════════════════════════════════════════════════════

/**
 * Run the full optimizer pipeline on a single SKU
 * 
 * Pipeline:
 * 1. Load config (merged: global < category < sku)
 * 2. Run diagnostics (6 blocks)
 * 3. Classify mode (STOP/CLEAR/COW/GROWTH)
 * 4. Evaluate price (3 triggers)
 * 5. Run safety guards (9 rules)
 * 6. Resolve conflicts (7 levels)
 * 7. Return actionable decision
 */
export async function runOptimizer(
    sku: SKUData,
    options: {
        recentChanges?: ChangeHistory[];
        familyChangesToday?: Map<string, number>;
    } = {}
): Promise<OptimizerOutput> {
    const timestamp = new Date();

    // 1. Load merged configuration
    const config = await getConfig(sku.sku, sku.category);
    const isGold = await isGoldSKU(sku.sku);
    const isLocked = await isManualLocked(sku.sku);
    const family = await getFamilyForSKU(sku.sku);

    // 2. Run diagnostics
    const diagnoses = runDiagnostics(sku, config);

    // 3. Classify mode
    const mode = classifyMode(sku, config);

    // 4. Evaluate price
    const priceRecommendation = evaluatePrice(sku, mode, diagnoses, config, isGold);

    // 5. Run safety guards
    const familyChanges = family ?
        (options.familyChangesToday?.get(family.family_id) ?? 0) : 0;

    const guards = runSafetyGuards(sku, priceRecommendation, config, {
        recentChanges: options.recentChanges,
        family,
        familyChangesToday: familyChanges,
        isGoldSKU: isGold,
        isManualLocked: isLocked,
    });

    // 6. Resolve conflicts
    const decision = resolveConflicts(
        sku,
        mode,
        priceRecommendation,
        diagnoses,
        guards,
        config,
        isGold
    );

    // 7. Generate summary
    const summary = generateSummary(sku, mode, decision, diagnoses);
    const urgency = getUrgency(decision);

    return {
        sku: sku.sku,
        nmId: sku.nmId,
        timestamp,
        mode,
        diagnoses,
        priceRecommendation,
        guards,
        decision,
        summary,
        urgency,
    };
}

/**
 * Run optimizer on multiple SKUs (batch processing)
 */
export async function runOptimizerBatch(
    skus: SKUData[],
    options: {
        recentChanges?: ChangeHistory[];
    } = {}
): Promise<OptimizerOutput[]> {
    // Track family changes for Family Guard
    const familyChangesToday = new Map<string, number>();

    const results: OptimizerOutput[] = [];

    for (const sku of skus) {
        const result = await runOptimizer(sku, {
            recentChanges: options.recentChanges,
            familyChangesToday,
        });

        results.push(result);

        // Update family changes count if action is taken
        if (isActionable(result.decision)) {
            const family = await getFamilyForSKU(sku.sku);
            if (family) {
                const current = familyChangesToday.get(family.family_id) ?? 0;
                familyChangesToday.set(family.family_id, current + 1);
            }
        }
    }

    return results;
}

// ══════════════════════════════════════════════════════════
// 📝 SUMMARY GENERATION
// ══════════════════════════════════════════════════════════

function generateSummary(
    sku: SKUData,
    mode: import('./types').ModeResult,
    decision: import('./types').FinalDecision,
    diagnoses: import('./types').DiagnosisResult[]
): string {
    const modeInfo = getModeDisplayInfo(mode.mode);
    const actionEmoji = getPriceActionEmoji(decision.action);

    let summary = `${modeInfo.emoji} ${modeInfo.labelRu}`;

    if (decision.action !== 'HOLD') {
        summary += ` → ${actionEmoji} ${formatPriceDelta(decision.delta_pct)}`;
    }

    // Add main diagnosis if any
    const mainDiagnosis = getMostCriticalDiagnosis(diagnoses);
    if (mainDiagnosis) {
        summary += ` | ${mainDiagnosis.reason.split('.')[0]}`;
    }

    // Add blocks if any
    if (decision.blocked_by.length > 0) {
        summary += ` [⛔ ${decision.blocked_by.length} блок]`;
    }

    return summary;
}

// ══════════════════════════════════════════════════════════
// 📊 AGGREGATION & REPORTING
// ══════════════════════════════════════════════════════════

/**
 * Group optimizer results by mode
 */
export function groupByMode(
    results: OptimizerOutput[]
): Record<string, OptimizerOutput[]> {
    const grouped: Record<string, OptimizerOutput[]> = {
        'STOP': [],
        'CLEAR': [],
        'COW': [],
        'GROWTH': [],
    };

    for (const result of results) {
        grouped[result.mode.mode].push(result);
    }

    return grouped;
}

/**
 * Get action statistics
 */
export function getActionStats(
    results: OptimizerOutput[]
): {
    total: number;
    up: number;
    down: number;
    hold: number;
    blocked: number;
} {
    return {
        total: results.length,
        up: results.filter(r => r.decision.action === 'UP').length,
        down: results.filter(r => r.decision.action === 'DOWN').length,
        hold: results.filter(r => r.decision.action === 'HOLD').length,
        blocked: results.filter(r => r.decision.blocked_by.length > 0).length,
    };
}

/**
 * Get top priority items (actionable with high confidence)
 */
export function getTopPriorityItems(
    results: OptimizerOutput[],
    limit: number = 10
): OptimizerOutput[] {
    return results
        .filter(r => isActionable(r.decision))
        .sort((a, b) => {
            // Sort by priority level (lower = higher priority)
            if (a.decision.priority_level !== b.decision.priority_level) {
                return a.decision.priority_level - b.decision.priority_level;
            }
            // Then by confidence (higher = better)
            return b.decision.confidence - a.decision.confidence;
        })
        .slice(0, limit);
}

/**
 * Get items blocked by specific guard
 */
export function getBlockedByGuard(
    results: OptimizerOutput[],
    guardType: string
): OptimizerOutput[] {
    return results.filter(r =>
        r.decision.blocked_by.some(b => b.includes(guardType))
    );
}

/**
 * Calculate potential profit impact
 */
export function calculateTotalImpact(
    results: OptimizerOutput[]
): {
    potentialProfitDelta: number;
    affectedSKUs: number;
} {
    let totalImpact = 0;
    let affected = 0;

    for (const result of results) {
        if (result.priceRecommendation.expected_impact?.profit_delta) {
            totalImpact += result.priceRecommendation.expected_impact.profit_delta;
            affected++;
        }
    }

    return {
        potentialProfitDelta: totalImpact,
        affectedSKUs: affected,
    };
}

// ══════════════════════════════════════════════════════════
// 🔧 UTILITY EXPORTS
// ══════════════════════════════════════════════════════════

export {
    // Types
    type SKUData,
    type OptimizerOutput,
    type OptimizerConfig,

    // Config
    getConfig,
    isGoldSKU,
    isManualLocked,

    // Diagnostics
    runDiagnostics,
    getMostCriticalDiagnosis,

    // Mode
    classifyMode,
    getModeDisplayInfo,

    // Price
    evaluatePrice,
    getPriceActionEmoji,
    formatPriceDelta,

    // Guards
    runSafetyGuards,
    getBlockingGuards,

    // Resolver
    resolveConflicts,
    formatDecision,
    getUrgency,
    isActionable,
};
