'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface SKUData {
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
}

interface SkuDeepDiveProps {
    allSKUs: SKUData[];
    initialSku?: SKUData | null;
    onCreateTask?: (sku: SKUData, taskType: string) => void;
    onClose?: () => void;
}

export default function SkuDeepDive({
    allSKUs,
    initialSku,
    onCreateTask,
    onClose,
}: SkuDeepDiveProps) {
    const [selectedSku, setSelectedSku] = useState<SKUData | null>(initialSku || null);
    const [searchQuery, setSearchQuery] = useState('');
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);

    const filteredSKUs = searchQuery
        ? allSKUs.filter(s =>
            s.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.nmId.toString().includes(searchQuery)
        ).slice(0, 10)
        : [];

    const selectSku = async (sku: SKUData) => {
        setSelectedSku(sku);
        setSearchQuery('');
        setChatHistory([]);
        setLoading(true);

        try {
            const response = await fetch('/api/ai-sku-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sku }),
            });

            const result = await response.json();
            if (result.success) {
                setAnalysis(result.analysis);
            }
        } catch (error) {
            console.error('SKU analysis error:', error);
        } finally {
            setLoading(false);
        }
    };

    const askAboutSku = async () => {
        if (!chatInput.trim() || !selectedSku || loading) return;

        const question = chatInput;
        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', content: question }]);
        setLoading(true);

        try {
            const response = await fetch('/api/ai-sku-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sku: selectedSku,
                    question,
                    history: chatHistory,
                }),
            });

            const result = await response.json();
            if (result.success) {
                setChatHistory(prev => [...prev, { role: 'assistant', content: result.answer || result.analysis }]);
            }
        } catch (error) {
            setChatHistory(prev => [...prev, { role: 'assistant', content: 'Ошибка при запросе' }]);
        } finally {
            setLoading(false);
        }
    };

    const getSignalBadge = (signal: { type: string; priority: string }) => {
        const colors: Record<string, string> = {
            critical: 'bg-red-500/20 text-red-400',
            warning: 'bg-yellow-500/20 text-yellow-400',
            info: 'bg-blue-500/20 text-blue-400',
            success: 'bg-green-500/20 text-green-400',
        };
        const typeLabels: Record<string, string> = {
            OOS_NOW: '🚨 OOS',
            OOS_SOON: '⚠️ Скоро OOS',
            HIGH_DRR: '💸 Высокий ДРР',
            LOW_CTR: '👁️ Низкий CTR',
            LOW_CR: '🛒 Низкий CR',
            LOW_BUYOUT: '📦 Низкий выкуп',
            OVERSTOCK: '📦 Затоварка',
            ABOVE_MARKET: '🏆 Топ',
        };
        return (
            <span className={`px-2 py-1 rounded text-xs ${colors[signal.priority] || colors.info}`}>
                {typeLabels[signal.type] || signal.type}
            </span>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {!selectedSku ? (
                /* SKU Search */
                <div className="p-4">
                    <div className="text-sm text-slate-400 mb-3">🔍 Найдите SKU для детального анализа</div>

                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Введите артикул, название или nmId..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500 mb-3"
                        autoFocus
                    />

                    {filteredSKUs.length > 0 && (
                        <div className="space-y-2">
                            {filteredSKUs.map(sku => (
                                <button
                                    key={sku.nmId}
                                    onClick={() => selectSku(sku)}
                                    className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-left transition"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-xs text-slate-400">{sku.sku}</span>
                                        {sku.signals.slice(0, 2).map((sig, i) => (
                                            <span key={i}>{getSignalBadge(sig)}</span>
                                        ))}
                                    </div>
                                    <div className="text-sm truncate">{sku.title}</div>
                                </button>
                            ))}
                        </div>
                    )}

                    {searchQuery && filteredSKUs.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                            Ничего не найдено
                        </div>
                    )}

                    {!searchQuery && (
                        <div className="text-center py-12 text-slate-500">
                            <div className="text-4xl mb-3">🔍</div>
                            <p>Начните вводить для поиска</p>
                        </div>
                    )}
                </div>
            ) : (
                /* SKU Analysis View */
                <div className="flex flex-col h-full">
                    {/* SKU Header */}
                    <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                        <div className="flex items-start justify-between mb-2">
                            <button
                                onClick={() => { setSelectedSku(null); setAnalysis(null); setChatHistory([]); }}
                                className="text-sm text-slate-400 hover:text-white"
                            >
                                ← Другой SKU
                            </button>
                            <div className="flex gap-2">
                                {selectedSku.signals.slice(0, 3).map((sig, i) => (
                                    <span key={i}>{getSignalBadge(sig)}</span>
                                ))}
                            </div>
                        </div>
                        <div className="font-mono text-sm text-slate-400">{selectedSku.sku} • {selectedSku.nmId}</div>
                        <div className="font-medium mt-1 line-clamp-2">{selectedSku.title}</div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="p-4 border-b border-slate-700 grid grid-cols-4 gap-3">
                        <div className="text-center">
                            <div className="text-xs text-slate-500">Остаток</div>
                            <div className={`font-bold ${selectedSku.stockTotal <= 0 ? 'text-red-400' : ''}`}>
                                {selectedSku.stockTotal}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-slate-500">Дней</div>
                            <div className={`font-bold ${parseFloat(selectedSku.stockCoverDays) < 7 ? 'text-yellow-400' : ''}`}>
                                {selectedSku.stockCoverDays}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-slate-500">CR%</div>
                            <div className="font-bold">{selectedSku.crOrder || '-'}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-slate-500">ДРР%</div>
                            <div className={`font-bold ${parseFloat(selectedSku.drr || '0') > 30 ? 'text-red-400' : ''}`}>
                                {selectedSku.drr || '-'}
                            </div>
                        </div>
                    </div>

                    {/* Analysis & Chat */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {loading && !analysis && (
                            <div className="text-center py-8">
                                <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                                <div className="text-slate-400 text-sm">Анализирую SKU...</div>
                            </div>
                        )}

                        {analysis && (
                            <div className="mb-4">
                                <div className="text-sm text-slate-400 mb-2">🧠 AI Диагностика</div>
                                <div className="prose prose-invert prose-sm max-w-none bg-slate-800/50 rounded-lg p-4">
                                    <ReactMarkdown>{analysis}</ReactMarkdown>
                                </div>
                            </div>
                        )}

                        {/* Chat History */}
                        {chatHistory.length > 0 && (
                            <div className="space-y-3 mb-4">
                                {chatHistory.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-emerald-600' : 'bg-slate-800'
                                            }`}>
                                            {msg.role === 'assistant' ? (
                                                <ReactMarkdown className="prose prose-invert prose-sm max-w-none">
                                                    {msg.content}
                                                </ReactMarkdown>
                                            ) : (
                                                msg.content
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    {selectedSku && (
                        <div className="p-4 border-t border-slate-700 space-y-3">
                            {/* Chat Input */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && askAboutSku()}
                                    placeholder="Спросить про этот SKU..."
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                    disabled={loading}
                                />
                                <button
                                    onClick={askAboutSku}
                                    disabled={!chatInput.trim() || loading}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm transition"
                                >
                                    {loading ? '...' : '💬'}
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => onCreateTask?.(selectedSku, 'optimize')}
                                    className="px-3 py-1.5 bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 rounded text-xs transition"
                                >
                                    📤 Создать задачу
                                </button>
                                <a
                                    href={`https://www.wildberries.ru/catalog/${selectedSku.nmId}/detail.aspx`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs transition"
                                >
                                    🔗 Открыть на WB
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
