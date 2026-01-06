// Script to import Power BI Excel data into Supabase
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials. Run with: source .env.local && node scripts/import-powerbi.js');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Excel date to JS date
function excelDateToJSDate(serial) {
    const utc_days = Math.floor(serial - 25569);
    const date = new Date(utc_days * 86400 * 1000);
    return date.toISOString().split('T')[0];
}

async function importData() {
    console.log('Reading Excel file...');
    const file = XLSX.readFile('./ВБ продажи за 2025, 2024,2023.xlsx');
    const sheet = file.Sheets[file.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Skip header rows (row 0 = filter info, row 1 = empty, row 2 = headers)
    const headers = rawData[2];
    const dataRows = rawData.slice(3);

    console.log(`Found ${dataRows.length} rows to import`);
    console.log('Headers:', headers);

    // Map columns
    const records = [];
    for (const row of dataRows) {
        if (!row[0] || !row[1]) continue; // Skip empty rows

        try {
            const record = {
                date: excelDateToJSDate(row[0]),
                sku: row[1],
                clicks: Math.round(row[2] || 0),
                add_to_cart: Math.round(row[3] || 0),
                price_rub: parseFloat(row[4]) || 0,
                orders_qty: Math.round(row[5] || 0),
                ctr: parseFloat(row[6]) || 0,
                cr_cart: parseFloat(row[7]) || 0,
                cr_order: parseFloat(row[8]) || 0,
                revenue_with_vat: parseFloat(row[9]) || 0,
                commercial_profit: parseFloat(row[10]) || 0,
                profit_margin_pct: parseFloat(row[11]) || 0,
                profit_per_unit: parseFloat(row[12]) || 0,
                buyer_price: parseFloat(row[13]) || 0,
                kp_percent: parseFloat(row[14]) || 0,
                calculated_profit: parseFloat(row[15]) || 0,
                current_stock: Math.round(row[16] || 0),
            };
            records.push(record);
        } catch (e) {
            console.error('Error parsing row:', row, e);
        }
    }

    console.log(`Parsed ${records.length} valid records`);

    // Insert in batches of 1000
    const BATCH_SIZE = 1000;
    let inserted = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('powerbi_analytics')
            .upsert(batch, { onConflict: 'date,sku' });

        if (error) {
            console.error(`Error inserting batch ${i}:`, error);
        } else {
            inserted += batch.length;
            console.log(`Inserted ${inserted}/${records.length} records...`);
        }
    }

    console.log(`✅ Import complete! ${inserted} records inserted.`);
}

importData().catch(console.error);
