// Script to generate config files from SKU matrix
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const MATRIX_PATH = path.join(__dirname, '..', 'Матрица sku - sku WB от Вероники.xlsx');
const CONFIG_DIR = path.join(__dirname, '..', 'config');

// Load matrix
console.log('Loading matrix from:', MATRIX_PATH);
const workbook = XLSX.readFile(MATRIX_PATH);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

const data = rawData.map(row => ({
    sku: String(row['SKU'] || ''),
    skuWb: Number(row['SKU WB']) || 0,
    tag: String(row['tag'] || '').toLowerCase().trim(),
    status: String(row['update'] || '').trim(),
    categoryWb: String(row['Категория WB'] || ''),
    subCategoryWb: String(row['Суб-категория WB'] || ''),
    brandManager: String(row['ФИО Бренд-менеджера'] || ''),
}));

console.log('Loaded', data.length, 'SKUs');

// Get Gold and Super Gold
const superGold = data.filter(r => r.tag === 'super gold').map(r => r.sku);
const gold = data.filter(r => r.tag === 'gold' || r.tag === 'super gold').map(r => r.sku);
const noProfit = data.filter(r => r.tag === 'no profit').map(r => r.sku);
const manualLocks = data.filter(r => r.status.includes('На вывод')).map(r => r.sku);

console.log('Super Gold:', superGold.length);
console.log('Gold (incl super):', gold.length);
console.log('No Profit:', noProfit.length);
console.log('Manual Locks:', manualLocks.length);

// Generate sku_overrides.yaml
let overridesContent = `# MIXIT Dynamic Pricing Optimizer — SKU Overrides
# Auto-generated from SKU Matrix
# Generated: ${new Date().toISOString()}

# ══════════════════════════════════════════════════════════
# 🏆 SUPER GOLD SKUs (${superGold.length} — макс. защита ±2%)
# ══════════════════════════════════════════════════════════
super_gold_skus:
`;
superGold.forEach(s => overridesContent += `  - "${s}"\n`);

overridesContent += `
# ══════════════════════════════════════════════════════════
# 🥇 GOLD SKUs (${gold.length} — cooldown 7 дней, max ±3%)
# ══════════════════════════════════════════════════════════
gold_skus:
`;
gold.forEach(s => overridesContent += `  - "${s}"\n`);

overridesContent += `
# ══════════════════════════════════════════════════════════
# 🔒 MANUAL LOCKS (На вывод — ${manualLocks.length} SKU)
# ══════════════════════════════════════════════════════════
manual_locks:
`;
manualLocks.forEach(s => {
    overridesContent += `  - sku: "${s}"\n`;
    overridesContent += `    reason: "На вывод"\n`;
    overridesContent += `    until: "2026-12-31"\n`;
    overridesContent += `    locked_by: "catalog"\n`;
});

overridesContent += `
# ══════════════════════════════════════════════════════════
# ⚙️ NO PROFIT SKUs (${noProfit.length} — низкий min margin)
# ══════════════════════════════════════════════════════════
custom:
`;
noProfit.forEach(s => {
    overridesContent += `  - sku: "${s}"\n`;
    overridesContent += `    min_margin_pct: 0.05\n`;
    overridesContent += `    reason: "no profit tag"\n`;
});

overridesContent += `
# ══════════════════════════════════════════════════════════
# 👨‍👩‍👧‍👦 FAMILY DEFINITIONS
# ══════════════════════════════════════════════════════════
families: []
`;

fs.writeFileSync(path.join(CONFIG_DIR, 'sku_overrides.yaml'), overridesContent);
console.log('\n✅ Generated sku_overrides.yaml');

// Category stats
const catStats = {};
for (const row of data) {
    if (!row.categoryWb) continue;
    if (!catStats[row.categoryWb]) {
        catStats[row.categoryWb] = { total: 0, active: 0, gold: 0, superGold: 0 };
    }
    catStats[row.categoryWb].total++;
    if (row.tag !== 'off' && !row.status.includes('Архив')) catStats[row.categoryWb].active++;
    if (row.tag === 'gold') catStats[row.categoryWb].gold++;
    if (row.tag === 'super gold') catStats[row.categoryWb].superGold++;
}

console.log('\n=== CATEGORY STATS ===');
Object.entries(catStats).forEach(([cat, s]) => {
    console.log(`${cat}: ${s.total} total, ${s.active} active, ${s.gold} gold, ${s.superGold} super`);
});

