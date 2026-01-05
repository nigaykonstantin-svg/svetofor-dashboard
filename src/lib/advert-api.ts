// Advert API Client for DRR calculation
const WB_API_TOKEN = process.env.WB_API_TOKEN;
const ADVERT_API = 'https://advert-api.wildberries.ru';

export interface AdvertCampaign {
    advertId: number;
    changeTime: string;
    status: number;
}

export interface AdvertStats {
    advertId: number;
    date: string;
    views: number;
    clicks: number;
    ctr: number;
    cpc: number;
    sum: number; // потрачено рублей
    atbs: number; // добавлено в корзину
    orders: number;
    shks: number; // штуки
    sum_price: number; // сумма заказов
}

export interface SkuDRR {
    nmId: number;
    advertSpend: number;
    advertOrders: number;
    advertOrdersSum: number;
    drr: number; // % = spend / ordersSum * 100
}

// Получить список активных рекламных кампаний
export async function getActiveCampaigns(): Promise<{ advertId: number; status: number; type: number }[]> {
    const response = await fetch(
        `${ADVERT_API}/adv/v1/promotion/count`,
        {
            headers: {
                Authorization: WB_API_TOKEN || '',
            },
        }
    );

    if (!response.ok) {
        console.error(`Advert API Error: ${response.status}`);
        return [];
    }

    const data = await response.json();
    // Возвращаем только активные кампании (status: 9 = активна, 11 = на паузе)
    const campaigns: { advertId: number; status: number; type: number }[] = [];

    for (const group of data.adverts || []) {
        for (const advert of group.advert_list || []) {
            if (group.status === 9 || group.status === 11) {
                campaigns.push({
                    advertId: advert.advertId,
                    status: group.status,
                    type: group.type,
                });
            }
        }
    }

    return campaigns;
}

// Получить статистику расходов за период
export async function getAdvertStatistics(
    campaignIds: number[],
    dates: string[]
): Promise<AdvertStats[]> {
    if (campaignIds.length === 0 || dates.length === 0) {
        return [];
    }

    // WB ограничивает до 100 кампаний за раз
    const batchSize = 100;
    const allStats: AdvertStats[] = [];

    for (let i = 0; i < campaignIds.length; i += batchSize) {
        const batch = campaignIds.slice(i, i + batchSize);

        const body = batch.map(id => ({
            id,
            dates,
        }));

        try {
            const response = await fetch(
                `${ADVERT_API}/adv/v2/fullstats`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: WB_API_TOKEN || '',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                }
            );

            if (response.status === 429) {
                console.warn('Advert API rate limit hit, waiting...');
                await new Promise(r => setTimeout(r, 60000));
                continue;
            }

            if (!response.ok) {
                console.error(`Advert Fullstats Error: ${response.status}`);
                continue;
            }

            const data = await response.json();

            // Парсим ответ - он содержит статистику по дням и nmId
            for (const campaign of data || []) {
                for (const day of campaign.days || []) {
                    for (const app of day.apps || []) {
                        for (const nm of app.nm || []) {
                            allStats.push({
                                advertId: campaign.advertId,
                                date: day.date,
                                views: nm.views || 0,
                                clicks: nm.clicks || 0,
                                ctr: nm.ctr || 0,
                                cpc: nm.cpc || 0,
                                sum: nm.sum || 0,
                                atbs: nm.atbs || 0,
                                orders: nm.orders || 0,
                                shks: nm.shks || 0,
                                sum_price: nm.sum_price || 0,
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Advert API fetch error:', error);
        }
    }

    return allStats;
}

// Рассчитать ДРР по SKU
export function calculateDRRByNmId(
    stats: AdvertStats[],
    salesByNmId: Map<number, number> // nmId -> orderSum from Sales API
): Map<number, SkuDRR> {
    const drrMap = new Map<number, SkuDRR>();

    // Группируем рекламные расходы по nmId
    const spendByNmId = new Map<number, { spend: number; orders: number; ordersSum: number }>();

    for (const stat of stats) {
        // nmId определяется из структуры nm в ответе API
        // Для упрощения используем advertId как ключ (позже можно улучшить)
        const nmId = stat.advertId; // TODO: получить реальный nmId из структуры

        const current = spendByNmId.get(nmId) || { spend: 0, orders: 0, ordersSum: 0 };
        current.spend += stat.sum;
        current.orders += stat.orders;
        current.ordersSum += stat.sum_price;
        spendByNmId.set(nmId, current);
    }

    // Рассчитываем ДРР
    for (const [nmId, data] of spendByNmId) {
        const totalSales = salesByNmId.get(nmId) || data.ordersSum;
        const drr = totalSales > 0 ? (data.spend / totalSales) * 100 : 0;

        drrMap.set(nmId, {
            nmId,
            advertSpend: data.spend,
            advertOrders: data.orders,
            advertOrdersSum: data.ordersSum,
            drr,
        });
    }

    return drrMap;
}

// Получить ДРР за последние N дней
export async function getDRRForPeriod(days: number = 7): Promise<Map<number, SkuDRR>> {
    // Генерируем даты
    const dates: string[] = [];
    const today = new Date();

    for (let i = 1; i <= days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
    }

    console.log(`Fetching DRR for dates: ${dates.join(', ')}`);

    // Получаем активные кампании
    const campaigns = await getActiveCampaigns();
    console.log(`Found ${campaigns.length} active campaigns`);

    if (campaigns.length === 0) {
        return new Map();
    }

    // Получаем статистику
    const stats = await getAdvertStatistics(
        campaigns.map(c => c.advertId),
        dates
    );

    console.log(`Got ${stats.length} stat records`);

    // Рассчитываем ДРР (без данных о продажах - используем только рекламные данные)
    return calculateDRRByNmId(stats, new Map());
}
