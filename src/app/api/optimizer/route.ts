// Optimizer API Route — Returns price recommendations for all SKUs
// Integrates with the existing Svetofor dashboard

import { NextResponse } from 'next/server';
import { getStocks, getSalesFunnel, getSales } from '@/lib/wb-api';
import { getDRRForPeriod } from '@/lib/advert-api';
import {
    runOptimizerBatch,
    groupByMode,
    getActionStats,
    getTopPriorityItems,
} from '@/lib/optimizer';
import type { SKUData } from '@/lib/optimizer/types';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const period = parseInt(searchParams.get('period') || '7');
        const validPeriod = [7, 14, 30].includes(period) ? period : 7;

        // Calculate date range
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - validPeriod);
        const dateFromStr = dateFrom.toISOString().split('T')[0];

        // Load data in parallel
        const [stocksRaw, funnelData, salesData, drrData] = await Promise.all([
            getStocks(),
            getSalesFunnel(validPeriod).catch(() => []),
            getSales(dateFromStr).catch(() => []),
            getDRRForPeriod(validPeriod).catch(() => new Map()),
        ]);

        console.log(`[Optimizer] Loaded: stocks=${stocksRaw.length}, funnel=${funnelData.length}, sales=${salesData.length}`);

        // Aggregate stocks by nmId
        const stocksMap = new Map<number, {
            quantity: number;
            inTransit: number;
            price: number;
            category: string;
            sku: string;
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
                    category: item.category || 'Unknown',
                    sku: item.supplierArticle,
                });
            }
        }

        // Create funnel map
        const funnelMap = new Map<number, any>();
        for (const item of funnelData) {
            const stats = item.statistic?.selected;
            if (stats) {
                funnelMap.set(item.product.nmId, {
                    title: item.product.title,
                    vendorCode: item.product.vendorCode,
                    openCount: stats.openCount || 0,
                    cartCount: stats.cartCount || 0,
                    orderCount: stats.orderCount || 0,
                    orderSum: stats.orderSum || 0,
                    buyoutCount: stats.buyoutCount || 0,
                    crCart: stats.conversions?.addToCartPercent || 0,
                    crOrder: stats.conversions?.cartToOrderPercent || 0,
                    buyoutPercent: stats.conversions?.buyoutPercent || 0,
                });
            }
        }

        // Calculate velocity from sales
        const salesCountMap = new Map<number, number>();
        for (const sale of salesData) {
            const current = salesCountMap.get(sale.nmId) || 0;
            salesCountMap.set(sale.nmId, current + 1);
        }

        // Build SKUData objects for optimizer
        const skuDataList: SKUData[] = [];
        const allNmIds = new Set([...stocksMap.keys(), ...funnelMap.keys()]);

        for (const nmId of allNmIds) {
            const stock = stocksMap.get(nmId);
            const funnel = funnelMap.get(nmId);
            const salesCount = salesCountMap.get(nmId) || 0;
            const drr = drrData.get(nmId);

            if (!stock && !funnel) continue;

            const stockTotal = stock?.quantity || 0;
            const inTransit = stock?.inTransit || 0;
            const effectiveStock = stockTotal + inTransit;
            const ordersPerDay = salesCount / validPeriod;
            const stockCoverDays = ordersPerDay > 0 ? effectiveStock / ordersPerDay : 999;

            // Calculate funnel metrics
            const impressions = funnel?.openCount || 0;
            const clicks = funnel?.cartCount || 0; // Using cartCount as proxy for engaged clicks
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            const cartAdds = funnel?.cartCount || 0;
            const orders = funnel?.orderCount || 0;
            const crCart = funnel?.crCart || 0;
            const crOrder = funnel?.crOrder || 0;

            const skuData: SKUData = {
                sku: stock?.sku || funnel?.vendorCode || String(nmId),
                nmId,
                title: funnel?.title || 'Unknown',
                category: stock?.category || 'Unknown',

                // Stock
                stockTotal,
                inTransit,
                effectiveStock,

                // Velocity
                ordersPerDay,
                ordersLast7d: salesCount,
                ordersLast14d: salesCount, // TODO: calculate actual 14d
                stockCoverDays,

                // Price
                currentPrice: stock?.price || 0,

                // Funnel
                impressions,
                clicks,
                ctr,
                cartAdds,
                orders,
                crCart,
                crOrder,
                buyoutPercent: funnel?.buyoutPercent || 0,

                // Ads
                adSpend: drr?.advertSpend || 0,
                adOrders: 0, // TODO: get from advert API
                drr: drr?.drr,
            };

            skuDataList.push(skuData);
        }

        console.log(`[Optimizer] Processing ${skuDataList.length} SKUs`);

        // Run optimizer on all SKUs
        const results = await runOptimizerBatch(skuDataList);

        // Group and analyze results
        const byMode = groupByMode(results);
        const stats = getActionStats(results);
        const topPriority = getTopPriorityItems(results, 20);

        // Format response
        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            period: validPeriod,
            stats: {
                total: stats.total,
                actions: {
                    up: stats.up,
                    down: stats.down,
                    hold: stats.hold,
                },
                blocked: stats.blocked,
            },
            byMode: {
                STOP: byMode.STOP.length,
                CLEAR: byMode.CLEAR.length,
                COW: byMode.COW.length,
                GROWTH: byMode.GROWTH.length,
            },
            topPriority: topPriority.map(r => ({
                sku: r.sku,
                nmId: r.nmId,
                mode: r.mode.mode,
                action: r.decision.action,
                delta: r.decision.delta_pct,
                confidence: r.decision.confidence,
                summary: r.summary,
                urgency: r.urgency,
                reason: r.decision.reason_chain.slice(-2),
            })),
            // Full results for detailed view
            results: results.map(r => ({
                sku: r.sku,
                nmId: r.nmId,
                mode: {
                    type: r.mode.mode,
                    reason: r.mode.reason,
                },
                diagnoses: r.diagnoses.map(d => ({
                    block: d.block,
                    code: d.code,
                    action: d.action_hint,
                    reason: d.reason,
                })),
                recommendation: {
                    action: r.decision.action,
                    delta: r.decision.delta_pct,
                    trigger: r.priceRecommendation.trigger,
                },
                guards: r.guards.filter(g => g.blocked).map(g => ({
                    type: g.guard,
                    reason: g.reason,
                })),
                decision: {
                    action: r.decision.action,
                    delta: r.decision.delta_pct,
                    confidence: r.decision.confidence,
                    level: r.decision.priority_level,
                    blocked: r.decision.blocked_by,
                    chain: r.decision.reason_chain,
                },
                summary: r.summary,
                urgency: r.urgency,
            })),
        });

    } catch (error) {
        console.error('[Optimizer] Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
