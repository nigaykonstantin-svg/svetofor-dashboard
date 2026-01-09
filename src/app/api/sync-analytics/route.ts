import { NextRequest, NextResponse } from 'next/server';
import { upsertAnalytics, getLatestAnalyticsDate, getLatestPowerBIDate, DailyAnalytics, isSupabaseConfigured } from '@/lib/supabase';

// API to sync analytics data from WB to Supabase using reportDetailByPeriod (v5)
// This API provides detailed sales reports per period

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const syncSecret = process.env.SYNC_SECRET || 'mixit-sync-2026';

    if (authHeader !== `Bearer ${syncSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSupabaseConfigured()) {
        return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 });
    }

    const token = process.env.WB_API_TOKEN;
    const statisticsApiBase = process.env.WB_STATISTICS_API || 'https://statistics-api.wildberries.ru';

    if (!token) {
        return NextResponse.json({ success: false, error: 'WB_API_TOKEN not configured' }, { status: 500 });
    }

    try {
        const latestDailyDate = await getLatestAnalyticsDate();
        const latestPowerBIDate = await getLatestPowerBIDate();

        // Use the later of the two dates to avoid overlapping with PowerBI data
        let latestDate = latestDailyDate;
        if (latestPowerBIDate && (!latestDate || latestPowerBIDate > latestDate)) {
            latestDate = latestPowerBIDate;
        }

        const endDate = new Date();
        endDate.setDate(endDate.getDate() - 1);

        let startDate: Date;
        if (latestDate) {
            startDate = new Date(latestDate);
            startDate.setDate(startDate.getDate() + 1);
        } else {
            // First sync - but we should start from a reasonable date
            startDate = new Date('2025-12-24'); // Start after PowerBI data ends
        }

        if (startDate > endDate) {
            return NextResponse.json({
                success: true,
                message: 'Already up to date',
                latestDate,
            });
        }

        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        console.log(`Syncing from ${formatDate(startDate)} to ${formatDate(endDate)} using reportDetailByPeriod`);

        // Use reportDetailByPeriod v5 - provides detailed weekly reports
        const reportResponse = await fetch(
            `${statisticsApiBase}/api/v5/supplier/reportDetailByPeriod?dateFrom=${formatDate(startDate)}&dateTo=${formatDate(endDate)}`,
            {
                headers: {
                    'Authorization': token,
                },
            }
        );

        const dailyMap: Map<string, DailyAnalytics> = new Map();

        if (reportResponse.ok) {
            const reportData = await reportResponse.json();
            console.log(`reportDetailByPeriod returned ${reportData.length} records`);

            // Aggregate by sale date
            for (const item of reportData) {
                const saleDate = item.sale_dt?.split('T')[0];
                if (!saleDate) continue;

                if (!dailyMap.has(saleDate)) {
                    dailyMap.set(saleDate, {
                        date: saleDate,
                        order_sum: 0,
                        order_count: 0,
                        avg_check: 0,
                        open_count: 0,
                        cart_count: 0,
                        buyout_count: 0,
                        buyout_sum: 0,
                        cr_cart: 0,
                        cr_order: 0,
                        buyout_percent: 0,
                        advert_spend: 0,
                        drr: 0,
                    });
                }

                const day = dailyMap.get(saleDate)!;

                // Calculate based on doc_type
                if (item.doc_type_name === 'Продажа') {
                    day.order_count += item.quantity || 1;
                    day.order_sum += item.retail_price_withdisc_rub || item.ppvz_for_pay || 0;
                    day.buyout_count += item.quantity || 1;
                    day.buyout_sum += item.ppvz_for_pay || 0;
                } else if (item.doc_type_name === 'Возврат') {
                    day.buyout_count -= item.quantity || 1;
                    day.buyout_sum -= item.ppvz_for_pay || 0;
                }
            }
        } else {
            const errorText = await reportResponse.text();
            console.error(`reportDetailByPeriod failed: ${reportResponse.status}`, errorText);
            return NextResponse.json({ success: false, error: `API error: ${reportResponse.status}` }, { status: 500 });
        }

        // Calculate derived metrics - save ALL dates with data
        const records: DailyAnalytics[] = Array.from(dailyMap.values())
            .map(day => ({
                ...day,
                avg_check: day.order_count > 0 ? day.order_sum / day.order_count : 0,
                buyout_percent: day.order_count > 0 ? (day.buyout_count / day.order_count) * 100 : 0,
            }));

        if (records.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No new data to sync',
            });
        }

        console.log(`Saving ${records.length} days to Supabase`);

        const success = await upsertAnalytics(records);

        if (!success) {
            return NextResponse.json({ success: false, error: 'Failed to save to Supabase' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Synced ${records.length} days of data`,
            dateRange: {
                from: formatDate(startDate),
                to: formatDate(endDate),
            },
            newRecords: records.length,
        });

    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function GET() {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({
            success: false,
            configured: false,
            message: 'Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY to .env.local'
        });
    }

    const latestDate = await getLatestAnalyticsDate();

    return NextResponse.json({
        success: true,
        configured: true,
        latestDate,
        message: latestDate
            ? `Data synced up to ${latestDate}`
            : 'No data synced yet. POST to this endpoint to start sync.',
    });
}
