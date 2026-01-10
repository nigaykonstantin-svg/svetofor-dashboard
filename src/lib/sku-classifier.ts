// SKU Classifier Engine
// Классификация товаров на Gold/Silver/Bronze по выручке

import { SKUData } from '@/types/dashboard';
import { Category } from '@/lib/auth-types';
import { SKUClass, SKUClassification, DEFAULT_CLASS_BENCHMARKS } from '@/types/sku-goals';

// Пороги для классификации (% от топа по выручке)
const CLASS_THRESHOLDS = {
    gold: 20,    // Топ 20%
    silver: 50,  // Следующие 30% (20-50%)
    bronze: 100, // Остальные 50%
};

// Минимальный порог для "new" SKU (дней с первой продажи)
const NEW_SKU_THRESHOLD_DAYS = 30;

/**
 * Классифицировать массив SKU по выручке
 * @param skuData - массив данных SKU
 * @param revenueField - поле для расчёта выручки (orderSum по умолчанию)
 * @returns Map<nmId, SKUClassification>
 */
export function classifySKUs(
    skuData: SKUData[],
    revenueField: 'orderSum' | 'buyoutSum' = 'orderSum'
): Map<number, SKUClassification> {
    const result = new Map<number, SKUClassification>();

    if (skuData.length === 0) return result;

    // 1. Собрать выручку по nmId (на случай дублей)
    const revenueByNmId = new Map<number, { revenue: number; sku: string }>();

    for (const item of skuData) {
        const revenue = (item as any)[revenueField] || 0;
        const existing = revenueByNmId.get(item.nmId);

        if (existing) {
            existing.revenue += revenue;
        } else {
            revenueByNmId.set(item.nmId, {
                revenue,
                sku: item.sku || String(item.nmId),
            });
        }
    }

    // 2. Сортировать по выручке (убывание)
    const sortedEntries = [...revenueByNmId.entries()]
        .sort((a, b) => b[1].revenue - a[1].revenue);

    const totalCount = sortedEntries.length;

    // 3. Рассчитать перцентили и присвоить классы
    for (let i = 0; i < sortedEntries.length; i++) {
        const [nmId, data] = sortedEntries[i];
        const percentile = ((i + 1) / totalCount) * 100;

        let skuClass: SKUClass;

        if (percentile <= CLASS_THRESHOLDS.gold) {
            skuClass = 'gold';
        } else if (percentile <= CLASS_THRESHOLDS.silver) {
            skuClass = 'silver';
        } else {
            skuClass = 'bronze';
        }

        result.set(nmId, {
            nmId,
            sku: data.sku,
            skuClass,
            revenue30d: data.revenue,
            percentile: Math.round(percentile * 10) / 10,
        });
    }

    return result;
}

/**
 * Классифицировать SKU по категориям
 * @param skuData - массив данных SKU
 * @returns Map<Category, Map<nmId, SKUClassification>>
 */
export function classifySKUsByCategory(
    skuData: SKUData[]
): Map<Category, Map<number, SKUClassification>> {
    const result = new Map<Category, Map<number, SKUClassification>>();

    // Группировать SKU по категориям
    const byCategory = new Map<Category, SKUData[]>();

    for (const sku of skuData) {
        const category = mapWBCategoryToCategory(sku.category || '');
        if (!category) continue;

        const list = byCategory.get(category) || [];
        list.push(sku);
        byCategory.set(category, list);
    }

    // Классифицировать каждую категорию отдельно
    for (const [category, items] of byCategory) {
        result.set(category, classifySKUs(items));
    }

    return result;
}

/**
 * Получить рекомендуемые цели для класса SKU
 */
export function getClassBenchmarks(
    skuClass: SKUClass,
    categoryBenchmarks?: Record<SKUClass, { ctr: number; crCart: number; crOrder: number }>
): { ctr: number; crCart: number; crOrder: number } {
    // Использовать категорийные бенчмарки если есть
    if (categoryBenchmarks && categoryBenchmarks[skuClass]) {
        return categoryBenchmarks[skuClass];
    }

    // Fallback на дефолтные
    return DEFAULT_CLASS_BENCHMARKS[skuClass];
}

/**
 * Преобразовать WB категорию в Category ID
 */
function mapWBCategoryToCategory(wbCategory: string): Category | null {
    const normalized = wbCategory.toLowerCase().trim();

    if (normalized.includes('лицо') || normalized.includes('face')) {
        return 'face';
    }
    if (normalized.includes('тело') || normalized.includes('body')) {
        return 'body';
    }
    if (normalized.includes('макияж') || normalized.includes('makeup')) {
        return 'makeup';
    }
    if (normalized.includes('волос') || normalized.includes('hair')) {
        return 'hair';
    }

    return null;
}

/**
 * Статистика по классификации
 */
export interface ClassificationStats {
    total: number;
    byClass: Record<SKUClass, number>;
    totalRevenue: number;
    revenueByClass: Record<SKUClass, number>;
}

/**
 * Получить статистику классификации
 */
export function getClassificationStats(
    classifications: Map<number, SKUClassification>
): ClassificationStats {
    const stats: ClassificationStats = {
        total: classifications.size,
        byClass: { gold: 0, silver: 0, bronze: 0, new: 0 },
        totalRevenue: 0,
        revenueByClass: { gold: 0, silver: 0, bronze: 0, new: 0 },
    };

    for (const classification of classifications.values()) {
        stats.byClass[classification.skuClass]++;
        stats.totalRevenue += classification.revenue30d;
        stats.revenueByClass[classification.skuClass] += classification.revenue30d;
    }

    return stats;
}

/**
 * Найти Gold SKU которые требуют внимания (низкие метрики)
 */
export function findGoldAtRisk(
    classifications: Map<number, SKUClassification>,
    skuData: SKUData[],
    thresholds: { minCTR: number; minCRCart: number; minCROrder: number }
): SKUData[] {
    const goldNmIds = new Set<number>();

    for (const [nmId, classification] of classifications) {
        if (classification.skuClass === 'gold') {
            goldNmIds.add(nmId);
        }
    }

    return skuData.filter(sku => {
        if (!goldNmIds.has(sku.nmId)) return false;

        const ctr = parseFloat(sku.crCart as string) || 0;
        const crCart = parseFloat(sku.crOrder as string) || 0;

        return ctr < thresholds.minCTR || crCart < thresholds.minCRCart;
    });
}
