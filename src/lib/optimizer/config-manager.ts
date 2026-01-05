// Config Manager — Loads and merges configuration from YAML files
// Implements: global < category < sku_override cascading

import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type {
    OptimizerConfig,
    FamilyDefinition,
    ManualLock,
    SKUOverride
} from './types';

// ══════════════════════════════════════════════════════════
// 📁 CONFIG PATHS
// ══════════════════════════════════════════════════════════

const CONFIG_DIR = path.join(process.cwd(), 'config');
const GLOBAL_CONFIG_PATH = path.join(CONFIG_DIR, 'global.yaml');
const CATEGORY_CONFIG_PATH = path.join(CONFIG_DIR, 'category.yaml');
const SKU_OVERRIDES_PATH = path.join(CONFIG_DIR, 'sku_overrides.yaml');

// ══════════════════════════════════════════════════════════
// 🔧 DEFAULT CONFIG (fallback if YAML missing)
// ══════════════════════════════════════════════════════════

const DEFAULT_CONFIG: OptimizerConfig = {
    // Cooldown
    cooldown_price_days: 3,
    cooldown_price_days_gold: 7,

    // Margin
    min_margin_pct: 0.10,
    high_margin_threshold: 0.30,

    // Price steps
    max_price_step_pct: 0.05,
    max_price_step_pct_gold: 0.02,
    price_step_clear: 0.03,
    price_step_low_stock: 0.05,
    price_step_overpriced: 0.03,

    // Stock
    stock_critical_days: 10,
    stock_warning_days: 14,
    stock_overstock_days: 120,
    stock_cow_min_days: 15,

    // Conversion
    ctr_benchmark: 1.5,
    cr_cart_low: 5.0,
    cr_order_low: 1.5,
    cr_order_high: 8.0,
    buyout_low: 50.0,

    // Rank
    rank_drop_warning: 0.80,
    rank_drop_critical: 0.70,
    sales_drop_warning: 0.20,

    // Advertising
    drr_warning: 30,
    drr_critical: 50,
    spend_spike_multiplier: 2.0,

    // Family
    family_max_changes: 1,
    family_price_gap_min: 0.05,

    // Data
    min_clicks_for_decision: 30,
    min_orders_for_decision: 10,
    data_window_days: 14,

    // Schedule
    schedule_time: "09:00",
    ttl_default_days: 7,
};

// ══════════════════════════════════════════════════════════
// 💾 CACHE (in-memory for performance)
// ══════════════════════════════════════════════════════════

interface ConfigCache {
    global: OptimizerConfig;
    categories: Record<string, Partial<OptimizerConfig>>;
    goldSkus: Set<string>;
    manualLocks: Map<string, ManualLock>;
    skuOverrides: Map<string, SKUOverride>;
    families: Map<string, FamilyDefinition>;
    loadedAt: Date;
}

let cache: ConfigCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ══════════════════════════════════════════════════════════
// 📖 YAML LOADERS
// ══════════════════════════════════════════════════════════

async function loadYamlFile<T>(filePath: string): Promise<T | null> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return yaml.load(content) as T;
    } catch (error) {
        console.warn(`[ConfigManager] Could not load ${filePath}:`, error);
        return null;
    }
}

async function loadGlobalConfig(): Promise<OptimizerConfig> {
    const loaded = await loadYamlFile<Partial<OptimizerConfig>>(GLOBAL_CONFIG_PATH);
    return { ...DEFAULT_CONFIG, ...loaded };
}

async function loadCategoryConfig(): Promise<Record<string, Partial<OptimizerConfig>>> {
    const loaded = await loadYamlFile<Record<string, Partial<OptimizerConfig>>>(CATEGORY_CONFIG_PATH);
    return loaded || {};
}

interface SKUOverridesFile {
    gold_skus?: string[];
    manual_locks?: ManualLock[];
    custom?: SKUOverride[];
    families?: FamilyDefinition[];
}

async function loadSKUOverrides(): Promise<SKUOverridesFile> {
    const loaded = await loadYamlFile<SKUOverridesFile>(SKU_OVERRIDES_PATH);
    return loaded || {};
}

// ══════════════════════════════════════════════════════════
// 🔄 CACHE MANAGEMENT
// ══════════════════════════════════════════════════════════

