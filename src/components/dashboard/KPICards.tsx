'use client';

interface KPICardsProps {
    kpis: {
        totalOrderSum: number;
        totalOrders: number;
        avgCheck: number;
        avgDRR: number;
        skuCount: number;
    } | null;
    period: number;
}

function formatMoney(value: number): string {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toFixed(0);
}

export default function KPICards({ kpis, period }: KPICardsProps) {
    if (!kpis) return null;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-950/50 rounded-xl p-5 border border-emerald-800/30">
                <div className="text-emerald-400 text-sm mb-1">Заказы ({period} дней)</div>
                <div className="text-3xl font-bold">{formatMoney(kpis.totalOrderSum)} ₽</div>
            </div>
            <div className="bg-gradient-to-br from-blue-900/50 to-blue-950/50 rounded-xl p-5 border border-blue-800/30">
                <div className="text-blue-400 text-sm mb-1">Количество заказов</div>
                <div className="text-3xl font-bold">{kpis.totalOrders.toLocaleString()}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-900/50 to-purple-950/50 rounded-xl p-5 border border-purple-800/30">
                <div className="text-purple-400 text-sm mb-1">Средний чек</div>
                <div className="text-3xl font-bold">{formatMoney(kpis.avgCheck)} ₽</div>
            </div>
            <div className={`bg-gradient-to-br rounded-xl p-5 border ${kpis.avgDRR > 30 ? 'from-red-900/50 to-red-950/50 border-red-800/30' :
                    kpis.avgDRR > 20 ? 'from-yellow-900/50 to-yellow-950/50 border-yellow-800/30' :
                        'from-green-900/50 to-green-950/50 border-green-800/30'
                }`}>
                <div className={`text-sm mb-1 ${kpis.avgDRR > 30 ? 'text-red-400' :
                        kpis.avgDRR > 20 ? 'text-yellow-400' :
                            'text-green-400'
                    }`}>Средний ДРР</div>
                <div className="text-3xl font-bold">{kpis.avgDRR.toFixed(1)}%</div>
            </div>
        </div>
    );
}
