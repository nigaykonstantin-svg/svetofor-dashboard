// WB API Client for Svetofor MVP
const WB_API_TOKEN = process.env.WB_API_TOKEN;

const STATISTICS_API = 'https://statistics-api.wildberries.ru';
const ANALYTICS_API = 'https://seller-analytics-api.wildberries.ru';
const CONTENT_API = 'https://content-api.wildberries.ru';

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

export interface WBFunnelStats {
    openCount: number;
    cartCount: number;
    orderCount: number;
    orderSum: number;
    buyoutCount: number;
    buyoutSum?: number;
    conversions: {
        addToCartPercent: number;
        cartToOrderPercent: number;
        buyoutPercent: number;
    };
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
        selected: WBFunnelStats;
        past?: WBFunnelStats; // Previous period for comparison
    };
    stocks?: {
        stocksWb: number;
        stocksMp: number;
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

// ============ CONTENT API ============

export interface WBCardPhoto {
    big: string;
    c246x328: string;
    c516x688: string;
    square: string;
    tm: string;
}

export interface WBCardCharacteristic {
    id: number;
    name: string;
    value: string[] | string;
}

export interface WBCard {
    nmID: number;
    imtID: number;
    vendorCode: string;
    subjectID: number;
    subjectName: string;
    brand: string;
    title: string;
    description: string;
    photos: WBCardPhoto[];
    video: string;
    characteristics: WBCardCharacteristic[];
    sizes: Array<{
        techSize: string;
        skus: string[];
        price: number;
        discountedPrice: number;
    }>;
    createdAt: string;
    updatedAt: string;
}

export interface WBCardsResponse {
    cards: WBCard[];
    cursor: {
        updatedAt: string;
        nmID: number;
        total: number;
    };
}

/**
 * Get full card details from WB Content API
 * Returns photos, video, description, characteristics
 */
export async function getCardsList(limit: number = 100, cursor?: { updatedAt?: string; nmID?: number }): Promise<WBCardsResponse> {
    const body: any = {
        settings: {
            cursor: {
                limit,
            },
            filter: {
                withPhoto: -1, // All cards
            },
        },
    };

    if (cursor?.updatedAt && cursor?.nmID) {
        body.settings.cursor.updatedAt = cursor.updatedAt;
        body.settings.cursor.nmID = cursor.nmID;
    }

    const response = await fetch(
        `${CONTENT_API}/content/v2/get/cards/list`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${WB_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        console.error(`Content API Error: ${response.status} - ${error}`);
        throw new Error(`WB Content API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log(`Content API returned ${data.cards?.length || 0} cards`);
    return data;
}

/**
 * Get all cards with pagination
 */
export async function getAllCards(maxCards: number = 1000): Promise<WBCard[]> {
    const allCards: WBCard[] = [];
    let cursor: { updatedAt?: string; nmID?: number } | undefined;

    while (allCards.length < maxCards) {
        const batchSize = Math.min(100, maxCards - allCards.length);
        const response = await getCardsList(batchSize, cursor);

        if (!response.cards || response.cards.length === 0) break;

        allCards.push(...response.cards);

        // Update cursor for next batch
        if (response.cursor && response.cards.length === batchSize) {
            cursor = {
                updatedAt: response.cursor.updatedAt,
                nmID: response.cursor.nmID,
            };
        } else {
            break;
        }
    }

    console.log(`Content API: Fetched total ${allCards.length} cards`);
    return allCards;
}
