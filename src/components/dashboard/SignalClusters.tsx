'use client';

interface ClusterConfig {
    label: string;
    color: string;
    textColor: string;
    priority: number;
}

const CLUSTER_CONFIG: Record<string, ClusterConfig> = {
    OOS_NOW: { label: '🚨 OOS', color: 'bg-red-500', textColor: 'text-red-500', priority: 1 },
    HIGH_DRR: { label: '💸 ДРР', color: 'bg-orange-500', textColor: 'text-orange-500', priority: 2 },
    OOS_SOON: { label: '⚠️ Скоро OOS', color: 'bg-yellow-500', textColor: 'text-yellow-500', priority: 3 },
    LOW_CTR: { label: '👁️ Low CTR', color: 'bg-cyan-500', textColor: 'text-cyan-500', priority: 4 },
    LOW_CR: { label: '🛒 Low CR', color: 'bg-blue-500', textColor: 'text-blue-500', priority: 5 },
    LOW_BUYOUT: { label: '📦 Низкий выкуп', color: 'bg-amber-500', textColor: 'text-amber-500', priority: 6 },
    OVERSTOCK: { label: '📦 Затоварка', color: 'bg-purple-500', textColor: 'text-purple-500', priority: 7 },
    ABOVE_MARKET: { label: '🏆 Топ', color: 'bg-emerald-500', textColor: 'text-emerald-500', priority: 8 },
};

interface SignalClustersProps {
    clusters: Record<string, number> | null;
    selectedCluster: string | null;
    showAllSKUs: boolean;
    onClusterSelect: (cluster: string | null) => void;
    onShowAllToggle: () => void;
}

export default function SignalClusters({
    clusters,
    selectedCluster,
    showAllSKUs,
    onClusterSelect,
    onShowAllToggle,
}: SignalClustersProps) {
    return (
        <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-300">Сигналы</h2>
                <button
                    onClick={onShowAllToggle}
                    className={`text-sm px-3 py-1 rounded-full transition ${showAllSKUs
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                >
                    {showAllSKUs ? '✓ Все SKU' : 'Показать все SKU'}
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {Object.entries(CLUSTER_CONFIG).map(([key, config]) => {
                    const count = clusters?.[key] || 0;
                    const isSelected = selectedCluster === key;

                    return (
                        <button
                            key={key}
                            onClick={() => onClusterSelect(isSelected ? null : key)}
                            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${isSelected
                                    ? `${config.color} text-white shadow-lg`
                                    : 'bg-slate-800 hover:bg-slate-700'
                                }`}
                        >
                            <span className={isSelected ? 'text-white' : config.textColor}>
                                {config.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-sm ${isSelected ? 'bg-white/20' : 'bg-slate-700'
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

export { CLUSTER_CONFIG };
