'use client';

import { useState, useEffect, useCallback } from 'react';
import { SvetoforData } from '@/types';

interface UseSvetoforDataResult {
    data: SvetoforData | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useSvetoforData(period: number): UseSvetoforDataResult {
    const [data, setData] = useState<SvetoforData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Read user thresholds from localStorage and pass to API
            let thresholdsParam = '';
            if (typeof window !== 'undefined') {
                try {
                    const savedThresholds = localStorage.getItem('svetofor_thresholds');
                    if (savedThresholds) {
                        thresholdsParam = `&thresholds=${encodeURIComponent(savedThresholds)}`;
                    }
                } catch (e) {
                    // localStorage not available
                }
            }

            const response = await fetch(`/api/svetofor?period=${period}${thresholdsParam}`);
            const result = await response.json();

            if (result.success) {
                setData(result);
            } else {
                setError(result.error || 'Unknown error');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refetch: fetchData };
}
