// Client-side cache for SKU data
// Stores data in localStorage to speed up page loads

const CACHE_KEY_PREFIX = 'svetofor_cache_';
const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
    period: number;
}

/**
 * Get cached data from localStorage
 */
export function getClientCache<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = localStorage.getItem(CACHE_KEY_PREFIX + key);
        if (!raw) return null;

        const entry: CacheEntry<T> = JSON.parse(raw);

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            localStorage.removeItem(CACHE_KEY_PREFIX + key);
            console.log(`[Client Cache] Expired: ${key}`);
            return null;
        }

        console.log(`[Client Cache] HIT: ${key} (age: ${Math.round((Date.now() - entry.timestamp) / 1000)}s)`);
        return entry.data;
    } catch (e) {
        console.warn('[Client Cache] Parse error:', e);
        return null;
    }
}

/**
 * Set cached data in localStorage
 */
export function setClientCache<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL, period?: number): void {
    if (typeof window === 'undefined') return;

    try {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            expiresAt: Date.now() + ttlMs,
            period: period || 0,
        };

        localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry));
        console.log(`[Client Cache] SET: ${key} (TTL: ${ttlMs / 1000}s)`);
    } catch (e) {
        console.warn('[Client Cache] Storage error:', e);
        // If localStorage is full, clear old entries
        clearOldClientCache();
    }
}

/**
 * Get cached SKU data, falling back to cached data for longer period
 * For example: if period=10 is requested but we have period=30 cached, use that
 */
export function getCachedSKUData(requestedPeriod: number): { data: any; cachedPeriod: number } | null {
    if (typeof window === 'undefined') return null;

    // First, try exact match
    const exactMatch = getClientCache<any>(`sku_period_${requestedPeriod}`);
    if (exactMatch) {
        return { data: exactMatch, cachedPeriod: requestedPeriod };
    }

    // Try to find any cached data with a longer or equal period
    const possiblePeriods = [30, 14, 7]; // Common periods

    for (const period of possiblePeriods) {
        if (period >= requestedPeriod) {
            const cached = getClientCache<any>(`sku_period_${period}`);
            if (cached) {
                console.log(`[Client Cache] Using period=${period} cache for requested period=${requestedPeriod}`);
                return { data: cached, cachedPeriod: period };
            }
        }
    }

    return null;
}

/**
 * Cache SKU data with period info
 */
export function cacheSKUData(data: any, period: number): void {
    // Cache with longer TTL for longer periods
    const ttl = period >= 30 ? 15 * 60 * 1000 : 10 * 60 * 1000;
    setClientCache(`sku_period_${period}`, data, ttl, period);
}

/**
 * Clear old cache entries to free space
 */
export function clearOldClientCache(): void {
    if (typeof window === 'undefined') return;

    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_KEY_PREFIX)) {
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const entry = JSON.parse(raw);
                    if (Date.now() > entry.expiresAt) {
                        keysToRemove.push(key);
                    }
                }
            } catch (e) {
                keysToRemove.push(key!);
            }
        }
    }

    for (const key of keysToRemove) {
        localStorage.removeItem(key);
    }

    if (keysToRemove.length > 0) {
        console.log(`[Client Cache] Cleared ${keysToRemove.length} expired entries`);
    }
}

/**
 * Clear all svetofor cache
 */
export function clearAllClientCache(): void {
    if (typeof window === 'undefined') return;

    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_KEY_PREFIX)) {
            keysToRemove.push(key);
        }
    }

    for (const key of keysToRemove) {
        localStorage.removeItem(key);
    }

    console.log(`[Client Cache] Cleared all ${keysToRemove.length} entries`);
}
