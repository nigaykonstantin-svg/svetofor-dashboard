// Optimizer Types — Core TypeScript interfaces for the MIXIT Dynamic Pricing System

// ══════════════════════════════════════════════════════════
// 🎯 SKU MODES
// ══════════════════════════════════════════════════════════

export type SKUMode = 'STOP' | 'CLEAR' | 'COW' | 'GROWTH';

export interface ModeResult {
    mode: SKUMode;
    reason: string;
    ttl_days: number;
    actions: {
        price: 'UP' | 'DOWN' | 'HOLD';
        ads: 'ON' | 'OFF' | 'SCALE' | 'PAUSE';
    };
}

// ══════════════════════════════════════════════════════════
// 🔍 DIAGNOSIS (6 Blocks)
// ══════════════════════════════════════════════════════════

export type DiagnosisBlock =
    | 'DATA'       // Block 1: Data sufficiency
    | 'TRAFFIC'    // Block 2: Traffic quality
    | 'CREATIVE'   // Block 3: Creative/CTR
    | 'CONVERSION' // Block 4: Card conversion
    | 'PRICE'      // Block 5: Price issues
    | 'RANK';      // Block 6: Ranking

export type DiagnosisCode =
    // Block 1
    | 'INSUFFICIENT_DATA'
    // Block 2
    | 'TRAFFIC_NON_TARGET_SUSPECTED'
    | 'TRAFFIC_QUALITY_LOW'
    // Block 3
    | 'CREATIVE_MISMATCH_SUSPECTED'
    | 'CTR_BELOW_BENCHMARK'
    // Block 4
    | 'CARD_CONVERSION_WEAK'
    | 'CHECKOUT_CONVERSION_WEAK'
    // Block 5
    | 'OVERPRICED'
    | 'UNDERPRICED'
    | 'PRICE_COMPETITIVE'
    // Block 6
    | 'RANK_DROP_WARNING'
    | 'RANK_DROP_CRITICAL';

export type ActionHint = 'HOLD' | 'PRICE_DOWN' | 'PRICE_UP' | 'ADS_DOWN' | 'ADS_UP' | 'ADS_PAUSE';

export interface DiagnosisResult {
    block: DiagnosisBlock;
    code: DiagnosisCode;
    confidence: number; // 0-1
    action_hint: ActionHint;
    reason: string;
    metrics?: Record<string, number>;
}

// ══════════════════════════════════════════════════════════
// 💰 PRICE RECOMMENDATIONS
// ══════════════════════════════════════════════════════════

export type PriceTrigger =
    | 'CLEAR'           // Trigger A: stock_cover >= 120 days
    | 'LOW_STOCK'       // Trigger B: stock_cover <= 10 days
    | 'OVERPRICED'      // Trigger C: CTR ok but CR low
    | 'MODE_STOP'       // From STOP mode
    | 'MODE_COW'        // From COW mode
    | 'EV_OPTIMIZATION' // From GROWTH mode EV calc
    | 'NONE';           // No change needed

export interface PriceRecommendation {
    action: 'UP' | 'DOWN' | 'HOLD';
    delta_pct: number;           // e.g., 0.05 = 5%
    trigger: PriceTrigger;
    ttl_days: number;
    reason: string;
    expected_impact?: {
        profit_delta?: number;   // Estimated profit change
        orders_delta?: number;   // Estimated orders change
    };
}

// ══════════════════════════════════════════════════════════
// 🛡️ SAFETY GUARDS
// ══════════════════════════════════════════════════════════

export type GuardType =
    | 'DATA_GUARD'          // Insufficient data
    | 'COOLDOWN_GUARD'      // Too soon since last change
    | 'MIN_MARGIN_GUARD'    // Would drop below min margin
    | 'GOLD_PROTECTION'     // Gold SKU step limit
    | 'RANK_DROP_GUARD'     // Rank falling, block UP
    | 'STOCK_GUARD'         // Low stock, block DOWN
    | 'FAMILY_GUARD'        // Family change limit
    | 'SPEND_LEAK_GUARD'    // Spend spike no sales
    | 'MANUAL_OVERRIDE';    // Manual lock active

export type BlockDirection = 'UP' | 'DOWN' | 'BOTH';

export interface GuardResult {
    guard: GuardType;
    blocked: boolean;
    blocks_direction?: BlockDirection;
    reason: string;
    details?: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════
// 🎯 FINAL DECISION
// ══════════════════════════════════════════════════════════

export type PriorityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface FinalDecision {
    action: 'UP' | 'DOWN' | 'HOLD';
    delta_pct: number;
    confidence: number;           // 0-1
    priority_level: PriorityLevel;
    applied_rules: string[];      // Which rules led to decision
    blocked_by: string[];         // Which guards blocked alternatives
    reason_chain: string[];       // Full reasoning chain for transparency
}

// ══════════════════════════════════════════════════════════
// 📊 SKU DATA (Input to optimizer)
// ══════════════════════════════════════════════════════════

export interface SKUData {
    // Identity
    sku: string;
    nmId: number;
    title: string;
    category: string;
    familyId?: string;

