import { NextRequest, NextResponse } from 'next/server';

interface SKUAnalysisRequest {
    sku: {
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
        views?: number;
        cartCount?: number;
        orderCount?: number;
        buyoutPercent?: string;
    };
    question?: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
}

function buildPrompt(data: SKUAnalysisRequest): string {
    const { sku, question, history } = data;

    const signals = sku.signals?.map(s => `${s.type}: ${s.message}`).join('\n') || 'нет сигналов';

    const historyText = history?.length
        ? '\n\nИстория диалога:\n' + history.map(m => `${m.role === 'user' ? 'Вопрос' : 'Ответ'}: ${m.content}`).join('\n')
        : '';

    if (question) {
        // Answer a specific question about the SKU
        return `Ты эксперт по управлению товарами на Wildberries.
Ответь на вопрос про конкретный SKU.

SKU: ${sku.sku} (${sku.nmId})
Название: ${sku.title}
Категория: ${sku.category}

Метрики:
- Остаток: ${sku.stockTotal} шт
- Дней покрытия: ${sku.stockCoverDays}
- Продаж/день: ${sku.ordersPerDay}
- CTR: ${sku.crCart || 'н/д'}%
- CR: ${sku.crOrder || 'н/д'}%
- Выкуп: ${sku.buyoutPercent || 'н/д'}%
- ДРР: ${sku.drr || 'н/д'}%
- Выручка: ${sku.orderSum?.toLocaleString('ru-RU') || 0} ₽

Сигналы:
${signals}
${historyText}

ВОПРОС: ${question}

Ответь кратко и конкретно (2-4 предложения), ссылаясь на данные SKU.`;
    }

    // Initial analysis
    return `Ты эксперт по управлению товарами MIXIT на Wildberries.
Проанализируй SKU и дай диагностику.

SKU: ${sku.sku} (${sku.nmId})
Название: ${sku.title}
Категория: ${sku.category}

Метрики:
- Остаток: ${sku.stockTotal} шт
- Дней покрытия: ${sku.stockCoverDays}
- Продаж/день: ${sku.ordersPerDay}
- CTR: ${sku.crCart || 'н/д'}%
- CR: ${sku.crOrder || 'н/д'}%
- Выкуп: ${sku.buyoutPercent || 'н/д'}%
- ДРР: ${sku.drr || 'н/д'}%
- Выручка: ${sku.orderSum?.toLocaleString('ru-RU') || 0} ₽

Текущие сигналы:
${signals}

ЗАДАЧА:
Напиши краткую диагностику (3-5 пунктов):
1. Главная проблема (если есть)
2. Что делать в первую очередь
3. Потенциал для роста

Формат: markdown, без длинных введений.`;
}

export async function POST(request: NextRequest) {
    try {
        const data: SKUAnalysisRequest = await request.json();

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
                max_tokens: 600,
                messages: [{ role: 'user', content: prompt }],
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return NextResponse.json(
                { success: false, error: errorData?.error?.message || `API error: ${response.status}` },
                { status: response.status }
            );
        }

        const result = await response.json();
        const text = result.content?.[0]?.text || '';

        return NextResponse.json({
            success: true,
            analysis: data.question ? undefined : text,
            answer: data.question ? text : undefined,
        });

    } catch (error) {
        console.error('AI SKU Analysis Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
