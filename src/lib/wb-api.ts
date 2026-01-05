// WB API Client for Svetofor MVP
const WB_API_TOKEN = process.env.WB_API_TOKEN;

const STATISTICS_API = 'https://statistics-api.wildberries.ru';
const ANALYTICS_API = 'https://seller-analytics-api.wildberries.ru';

export interface WBStock {
    supplierArticle: string;
    nmId: number;
    barcode: string;
    quantity: number;
    inWayToClient: number;
    inWayFromClient: number;
    quantityFull: number;
    warehouseName: string;
    category: string;
    subject: string;
    brand: string;
    Price: number;
    Discount: number;
}

export interface WBFunnelProduct {
    product: {
        nmId: number;
        title: string;
        vendorCode: string;
        brandName: string;
        subjectName: string;
        stocks: {
            wb: number;
            mp: number;
        };
    };
    statistic: {
        selected: {
            openCount: number;
            cartCount: number;
            orderCount: number;
            orderSum: number;
            buyoutCount: number;
            conversions: {
                addToCartPercent: number;
                cartToOrderPercent: number;
                buyoutPercent: number;
            };
        };
    };
}

export async function getStocks(): Promise<WBStock[]> {
    const response = await fetch(
        `${STATISTICS_API}/api/v1/supplier/stocks?dateFrom=2024-01-01`,
        {
            headers: {
                Authorization: `Bearer ${WB_API_TOKEN}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error(`WB API Error: ${response.status}`);
    }

    return response.json();
}

export async function getSalesFunnel(periodDays: number = 5): Promise<WBFunnelProduct[]> {
    // Периоды: selectedPeriod = последние N дней до вчера
    // pastPeriod = N дней до selectedPeriod (для сравнения)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Selected: N дней назад → вчера
    const selectedStart = new Date(yesterday);
    selectedStart.setDate(selectedStart.getDate() - (periodDays - 1));

    // Past: 2*N дней назад → N+1 дней назад (ДО selected!)
    const pastEnd = new Date(selectedStart);
    pastEnd.setDate(pastEnd.getDate() - 1); // день ПЕРЕД selected

    const pastStart = new Date(pastEnd);
    pastStart.setDate(pastStart.getDate() - (periodDays - 1)); // N дней назад от pastEnd

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    console.log(`Funnel API: selected=${formatDate(selectedStart)} to ${formatDate(yesterday)}, past=${formatDate(pastStart)} to ${formatDate(pastEnd)} (${periodDays}d period)`);

    const response = await fetch(
        `${ANALYTICS_API}/api/analytics/v3/sales-funnel/products`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${WB_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                selectedPeriod: {
                    start: formatDate(selectedStart),
                    end: formatDate(yesterday),
                },
                pastPeriod: {
                    start: formatDate(pastStart),
                    end: formatDate(pastEnd),
                },
                limit: 1000,
                offset: 0,
            }),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        console.error(`Funnel API Error: ${response.status} - ${error}`);
        throw new Error(`WB Funnel API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log(`Funnel API returned ${data.data?.products?.length || 0} products`);
    return data.data?.products || [];
}

export async function getSales(dateFrom: string): Promise<any[]> {
    const response = await fetch(
        `${STATISTICS_API}/api/v1/supplier/sales?dateFrom=${dateFrom}`,
        {
            headers: {
                Authorization: `Bearer ${WB_API_TOKEN}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error(`WB Sales API Error: ${response.status}`);
    }

    return response.json();
}

// Заказы - обновляются каждые 30 минут (в отличие от Sales с задержкой 1-2 дня)
export async function getOrders(dateFrom: string): Promise<any[]> {
    const response = await fetch(
        `${STATISTICS_API}/api/v1/supplier/orders?dateFrom=${dateFrom}`,
        {
            headers: {
                Authorization: `Bearer ${WB_API_TOKEN}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error(`WB Orders API Error: ${response.status}`);
    }

    return response.json();
}

