import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Lazy initialize to prevent build errors when Supabase is not configured
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
    if (!supabaseUrl || !supabaseKey) {
        return null;
    }
    if (!_supabase) {
        _supabase = createClient(supabaseUrl, supabaseKey);
    }
    return _supabase;
}

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
    return !!(supabaseUrl && supabaseKey);
}

// Table: daily_analytics
export interface DailyAnalytics {
    id?: number;
    date: string;
    order_sum: number;
    order_count: number;
    avg_check: number;
    open_count: number;
    cart_count: number;
    buyout_count: number;
    buyout_sum: number;
    cr_cart: number;
    cr_order: number;
    buyout_percent: number;
    advert_spend: number;
    drr: number;
    created_at?: string;
    updated_at?: string;
}

// Get analytics for a date range
export async function getAnalyticsForPeriod(startDate: string, endDate: string): Promise<DailyAnalytics[]> {
    const client = getSupabase();
    if (!client) return [];

    const { data, error } = await client
        .from('daily_analytics')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

    if (error) {
        console.error('Error fetching analytics:', error);
        return [];
    }

    return data || [];
}

// Upsert analytics (insert or update)
export async function upsertAnalytics(records: DailyAnalytics[]): Promise<boolean> {
    const client = getSupabase();
    if (!client) return false;

    const { error } = await client
        .from('daily_analytics')
        .upsert(records, { onConflict: 'date' });

    if (error) {
        console.error('Error upserting analytics:', error);
        return false;
    }

    return true;
}

// Get the latest date we have data for
export async function getLatestAnalyticsDate(): Promise<string | null> {
    const client = getSupabase();
    if (!client) return null;

    const { data, error } = await client
        .from('daily_analytics')
        .select('date')
        .order('date', { ascending: false })
        .limit(1);

    if (error || !data || data.length === 0) {
        return null;
    }

    return data[0].date;
}

// PowerBI Analytics interface (enriched data with KP - commercial profit)
export interface PowerBIAnalytics {
    date: string;
    sku: string;
    clicks: number;
    add_to_cart: number;
    price_rub: number;
    orders_qty: number;
    ctr: number;
    cr_cart: number;
    cr_order: number;
    revenue_with_vat: number;
    commercial_profit: number; // КП до МКТ
    profit_margin_pct: number;
    profit_per_unit: number;
    buyer_price: number;
    kp_percent: number;
    calculated_profit: number;
    current_stock: number;
}

// Aggregated daily metrics from PowerBI data
export interface PowerBIDailyMetrics {
    date: string;
    orderSum: number;       // revenue_with_vat sum
    orderCount: number;     // orders_qty sum
    avgCheck: number;       // calculated
    clickCount: number;     // clicks sum
    cartCount: number;      // add_to_cart sum
    ctr: number;            // avg CTR
    crCart: number;         // avg CR cart
    crOrder: number;        // avg CR order
    commercialProfit: number; // КП до МКТ sum
    profitMargin: number;   // avg profit margin
    stockCount: number;     // max stock
}

// Get PowerBI analytics aggregated by date
export async function getPowerBIAnalyticsForPeriod(
    startDate: string,
    endDate: string
): Promise<PowerBIDailyMetrics[]> {
    const client = getSupabase();
    if (!client) return [];

    // Fetch raw data from powerbi_analytics
    const { data, error } = await client
        .from('powerbi_analytics')
        .select('date, orders_qty, revenue_with_vat, clicks, add_to_cart, ctr, cr_cart, cr_order, commercial_profit, profit_margin_pct, current_stock')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

    if (error) {
        console.error('Error fetching PowerBI analytics:', error);
        return [];
    }

    if (!data || data.length === 0) return [];

    // Aggregate by date
    const dailyMap = new Map<string, {
        orderSum: number;
        orderCount: number;
        clickCount: number;
        cartCount: number;
        ctrSum: number;
        crCartSum: number;
        crOrderSum: number;
        commercialProfit: number;
        profitMarginSum: number;
        stockMax: number;
        skuCount: number;
    }>();

    for (const row of data) {
        const date = row.date;
        if (!dailyMap.has(date)) {
            dailyMap.set(date, {
                orderSum: 0,
                orderCount: 0,
                clickCount: 0,
                cartCount: 0,
                ctrSum: 0,
                crCartSum: 0,
                crOrderSum: 0,
                commercialProfit: 0,
                profitMarginSum: 0,
                stockMax: 0,
                skuCount: 0,
            });
        }

        const day = dailyMap.get(date)!;
        day.orderSum += row.revenue_with_vat || 0;
        day.orderCount += row.orders_qty || 0;
        day.clickCount += row.clicks || 0;
        day.cartCount += row.add_to_cart || 0;
        day.ctrSum += row.ctr || 0;
        day.crCartSum += row.cr_cart || 0;
        day.crOrderSum += row.cr_order || 0;
        day.commercialProfit += row.commercial_profit || 0;
        day.profitMarginSum += row.profit_margin_pct || 0;
        day.stockMax = Math.max(day.stockMax, row.current_stock || 0);
        day.skuCount += 1;
    }

    // Convert to array
    const result: PowerBIDailyMetrics[] = [];
    for (const [date, day] of dailyMap) {
        result.push({
            date,
            orderSum: day.orderSum,
            orderCount: day.orderCount,
            avgCheck: day.orderCount > 0 ? day.orderSum / day.orderCount : 0,
            clickCount: day.clickCount,
            cartCount: day.cartCount,
            ctr: day.skuCount > 0 ? day.ctrSum / day.skuCount : 0,
            crCart: day.skuCount > 0 ? day.crCartSum / day.skuCount : 0,
            crOrder: day.skuCount > 0 ? day.crOrderSum / day.skuCount : 0,
            commercialProfit: day.commercialProfit,
            profitMargin: day.skuCount > 0 ? day.profitMarginSum / day.skuCount : 0,
            stockCount: day.stockMax,
        });
    }

    return result.sort((a, b) => a.date.localeCompare(b.date));
}

// Get latest date from PowerBI analytics
export async function getLatestPowerBIDate(): Promise<string | null> {
    const client = getSupabase();
    if (!client) return null;

    const { data, error } = await client
        .from('powerbi_analytics')
        .select('date')
        .order('date', { ascending: false })
        .limit(1);

    if (error || !data || data.length === 0) {
        return null;
    }

    return data[0].date;
}

