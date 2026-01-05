import { NextRequest, NextResponse } from 'next/server';

interface TaskSuggestionRequest {
    actionType: string;
    taskType: string;
    skus: {
        sku: string;
        nmId: number;
        title: string;
        drr?: string;
        crOrder?: string;
        stockCoverDays?: string;
    }[];
}

function buildPrompt(data: TaskSuggestionRequest): string {
    const { actionType, taskType, skus } = data;

    const skuList = skus.map(s =>
        `- ${s.sku}: ${s.title?.slice(0, 40)}... (DRR: ${s.drr || 'н/д'}%, CR: ${s.crOrder || 'н/д'}%, дней: ${s.stockCoverDays || 'н/д'})`
    ).join('\n');

    const actionDescriptions: Record<string, string> = {
        oos: 'Товары закончились на складе',
        oos_soon: 'Товары скоро закончатся (запас < 7 дней)',
        high_drr: 'Высокий ДРР — реклама неэффективна',
        low_ctr: 'Низкий CTR — карточки не привлекают',
        low_cr: 'Низкая конверсия — смотрят но не покупают',
        low_buyout: 'Низкий выкуп — заказывают но не выкупают',
        overstock: 'Затоварка — запас > 90 дней',
    };

    return `Ты эксперт по управлению товарами на Wildberries. 
Дай КОНКРЕТНУЮ краткую инструкцию для менеджера по выбранным товарам.

ПРОБЛЕМА: ${actionDescriptions[actionType] || actionType}
ТИП ЗАДАЧИ: ${taskType}

ТОВАРЫ:
${skuList}

ЗАДАЧА:
Напиши 2-3 предложения с конкретными действиями для менеджера.
Не используй заголовки и списки.
Укажи конкретные цифры если уместно (например, "повысить ставку до X").`;
}

export async function POST(request: NextRequest) {
    try {
        const data: TaskSuggestionRequest = await request.json();

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
                max_tokens: 300,
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
        const suggestion = result.content?.[0]?.text || '';

        return NextResponse.json({
            success: true,
            suggestion,
        });

    } catch (error) {
        console.error('AI Task Suggestion Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
