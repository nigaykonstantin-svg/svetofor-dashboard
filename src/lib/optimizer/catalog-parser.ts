// SKU Catalog Parser — Imports classification from Excel matrix
// Generates config files with Gold SKUs, categories, and manager assignments

import { promises as fs } from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import yaml from 'js-yaml';

const MATRIX_PATH = path.join(process.cwd(), 'Матрица sku - sku WB от Вероники.xlsx');
const CONFIG_DIR = path.join(process.cwd(), 'config');

export interface SKUMatrixRow {
    sku: string;           // 'SKU' column
    skuWb: number;         // 'SKU WB' column (nmId)
    tag: string;           // 'tag': super gold, gold, base, no profit, new, off
    barcode: string;       // 'bar_code'
    status: string;        // 'update': Актуальный, Архивный, etc.
    categoryWb: string;    // 'Категория WB'
    subCategoryWb: string; // 'Суб-категория WB'
    brandManager: string;  // 'ФИО Бренд-менеджера'
    categoryManager: string; // 'ФИО МП категорийного менеджера WB'
}

/**
 * Load and parse the SKU matrix Excel file
 */
export function loadSKUMatrix(): SKUMatrixRow[] {
    const workbook = XLSX.readFile(MATRIX_PATH);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    return rawData.map((row: any) => ({
        sku: String(row['SKU'] || ''),
        skuWb: Number(row['SKU WB']) || 0,
        tag: String(row['tag'] || '').toLowerCase(),
        barcode: String(row['bar_code'] || ''),
        status: String(row['update'] || ''),
        categoryWb: String(row['Категория WB'] || ''),
        subCategoryWb: String(row['Суб-категория WB'] || ''),
        brandManager: String(row['ФИО Бренд-менеджера'] || ''),
        categoryManager: String(row['ФИО МП категорийного менеджера WB'] || ''),
    }));
}

/**
 * Get active SKUs only (not archived, not off)
 */
export function getActiveSKUs(data: SKUMatrixRow[]): SKUMatrixRow[] {
    const inactiveStatuses = ['Архивный', 'Снят с производства', 'На вывод'];
    return data.filter(row =>
        row.tag !== 'off' &&
        !inactiveStatuses.includes(row.status.trim())
    );
}

/**
 * Get Gold and Super Gold SKUs
 */
export function getGoldSKUs(data: SKUMatrixRow[]): string[] {
    return data
        .filter(row => row.tag === 'gold' || row.tag === 'super gold')
        .map(row => row.sku);
}

/**
 * Get Super Gold SKUs only
 */
export function getSuperGoldSKUs(data: SKUMatrixRow[]): string[] {
    return data
        .filter(row => row.tag === 'super gold')
        .map(row => row.sku);
}

/**
 * Get unique categories
 */
export function getCategories(data: SKUMatrixRow[]): string[] {
    return [...new Set(data.map(row => row.categoryWb).filter(Boolean))];
}

/**
 * Get category statistics
 */
export function getCategoryStats(data: SKUMatrixRow[]): Map<string, {
    total: number;
    active: number;
    gold: number;
    superGold: number;
}> {
    const stats = new Map<string, { total: number; active: number; gold: number; superGold: number }>();

    for (const row of data) {
        if (!row.categoryWb) continue;

        if (!stats.has(row.categoryWb)) {
            stats.set(row.categoryWb, { total: 0, active: 0, gold: 0, superGold: 0 });
        }

        const cat = stats.get(row.categoryWb)!;
        cat.total++;

        if (row.tag !== 'off' && row.status !== 'Архивный') {
            cat.active++;
        }
        if (row.tag === 'gold') {
            cat.gold++;
        }
        if (row.tag === 'super gold') {
            cat.superGold++;
        }
    }

    return stats;
}

/**
 * Create SKU lookup by nmId
 */
export function createNmIdLookup(data: SKUMatrixRow[]): Map<number, SKUMatrixRow> {
    const lookup = new Map<number, SKUMatrixRow>();
    for (const row of data) {
        if (row.skuWb > 0) {
            lookup.set(row.skuWb, row);
        }
    }
    return lookup;
}