    // Stock
    stockTotal: number;
    inTransit: number;
    effectiveStock: number;      // stockTotal + inTransit

    // Velocity
    ordersPerDay: number;
    ordersLast7d: number;
    ordersLast14d: number;
    stockCoverDays: number;      // effectiveStock / ordersPerDay

    // Price
    currentPrice: number;
    costPrice?: number;          // Себестоимость (if available)
    margin?: number;             // (price - cost) / price
    cm0?: number;                // Contribution margin 0

    // Funnel (7-14 day window)
    impressions: number;
    clicks: number;
    ctr: number;                 // clicks / impressions * 100
    cartAdds: number;
    crCart: number;              // cartAdds / clicks * 100
    orders: number;
    crOrder: number;             // orders / cartAdds * 100
    buyoutPercent: number;       // Actual purchases / orders

    // Advertising
    adSpend: number;
    adOrders: number;
    cpo?: number;                // adSpend / adOrders
    drr?: number;                // adSpend / revenue * 100
    profitPerAdOrder?: number;   // cm0 - cpo

    // Trends (vs previous period)
    salesTrend7d?: number;       // % change vs 7d ago
    impressionsTrend14d?: number;
    ordersTrend14d?: number;

    // History
    lastPriceChange?: Date;
    lastPriceDirection?: 'UP' | 'DOWN';
    priceChangesLast30d?: number;

    // Competitors
    competitorPriceMin?: number;
    competitorPriceAvg?: number;
}

// ══════════════════════════════════════════════════════════
// ⚙️ CONFIGURATION
// ══════════════════════════════════════════════════════════

export interface OptimizerConfig {
    // Cooldown
    cooldown_price_days: number;
    cooldown_price_days_gold: number;

    // Margin
    min_margin_pct: number;
    high_margin_threshold: number;

    // Price steps
    max_price_step_pct: number;
    max_price_step_pct_gold: number;
    price_step_clear: number;
    price_step_low_stock: number;
    price_step_overpriced: number;

    // Stock
    stock_critical_days: number;
    stock_warning_days: number;
    stock_overstock_days: number;
    stock_cow_min_days: number;

    // Conversion
    ctr_benchmark: number;
    cr_cart_low: number;
    cr_order_low: number;
    cr_order_high: number;
    buyout_low: number;

    // Rank
    rank_drop_warning: number;
    rank_drop_critical: number;
    sales_drop_warning: number;

    // Advertising
    drr_warning: number;
    drr_critical: number;
    spend_spike_multiplier: number;

    // Family
    family_max_changes: number;
    family_price_gap_min: number;

    // Data
    min_clicks_for_decision: number;
    min_orders_for_decision: number;
    data_window_days: number;

    // Schedule
    schedule_time: string;
    ttl_default_days: number;
}

// ══════════════════════════════════════════════════════════
// 📦 FULL OPTIMIZER OUTPUT
// ══════════════════════════════════════════════════════════

export interface OptimizerOutput {
    sku: string;
    nmId: number;
    timestamp: Date;

    // Analysis results
    mode: ModeResult;
    diagnoses: DiagnosisResult[];
    priceRecommendation: PriceRecommendation;
    guards: GuardResult[];

    // Final decision
    decision: FinalDecision;

    // For UI display
    summary: string;
    urgency: 'critical' | 'warning' | 'info' | 'success';
}

// ══════════════════════════════════════════════════════════
// 📝 CHANGE HISTORY (for cooldown tracking)
// ══════════════════════════════════════════════════════════

export interface ChangeHistory {
    sku: string;
    timestamp: Date;
    action: 'UP' | 'DOWN';
    delta_pct: number;
    trigger: PriceTrigger;
    old_price: number;
    new_price: number;
    applied_by: 'auto' | 'manual';
}

// ══════════════════════════════════════════════════════════
// 👨‍👩‍👧‍👦 FAMILY DEFINITIONS
// ══════════════════════════════════════════════════════════

export interface FamilyDefinition {
    family_id: string;
    name: string;
    skus: string[];
    price_ladder?: {
        sku: string;
        position: number; // 1 = cheapest
    }[];
}

export interface ManualLock {
    sku: string;
    reason: string;
    until: string; // ISO date
    locked_by: string;
}

export interface SKUOverride {
    sku: string;
    min_margin_pct?: number;
    cooldown_price_days?: number;
    max_price_step_pct?: number;
    [key: string]: unknown;
}
