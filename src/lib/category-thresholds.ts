// Category-specific thresholds for signal engine
// Edit these values to customize alerts per category

export interface CategoryThresholds {
    STOCK_CRITICAL_DAYS: number;   // Критично мало дней остатка
    STOCK_WARNING_DAYS: number;    // Предупреждение об остатке
    STOCK_OVERSTOCK_DAYS: number;  // Затоваривание (дней)
    CR_CART_LOW: number;           // Низкая конверсия в корзину %
    CR_ORDER_LOW: number;          // Низкая конверсия в заказ %
    CR_ORDER_HIGH: number;         // Топ конверсия (выше рынка) %
    CTR_LOW: number;               // Низкий CTR (показы → корзина) %
    CTR_HIGH: number;              // Высокий CTR (топ) %
    DRR_HIGH: number;              // Высокий ДРР (убыточная реклама) %
    DRR_CRITICAL: number;          // Критично высокий ДРР %
    BUYOUT_LOW: number;            // Низкий процент выкупа %
    SALES_DROP: number;            // Падение продаж vs прошлая неделя %
    SALES_DROP_CRITICAL: number;   // Критичное падение продаж %
}

// Default thresholds (used when category not specified or not found)
export const DEFAULT_THRESHOLDS: CategoryThresholds = {
    STOCK_CRITICAL_DAYS: 7,
    STOCK_WARNING_DAYS: 14,
    STOCK_OVERSTOCK_DAYS: 90,
    CR_CART_LOW: 5,
    CR_ORDER_LOW: 2,
    CR_ORDER_HIGH: 8,
    CTR_LOW: 4,
    CTR_HIGH: 10,
    DRR_HIGH: 30,
    DRR_CRITICAL: 50,
    BUYOUT_LOW: 50,
    SALES_DROP: 20,
    SALES_DROP_CRITICAL: 40,
};

// Per-category thresholds
// Customize each category based on its specific characteristics
export const CATEGORY_THRESHOLDS: Record<string, Partial<CategoryThresholds>> = {
    // Уход за лицом — высокий оборот, быстрые продажи
    'Уход за лицом': {
        STOCK_CRITICAL_DAYS: 5,      // Быстрее заканчивается
        STOCK_WARNING_DAYS: 10,
        STOCK_OVERSTOCK_DAYS: 60,    // Меньший запас нормален
        CR_CART_LOW: 6,              // Выше ожидания по CTR
        CR_ORDER_HIGH: 10,           // Выше стандарт для топов
        CTR_LOW: 5,                  // Строже к CTR
        CTR_HIGH: 12,                // Выше стандарт для топов
        DRR_HIGH: 25,                // Строже к рекламе
        BUYOUT_LOW: 60,              // Выше выкуп ожидаем
        SALES_DROP: 15,              // Быстрый рынок - раньше реагируем
        SALES_DROP_CRITICAL: 30,
    },

    // Уход за телом — средний оборот
    'Уход за телом': {
        STOCK_CRITICAL_DAYS: 7,
        STOCK_WARNING_DAYS: 14,
        STOCK_OVERSTOCK_DAYS: 90,
        CR_CART_LOW: 4,              // Чуть ниже порог
        CR_ORDER_HIGH: 7,
        CTR_LOW: 3,                  // Более лояльный порог
        CTR_HIGH: 9,
        DRR_HIGH: 35,                // Чуть лояльнее
        BUYOUT_LOW: 45,              // Ниже порог выкупа
        SALES_DROP: 20,
        SALES_DROP_CRITICAL: 40,
    },

    // Макияж — сезонность, высокая конкуренция
    'Макияж': {
        STOCK_CRITICAL_DAYS: 10,     // Можно держать чуть больше
        STOCK_WARNING_DAYS: 21,
        STOCK_OVERSTOCK_DAYS: 120,   // Сезонный товар, больше запас норма
        CR_CART_LOW: 4,
        CR_ORDER_HIGH: 6,            // Труднее достичь высокого CR
        CTR_LOW: 3,                  // Высокая конкуренция - сложнее
        CTR_HIGH: 8,
        DRR_HIGH: 40,                // Выше допуск по рекламе
        BUYOUT_LOW: 40,              // Много возвратов нормально
        SALES_DROP: 25,              // Сезонность - больше допуск
        SALES_DROP_CRITICAL: 50,
    },

    // Уход за волосами — стабильный спрос
    'Уход за волосами': {
        STOCK_CRITICAL_DAYS: 7,
        STOCK_WARNING_DAYS: 14,
        STOCK_OVERSTOCK_DAYS: 100,
        CR_CART_LOW: 5,
        CR_ORDER_HIGH: 9,
        CTR_LOW: 4,
        CTR_HIGH: 10,
        DRR_HIGH: 30,
        BUYOUT_LOW: 55,
        SALES_DROP: 20,
        SALES_DROP_CRITICAL: 40,
    },
};

// Get thresholds for a specific category
export function getThresholds(category?: string): CategoryThresholds {
    if (!category) return DEFAULT_THRESHOLDS;

    const categoryThresholds = CATEGORY_THRESHOLDS[category];
    if (!categoryThresholds) return DEFAULT_THRESHOLDS;

    // Merge with defaults
    return {
        ...DEFAULT_THRESHOLDS,
        ...categoryThresholds,
    };
}

// Get all available categories
export function getConfiguredCategories(): string[] {
    return Object.keys(CATEGORY_THRESHOLDS);
}
