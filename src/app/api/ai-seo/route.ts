import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSalesFunnel } from '@/lib/wb-api';
import fs from 'fs';
import path from 'path';

const anthropic = new Anthropic();

interface SKUAnalysisRequest {
    phrase: string;
    skuBreakdown: Array<{
        sku: string;
        position: number;
        clicks: number;
        cartAdds: number;
        orders: number;
        crCart: number;
        crOrder: number;
    }>;
}

export async function POST(request: Request) {
    try {
        const { phrase, skuBreakdown, mode = 'phrase' }: SKUAnalysisRequest & { mode?: string } = await request.json();

        if (!phrase) {
            return NextResponse.json({ success: false, error: 'Phrase is required' }, { status: 400 });
        }

        // Load keywords data for context
        const keywordsPath = path.join(process.cwd(), 'src/data/seo-keywords.json');
        let keywordsData = null;
        if (fs.existsSync(keywordsPath)) {
            keywordsData = JSON.parse(fs.readFileSync(keywordsPath, 'utf-8'));
        }

        // Try to get recent sales data for the SKUs
        let salesContext = '';
        try {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const dateFrom = yesterday.toISOString().split('T')[0];
            const dateTo = today.toISOString().split('T')[0];

            const funnelData = await getSalesFunnel(dateFrom, dateTo);

            if (funnelData && funnelData.length > 0) {
                // Map sales to SKUs in the breakdown
                const skuSales: Record<string, { orders: number; revenue: number }> = {};
                for (const item of funnelData) {
                    const sku = item.product?.vendorCode || String(item.nmId);
                    if (!skuSales[sku]) {
                        skuSales[sku] = { orders: 0, revenue: 0 };
                    }
                    skuSales[sku].orders += item.ordersCount || 0;
                    skuSales[sku].revenue += item.ordersSumRub || 0;
                }

                // Build sales context for relevant SKUs
                const relevantSales = skuBreakdown
                    .filter(s => skuSales[s.sku])
                    .map(s => ({
                        sku: s.sku,
                        position: s.position,
                        keywordOrders: s.orders,
                        todayOrders: skuSales[s.sku]?.orders || 0,
                        todayRevenue: skuSales[s.sku]?.revenue || 0
                    }));

                if (relevantSales.length > 0) {
                    salesContext = `
АКТУАЛЬНЫЕ ПРОДАЖИ (за вчера-сегодня):
${relevantSales.map(s => `- ${s.sku}: ${s.todayOrders} заказов, ${s.todayRevenue.toLocaleString()}₽ выручка, позиция ${s.position}`).join('\n')}
`;
                }
            }
        } catch (error) {
            console.log('[AI SEO] Could not fetch sales data:', error);
        }

        // Build prompt for Claude
        const prompt = `Ты SEO-аналитик маркетплейса Wildberries. Проанализируй данные по ключевому запросу и дай рекомендации.

КЛЮЧЕВОЙ ЗАПРОС: "${phrase}"

ДАННЫЕ ПО SKU (топ товары по этому запросу):
${skuBreakdown.slice(0, 15).map((s, i) =>
            `${i + 1}. ${s.sku} — Позиция: ${s.position}, Клики: ${s.clicks}, Корзина: ${s.cartAdds} (${s.crCart}%), Заказы: ${s.orders} (${s.crOrder}%)`
        ).join('\n')}
${salesContext}

ЗАДАЧА:
1. Проанализируй конверсию каждого SKU (CR в корзину и CR в заказ)
2. Выяви лидеров и аутсайдеров
3. Найди товары с высокой конверсией но низкой позицией (упущенные возможности)
4. Найди товары с низкой конверсией на высоких позициях (проблемные)
5. Дай 3-5 конкретных рекомендаций для увеличения продаж по этому запросу

Формат ответа:
## 📊 Анализ запроса "${phrase}"

### 🏆 Лидеры
[товары с лучшей конверсией]

### ⚠️ Проблемные
[товары с плохой конверсией на хороших позициях]

### 💡 Упущенные возможности
[товары с хорошей конверсией но плохой позицией]

### 🎯 Рекомендации
1. [конкретное действие]
2. [конкретное действие]
...`;

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1500,
            messages: [
                { role: 'user', content: prompt }
            ]
        });

        const analysis = message.content[0].type === 'text' ? message.content[0].text : '';

        return NextResponse.json({
            success: true,
            analysis,
            hasSalesData: salesContext.length > 0
        });

    } catch (error) {
        console.error('[AI SEO] Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
