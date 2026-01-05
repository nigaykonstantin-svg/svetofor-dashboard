import { NextRequest, NextResponse } from 'next/server';

interface MissionRequest {
    goal: string;
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
}

function buildPrompt(data: MissionRequest): string {
    const { goal, category, period, kpis, clusters } = data;

    const clusterSummary = Object.entries(clusters || {}).map(([key, items]) =>
        `${key}: ${items?.length || 0} SKU`
    ).join(', ');

    const topOOS = clusters?.OOS_NOW?.slice(0, 5).map(s => s.sku).join(', ') || 'нет';
    const topHighDRR = clusters?.HIGH_DRR?.slice(0, 5).map(s => `${s.sku} (${s.drr}%)`).join(', ') || 'нет';
    const topOverstock = clusters?.OVERSTOCK?.slice(0, 5).map(s => s.sku).join(', ') || 'нет';

    return `Ты стратег по управлению товарами MIXIT на Wildberries.
Пользователь хочет достичь цели. Декомпозируй её на 3-5 конкретных этапов.

ЦЕЛЬ: ${goal}

КОНТЕКСТ:
- Категория: ${category}
- Период: ${period} дней
- Выручка: ${kpis?.totalOrderSum?.toLocaleString('ru-RU') || 0} ₽
- Заказов: ${kpis?.totalOrders || 0}
- Средний ДРР: ${kpis?.avgDRR?.toFixed(1) || 0}%

ПРОБЛЕМНЫЕ КЛАСТЕРЫ: ${clusterSummary}
OOS: ${topOOS}
Высокий ДРР: ${topHighDRR}
Затоварка: ${topOverstock}

ЗАДАЧА:
Верни JSON точно в формате (без markdown блоков):
{
  "predictedImpact": "Общий ожидаемый эффект от выполнения всех этапов",
  "phases": [
    {
      "name": "Название этапа",
      "description": "Что конкретно нужно сделать",
      "predictedImpact": "+X₽ или +X%",
      "skuSources": ["OOS_NOW", "HIGH_DRR"] // какие кластеры использовать
    }
  ]
}

Каждый этап должен быть actionable и ссылаться на конкретные проблемы из данных.`;
}

export async function POST(request: NextRequest) {
    try {
        const data: MissionRequest = await request.json();

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
                max_tokens: 1000,
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
        let missionData;
        try {
            // Try to extract JSON from markdown if present
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            missionData = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        } catch {
            console.error('Failed to parse mission JSON:', text);
            return NextResponse.json(
                { success: false, error: 'Не удалось распарсить ответ AI' },
                { status: 500 }
            );
        }

        // Build mission with SKUs from clusters
        const phases = missionData.phases.map((phase: any, index: number) => {
            const skus: any[] = [];

            // Collect SKUs from specified clusters
            (phase.skuSources || []).forEach((source: string) => {
                const clusterSKUs = data.clusters[source as keyof typeof data.clusters] || [];
                clusterSKUs.slice(0, 5).forEach((sku: any) => {
                    if (!skus.find(s => s.nmId === sku.nmId)) {
                        skus.push({
                            nmId: sku.nmId,
                            sku: sku.sku,
                            title: sku.title,
                            currentIssue: sku.signals?.[0]?.message,
                        });
                    }
                });
            });

            return {
                id: `phase-${Date.now()}-${index}`,
                name: phase.name,
                description: phase.description,
                predictedImpact: phase.predictedImpact,
                skus,
                status: 'pending',
            };
        });

        const mission = {
            id: `mission-${Date.now()}`,
            goal: data.goal,
            status: 'planning',
            phases,
            predictedImpact: missionData.predictedImpact,
            createdAt: new Date().toISOString(),
        };

        return NextResponse.json({
            success: true,
            mission,
        });

    } catch (error) {
        console.error('AI Mission Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
