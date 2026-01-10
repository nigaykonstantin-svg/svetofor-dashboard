import { NextResponse } from 'next/server';
import { getStocks, getSalesFunnel, getSales } from '@/lib/wb-api';
import { getDRRForPeriod } from '@/lib/advert-api';
import { getSKUByNmId } from '@/lib/sku-matrix';
import { getCategoryConfigs } from '@/lib/optimizer/config-manager';
import { CATEGORY_API_MAP, CATEGORY_REVERSE_MAP } from '@/lib/constants';
import { DEFAULT_THRESHOLDS } from '@/lib/category-thresholds';
import { apiCache, cacheKeys, cacheTTL } from '@/lib/api-cache';

// In-memory cache for DRR data
let drrCache: { data: Map<number, { drr: number; advertSpend: number }>; timestamp: number } | null = null;
const DRR_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function getCachedDRR(days: number): Promise<Map<number, { drr: number; advertSpend: number }>> {
    const now = Date.now();

    // Return cached data if valid
    if (drrCache && (now - drrCache.timestamp) < DRR_CACHE_TTL && drrCache.data.size > 0) {
        console.log(`Using cached DRR data (${drrCache.data.size} SKUs, age: ${Math.round((now - drrCache.timestamp) / 1000)}s)`);
        return drrCache.data;
    }

    // Fetch fresh data with timeout
    try {
        const freshData = await Promise.race([
            getDRRForPeriod(days),
            new Promise<Map<number, { drr: number; advertSpend: number }>>((resolve) =>
                setTimeout(() => resolve(new Map()), 5000) // 5 sec timeout
            ),
        ]);

        if (freshData.size > 0) {
            drrCache = { data: freshData, timestamp: now };
            console.log(`DRR cache updated: ${freshData.size} SKUs`);
        }

        return freshData;
    } catch (error) {
        console.error('DRR fetch error:', error);
        return drrCache?.data || new Map();
    }
}

