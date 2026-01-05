import { NextResponse } from 'next/server';
import { getOrders } from '@/lib/wb-api';

interface HourlyStat {
    hour: number;
    today: number;
    yesterday: number;
    diff: number;
    diffPercent: number;
}

export async function GET() {
    try {
        // Получаем заказы за последние 7 дней
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dateFrom = sevenDaysAgo.toISOString().split('T')[0];

        console.log(`Fetching orders from ${dateFrom}...`);
        const ordersData = await getOrders(dateFrom);
        console.log(`Received ${ordersData.length} orders`);

        // Находим самую свежую дату в данных
        const allDates = ordersData
            .map(o => o.date?.split('T')[0])
            .filter(Boolean);

        const uniqueDates = [...new Set(allDates)].sort().reverse();

        // Используем 2 последние доступные даты
        const latestDate = uniqueDates[0] || null;
        const previousDate = uniqueDates[1] || null;

        if (!latestDate || !previousDate) {
            return NextResponse.json({
                success: false,
                error: 'Недостаточно данных для сравнения',
                availableDates: uniqueDates,
            });
        }

        const now = new Date();
        const currentHour = now.getHours();

        // Агрегируем по часам
        const latestByHour: Record<number, number> = {};
        const previousByHour: Record<number, number> = {};

        let latestOrdersCount = 0;
        let previousOrdersCount = 0;

        // Инициализируем часы
        for (let h = 0; h <= 23; h++) {
            latestByHour[h] = 0;
            previousByHour[h] = 0;
        }

        // Считаем сумму заказов
        for (const order of ordersData) {
            const orderDateStr = order.date || order.createdAt;
            if (!orderDateStr) continue;

            const orderDate = orderDateStr.split('T')[0];
            const orderTime = orderDateStr.split('T')[1];
            const orderHour = orderTime ? parseInt(orderTime.split(':')[0], 10) : null;

            if (orderHour === null) continue;

            // Сумма заказа
            const amount = order.finishedPrice || order.priceWithDisc || order.totalPrice || 0;

            if (orderDate === latestDate) {
                latestByHour[orderHour] = (latestByHour[orderHour] || 0) + amount;
                latestOrdersCount++;
            } else if (orderDate === previousDate) {
                previousByHour[orderHour] = (previousByHour[orderHour] || 0) + amount;
                previousOrdersCount++;
            }
        }

        console.log(`Latest (${latestDate}) orders: ${latestOrdersCount}, Previous (${previousDate}) orders: ${previousOrdersCount}`);

        // Формируем почасовую статистику (все 24 часа для полных дней)
        const hourlyStats: HourlyStat[] = [];

        for (let h = 0; h <= 23; h++) {
            const latestVal = Math.round(latestByHour[h]);
            const previousVal = Math.round(previousByHour[h]);
            const diff = latestVal - previousVal;
            const diffPercent = previousVal > 0
                ? Math.round((diff / previousVal) * 100)
                : (latestVal > 0 ? 100 : 0);

            hourlyStats.push({
                hour: h,
                today: latestVal,
                yesterday: previousVal,
                diff,
                diffPercent,
            });
        }

        // Накопительные итоги
        const latestTotal = hourlyStats.reduce((sum, s) => sum + s.today, 0);
        const previousTotal = hourlyStats.reduce((sum, s) => sum + s.yesterday, 0);
        const totalDiff = latestTotal - previousTotal;
        const totalDiffPercent = previousTotal > 0
            ? Math.round((totalDiff / previousTotal) * 100)
            : 0;

        // Рассчитываем дни до сегодня
        const today = new Date().toISOString().split('T')[0];
        const daysAgo = Math.floor((new Date(today).getTime() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24));

        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            currentHour,
            dataDelay: {
                daysAgo,
                message: daysAgo > 0
                    ? `⚠️ Данные WB API с задержкой ${daysAgo} дня`
                    : 'Данные актуальны',
            },
            dates: {
                today: latestDate,
                yesterday: previousDate,
                availableDates: uniqueDates.slice(0, 5),
            },
            debug: {
                totalOrders: ordersData.length,
                latestOrdersCount,
                previousOrdersCount,
            },
            hourlyStats,
            summary: {
                todayTotal: Math.round(latestTotal),
                yesterdayAtSameTime: Math.round(previousTotal), // Для полных дней это полный день
                yesterdayFullDay: Math.round(previousTotal),
                diff: Math.round(totalDiff),
                diffPercent: totalDiffPercent,
                forecastToday: Math.round(latestTotal), // Для полного дня прогноз = факт
            },
        });

    } catch (error) {
        console.error('Hourly Comparison API Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
