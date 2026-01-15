'use client';

import { useState, useEffect } from 'react';

interface SKUBreakdown {
    sku: string;
    nmId: number | null;
    name: string;
    category: string;
    position: number;
    clicks: number;
    cartAdds: number;
    orders: number;
    crCart: number;
    crOrder: number;
}

interface KeywordPhrase {
    phrase: string;
    frequency: number;
    totalClicks: number;
    totalCartAdds: number;
    totalOrders: number;
    skuCount: number;
    bestPosition: number;
    skuBreakdown: SKUBreakdown[];
}

interface SEOKeywordsData {
    generatedAt: string;
    totalPhrases: number;
    totalSkus: number;
    topPhrases: KeywordPhrase[];
    skuKeywords: Record<string, Array<{
        phrase: string;
        frequency: number;
        position: number;
        clicks: number;
        orders: number;
    }>>;
}

interface KeywordsTabProps {
    selectedSku?: string;
}

export default function KeywordsTab({ selectedSku }: KeywordsTabProps) {
    const [data, setData] = useState<SEOKeywordsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [sortBy, setSortBy] = useState<'frequency' | 'position' | 'clicks' | 'cart' | 'orders' | 'skuCount'>('frequency');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [fromCache, setFromCache] = useState(false);
    const [selectedPhrase, setSelectedPhrase] = useState<KeywordPhrase | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [visibleCount, setVisibleCount] = useState(100);

    const handleSort = (column: typeof sortBy) => {
        if (sortBy === column) {
            setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortBy(column);
            setSortDir(column === 'position' ? 'asc' : 'desc'); // Position: lower is better
        }
    };

    const CACHE_KEY = 'seo_keywords_cache';
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    useEffect(() => {
        loadKeywords();
    }, []);

    const analyzePhrase = async (phrase: KeywordPhrase) => {
        setAiLoading(true);
        setAiAnalysis(null);
        try {
            const response = await fetch('/api/ai-seo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phrase: phrase.phrase,
                    skuBreakdown: phrase.skuBreakdown
                })
            });
            const result = await response.json();
            if (result.success) {
                setAiAnalysis(result.analysis);
            } else {
                setAiAnalysis('Ошибка анализа: ' + result.error);
            }
        } catch (error) {
            setAiAnalysis('Ошибка: ' + String(error));
        } finally {
            setAiLoading(false);
        }
    };

    const loadKeywords = async (forceRefresh = false) => {
        setLoading(true);

        // Try to load from cache first
        if (!forceRefresh && typeof window !== 'undefined') {
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data: cachedData, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        setData(cachedData);
                        setFromCache(true);
                        setLoading(false);
                        return;
                    }
                }
            } catch (e) {
                console.error('Cache read error:', e);
            }
        }

        // Fetch from API
        try {
            const response = await fetch('/api/seo-keywords');
            const result = await response.json();
            if (result.success) {
                setData(result.data);
                setFromCache(false);

                // Save to cache
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.setItem(CACHE_KEY, JSON.stringify({
                            data: result.data,
                            timestamp: Date.now()
                        }));
                    } catch (e) {
                        console.error('Cache write error:', e);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load keywords:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="text-4xl mb-4 animate-pulse">🔍</div>
                    <div className="text-slate-400">Загрузка ключевых слов...</div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-20 text-slate-400">
                Данные ключевых слов не найдены
            </div>
        );
    }

    // Extract unique categories from all SKU breakdowns
    const allCategories = new Set<string>();
    data.topPhrases.forEach(p => {
        p.skuBreakdown?.forEach(sku => {
            if (sku.category && sku.category !== 'Неизвестно') {
                allCategories.add(sku.category);
            }
        });
    });
    const categories = Array.from(allCategories).sort();

    // Filter and sort phrases
    let displayPhrases = data.topPhrases.filter(p => {
        // Text search
        if (searchQuery && !p.phrase.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }
        // Category filter - show phrases where at least one SKU is from selected category
        if (categoryFilter) {
            const hasCategory = p.skuBreakdown?.some(sku => sku.category === categoryFilter);
            if (!hasCategory) return false;
        }
        return true;
    });

    displayPhrases = displayPhrases.sort((a, b) => {
        let diff = 0;
        if (sortBy === 'frequency') diff = b.frequency - a.frequency;
        else if (sortBy === 'orders') diff = b.totalOrders - a.totalOrders;
        else if (sortBy === 'position') diff = a.bestPosition - b.bestPosition;
        else if (sortBy === 'clicks') diff = b.totalClicks - a.totalClicks;
        else if (sortBy === 'cart') diff = b.totalCartAdds - a.totalCartAdds;
        else if (sortBy === 'skuCount') diff = b.skuCount - a.skuCount;
        return sortDir === 'asc' ? -diff : diff;
    });

    const formatNumber = (n: number) => n.toLocaleString('ru-RU');

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
                    <div className="text-slate-400 text-sm mb-1">Уникальных фраз</div>
                    <div className="text-3xl font-bold text-white">{formatNumber(data.totalPhrases)}</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
                    <div className="text-slate-400 text-sm mb-1">SKU с ключевыми</div>
                    <div className="text-3xl font-bold text-emerald-400">{formatNumber(data.totalSkus)}</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
                    <div className="text-slate-400 text-sm mb-1">Обновлено</div>
                    <div className="text-xl font-bold text-slate-300">
                        {new Date(data.generatedAt).toLocaleDateString('ru-RU')}
                    </div>
                    {fromCache && (
                        <div className="text-xs text-emerald-400 mt-1">⚡ из кеша</div>
                    )}
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700 flex flex-col justify-center">
                    <button
                        onClick={() => loadKeywords(true)}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white transition-colors text-sm"
                    >
                        {loading ? 'Загрузка...' : '🔄 Обновить'}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                    <input
                        type="text"
                        placeholder="Поиск по фразе..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <select
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value); setVisibleCount(100); }}
                    className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="">Все категории</option>
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="frequency">По частотности</option>
                    <option value="orders">По заказам</option>
                    <option value="position">По позиции</option>
                </select>
            </div>

            {/* Keywords Table */}
            <div className="bg-slate-800/30 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">#</th>
                                <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Поисковая фраза</th>
                                <th
                                    onClick={() => handleSort('frequency')}
                                    className="text-right px-4 py-3 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                                >
                                    Частотность {sortBy === 'frequency' && (sortDir === 'desc' ? '↓' : '↑')}
                                </th>
                                <th
                                    onClick={() => handleSort('position')}
                                    className="text-right px-4 py-3 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                                >
                                    Позиция {sortBy === 'position' && (sortDir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    onClick={() => handleSort('clicks')}
                                    className="text-right px-4 py-3 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                                >
                                    Клики {sortBy === 'clicks' && (sortDir === 'desc' ? '↓' : '↑')}
                                </th>
                                <th
                                    onClick={() => handleSort('cart')}
                                    className="text-right px-4 py-3 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                                >
                                    Корзина {sortBy === 'cart' && (sortDir === 'desc' ? '↓' : '↑')}
                                </th>
                                <th
                                    onClick={() => handleSort('orders')}
                                    className="text-right px-4 py-3 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                                >
                                    Заказы {sortBy === 'orders' && (sortDir === 'desc' ? '↓' : '↑')}
                                </th>
                                <th
                                    onClick={() => handleSort('skuCount')}
                                    className="text-right px-4 py-3 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                                >
                                    SKU {sortBy === 'skuCount' && (sortDir === 'desc' ? '↓' : '↑')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayPhrases.slice(0, visibleCount).map((phrase, i) => (
                                <tr
                                    key={phrase.phrase}
                                    onClick={() => phrase.skuBreakdown?.length > 0 && setSelectedPhrase(phrase)}
                                    className={`border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors ${phrase.skuBreakdown?.length > 0 ? 'cursor-pointer' : ''
                                        }`}
                                >
                                    <td className="px-4 py-3 text-slate-500 text-sm">{i + 1}</td>
                                    <td className="px-4 py-3">
                                        <span className="text-white">{phrase.phrase}</span>
                                        {phrase.skuBreakdown?.length > 0 && (
                                            <span className="ml-2 text-xs text-emerald-400">🔍</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="text-emerald-400 font-medium">
                                            {formatNumber(phrase.frequency)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`font-medium ${phrase.bestPosition <= 3 ? 'text-emerald-400' :
                                            phrase.bestPosition <= 10 ? 'text-yellow-400' :
                                                phrase.bestPosition <= 50 ? 'text-orange-400' : 'text-red-400'
                                            }`}>
                                            {phrase.bestPosition > 0 ? phrase.bestPosition.toFixed(1) : '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-300">
                                        {formatNumber(phrase.totalClicks)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-300">
                                        {formatNumber(phrase.totalCartAdds)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`font-medium ${phrase.totalOrders > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                            {formatNumber(phrase.totalOrders)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-400">
                                        {phrase.skuCount}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {displayPhrases.length > visibleCount && (
                <div className="text-center space-y-2">
                    <div className="text-slate-500 text-sm">
                        Показано {visibleCount} из {displayPhrases.length} фраз
                    </div>
                    <button
                        onClick={() => setVisibleCount(prev => Math.min(prev + 100, displayPhrases.length))}
                        className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
                    >
                        Показать ещё 100
                    </button>
                </div>
            )}
            {displayPhrases.length > 0 && displayPhrases.length <= visibleCount && displayPhrases.length > 100 && (
                <div className="text-center text-slate-500 text-sm">
                    Показаны все {displayPhrases.length} фраз
                </div>
            )}

            {/* SKU Breakdown Modal */}
            {selectedPhrase && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => { setSelectedPhrase(null); setAiAnalysis(null); }}
                >
                    <div
                        className="bg-slate-900 rounded-2xl border border-slate-700 max-w-5xl w-full max-h-[90vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        Ключ: «{selectedPhrase.phrase}»
                                    </h2>
                                    <p className="text-slate-400 text-sm mt-1">
                                        {formatNumber(selectedPhrase.frequency)} запросов • {selectedPhrase.skuBreakdown.length} SKU с активностью
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => analyzePhrase(selectedPhrase)}
                                        disabled={aiLoading}
                                        className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white transition-colors text-sm flex items-center gap-2"
                                    >
                                        {aiLoading ? (
                                            <>
                                                <span className="animate-spin">⏳</span>
                                                Анализ...
                                            </>
                                        ) : (
                                            <>
                                                🤖 AI Анализ
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => { setSelectedPhrase(null); setAiAnalysis(null); }}
                                        className="text-slate-400 hover:text-white text-2xl"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* AI Analysis Results */}
                        {aiAnalysis && (
                            <div className="p-4 border-b border-slate-700 bg-purple-900/20 max-h-[30vh] overflow-auto">
                                <div className="prose prose-invert prose-sm max-w-none">
                                    <div className="whitespace-pre-wrap text-sm text-slate-200">
                                        {aiAnalysis}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="overflow-auto max-h-[50vh]">
                            <table className="w-full">
                                <thead className="sticky top-0 bg-slate-800">
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">#</th>
                                        <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Товар</th>
                                        <th className="text-right px-4 py-3 text-slate-400 font-medium text-sm">Позиция</th>
                                        <th className="text-right px-4 py-3 text-slate-400 font-medium text-sm">Клики</th>
                                        <th className="text-right px-4 py-3 text-slate-400 font-medium text-sm">Корзина</th>
                                        <th className="text-right px-4 py-3 text-slate-400 font-medium text-sm">CR корз</th>
                                        <th className="text-right px-4 py-3 text-slate-400 font-medium text-sm">Заказы</th>
                                        <th className="text-right px-4 py-3 text-slate-400 font-medium text-sm">CR заказ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedPhrase.skuBreakdown.map((sku, i) => (
                                        <tr key={sku.sku} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                                            <td className="px-4 py-3 text-slate-500 text-sm">{i + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    {sku.nmId ? (
                                                        <a
                                                            href={`https://www.wildberries.ru/catalog/${sku.nmId}/detail.aspx`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-emerald-400 hover:text-emerald-300 font-medium text-sm truncate max-w-[200px]"
                                                            title={sku.name}
                                                        >
                                                            {sku.name} ↗
                                                        </a>
                                                    ) : (
                                                        <span className="text-white text-sm">{sku.name}</span>
                                                    )}
                                                    <span className="text-slate-500 text-xs font-mono">{sku.sku}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`font-medium ${sku.position <= 3 ? 'text-emerald-400' :
                                                    sku.position <= 10 ? 'text-yellow-400' :
                                                        sku.position <= 50 ? 'text-orange-400' : 'text-red-400'
                                                    }`}>
                                                    {sku.position > 0 ? sku.position : '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-300">{formatNumber(sku.clicks)}</td>
                                            <td className="px-4 py-3 text-right text-slate-300">{formatNumber(sku.cartAdds)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`font-medium ${sku.crCart >= 40 ? 'text-emerald-400' :
                                                    sku.crCart >= 20 ? 'text-yellow-400' : 'text-orange-400'
                                                    }`}>
                                                    {sku.crCart.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`font-medium ${sku.orders > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                    {formatNumber(sku.orders)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`font-medium ${sku.crOrder >= 5 ? 'text-emerald-400' :
                                                    sku.crOrder >= 2 ? 'text-yellow-400' : 'text-orange-400'
                                                    }`}>
                                                    {sku.crOrder.toFixed(2)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

