'use client';

import { useState, useRef, useEffect } from 'react';

interface SegmentedControlProps<T extends string | number> {
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
}

export default function SegmentedControl<T extends string | number>({
    options,
    value,
    onChange,
    size = 'md',
    fullWidth = false,
}: SegmentedControlProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

    // Calculate indicator position
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const activeIndex = options.findIndex(opt => opt.value === value);
        const buttons = container.querySelectorAll('button');
        const activeButton = buttons[activeIndex];

        if (activeButton) {
            setIndicatorStyle({
                left: activeButton.offsetLeft,
                width: activeButton.offsetWidth,
            });
        }
    }, [value, options]);

    const sizeClasses = {
        sm: 'text-xs py-1.5 px-3',
        md: 'text-sm py-2 px-4',
        lg: 'text-base py-2.5 px-5',
    };

    return (
        <div
            ref={containerRef}
            className={`
                relative inline-flex p-1 rounded-xl
                bg-slate-800/80 backdrop-blur-sm
                border border-slate-700/50
                ${fullWidth ? 'w-full' : ''}
            `}
        >
            {/* Sliding indicator */}
            <div
                className="
                    absolute top-1 bottom-1 rounded-lg
                    bg-gradient-to-b from-slate-600 to-slate-700
                    shadow-lg shadow-black/20
                    border border-slate-600/50
                    transition-all duration-300 ease-out
                "
                style={{
                    left: indicatorStyle.left,
                    width: indicatorStyle.width,
                }}
            />

            {/* Options */}
            {options.map((option) => {
                const isActive = option.value === value;
                return (
                    <button
                        key={String(option.value)}
                        onClick={() => onChange(option.value)}
                        className={`
                            relative z-10 font-medium rounded-lg
                            transition-colors duration-200
                            ${sizeClasses[size]}
                            ${fullWidth ? 'flex-1' : ''}
                            ${isActive
                                ? 'text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }
                        `}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

// Pre-configured for period selection
export function PeriodSegmentedControl({
    value,
    onChange,
}: {
    value: number;
    onChange: (value: number) => void;
}) {
    const options = [
        { value: 1, label: 'Вчера' },
        { value: 7, label: 'Неделя' },
        { value: 14, label: '14 дней' },
        { value: 30, label: 'Месяц' },
        { value: 90, label: 'Квартал' },
    ];

    return (
        <SegmentedControl
            options={options}
            value={value}
            onChange={onChange}
            size="sm"
        />
    );
}
