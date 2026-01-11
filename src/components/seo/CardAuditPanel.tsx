'use client';

import { useState } from 'react';
import type { SEOProduct, SEOIssue } from '@/types/seo';

interface CardAuditPanelProps {
    product: SEOProduct | null;
    onClose: () => void;
}

export default function CardAuditPanel({ product, onClose }: CardAuditPanelProps) {
    if (!product) return null;

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-yellow-400';
        if (score >= 40) return 'text-orange-400';
        return 'text-red-400';
    };

    const getSeverityIcon = (severity: SEOIssue['severity']) => {
        switch (severity) {
            case 'critical': return '🔴';
            case 'warning': return '🟡';
            case 'info': return '🔵';
        }
    };

    const checklist = [
        {
            label: 'Название оптимальной длины',
            passed: product.titleLength >= 60 && product.titleLength <= 120,
            detail: `${product.titleLength} символов`,
        },
        {
            label: 'Минимум 5 фото',
            passed: product.photoCount >= 5,
            detail: `${product.photoCount} фото`,
        },
        {
            label: 'Есть видео',
            passed: product.hasVideo,
            detail: product.hasVideo ? 'Есть' : 'Нет',
        },
        {
            label: 'Характеристики заполнены',
            passed: product.characteristicsCount >= 10,
            detail: `${product.characteristicsCount} характеристик`,
        },
        {
            label: '7+ фото для топ-ранжирования',
            passed: product.photoCount >= 7,
            detail: product.photoCount >= 7 ? '✓' : 'Добавьте еще',
        },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-slate-700">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-white mb-1">
                            Аудит карточки
                        </h2>
                        <p className="text-slate-400 text-sm truncate max-w-md" title={product.title}>
                            {product.title || 'Без названия'}
                        </p>
                        <p className="text-slate-500 text-xs mt-1">
                            {product.sku} • nmId: {product.nmId}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Score */}
                <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <div className={`text-5xl font-bold ${getScoreColor(product.seoScore)}`}>
                                {product.seoScore}
                            </div>
                            <div className="text-slate-500 text-sm mt-1">SEO Score</div>
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${product.seoScore >= 80 ? 'bg-emerald-500' :
                                            product.seoScore >= 60 ? 'bg-yellow-500' :
                                                product.seoScore >= 40 ? 'bg-orange-500' : 'bg-red-500'
                                        }`}
                                    style={{ width: `${product.seoScore}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>0</span>
                                <span>100</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Checklist */}
                <div className="p-6 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300 mb-4">
                        Чек-лист SEO
                    </h3>
                    <div className="space-y-3">
                        {checklist.map((item, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className={`text-lg ${item.passed ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {item.passed ? '✓' : '○'}
                                    </span>
                                    <span className={item.passed ? 'text-white' : 'text-slate-400'}>
                                        {item.label}
                                    </span>
                                </div>
                                <span className="text-slate-500 text-sm">{item.detail}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Issues */}
                {product.issues.length > 0 && (
                    <div className="p-6 max-h-[300px] overflow-y-auto">
                        <h3 className="text-sm font-semibold text-slate-300 mb-4">
                            Рекомендации ({product.issues.length})
                        </h3>
                        <div className="space-y-3">
                            {product.issues.map((issue, i) => (
                                <div
                                    key={i}
                                    className="bg-slate-800/50 rounded-lg p-3"
                                >
                                    <div className="flex items-start gap-2">
                                        <span>{getSeverityIcon(issue.severity)}</span>
                                        <div>
                                            <div className="text-white text-sm">
                                                {issue.message}
                                            </div>
                                            <div className="text-slate-400 text-xs mt-1">
                                                💡 {issue.recommendation}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="p-4 border-t border-slate-800 flex gap-3 justify-end">
                    <a
                        href={`https://www.wildberries.ru/catalog/${product.nmId}/detail.aspx`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors text-sm"
                    >
                        Открыть на WB ↗
                    </a>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors text-sm"
                    >
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
}
