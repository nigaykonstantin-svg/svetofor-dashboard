import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsForPeriod, isSupabaseConfigured, DailyAnalytics, getPowerBIAnalyticsForPeriod, PowerBIDailyMetrics } from '@/lib/supabase';

// Server-side cache
interface CacheEntry {
    data: any;
    timestamp: number;
}

const analyticsCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function getCacheKey(period: number, category: string): string {
    const today = new Date().toISOString().split('T')[0];
    return `analytics_${period}_${category}_${today}`;
}

interface DailyMetrics {
    date: string;
    orderSum: number;
    orderCount: number;
    avgCheck: number;
    openCount: number;
    cartCount: number;
    buyoutCount: number;
    buyoutSum: number;
    crCart: number;
    crOrder: number;
    buyoutPercent: number;
    advertSpend: number;
    drr: number;
    // PowerBI enriched metrics
    commercialProfit?: number;
    profitMargin?: number;
    clickCount?: number;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    // Allow up to 3 years (1095 days) for PowerBI data
    const period = Math.min(parseInt(searchParams.get('period') || '90'), 1095);
    const category = searchParams.get('category') || '';

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - period);

    // Check cache first
    const cacheKey = getCacheKey(period, category);
    const cached = analyticsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
    }

    // Try PowerBI data first (3 years of enriched data with КП)
    if (isSupabaseConfigured()) {
        try {
            const powerbiData = await getPowerBIAnalyticsForPeriod(formatDate(startDate), formatDate(endDate));

            if (powerbiData.length > 0) {
                const data: DailyMetrics[] = powerbiData.map((d: PowerBIDailyMetrics) => ({
                    date: d.date,
                    orderSum: d.orderSum,
                    orderCount: d.orderCount,
                    avgCheck: d.avgCheck,
                    openCount: d.clickCount,
                    cartCount: d.cartCount,
                    buyoutCount: d.orderCount,
                    buyoutSum: d.orderSum,
                    crCart: d.crCart * 100,
                    crOrder: d.crOrder * 100,
                    buyoutPercent: 100,
                    advertSpend: 0,
                    drr: 0,
                    commercialProfit: d.commercialProfit,
                    profitMargin: d.profitMargin * 100,
                    clickCount: d.clickCount,
                }));

                const totals = data.reduce(
                    (acc, day) => ({
                        orderSum: acc.orderSum + day.orderSum,
                        orderCount: acc.orderCount + day.orderCount,
                        openCount: acc.openCount + (day.openCount || 0),
                        cartCount: acc.cartCount + day.cartCount,
                        buyoutCount: acc.buyoutCount + day.buyoutCount,
                        buyoutSum: acc.buyoutSum + day.buyoutSum,
                        advertSpend: acc.advertSpend + day.advertSpend,
                        commercialProfit: acc.commercialProfit + (day.commercialProfit || 0),
                    }),
                    { orderSum: 0, orderCount: 0, openCount: 0, cartCount: 0, buyoutCount: 0, buyoutSum: 0, advertSpend: 0, commercialProfit: 0 }
                );

                const responseData = {
                    success: true,
                    source: 'powerbi',
                    period,
                    startDate: formatDate(startDate),
                    endDate: formatDate(endDate),
                    daysCount: data.length,
                    totals: {
                        ...totals,
                        avgCheck: totals.orderCount > 0 ? totals.orderSum / totals.orderCount : 0,
                        crCart: totals.openCount > 0 ? (totals.cartCount / totals.openCount) * 100 : 0,
                        crOrder: totals.cartCount > 0 ? (totals.orderCount / totals.cartCount) * 100 : 0,
                        buyoutPercent: 100,
                        drr: 0,
                        profitMargin: totals.orderSum > 0 ? (totals.commercialProfit / totals.orderSum) * 100 : 0,
                    },
                    data,
                };

                analyticsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
                return NextResponse.json(responseData);
            }

            // Fallback to daily_analytics if no PowerBI data
            const supabaseData = await getAnalyticsForPeriod(formatDate(startDate), formatDate(endDate));

            if (supabaseData.length > 0) {
                const data: DailyMetrics[] = supabaseData.map((d: DailyAnalytics) => ({
                    date: d.date,
                    orderSum: d.order_sum,
                    orderCount: d.order_count,
                    avgCheck: d.avg_check,
                    openCount: d.open_count,
                    cartCount: d.cart_count,
                    buyoutCount: d.buyout_count,
                    buyoutSum: d.buyout_sum,
                    crCart: d.cr_cart,
                    crOrder: d.cr_order,
                    buyoutPercent: d.buyout_percent,
                    advertSpend: d.advert_spend,
                    drr: d.drr,
                }));

                const totals = data.reduce(
                    (acc, day) => ({
                        orderSum: acc.orderSum + day.orderSum,
                        orderCount: acc.orderCount + day.orderCount,
                        openCount: acc.openCount + day.openCount,
                        cartCount: acc.cartCount + day.cartCount,
                        buyoutCount: acc.buyoutCount + day.buyoutCount,
                        buyoutSum: acc.buyoutSum + day.buyoutSum,
                        advertSpend: acc.advertSpend + day.advertSpend,
                    }),
                    { orderSum: 0, orderCount: 0, openCount: 0, cartCount: 0, buyoutCount: 0, buyoutSum: 0, advertSpend: 0 }
                );

                const responseData = {
                    success: true,
                    source: 'supabase',
                    period,
                    startDate: formatDate(startDate),
                    endDate: formatDate(endDate),
                    daysCount: data.length,
                    totals: {
                        ...totals,
                        avgCheck: totals.orderCount > 0 ? totals.orderSum / totals.orderCount : 0,
                        crCart: totals.openCount > 0 ? (totals.cartCount / totals.openCount) * 100 : 0,
                        crOrder: totals.cartCount > 0 ? (totals.orderCount / totals.cartCount) * 100 : 0,
                        buyoutPercent: totals.orderCount > 0 ? (totals.buyoutCount / totals.orderCount) * 100 : 0,
                        drr: totals.orderSum > 0 ? (totals.advertSpend / totals.orderSum) * 100 : 0,
                    },
                    data,
                };

                analyticsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
                return NextResponse.json(responseData);
            }
        } catch (error) {
            console.error('Supabase error:', error);
        }
    }

    // No data available
    return NextResponse.json({
        success: true,
        source: 'none',
        period,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        daysCount: 0,
        totals: {
            orderSum: 0,
            orderCount: 0,
            avgCheck: 0,
            openCount: 0,
            cartCount: 0,
            crCart: 0,
            crOrder: 0,
            buyoutPercent: 0,
            drr: 0,
            commercialProfit: 0,
            profitMargin: 0,
        },
        data: [],
    });
}
