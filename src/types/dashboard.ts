// Shared types for the Svetofor Dashboard

export interface Signal {
    type: string;
    priority: string;
    message: string;
}

export interface SKUData {
    sku: string;
    nmId: number;
    title: string;
    category: string;
    subCategory?: string;
    brandName?: string;
    subjectName?: string;
    // Managers from matrix
    brandManager?: string;
    categoryManager?: string;
    // Stocks
    stockTotal: number;
    inTransit: number;
    effectiveStock: number;
    stocksWb?: number;
    stocksMp?: number;
    // Velocity
    ordersPerDay: string;
    stockCoverDays: string;
    // Funnel
    openCount?: number;
    cartCount?: number;
    orderCount?: number;
    buyoutCount?: number;
    buyoutSum?: number;
    // Conversions
    crCart?: string;
    crOrder?: string;
    buyoutPercent?: string;
    orderSum: number;
    // Advert
    drr?: string;
    advertSpend?: string;
    signals: Signal[];
    // Internal
    signalType?: string;
    // Comparison: past period data
    pastOrderCount?: number;
    pastOrderSum?: number;
    pastOpenCount?: number;
    pastCrCart?: number;
    pastCrOrder?: number;
    // Comparison: deltas (percentage changes)
    deltaOrderCount?: number | null;
    deltaOrderSum?: number | null;
    deltaOpenCount?: number | null;
    deltaCrCart?: string | null;
    deltaCrOrder?: string | null;
}

export interface SvetoforData {
    success: boolean;
    timestamp: string;
    totalSKUs: number;
    funnelSKUs?: number;
    clusters: ClusterCounts;
    data: ClusterData;
}

export interface ClusterCounts {
    OOS_NOW: number;
    OOS_SOON: number;
    HIGH_DRR: number;
    LOW_CTR: number;
    LOW_CR: number;
    LOW_BUYOUT: number;
    OVERSTOCK: number;
    ABOVE_MARKET: number;
}

export interface ClusterData {
    OOS_NOW: SKUData[];
    OOS_SOON: SKUData[];
    HIGH_DRR: SKUData[];
    LOW_CTR: SKUData[];
    LOW_CR: SKUData[];
    LOW_BUYOUT: SKUData[];
    OVERSTOCK: SKUData[];
    ABOVE_MARKET: SKUData[];
}

export interface KPIs {
    totalOrderSum: number;
    totalOrders: number;
    avgCheck: number;
    avgDRR: number;
    skuCount: number;
}

export interface AdvancedFilters {
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

export interface ColumnVisibility {
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

export type SortField = 'sku' | 'title' | 'stockTotal' | 'ordersPerDay' | 'stockCoverDays' | 'crCart' | 'crOrder' | 'drr' | 'orderSum';
export type SortDirection = 'asc' | 'desc';

// Utility functions
export function formatMoney(value: number): string {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toLocaleString('ru-RU');
}

export function formatPercent(value: number | string | undefined): string {
    if (value === undefined) return '—';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '—';
    return num.toFixed(1) + '%';
}
