import { NextRequest, NextResponse } from 'next/server';

// WB Analytics API for historical data
const WB_API_BASE = 'https://seller-analytics-api.wildberries.ru';

// Server-side cache for historical data (doesn't change often)
interface CacheEntry {
    data: any;
    timestamp: number;
}

const analyticsCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour for historical data

function getCacheKey(period: number, category: string): string {
    const today = new Date().toISOString().split('T')[0];
    return `analytics_${period}_${category}_${today}`;
}

interface DailyMetrics {
    date: string;
    // Revenue & Orders
    orderSum: number;
    orderCount: number;
    avgCheck: number;
    // Funnel
    openCount: number;
    cartCount: number;
    buyoutCount: number;
    buyoutSum: number;
    // Conversions
    crCart: number;     // % cart/views
    crOrder: number;    // % orders/cart
    buyoutPercent: number;
    // Advertising
    advertSpend: number;
    drr: number;        // % spend/revenue
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const period = parseInt(searchParams.get('period') || '90');
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

    try {
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - period);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        // Fetch funnel data from WB
        const funnelResponse = await fetch(
            `${WB_API_BASE}/api/v2/nm-report/detail/history`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nmIDs: [], // Empty = all products
                    period: {
                        begin: formatDate(startDate),
                        end: formatDate(endDate),
                    },
                    aggregationLevel: 'day',
                    timezone: 'Europe/Moscow',
                }),
            }
        );

        let funnelData: Record<string, DailyMetrics> = {};

        if (funnelResponse.ok) {
            const result = await funnelResponse.json();

            // Aggregate by day
            if (result.data) {
                for (const item of result.data) {
                    for (const history of item.history || []) {
                        const date = history.dt?.split('T')[0];
                        if (!date) continue;

                        if (!funnelData[date]) {
                            funnelData[date] = {
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
                            };
                        }

                        const day = funnelData[date];
                        day.openCount += history.openCardCount || 0;
                        day.cartCount += history.addToCartCount || 0;
                        day.orderCount += history.ordersCount || 0;
                        day.orderSum += history.ordersSumRub || 0;
                        day.buyoutCount += history.buyoutsCount || 0;
                        day.buyoutSum += history.buyoutsSumRub || 0;
                    }
                }
            }
        }

        // Calculate derived metrics and sort by date
        const dailyData: DailyMetrics[] = Object.values(funnelData)
            .map(day => ({
                ...day,
                avgCheck: day.orderCount > 0 ? day.orderSum / day.orderCount : 0,
                crCart: day.openCount > 0 ? (day.cartCount / day.openCount) * 100 : 0,
                crOrder: day.cartCount > 0 ? (day.orderCount / day.cartCount) * 100 : 0,
                buyoutPercent: day.orderCount > 0 ? (day.buyoutCount / day.orderCount) * 100 : 0,
                // DRR will be added from advert API
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Try to fetch advertising data for DRR
        try {
            const advertResponse = await fetch(
                'https://advert-api.wildberries.ru/adv/v2/fullstats',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify([]),
                }
            );

            if (advertResponse.ok) {
                const advertData = await advertResponse.json();
                // Aggregate advert spend by day
                const dailySpend: Record<string, number> = {};

                for (const campaign of advertData || []) {
                    for (const day of campaign.days || []) {
                        const date = day.date?.split('T')[0];
                        if (date) {
                            dailySpend[date] = (dailySpend[date] || 0) + (day.sum || 0);
                        }
                    }
                }

                // Add to daily data
                for (const day of dailyData) {
                    day.advertSpend = dailySpend[day.date] || 0;
                    day.drr = day.orderSum > 0 ? (day.advertSpend / day.orderSum) * 100 : 0;
                }
            }
        } catch (e) {
            console.log('Advert data fetch failed, continuing without DRR');
        }

        // Calculate totals for the period
        const totals = dailyData.reduce(
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
            daysCount: dailyData.length,
            totals: {
                ...totals,
                avgCheck: totals.orderCount > 0 ? totals.orderSum / totals.orderCount : 0,
                crCart: totals.openCount > 0 ? (totals.cartCount / totals.openCount) * 100 : 0,
                crOrder: totals.cartCount > 0 ? (totals.orderCount / totals.cartCount) * 100 : 0,
                buyoutPercent: totals.orderCount > 0 ? (totals.buyoutCount / totals.orderCount) * 100 : 0,
                drr: totals.orderSum > 0 ? (totals.advertSpend / totals.orderSum) * 100 : 0,
            },
            data: dailyData,
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
