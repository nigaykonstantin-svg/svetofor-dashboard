// Centralized constants for category mappings
// Used across page.tsx and API routes

// Maps UI category tabs to WB category names
export const CATEGORY_MAP: Record<string, string[]> = {
    'Лицо': ['Уход за лицом'],
    'Тело': ['Уход за телом'],
    'Макияж': ['Макияж'],
    'Волосы': ['Уход за волосами'],
};

// Available category keys for UI tabs
export const CATEGORY_KEYS = ['Все', 'Лицо', 'Тело', 'Макияж', 'Волосы'] as const;

export type CategoryKey = typeof CATEGORY_KEYS[number];

// Maps Russian WB categories to English API config keys
export const CATEGORY_API_MAP: Record<string, string> = {
    'Уход за телом': 'body',
    'Уход за лицом': 'face',
    'Уход за волосами': 'hair',
    'Макияж': 'makeup',
};

// Reverse map: English keys to Russian category names
export const CATEGORY_REVERSE_MAP: Record<string, string> = {
    'body': 'Уход за телом',
    'face': 'Уход за лицом',
    'hair': 'Уход за волосами',
    'makeup': 'Макияж',
};

// Maps UI category to Category type (for goals)
export const CATEGORY_TO_ID: Record<string, string> = {
    'Лицо': 'face',
    'Тело': 'body',
    'Макияж': 'makeup',
    'Волосы': 'hair',
};
