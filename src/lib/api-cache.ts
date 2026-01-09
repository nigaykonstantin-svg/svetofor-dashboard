/**
 * Simple in-memory cache for API responses
 * Prevents rate limiting by caching responses for a configurable TTL
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
}

class APICache {
    private cache: Map<string, CacheEntry<unknown>> = new Map();
    private defaultTTL: number = 5 * 60 * 1000; // 5 minutes default

    /**
     * Get cached data if available and not expired
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        console.log(`[Cache HIT] ${key} (expires in ${Math.round((entry.expiresAt - Date.now()) / 1000)}s)`);
        return entry.data as T;
    }

    /**
     * Set cache entry with optional TTL override
     */
    set<T>(key: string, data: T, ttlMs?: number): void {
        const ttl = ttlMs ?? this.defaultTTL;
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            expiresAt: Date.now() + ttl,
        };
        this.cache.set(key, entry);
        console.log(`[Cache SET] ${key} (TTL: ${ttl / 1000}s)`);
    }

    /**
     * Invalidate specific cache entry
     */
    invalidate(key: string): boolean {
        const deleted = this.cache.delete(key);
        if (deleted) console.log(`[Cache INVALIDATE] ${key}`);
        return deleted;
    }

    /**
     * Invalidate all entries matching a pattern
     */
    invalidatePattern(pattern: string): number {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
                count++;
            }
        }
        if (count > 0) console.log(`[Cache INVALIDATE] ${count} entries matching "${pattern}"`);
        return count;
    }

    /**
     * Clear entire cache
     */
    clear(): void {
        const size = this.cache.size;
        this.cache.clear();
        console.log(`[Cache CLEAR] ${size} entries removed`);
    }

    /**
     * Get cache statistics
     */
    stats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        };
    }

    /**
     * Wrapper for async functions with caching
     */
    async withCache<T>(
        key: string,
        fetcher: () => Promise<T>,
        ttlMs?: number
    ): Promise<T> {
        // Check cache first
        const cached = this.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        // Fetch and cache
        const data = await fetcher();
        this.set(key, data, ttlMs);
        return data;
    }
}

// Singleton instance
export const apiCache = new APICache();

// Cache key generators for consistent keys
export const cacheKeys = {
    svetofor: (period: number) => `svetofor_${period}`,
    stocks: () => 'wb_stocks',
    funnel: (period: number) => `wb_funnel_${period}`,
    adverts: () => 'wb_adverts',
    analytics: (startDate: string, endDate: string) => `analytics_${startDate}_${endDate}`,
    goals: (month: number, year: number) => `goals_${year}_${month}`,
};

// TTL presets (in milliseconds)
export const cacheTTL = {
    SHORT: 2 * 60 * 1000,      // 2 minutes - for frequently changing data
    MEDIUM: 5 * 60 * 1000,     // 5 minutes - default
    LONG: 15 * 60 * 1000,      // 15 minutes - for stable data
    HOUR: 60 * 60 * 1000,      // 1 hour - for very stable data
};
