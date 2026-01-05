import { NextRequest, NextResponse } from 'next/server';

interface SKUData {
    sku: string;
    nmId: number;
    title: string;
    category: string;
    stockTotal: number;
    ordersPerDay: string;
    stockCoverDays: string;
    crCart?: string;
    crOrder?: string;
    drr?: string;
    orderSum: number;
    signals: { type: string; priority: string; message: string }[];
}

interface AnalysisRequest {
    category: string;
    period: number;
    kpis: {
        totalOrderSum: number;
        totalOrders: number;
        avgCheck: number;
        avgDRR: number;
        skuCount: number;
    };
    clusters: {
        OOS_NOW: SKUData[];
        OOS_SOON: SKUData[];
        HIGH_DRR: SKUData[];
        LOW_CTR: SKUData[];
        LOW_CR: SKUData[];
        LOW_BUYOUT: SKUData[];
        OVERSTOCK: SKUData[];
        ABOVE_MARKET: SKUData[];
    };
}

function buildPrompt(data: AnalysisRequest): string {
    const { category, period, kpis, clusters } = data;

    // Summarize cluster data
    const clusterSummary = {
        oosNow: clusters.OOS_NOW?.length || 0,
        oosSoon: clusters.OOS_SOON?.length || 0,
        highDrr: clusters.HIGH_DRR?.length || 0,
        lowCtr: clusters.LOW_CTR?.length || 0,
        lowCr: clusters.LOW_CR?.length || 0,
        lowBuyout: clusters.LOW_BUYOUT?.length || 0,
        overstock: clusters.OVERSTOCK?.length || 0,
        topPerformers: clusters.ABOVE_MARKET?.length || 0,
    };

    // Get top problematic SKUs for each cluster
    const getTopSKUs = (items: SKUData[], limit = 5) =>
        items.slice(0, limit).map(s =>
            `- ${s.sku}: ${s.title.slice(0, 40)}... (${s.signals[0]?.message || 'N/A'})`
        ).join('\n');

    const topOOS = getTopSKUs(clusters.OOS_NOW || []);
    const topHighDRR = getTopSKUs(clusters.HIGH_DRR || []);
    const topLowCTR = getTopSKUs(clusters.LOW_CTR || []);
    const topPerformers = getTopSKUs(clusters.ABOVE_MARKET || []);

    return `Ты опытный категорийный менеджер MIXIT на Wildberries. Проанализируй данные продаж и дай тактические рекомендации.

КОНТЕКСТ АНАЛИЗА:
- Категория: ${category === 'Все' ? 'Все категории' : category}
- Период: последние ${period} дней
- Всего SKU: ${kpis.skuCount}

KPI КАТЕГОРИИ:
- Общая выручка: ${kpis.totalOrderSum.toLocaleString('ru-RU')} ₽
- Количество заказов: ${kpis.totalOrders.toLocaleString('ru-RU')}
- Средний чек: ${kpis.avgCheck.toFixed(0)} ₽
- Средний ДРР: ${kpis.avgDRR.toFixed(1)}%

СИГНАЛЫ ПО КЛАСТЕРАМ:
🚨 OOS сейчас: ${clusterSummary.oosNow} SKU
⚠️ Скоро OOS: ${clusterSummary.oosSoon} SKU
💸 Высокий ДРР (>30%): ${clusterSummary.highDrr} SKU
👁️ Низкий CTR: ${clusterSummary.lowCtr} SKU
🛒 Низкий CR: ${clusterSummary.lowCr} SKU
📦 Низкий выкуп: ${clusterSummary.lowBuyout} SKU
📦 Затоварка: ${clusterSummary.overstock} SKU
🏆 Топ-перформеры: ${clusterSummary.topPerformers} SKU

${topOOS ? `\nТОП-5 OOS:\n${topOOS}` : ''}
${topHighDRR ? `\nТОП-5 ВЫСОКИЙ ДРР:\n${topHighDRR}` : ''}
${topLowCTR ? `\nТОП-5 НИЗКИЙ CTR:\n${topLowCTR}` : ''}
${topPerformers ? `\nТОП-5 ЛИДЕРОВ:\n${topPerformers}` : ''}

ЗАДАЧА:
Проанализируй данные и найди паттерны. Дай конкретные рекомендации.

ФОРМАТ ОТВЕТА (строго markdown):
## 📊 Сводка категории
Краткий обзор состояния категории за ${period} дней.

## 🔴 Критические проблемы
Топ-3 самых срочных проблемы, требующих немедленного внимания.

## 📈 Обнаруженные паттерны
Какие закономерности видны в данных? Связь между показателями?

## 💡 Рекомендации по приоритетам
Что делать в первую очередь? Конкретные действия.

## ✅ Быстрые победы (Quick Wins)
Что можно сделать прямо сейчас с минимальными усилиями?`;
}

export async function POST(request: NextRequest) {
    try {
        const data: AnalysisRequest = await request.json();

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'ANTHROPIC_API_KEY не настроен. Добавьте ключ в .env.local'
                },
                { status: 500 }
            );
        }

        const prompt = buildPrompt(data);

        // Call Claude API (Opus)
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Claude API error:', response.status, errorData);

            const errorMessage = errorData?.error?.message || `API error: ${response.status}`;
            return NextResponse.json(
                {
                    success: false,
                    error: errorMessage,
                    hint: response.status === 401
                        ? 'Проверьте API ключ Anthropic'
                        : undefined
                },
                { status: response.status }
            );
        }

        const result = await response.json();
        const text = result.content?.[0]?.text || '';

        return NextResponse.json({
            success: true,
            analysis: text,
            context: {
                category: data.category,
                period: data.period,
                skuCount: data.kpis.skuCount,
            },
        });

    } catch (error) {
        console.error('AI Analysis Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
