import { NextRequest, NextResponse } from 'next/server';

interface ChatRequest {
    message: string;
    context: {
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
            OOS_NOW: any[];
            OOS_SOON: any[];
            HIGH_DRR: any[];
            LOW_CTR: any[];
            LOW_CR: any[];
            LOW_BUYOUT: any[];
            OVERSTOCK: any[];
            ABOVE_MARKET: any[];
        };
        history: { role: 'user' | 'assistant'; content: string }[];
    };
}

function buildPrompt(data: ChatRequest): string {
    const { message, context } = data;
    const { category, period, kpis, clusters, history } = context;

    // Summarize cluster data
    const clusterSummary = {
        oosNow: clusters?.OOS_NOW?.length || 0,
        oosSoon: clusters?.OOS_SOON?.length || 0,
        highDrr: clusters?.HIGH_DRR?.length || 0,
        lowCtr: clusters?.LOW_CTR?.length || 0,
        lowCr: clusters?.LOW_CR?.length || 0,
        lowBuyout: clusters?.LOW_BUYOUT?.length || 0,
        overstock: clusters?.OVERSTOCK?.length || 0,
        topPerformers: clusters?.ABOVE_MARKET?.length || 0,
    };

    // Get top SKUs for context
    const getTopSKUs = (items: any[], limit = 3) =>
        items?.slice(0, limit).map(s =>
            `${s.sku}: ${s.title?.slice(0, 30)}...`
        ).join(', ') || 'нет';

    // Build conversation history
    const historyText = history?.length > 0
        ? '\n\nИстория диалога:\n' + history.map(m => `${m.role === 'user' ? 'Пользователь' : 'AI'}: ${m.content}`).join('\n')
        : '';

    return `Ты AI-ассистент для управления товарами MIXIT на Wildberries. Отвечай на вопросы пользователя, используя данные ниже.

КОНТЕКСТ:
- Категория: ${category === 'Все' ? 'Все категории' : category}
- Период: ${period} дней
- Всего SKU: ${kpis?.skuCount || 0}

KPI:
- Выручка: ${kpis?.totalOrderSum?.toLocaleString('ru-RU') || 0} ₽
- Заказов: ${kpis?.totalOrders?.toLocaleString('ru-RU') || 0}
- Средний чек: ${kpis?.avgCheck?.toFixed(0) || 0} ₽
- Средний ДРР: ${kpis?.avgDRR?.toFixed(1) || 0}%

ПРОБЛЕМНЫЕ SKU:
🚨 OOS сейчас: ${clusterSummary.oosNow} (${getTopSKUs(clusters?.OOS_NOW)})
⚠️ Скоро OOS: ${clusterSummary.oosSoon} (${getTopSKUs(clusters?.OOS_SOON)})
💸 Высокий ДРР: ${clusterSummary.highDrr}
👁️ Низкий CTR: ${clusterSummary.lowCtr}
🛒 Низкий CR: ${clusterSummary.lowCr}
📦 Затоварка: ${clusterSummary.overstock}
🏆 Топ-перформеры: ${clusterSummary.topPerformers}
${historyText}

ВОПРОС ПОЛЬЗОВАТЕЛЯ: ${message}

ИНСТРУКЦИИ:
- Отвечай конкретно, ссылаясь на реальные данные
- Если вопрос про конкретные SKU — упоминай артикулы
- Давай actionable рекомендации
- Формат: markdown, кратко
- Не повторяй вопрос пользователя в ответе`;
}

export async function POST(request: NextRequest) {
    try {
        const data: ChatRequest = await request.json();

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: 'ANTHROPIC_API_KEY не настроен' },
                { status: 500 }
            );
        }

        const prompt = buildPrompt(data);

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1500,
                messages: [{ role: 'user', content: prompt }],
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Claude API error:', response.status, errorData);
            return NextResponse.json(
                { success: false, error: errorData?.error?.message || `API error: ${response.status}` },
                { status: response.status }
            );
        }

        const result = await response.json();
        const text = result.content?.[0]?.text || '';

        return NextResponse.json({
            success: true,
            response: text,
        });

    } catch (error) {
        console.error('AI Chat Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
