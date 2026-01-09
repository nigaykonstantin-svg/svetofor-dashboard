'use client';

import { useState, useMemo, useCallback } from 'react';
import { SKUData, SortField, SortDirection } from '@/types';
import { CATEGORY_MAP } from '@/lib/constants';

export interface SKUFilters {
    stockMin: string;
    stockMax: string;
    daysMin: string;
    daysMax: string;
    ctrMin: string;
    ctrMax: string;
    crMin: string;
    crMax: string;
    drrMin: string;
    drrMax: string;
    salesMin: string;
    salesMax: string;
}

const DEFAULT_FILTERS: SKUFilters = {
    stockMin: '',
    stockMax: '',
    daysMin: '',
    daysMax: '',
    ctrMin: '',
    ctrMax: '',
    crMin: '',
    crMax: '',
    drrMin: '',
    drrMax: '',
    salesMin: '',
    salesMax: '',
};

interface UseSKUFiltersResult {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filters: SKUFilters;
    setFilters: (filters: SKUFilters) => void;
    sortField: SortField;
    sortDirection: SortDirection;
    handleSort: (field: SortField) => void;
    filteredSKUs: (SKUData & { signalType: string })[];
}

export function useSKUFilters(
    allSKUs: (SKUData & { signalType: string })[],
    selectedCluster: string | null,
    showAllSKUs: boolean,
    selectedCategory: string,
    debouncedSearchQuery?: string
): UseSKUFiltersResult {
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<SKUFilters>(DEFAULT_FILTERS);
    const [sortField, setSortField] = useState<SortField>('orderSum');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleSort = useCallback((field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    }, [sortField, sortDirection]);

    // Use debounced search query if provided, otherwise use raw query
    const effectiveSearchQuery = debouncedSearchQuery ?? searchQuery;

    const filteredSKUs = useMemo(() => {
        let result = showAllSKUs
            ? allSKUs
            : selectedCluster
                ? allSKUs.filter(s => s.signalType === selectedCluster)
                : [];

        // Search filter
        if (effectiveSearchQuery) {
            const q = effectiveSearchQuery.toLowerCase();
            result = result.filter(s =>
                s.sku.toLowerCase().includes(q) ||
                s.title.toLowerCase().includes(q) ||
                s.nmId.toString().includes(q)
            );
        }

        // Category filter - using categoryWB from matrix
        if (selectedCategory !== 'Все') {
            const allowedCategories = CATEGORY_MAP[selectedCategory] || [];
            result = result.filter(s =>
                allowedCategories.some(cat =>
                    s.category?.toLowerCase() === cat.toLowerCase()
                )
            );
        }

        // Advanced filters
        if (filters.stockMin) result = result.filter(s => s.stockTotal >= parseFloat(filters.stockMin));
        if (filters.stockMax) result = result.filter(s => s.stockTotal <= parseFloat(filters.stockMax));
        if (filters.daysMin) result = result.filter(s => parseFloat(s.stockCoverDays) >= parseFloat(filters.daysMin));
        if (filters.daysMax) result = result.filter(s => parseFloat(s.stockCoverDays) <= parseFloat(filters.daysMax));
        if (filters.ctrMin) result = result.filter(s => parseFloat(s.crCart || '0') >= parseFloat(filters.ctrMin));
        if (filters.ctrMax) result = result.filter(s => parseFloat(s.crCart || '0') <= parseFloat(filters.ctrMax));
        if (filters.crMin) result = result.filter(s => parseFloat(s.crOrder || '0') >= parseFloat(filters.crMin));
        if (filters.crMax) result = result.filter(s => parseFloat(s.crOrder || '0') <= parseFloat(filters.crMax));
        if (filters.drrMin) result = result.filter(s => parseFloat(s.drr || '0') >= parseFloat(filters.drrMin));
        if (filters.drrMax) result = result.filter(s => parseFloat(s.drr || '0') <= parseFloat(filters.drrMax));
        if (filters.salesMin) result = result.filter(s => parseFloat(s.ordersPerDay) >= parseFloat(filters.salesMin));
        if (filters.salesMax) result = result.filter(s => parseFloat(s.ordersPerDay) <= parseFloat(filters.salesMax));

        // Sort
        result.sort((a, b) => {
            let aVal: number | string = 0;
            let bVal: number | string = 0;

            switch (sortField) {
                case 'sku': aVal = a.sku; bVal = b.sku; break;
                case 'title': aVal = a.title; bVal = b.title; break;
                case 'stockTotal': aVal = a.stockTotal; bVal = b.stockTotal; break;
                case 'ordersPerDay': aVal = parseFloat(a.ordersPerDay) || 0; bVal = parseFloat(b.ordersPerDay) || 0; break;
                case 'stockCoverDays': aVal = parseFloat(a.stockCoverDays) || 999; bVal = parseFloat(b.stockCoverDays) || 999; break;
                case 'crCart': aVal = parseFloat(a.crCart || '0'); bVal = parseFloat(b.crCart || '0'); break;
                case 'crOrder': aVal = parseFloat(a.crOrder || '0'); bVal = parseFloat(b.crOrder || '0'); break;
                case 'drr': aVal = parseFloat(a.drr || '0'); bVal = parseFloat(b.drr || '0'); break;
                case 'orderSum': aVal = a.orderSum; bVal = b.orderSum; break;
            }

            if (typeof aVal === 'string') {
                return sortDirection === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
            }
            return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
        });

        return result;
    }, [allSKUs, selectedCluster, effectiveSearchQuery, sortField, sortDirection, showAllSKUs, filters, selectedCategory]);

    return {
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        sortField,
        sortDirection,
        handleSort,
        filteredSKUs,
    };
}
