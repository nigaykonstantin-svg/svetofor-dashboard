'use client';

import { useState, useEffect } from 'react';

interface CategoryThresholds {
    STOCK_CRITICAL_DAYS: number;
    STOCK_WARNING_DAYS: number;
    STOCK_OVERSTOCK_DAYS: number;
    CR_CART_LOW: number;
    CR_ORDER_HIGH: number;
    DRR_HIGH: number;
    BUYOUT_LOW: number;
}

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const CATEGORIES = ['Уход за лицом', 'Уход за телом', 'Макияж', 'Уход за волосами'];

const DEFAULT_THRESHOLDS: Record<string, CategoryThresholds> = {
    'Уход за лицом': {
        STOCK_CRITICAL_DAYS: 5,
        STOCK_WARNING_DAYS: 10,
        STOCK_OVERSTOCK_DAYS: 60,
        CR_CART_LOW: 6,
        CR_ORDER_HIGH: 10,
        DRR_HIGH: 25,
        BUYOUT_LOW: 60,
    },
    'Уход за телом': {
        STOCK_CRITICAL_DAYS: 7,
        STOCK_WARNING_DAYS: 14,
        STOCK_OVERSTOCK_DAYS: 90,
        CR_CART_LOW: 4,
        CR_ORDER_HIGH: 7,
        DRR_HIGH: 35,
        BUYOUT_LOW: 45,
    },
    'Макияж': {
        STOCK_CRITICAL_DAYS: 10,
        STOCK_WARNING_DAYS: 21,
        STOCK_OVERSTOCK_DAYS: 120,
        CR_CART_LOW: 4,
        CR_ORDER_HIGH: 6,
        DRR_HIGH: 40,
        BUYOUT_LOW: 40,
    },
    'Уход за волосами': {
        STOCK_CRITICAL_DAYS: 7,
        STOCK_WARNING_DAYS: 14,
        STOCK_OVERSTOCK_DAYS: 100,
        CR_CART_LOW: 5,
        CR_ORDER_HIGH: 9,
        DRR_HIGH: 30,
        BUYOUT_LOW: 55,
    },
};

const THRESHOLD_LABELS: Record<keyof CategoryThresholds, { label: string; unit: string; min: number; max: number }> = {
    STOCK_CRITICAL_DAYS: { label: '🔴 Критич. остаток', unit: 'дней', min: 1, max: 30 },
    STOCK_WARNING_DAYS: { label: '🟡 Предупр. остаток', unit: 'дней', min: 5, max: 60 },
    STOCK_OVERSTOCK_DAYS: { label: '📦 Затоваривание', unit: 'дней', min: 30, max: 365 },
    CR_CART_LOW: { label: '🛒 Низкий CR корзина', unit: '%', min: 1, max: 20 },
    CR_ORDER_HIGH: { label: '🏆 Топ CR заказ', unit: '%', min: 3, max: 25 },
    DRR_HIGH: { label: '💸 Высокий ДРР', unit: '%', min: 10, max: 80 },
    BUYOUT_LOW: { label: '📉 Низкий выкуп', unit: '%', min: 20, max: 80 },
};

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
    const [settings, setSettings] = useState<Record<string, CategoryThresholds>>(DEFAULT_THRESHOLDS);
    const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
    const [hasChanges, setHasChanges] = useState(false);

    // Load settings from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('svetofor_thresholds');
        if (saved) {
            try {
                setSettings(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse settings:', e);
            }
        }
    }, []);

    const handleChange = (key: keyof CategoryThresholds, value: number) => {
        setSettings(prev => ({
            ...prev,
            [activeCategory]: {
                ...prev[activeCategory],
                [key]: value,
            },
        }));
        setHasChanges(true);
    };

    const handleSave = () => {
        localStorage.setItem('svetofor_thresholds', JSON.stringify(settings));
        setHasChanges(false);
        // Reload page to apply new settings
        window.location.reload();
    };

    const handleReset = () => {
        setSettings(DEFAULT_THRESHOLDS);
        setHasChanges(true);
    };

    if (!isOpen) return null;

    const currentThresholds = settings[activeCategory];

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-slate-700 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-gradient-to-r from-purple-600/20 to-pink-600/20">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            ⚙️ Настройки порогов
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            Настройте пороговые значения для сигналов по каждой категории
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition"
                    >
                        ✕
                    </button>
                </div>

                {/* Category Tabs */}
                <div className="flex gap-2 p-4 bg-slate-800/50 border-b border-slate-700 overflow-x-auto">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${activeCategory === cat
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Settings Grid */}
                <div className="p-6 overflow-y-auto max-h-[50vh] space-y-6">
                    {(Object.keys(THRESHOLD_LABELS) as (keyof CategoryThresholds)[]).map(key => {
                        const config = THRESHOLD_LABELS[key];
                        const value = currentThresholds[key];
                        const defaultValue = DEFAULT_THRESHOLDS[activeCategory][key];
                        const isChanged = value !== defaultValue;

                        return (
                            <div key={key} className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm text-slate-300 flex items-center gap-2">
                                        {config.label}
                                        {isChanged && (
                                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                                                изменено
                                            </span>
                                        )}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={value}
                                            onChange={(e) => handleChange(key, Number(e.target.value))}
                                            min={config.min}
                                            max={config.max}
                                            className="w-20 px-3 py-1 bg-slate-800 border border-slate-600 rounded-lg text-white text-right focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                        <span className="text-slate-500 text-sm w-12">{config.unit}</span>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    value={value}
                                    onChange={(e) => handleChange(key, Number(e.target.value))}
                                    min={config.min}
                                    max={config.max}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>{config.min} {config.unit}</span>
                                    <span className="text-slate-600">
                                        по умолч: {defaultValue}
                                    </span>
                                    <span>{config.max} {config.unit}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-800/50">
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm"
                    >
                        ↩️ Сбросить всё
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                        >
                            Отмена
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className={`px-6 py-2 rounded-lg transition font-semibold ${hasChanges
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            💾 Сохранить
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
