/**
 * Unified caching layer with TTL support
 * Used across AI service, IAP matching, and directional spread
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  /**
   * Get value from cache if not expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in cache with current timestamp
   */
  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Simple in-memory cache without TTL
 * For data that doesn't expire (e.g., loaded from files)
 */
export class SimpleCache<T> {
  private cache: T | null = null;

  /**
   * Get cached value
   */
  get(): T | null {
    return this.cache;
  }

  /**
   * Set cached value
   */
  set(value: T): void {
    this.cache = value;
  }

  /**
   * Check if cache has value
   */
  has(): boolean {
    return this.cache !== null;
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache = null;
  }
}
