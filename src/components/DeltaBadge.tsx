'use client';

interface DeltaBadgeProps {
    value: number | string | null | undefined;
    format?: 'percent' | 'absolute' | 'points'; // points for CR changes like +2.3pp
    size?: 'sm' | 'md';
}

export default function DeltaBadge({ value, format = 'percent', size = 'sm' }: DeltaBadgeProps) {
    if (value === null || value === undefined) {
        return <span className="text-slate-600">—</span>;
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) {
        return <span className="text-slate-600">—</span>;
    }

    const isPositive = numValue > 0;
    const isNegative = numValue < 0;
    const absValue = Math.abs(numValue);

    // Format the display value
    let displayValue: string;
    if (format === 'percent') {
        displayValue = `${isPositive ? '+' : ''}${numValue.toFixed(0)}%`;
    } else if (format === 'points') {
        displayValue = `${isPositive ? '+' : ''}${numValue}pp`;
    } else {
        displayValue = `${isPositive ? '+' : ''}${numValue.toFixed(0)}`;
    }

    // Choose icon and color
    const colors = isPositive
        ? 'text-emerald-400'
        : isNegative
            ? 'text-rose-400'
            : 'text-slate-500';

    const icon = isPositive ? '▲' : isNegative ? '▼' : '●';

    const sizeClasses = size === 'sm'
        ? 'text-xs px-1.5 py-0.5'
        : 'text-sm px-2 py-1';

    return (
        <span className={`inline-flex items-center gap-0.5 ${colors} ${sizeClasses} font-medium`}>
            <span className="text-[10px]">{icon}</span>
            <span>{displayValue}</span>
        </span>
    );
}

// Compact version for table cells - shows value + delta
interface ValueWithDeltaProps {
    value: number | string;
    delta?: number | string | null;
    format?: 'money' | 'number' | 'percent';
    deltaFormat?: 'percent' | 'absolute' | 'points';
}

export function ValueWithDelta({ value, delta, format = 'number', deltaFormat = 'percent' }: ValueWithDeltaProps) {
    // Format main value
    let displayValue: string;
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (format === 'money') {
        if (numValue >= 1_000_000) {
            displayValue = `${(numValue / 1_000_000).toFixed(1)}M`;
        } else if (numValue >= 1_000) {
            displayValue = `${(numValue / 1_000).toFixed(0)}K`;
        } else {
            displayValue = numValue.toLocaleString('ru-RU');
        }
    } else if (format === 'percent') {
        displayValue = `${numValue}%`;
    } else {
        displayValue = numValue.toLocaleString('ru-RU');
    }

    return (
        <div className="flex flex-col items-end gap-0.5">
            <span className="text-white">{displayValue}</span>
            {delta !== undefined && delta !== null && (
                <DeltaBadge value={delta} format={deltaFormat} size="sm" />
            )}
        </div>
    );
}