/**
 * Create SKU lookup by SKU code
 */
export function createSKULookup(data: SKUMatrixRow[]): Map<string, SKUMatrixRow> {
    const lookup = new Map<string, SKUMatrixRow>();
    for (const row of data) {
        if (row.sku) {
            lookup.set(row.sku, row);
        }
    }
    return lookup;
}

/**
 * Generate sku_overrides.yaml from matrix
 */
export async function generateSKUOverridesFromMatrix(): Promise<void> {
    const data = loadSKUMatrix();

    // Get Gold and Super Gold SKUs
    const superGold = getSuperGoldSKUs(data);
    const gold = getGoldSKUs(data);

    // Get no-profit SKUs (need special handling)
    const noProfit = data
        .filter(row => row.tag === 'no profit')
        .map(row => ({
            sku: row.sku,
            reason: 'Low margin product',
            min_margin_pct: 0.05, // Lower minimum for no-profit items
        }));

    const config = {
        // Gold SKUs get maximum protection
        gold_skus: gold,
        super_gold_skus: superGold,

        // Manual locks for archived items
        manual_locks: data
            .filter(row => row.status === 'На вывод' || row.status === 'На вывод ')
            .map(row => ({
                sku: row.sku,
                reason: 'На вывод — не изменять цену',
                until: '2026-12-31',
                locked_by: 'catalog',
            })),

        // Custom thresholds for no-profit items
        custom: noProfit,

        // Family definitions would go here (if we have family data)
        families: [],
    };

    const yamlContent = `# MIXIT Dynamic Pricing Optimizer — SKU Overrides
# Auto-generated from "Матрица sku - sku WB от Вероники.xlsx"
# Generated: ${new Date().toISOString()}

# ══════════════════════════════════════════════════════════
# 🏆 SUPER GOLD SKUs (топ-топ продавцы — макс. защита)
# ══════════════════════════════════════════════════════════
super_gold_skus:
${superGold.map(s => `  - "${s}"`).join('\n')}

# ══════════════════════════════════════════════════════════
# 🥇 GOLD SKUs (топ продавцы — max step ±2%, cooldown 7 дней)
# ══════════════════════════════════════════════════════════
gold_skus:
${gold.map(s => `  - "${s}"`).join('\n')}

# ══════════════════════════════════════════════════════════
# 🔒 MANUAL LOCKS (товары на вывод — система не трогает)
# ══════════════════════════════════════════════════════════
manual_locks:
${config.manual_locks.map(l => `  - sku: "${l.sku}"
    reason: "${l.reason}"
    until: "${l.until}"
    locked_by: "${l.locked_by}"`).join('\n')}

# ══════════════════════════════════════════════════════════
# ⚙️ CUSTOM THRESHOLDS (индивидуальные пороги для no-profit)
# ══════════════════════════════════════════════════════════
custom:
${noProfit.map(n => `  - sku: "${n.sku}"
    reason: "${n.reason}"
    min_margin_pct: ${n.min_margin_pct}`).join('\n')}

# ══════════════════════════════════════════════════════════
# 👨‍👩‍👧‍👦 FAMILY DEFINITIONS (TODO: добавить семейства)
# ══════════════════════════════════════════════════════════
families: []
`;

    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(path.join(CONFIG_DIR, 'sku_overrides.yaml'), yamlContent);

    console.log(`Generated sku_overrides.yaml with:`);
    console.log(`  - ${superGold.length} super gold SKUs`);
    console.log(`  - ${gold.length} gold SKUs`);
    console.log(`  - ${config.manual_locks.length} manual locks`);
    console.log(`  - ${noProfit.length} no-profit custom rules`);
}

/**
 * Generate category.yaml from matrix
 */
