// Script to import NEW Power BI Excel data (Dec 24, 2025 - Jan 10, 2026)
// Column structure is different from the original file
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials. Run with: source .env.local && node scripts/import-powerbi-new.js');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Excel date serial to YYYY-MM-DD
function excelDateToJSDate(serial) {
    if (typeof serial === 'string') {
        // Already a date string or ISO format
        const parsed = new Date(serial);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }
        return null;
    }
    if (typeof serial !== 'number') return null;
    const utc_days = Math.floor(serial - 25569);
    const date = new Date(utc_days * 86400 * 1000);
    return date.toISOString().split('T')[0];
}

async function importData() {
    const filename = './отчет с 24.12.25 по 10.01.26.xlsx';
    console.log(`Reading Excel file: ${filename}`);

    const file = XLSX.readFile(filename);
    const sheet = file.Sheets[file.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Row 0 = filter info, Row 1 = empty, Row 2 = headers, Row 3+ = data
    const headers = rawData[2];
    const dataRows = rawData.slice(3);

    console.log(`Found ${dataRows.length} rows to process`);
    console.log('Headers:', headers.slice(0, 15), '...');

    /*
     * Column mapping for new file format:
     * 0: Дата -> date
     * 1: Артикул -> sku
     * 5: Suma de Клики -> clicks  
     * 6: Suma de В корзину -> add_to_cart
     * 7: Цена,руб. -> price_rub
     * 8: Suma de Заказано, шт. -> orders_qty
     * 10: CTR -> ctr
     * 11: CR в корзину -> cr_cart
     * 12: CR в заказ -> cr_order
     * 13: Suma de Выручка,руб. с НДС -> revenue_with_vat
     * 14: КП до МКТ, руб. -> commercial_profit
     * 15: КП/Выручка % -> profit_margin_pct  
     * 16: КП до МКТ на 1 шт. -> profit_per_unit
     * 17: Цена покупателя -> buyer_price
     * 21: КП,% -> kp_percent
     * 22: Suma de КП, расч. -> calculated_profit
     * 23: Suma de Текущий остаток -> current_stock
     */

    const records = [];
    const skippedDates = new Set();

    for (const row of dataRows) {
        if (!row[0]) continue; // Skip rows without date

        const dateStr = excelDateToJSDate(row[0]);
        if (!dateStr) continue;

        // Skip incomplete dates (Jan 9-10, 2026 have no revenue data)
        if (dateStr === '2026-01-09' || dateStr === '2026-01-10') {
            skippedDates.add(dateStr);
            continue;
        }

        // Skip rows without SKU (summary rows)
        if (!row[1]) continue;

        try {
            const record = {
                date: dateStr,
                sku: String(row[1]),
                clicks: Math.round(row[5] || 0),
                add_to_cart: Math.round(row[6] || 0),
                price_rub: parseFloat(row[7]) || 0,
                orders_qty: Math.round(row[8] || 0),
                ctr: parseFloat(row[10]) || 0,
                cr_cart: parseFloat(row[11]) || 0,
                cr_order: parseFloat(row[12]) || 0,
                revenue_with_vat: parseFloat(row[13]) || 0,
                commercial_profit: parseFloat(row[14]) || 0,
                profit_margin_pct: parseFloat(row[15]) || 0,
                profit_per_unit: parseFloat(row[16]) || 0,
                buyer_price: parseFloat(row[17]) || 0,
                kp_percent: parseFloat(row[21]) || 0,
                calculated_profit: parseFloat(row[22]) || 0,
                current_stock: Math.round(row[23] || 0),
            };
            records.push(record);
        } catch (e) {
            console.error('Error parsing row:', row.slice(0, 5), e.message);
        }
    }

    console.log(`Parsed ${records.length} valid records`);
    if (skippedDates.size > 0) {
        console.log(`Skipped dates (incomplete data): ${Array.from(skippedDates).join(', ')}`);
    }

    // Show date range
    const dates = [...new Set(records.map(r => r.date))].sort();
    console.log(`Date range: ${dates[0]} to ${dates[dates.length - 1]} (${dates.length} days)`);

    // Insert in batches of 1000
    const BATCH_SIZE = 1000;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('powerbi_analytics')
            .upsert(batch, { onConflict: 'date,sku' });

        if (error) {
            console.error(`Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
            errors++;
        } else {
            inserted += batch.length;
            if ((i + BATCH_SIZE) % 5000 === 0 || i + BATCH_SIZE >= records.length) {
                console.log(`Progress: ${inserted}/${records.length} records...`);
            }
        }
    }

    if (errors === 0) {
        console.log(`\n✅ Import complete! ${inserted} records inserted/updated.`);
    } else {
        console.log(`\n⚠️ Import finished with ${errors} batch errors. ${inserted} records inserted.`);
    }
}

importData().catch(console.error);
