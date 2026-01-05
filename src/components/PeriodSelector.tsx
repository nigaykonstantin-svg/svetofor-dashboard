'use client';

import { useState, useRef, useEffect } from 'react';

interface DateRange {
    start: string;
    end: string;
}

interface PeriodSelectorProps {
    period: number;
    onPeriodChange: (period: number) => void;
    dateRange?: DateRange;
    onDateRangeChange?: (range: DateRange) => void;
    comparisonEnabled: boolean;
    onComparisonToggle: (enabled: boolean) => void;
}

// Helper to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

// Helper to get date N days ago
const daysAgo = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return formatDate(d);
};

// Preset periods
const PRESETS = [
    { days: 1, label: 'Вчера' },
    { days: 7, label: 'Неделя' },
    { days: 14, label: '14д' },
    { days: 30, label: 'Месяц' },
    { days: 90, label: 'Квартал' },
];

export default function PeriodSelector({
    period,
    onPeriodChange,
    dateRange,
    onDateRangeChange,
    comparisonEnabled,
    onComparisonToggle,
}: PeriodSelectorProps) {
    const [showCustom, setShowCustom] = useState(false);
    const [customStart, setCustomStart] = useState(daysAgo(7));
    const [customEnd, setCustomEnd] = useState(daysAgo(1));
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowCustom(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handlePresetClick = (days: number) => {
        onPeriodChange(days);
        setShowCustom(false);
    };

    const handleCustomApply = () => {
        if (onDateRangeChange) {
            onDateRangeChange({ start: customStart, end: customEnd });
        }
        // Calculate days between
        const days = Math.ceil(
            (new Date(customEnd).getTime() - new Date(customStart).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
        onPeriodChange(days);
        setShowCustom(false);
    };

    const isCustomActive = dateRange !== undefined;

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Presets */}
            <div className="flex bg-slate-800 rounded-lg p-1">
                {PRESETS.map((p) => (
                    <button
                        key={p.days}
                        onClick={() => handlePresetClick(p.days)}
                        className={`px-3 py-1.5 rounded text-sm transition whitespace-nowrap ${period === p.days && !isCustomActive
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}

                {/* Custom Date Picker */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setShowCustom(!showCustom)}
                        className={`px-3 py-1.5 rounded text-sm transition flex items-center gap-1 ${isCustomActive
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <span>📅</span> Свой
                    </button>

                    {showCustom && (
                        <div className="absolute top-full mt-2 right-0 bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-xl z-50 min-w-[240px]">
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">С даты</label>
                                    <input
                                        type="date"
                                        value={customStart}
                                        onChange={(e) => setCustomStart(e.target.value)}
                                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">По дату</label>
                                    <input
                                        type="date"
                                        value={customEnd}
                                        onChange={(e) => setCustomEnd(e.target.value)}
                                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <button
                                    onClick={handleCustomApply}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded py-2 text-sm transition"
                                >
                                    Применить
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Comparison Toggle */}
            <button
                onClick={() => onComparisonToggle(!comparisonEnabled)}
                className={`px-4 py-2 rounded-lg text-sm transition flex items-center gap-2 ${comparisonEnabled
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
            >
                <span>📊</span>
                {comparisonEnabled ? 'Сравнение вкл.' : 'Сравнить'}
            </button>

            {/* Comparison Info Badge */}
            {comparisonEnabled && (
                <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg">
                    vs {period === 1 ? 'позавчера' : `прошлые ${period}д`}
                </div>
            )}
        </div>
    );
}

// Helper hook for period comparison data
export function useComparisonPeriod(period: number, customRange?: DateRange) {
    const today = new Date();

    // Current period
    const currentEnd = customRange?.end || formatDate(new Date(today.getTime() - 24 * 60 * 60 * 1000)); // yesterday
    const currentStart = customRange?.start || daysAgo(period);

    // Previous period (same length, immediately before)
    const prevEnd = daysAgo(period + 1);
    const prevStart = daysAgo(period * 2);

    return {
        current: { start: currentStart, end: currentEnd },
        previous: { start: prevStart, end: prevEnd },
        periodDays: period,
    };
}