// Generate category.yaml
const categoryKeyMap = {
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

const categoryConfigs = {
    face: { min_margin_pct: 0.36, ctr_benchmark: 2.0, cr_order_low: 2.0 },
    hair: { min_margin_pct: 0.30, ctr_benchmark: 1.8, cr_order_low: 1.8 },
    body: { min_margin_pct: 0.25, ctr_benchmark: 1.5, cr_order_low: 1.5 },
    makeup: { min_margin_pct: 0.40, ctr_benchmark: 2.5, cr_order_low: 2.5 },
    perfume: { min_margin_pct: 0.45, ctr_benchmark: 2.0, cr_order_low: 2.0 },
    accessories: { min_margin_pct: 0.35, ctr_benchmark: 1.2, cr_order_low: 1.5 },
    supplements: { min_margin_pct: 0.40, ctr_benchmark: 1.5, cr_order_low: 1.5 },
    health: { min_margin_pct: 0.30, ctr_benchmark: 1.5, cr_order_low: 1.5 },
    oral_care: { min_margin_pct: 0.30, ctr_benchmark: 1.5, cr_order_low: 1.5 },
    laundry: { min_margin_pct: 0.20, ctr_benchmark: 1.0, cr_order_low: 1.0 },
    dishes: { min_margin_pct: 0.20, ctr_benchmark: 1.0, cr_order_low: 1.0 },
    cleaning: { min_margin_pct: 0.20, ctr_benchmark: 1.0, cr_order_low: 1.0 },
    stain_removers: { min_margin_pct: 0.20, ctr_benchmark: 1.0, cr_order_low: 1.0 },
    appliances: { min_margin_pct: 0.25, ctr_benchmark: 1.5, cr_order_low: 1.5 },
    home: { min_margin_pct: 0.25, ctr_benchmark: 1.2, cr_order_low: 1.2 },
    workwear: { min_margin_pct: 0.25, ctr_benchmark: 1.0, cr_order_low: 1.0 },
    pets: { min_margin_pct: 0.25, ctr_benchmark: 1.5, cr_order_low: 1.5 },
};

let catContent = `# MIXIT Dynamic Pricing Optimizer — Category Configuration
# Auto-generated from SKU Matrix
# Generated: ${new Date().toISOString()}
# Total SKUs in matrix: ${data.length}

`;

for (const [ruName, engKey] of Object.entries(categoryKeyMap)) {
    const stat = catStats[ruName];
    const config = categoryConfigs[engKey];

    if (stat && config) {
        catContent += `# ══════════════════════════════════════════════════════════
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

fs.writeFileSync(path.join(CONFIG_DIR, 'category.yaml'), catContent);
console.log('✅ Generated category.yaml');

// ══════════════════════════════════════════════════════════
// Generate sku-matrix.json for runtime lookup
// ══════════════════════════════════════════════════════════
const JSON_DIR = path.join(__dirname, '..', 'src', 'data');

// Ensure directory exists
if (!fs.existsSync(JSON_DIR)) {
    fs.mkdirSync(JSON_DIR, { recursive: true });
}

// Build JSON data with all SKUs that have nmId
const skusWithNmId = data.filter(r => r.skuWb > 0);

const skuMatrixJson = {
    lastUpdated: new Date().toISOString(),
    totalSKUs: skusWithNmId.length,
    categories: [...new Set(data.map(r => r.categoryWb).filter(Boolean))],
    subCategories: [...new Set(data.map(r => r.subCategoryWb).filter(Boolean))],
    brandManagers: [...new Set(data.map(r => r.brandManager).filter(Boolean))],
    categoryManagers: [...new Set(rawData.map(r => String(r['ФИО МП категорийного менеджера WB'] || '')).filter(Boolean))],
    tags: {
        superGold: superGold.length,
        gold: gold.length,
        noProfit: noProfit.length,
        manualLocks: manualLocks.length,
    },
    skus: skusWithNmId.map(r => ({
        sku: r.sku,
        nmId: r.skuWb,
        tag: r.tag,
        status: r.status,
        categoryWB: r.categoryWb,
        subCategoryWB: r.subCategoryWb,
        brandManager: r.brandManager,
        categoryManager: rawData.find(raw => raw['SKU'] === r.sku)?.['ФИО МП категорийного менеджера WB'] || '',
    })),
};

fs.writeFileSync(
    path.join(JSON_DIR, 'sku-matrix.json'),
    JSON.stringify(skuMatrixJson, null, 2)
);
console.log(`✅ Generated sku-matrix.json (${skusWithNmId.length} SKUs with nmId)`);

console.log('\n🎉 All configs regenerated from Excel matrix!');
