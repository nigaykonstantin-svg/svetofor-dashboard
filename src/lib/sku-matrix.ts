// SKU Matrix data loader
// Source: Матрица sku - sku WB от Вероники.xlsx

import skuMatrixData from '@/data/sku-matrix.json';

export interface SKUMatrixItem {
    sku: string;
    nmId: number;
    categoryWB: string;
    subCategoryWB: string;
    brandManager: string;
    categoryManager: string;
}

export interface SKUMatrix {
    lastUpdated: string;
    totalSKUs: number;
    categories: string[];
    brandManagers: string[];
    categoryManagers: string[];
    skus: SKUMatrixItem[];
}

// Cache the lookup map
let nmIdMap: Map<number, SKUMatrixItem> | null = null;

export function getSkuMatrix(): SKUMatrix {
    return skuMatrixData as SKUMatrix;
}

export function getSKUByNmId(nmId: number): SKUMatrixItem | undefined {
    if (!nmIdMap) {
        nmIdMap = new Map();
        for (const sku of skuMatrixData.skus) {
            nmIdMap.set(sku.nmId, sku);
        }
    }
    return nmIdMap.get(nmId);
}

export function getCategories(): string[] {
    return skuMatrixData.categories;
}

export function getBrandManagers(): string[] {
    return skuMatrixData.brandManagers;
}

export function getCategoryManagers(): string[] {
    return skuMatrixData.categoryManagers;
}

// Get SKUs by manager
export function getSKUsByBrandManager(name: string): SKUMatrixItem[] {
    return skuMatrixData.skus.filter(s => s.brandManager === name);
}

export function getSKUsByCategoryManager(name: string): SKUMatrixItem[] {
    return skuMatrixData.skus.filter(s => s.categoryManager === name);
}

// Get SKUs by category
export function getSKUsByCategory(category: string): SKUMatrixItem[] {
    return skuMatrixData.skus.filter(s => s.categoryWB === category);
}
