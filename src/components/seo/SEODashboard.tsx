'use client';

import { useState, useEffect } from 'react';
import CardAuditPanel from './CardAuditPanel';
import type { SEOProduct, SEOAuditResult } from '@/types/seo';

interface SEODashboardProps {
    onBack?: () => void;
}

export default function SEODashboard({ onBack }: SEODashboardProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<SEOAuditResult | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<SEOProduct | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchSEOData();
    }, [categoryFilter]);

    const fetchSEOData = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (categoryFilter) params.set('category', categoryFilter);
            params.set('limit', '200');

            const response = await fetch(`/api/seo?${params.toString()}`);
            const result = await response.json();

            if (result.success) {
                setData(result.data);
            } else {
                setError(result.error || 'Failed to load SEO data');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'bg-emerald-500';
        if (score >= 60) return 'bg-yellow-500';
        if (score >= 40) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const getScoreTextColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-yellow-400';
        if (score >= 40) return 'text-orange-400';
        return 'text-red-400';
    };

    const filteredProducts = data?.products.filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return p.title.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            String(p.nmId).includes(q);
    }) || [];

    const categories = data ? Object.keys(data.categoryBreakdown).sort() : [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-3xl">🔍</span>
                            <div>
                                <h1 className="text-2xl font-bold text-white">
                                    SEO Аудит карточек
                                </h1>
                                <p className="text-slate-400 text-sm">
                                    Анализ SEO-оптимизации товаров Wildberries
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={fetchSEOData}
                            disabled={loading}
                            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white transition-colors text-sm"
                        >
                            {loading ? 'Загрузка...' : '🔄 Обновить'}
                        </button>
                    </div>
                </div>
            </header>

            <div className="p-6">
                {/* Stats Cards */}
                {data && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
                            <div className="text-slate-400 text-sm mb-1">Проверено товаров</div>
                            <div className="text-3xl font-bold text-white">{data.auditedProducts}</div>
                            <div className="text-slate-500 text-xs">из {data.totalProducts} в воронке</div>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
                            <div className="text-slate-400 text-sm mb-1">Средний SEO Score</div>
                            <div className={`text-3xl font-bold ${getScoreTextColor(data.avgSeoScore)}`}>
                                {data.avgSeoScore}
                            </div>
                            <div className="text-slate-500 text-xs">из 100 баллов</div>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
                            <div className="text-slate-400 text-sm mb-1">Критичные проблемы</div>
                            <div className="text-3xl font-bold text-red-400">{data.issuesBreakdown.critical}</div>
                            <div className="text-slate-500 text-xs">требуют внимания</div>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
                            <div className="text-slate-400 text-sm mb-1">Предупреждения</div>
                            <div className="text-3xl font-bold text-yellow-400">{data.issuesBreakdown.warning}</div>
                            <div className="text-slate-500 text-xs">можно улучшить</div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-wrap gap-4 mb-6">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Поиск по названию, SKU или nmId..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="">Все категории</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                {/* Category Breakdown */}
                {data && Object.keys(data.categoryBreakdown).length > 0 && (
                    <div className="bg-slate-800/30 backdrop-blur rounded-xl p-4 mb-6 border border-slate-700/50">
                        <h3 className="text-sm font-semibold text-slate-400 mb-3">SEO Score по категориям</h3>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(data.categoryBreakdown)
                                .sort((a, b) => a[1].avgScore - b[1].avgScore)
                                .map(([cat, info]) => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
                                        className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-all ${cat === categoryFilter
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                                            }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${getScoreColor(info.avgScore)}`} />
                                        {cat}
                                        <span className="text-slate-400">({info.count})</span>
                                    </button>
                                ))}
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                        <p className="text-red-400">{error}</p>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div className="text-4xl mb-4 animate-pulse">🔍</div>
                            <div className="text-slate-400">Анализируем карточки...</div>
                        </div>
                    </div>
                )}

                {/* Products Table */}
                {!loading && filteredProducts.length > 0 && (
                    <div className="bg-slate-800/30 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">SEO</th>
                                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Товар</th>
                                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-sm">Категория</th>
                                    <th className="text-center px-4 py-3 text-slate-400 font-medium text-sm">Фото</th>
                                    <th className="text-center px-4 py-3 text-slate-400 font-medium text-sm">Видео</th>
                                    <th className="text-center px-4 py-3 text-slate-400 font-medium text-sm">Проблемы</th>
                                    <th className="text-right px-4 py-3 text-slate-400 font-medium text-sm">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map((product) => (
                                    <tr
                                        key={product.nmId}
                                        className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors cursor-pointer"
                                        onClick={() => setSelectedProduct(product)}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${getScoreColor(product.seoScore)}`}>
                                                    {product.seoScore}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="max-w-xs">
                                                <div className="text-white text-sm truncate" title={product.title}>
                                                    {product.title || 'Без названия'}
                                                </div>
                                                <div className="text-slate-500 text-xs">{product.sku}</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-slate-300 text-sm">{product.category}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-sm ${product.photoCount >= 5 ? 'text-emerald-400' : 'text-orange-400'}`}>
                                                {product.photoCount}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {product.hasVideo ? (
                                                <span className="text-emerald-400">✓</span>
                                            ) : (
                                                <span className="text-slate-500">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {product.issues.filter(i => i.severity === 'critical').length > 0 && (
                                                    <span className="text-red-400 text-xs">
                                                        🔴{product.issues.filter(i => i.severity === 'critical').length}
                                                    </span>
                                                )}
                                                {product.issues.filter(i => i.severity === 'warning').length > 0 && (
                                                    <span className="text-yellow-400 text-xs">
                                                        🟡{product.issues.filter(i => i.severity === 'warning').length}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedProduct(product);
                                                }}
                                                className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs transition-colors"
                                            >
                                                Аудит
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Empty State */}
                {!loading && filteredProducts.length === 0 && !error && (
                    <div className="text-center py-20">
                        <div className="text-4xl mb-4">📭</div>
                        <div className="text-slate-400">Товары не найдены</div>
                    </div>
                )}
            </div>

            {/* Card Audit Modal */}
            {selectedProduct && (
                <CardAuditPanel
                    product={selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                />
            )}
        </div>
    );
}
