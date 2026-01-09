'use client';

import { Signal } from '@/lib/signal-engine';

// Cluster configuration
export const CLUSTER_CONFIG: Record<string, { label: string; color: string; textColor: string; priority: number }> = {
    OOS_NOW: { label: '🔴 OOS', color: 'bg-red-500', textColor: 'text-red-400', priority: 1 },
    HIGH_DRR: { label: '💸 ДРР', color: 'bg-orange-500', textColor: 'text-orange-400', priority: 2 },
    FALLING_SALES: { label: '📉 Падение', color: 'bg-rose-500', textColor: 'text-rose-400', priority: 3 },
    OOS_SOON: { label: '⚠️ Скоро OOS', color: 'bg-amber-500', textColor: 'text-amber-400', priority: 4 },
    LOW_CTR: { label: '👁️ Low CTR', color: 'bg-purple-500', textColor: 'text-purple-400', priority: 5 },
    LOW_CR: { label: '🛒 Low CR', color: 'bg-yellow-500', textColor: 'text-yellow-400', priority: 6 },
    LOW_BUYOUT: { label: '📦 Низкий выкуп', color: 'bg-pink-500', textColor: 'text-pink-400', priority: 7 },
    OVERSTOCK: { label: '📦 Затоварка', color: 'bg-blue-500', textColor: 'text-blue-400', priority: 8 },
    ABOVE_MARKET: { label: '🏆 Топ', color: 'bg-green-500', textColor: 'text-green-400', priority: 9 },
};

interface SKUData {
    nmId: number;
    signals: Signal[];
}

interface ClusterCounts {
    OOS_NOW: number;
    HIGH_DRR: number;
    FALLING_SALES: number;
    OOS_SOON: number;
    LOW_CTR: number;
    LOW_CR: number;
    LOW_BUYOUT: number;
    OVERSTOCK: number;
    ABOVE_MARKET: number;
}

interface SignalClustersProps {
    clusters: ClusterCounts;
    selectedCluster: string | null;
    onSelectCluster: (cluster: string | null) => void;
    showAllSKUs: boolean;
    onToggleShowAll: () => void;
}

export default function SignalClusters({
    clusters,
    selectedCluster,
    onSelectCluster,
    showAllSKUs,
    onToggleShowAll,
}: SignalClustersProps) {
    return (
        <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-300">Сигналы</h2>
                <button
                    onClick={onToggleShowAll}
                    className={`text-sm px-3 py-1 rounded-full transition ${showAllSKUs ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                >
                    {showAllSKUs ? '✓ Все SKU' : 'Показать все SKU'}
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {Object.entries(CLUSTER_CONFIG).map(([key, config]) => {
                    const count = clusters[key as keyof ClusterCounts] || 0;
                    const isSelected = selectedCluster === key;

                    return (
                        <button
                            key={key}
                            onClick={() => onSelectCluster(isSelected ? null : key)}
                            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${isSelected
                                ? `${config.color} text-white shadow-lg`
                                : 'bg-slate-800 hover:bg-slate-700'
                                }`}
                        >
                            <span className={isSelected ? 'text-white' : config.textColor}>
                                {config.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${isSelected ? 'bg-white/20' : 'bg-slate-700'
                                }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
