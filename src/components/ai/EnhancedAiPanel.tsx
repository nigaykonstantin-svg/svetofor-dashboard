'use client';

import { useState, useMemo } from 'react';
import { AiPanelTab, AI_TABS } from './types';
import ChatMode from './ChatMode';
import ActionsMode from './ActionsMode';
import MissionsMode from './MissionsMode';
import SkuDeepDive from './SkuDeepDive';
import ScenariosMode from './ScenariosMode';

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
}

interface EnhancedAiPanelProps {
    isOpen: boolean;
    onClose: () => void;
    category: string;
    period: number;
    kpis: {
        totalOrderSum: number;
        totalOrders: number;
        avgCheck: number;
        avgDRR: number;
        skuCount: number;
    } | null;
    clusters: {
        OOS_NOW: SKUData[];
        OOS_SOON: SKUData[];
        HIGH_DRR: SKUData[];
        LOW_CTR: SKUData[];
        LOW_CR: SKUData[];
        LOW_BUYOUT: SKUData[];
        OVERSTOCK: SKUData[];
        ABOVE_MARKET: SKUData[];
    } | null;
    allSKUs: SKUData[];
    onCreateTask?: (skus: SKUData[], taskType: string, aiSuggestion?: string) => void;
}

export default function EnhancedAiPanel({
    isOpen,
    onClose,
    category,
    period,
    kpis,
    clusters,
    allSKUs,
    onCreateTask,
}: EnhancedAiPanelProps) {
    const [activeTab, setActiveTab] = useState<AiPanelTab>('chat');
    const [deepDiveSku, setDeepDiveSku] = useState<SKUData | null>(null);

    // Count issues for badge
    const issueCount = useMemo(() => {
        if (!clusters) return 0;
        return (
            (clusters.OOS_NOW?.length || 0) +
            (clusters.OOS_SOON?.length || 0) +
            (clusters.HIGH_DRR?.length || 0) +
            (clusters.LOW_CTR?.length || 0) +
            (clusters.LOW_CR?.length || 0) +
            (clusters.LOW_BUYOUT?.length || 0) +
            (clusters.OVERSTOCK?.length || 0)
        );
    }, [clusters]);

    // Handle SKU deep dive from other tabs
    const handleSkuDeepDive = (sku: SKUData) => {
        setDeepDiveSku(sku);
        setActiveTab('sku');
    };

    // Handle task creation with AI suggestion
    const handleCreateTask = (skus: SKUData[], taskType: string, aiSuggestion?: string) => {
        if (onCreateTask) {
            onCreateTask(skus, taskType, aiSuggestion);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">🤖</span> AI Hub
                        </h2>
                        <p className="text-slate-400 text-sm">
                            {category === 'Все' ? 'Все категории' : category} • {period} дней
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700 bg-slate-800/50 overflow-x-auto">
                    {AI_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 min-w-0 px-4 py-3 text-sm font-medium transition relative ${activeTab === tab.id
                                    ? 'text-white'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`}
                        >
                            <span className="flex items-center justify-center gap-1.5">
                                <span>{tab.emoji}</span>
                                <span className="hidden sm:inline">{tab.label}</span>
                            </span>
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                            )}
                            {/* Badge for actions tab */}
                            {tab.id === 'actions' && issueCount > 0 && (
                                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                                    {issueCount > 99 ? '99+' : issueCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {activeTab === 'chat' && (
                        <ChatMode
                            category={category}
                            period={period}
                            kpis={kpis}
                            clusters={clusters}
                            onSkuClick={(nmId) => {
                                const sku = allSKUs.find(s => s.nmId === nmId);
                                if (sku) handleSkuDeepDive(sku);
                            }}
                        />
                    )}

                    {activeTab === 'actions' && (
                        <ActionsMode
                            clusters={clusters}
                            onCreateTask={(skus, taskType, suggestion) => handleCreateTask(skus, taskType, suggestion)}
                            onSkuDeepDive={handleSkuDeepDive}
                        />
                    )}

                    {activeTab === 'missions' && (
                        <MissionsMode
                            category={category}
                            period={period}
                            kpis={kpis}
                            clusters={clusters}
                            onCreateTasks={(phases) => {
                                // Create tasks for each phase
                                phases.forEach(phase => {
                                    const skus = phase.skus.map(s => allSKUs.find(a => a.nmId === s.nmId)).filter(Boolean) as SKUData[];
                                    if (skus.length > 0) {
                                        handleCreateTask(skus, 'optimize', phase.description);
                                    }
                                });
                            }}
                        />
                    )}

                    {activeTab === 'sku' && (
                        <SkuDeepDive
                            allSKUs={allSKUs}
                            initialSku={deepDiveSku}
                            onCreateTask={(sku, taskType) => handleCreateTask([sku], taskType)}
                            onClose={() => setDeepDiveSku(null)}
                        />
                    )}

                    {activeTab === 'scenarios' && (
                        <ScenariosMode
                            category={category}
                            kpis={kpis}
                        />
                    )}
                </div>
            </div>
        </>
    );
}