async function refreshCache(): Promise<ConfigCache> {
    console.log('[ConfigManager] Loading configuration...');

    const [global, categories, skuOverridesFile] = await Promise.all([
        loadGlobalConfig(),
        loadCategoryConfig(),
        loadSKUOverrides(),
    ]);

    const goldSkus = new Set(skuOverridesFile.gold_skus || []);

    const manualLocks = new Map<string, ManualLock>();
    for (const lock of skuOverridesFile.manual_locks || []) {
        manualLocks.set(lock.sku, lock);
    }

    const skuOverrides = new Map<string, SKUOverride>();
    for (const override of skuOverridesFile.custom || []) {
        skuOverrides.set(override.sku, override);
    }

    const families = new Map<string, FamilyDefinition>();
    for (const family of skuOverridesFile.families || []) {
        families.set(family.family_id, family);
        // Also map by SKU for quick lookup
        for (const sku of family.skus) {
            // Store reference to find family by SKU
        }
    }

    cache = {
        global,
        categories,
        goldSkus,
        manualLocks,
        skuOverrides,
        families,
        loadedAt: new Date(),
    };

    console.log(`[ConfigManager] Loaded: ${goldSkus.size} gold SKUs, ${manualLocks.size} locks, ${families.size} families`);

    return cache;
}

async function getCache(): Promise<ConfigCache> {
    const now = Date.now();

    if (!cache || now - cache.loadedAt.getTime() > CACHE_TTL_MS) {
        return refreshCache();
    }

    return cache;
}

// ══════════════════════════════════════════════════════════
// 🎯 PUBLIC API
// ══════════════════════════════════════════════════════════

/**
 * Get merged config for a specific SKU
 * Merges: global < category < sku_override
 */
export async function getConfig(sku: string, category: string): Promise<OptimizerConfig> {
    const { global, categories, skuOverrides } = await getCache();

    // Start with global
    let config = { ...global };

    // Merge category overrides (case-insensitive)
    const categoryKey = category.toLowerCase();
    const categoryConfig = categories[categoryKey];
    if (categoryConfig) {
        config = { ...config, ...categoryConfig } as OptimizerConfig;
    }

    // Merge SKU-specific overrides
    const skuOverride = skuOverrides.get(sku);
    if (skuOverride) {
        const { sku: _, ...overrideValues } = skuOverride;
        config = { ...config, ...overrideValues } as OptimizerConfig;
    }

    return config;
}

/**
 * Get global config without merging
 */
export async function getGlobalConfig(): Promise<OptimizerConfig> {
    const { global } = await getCache();
    return global;
}

/**
 * Check if SKU is in Gold list
 */
export async function isGoldSKU(sku: string): Promise<boolean> {
    const { goldSkus } = await getCache();
    return goldSkus.has(sku);
}

/**
 * Get all Gold SKUs
 */
export async function getGoldSKUs(): Promise<string[]> {
    const { goldSkus } = await getCache();
    return Array.from(goldSkus);
}

/**
 * Check if SKU has a manual lock (and lock is still active)
 */
export async function isManualLocked(sku: string): Promise<boolean> {
    const lock = await getManualLock(sku);
    if (!lock) return false;

    const now = new Date();
    const until = new Date(lock.until);
    return now < until;
}

/**
 * Get manual lock details for SKU
 */
export async function getManualLock(sku: string): Promise<ManualLock | null> {
    const { manualLocks } = await getCache();
    return manualLocks.get(sku) || null;
}

/**
 * Get family definition for a SKU
 */
export async function getFamilyForSKU(sku: string): Promise<FamilyDefinition | null> {
    const { families } = await getCache();

    for (const family of families.values()) {
        if (family.skus.includes(sku)) {
            return family;
        }
    }

    return null;
}

/**
 * Get all family definitions
 */
export async function getAllFamilies(): Promise<FamilyDefinition[]> {
    const { families } = await getCache();
    return Array.from(families.values());
}

/**
 * Get all category configs
 */
export async function getCategoryConfigs(): Promise<Record<string, Partial<OptimizerConfig>>> {
    const { categories } = await getCache();
    return categories;
}

/**
 * Force refresh cache (call after config update)
 */
export async function reloadConfig(): Promise<void> {
    cache = null;
    await refreshCache();
}

/**
 * Get effective cooldown days for SKU
 */
export async function getCooldownDays(sku: string, category: string): Promise<number> {
    const config = await getConfig(sku, category);
    const isGold = await isGoldSKU(sku);

    return isGold ? config.cooldown_price_days_gold : config.cooldown_price_days;
}

/**
 * Get effective max price step for SKU
 */
export async function getMaxPriceStep(sku: string, category: string): Promise<number> {
    const config = await getConfig(sku, category);
    const isGold = await isGoldSKU(sku);

    return isGold ? config.max_price_step_pct_gold : config.max_price_step_pct;
}
