// Script to parse SEO keywords Excel file and generate JSON
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '..', 'SEO_zaprosы.xlsx');
const OUTPUT_FILE = path.join(__dirname, '..', 'src/data/seo-keywords.json');
const SKU_MATRIX_FILE = path.join(__dirname, '..', 'src/data/sku-matrix.json');

console.log('Parsing SEO keywords file...');
const wb = XLSX.readFile(INPUT_FILE);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Load SKU matrix for product names
let skuMatrix = { skus: [] };
if (fs.existsSync(SKU_MATRIX_FILE)) {
    skuMatrix = JSON.parse(fs.readFileSync(SKU_MATRIX_FILE, 'utf-8'));
    console.log(`Loaded SKU matrix with ${skuMatrix.skus?.length || 0} SKUs`);
}
const skuMap = new Map(skuMatrix.skus?.map(s => [s.sku, s]) || []);

console.log(`Total rows: ${data.length}`);

// Aggregate by search phrase
const phraseStats = new Map();
const skuKeywords = new Map(); // SKU -> keywords with stats

for (let i = 3; i < data.length; i++) {
    const row = data[i];
    const sku = row[1];
    const phrase = row[2];
    const frequency = row[3] || 0;
    const position = row[4] || 0;
    const clicks = row[5] || 0;
    const cartAdds = row[6] || 0;
    const orders = row[8] || 0;

    if (!phrase || !sku) continue;

    // Aggregate phrase stats
    if (!phraseStats.has(phrase)) {
        phraseStats.set(phrase, {
            phrase,
            frequency: 0,
            totalClicks: 0,
            totalCartAdds: 0,
            totalOrders: 0,
            skus: new Set(),
            bestPosition: 9999, // Track BEST (minimum) position
            positionCount: 0
        });
    }
    const stats = phraseStats.get(phrase);
    stats.frequency = Math.max(stats.frequency, frequency);
    stats.totalClicks += clicks;
    stats.totalCartAdds += cartAdds;
    stats.totalOrders += orders;
    stats.skus.add(sku);
    if (position > 0) {
        stats.bestPosition = Math.min(stats.bestPosition, position); // Take BEST position
        stats.positionCount++;
    }

    // Aggregate SKU keywords
    if (!skuKeywords.has(sku)) {
        skuKeywords.set(sku, []);
    }
    const existing = skuKeywords.get(sku).find(k => k.phrase === phrase);
    if (existing) {
        existing.clicks += clicks;
        existing.cartAdds += cartAdds;
        existing.orders += orders;
        if (position > 0) {
            existing.bestPosition = Math.min(existing.bestPosition, position);
        }
    } else {
        skuKeywords.get(sku).push({
            phrase,
            frequency,
            bestPosition: position > 0 ? position : 9999,
            clicks,
            cartAdds,
            orders
        });
    }

    // Track per-SKU data for each phrase (for drill-down)
    if (!stats.skuDetails) {
        stats.skuDetails = {};
    }
    if (!stats.skuDetails[sku]) {
        stats.skuDetails[sku] = { position: 9999, clicks: 0, cartAdds: 0, orders: 0 };
    }
    const skuDetail = stats.skuDetails[sku];
    if (position > 0) {
        skuDetail.position = Math.min(skuDetail.position, position);
    }
    skuDetail.clicks += clicks;
    skuDetail.cartAdds += cartAdds;
    skuDetail.orders += orders;
}

// Convert to arrays and sort
const topPhrases = [...phraseStats.values()]
    .map(s => {
        // Build SKU breakdown sorted by orders (best converting first)
        const skuBreakdown = s.skuDetails ? Object.entries(s.skuDetails)
            .map(([sku, data]) => {
                const skuInfo = skuMap.get(sku);
                return {
                    sku,
                    nmId: skuInfo?.nmId || null,
                    name: skuInfo?.subCategoryWB || skuInfo?.categoryWB || sku,
                    category: skuInfo?.categoryWB || 'Неизвестно',
                    position: data.position < 9999 ? data.position : 0,
                    clicks: data.clicks,
                    cartAdds: data.cartAdds,
                    orders: data.orders,
                    crCart: data.clicks > 0 ? Math.round(data.cartAdds / data.clicks * 10000) / 100 : 0,
                    crOrder: data.clicks > 0 ? Math.round(data.orders / data.clicks * 10000) / 100 : 0
                };
            })
            .filter(d => d.clicks > 0 || d.orders > 0) // Only SKUs with activity
            .sort((a, b) => b.orders - a.orders || b.clicks - a.clicks)
            .slice(0, 30) // Top 30 SKUs per phrase
            : [];

        return {
            phrase: s.phrase,
            frequency: s.frequency,
            totalClicks: s.totalClicks,
            totalCartAdds: s.totalCartAdds,
            totalOrders: s.totalOrders,
            skuCount: s.skus.size,
            bestPosition: s.bestPosition < 9999 ? Math.round(s.bestPosition * 10) / 10 : 0,
            skuBreakdown
        };
    })
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 1000); // Top 1000 phrases

// Process SKU keywords - keep top 20 per SKU
const skuKeywordsObj = {};
for (const [sku, keywords] of skuKeywords) {
    skuKeywordsObj[sku] = keywords
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 20)
        .map(k => ({
            phrase: k.phrase,
            frequency: k.frequency,
            position: k.bestPosition < 9999 ? Math.round(k.bestPosition * 10) / 10 : 0,
            clicks: k.clicks,
            orders: k.orders
        }));
}

const result = {
    generatedAt: new Date().toISOString(),
    totalPhrases: phraseStats.size,
    totalSkus: skuKeywords.size,
    topPhrases,
    skuKeywords: skuKeywordsObj
};

// Ensure directory exists
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
console.log(`\nGenerated: ${OUTPUT_FILE}`);
console.log(`- Top phrases: ${topPhrases.length}`);
console.log(`- SKUs with keywords: ${Object.keys(skuKeywordsObj).length}`);
console.log(`\nTop 10 phrases by frequency:`);
topPhrases.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. "${p.phrase}" - ${p.frequency.toLocaleString()} searches, ${p.totalOrders} orders`);
});
