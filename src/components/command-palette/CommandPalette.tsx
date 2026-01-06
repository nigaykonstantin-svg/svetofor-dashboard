'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    // Data for search
    skus?: Array<{ nmId: number; sku: string; title: string; category?: string }>;
    // Callbacks
    onSelectSKU?: (nmId: number) => void;
    onNavigate?: (path: string) => void;
    onAction?: (action: string) => void;
}

interface Command {
    id: string;
    label: string;
    icon: string;
    category: 'navigation' | 'action' | 'filter' | 'sku';
    action: () => void;
    keywords?: string[];
}

export default function CommandPalette({
    isOpen,
    onClose,
    skus = [],
    onSelectSKU,
    onNavigate,
    onAction,
}: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Built-in commands
    const builtInCommands: Command[] = useMemo(() => [
        // Navigation
        { id: 'nav-dashboard', label: 'Перейти на дашборд', icon: '📊', category: 'navigation', action: () => onNavigate?.('/'), keywords: ['главная', 'home'] },
        { id: 'nav-tasks', label: 'Открыть задачи', icon: '📋', category: 'navigation', action: () => onNavigate?.('/tasks'), keywords: ['tasks', 'задания'] },
        { id: 'nav-goals', label: 'Открыть цели', icon: '🎯', category: 'navigation', action: () => onNavigate?.('/goals'), keywords: ['goals', 'план'] },
        { id: 'nav-settings', label: 'Настройки', icon: '⚙️', category: 'navigation', action: () => onAction?.('settings'), keywords: ['settings', 'параметры'] },
        // Actions
        { id: 'action-refresh', label: 'Обновить данные', icon: '🔄', category: 'action', action: () => onAction?.('refresh'), keywords: ['refresh', 'reload'] },
        { id: 'action-export', label: 'Экспорт в Excel', icon: '📥', category: 'action', action: () => onAction?.('export'), keywords: ['export', 'excel', 'csv'] },
        { id: 'action-ai', label: 'AI Анализ', icon: '🤖', category: 'action', action: () => onAction?.('ai'), keywords: ['ai', 'analysis', 'анализ'] },
        // Filters
        { id: 'filter-oos', label: 'Показать OOS', icon: '🔴', category: 'filter', action: () => onAction?.('filter:OOS_NOW'), keywords: ['oos', 'out of stock', 'нет в наличии'] },
        { id: 'filter-lowctr', label: 'Показать Low CTR', icon: '🟡', category: 'filter', action: () => onAction?.('filter:LOW_CTR'), keywords: ['ctr', 'low ctr'] },
        { id: 'filter-highdrr', label: 'Показать High DRR', icon: '🟠', category: 'filter', action: () => onAction?.('filter:HIGH_DRR'), keywords: ['drr', 'реклама'] },
        { id: 'filter-top', label: 'Показать топ-товары', icon: '🟢', category: 'filter', action: () => onAction?.('filter:ABOVE_MARKET'), keywords: ['top', 'лучшие'] },
        { id: 'filter-all', label: 'Показать все SKU', icon: '📦', category: 'filter', action: () => onAction?.('filter:ALL'), keywords: ['all', 'все'] },
    ], [onNavigate, onAction]);

    // Filter commands based on query
    const filteredCommands = useMemo(() => {
        const q = query.toLowerCase().trim();
        if (!q) return builtInCommands.slice(0, 8); // Show first 8 when empty

        const results: Command[] = [];

        // Search built-in commands
        for (const cmd of builtInCommands) {
            const labelMatch = cmd.label.toLowerCase().includes(q);
            const keywordMatch = cmd.keywords?.some(k => k.includes(q));
            if (labelMatch || keywordMatch) {
                results.push(cmd);
            }
        }

        // Search SKUs
        if (skus.length > 0 && q.length >= 2) {
            const matchingSKUs = skus
                .filter(s =>
                    s.sku.toLowerCase().includes(q) ||
                    s.nmId.toString().includes(q) ||
                    s.title.toLowerCase().includes(q)
                )
                .slice(0, 5); // Limit to 5 SKU results

            for (const sku of matchingSKUs) {
                results.push({
                    id: `sku-${sku.nmId}`,
                    label: `${sku.sku} — ${sku.title.slice(0, 40)}...`,
                    icon: '🏷️',
                    category: 'sku',
                    action: () => onSelectSKU?.(sku.nmId),
                });
            }
        }

        return results.slice(0, 10); // Max 10 results
    }, [query, builtInCommands, skus, onSelectSKU]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(i => Math.max(i - 1, 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (filteredCommands[selectedIndex]) {
                        filteredCommands[selectedIndex].action();
                        onClose();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredCommands, selectedIndex, onClose]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Reset selection when query changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Scroll selected item into view
    useEffect(() => {
        const list = listRef.current;
        if (!list) return;
        const selected = list.children[selectedIndex] as HTMLElement;
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    const categoryLabels: Record<string, string> = {
        navigation: 'Навигация',
        action: 'Действия',
        filter: 'Фильтры',
        sku: 'Товары',
    };

    // Group commands by category
    const groupedCommands = filteredCommands.reduce((acc, cmd) => {
        if (!acc[cmd.category]) acc[cmd.category] = [];
        acc[cmd.category].push(cmd);
        return acc;
    }, {} as Record<string, Command[]>);

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Palette */}
            <div
                className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
                    <span className="text-slate-400 text-xl">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Поиск команд, SKU, фильтров..."
                        className="flex-1 bg-transparent text-white text-lg outline-none placeholder:text-slate-500"
                    />
                    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 bg-slate-800 rounded border border-slate-600">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
                    {filteredCommands.length === 0 ? (
                        <div className="px-4 py-8 text-center text-slate-500">
                            Ничего не найдено
                        </div>
                    ) : (
                        Object.entries(groupedCommands).map(([category, commands]) => (
                            <div key={category}>
                                <div className="px-4 py-1 text-xs font-medium text-slate-500 uppercase tracking-wide">
                                    {categoryLabels[category] || category}
                                </div>
                                {commands.map((cmd) => {
                                    const globalIndex = filteredCommands.indexOf(cmd);
                                    const isSelected = globalIndex === selectedIndex;
                                    return (
                                        <button
                                            key={cmd.id}
                                            onClick={() => {
                                                cmd.action();
                                                onClose();
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${isSelected
                                                    ? 'bg-emerald-600/20 text-emerald-400'
                                                    : 'text-white hover:bg-slate-800'
                                                }`}
                                        >
                                            <span className="text-xl">{cmd.icon}</span>
                                            <span className="flex-1 truncate">{cmd.label}</span>
                                            {isSelected && (
                                                <kbd className="text-xs text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">
                                                    ↵
                                                </kbd>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer hint */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700 text-xs text-slate-500">
                    <span>↑↓ для навигации</span>
                    <span>↵ выбрать</span>
                    <span>esc закрыть</span>
                </div>
            </div>
        </div>,
        document.body
    );
}

// Hook to manage Command Palette state with ⌘K shortcut
export function useCommandPalette() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // ⌘K (Mac) or Ctrl+K (Windows/Linux)
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen(prev => !prev),
    };
}