export async function generateCategoryConfigFromMatrix(): Promise<void> {
    const data = loadSKUMatrix();
    const stats = getCategoryStats(data);

    // Map category names to English keys for config
    const categoryKeyMap: Record<string, string> = {
        'Уход за телом': 'body',
        'Уход за лицом': 'face',
        'Уход за волосами': 'hair',
        'Макияж': 'makeup',
        'Парфюмерия': 'perfume',
        'Парфюм': 'perfume',
        'Аксессуары': 'accessories',
        'БАДы': 'supplements',
        'Здоровье': 'health',
        'Гигиена полости рта': 'oral_care',
        'Стирка': 'laundry',
        'Средства для посуды': 'dishes',
        'Чистящие средства': 'cleaning',
        'Пятновыводители': 'stain_removers',
        'Бытовая техника': 'appliances',
        'Для дома': 'home',
        'Спецодежда и СИЗы': 'workwear',
        'Товары для животных': 'pets',
    };

    // Default thresholds by category type
    const categoryConfigs: Record<string, Record<string, number>> = {
        face: { min_margin_pct: 0.36, ctr_benchmark: 2.0, cr_order_low: 2.0 },
        hair: { min_margin_pct: 0.30, ctr_benchmark: 1.8, cr_order_low: 1.8 },
        body: { min_margin_pct: 0.25, ctr_benchmark: 1.5, cr_order_low: 1.5 },
        makeup: { min_margin_pct: 0.40, ctr_benchmark: 2.5, cr_order_low: 2.5 },
        perfume: { min_margin_pct: 0.45, ctr_benchmark: 2.0, cr_order_low: 2.0 },
        accessories: { min_margin_pct: 0.35, ctr_benchmark: 1.2, cr_order_low: 1.5 },
        supplements: { min_margin_pct: 0.40, ctr_benchmark: 1.5, cr_order_low: 1.5 },
        health: { min_margin_pct: 0.30, ctr_benchmark: 1.5, cr_order_low: 1.5 },
        oral_care: { min_margin_pct: 0.30, ctr_benchmark: 1.5, cr_order_low: 1.5 },
        // Household categories (lower margins expected)
        laundry: { min_margin_pct: 0.20, ctr_benchmark: 1.0, cr_order_low: 1.0 },
        dishes: { min_margin_pct: 0.20, ctr_benchmark: 1.0, cr_order_low: 1.0 },
        cleaning: { min_margin_pct: 0.20, ctr_benchmark: 1.0, cr_order_low: 1.0 },
        stain_removers: { min_margin_pct: 0.20, ctr_benchmark: 1.0, cr_order_low: 1.0 },
        appliances: { min_margin_pct: 0.25, ctr_benchmark: 1.5, cr_order_low: 1.5 },
        home: { min_margin_pct: 0.25, ctr_benchmark: 1.2, cr_order_low: 1.2 },
        workwear: { min_margin_pct: 0.25, ctr_benchmark: 1.0, cr_order_low: 1.0 },
        pets: { min_margin_pct: 0.25, ctr_benchmark: 1.5, cr_order_low: 1.5 },
    };

    let yamlContent = `# MIXIT Dynamic Pricing Optimizer — Category Configuration
# Auto-generated from "Матрица sku - sku WB от Вероники.xlsx"
# Generated: ${new Date().toISOString()}
# Total SKUs in matrix: ${data.length}

`;

    for (const [ruName, engKey] of Object.entries(categoryKeyMap)) {
        const stat = stats.get(ruName);
        const config = categoryConfigs[engKey];

        if (stat && config) {
            yamlContent += `# ══════════════════════════════════════════════════════════
# ${ruName} (${stat.total} SKUs, ${stat.gold + stat.superGold} gold)
# ══════════════════════════════════════════════════════════
${engKey}:
  min_margin_pct: ${config.min_margin_pct}
  ctr_benchmark: ${config.ctr_benchmark}
  cr_order_low: ${config.cr_order_low}
  # Stats: ${stat.active} active, ${stat.gold} gold, ${stat.superGold} super gold

`;
        }
    }

    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(path.join(CONFIG_DIR, 'category.yaml'), yamlContent);

    console.log(`Generated category.yaml with ${Object.keys(categoryKeyMap).length} categories`);
}

// Export for use in API
export {
    MATRIX_PATH,
    CONFIG_DIR,
};
