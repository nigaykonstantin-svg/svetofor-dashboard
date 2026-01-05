'use client';

interface CategoryTabsProps {
    categories: string[];
    selectedCategory: string;
    onCategorySelect: (category: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
    'Все': 'bg-emerald-600',
    'Лицо': 'bg-pink-600',
    'Тело': 'bg-orange-600',
    'Макияж': 'bg-purple-600',
    'Волосы': 'bg-yellow-600',
};

const CATEGORY_EMOJIS: Record<string, string> = {
    'Все': '📊',
    'Лицо': '🧴',
    'Тело': '🧼',
    'Макияж': '💄',
    'Волосы': '💇',
};

export default function CategoryTabs({
    categories,
    selectedCategory,
    onCategorySelect,
}: CategoryTabsProps) {
    return (
        <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                const bgColor = CATEGORY_COLORS[cat] || 'bg-slate-600';
                const emoji = CATEGORY_EMOJIS[cat] || '📁';

                return (
                    <button
                        key={cat}
                        onClick={() => onCategorySelect(cat)}
                        className={`px-4 py-2 rounded-lg transition font-medium flex items-center gap-2 ${isSelected
                                ? `${bgColor} text-white shadow-lg`
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                            }`}
                    >
                        <span>{emoji}</span>
                        {cat}
                    </button>
                );
            })}
        </div>
    );
}
