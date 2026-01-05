import { NextRequest, NextResponse } from 'next/server';

interface ScenarioRequest {
    changes: {
        priceChangePercent?: number;
        budgetChangePercent?: number;
        newSKUs?: number;
    };
    category: string;
    currentKpis: {
        totalOrderSum: number;
        totalOrders: number;
        avgCheck: number;
        avgDRR: number;
        skuCount: number;
    };
}

function buildPrompt(data: ScenarioRequest): string {
    const { changes, category, currentKpis } = data;

    return `Ты аналитик по прогнозированию продаж на Wildberries (MIXIT).
Рассчитай прогноз изменения KPI при заданных параметрах.

ТЕКУЩИЕ KPI (${category}):
- Выручка: ${currentKpis.totalOrderSum?.toLocaleString('ru-RU') || 0} ₽
- Заказов: ${currentKpis.totalOrders || 0}
- Средний чек: ${currentKpis.avgCheck?.toFixed(0) || 0} ₽
- ДРР: ${currentKpis.avgDRR?.toFixed(1) || 0}%
- SKU: ${currentKpis.skuCount || 0}

ПРЕДЛАГАЕМЫЕ ИЗМЕНЕНИЯ:
- Изменение цен: ${changes.priceChangePercent || 0}%
- Изменение рекламного бюджета: ${changes.budgetChangePercent || 0}%
- Новых SKU: ${changes.newSKUs || 0}

ЗАДАЧА:
Рассчитай прогноз и верни JSON (без markdown блоков):
{
  "revenue": {
    "current": ${currentKpis.totalOrderSum || 0},
    "predicted": <число>,
    "change": <процент изменения>
  },
  "orders": {
    "current": ${currentKpis.totalOrders || 0},
    "predicted": <число>,
    "change": <процент изменения>
  },
  "margin": {
    "current": ${Math.round((currentKpis.totalOrderSum || 0) * 0.25)},
    "predicted": <число>,
    "change": <процент изменения>
  },
  "risks": ["риск 1", "риск 2"],
  "opportunities": ["возможность 1", "возможность 2"]
}

ЛОГИКА РАСЧЁТА:
- При повышении цен: выручка растёт, но заказы падают (эластичность -1.5)
- При снижении цен: заказы растут, выручка может упасть
- При увеличении рекламы: заказы растут с убывающей отдачей
- Новые SKU дают ~5-10% прироста каждый`;
}

export async function POST(request: NextRequest) {
    try {
        const data: ScenarioRequest = await request.json();

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

        // Parse JSON from response
        let prediction;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            prediction = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        } catch {
            console.error('Failed to parse scenario JSON:', text);
            return NextResponse.json(
                { success: false, error: 'Не удалось распарсить ответ AI' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            prediction,
        });

    } catch (error) {
        console.error('AI Scenario Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
