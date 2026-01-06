'use client';

import { useState, useMemo, useCallback } from 'react';
import { SKUData, SortField, SortDirection } from '@/types';

// Default column visibility config
export const DEFAULT_COLUMNS = {
    sku: true,
    title: true,
    brandName: false,
    subjectName: false,
    category: false,
    subCategory: false,
    brandManager: false,
    categoryManager: false,
    stock: true,
    inTransit: false,
    stocksWb: false,
    stocksMp: false,
    salesPerDay: true,
    coverDays: true,
    views: false,
    cartCount: false,
    orderCount: false,
    buyoutCount: false,
    buyoutSum: false,
    ctr: true,
    crCart: false,
    crOrder: true,
    buyout: false,
    drr: true,
    advertSpend: false,
    orderSum: true,
    signal: true,
};

// Default filter values
export const DEFAULT_FILTERS = {
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

export type ColumnConfig = typeof DEFAULT_COLUMNS;
export type FilterConfig = typeof DEFAULT_FILTERS;

interface UseDashboardTableOptions {
    allSKUs: SKUData[];
    selectedCategory: string;
    selectedCluster: string | null;
    clusterData?: Record<string, SKUData[]>;
}

export function useDashboardTable({
    allSKUs,
    selectedCategory,
    selectedCluster,
    clusterData,
}: UseDashboardTableOptions) {
    // Sort state
    const [sortField, setSortField] = useState<SortField>('orderSum');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // Filters
    const [filters, setFilters] = useState<FilterConfig>(DEFAULT_FILTERS);
    const [showFilters, setShowFilters] = useState(false);

    // Columns
    const [columns, setColumns] = useState<ColumnConfig>(DEFAULT_COLUMNS);
    const [showColumns, setShowColumns] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // Get filtered SKUs based on cluster selection
    const clusterSKUs = useMemo(() => {
        if (!selectedCluster || !clusterData) return [];
        return clusterData[selectedCluster] || [];
    }, [selectedCluster, clusterData]);

    // Filter by category
    const categorySKUs = useMemo(() => {
        const base = selectedCluster ? clusterSKUs : allSKUs;
        if (selectedCategory === 'Все') return base;
        return base.filter(s =>
            s.category?.toLowerCase().includes(selectedCategory.toLowerCase())
        );
    }, [selectedCluster, clusterSKUs, allSKUs, selectedCategory]);

    // Apply search and filters
    const filteredSKUs = useMemo(() => {
        let result = categorySKUs;

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.sku?.toLowerCase().includes(q) ||
                s.title?.toLowerCase().includes(q) ||
                s.nmId?.toString().includes(q) ||
                s.vendorCode?.toLowerCase().includes(q)
            );
        }

        // Apply numeric filters
        if (filters.stockMin) result = result.filter(s => (s.totalStock || 0) >= parseFloat(filters.stockMin));
        if (filters.stockMax) result = result.filter(s => (s.totalStock || 0) <= parseFloat(filters.stockMax));
        if (filters.daysMin) result = result.filter(s => (s.stockCoverDays || 0) >= parseFloat(filters.daysMin));
        if (filters.daysMax) result = result.filter(s => (s.stockCoverDays || 0) <= parseFloat(filters.daysMax));
        if (filters.drrMin) result = result.filter(s => parseFloat(s.drr || '0') >= parseFloat(filters.drrMin));
        if (filters.drrMax) result = result.filter(s => parseFloat(s.drr || '0') <= parseFloat(filters.drrMax));

        return result;
    }, [categorySKUs, searchQuery, filters]);

    // Sort
    const sortedSKUs = useMemo(() => {
        return [...filteredSKUs].sort((a, b) => {
            let aVal = a[sortField] ?? 0;
            let bVal = b[sortField] ?? 0;

            if (typeof aVal === 'string') aVal = parseFloat(aVal) || 0;
            if (typeof bVal === 'string') bVal = parseFloat(bVal) || 0;

            return sortDirection === 'asc'
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });
    }, [filteredSKUs, sortField, sortDirection]);

    // Paginate
    const paginatedSKUs = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedSKUs.slice(start, start + itemsPerPage);
    }, [sortedSKUs, currentPage, itemsPerPage]);

    // Toggle sort
    const toggleSort = useCallback((field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    }, [sortField]);

    // Reset filters
    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
        setSearchQuery('');
    }, []);

    // Reset page when filters change
    const totalPages = Math.ceil(sortedSKUs.length / itemsPerPage);

    return {
        // Data
        filteredSKUs,
        sortedSKUs,
        paginatedSKUs,
        totalPages,
        totalFiltered: sortedSKUs.length,

        // Sort
        sortField,
        sortDirection,
        toggleSort,

        // Search
        searchQuery,
        setSearchQuery,

        // Filters
        filters,
        setFilters,
        showFilters,
        setShowFilters,
        resetFilters,

        // Columns
        columns,
        setColumns,
        showColumns,
        setShowColumns,

        // Pagination
        currentPage,
        setCurrentPage,
        itemsPerPage,
    };
}