export async function GET(request: Request) {
    try {
        // Parse period from query params
        const { searchParams } = new URL(request.url);
        const period = parseInt(searchParams.get('period') || '7');
        const validPeriod = Math.min(Math.max(period, 1), 180); // Accept 1-180 days

        // Signal period: minimum 7 days for stable conversion signals
        // Even if UI shows "Yesterday", signals use 7-day averages
        const signalPeriod = Math.max(7, validPeriod);

        const forceRefresh = searchParams.get('refresh') === 'true';

        // Parse skipDRR flag (for pages that don't need advertising data)
        const skipDRR = searchParams.get('skipDRR') === 'true';

        // Check cache first (unless force refresh)
        // Cache key uses signalPeriod since that determines the data we fetch
        const cacheKey = cacheKeys.svetofor(signalPeriod);
        if (!forceRefresh) {
            const cached = apiCache.get<{ success: boolean; data: unknown }>(cacheKey);
            if (cached) {
                console.log(`[Svetofor API] Returning cached data for signalPeriod ${signalPeriod}d`);
                return NextResponse.json({ ...cached, fromCache: true });
            }
        }

        // Parse user thresholds from query params (from localStorage on client)
        let userThresholds: Record<string, any> = {};
        const thresholdsParam = searchParams.get('thresholds');
        if (thresholdsParam) {
            try {
                userThresholds = JSON.parse(thresholdsParam);
                console.log('Using user thresholds from settings');
            } catch (e) {
                console.warn('Failed to parse user thresholds');
            }
        }

        // Calculate date range
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - validPeriod);
        const dateFromStr = dateFrom.toISOString().split('T')[0];

        // Загружаем данные параллельно
        // Note: funnelData uses signalPeriod (min 7 days) for stable conversion signals
        const [stocksRaw, funnelData, salesData, drrData, categoryConfigs] = await Promise.all([
            getStocks(),
            getSalesFunnel(signalPeriod).catch(() => []), // Use signalPeriod for stable conversion metrics
            getSales(dateFromStr).catch(() => []),
            skipDRR ? Promise.resolve(new Map()) : getCachedDRR(signalPeriod),
            getCategoryConfigs(),
        ]);

        console.log(`Loaded: stocks=${stocksRaw.length}, funnel=${funnelData.length} (signalPeriod=${signalPeriod}d), sales=${salesData.length}, drr=${drrData.size} SKUs (requestedPeriod=${validPeriod}d)`);

        // Get thresholds for category - prioritizes user settings from localStorage
        const getThresholdsForCategory = (categoryName: string) => {
            // Get YAML config first to get min_margin_pct
            const key = CATEGORY_API_MAP[categoryName] || categoryName.toLowerCase();
            const config = categoryConfigs[key];
            const minMargin = (config?.min_margin_pct || 0.25) * 100; // Convert to percentage

            // First check user thresholds from settings UI
            if (userThresholds[categoryName]) {
                const ut = userThresholds[categoryName];
                console.log(`[Thresholds] Using user settings for "${categoryName}": CR_CART_LOW=${ut.CR_CART_LOW}`);
                return {
                    ctr_low: ut.CR_CART_LOW || 4,           // "Низкий CR корзина" - for LOW_CTR
                    cr_order_low: ut.CR_CART_LOW || 4,      // SAME field for LOW_CR (was wrong: CR_ORDER_HIGH)
                    cr_order_high: ut.CR_ORDER_HIGH || 10,  // "Топ CR заказ" - for ABOVE_MARKET
                    min_margin_pct: minMargin,              // For UNPROFITABLE_ADS
                };
            }

            // Fallback to YAML config
            console.log(`[Thresholds] Using YAML config for "${categoryName}" (key: ${key})`);
            return {
                ctr_low: config?.ctr_benchmark || 4,      // Default 4%
                cr_order_low: config?.cr_order_low || 4,  // Default 4% for LOW_CR
                cr_order_high: 10,                        // Default 10% for ABOVE_MARKET
                min_margin_pct: minMargin,                // For UNPROFITABLE_ADS (default 25%)
            };
        };

        // Агрегируем остатки по nmId
        const stocksMap = new Map<number, {
            quantity: number;
            inTransit: number;
            price: number;
            category: string;
            sku: string;
            subject: string;
        }>();

        for (const item of stocksRaw) {
            const existing = stocksMap.get(item.nmId);
            if (existing) {
                existing.quantity += item.quantity;
                existing.inTransit += item.inWayToClient + item.inWayFromClient;
            } else {
                stocksMap.set(item.nmId, {
                    quantity: item.quantity,
                    inTransit: item.inWayToClient + item.inWayFromClient,
                    price: item.Price * (1 - item.Discount / 100),
                    category: item.category,
                    sku: item.supplierArticle,
                    subject: item.subject,
                });
            }
        }

        // Создаем funnel map с данными за оба периода
        const funnelMap = new Map<number, any>();
        for (const item of funnelData) {
            const stats = item.statistic?.selected;
            const past = item.statistic?.past;

            if (stats) {
                // Calculate deltas (percentage change)
                const calcDelta = (current: number, previous: number): number | null => {
                    if (!previous || previous === 0) return current > 0 ? 100 : null;
                    return ((current - previous) / previous) * 100;
                };

                funnelMap.set(item.product.nmId, {
                    title: item.product.title,
                    vendorCode: item.product.vendorCode,
                    brandName: item.product.brandName || '',
                    subjectName: item.product.subjectName || '',
                    // Stocks
                    stocksWb: item.stocks?.stocksWb || 0,
                    stocksMp: item.stocks?.stocksMp || 0,
                    // Current period funnel stats
                    openCount: stats.openCount || 0,
                    cartCount: stats.cartCount || 0,
                    orderCount: stats.orderCount || 0,
                    orderSum: stats.orderSum || 0,
                    buyoutCount: stats.buyoutCount || 0,
                    buyoutSum: stats.buyoutSum || 0,
                    // Conversions
                    crCart: stats.conversions?.addToCartPercent || 0,
                    crOrder: stats.conversions?.cartToOrderPercent || 0,
                    buyoutPercent: stats.conversions?.buyoutPercent || 0,
                    // Past period data (for comparison)
                    pastOrderCount: past?.orderCount || 0,
                    pastOrderSum: past?.orderSum || 0,
                    pastOpenCount: past?.openCount || 0,
                    pastCrCart: past?.conversions?.addToCartPercent || 0,
                    pastCrOrder: past?.conversions?.cartToOrderPercent || 0,
                    pastBuyoutPercent: past?.conversions?.buyoutPercent || 0,
                    // Deltas (percentage change)
                    deltaOrderCount: calcDelta(stats.orderCount || 0, past?.orderCount || 0),
                    deltaOrderSum: calcDelta(stats.orderSum || 0, past?.orderSum || 0),
                    deltaOpenCount: calcDelta(stats.openCount || 0, past?.openCount || 0),
                    deltaCrCart: past?.conversions?.addToCartPercent
                        ? ((stats.conversions?.addToCartPercent || 0) - past.conversions.addToCartPercent).toFixed(1)
                        : null,
                    deltaCrOrder: past?.conversions?.cartToOrderPercent
                        ? ((stats.conversions?.cartToOrderPercent || 0) - past.conversions.cartToOrderPercent).toFixed(1)
                        : null,
                });
            }
        }

        // Расчет velocity из ПРОДАЖ (не только воронки)
        const velocityMap = new Map<number, number>();
        const salesCountMap = new Map<number, number>();

        for (const sale of salesData) {
            const current = salesCountMap.get(sale.nmId) || 0;
            salesCountMap.set(sale.nmId, current + 1);
        }

        for (const [nmId, count] of salesCountMap) {
            velocityMap.set(nmId, count / validPeriod); // Use actual period
        }

        console.log(`Velocity calculated for ${velocityMap.size} SKUs`);

        // Анализ и создание сигналов
        const analyses: any[] = [];
        const allNmIds = new Set([...stocksMap.keys(), ...funnelMap.keys()]);

        for (const nmId of allNmIds) {
            const stock = stocksMap.get(nmId);
            const funnel = funnelMap.get(nmId);
            const ordersPerDay = velocityMap.get(nmId) || 0;

            if (!stock && !funnel) continue;

            const stockTotal = stock?.quantity || 0;
            const inTransit = stock?.inTransit || 0;
            const effectiveStock = stockTotal + inTransit;
            const stockCoverDays = ordersPerDay > 0 ? effectiveStock / ordersPerDay : 999;

            const signals: any[] = [];
            const price = stock?.price || 0;

            // OOS сейчас
            if (stockTotal === 0 && ordersPerDay > 0) {
                const lostPerDay = ordersPerDay * price;
                signals.push({
                    type: 'OOS_NOW',
                    priority: 'critical',
                    message: `Товар закончился! Продажи/день: ${ordersPerDay.toFixed(1)}`,
                    impactPerDay: lostPerDay,
                    impactPerWeek: lostPerDay * 7,
                    urgency: 'today',
                    action: { type: 'restock', priority: 'today', details: 'Срочно отгрузить товар на склад WB' },
                });
            }
            // OOS скоро (< STOCK_CRITICAL_DAYS)
            else if (stockCoverDays < DEFAULT_THRESHOLDS.STOCK_CRITICAL_DAYS) {
                const lostPerDay = ordersPerDay * price;
                signals.push({
                    type: 'OOS_SOON',
                    priority: 'critical',
                    message: `Закончится через ${stockCoverDays.toFixed(0)} дней`,
                    impactPerDay: lostPerDay,
                    impactPerWeek: lostPerDay * 7,
                    urgency: 'today',
                    action: { type: 'restock', priority: 'today', details: 'Срочно запланировать отгрузку' },
                });
            }
            // OOS скоро (< STOCK_WARNING_DAYS)
            else if (stockCoverDays < DEFAULT_THRESHOLDS.STOCK_WARNING_DAYS) {
                const lostPerDay = ordersPerDay * price;
                signals.push({
                    type: 'OOS_SOON',
                    priority: 'warning',
                    message: `Запас на ${stockCoverDays.toFixed(0)} дней`,
                    impactPerDay: lostPerDay,
                    impactPerWeek: lostPerDay * 7,
                    urgency: 'this_week',
                    action: { type: 'restock', priority: 'this_week', details: 'Запланировать отгрузку в ближайшие дни' },
                });
            }

            // Overstock
            if (stockCoverDays > DEFAULT_THRESHOLDS.STOCK_OVERSTOCK_DAYS && stockTotal > 0) {
                const frozenCapital = stockTotal * price;
                signals.push({
                    type: 'OVERSTOCK',
                    priority: 'warning',
                    message: `Запас на ${stockCoverDays.toFixed(0)} дней`,
                    impactPerDay: frozenCapital / 90, // стоимость хранения примерно
                    impactPerWeek: (frozenCapital / 90) * 7,
                    urgency: 'this_week',
                    action: { type: 'discount', priority: 'this_week', details: 'Установить скидку для ускорения оборота' },
                });
            }

            // ============ FUNNEL SIGNALS ============
            // Get category for this SKU to use proper thresholds
            const matrixData = getSKUByNmId(nmId);
            const categoryName = matrixData?.categoryWB || stock?.category || '';
            const thresholds = getThresholdsForCategory(categoryName);

            if (funnel && funnel.openCount > 500) {
                // LOW_CTR: много показов, мало добавлений в корзину
                // Using category-specific CTR threshold
                if (funnel.crCart < thresholds.ctr_low) {
                    const potentialOrders = funnel.openCount * (thresholds.ctr_low / 100) - funnel.cartCount;
                    signals.push({
                        type: 'LOW_CTR',
                        priority: 'warning',
                        message: `Низкий CTR: ${funnel.crCart.toFixed(1)}% (порог: ${thresholds.ctr_low}%)`,
                        impactPerDay: (potentialOrders * price * 0.25) / signalPeriod,
                        impactPerWeek: potentialOrders * price * 0.25 / signalPeriod * 7,
                        urgency: 'this_week',
                        action: { type: 'update_content', priority: 'this_week', details: 'Обновить главное фото и заголовок' },
                    });
                }

                // LOW_CR: добавляют в корзину, но не заказывают
                // Using category-specific CR threshold
                if (funnel.crOrder < thresholds.cr_order_low && funnel.cartCount > 50) {
                    const potentialOrders = funnel.cartCount * (thresholds.cr_order_low / 100) - funnel.orderCount;
                    signals.push({
                        type: 'LOW_CR',
                        priority: 'warning',
                        message: `Низкий CR заказ: ${funnel.crOrder.toFixed(0)}% (порог: ${thresholds.cr_order_low}%)`,
                        impactPerDay: (potentialOrders * price) / signalPeriod,
                        impactPerWeek: potentialOrders * price / signalPeriod * 7,
                        urgency: 'this_week',
                        action: { type: 'optimize_price', priority: 'this_week', details: 'Проверить цену и описание товара' },
                    });
                }

                // LOW_BUYOUT: заказывают, но не выкупают
                if (funnel.buyoutPercent < DEFAULT_THRESHOLDS.BUYOUT_LOW && funnel.orderCount > 20) {
                    const lostBuyout = funnel.orderSum * (DEFAULT_THRESHOLDS.BUYOUT_LOW / 100 - funnel.buyoutPercent / 100);
                    signals.push({
                        type: 'LOW_BUYOUT',
                        priority: 'warning',
                        message: `Низкий выкуп: ${funnel.buyoutPercent.toFixed(0)}%`,
                        impactPerDay: lostBuyout / signalPeriod,
                        impactPerWeek: lostBuyout / signalPeriod * 7,
                        urgency: 'this_week',
                        action: { type: 'update_content', priority: 'this_week', details: 'Улучшить описание, добавить отзывы' },
                    });
                }

                // HIGH_PERFORMER: отличные метрики
                if (funnel.crCart >= 10 && funnel.crOrder >= 50) {
                    signals.push({
                        type: 'ABOVE_MARKET',
                        priority: 'success',
                        message: `🔥 Топ: CTR ${funnel.crCart.toFixed(0)}%, CR ${funnel.crOrder.toFixed(0)}%`,
                        impactPerDay: funnel.orderSum / signalPeriod,
                        impactPerWeek: funnel.orderSum / signalPeriod * 7,
                        urgency: 'this_month',
                        action: { type: 'optimize_price', priority: 'this_week', details: 'Можно поднять цену на 5-10%' },
                    });
                }
            }

            // ============ DRR SIGNALS ============
            const skuDrr = drrData.get(nmId);
            let drr: number | undefined;
            let advertSpend: number | undefined;

            if (skuDrr && skuDrr.drr > 0) {
                drr = skuDrr.drr;
                advertSpend = skuDrr.advertSpend;
                const drrValue = skuDrr.drr;

                // UNPROFITABLE_ADS: DRR > margin (most critical)
                if (drrValue > thresholds.min_margin_pct) {
                    signals.push({
                        type: 'UNPROFITABLE_ADS',
                        priority: 'critical',
                        message: `💸 Убыточная реклама: ДРР ${drrValue.toFixed(0)}% > маржа ${thresholds.min_margin_pct.toFixed(0)}%`,
                        impactPerDay: advertSpend ? advertSpend / signalPeriod : 0,
                        impactPerWeek: advertSpend ? (advertSpend / signalPeriod) * 7 : 0,
                        urgency: 'today',
                        action: { type: 'pause_ads', priority: 'today', details: 'Остановить рекламу — она убыточна!' },
                    });
                } else if (drrValue >= DEFAULT_THRESHOLDS.DRR_CRITICAL) {
                    signals.push({
                        type: 'HIGH_DRR',
                        priority: 'critical',
                        message: `Критичный ДРР: ${drrValue.toFixed(0)}% — убыточная реклама!`,
                        impactPerDay: advertSpend ? advertSpend / 30 : 0,
                        impactPerWeek: advertSpend ? (advertSpend / 30) * 7 : 0,
                        urgency: 'today',
                        action: { type: 'pause_ads', priority: 'today', details: 'Остановить рекламу или снизить ставки' },
                    });
                } else if (drrValue >= DEFAULT_THRESHOLDS.DRR_HIGH) {
                    signals.push({
                        type: 'HIGH_DRR',
                        priority: 'warning',
                        message: `Высокий ДРР: ${drrValue.toFixed(0)}% — оптимизировать рекламу`,
                        impactPerDay: advertSpend ? advertSpend / 30 : 0,
                        impactPerWeek: advertSpend ? (advertSpend / 30) * 7 : 0,
                        urgency: 'this_week',
                        action: { type: 'pause_ads', priority: 'this_week', details: 'Оптимизировать рекламные кампании' },
                    });
                }
            }

            // ============ FALLING_SALES SIGNAL ============
            if (funnel?.deltaOrderSum !== null && funnel?.deltaOrderSum !== undefined) {
                const salesDrop = funnel.deltaOrderSum;
                if (salesDrop < -DEFAULT_THRESHOLDS.SALES_DROP_CRITICAL) {
                    const lostRevenue = Math.abs((funnel.pastOrderSum || 0) - (funnel.orderSum || 0));
                    signals.push({
                        type: 'FALLING_SALES',
                        priority: 'critical',
                        message: `📉 Критичное падение: ${salesDrop.toFixed(0)}% vs прошлый период`,
                        impactPerDay: lostRevenue / signalPeriod,
                        impactPerWeek: (lostRevenue / signalPeriod) * 7,
                        urgency: 'today',
                        action: { type: 'review_sku', priority: 'today', details: 'Срочно проанализировать причины падения' },
                    });
                } else if (salesDrop < -DEFAULT_THRESHOLDS.SALES_DROP) {
                    const lostRevenue = Math.abs((funnel.pastOrderSum || 0) - (funnel.orderSum || 0));
                    signals.push({
                        type: 'FALLING_SALES',
                        priority: 'warning',
                        message: `📉 Падение продаж: ${salesDrop.toFixed(0)}% vs прошлый период`,
                        impactPerDay: lostRevenue / signalPeriod,
                        impactPerWeek: (lostRevenue / signalPeriod) * 7,
                        urgency: 'this_week',
                        action: { type: 'review_sku', priority: 'this_week', details: 'Проанализировать причины падения продаж' },
                    });
                }
            }


            // matrixData already defined above for thresholds

            analyses.push({
                sku: stock?.sku || funnel?.vendorCode || matrixData?.sku || String(nmId),
                nmId,
                title: funnel?.title || stock?.subject || 'Неизвестный товар',
                category: matrixData?.categoryWB || stock?.category || 'Unknown',
                subCategory: matrixData?.subCategoryWB || '',
                brandName: funnel?.brandName || '',
                subjectName: funnel?.subjectName || '',
                // Manager info from matrix
                brandManager: matrixData?.brandManager || '',
                categoryManager: matrixData?.categoryManager || '',
                // Stock metrics
                stockTotal,
                inTransit,
                effectiveStock,
                stocksWb: funnel?.stocksWb || 0,
                stocksMp: funnel?.stocksMp || 0,
                // Velocity
                ordersPerDay: ordersPerDay.toFixed(1),
                stockCoverDays: stockCoverDays.toFixed(0),
                // Funnel metrics
                openCount: funnel?.openCount || 0,
                cartCount: funnel?.cartCount || 0,
                orderCount: funnel?.orderCount || 0,
                buyoutCount: funnel?.buyoutCount || 0,
                buyoutSum: funnel?.buyoutSum || 0,
                // Conversions
                crCart: funnel?.crCart?.toFixed(1),
                crOrder: funnel?.crOrder?.toFixed(1),
                buyoutPercent: funnel?.buyoutPercent?.toFixed(0),
                orderSum: funnel?.orderSum || 0,
                // Advert metrics
                drr: drr?.toFixed(1),
                advertSpend: advertSpend?.toFixed(0),
                signals,
                // Comparison data (past period)
                pastOrderCount: funnel?.pastOrderCount || 0,
                pastOrderSum: funnel?.pastOrderSum || 0,
                pastOpenCount: funnel?.pastOpenCount || 0,
                pastCrCart: funnel?.pastCrCart || 0,
                pastCrOrder: funnel?.pastCrOrder || 0,
                // Deltas (percentage changes)
                deltaOrderCount: funnel?.deltaOrderCount,
                deltaOrderSum: funnel?.deltaOrderSum,
                deltaOpenCount: funnel?.deltaOpenCount,
                deltaCrCart: funnel?.deltaCrCart,
                deltaCrOrder: funnel?.deltaCrOrder,
            });
        }

        // Группировка по кластерам
        const clusters = {
            OOS_NOW: analyses.filter(a => a.signals.some((s: any) => s.type === 'OOS_NOW')),
            OOS_SOON: analyses.filter(a => a.signals.some((s: any) => s.type === 'OOS_SOON')),
            UNPROFITABLE_ADS: analyses.filter(a => a.signals.some((s: any) => s.type === 'UNPROFITABLE_ADS')),
            HIGH_DRR: analyses.filter(a => a.signals.some((s: any) => s.type === 'HIGH_DRR')),
            FALLING_SALES: analyses.filter(a => a.signals.some((s: any) => s.type === 'FALLING_SALES')),
            LOW_CTR: analyses.filter(a => a.signals.some((s: any) => s.type === 'LOW_CTR')),
            LOW_CR: analyses.filter(a => a.signals.some((s: any) => s.type === 'LOW_CR')),
            LOW_BUYOUT: analyses.filter(a => a.signals.some((s: any) => s.type === 'LOW_BUYOUT')),
            OVERSTOCK: analyses.filter(a => a.signals.some((s: any) => s.type === 'OVERSTOCK')),
            ABOVE_MARKET: analyses.filter(a => a.signals.some((s: any) => s.type === 'ABOVE_MARKET')),
        };

        // ============ COMBO SIGNALS DETECTION ============
        const comboSignals: any[] = [];

        // TOXIC_SKU: LOW_CR + HIGH_DRR + FALLING_SALES — убыточный товар 
        const toxicSkus = analyses.filter(a => {
            const types = new Set(a.signals.map((s: any) => s.type));
            return (types.has('LOW_CR') || types.has('LOW_CTR')) &&
                types.has('HIGH_DRR') &&
                types.has('FALLING_SALES');
        });
        if (toxicSkus.length > 0) {
            comboSignals.push({
                type: 'TOXIC_SKU',
                label: '☠️ Токсичные товары',
                priority: 'critical',
                count: toxicSkus.length,
                message: 'Низкая конверсия + убыточная реклама + падение продаж',
                skus: toxicSkus.map(s => ({ nmId: s.nmId, sku: s.sku, title: s.title })),
            });
        }

        // HERO_AT_RISK: ABOVE_MARKET + OOS_SOON — топ товар заканчивается
        const heroAtRiskSkus = analyses.filter(a => {
            const types = new Set(a.signals.map((s: any) => s.type));
            return types.has('ABOVE_MARKET') && (types.has('OOS_SOON') || types.has('OOS_NOW'));
        });
        if (heroAtRiskSkus.length > 0) {
            comboSignals.push({
                type: 'HERO_AT_RISK',
                label: '🏆⚠️ Топы под угрозой',
                priority: 'critical',
                count: heroAtRiskSkus.length,
                message: 'Топ-товары скоро закончатся! Срочно пополнить',
                skus: heroAtRiskSkus.map(s => ({ nmId: s.nmId, sku: s.sku, title: s.title })),
            });
        }

        // FROZEN_CAPITAL: OVERSTOCK + LOW_CR — заморозка денег
        const frozenCapitalSkus = analyses.filter(a => {
            const types = new Set(a.signals.map((s: any) => s.type));
            return types.has('OVERSTOCK') && (types.has('LOW_CR') || types.has('LOW_CTR'));
        });
        if (frozenCapitalSkus.length > 0) {
            comboSignals.push({
                type: 'FROZEN_CAPITAL',
                label: '🧊 Заморозка капитала',
                priority: 'warning',
                count: frozenCapitalSkus.length,
                message: 'Много остатков + низкая конверсия = деньги заморожены',
                skus: frozenCapitalSkus.map(s => ({ nmId: s.nmId, sku: s.sku, title: s.title })),
            });
        }

        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            totalSKUs: analyses.length,
            funnelSKUs: analyses.filter(a => a.crCart !== undefined).length,
            clusters: {
                OOS_NOW: clusters.OOS_NOW.length,
                OOS_SOON: clusters.OOS_SOON.length,
                UNPROFITABLE_ADS: clusters.UNPROFITABLE_ADS.length,
                HIGH_DRR: clusters.HIGH_DRR.length,
                FALLING_SALES: clusters.FALLING_SALES.length,
                LOW_CTR: clusters.LOW_CTR.length,
                LOW_CR: clusters.LOW_CR.length,
                LOW_BUYOUT: clusters.LOW_BUYOUT.length,
                OVERSTOCK: clusters.OVERSTOCK.length,
                ABOVE_MARKET: clusters.ABOVE_MARKET.length,
            },
            comboSignals,
            data: clusters,
        };

        // Save to cache (5 minute TTL)
        apiCache.set(cacheKey, response, cacheTTL.MEDIUM);
        console.log(`[Svetofor API] Cached response for period ${validPeriod}d`);

        return NextResponse.json(response);

    } catch (error) {
        console.error('Svetofor API Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
