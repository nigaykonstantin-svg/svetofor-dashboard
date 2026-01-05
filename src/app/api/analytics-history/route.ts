import { NextRequest, NextResponse } from 'next/server';

// WB APIs
const STATISTICS_API = 'https://statistics-api.wildberries.ru';

// Server-side cache for historical data
interface CacheEntry {
    data: any;
    timestamp: number;
}

const analyticsCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000; // 30 min for historical data

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
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const period = Math.min(parseInt(searchParams.get('period') || '90'), 365);
    const category = searchParams.get('category') || '';

    const token = process.env.WB_API_TOKEN;
    if (!token) {
        return NextResponse.json({ success: false, error: 'WB_API_TOKEN not configured' }, { status: 500 });
    }

    // Check cache first
    const cacheKey = getCacheKey(period, category);
    const cached = analyticsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`Analytics cache HIT for ${cacheKey}`);
        return NextResponse.json(cached.data);
    }
    console.log(`Analytics cache MISS for ${cacheKey}, fetching from WB API...`);
    console.log(`Requested period: ${period} days, category: ${category || 'all'}`);

    try {
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - period);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        // Statistics API requires RFC3339 format
        const formatDateRFC = (d: Date) => d.toISOString();

        const dailyData: Map<string, DailyMetrics> = new Map();

        // Use Sales API - most reliable data source
        const salesResponse = await fetch(
            `${STATISTICS_API}/api/v1/supplier/sales?dateFrom=${formatDateRFC(startDate)}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        if (salesResponse.ok) {
            const salesData = await salesResponse.json();
            console.log(`Sales API returned ${salesData.length} records`);

            // Aggregate sales by day
            for (const sale of salesData) {
                const date = sale.date?.split('T')[0];
                if (!date) continue;

                if (!dailyData.has(date)) {
                    dailyData.set(date, {
                        date,
                        orderSum: 0,
                        orderCount: 0,
                        avgCheck: 0,
                        openCount: 0,
                        cartCount: 0,
                        buyoutCount: 0,
                        buyoutSum: 0,
                        crCart: 0,
                        crOrder: 0,
                        buyoutPercent: 0,
                        advertSpend: 0,
                        drr: 0,
                    });
                }

                const day = dailyData.get(date)!;
                // forSale = выкуп (1), return = возврат (-1) 
                const isSale = sale.saleID?.startsWith('S');
                if (isSale) {
                    day.buyoutCount += 1;
                    day.buyoutSum += sale.finishedPrice || sale.priceWithDisc || 0;
                }
            }
        } else {
            console.log(`Sales API failed: ${salesResponse.status}`);
        }

        // Fetch orders for order counts
        const ordersResponse = await fetch(
            `${STATISTICS_API}/api/v1/supplier/orders?dateFrom=${formatDateRFC(startDate)}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        if (ordersResponse.ok) {
            const ordersData = await ordersResponse.json();
            console.log(`Orders API returned ${ordersData.length} records`);

            // Aggregate orders by day
            for (const order of ordersData) {
                const date = order.date?.split('T')[0];
                if (!date) continue;

                if (!dailyData.has(date)) {
                    dailyData.set(date, {
                        date,
                        orderSum: 0,
                        orderCount: 0,
                        avgCheck: 0,
                        openCount: 0,
                        cartCount: 0,
                        buyoutCount: 0,
                        buyoutSum: 0,
                        crCart: 0,
                        crOrder: 0,
                        buyoutPercent: 0,
                        advertSpend: 0,
                        drr: 0,
                    });
                }

                const day = dailyData.get(date)!;
                if (!order.isCancel) {
                    day.orderCount += 1;
                    day.orderSum += order.finishedPrice || order.priceWithDisc || 0;
                }
            }
        } else {
            console.log(`Orders API failed: ${ordersResponse.status}`);
        }

        // Calculate derived metrics, filter by date range, and sort by date
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        const result: DailyMetrics[] = Array.from(dailyData.values())
            // Filter to only include dates within the requested period
            .filter(day => day.date >= startDateStr && day.date <= endDateStr)
            .map(day => ({
                ...day,
                avgCheck: day.orderCount > 0 ? day.orderSum / day.orderCount : 0,
                buyoutPercent: day.orderCount > 0 ? (day.buyoutCount / day.orderCount) * 100 : 0,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        console.log(`Filtered to ${result.length} days within period ${startDateStr} to ${endDateStr}`);

        // Calculate totals for the period
        const totals = result.reduce(
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
            period,
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            daysCount: result.length,
            totals: {
                ...totals,
                avgCheck: totals.orderCount > 0 ? totals.orderSum / totals.orderCount : 0,
                crCart: totals.openCount > 0 ? (totals.cartCount / totals.openCount) * 100 : 0,
                crOrder: totals.cartCount > 0 ? (totals.orderCount / totals.cartCount) * 100 : 0,
                buyoutPercent: totals.orderCount > 0 ? (totals.buyoutCount / totals.orderCount) * 100 : 0,
                drr: totals.orderSum > 0 ? (totals.advertSpend / totals.orderSum) * 100 : 0,
            },
            data: result,
        };

        // Save to cache
        analyticsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
        console.log(`Analytics cached for ${cacheKey}`);

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('Analytics history error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
